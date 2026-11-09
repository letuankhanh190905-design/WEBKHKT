import os
import re
import json
import base64
import io
import logging
import requests
from PIL import Image

import config

logger = logging.getLogger('GEMINI_SERVICE')

class GeminiPlantDoctor:
    def __init__(self):
        self.api_key = config.GEMINI_API_KEY
        self.default_model = config.GEMINI_MODEL
        # Danh sách model dự phòng theo thứ tự ưu tiên
        self.candidate_models = [
            self.default_model,
            'gemini-3.5-flash',
            'gemini-flash-latest',
            'gemini-3-flash-preview',
            'gemini-3.5-flash-lite'
        ]
        # Loại bỏ trùng lặp giữ nguyên thứ tự
        seen = set()
        self.models_to_try = [m for m in self.candidate_models if not (m in seen or seen.add(m))]

    def _prepare_image(self, image_input):
        """
        Chuẩn hóa ảnh đầu vào từ các nguồn khác nhau:
        - Base64 data URL: data:image/jpeg;base64,...
        - Raw base64 string
        - Raw bytes
        Chuyển thành bytes JPEG kích thước tối ưu (max 1024px)
        """
        image_bytes = None

        if isinstance(image_input, str):
            # Nếu là chuỗi data URL (thường do Canvas toDataURL tạo ra)
            if ',' in image_input:
                header, encoded = image_input.split(',', 1)
                image_bytes = base64.b64decode(encoded)
            else:
                image_bytes = base64.b64decode(image_input)
        elif isinstance(image_input, bytes):
            image_bytes = image_input
        elif hasattr(image_input, 'read'):
            image_bytes = image_input.read()
        else:
            raise ValueError("Định dạng hình ảnh đầu vào không hợp lệ")

        # Dùng PIL mở và tối ưu kích thước
        pil_img = Image.open(io.BytesIO(image_bytes))
        
        # Xử lý xoay theo EXIF nếu có
        try:
            from PIL import ImageOps
            pil_img = ImageOps.exif_transpose(pil_img)
        except Exception:
            pass

        # Chuyển RGBA sang RGB nếu là ảnh PNG trong suốt
        if pil_img.mode in ('RGBA', 'LA', 'P'):
            rgb_img = Image.new('RGB', pil_img.size, (255, 255, 255))
            if pil_img.mode == 'P':
                pil_img = pil_img.convert('RGBA')
            rgb_img.paste(pil_img, mask=pil_img.split()[-1] if pil_img.mode == 'RGBA' else None)
            pil_img = rgb_img
        elif pil_img.mode != 'RGB':
            pil_img = pil_img.convert('RGB')

        # Giảm kích thước nếu ảnh quá lớn để tối ưu tốc độ truyền tải
        max_dim = 1024
        if max(pil_img.size) > max_dim:
            pil_img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

        # Xuất ra JPEG bytes
        output_buffer = io.BytesIO()
        pil_img.save(output_buffer, format='JPEG', quality=85)
        jpeg_bytes = output_buffer.getvalue()

        return base64.b64encode(jpeg_bytes).decode('utf-8')

    def analyze_plant(self, image_input, environment_data):
        """
        Gửi ảnh lá cây cùng bộ dữ liệu cảm biến E-Ra đến Gemini Vision API
        """
        if not self.api_key:
            return {
                'success': False,
                'error': 'Chưa cấu hình GEMINI_API_KEY trong file .env hoặc config.py'
            }

        # 1. Chuẩn bị ảnh
        try:
            b64_image = self._prepare_image(image_input)
        except Exception as e:
            logger.error(f"Lỗi xử lý ảnh: {e}")
            return {
                'success': False,
                'error': f'Không thể đọc hoặc xử lý định dạng hình ảnh: {str(e)}'
            }

        # 2. Chuẩn bị thông số môi trường từ E-Ra
        temp = environment_data.get('temperature', '--')
        humidity = environment_data.get('humidity_air', '--')
        soil_moisture = environment_data.get('humidity_soil', '--')
        pin_v = environment_data.get('battery', '--')

        prompt = f"""Bạn là một chuyên gia hàng đầu về nông nghiệp thông minh, bệnh học thực vật và điều khiển vi khí hậu nhà kính.
Hãy phân tích hình ảnh lá cây được cung cấp kết hợp với bộ thông số môi trường thực tế thu nhận từ hệ thống cảm biến IoT E-Ra sau:
- Nhiệt độ không khí: {temp} °C
- Độ ẩm không khí: {humidity} %
- Độ ẩm đất: {soil_moisture} %
- Điện áp PIN nguồn IoT: {pin_v} V

YÊU CẦU PHÂN TÍCH:
1. Đọc và chẩn đoán tình trạng lá cây: Có khỏe mạnh không, có xuất hiện nấm bệnh, vi khuẩn, sâu rầy, đốm cháy, vàng lá do thiếu vi lượng (sắt, đạm, magie) hoặc biểu hiện sốc nhiệt/úng nước hay không?
2. Đánh giá tác động của môi trường: Với số liệu đo được hiện tại, nhiệt độ, độ ẩm không khí và độ ẩm đất có đang tạo điều kiện cho nấm/khuẩn phát triển hoặc gây căng thẳng (stress) cho cây không?
3. Khuyến nghị hành động tức thì: Cần tưới thêm nước, bật quạt thông gió để giảm ẩm/giảm nhiệt, điều chỉnh đèn quang học hay bón phân, dùng thuốc gì?

ĐỊNH DẠNG TRẢ VỀ:
BẮT BUỘC chỉ trả về 1 chuỗi JSON thuần túy (không kèm dấu ```json ... ```, không kèm văn bản mở đầu hay kết thúc) theo đúng cấu trúc sau:
{{
  "health_status": "good" hoặc "warning" hoặc "danger",
  "health_score": <số nguyên từ 0 đến 100>,
  "disease_name": "<Tên bệnh cụ thể hoặc 'Cây khỏe mạnh, không phát hiện bệnh'>",
  "diagnosis": "<Mô tả chi tiết các dấu hiệu quan sát thấy trên lá cây và nguyên nhân chẩn đoán>",
  "environment_assessment": "<Đánh giá cụ thể tác động của nhiệt độ {temp}°C, độ ẩm không khí {humidity}%, độ ẩm đất {soil_moisture}% đối với sức khỏe cây>",
  "recommendations": "<Khuyến nghị hành động cụ thể cho người trồng>",
  "suggested_actions": [
    {{
      "device": "pump",
      "action": 1 hoặc 0,
      "label": "Bật Máy Bơm" hoặc "Tắt Máy Bơm",
      "reason": "<Lý do liên quan đến độ ẩm đất {soil_moisture}%>"
    }},
    {{
      "device": "fan",
      "action": 1 hoặc 0,
      "label": "Bật Quạt Thông Gió" hoặc "Tắt Quạt",
      "reason": "<Lý do liên quan đến nhiệt độ {temp}°C hoặc độ ẩm {humidity}%>"
    }},
    {{
      "device": "light",
      "action": 1 hoặc 0,
      "label": "Bật Đèn Chiếu Sáng" hoặc "Tắt Đèn",
      "reason": "<Lý do quang hợp>"
    }}
  ]
}}
"""

        payload = {
            'contents': [{
                'parts': [
                    {'text': prompt},
                    {
                        'inline_data': {
                            'mime_type': 'image/jpeg',
                            'data': b64_image
                        }
                    }
                ]
            }],
            'generationConfig': {
                'temperature': 0.2,
                'topP': 0.8,
                'maxOutputTokens': 2048
            }
        }

        # 3. Thử gọi API qua danh sách model khả dụng
        last_error = None
        for model_name in self.models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.api_key}"
            try:
                logger.info(f"Đang phân tích ảnh cây trồng với Gemini Model: {model_name}...")
                resp = requests.post(
                    url,
                    headers={'Content-Type': 'application/json'},
                    json=payload,
                    timeout=22
                )

                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get('candidates', [])
                    if candidates and 'content' in candidates[0]:
                        parts = candidates[0]['content'].get('parts', [])
                        if parts and 'text' in parts[0]:
                            raw_text = parts[0]['text'].strip()
                            parsed_result = self._parse_gemini_response(raw_text, temp, humidity, soil_moisture)
                            parsed_result['model_used'] = model_name
                            parsed_result['success'] = True
                            return parsed_result
                elif resp.status_code == 404:
                    logger.warning(f"Model {model_name} không khả dụng (404), đang chuyển model tiếp theo...")
                    last_error = f"Model {model_name} không tìm thấy"
                    continue
                elif resp.status_code == 503:
                    logger.warning(f"Model {model_name} quá tải (503), đang thử model khác...")
                    last_error = f"Model {model_name} hiện đang quá tải"
                    continue
                else:
                    err_msg = resp.text
                    logger.error(f"Gemini API lỗi ({resp.status_code}): {err_msg}")
                    last_error = f"HTTP {resp.status_code}: {err_msg}"
            except requests.exceptions.Timeout:
                logger.warning(f"Timeout khi gọi model {model_name}, đang thử model khác...")
                last_error = f"Hết thời gian chờ phản hồi từ model {model_name}"
            except Exception as e:
                logger.error(f"Lỗi khi gọi model {model_name}: {e}")
                last_error = str(e)

        return {
            'success': False,
            'error': f'Không thể hoàn thành chẩn đoán AI: {last_error or "Tất cả các model Gemini đều không phản hồi"}'
        }

    def _parse_gemini_response(self, text, temp, humidity, soil):
        """
        Trích xuất JSON từ phản hồi của Gemini
        """
        # Xóa markdown code block nếu Gemini có lỡ bọc ```json ... ```
        clean_text = text.strip()
        if clean_text.startswith('```'):
            clean_text = re.sub(r'^```(?:json)?\s*', '', clean_text, flags=re.IGNORECASE)
            clean_text = re.sub(r'\s*```$', '', clean_text)
        clean_text = clean_text.strip()

        try:
            data = json.loads(clean_text)
            return data
        except Exception:
            # Tìm kiếm khối json bằng regex
            match = re.search(r'\{.*\}', clean_text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except Exception:
                    pass

        # Fallback định dạng thủ công nếu JSON không hợp lệ
        logger.warning("Không thể parse JSON từ Gemini, chuyển sang fallback parser")
        return {
            'health_status': 'warning',
            'health_score': 70,
            'disease_name': 'Xem chi tiết chẩn đoán',
            'diagnosis': text,
            'environment_assessment': f"Nhiệt độ hiện tại {temp}°C, Độ ẩm không khí {humidity}%, Độ ẩm đất {soil}%.",
            'recommendations': 'Thực hiện theo phân tích chi tiết ở trên.',
            'suggested_actions': []
        }

import os
import json
import logging
from collections import deque
from datetime import datetime
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS

import config
from era_service import EraService
from gemini_service import GeminiPlantDoctor

# Thiết lập logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger('ERA_DASHBOARD')

app = Flask(__name__)
CORS(app)

# Khởi tạo Service E-Ra & Gemini AI
era_service = EraService()
gemini_doctor = GeminiPlantDoctor()

# Bộ nhớ đệm lưu trữ lịch sử các điểm đo gần nhất để vẽ biểu đồ realtime
MAX_HISTORY_POINTS = 30
history_data = {
    'timestamps': deque(maxlen=MAX_HISTORY_POINTS),
    'temperature': deque(maxlen=MAX_HISTORY_POINTS),
    'humidity_air': deque(maxlen=MAX_HISTORY_POINTS),
    'humidity_soil': deque(maxlen=MAX_HISTORY_POINTS),
    'battery': deque(maxlen=MAX_HISTORY_POINTS),
}

# Nhật ký thao tác điều khiển thiết bị (Activity Log)
MAX_ACTIVITY_LOGS = 50
activity_logs = deque(maxlen=MAX_ACTIVITY_LOGS)

def record_activity(source, message, status='info'):
    activity_logs.appendleft({
        'time': datetime.now().strftime('%H:%M:%S'),
        'source': source,
        'message': message,
        'status': status
    })

# Ghi nhận log khởi động
record_activity('System', 'Ứng dụng Web Dashboard IoT E-Ra đã khởi động thành công.', 'success')

@app.route('/')
def index():
    """Trang chủ Dashboard"""
    return render_template(
        'index.html',
        device_id=config.ERA_DEVICE_ID,
        polling_interval=config.POLLING_INTERVAL,
        sensors_config=config.SENSORS_CONFIG,
        controls_config=config.CONTROLS_CONFIG
    )

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    """
    Endpoint cung cấp dữ liệu cho chu kỳ Polling định kỳ (mỗi 3-5 giây)
    Trả về toàn bộ số đo cảm biến, trạng thái bật/tắt thiết bị và lịch sử biểu đồ
    """
    data = era_service.get_dashboard_data()

    # Cập nhật vào chuỗi dữ liệu lịch sử để biểu đồ Chart.js hiển thị
    if data.get('success') and data.get('is_online'):
        now_time = datetime.now().strftime('%H:%M:%S')
        sensors = data.get('sensors', {})
        
        t_val = sensors.get('temperature', {}).get('value')
        ha_val = sensors.get('humidity_air', {}).get('value')
        hs_val = sensors.get('humidity_soil', {}).get('value')
        bat_val = sensors.get('battery', {}).get('value')

        # Thêm điểm đo vào hàng đợi
        history_data['timestamps'].append(now_time)
        history_data['temperature'].append(t_val if t_val is not None else 0)
        history_data['humidity_air'].append(ha_val if ha_val is not None else 0)
        history_data['humidity_soil'].append(hs_val if hs_val is not None else 0)
        history_data['battery'].append(bat_val if bat_val is not None else 0)

    data['history'] = {
        'timestamps': list(history_data['timestamps']),
        'temperature': list(history_data['temperature']),
        'humidity_air': list(history_data['humidity_air']),
        'humidity_soil': list(history_data['humidity_soil']),
        'battery': list(history_data['battery']),
    }
    data['activity_logs'] = list(activity_logs)[:15]

    return jsonify(data)

@app.route('/api/control', methods=['POST'])
def control_device():
    """
    Endpoint xử lý lệnh điều khiển thiết bị (Bơm, Quạt, Đèn, Chế độ Auto, Ngưỡng độ ẩm)
    Hỗ trợ cả 2 dạng payload:
    Dạng 1 (Theo tên thiết bị): {"device": "pump", "value": 1}
    Dạng 2 (Theo chuẩn E-Ra trigger): {"key": "<ACTION_KEY>", "data": {"value": 1}, "source": "internet"}
    """
    try:
        req_data = request.get_json(force=True, silent=True) or {}
    except Exception:
        req_data = {}

    action_key = req_data.get('key')
    value = req_data.get('value')
    device_name = req_data.get('device')

    # Nếu truyền theo tên thiết bị (pump, fan, light, auto, soil_threshold)
    if device_name and device_name in config.CONTROLS_CONFIG:
        device_cfg = config.CONTROLS_CONFIG[device_name]
        action_key = device_cfg['key']
        device_display_name = device_cfg['name']
    else:
        # Tìm tên hiển thị dựa vào key nếu có
        device_display_name = "Thiết bị"
        for k, v in config.CONTROLS_CONFIG.items():
            if v['key'] == action_key:
                device_display_name = v['name']
                break

    # Nếu truyền data theo chuẩn E-Ra: "data": {"value": 1}
    if value is None and 'data' in req_data:
        data_field = req_data.get('data')
        if isinstance(data_field, dict):
            value = data_field.get('value', 1)
        elif isinstance(data_field, (int, float)):
            value = data_field
        elif isinstance(data_field, str):
            try:
                parsed = json.loads(data_field)
                value = parsed.get('value', 1)
            except Exception:
                value = data_field

    if value is None:
        value = 1  # Mặc định bật nếu không truyền

    if not action_key:
        return jsonify({
            'success': False,
            'error': 'Thiếu action key hoặc mã định danh thiết bị hợp lệ.'
        }), 400

    # Gửi lệnh điều khiển sang E-Ra API
    result = era_service.trigger_action(action_key, value)

    if result.get('success'):
        state_str = "BẬT" if value == 1 else ("TẮT" if value == 0 else f"Giá trị = {value}")
        msg = f"Đã gửi lệnh {state_str} cho '{device_display_name}' thành công."
        record_activity('Control', msg, 'success')
        return jsonify({
            'success': True,
            'message': msg,
            'device': device_name,
            'value': value,
            'action_key': action_key,
            'era_response': result.get('data')
        })
    else:
        err_msg = result.get('error', 'Lỗi không xác định khi kích hoạt hành động trên E-Ra.')
        record_activity('Control', f"Lỗi điều khiển '{device_display_name}': {err_msg}", 'danger')
        return jsonify({
            'success': False,
            'error': err_msg,
            'device': device_name,
            'action_key': action_key
        }), 500

@app.route('/api/analyze-plant', methods=['POST'])
def analyze_plant():
    """
    Endpoint phân tích sức khỏe cây trồng bằng AI (Gemini Vision)
    kết hợp với dữ liệu cảm biến thời gian thực từ E-Ra
    """
    # 1. Trích xuất hình ảnh (Multipart hoặc JSON base64)
    image_data = None
    if 'image' in request.files:
        image_data = request.files['image'].read()
    elif request.is_json:
        req_json = request.get_json(silent=True) or {}
        image_data = req_json.get('image')
    else:
        # Thử lấy từ form
        image_data = request.form.get('image')

    if not image_data:
        return jsonify({
            'success': False,
            'error': 'Vui lòng cung cấp hình ảnh lá cây (dạng tệp tin hoặc chuỗi base64).'
        }), 400

    # 2. Tự động lấy số liệu môi trường tức thời mới nhất từ E-Ra
    latest_dashboard = era_service.get_dashboard_data()
    sensors = latest_dashboard.get('sensors', {})

    env_data = {
        'temperature': sensors.get('temperature', {}).get('value', 29.0),
        'humidity_air': sensors.get('humidity_air', {}).get('value', 78.0),
        'humidity_soil': sensors.get('humidity_soil', {}).get('value', 31.0),
        'battery': sensors.get('battery', {}).get('value', 3.95),
        'timestamp': latest_dashboard.get('timestamp', datetime.now().strftime('%H:%M:%S'))
    }

    # 3. Gửi sang Gemini Vision
    analysis = gemini_doctor.analyze_plant(image_data, env_data)

    if analysis.get('success'):
        disease = analysis.get('disease_name', 'Không phát hiện bệnh')
        status = analysis.get('health_status', 'good')
        log_type = 'success' if status == 'good' else ('warning' if status == 'warning' else 'danger')
        record_activity('AI Doctor', f"Đã phân tích lá cây: {disease} (Đánh giá: {status.upper()})", log_type)
        analysis['environment_snapshot'] = env_data
        return jsonify(analysis)
    else:
        err = analysis.get('error', 'Lỗi không xác định khi phân tích ảnh bằng Gemini AI.')
        record_activity('AI Doctor', f"Lỗi phân tích AI: {err[:60]}", 'danger')
        return jsonify(analysis), 500

@app.route('/api/configs', methods=['GET'])
def get_configs():
    """Lấy danh sách cấu hình thông số kỹ thuật từ E-Ra (GET /chip_manager/configs/)"""
    result = era_service.get_configs()
    return jsonify(result)

@app.route('/api/device/display', methods=['GET'])
def get_device_display():
    """Lấy cấu hình giao diện thiết bị từ E-Ra (GET /property_manager/devices/{id}/display/)"""
    dev_id = request.args.get('device_id', config.ERA_DEVICE_ID)
    result = era_service.get_device_display(dev_id)
    return jsonify(result)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Kiểm tra tình trạng hoạt động của Middleware và kết nối E-Ra"""
    return jsonify({
        'status': 'healthy',
        'middleware': 'Flask E-Ra Bridge',
        'era_base_url': config.ERA_BASE_URL,
        'device_id': config.ERA_DEVICE_ID,
        'polling_interval': config.POLLING_INTERVAL
    })

if __name__ == '__main__':
    logger.info("=====================================================")
    logger.info("  KHỞI ĐỘNG WEB DASHBOARD GIÁM SÁT & ĐIỀU KHIỂN E-RA  ")
    logger.info("=====================================================")
    logger.info(f" E-Ra Base URL: {config.ERA_BASE_URL}")
    logger.info(f" Thiết bị ID: {config.ERA_DEVICE_ID}")
    logger.info(f" Web Dashboard: http://127.0.0.1:{config.PORT}")
    logger.info("=====================================================")
    app.run(host='0.0.0.0', port=config.PORT, debug=config.DEBUG)

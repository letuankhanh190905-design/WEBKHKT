import json
import logging
import requests
from config import (
    ERA_BASE_URL,
    ERA_AUTH_TOKEN,
    ERA_USER_AGENT,
    ERA_DEVICE_ID,
    SENSORS_CONFIG,
    CONTROLS_CONFIG
)

logger = logging.getLogger(__name__)

class EraService:
    def __init__(self):
        self.base_url = ERA_BASE_URL.rstrip('/')
        self.token = ERA_AUTH_TOKEN
        self.user_agent = ERA_USER_AGENT
        self.device_id = ERA_DEVICE_ID
        self.timeout = 6  # seconds

    def _get_headers(self):
        return {
            'Authorization': self.token,
            'User-Agent': self.user_agent,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

    def _format_url(self, endpoint):
        endpoint = endpoint.strip()
        if not endpoint.startswith('/'):
            endpoint = '/' + endpoint
        
        # Đảm bảo có prefix /api nếu cần
        if not endpoint.startswith('/api/'):
            endpoint = '/api' + endpoint

        return f"{self.base_url}{endpoint}"

    def request(self, method, endpoint, payload=None, params=None):
        url = self._format_url(endpoint)
        headers = self._get_headers()
        try:
            resp = requests.request(
                method=method,
                url=url,
                headers=headers,
                json=payload,
                params=params,
                timeout=self.timeout
            )
            
            # Xử lý các mã lỗi đặc thù
            if resp.status_code == 401 or resp.status_code == 403:
                return {
                    'success': False,
                    'error': f'Lỗi xác thực E-Ra ({resp.status_code}): Token không hợp lệ hoặc không có quyền truy cập.',
                    'status_code': resp.status_code,
                    'data': None
                }
            
            if resp.status_code >= 400:
                try:
                    err_json = resp.json()
                except Exception:
                    err_json = resp.text
                return {
                    'success': False,
                    'error': f'E-Ra API trả về lỗi ({resp.status_code}): {err_json}',
                    'status_code': resp.status_code,
                    'data': None
                }

            # Thành công
            try:
                data = resp.json()
            except Exception:
                data = resp.text

            return {
                'success': True,
                'data': data,
                'status_code': resp.status_code
            }

        except requests.exceptions.Timeout:
            return {
                'success': False,
                'error': f'Hết thời gian chờ phản hồi từ E-Ra ({self.timeout}s). Kiểm tra kết nối mạng.',
                'status_code': 408,
                'data': None
            }
        except requests.exceptions.ConnectionError:
            return {
                'success': False,
                'error': 'Không thể kết nối đến máy chủ E-Ra (https://backend.eoh.io). Kiểm tra mạng Internet.',
                'status_code': 503,
                'data': None
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Lỗi ngoại lệ khi gọi E-Ra API: {str(e)}',
                'status_code': 500,
                'data': None
            }

    def get_configs(self):
        """Lấy danh sách toàn bộ các config của tài khoản"""
        return self.request('GET', '/chip_manager/configs/')

    def get_config_current_value(self, config_id):
        """Lấy giá trị hiện tại của một config_id (lấy trường current_value_only)"""
        res = self.request('GET', f'/chip_manager/configs/{config_id}/current_value/')
        if res['success'] and isinstance(res['data'], dict):
            return res['data'].get('current_value_only', None)
        return None

    def get_device_display(self, device_id=None):
        """Lấy thông tin cấu hình hiển thị và điều khiển của thiết bị"""
        target_id = device_id or self.device_id
        return self.request('GET', f'/property_manager/devices/{target_id}/display/')

    def get_dashboard_data(self):
        """
        Lấy toàn bộ dữ liệu cảm biến và trạng thái công tắc điều khiển
        phục vụ chu kỳ Polling (mỗi 3-5s) của Dashboard
        """
        import datetime
        now = datetime.datetime.now()
        timestamp_str = now.strftime('%H:%M:%S %d/%m/%Y')

        # 1. Thu thập dữ liệu cảm biến
        sensors_data = {}
        for s_key, s_cfg in SENSORS_CONFIG.items():
            cid = s_cfg['id']
            val = self.get_config_current_value(cid)
            
            # Format làm tròn cho đẹp
            display_val = val
            if isinstance(val, (int, float)):
                if s_key == 'battery':
                    display_val = round(float(val), 2)
                elif s_key in ('temperature', 'humidity_air', 'humidity_soil'):
                    display_val = round(float(val), 1)

            sensors_data[s_key] = {
                'id': cid,
                'name': s_cfg['name'],
                'unit': s_cfg.get('unit', ''),
                'raw_value': val,
                'value': display_val,
                'icon': s_cfg.get('icon', ''),
                'color': s_cfg.get('color', '#3b82f6'),
                'min': s_cfg.get('min', 0),
                'max': s_cfg.get('max', 100)
            }
            if 'states' in s_cfg and val is not None:
                int_val = int(round(val))
                state_info = s_cfg['states'].get(int_val, {'text': f'Mã {int_val}', 'color': 'gray', 'bg': 'bg-gray-500/20', 'border': 'border-gray-500', 'badge': 'bg-gray-500'})
                sensors_data[s_key]['state_text'] = state_info['text']
                sensors_data[s_key]['state_color'] = state_info['color']
                sensors_data[s_key]['state_bg'] = state_info['bg']
                sensors_data[s_key]['state_border'] = state_info['border']
                sensors_data[s_key]['state_badge'] = state_info['badge']

        # 2. Thu thập trạng thái các thiết bị điều khiển
        controls_data = {}
        for c_key, c_cfg in CONTROLS_CONFIG.items():
            cid = c_cfg['config_id']
            val = self.get_config_current_value(cid)
            is_active = bool(val and val >= 1.0) if c_key != 'soil_threshold' else None
            
            controls_data[c_key] = {
                'key': c_cfg['key'],
                'config_id': cid,
                'name': c_cfg['name'],
                'short_name': c_cfg.get('short_name', c_cfg['name']),
                'icon': c_cfg.get('icon', ''),
                'active_color': c_cfg.get('active_color', 'bg-blue-600'),
                'description': c_cfg.get('description', ''),
                'raw_value': val,
                'is_active': is_active,
                'value': round(float(val), 1) if val is not None else 0
            }

        # 3. Đánh giá trạng thái kết nối
        # Nếu đọc được ít nhất 1 giá trị cảm biến khác None thì coi như online
        is_online = any(s['raw_value'] is not None for s in sensors_data.values())

        return {
            'success': True,
            'is_online': is_online,
            'timestamp': timestamp_str,
            'device_id': self.device_id,
            'device_name': 'Nhà kính thông minh',
            'sensors': sensors_data,
            'controls': controls_data
        }

    def trigger_action(self, action_key, value):
        """
        Gọi POST /chip_manager/trigger_action/
        Chuẩn payload theo E-Ra API:
        {
            "key": "<ACTION_KEY>",
            "data": "{\"value\": <VALUE>}",  # E-Ra yêu cầu data dạng JSON string
            "source": "internet"
        }
        """
        if not action_key:
            return {'success': False, 'error': 'Action key không được để trống'}

        # Đảm bảo data là JSON string theo chuẩn E-Ra backend serializer
        if isinstance(value, (int, float)):
            data_str = json.dumps({'value': value})
        elif isinstance(value, dict):
            data_str = json.dumps(value)
        else:
            data_str = json.dumps({'value': int(value)})

        payload = {
            'key': action_key,
            'data': data_str,
            'source': 'internet'
        }

        res = self.request('POST', '/chip_manager/trigger_action/', payload=payload)
        return res

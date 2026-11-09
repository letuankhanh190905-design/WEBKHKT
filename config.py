import os
from pathlib import Path

# Đọc file .env độc lập (không bắt buộc phải có python-dotenv)
def load_env(env_path=None):
    if env_path is None:
        env_path = Path(__file__).resolve().parent / '.env'
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key not in os.environ:
                        os.environ[key] = val

load_env()

# Base URL & Header E-Ra API
ERA_BASE_URL = os.getenv('ERA_BASE_URL', 'https://backend.eoh.io').rstrip('/')
# Đảm bảo token đúng chuẩn E-Ra: 'Token <hash>'
raw_token = os.getenv('ERA_AUTH_TOKEN', 'Token f02a4e8debb990c3aa0fc371ac2a0654a66dcdb8').strip()
if not raw_token.startswith('Token ') and not raw_token.startswith('Bearer '):
    ERA_AUTH_TOKEN = f"Token {raw_token}"
else:
    ERA_AUTH_TOKEN = raw_token

# User-Agent chống bị Cloudflare chặn lỗi 1010
ERA_USER_AGENT = os.getenv(
    'ERA_USER_AGENT', 
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
)

# ID thiết bị E-Ra
ERA_DEVICE_ID = int(os.getenv('ERA_DEVICE_ID', 35306))

# Cấu hình Cảm biến (Sensor Configs)
SENSORS_CONFIG = {
    'temperature': {
        'id': int(os.getenv('CONFIG_TEMP_ID', 195920)),
        'name': 'Nhiệt độ',
        'unit': '°C',
        'icon': 'fa-temperature-half',
        'color': '#ef4444', # Đỏ/Cam
        'min': 0,
        'max': 60,
    },
    'humidity_air': {
        'id': int(os.getenv('CONFIG_HUMID_AIR_ID', 195921)),
        'name': 'Độ ẩm không khí',
        'unit': '%',
        'icon': 'fa-droplet',
        'color': '#3b82f6', # Xanh dương
        'min': 0,
        'max': 100,
    },
    'humidity_soil': {
        'id': int(os.getenv('CONFIG_HUMID_SOIL_ID', 195922)),
        'name': 'Độ ẩm đất',
        'unit': '%',
        'icon': 'fa-seedling',
        'color': '#10b981', # Xanh lá
        'min': 0,
        'max': 100,
    },
    'battery': {
        'id': int(os.getenv('CONFIG_BATTERY_ID', 195926)),
        'name': 'Điện áp PIN',
        'unit': 'V',
        'icon': 'fa-battery-three-quarters',
        'color': '#f59e0b', # Vàng cam
        'min': 0,
        'max': 5.0,
    },
    'status': {
        'id': int(os.getenv('CONFIG_STATUS_ID', 195913)),
        'name': 'Trạng thái hệ thống',
        'unit': '',
        'icon': 'fa-shield-halved',
        'color': '#8b5cf6', # Tím
        'states': {
            0: {'text': 'Bình thường', 'color': 'emerald', 'bg': 'bg-emerald-500/20', 'border': 'border-emerald-500', 'badge': 'bg-emerald-500'},
            1: {'text': 'Sai thẻ', 'color': 'amber', 'bg': 'bg-amber-500/20', 'border': 'border-amber-500', 'badge': 'bg-amber-500'},
            2: {'text': 'Báo lửa', 'color': 'rose', 'bg': 'bg-rose-500/20', 'border': 'border-rose-500', 'badge': 'bg-rose-500'}
        }
    }
}

# Cấu hình Thiết bị điều khiển (Control Actuators)
CONTROLS_CONFIG = {
    'pump': {
        'key': os.getenv('ACTION_PUMP_KEY', 'afc0d726-f8af-4eb9-9d89-04fd69c7862f'),
        'config_id': int(os.getenv('CONFIG_PUMP_ID', 195914)),
        'name': 'Máy Bơm Nước',
        'short_name': 'Bơm',
        'icon': 'fa-faucet-drip',
        'active_color': 'bg-blue-600',
        'description': 'Bơm tưới tự động hoặc cưỡng bức'
    },
    'fan': {
        'key': os.getenv('ACTION_FAN_KEY', 'a9acf7af-72ca-4b7d-a2df-0f6768633f64'),
        'config_id': int(os.getenv('CONFIG_FAN_ID', 195915)),
        'name': 'Quạt Thông Gió',
        'short_name': 'Quạt',
        'icon': 'fa-fan',
        'active_color': 'bg-emerald-600',
        'description': 'Lưu thông không khí nhà kính'
    },
    'light': {
        'key': os.getenv('ACTION_LIGHT_KEY', '533dd38f-393c-4db4-912b-ba03924d94b5'),
        'config_id': int(os.getenv('CONFIG_LIGHT_ID', 195925)),
        'name': 'Đèn Chiếu Sáng',
        'short_name': 'Đèn',
        'icon': 'fa-lightbulb',
        'active_color': 'bg-amber-500',
        'description': 'Đèn sinh trưởng quang học'
    },
    'auto': {
        'key': os.getenv('ACTION_AUTO_KEY', 'd05e5d11-fb1b-44d3-be97-289f3cfd9528'),
        'config_id': int(os.getenv('CONFIG_AUTO_ID', 195916)),
        'name': 'Chế độ Tự động (Auto)',
        'short_name': 'Auto',
        'icon': 'fa-robot',
        'active_color': 'bg-purple-600',
        'description': 'Hệ thống tự điều khiển theo cảm biến'
    },
    'soil_threshold': {
        'key': os.getenv('ACTION_SOIL_THRESHOLD_KEY', '2582dddc-82d9-44a3-879c-9a36b9e3f63f'),
        'config_id': int(os.getenv('CONFIG_SOIL_THRESHOLD_ID', 195917)),
        'name': 'Ngưỡng Độ Ẩm Đất Bơm Tự Động',
        'short_name': 'Ngưỡng ẩm đất',
        'icon': 'fa-sliders',
        'active_color': 'bg-indigo-600',
        'min': 0,
        'max': 100,
        'unit': '%',
        'description': 'Khi độ ẩm đất dưới ngưỡng này, hệ thống sẽ kích hoạt bơm'
    }
}

# Cấu hình Server
PORT = int(os.getenv('PORT', 5000))
DEBUG = os.getenv('DEBUG', 'True').lower() in ('true', '1', 'yes')
POLLING_INTERVAL = int(os.getenv('POLLING_INTERVAL_SECONDS', 3))

# Cấu hình Gemini AI Vision
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', 'AQ.Ab8RN6Jc-T3_GZFzHXJPBJ6vb8TmoWhvQIHo7NWC4ajKIkfO8Q').strip()
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-3.5-flash').strip()


"""
Công cụ hỗ trợ quét và liệt kê thông số thiết bị trên tài khoản E-Ra (EoH Platform)
Dùng để tra cứu nhanh:
- Chip ID & Tên Chip
- Abstract Device ID & Tên thiết bị
- Config IDs của tất cả các cảm biến
- Action Keys của các relay/công tắc điều khiển
"""

import sys
import json
import requests
from config import ERA_BASE_URL, ERA_AUTH_TOKEN, ERA_USER_AGENT

sys.stdout.reconfigure(encoding='utf-8')

headers = {
    'Authorization': ERA_AUTH_TOKEN,
    'User-Agent': ERA_USER_AGENT,
    'Content-Type': 'application/json'
}

def scan_account():
    print("=" * 60)
    print("  QUÉT THÔNG TIN TÀI KHOẢN TRÊN NỀN TẢNG IOT E-RA (EoH)")
    print("=" * 60)
    print(f"Base URL: {ERA_BASE_URL}")
    print(f"Auth Token: {ERA_AUTH_TOKEN[:15]}...{ERA_AUTH_TOKEN[-6:]}\n")

    # 1. Quét danh sách Chips
    print("[1] DANH SÁCH CHIP (VI ĐIỀU KHIỂN):")
    try:
        r = requests.get(f"{ERA_BASE_URL}/api/chip_manager/chips/", headers=headers, timeout=6)
        if r.status_code == 200:
            chips = r.json()
            for c in chips:
                print(f"   • Chip ID: {c.get('id')} | Tên: {c.get('name')}")
        else:
            print(f"   Lỗi khi đọc Chips: HTTP {r.status_code}")
    except Exception as e:
        print(f"   Lỗi kết nối: {e}")

    # 2. Quét Thiết bị (Devices & Units)
    print("\n[2] DANH SÁCH THIẾT BỊ HIỂN THỊ (DEVICES):")
    device_id = None
    try:
        r = requests.get(f"{ERA_BASE_URL}/api/property_manager/units_v2/my_with_devices/", headers=headers, timeout=6)
        if r.status_code == 200:
            units = r.json().get('results', [])
            for u in units:
                print(f"   • Dự án (Unit): {u.get('name')} (ID: {u.get('id')})")
                for d in u.get('abstract_devices', []):
                    device_id = d.get('id')
                    print(f"     -> Thiết bị (Device ID): {device_id} | Tên: {d.get('name')} | Chip: {d.get('chip_id')}")
        else:
            print(f"   Lỗi khi đọc Devices: HTTP {r.status_code}")
    except Exception as e:
        print(f"   Lỗi kết nối: {e}")

    # 3. Quét Display Layout & Action Keys nếu có device_id
    if device_id:
        print(f"\n[3] CẤU HÌNH HIỂN THỊ & ACTION KEYS CỦA THIẾT BỊ {device_id}:")
        try:
            r = requests.get(f"{ERA_BASE_URL}/api/property_manager/devices/{device_id}/display/", headers=headers, timeout=6)
            if r.status_code == 200:
                data = r.json()
                for item in data.get('items', []):
                    label = item.get('label')
                    tmpl = item.get('template')
                    print(f"\n   [*] Nhóm: {label} (Template: {tmpl})")
                    cfg = item.get('configuration', {})
                    if 'configs' in cfg:
                        for c in cfg['configs']:
                            if isinstance(c, dict):
                                print(f"       + Cảm biến: {c.get('standard') or c.get('name')} -> Config ID: {c.get('id')}")
                    if 'options' in cfg:
                        for opt in cfg['options']:
                            print(f"       + Công tắc: {opt.get('text')} -> Action Key: {opt.get('action')} | Config: {opt.get('config')}")
                    if tmpl == 'slider_range_template':
                        print(f"       + Slider: {label} -> Action Key: {cfg.get('action')} | Config: {cfg.get('config')}")
            else:
                print(f"   Lỗi khi đọc Display: HTTP {r.status_code}")
        except Exception as e:
            print(f"   Lỗi kết nối: {e}")

    # 4. Quét toàn bộ Configs của chip
    print("\n[4] DANH SÁCH TẤT CẢ CONFIGS TRÊN TÀI KHOẢN:")
    try:
        r = requests.get(f"{ERA_BASE_URL}/api/chip_manager/configs/", headers=headers, timeout=6)
        if r.status_code == 200:
            configs = r.json()
            for c in configs:
                print(f"   • ID: {c.get('id'):<8} | Tên: {c.get('name'):<22} | Đơn vị: {c.get('unit'):<5} | Sensor: {c.get('sensor', {}).get('name')}")
        else:
            print(f"   Lỗi khi đọc Configs: HTTP {r.status_code}")
    except Exception as e:
        print(f"   Lỗi kết nối: {e}")

    print("\n" + "=" * 60)
    print("  QUÉT HOÀN TẤT!")
    print("=" * 60)

if __name__ == '__main__':
    scan_account()

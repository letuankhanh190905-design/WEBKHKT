# 🌿 HỆ THỐNG WEB DASHBOARD GIÁM SÁT, ĐIỀU KHIỂN IOT E-RA & BÁC SĨ CÂY TRỒNG AI (GEMINI VISION)

Ứng dụng Web Dashboard hoàn chỉnh, hiện đại dành cho hệ thống IoT Nhà kính thông minh / Nông nghiệp công nghệ cao, kết nối trực tiếp với nền tảng **E-Ra (EoH Platform)** qua REST API và tích hợp mô hình **Google Gemini Vision AI** để chẩn đoán sức khỏe cây trồng qua hình ảnh Camera kết hợp dữ liệu môi trường thực tế.

---

## 📸 1. TÍNH NĂNG NỔI BẬT

### 1.1. Bác Sĩ Cây Trồng AI (Google Gemini Vision Multimodal)
- **Hỗ trợ Camera / Webcam trực tiếp:** Mở luồng video trực tiếp từ máy tính hoặc điện thoại di động (`navigator.mediaDevices.getUserMedia`) với nút "Chụp ảnh" (hiệu ứng Shutter Flash và Laser Scanner).
- **Hỗ trợ Tải ảnh sẵn có:** Kéo thả hoặc chọn tệp tin từ máy (`JPG, PNG, WEBP`).
- **Phân tích đa phương thức (Multimodal Fusion):** Backend tự động kết hợp hình ảnh lá cây với bộ thông số môi trường tức thời thu thập từ E-Ra (Nhiệt độ, Độ ẩm không khí, Độ ẩm đất, Điện áp PIN).
- **Kết quả chẩn đoán chuyên sâu:**
  - Nhãn trạng thái sức khỏe: 🟢 Khỏe mạnh / 🟡 Cần chú ý theo dõi / 🔴 Cảnh báo bệnh hại (kèm điểm số sức khỏe).
  - Tên bệnh cụ thể và mô tả hình thái lá (đốm bệnh, gân lá, sâu hại, thiếu vi lượng).
  - Đánh giá tác động của môi trường vi khí hậu đối với sự phát triển của cây.
  - Khuyến nghị hành động tức thời và các nút bấm **kích hoạt thiết bị nhanh** (bật bơm, quạt, đèn) trực tiếp trên bảng chẩn đoán!

### 1.2. Giám Sát Cảm Biến Thời Gian Thực (E-Ra Polling mỗi 3 giây)
- Cảm biến Nhiệt độ không khí (°C)
- Cảm biến Độ ẩm không khí (%)
- Cảm biến Độ ẩm đất (%)
- Cảm biến Điện áp PIN nguồn (V)
- Trạng thái An ninh & Cảnh báo (Bình thường / Sai thẻ RFID / Báo động cháy)

### 1.3. Điều Khiển Thiết Bị Trực Tiếp (Switches & Slider)
- **Máy Bơm Nước (Bơm)**: Bật / Tắt tưới ẩm
- **Quạt Thông Gió (Quạt)**: Bật / Tắt lưu thông không khí
- **Đèn Chiếu Sáng (Đèn)**: Bật / Tắt ánh sáng quang học
- **Chế Độ Tự Động (Auto)**: Bật / Tắt chế độ tự động hóa
- **Ngưỡng Độ Ẩm Đất (Slider 0 - 100%)**: Cài đặt ngưỡng độ ẩm để hệ thống tự kích hoạt bơm

### 1.4. Giao Diện & Trải Nghiệm Người Dùng
- Chế độ **Dark Mode / Light Mode** tùy chọn, tự lưu cấu hình vào `localStorage`.
- Giao diện đáp ứng (Responsive) tối ưu cho cả máy tính, máy tính bảng và smartphone.
- Biểu đồ thời gian thực **Chart.js** đa trục tọa độ.
- Nhật ký thao tác (Activity Log) và xử lý lỗi mạng / Token hiển thị trực quan.

---

## 📁 2. CẤU TRÚC THƯ MỤC DỰ ÁN

```text
DAKHKT2/
│
├── .env                       # File cấu hình biến môi trường (Token E-Ra, Gemini API Key, Device ID,...)
├── .env.example               # Mẫu file cấu hình tham khảo
├── config.py                  # Module cấu hình tập trung đọc .env
├── era_service.py             # Lớp Service middleware giao tiếp REST API với E-Ra
├── gemini_service.py          # Lớp Service phân tích ảnh lá cây bằng Google Gemini Vision API
├── app.py                     # Máy chủ Flask Backend (REST API, Polling controller, Router)
├── discover_era.py            # Công cụ tự động quét nhanh Config IDs và Action Keys từ tài khoản E-Ra
├── requirements.txt           # Danh sách thư viện Python cần thiết
├── README.md                  # Tài liệu hướng dẫn sử dụng chi tiết
│
├── templates/
│   └── index.html             # Giao diện Web Dashboard (HTML5, TailwindCSS, FontAwesome, Chart.js)
│
└── static/
    ├── css/
    │   └── custom.css         # Glassmorphism, Laser Scanner, Shutter Flash, Switch styles
    └── js/
        └── app.js             # Client Script: Webcam MediaStream, Polling 3s, Chart.js, Chẩn đoán AI
```

---

## ⚙️ 3. CẤU HÌNH & THÔNG TIN KẾT NỐI

### 3.1. Cấu hình file `.env`
Mở file `.env` tại thư mục gốc để chỉnh sửa cấu hình (Token E-Ra và Gemini API Key đã được cấu hình sẵn):

```env
# Cấu hình kết nối Nền tảng IoT E-Ra (EoH Platform)
ERA_BASE_URL=https://backend.eoh.io
ERA_AUTH_TOKEN=Token f02a4e8debb990c3aa0fc371ac2a0654a66dcdb8

# ID Thiết bị E-Ra (Nhà kính thông minh: 35306)
ERA_DEVICE_ID=35306

# ID Cấu hình Cảm biến (Sensor Config IDs)
CONFIG_TEMP_ID=195920
CONFIG_HUMID_AIR_ID=195921
CONFIG_HUMID_SOIL_ID=195922
CONFIG_BATTERY_ID=195926
CONFIG_STATUS_ID=195913

# Action Keys & Feedback Config IDs cho Điều khiển thiết bị
ACTION_PUMP_KEY=afc0d726-f8af-4eb9-9d89-04fd69c7862f
CONFIG_PUMP_ID=195914

ACTION_FAN_KEY=a9acf7af-72ca-4b7d-a2df-0f6768633f64
CONFIG_FAN_ID=195915

ACTION_LIGHT_KEY=533dd38f-393c-4db4-912b-ba03924d94b5
CONFIG_LIGHT_ID=195925

ACTION_AUTO_KEY=d05e5d11-fb1b-44d3-be97-289f3cfd9528
CONFIG_AUTO_ID=195916

ACTION_SOIL_THRESHOLD_KEY=2582dddc-82d9-44a3-879c-9a36b9e3f63f
CONFIG_SOIL_THRESHOLD_ID=195917

# Cấu hình Google Gemini AI API
GEMINI_API_KEY=AQ.Ab8RN6Jc-T3_GZFzHXJPBJ6vb8TmoWhvQIHo7NWC4ajKIkfO8Q
GEMINI_MODEL=gemini-3.5-flash

# Cấu hình Web Server
PORT=5000
DEBUG=True
POLLING_INTERVAL_SECONDS=3
```

---

## 📋 4. BẢNG ÁNH XẠ THÔNG SỐ E-RA (NHÀ KÍNH THÔNG MINH)

| STT | Đối tượng | Tên hiển thị | Config ID | Action Key (Kích hoạt) | Virtual Pin |
|:---:|:---|:---|:---:|:---|:---:|
| 1 | Cảm biến | Nhiệt độ (°C) | `195920` | - | V7 |
| 2 | Cảm biến | Độ ẩm không khí (%) | `195921` | - | V8 |
| 3 | Cảm biến | Độ ẩm đất (%) | `195922` | - | V9 |
| 4 | Cảm biến | Điện áp PIN (V) | `195926` | - | V13 |
| 5 | Trạng thái | Hệ thống RFID/Cháy | `195913` | - | V0 |
| 6 | Điều khiển | Máy Bơm Nước | `195914` | `afc0d726-f8af-4eb9-9d89-04fd69c7862f` | V1 |
| 7 | Điều khiển | Quạt Thông Gió | `195915` | `a9acf7af-72ca-4b7d-a2df-0f6768633f64` | V2 |
| 8 | Điều khiển | Đèn Chiếu Sáng | `195925` | `533dd38f-393c-4db4-912b-ba03924d94b5` | V12 |
| 9 | Điều khiển | Chế độ Auto | `195916` | `d05e5d11-fb1b-44d3-be97-289f3cfd9528` | V3 |
| 10 | Cài đặt | Ngưỡng độ ẩm đất | `195917` | `2582dddc-82d9-44a3-879c-9a36b9e3f63f` | V4 |

---

## 🚀 5. HƯỚNG DẪN CÀI ĐẶT & CHẠY ỨNG DỤNG

### Bước 1: Mở Terminal tại thư mục dự án
```powershell
cd d:\DAKHKT2
```

### Bước 2: Cài đặt các thư viện phụ thuộc
```bash
pip install -r requirements.txt
```

### Bước 3: Khởi chạy ứng dụng Web Dashboard
```bash
python app.py
```

### Bước 4: Mở trình duyệt và sử dụng
Truy cập vào địa chỉ:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)** hoặc **[http://localhost:5000](http://localhost:5000)**

---

## 🤖 6. CÁCH SỬ DỤNG CHỨC NĂNG BÁC SĨ CÂY TRỒNG AI

1. Cuộn đến khu vực **"Chẩn Đoán Sức Khỏe Cây Trồng Bằng AI (Gemini Vision API)"**.
2. **Cách 1 (Chụp từ Camera/Webcam):**
   - Bấm nút **"Bật Camera"** (trình duyệt sẽ hỏi quyền truy cập máy ảnh -> chọn Cho phép/Allow).
   - Đưa lá cây vào giữa khung hình, bấm nút **"Chụp ảnh lá"**.
   - Có thể bấm nút đổi camera nếu dùng trên điện thoại có 2 camera.
3. **Cách 2 (Tải ảnh từ máy):**
   - Chuyển sang thẻ **"Tải ảnh"**.
   - Bấm vào khung để chọn file ảnh lá cây (`JPG`, `PNG`, `WEBP`) từ thư viện máy.
4. Bấm nút gradient **"Phân Tích Tình Trạng Cây Bằng AI"**:
   - Hệ thống tự động thu thập số đo Nhiệt độ, Độ ẩm không khí, Độ ẩm đất thực tế từ E-Ra.
   - Gửi sang mô hình Gemini Vision.
   - Sau vài giây, kết quả chẩn đoán bệnh học, tình trạng môi trường và khuyến nghị bật/tắt thiết bị sẽ hiển thị đầy đủ trên màn hình.
   - Bạn có thể bấm trực tiếp các nút **"Bật Máy Bơm"**, **"Bật Quạt"** ngay trong thẻ chẩn đoán để xử lý tức thời!

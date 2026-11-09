/**
 * E-Ra IoT Web Dashboard - Real-time Monitoring & Control
 * Giao thức: REST API Polling (Fetch API)
 */

// Trạng thái ứng dụng
const AppState = {
    pollingInterval: 3000,      // 3 giây theo yêu cầu
    pollingTimer: null,
    countdownTimer: null,
    countdownSeconds: 3,
    isPollingActive: true,
    isOnline: false,
    isRequestPending: false,
    chart: null,
    theme: localStorage.getItem('era_theme') || 'dark',
    activeControls: {},
    audioAlertPlayed: false,
    cameraStream: null,
    selectedImageBase64: null,
    facingMode: 'environment'   // Ưu tiên camera sau khi chụp lá cây trên điện thoại
};

// Khởi chạy khi tài liệu tải xong
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initChart();
    initEventListeners();
    initPlantDoctor();
    
    // Gọi lần đầu tiên ngay lập tức
    fetchDashboardData();
    
    // Khởi động chu kỳ polling
    startPolling();
});

/* ==========================================================================
   1. CẤU HÌNH GIAO DIỆN DARK / LIGHT MODE
   ========================================================================== */
function initTheme() {
    const htmlEl = document.documentElement;
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');

    if (AppState.theme === 'dark') {
        htmlEl.classList.add('dark');
        if (themeIcon) themeIcon.className = 'fa-solid fa-sun text-amber-400';
        if (themeText) themeText.textContent = 'Giao diện Sáng';
    } else {
        htmlEl.classList.remove('dark');
        if (themeIcon) themeIcon.className = 'fa-solid fa-moon text-slate-600';
        if (themeText) themeText.textContent = 'Giao diện Tối';
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = htmlEl.classList.toggle('dark');
            AppState.theme = isDark ? 'dark' : 'light';
            localStorage.setItem('era_theme', AppState.theme);

            if (themeIcon) {
                themeIcon.className = isDark 
                    ? 'fa-solid fa-sun text-amber-400' 
                    : 'fa-solid fa-moon text-slate-600';
            }
            if (themeText) {
                themeText.textContent = isDark ? 'Giao diện Sáng' : 'Giao diện Tối';
            }

            // Cập nhật lại màu trục của biểu đồ cho phù hợp theme
            updateChartTheme();
        });
    }
}

/* ==========================================================================
   2. KHỞI TẠO BIỂU ĐỒ REALTIME (CHART.JS)
   ========================================================================== */
function initChart() {
    const canvas = document.getElementById('sensorChart');
    if (!canvas) return;

    const isDark = AppState.theme === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const ctx = canvas.getContext('2d');
    AppState.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Nhiệt độ (°C)',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2.5,
                    tension: 0.35,
                    fill: false,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    yAxisID: 'y_temp'
                },
                {
                    label: 'Độ ẩm không khí (%)',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2.5,
                    tension: 0.35,
                    fill: false,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    yAxisID: 'y_humid'
                },
                {
                    label: 'Độ ẩm đất (%)',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2.5,
                    tension: 0.35,
                    fill: false,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    yAxisID: 'y_humid'
                },
                {
                    label: 'Điện áp PIN (V)',
                    data: [],
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    borderDash: [4, 4],
                    tension: 0.3,
                    fill: false,
                    pointRadius: 2.5,
                    yAxisID: 'y_battery'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: textColor,
                        usePointStyle: true,
                        font: { family: 'Inter, system-ui, sans-serif', size: 12, weight: '500' }
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    titleColor: isDark ? '#f8fafc' : '#0f172a',
                    bodyColor: isDark ? '#cbd5e1' : '#334155',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    borderWidth: 1,
                    padding: 10,
                    boxPadding: 4
                }
            },
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { size: 11 } }
                },
                y_temp: {
                    type: 'linear',
                    position: 'left',
                    min: 0,
                    max: 60,
                    title: { display: true, text: 'Nhiệt độ (°C)', color: '#ef4444' },
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                y_humid: {
                    type: 'linear',
                    position: 'right',
                    min: 0,
                    max: 100,
                    title: { display: true, text: 'Độ ẩm (%)', color: '#10b981' },
                    grid: { drawOnChartArea: false },
                    ticks: { color: textColor }
                },
                y_battery: {
                    type: 'linear',
                    position: 'right',
                    min: 2.5,
                    max: 5.0,
                    display: false,
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

function updateChartTheme() {
    if (!AppState.chart) return;
    const isDark = AppState.theme === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    AppState.chart.options.scales.x.grid.color = gridColor;
    AppState.chart.options.scales.x.ticks.color = textColor;
    AppState.chart.options.scales.y_temp.grid.color = gridColor;
    AppState.chart.options.scales.y_temp.ticks.color = textColor;
    AppState.chart.options.scales.y_humid.ticks.color = textColor;
    AppState.chart.options.plugins.legend.labels.color = textColor;
    AppState.chart.update('none');
}

/* ==========================================================================
   3. POLLING ĐỊNH KỲ MỖI 3 GIÂY (FETCH API)
   ========================================================================== */
function startPolling() {
    if (AppState.pollingTimer) clearInterval(AppState.pollingTimer);
    if (AppState.countdownTimer) clearInterval(AppState.countdownTimer);

    AppState.countdownSeconds = Math.round(AppState.pollingInterval / 1000);
    updateCountdownUI();

    // Đồng hồ đếm ngược mỗi 1s trên UI
    AppState.countdownTimer = setInterval(() => {
        if (!AppState.isPollingActive) return;
        AppState.countdownSeconds -= 1;
        if (AppState.countdownSeconds <= 0) {
            AppState.countdownSeconds = Math.round(AppState.pollingInterval / 1000);
        }
        updateCountdownUI();
    }, 1000);

    // Chu kỳ Fetch chính mỗi 3-5s
    AppState.pollingTimer = setInterval(() => {
        if (AppState.isPollingActive) {
            fetchDashboardData();
        }
    }, AppState.pollingInterval);
}

function updateCountdownUI() {
    const countdownEl = document.getElementById('pollingCountdown');
    if (countdownEl) {
        countdownEl.textContent = `${AppState.countdownSeconds}s`;
    }
}

async function fetchDashboardData(isManual = false) {
    if (AppState.isRequestPending && !isManual) return;
    AppState.isRequestPending = true;

    const refreshBtn = document.getElementById('refreshBtn');
    if (isManual && refreshBtn) {
        refreshBtn.classList.add('animate-spin');
    }

    try {
        const response = await fetch('/api/dashboard');
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP error ${response.status}`);
        }

        const data = await response.json();
        
        // Cập nhật trạng thái kết nối
        setConnectionStatus(data.is_online, data.timestamp);

        // Cập nhật các Widget Cảm biến
        updateSensorWidgets(data.sensors || {});

        // Cập nhật các Switch Điều khiển
        updateControlSwitches(data.controls || {});

        // Cập nhật Biểu đồ Chart.js
        if (data.history && AppState.chart) {
            updateChartData(data.history);
        }

        // Cập nhật Activity Log
        if (data.activity_logs) {
            updateActivityLogs(data.activity_logs);
        }

        // Ẩn cảnh báo lỗi nếu trước đó có lỗi
        hideErrorBanner();

    } catch (error) {
        console.error('Lỗi khi fetch dữ liệu E-Ra:', error);
        setConnectionStatus(false);
        showErrorBanner(error.message || 'Không thể lấy dữ liệu từ máy chủ E-Ra.');
    } finally {
        AppState.isRequestPending = false;
        if (isManual && refreshBtn) {
            setTimeout(() => refreshBtn.classList.remove('animate-spin'), 400);
        }
    }
}

/* ==========================================================================
   4. CẬP NHẬT GIAO DIỆN CẢM BIẾN & THIẾT BỊ
   ========================================================================== */
function setConnectionStatus(isOnline, timestamp) {
    AppState.isOnline = isOnline;
    const badge = document.getElementById('connectionBadge');
    const dot = document.getElementById('connectionDot');
    const text = document.getElementById('connectionText');
    const syncTime = document.getElementById('lastSyncTime');

    if (badge && text && dot) {
        if (isOnline) {
            badge.className = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
            dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 online-radar';
            text.textContent = 'Trực tuyến (Online)';
        } else {
            badge.className = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30';
            dot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500 offline-radar';
            text.textContent = 'Mất kết nối (Offline)';
        }
    }

    if (syncTime && timestamp) {
        syncTime.textContent = timestamp;
    }
}

function updateSensorWidgets(sensors) {
    // 1. Nhiệt độ
    if (sensors.temperature) {
        const val = sensors.temperature.value;
        const tempEl = document.getElementById('tempValue');
        const tempBar = document.getElementById('tempBar');
        const tempTag = document.getElementById('tempTag');
        if (tempEl) tempEl.textContent = val !== null ? val : '--';
        if (tempBar && val !== null) {
            const pct = Math.min(Math.max((val / 60) * 100, 0), 100);
            tempBar.style.width = `${pct}%`;
        }
        if (tempTag && val !== null) {
            if (val > 35) {
                tempTag.textContent = 'Nhiệt độ cao';
                tempTag.className = 'text-xs font-medium px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400';
            } else if (val < 18) {
                tempTag.textContent = 'Nhiệt độ thấp';
                tempTag.className = 'text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400';
            } else {
                tempTag.textContent = 'Lý tưởng (18-35°C)';
                tempTag.className = 'text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
            }
        }
    }

    // 2. Độ ẩm không khí
    if (sensors.humidity_air) {
        const val = sensors.humidity_air.value;
        const humidEl = document.getElementById('humidAirValue');
        const humidBar = document.getElementById('humidAirBar');
        const humidTag = document.getElementById('humidAirTag');
        if (humidEl) humidEl.textContent = val !== null ? val : '--';
        if (humidBar && val !== null) {
            humidBar.style.width = `${Math.min(val, 100)}%`;
        }
        if (humidTag && val !== null) {
            if (val > 85) {
                humidTag.textContent = 'Độ ẩm rất cao';
                humidTag.className = 'text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400';
            } else if (val < 40) {
                humidTag.textContent = 'Độ ẩm thấp';
                humidTag.className = 'text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400';
            } else {
                humidTag.textContent = 'Độ ẩm tối ưu';
                humidTag.className = 'text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
            }
        }
    }

    // 3. Độ ẩm đất
    if (sensors.humidity_soil) {
        const val = sensors.humidity_soil.value;
        const soilEl = document.getElementById('humidSoilValue');
        const soilBar = document.getElementById('humidSoilBar');
        const soilTag = document.getElementById('humidSoilTag');
        if (soilEl) soilEl.textContent = val !== null ? val : '--';
        if (soilBar && val !== null) {
            soilBar.style.width = `${Math.min(val, 100)}%`;
        }
        if (soilTag && val !== null) {
            if (val < 30) {
                soilTag.textContent = 'Đất khô - Cần tưới';
                soilTag.className = 'text-xs font-medium px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400';
            } else if (val > 80) {
                soilTag.textContent = 'Đất úng nước';
                soilTag.className = 'text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400';
            } else {
                soilTag.textContent = 'Độ ẩm đất tốt';
                soilTag.className = 'text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
            }
        }
    }

    // 4. Điện áp PIN
    if (sensors.battery) {
        const val = sensors.battery.value;
        const batEl = document.getElementById('batteryValue');
        const batBar = document.getElementById('batteryBar');
        const batTag = document.getElementById('batteryTag');
        if (batEl) batEl.textContent = val !== null ? val : '--';
        if (batBar && val !== null) {
            // Giả định PIN Li-ion từ 3.2V (0%) đến 4.2V (100%)
            const pct = Math.min(Math.max(((val - 3.2) / (4.2 - 3.2)) * 100, 5), 100);
            batBar.style.width = `${pct}%`;
        }
        if (batTag && val !== null) {
            if (val < 3.4) {
                batTag.textContent = 'PIN yếu';
                batTag.className = 'text-xs font-medium px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400';
            } else {
                batTag.textContent = 'PIN ổn định';
                batTag.className = 'text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
            }
        }
    }

    // 5. Trạng thái an ninh & cảnh báo hệ thống
    if (sensors.status) {
        const stateVal = sensors.status.value;
        const statusTextEl = document.getElementById('statusText');
        const statusBadgeEl = document.getElementById('statusBadge');
        const statusCard = document.getElementById('statusCard');

        if (statusTextEl && sensors.status.state_text) {
            statusTextEl.textContent = sensors.status.state_text;
        }

        if (statusBadgeEl && sensors.status.state_color) {
            statusBadgeEl.className = `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${sensors.status.state_badge} text-white shadow-sm`;
        }

        // Nếu trạng thái là Báo lửa (code 2), kích hoạt hiệu ứng nhấp nháy cảnh báo
        if (statusCard) {
            if (stateVal === 2) {
                statusCard.classList.add('fire-alert-active', 'border-rose-500');
            } else {
                statusCard.classList.remove('fire-alert-active', 'border-rose-500');
            }
        }
    }
}

function updateControlSwitches(controls) {
    const devices = ['pump', 'fan', 'light', 'auto'];

    devices.forEach(devKey => {
        const ctrl = controls[devKey];
        if (!ctrl) return;

        // Lưu thông tin action key
        AppState.activeControls[devKey] = ctrl.key;

        const checkbox = document.getElementById(`switch_${devKey}`);
        const badge = document.getElementById(`badge_${devKey}`);
        const textState = document.getElementById(`text_${devKey}`);

        // Chỉ cập nhật trạng thái nếu người dùng không đang trực tiếp bấm switch đó
        const container = checkbox ? checkbox.closest('.switch-container') : null;
        if (container && container.classList.contains('switch-loading')) {
            return;
        }

        if (checkbox && ctrl.is_active !== null) {
            checkbox.checked = ctrl.is_active;
        }

        if (badge && textState && ctrl.is_active !== null) {
            if (ctrl.is_active) {
                badge.className = 'inline-block w-2.5 h-2.5 rounded-full bg-emerald-500';
                textState.textContent = 'ĐANG BẬT';
                textState.className = 'text-xs font-bold text-emerald-600 dark:text-emerald-400';
            } else {
                badge.className = 'inline-block w-2.5 h-2.5 rounded-full bg-slate-400';
                textState.textContent = 'ĐÃ TẮT';
                textState.className = 'text-xs font-medium text-slate-500 dark:text-slate-400';
            }
        }
    });

    // Cập nhật giá trị Slider Ngưỡng độ ẩm đất
    const soilCtrl = controls.soil_threshold;
    if (soilCtrl) {
        AppState.activeControls['soil_threshold'] = soilCtrl.key;
        const slider = document.getElementById('soilThresholdSlider');
        const display = document.getElementById('soilThresholdVal');
        
        // Không cập nhật nếu người dùng đang kéo slider
        if (slider && !slider.dataset.dragging && soilCtrl.value !== undefined) {
            slider.value = soilCtrl.value;
            if (display) display.textContent = `${soilCtrl.value}%`;
        }
    }
}

function updateChartData(history) {
    if (!AppState.chart) return;

    AppState.chart.data.labels = history.timestamps || [];
    AppState.chart.data.datasets[0].data = history.temperature || [];
    AppState.chart.data.datasets[1].data = history.humidity_air || [];
    AppState.chart.data.datasets[2].data = history.humidity_soil || [];
    AppState.chart.data.datasets[3].data = history.battery || [];

    AppState.chart.update('none'); // Cập nhật mượt mà không giật
}

function updateActivityLogs(logs) {
    const listEl = document.getElementById('activityLogList');
    if (!listEl) return;

    if (!logs || logs.length === 0) {
        listEl.innerHTML = '<li class="text-xs text-slate-400 text-center py-4">Chưa có bản ghi hoạt động nào.</li>';
        return;
    }

    listEl.innerHTML = logs.map(item => {
        let dotColor = 'bg-blue-500';
        let badgeStyle = 'text-blue-600 dark:text-blue-400 bg-blue-500/10';
        if (item.status === 'success') {
            dotColor = 'bg-emerald-500';
            badgeStyle = 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10';
        } else if (item.status === 'danger') {
            dotColor = 'bg-rose-500';
            badgeStyle = 'text-rose-600 dark:text-rose-400 bg-rose-500/10';
        }

        return `
            <li class="flex items-start gap-3 py-2 text-xs border-b border-slate-100 dark:border-slate-800 last:border-0">
                <span class="w-2 h-2 rounded-full ${dotColor} mt-1.5 flex-shrink-0"></span>
                <div class="flex-1">
                    <div class="flex items-center justify-between gap-2 mb-0.5">
                        <span class="font-semibold px-1.5 py-0.5 rounded text-[10px] ${badgeStyle}">${item.source}</span>
                        <span class="text-[11px] text-slate-400">${item.time}</span>
                    </div>
                    <p class="text-slate-700 dark:text-slate-300">${item.message}</p>
                </div>
            </li>
        `;
    }).join('');
}

/* ==========================================================================
   5. XỬ LÝ LỆNH ĐIỀU KHIỂN THIẾT BỊ (POST /chip_manager/trigger_action/)
   ========================================================================== */
async function sendDeviceControl(deviceName, targetValue) {
    const checkbox = document.getElementById(`switch_${deviceName}`);
    const container = checkbox ? checkbox.closest('.switch-container') : null;

    if (container) {
        container.classList.add('switch-loading');
    }

    const payload = {
        device: deviceName,
        value: targetValue,
        source: 'internet'
    };

    try {
        const response = await fetch('/api/control', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const resData = await response.json();

        if (response.ok && resData.success) {
            showToast(`Thành công: ${resData.message}`, 'success');
            // Cập nhật lại UI ngay
            if (checkbox) checkbox.checked = (targetValue === 1);
            
            // Trigger fetch cập nhật ngay sau 500ms
            setTimeout(() => fetchDashboardData(true), 600);
        } else {
            showToast(`Lỗi: ${resData.error || 'Không thể điều khiển thiết bị'}`, 'danger');
            // Rollback lại switch cũ
            if (checkbox) checkbox.checked = !checkbox.checked;
        }

    } catch (error) {
        console.error('Lỗi khi gửi lệnh điều khiển:', error);
        showToast(`Lỗi kết nối mạng: ${error.message}`, 'danger');
        if (checkbox) checkbox.checked = !checkbox.checked;
    } finally {
        if (container) {
            container.classList.remove('switch-loading');
        }
    }
}

// Xử lý gửi cài đặt Slider ngưỡng độ ẩm
async function saveSoilThreshold() {
    const slider = document.getElementById('soilThresholdSlider');
    const saveBtn = document.getElementById('saveSoilThresholdBtn');
    if (!slider) return;

    const val = parseInt(slider.value, 10);
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Đang lưu...';
    }

    try {
        const response = await fetch('/api/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                device: 'soil_threshold',
                value: val,
                source: 'internet'
            })
        });

        const data = await response.json();
        if (response.ok && data.success) {
            showToast(`Đã cài đặt ngưỡng độ ẩm tự động thành: ${val}%`, 'success');
            setTimeout(() => fetchDashboardData(true), 600);
        } else {
            showToast(`Lỗi: ${data.error || 'Không thể lưu cài đặt'}`, 'danger');
        }
    } catch (err) {
        showToast(`Lỗi kết nối: ${err.message}`, 'danger');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Lưu cài đặt';
        }
    }
}

/* ==========================================================================
   6. BẮT SỰ KIỆN GIAO DIỆN & TƯƠNG TÁC NGƯỜI DÙNG
   ========================================================================== */
function initEventListeners() {
    // 1. Nút làm mới thủ công
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            fetchDashboardData(true);
            AppState.countdownSeconds = Math.round(AppState.pollingInterval / 1000);
            updateCountdownUI();
        });
    }

    // 2. Nút tạm dừng / tiếp tục polling
    const togglePollingBtn = document.getElementById('togglePollingBtn');
    if (togglePollingBtn) {
        togglePollingBtn.addEventListener('click', () => {
            AppState.isPollingActive = !AppState.isPollingActive;
            const icon = togglePollingBtn.querySelector('i');
            const label = document.getElementById('pollingStatusLabel');
            if (AppState.isPollingActive) {
                if (icon) icon.className = 'fa-solid fa-pause';
                if (label) label.textContent = 'Đang tự cập nhật';
                togglePollingBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20';
                fetchDashboardData(true);
            } else {
                if (icon) icon.className = 'fa-solid fa-play';
                if (label) label.textContent = 'Đã tạm dừng';
                togglePollingBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/30 hover:bg-slate-500/20';
            }
        });
    }

    // 3. Switch Bơm (Pump)
    const switchPump = document.getElementById('switch_pump');
    if (switchPump) {
        switchPump.addEventListener('change', (e) => {
            sendDeviceControl('pump', e.target.checked ? 1 : 0);
        });
    }

    // 4. Switch Quạt (Fan)
    const switchFan = document.getElementById('switch_fan');
    if (switchFan) {
        switchFan.addEventListener('change', (e) => {
            sendDeviceControl('fan', e.target.checked ? 1 : 0);
        });
    }

    // 5. Switch Đèn (Light)
    const switchLight = document.getElementById('switch_light');
    if (switchLight) {
        switchLight.addEventListener('change', (e) => {
            sendDeviceControl('light', e.target.checked ? 1 : 0);
        });
    }

    // 6. Switch Chế độ Auto
    const switchAuto = document.getElementById('switch_auto');
    if (switchAuto) {
        switchAuto.addEventListener('change', (e) => {
            sendDeviceControl('auto', e.target.checked ? 1 : 0);
        });
    }

    // 7. Slider Ngưỡng độ ẩm đất
    const soilSlider = document.getElementById('soilThresholdSlider');
    const soilDisplay = document.getElementById('soilThresholdVal');
    const saveSoilBtn = document.getElementById('saveSoilThresholdBtn');

    if (soilSlider) {
        soilSlider.addEventListener('mousedown', () => soilSlider.dataset.dragging = 'true');
        soilSlider.addEventListener('touchstart', () => soilSlider.dataset.dragging = 'true');
        soilSlider.addEventListener('mouseup', () => delete soilSlider.dataset.dragging);
        soilSlider.addEventListener('touchend', () => delete soilSlider.dataset.dragging);

        soilSlider.addEventListener('input', (e) => {
            if (soilDisplay) soilDisplay.textContent = `${e.target.value}%`;
        });
    }

    if (saveSoilBtn) {
        saveSoilBtn.addEventListener('click', saveSoilThreshold);
    }
}

/* ==========================================================================
   7. THÔNG BÁO VÀ BANNER CẢNH BÁO LỖI
   ========================================================================== */
function showErrorBanner(message) {
    const banner = document.getElementById('errorBanner');
    const msgEl = document.getElementById('errorMessageText');
    if (banner && msgEl) {
        msgEl.textContent = message;
        banner.classList.remove('hidden');
    }
}

function hideErrorBanner() {
    const banner = document.getElementById('errorBanner');
    if (banner) {
        banner.classList.add('hidden');
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const id = 'toast_' + Date.now();
    toast.id = id;

    let icon = 'fa-info-circle text-blue-500';
    let border = 'border-blue-500/30';
    if (type === 'success') {
        icon = 'fa-check-circle text-emerald-500';
        border = 'border-emerald-500/30';
    } else if (type === 'danger') {
        icon = 'fa-exclamation-triangle text-rose-500';
        border = 'border-rose-500/30';
    }

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl glass-panel border ${border} text-slate-800 dark:text-slate-100 text-sm transform transition-all duration-300 translate-y-4 opacity-0`;
    toast.innerHTML = `
        <i class="fa-solid ${icon} text-lg"></i>
        <span class="flex-1 font-medium">${message}</span>
        <button class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" onclick="this.parentElement.remove()">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    container.appendChild(toast);

    // Hiệu ứng trượt vào
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-4', 'opacity-0');
    });

    // Tự động đóng sau 4 giây
    setTimeout(() => {
        toast.classList.add('translate-y-4', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}


/* ==========================================================================
   8. CHẨN ĐOÁN SỨC KHỎE CÂY TRỒNG BẰNG AI (GEMINI VISION) & WEBCAM
   ========================================================================== */
function initPlantDoctor() {
    // Các phần tử giao diện
    const tabCameraBtn = document.getElementById('tabCameraBtn');
    const tabUploadBtn = document.getElementById('tabUploadBtn');
    const cameraSection = document.getElementById('cameraSection');
    const uploadSection = document.getElementById('uploadSection');
    const previewContainer = document.getElementById('previewContainer');
    const leafPreviewImg = document.getElementById('leafPreviewImg');
    const photoFileInfo = document.getElementById('photoFileInfo');
    const retakePhotoBtn = document.getElementById('retakePhotoBtn');

    // Các nút điều khiển camera
    const startCameraBtn = document.getElementById('startCameraBtn');
    const capturePhotoBtn = document.getElementById('capturePhotoBtn');
    const switchCameraBtn = document.getElementById('switchCameraBtn');
    const stopCameraBtn = document.getElementById('stopCameraBtn');
    const cameraVideo = document.getElementById('cameraVideo');
    const cameraPlaceholder = document.getElementById('cameraPlaceholder');
    const cameraControlsOverlay = document.getElementById('cameraControlsOverlay');
    const cameraScannerBeam = document.getElementById('cameraScannerBeam');
    const shutterFlash = document.getElementById('shutterFlash');
    const photoCanvas = document.getElementById('photoCanvas');

    // Tải tệp tin
    const dropZone = document.getElementById('dropZone');
    const leafFileInput = document.getElementById('leafFileInput');

    // Nút phân tích AI
    const analyzePlantBtn = document.getElementById('analyzePlantBtn');
    const analyzeBtnText = document.getElementById('analyzeBtnText');

    // Các trạng thái kết quả AI
    const aiInitialState = document.getElementById('aiInitialState');
    const aiLoadingState = document.getElementById('aiLoadingState');
    const aiResultState = document.getElementById('aiResultState');

    // 1. Chuyển đổi Tab (Webcam vs Tải ảnh)
    if (tabCameraBtn && tabUploadBtn) {
        tabCameraBtn.addEventListener('click', () => {
            tabCameraBtn.className = 'px-3 py-1 rounded-lg font-semibold bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm transition';
            tabUploadBtn.className = 'px-3 py-1 rounded-lg font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition';
            cameraSection.classList.remove('hidden');
            uploadSection.classList.add('hidden');
            previewContainer.classList.add('hidden');
        });

        tabUploadBtn.addEventListener('click', () => {
            tabUploadBtn.className = 'px-3 py-1 rounded-lg font-semibold bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm transition';
            tabCameraBtn.className = 'px-3 py-1 rounded-lg font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition';
            uploadSection.classList.remove('hidden');
            cameraSection.classList.add('hidden');
            stopCameraStream();
            previewContainer.classList.add('hidden');
        });
    }

    // 2. Bật Camera / Webcam (navigator.mediaDevices.getUserMedia)
    async function startCamera() {
        try {
            stopCameraStream(); // Dừng stream cũ nếu có

            const constraints = {
                video: {
                    facingMode: { ideal: AppState.facingMode },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            AppState.cameraStream = stream;
            cameraVideo.srcObject = stream;
            await cameraVideo.play();

            // Hiển thị giao diện Camera đang chạy
            cameraVideo.classList.remove('hidden');
            cameraControlsOverlay.classList.remove('hidden');
            cameraScannerBeam.classList.remove('hidden');
            cameraPlaceholder.classList.add('hidden');
            previewContainer.classList.add('hidden');

            showToast('Đã mở Camera thành công. Hướng ống kính vào lá cây và bấm Chụp.', 'info');
        } catch (err) {
            console.error('Lỗi khi truy cập Camera:', err);
            let msg = 'Không thể mở Camera. Vui lòng cấp quyền truy cập máy ảnh cho trình duyệt.';
            if (err.name === 'NotAllowedError') {
                msg = 'Quyền sử dụng máy ảnh bị từ chối. Vui lòng cho phép Camera trong cài đặt trình duyệt.';
            } else if (err.name === 'NotFoundError') {
                msg = 'Không tìm thấy thiết bị Camera nào trên máy của bạn.';
            }
            showToast(msg, 'danger');
        }
    }

    function stopCameraStream() {
        if (AppState.cameraStream) {
            AppState.cameraStream.getTracks().forEach(track => track.stop());
            AppState.cameraStream = null;
        }
        if (cameraVideo) {
            cameraVideo.srcObject = null;
            cameraVideo.classList.add('hidden');
        }
        if (cameraControlsOverlay) cameraControlsOverlay.classList.add('hidden');
        if (cameraScannerBeam) cameraScannerBeam.classList.add('hidden');
        if (cameraPlaceholder) cameraPlaceholder.classList.remove('hidden');
    }

    if (startCameraBtn) startCameraBtn.addEventListener('click', startCamera);
    if (stopCameraBtn) stopCameraBtn.addEventListener('click', stopCameraStream);

    // 3. Đổi Camera Trước / Sau (lật camera trên điện thoại di động)
    if (switchCameraBtn) {
        switchCameraBtn.addEventListener('click', () => {
            AppState.facingMode = (AppState.facingMode === 'environment') ? 'user' : 'environment';
            startCamera();
        });
    }

    // 4. Chụp Ảnh từ luồng Video Stream
    if (capturePhotoBtn) {
        capturePhotoBtn.addEventListener('click', () => {
            if (!AppState.cameraStream || !cameraVideo.videoWidth) {
                showToast('Camera chưa sẵn sàng để chụp.', 'danger');
                return;
            }

            // Hiệu ứng chớp sáng Shutter Flash
            if (shutterFlash) {
                shutterFlash.classList.add('shutter-effect');
                setTimeout(() => shutterFlash.classList.remove('shutter-effect'), 350);
            }

            // Ghi frame lên Canvas
            photoCanvas.width = cameraVideo.videoWidth;
            photoCanvas.height = cameraVideo.videoHeight;
            const ctx = photoCanvas.getContext('2d');
            ctx.drawImage(cameraVideo, 0, 0, photoCanvas.width, photoCanvas.height);

            // Xuất ra chuỗi JPEG Base64
            const dataUrl = photoCanvas.toDataURL('image/jpeg', 0.88);
            setCapturedImage(dataUrl, `Ảnh chụp từ Camera (${photoCanvas.width}x${photoCanvas.height})`);

            // Tắt stream camera để tiết kiệm pin & tài nguyên
            stopCameraStream();
        });
    }

    // 5. Tải ảnh từ thiết bị (File Input & Drag & Drop)
    if (dropZone && leafFileInput) {
        dropZone.addEventListener('click', () => leafFileInput.click());

        leafFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleSelectedFile(file);
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-emerald-500', 'bg-emerald-500/10');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('border-emerald-500', 'bg-emerald-500/10');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-emerald-500', 'bg-emerald-500/10');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                handleSelectedFile(file);
            } else {
                showToast('Vui lòng chọn một tệp hình ảnh hợp lệ (JPG, PNG, WEBP).', 'danger');
            }
        });
    }

    function handleSelectedFile(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            const sizeKb = Math.round(file.size / 1024);
            setCapturedImage(dataUrl, `${file.name} (~${sizeKb} KB)`);
        };
        reader.readAsDataURL(file);
    }

    function setCapturedImage(dataUrl, infoText) {
        AppState.selectedImageBase64 = dataUrl;

        // Hiển thị khung xem trước ảnh
        if (leafPreviewImg) leafPreviewImg.src = dataUrl;
        if (photoFileInfo) photoFileInfo.textContent = infoText;
        if (previewContainer) previewContainer.classList.remove('hidden');

        // Kích hoạt nút phân tích AI
        if (analyzePlantBtn && analyzeBtnText) {
            analyzePlantBtn.disabled = false;
            analyzePlantBtn.className = 'w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 shadow-md shadow-emerald-500/20 cursor-pointer transition flex items-center justify-center gap-2 transform active:scale-[0.99]';
            analyzeBtnText.textContent = 'Phân Tích Tình Trạng Cây Bằng AI (Gemini Vision)';
        }

        showToast('Đã chọn hình ảnh lá cây. Hãy bấm nút Phân tích để tiếp tục.', 'success');
    }

    // 6. Nút Chụp lại / Đổi ảnh khác
    if (retakePhotoBtn) {
        retakePhotoBtn.addEventListener('click', () => {
            AppState.selectedImageBase64 = null;
            if (previewContainer) previewContainer.classList.add('hidden');
            if (leafPreviewImg) leafPreviewImg.src = '';
            if (leafFileInput) leafFileInput.value = '';

            // Vô hiệu hóa lại nút phân tích
            if (analyzePlantBtn && analyzeBtnText) {
                analyzePlantBtn.disabled = true;
                analyzePlantBtn.className = 'w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-slate-300 dark:bg-slate-800 cursor-not-allowed transition flex items-center justify-center gap-2 shadow-sm';
                analyzeBtnText.textContent = 'Chụp hoặc chọn ảnh lá để bắt đầu';
            }

            // Nếu đang ở tab Camera thì mở lại camera
            if (!cameraSection.classList.contains('hidden')) {
                startCamera();
            }
        });
    }

    // 7. GỬI YÊU CẦU PHÂN TÍCH AI (POST /api/analyze-plant)
    if (analyzePlantBtn) {
        analyzePlantBtn.addEventListener('click', async () => {
            if (!AppState.selectedImageBase64) {
                showToast('Vui lòng chụp ảnh hoặc tải ảnh lá cây trước khi phân tích.', 'danger');
                return;
            }

            // Chuyển UI sang trạng thái Đang Phân Tích (Loading State)
            analyzePlantBtn.disabled = true;
            analyzePlantBtn.className = 'w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-slate-400 dark:bg-slate-700 cursor-wait transition flex items-center justify-center gap-2';
            analyzeBtnText.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Chuyên gia AI đang phân tích...';

            if (aiInitialState) aiInitialState.classList.add('hidden');
            if (aiResultState) aiResultState.classList.add('hidden');
            if (aiLoadingState) aiLoadingState.classList.remove('hidden');

            try {
                const response = await fetch('/api/analyze-plant', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image: AppState.selectedImageBase64
                    })
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.error || `HTTP ${response.status}: Lỗi máy chủ phân tích.`);
                }

                // Render kết quả phân tích AI lên giao diện
                renderAiDiagnosisResult(data);
                showToast('Chẩn đoán hoàn tất! Đã tổng hợp kết quả bệnh học và thông số E-Ra.', 'success');

            } catch (error) {
                console.error('Lỗi khi phân tích cây trồng:', error);
                showToast(`Lỗi phân tích: ${error.message}`, 'danger');
                if (aiLoadingState) aiLoadingState.classList.add('hidden');
                if (aiInitialState) aiInitialState.classList.remove('hidden');
            } finally {
                analyzePlantBtn.disabled = false;
                analyzePlantBtn.className = 'w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 shadow-md shadow-emerald-500/20 cursor-pointer transition flex items-center justify-center gap-2';
                analyzeBtnText.textContent = 'Phân Tích Lại Tình Trạng Cây';
            }
        });
    }

    // 8. RENDER KẾT QUẢ CHẨN ĐOÁN
    function renderAiDiagnosisResult(data) {
        if (aiLoadingState) aiLoadingState.classList.add('hidden');
        if (aiResultState) aiResultState.classList.remove('hidden');

        // Model badge
        const aiModelBadge = document.getElementById('aiModelBadge');
        if (aiModelBadge && data.model_used) {
            aiModelBadge.textContent = `Model: ${data.model_used}`;
            aiModelBadge.classList.remove('hidden');
        }

        // Tình trạng sức khỏe & Điểm số
        const diagnosisBanner = document.getElementById('diagnosisBanner');
        const diagnosisBadge = document.getElementById('diagnosisBadge');
        const diagnosisScore = document.getElementById('diagnosisScore');
        const diseaseNameText = document.getElementById('diseaseNameText');
        const diagnosisIconWrap = document.getElementById('diagnosisIconWrap');
        const diagnosisIcon = document.getElementById('diagnosisIcon');

        const status = data.health_status || 'good';
        const score = data.health_score !== undefined ? data.health_score : 90;

        if (diagnosisScore) diagnosisScore.textContent = `Điểm: ${score}/100`;
        if (diseaseNameText) diseaseNameText.textContent = data.disease_name || 'Cây phát triển bình thường';

        if (status === 'good') {
            diagnosisBanner.className = 'p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3';
            diagnosisBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500 text-white';
            diagnosisBadge.textContent = 'KHỎE MẠNH';
            diagnosisIconWrap.className = 'w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl shadow-sm';
            diagnosisIcon.className = 'fa-solid fa-shield-heart';
        } else if (status === 'warning') {
            diagnosisBanner.className = 'p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3';
            diagnosisBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500 text-white';
            diagnosisBadge.textContent = 'CẦN CHÚ Ý THEO DÕI';
            diagnosisIconWrap.className = 'w-12 h-12 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl shadow-sm';
            diagnosisIcon.className = 'fa-solid fa-triangle-exclamation';
        } else {
            diagnosisBanner.className = 'p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3';
            diagnosisBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500 text-white';
            diagnosisBadge.textContent = 'CẢNH BÁO BỆNH HẠI';
            diagnosisIconWrap.className = 'w-12 h-12 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl shadow-sm';
            diagnosisIcon.className = 'fa-solid fa-bug';
        }

        // Snapshot cảm biến E-Ra tại thời điểm chẩn đoán
        const env = data.environment_snapshot || {};
        const snapTemp = document.getElementById('snapTemp');
        const snapHumidAir = document.getElementById('snapHumidAir');
        const snapSoil = document.getElementById('snapSoil');
        const analysisTimestamp = document.getElementById('analysisTimestamp');

        if (snapTemp) snapTemp.textContent = `${env.temperature || '--'}°C`;
        if (snapHumidAir) snapHumidAir.textContent = `${env.humidity_air || '--'}%`;
        if (snapSoil) snapSoil.textContent = `${env.humidity_soil || '--'}%`;
        if (analysisTimestamp) analysisTimestamp.textContent = `Thời gian chẩn đoán: ${env.timestamp || new Date().toLocaleTimeString()}`;

        // Nội dung 3 phân mục
        const diagnosisDetailText = document.getElementById('diagnosisDetailText');
        const envAssessmentText = document.getElementById('envAssessmentText');
        const recommendationsText = document.getElementById('recommendationsText');

        if (diagnosisDetailText) diagnosisDetailText.textContent = data.diagnosis || 'Không có mô tả chi tiết.';
        if (envAssessmentText) envAssessmentText.textContent = data.environment_assessment || 'Không có đánh giá môi trường.';
        if (recommendationsText) recommendationsText.textContent = data.recommendations || 'Không có khuyến nghị.';

        // Phím tắt điều khiển nhanh các thiết bị E-Ra
        const buttonsContainer = document.getElementById('suggestedButtonsContainer');
        const quickBox = document.getElementById('quickActuationsBox');

        if (buttonsContainer && quickBox) {
            buttonsContainer.innerHTML = '';
            const actions = data.suggested_actions || [];

            if (actions.length > 0) {
                quickBox.classList.remove('hidden');
                actions.forEach(act => {
                    const btn = document.createElement('button');
                    const isTurnOn = act.action === 1;
                    btn.className = `px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1.5 ${
                        isTurnOn 
                            ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                            : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`;
                    btn.innerHTML = `<i class="fa-solid ${isTurnOn ? 'fa-play' : 'fa-stop'} text-[10px]"></i> <span>${act.label}</span>`;
                    btn.title = act.reason || '';

                    btn.addEventListener('click', async () => {
                        btn.disabled = true;
                        btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin text-[10px]"></i> Đang gửi lệnh...`;
                        await sendDeviceControl(act.device, act.action);
                        btn.disabled = false;
                        btn.innerHTML = `<i class="fa-solid fa-check text-[10px]"></i> Đã gửi lệnh!`;
                    });

                    buttonsContainer.appendChild(btn);
                });
            } else {
                quickBox.classList.add('hidden');
            }
        }
    }
}

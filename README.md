# 🅿 ParkingOS — Hệ thống quản lý bãi đỗ xe thông minh

Web app quản lý bãi đỗ xe tích hợp AI (Gemini), mô phỏng IoT real-time và nhận diện biển số (LPR). Xây dựng bằng React 18 + Vite + TypeScript + Tailwind CSS.

---

## Tính năng nổi bật

| Module | Chức năng |
|--------|-----------|
| **Manager** | Quản lý slot, loại xe, bảng giá, báo cáo doanh thu |
| **Staff** | Check-in/out xe, quét QR, thu phí, xử lý ngoại lệ |
| **Driver** | Xem bản đồ slot, đặt chỗ trước, lịch sử, thanh toán kiosk |
| **Admin** | Quản lý tài khoản, phân quyền, audit log, cấu hình hệ thống |
| **AI (Gemini)** | Gợi ý slot tối ưu khi check-in, dự báo giờ cao điểm |
| **IoT Simulation** | Cảm biến slot cập nhật 5 giây, barrier animation, camera LPR |

---

## Yêu cầu hệ thống

- **Node.js** ≥ 18
- **npm** ≥ 9 (hoặc pnpm, yarn)
- Trình duyệt hiện đại (Chrome/Edge/Firefox) — cần HTTPS hoặc localhost để dùng camera

---

## Cài đặt nhanh

```bash
# 1. Clone hoặc tải source code
git clone <repo-url>
cd parking_system

# 2. Cài dependencies
npm install

# 3. Tạo file môi trường
cp .env.example .env

# 4. Điền Gemini API key vào .env (xem hướng dẫn bên dưới)

# 5. Chạy dev server
npm run dev
```

Mở trình duyệt tại `http://localhost:5173`

---

## Lấy Gemini API Key (miễn phí)

1. Truy cập [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Đăng nhập bằng tài khoản Google (không cần thẻ ngân hàng)
3. Nhấn **"Create API key"** → chọn project hoặc tạo mới
4. Copy key và dán vào `.env`:

```env
VITE_GEMINI_API_KEY=AIzaSy...your_key_here
```

5. Khởi động lại dev server (`Ctrl+C` rồi `npm run dev`)

**Free tier:** 15 request/phút · 1.000.000 token/ngày — đủ để demo và học tập.

> Nếu không có API key, hệ thống vẫn chạy bình thường — AI sẽ dùng fallback algorithm thay thế.

---

## Tài khoản demo

| Role | Username | Password |
|------|----------|----------|
| Manager | `manager` | `123456` |
| Staff | `staff` | `123456` |
| Driver | `driver` | `123456` |
| Admin | `admin` | `123456` |

---

## Cấu trúc dự án

```
src/
├── ai/                    # Gemini AI — gợi ý slot, dự báo giờ cao điểm
│   ├── geminiClient.ts    # SDK setup, isConfigured guard
│   ├── slotSuggestion.ts  # suggestOptimalSlot với fallback
│   └── predictPeakHours.ts
├── api/                   # Mock data (thay bằng API thật khi có backend)
├── components/
│   ├── iot/               # SlotGrid realtime, BarrierStatus animation
│   └── staff/             # QRScanner (html5-qrcode), LPRCamera, Receipt
├── hooks/                 # useSlotSimulation, useAlertSimulation, useSlotSuggestion
├── pages/
│   ├── admin/             # AdminUsers, AdminPermissions, AdminConfig, AdminAuditLog, AdminDevices
│   ├── driver/            # DriverHome, DriverBooking, DriverHistory, DriverPayment
│   ├── manager/           # SlotManagement, VehicleManagement, PricingManagement, Reports
│   └── staff/             # CheckIn (AI + barrier), CheckOut (QR + barrier), StaffDashboard
├── store/                 # Zustand stores: slot, session, payment, alert, config, iot
└── utils/                 # types.ts, feeCalculator.ts, cn.ts
```

---

## Scripts

```bash
npm run dev      # Dev server (http://localhost:5173)
npm run build    # Build production
npm run preview  # Preview build
npm run lint     # ESLint
```

---

## Stack công nghệ

| Thư viện | Phiên bản | Dùng cho |
|----------|-----------|----------|
| React | 18 | UI framework |
| Vite | 5 | Build tool & dev server |
| TypeScript | 6 | Type safety |
| Tailwind CSS | 3 | Styling |
| Zustand | 5 | State management (6 stores) |
| React Router | 7 | Routing (4 role layouts) |
| `@google/generative-ai` | 0.24.x | Gemini AI SDK |
| `html5-qrcode` | 2.3.x | QR scanner với camera thật |
| `qrcode.react` | 4.x | Sinh mã QR vé đỗ xe |
| `react-webcam` | 7.x | Camera stream cho LPR |
| Recharts | 3.x | Biểu đồ báo cáo |
| `xlsx` | 0.18.x | Export Excel |

---

## Sử dụng camera QR Scanner

Tính năng quét QR cần quyền camera trình duyệt:

- **Chrome/Edge**: Nhấn icon 🔒 trên thanh địa chỉ → Camera → Cho phép
- **Firefox**: Nhấn icon camera trên thanh địa chỉ → Cho phép
- **Lần đầu truy cập**: Trình duyệt sẽ tự hỏi quyền — nhấn "Cho phép"
- **Không có camera**: Dùng ô "Nhập mã QR thủ công" trong trang Check-out

> Camera chỉ hoạt động trên `localhost` hoặc HTTPS. Trên HTTP production sẽ bị chặn bởi browser security policy.

---

## Luồng hoạt động chính

```
Xe vào:
  Staff → CheckIn → LPR nhận biển số → AI gợi ý slot
       → Tạo session + in QR → Barrier A mở 4 giây

Xe ra:
  Staff → CheckOut → Quét QR vé (hoặc nhập biển số)
       → Tính phí → Chọn hình thức thanh toán
       → Xác nhận → Barrier B mở 4 giây → In receipt
```

---

## Ghi chú phát triển

- **Mock data**: Tất cả API call dùng mock data trong `src/api/`. Kết nối backend thật bằng cách thay các mock functions bằng `axios` calls vào `VITE_API_BASE_URL`.
- **IoT Simulation**: `useSlotSimulation` cập nhật 1–3 slot mỗi 5 giây qua Zustand. Barrier state được chia sẻ qua `iotStore`. Trong production, thay bằng Socket.IO từ `VITE_SOCKET_URL`.
- **Gemini AI**: Nếu `VITE_GEMINI_API_KEY` trống, `isConfigured = false` và tất cả AI function tự động dùng fallback algorithm — app không crash.

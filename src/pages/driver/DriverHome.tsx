// Driver Portal — Trang chủ: thông tin bãi xe, slot trống, session hiện tại + QR, bảng giá rút gọn
import { useState, useEffect } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import {
  MapPin, Clock, CheckCircle2, XCircle, Car,
  Bike, Layers, TrendingUp, Info, RefreshCw,
} from 'lucide-react'
import { useSlotStore } from '@/store/slotStore'
import { useSessionStore } from '@/store/sessionStore'
import { useAuthStore } from '@/store/authStore'
import { calculateFee, formatDuration } from '@/utils/feeCalculator'
import { MOCK_PRICING, MOCK_PEAK_HOURS } from '@/api/mockPricing'

// ─── Constants ────────────────────────────────────────────────────────────────
const PARKING_INFO = {
  name:    'Bãi xe ParkingOS — Trung tâm TP',
  address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
  openMin:  6 * 60,   // 06:00
  closeMin: 23 * 60,  // 23:00
  openLabel:  '06:00',
  closeLabel: '23:00',
  totalSlots: 72,
  floors: [
    { floor: -1, zone: 'B1', label: 'Hầm B1', vehicleLabel: 'Xe máy / Xe đạp' },
    { floor: 1,  zone: '1',  label: 'Tầng 1', vehicleLabel: 'Ô tô' },
    { floor: 2,  zone: '2',  label: 'Tầng 2', vehicleLabel: 'Ô tô' },
    { floor: 3,  zone: '3',  label: 'Tầng 3', vehicleLabel: 'Ô tô' },
  ],
}

const VEHICLE_ICONS: Record<string, React.ElementType> = {
  motorbike: Bike,
  bicycle:   Bike,
  car:       Car,
}

const VEHICLE_LABELS: Record<string, string> = {
  motorbike: 'Xe máy',
  bicycle:   'Xe đạp',
  car:       'Ô tô',
}

function fmt(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n) + ' ₫'
}

function availBarColor(pct: number) {
  if (pct > 60) return 'bg-green-500'
  if (pct > 30) return 'bg-amber-400'
  return 'bg-red-400'
}

function availTextColor(pct: number) {
  if (pct > 60) return 'text-green-600'
  if (pct > 30) return 'text-amber-600'
  return 'text-red-500'
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DriverHome() {
  const [now, setNow] = useState(new Date())

  const slots    = useSlotStore((s) => s.slots)
  const sessions = useSessionStore((s) => s.sessions)
  const { user } = useAuthStore()

  // Cập nhật "now" mỗi phút để phí tạm tính tự động tăng
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // ── Derived state ──────────────────────────────────────────────────────────
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const isOpen = nowMin >= PARKING_INFO.openMin && nowMin < PARKING_INFO.closeMin

  // Stats theo từng tầng
  const floorStats = PARKING_INFO.floors.map(({ floor, zone, label, vehicleLabel }) => {
    const floorSlots = slots.filter((s) => s.floor === floor)
    const avail      = floorSlots.filter((s) => s.status === 'available').length
    const total      = floorSlots.length
    const pct        = total > 0 ? Math.round((avail / total) * 100) : 0
    return { floor, zone, label, vehicleLabel, avail, total, pct }
  })

  const totalAvail = slots.filter((s) => s.status === 'available').length
  const totalSlots = slots.length
  const totalPct   = totalSlots > 0 ? Math.round((totalAvail / totalSlots) * 100) : 0

  // Session đang hoạt động của tài xế này
  const activeSession = sessions.find(
    (s) => s.driverId === user?.id && s.status === 'active',
  )
  const liveFee = activeSession ? calculateFee(activeSession, now) : null

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-5 space-y-4 max-w-lg mx-auto">

      {/* ── 1. Thông tin bãi xe ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-lg leading-tight">{PARKING_INFO.name}</h2>
              <p className="text-blue-100 text-sm mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {PARKING_INFO.address}
              </p>
            </div>
            <span
              className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                isOpen
                  ? 'bg-green-400/30 text-green-100 border border-green-300/40'
                  : 'bg-red-400/30 text-red-100 border border-red-300/40'
              }`}
            >
              {isOpen ? (
                <><CheckCircle2 className="w-3.5 h-3.5" /> Đang mở</>
              ) : (
                <><XCircle className="w-3.5 h-3.5" /> Đã đóng</>
              )}
            </span>
          </div>
        </div>

        {/* Giờ hoạt động */}
        <div className="px-5 py-3 flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4 text-blue-400 shrink-0" />
          <span>Hoạt động hàng ngày:</span>
          <span className="font-semibold text-gray-800">
            {PARKING_INFO.openLabel} — {PARKING_INFO.closeLabel}
          </span>
        </div>
      </div>

      {/* ── 2. Slot trống ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-500" />
          <h3 className="font-semibold text-gray-800">Slot đang trống</h3>
        </div>

        {/* Tổng */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-3xl font-bold text-gray-900">
              {totalAvail}
              <span className="text-base font-normal text-gray-400"> / {totalSlots}</span>
            </p>
            <p className="text-sm text-gray-500">slot còn trống</p>
          </div>
          <div className="w-20 h-20 relative flex items-center justify-center">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={totalPct > 60 ? '#22c55e' : totalPct > 30 ? '#f59e0b' : '#ef4444'}
                strokeWidth="3"
                strokeDasharray={`${totalPct} ${100 - totalPct}`}
                strokeLinecap="round"
              />
            </svg>
            <span className={`absolute text-sm font-bold ${availTextColor(totalPct)}`}>
              {totalPct}%
            </span>
          </div>
        </div>

        {/* Theo từng tầng */}
        <div className="space-y-3">
          {floorStats.map(({ floor, label, vehicleLabel, avail, total, pct }) => (
            <div key={floor}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600 font-medium">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{vehicleLabel}</span>
                  <span className={`font-semibold ${availTextColor(pct)}`}>
                    {avail}/{total}
                  </span>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${availBarColor(pct)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Session đang gửi xe (nếu có) ─────────────────────────────── */}
      {activeSession && liveFee && (
        <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-blue-50 px-5 py-3 flex items-center gap-2 border-b border-blue-100">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <h3 className="font-semibold text-blue-800">Đang gửi xe</h3>
            <span className="ml-auto text-xs text-blue-500 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              Cập nhật mỗi phút
            </span>
          </div>

          <div className="p-5 space-y-5">
            {/* Thông tin session */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-gray-500">Biển số</dt>
              <dd className="font-mono font-bold text-gray-900 text-base">
                {activeSession.vehiclePlate}
              </dd>

              <dt className="text-gray-500">Loại xe</dt>
              <dd className="flex items-center gap-1.5">
                {(() => { const Icon = VEHICLE_ICONS[activeSession.vehicleType] ?? Car; return <Icon className="w-4 h-4 text-gray-500" /> })()}
                {VEHICLE_LABELS[activeSession.vehicleType] ?? activeSession.vehicleType}
              </dd>

              <dt className="text-gray-500">Slot</dt>
              <dd className="font-semibold">{activeSession.slotCode}</dd>

              <dt className="text-gray-500">Giờ vào</dt>
              <dd>{new Date(activeSession.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</dd>

              <dt className="text-gray-500">Thời gian đỗ</dt>
              <dd className="font-medium">{formatDuration(liveFee.durationMinutes)}</dd>
            </dl>

            {/* Phí tạm tính */}
            <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-500 font-medium">Phí tạm tính</p>
                <p className="text-2xl font-bold text-blue-700 mt-0.5">{fmt(liveFee.total)}</p>
                {liveFee.isPeak && (
                  <p className="text-xs text-orange-500 mt-0.5">⚡ Đang áp dụng giá cao điểm</p>
                )}
              </div>
              <div className="text-right text-xs text-blue-400">
                <p>Tính đến</p>
                <p className="font-mono font-semibold text-blue-600">
                  {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-gray-600 font-medium">Mã vé — xuất trình tại cổng ra</p>
              <div className="bg-white p-3 rounded-2xl shadow-inner border border-gray-100">
                <QRCodeCanvas
                  value={activeSession.qrCode}
                  size={200}
                  level="M"
                  includeMargin={false}
                  className="block"
                />
              </div>
              <p className="text-xs text-gray-400 text-center">
                Mã QR sẽ được nhân viên quét khi xe ra
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. Bảng giá rút gọn ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          <h3 className="font-semibold text-gray-800">Bảng giá</h3>
        </div>

        <div className="space-y-3">
          {MOCK_PRICING.map((rule) => {
            const Icon = VEHICLE_ICONS[rule.vehicleType] ?? Car
            return (
              <div
                key={rule.vehicleType}
                className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">
                    {VEHICLE_LABELS[rule.vehicleType] ?? rule.vehicleType}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                    <span>Thường: <strong className="text-gray-700">{fmt(rule.normalRate)}/h</strong></span>
                    <span>Cao điểm: <strong className="text-orange-600">{fmt(rule.peakRate)}/h</strong></span>
                    <span>Qua đêm: <strong className="text-indigo-600">{fmt(rule.overnightRate)}</strong></span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Giờ cao điểm */}
        <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
          <p className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> Khung giờ cao điểm
          </p>
          <div className="space-y-1">
            {MOCK_PEAK_HOURS.map((ph) => (
              <div key={ph.id} className="flex items-center justify-between text-xs text-orange-600">
                <span>{ph.label}</span>
                <span className="font-mono font-semibold">
                  {ph.startTime}–{ph.endTime} ({ph.days.join(', ')})
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Tính tối thiểu 1 giờ · Làm tròn lên 0.5 giờ
        </p>
      </div>

      {/* Bottom padding để không bị bottom nav che */}
      <div className="h-2" />
    </div>
  )
}

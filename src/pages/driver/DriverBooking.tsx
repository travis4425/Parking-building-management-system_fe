// Driver Portal — Đặt chỗ trước: form 2 cột, slot grid, xác nhận + QR mã đặt chỗ
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import {
  CalendarDays, Clock, Car, Bike, Truck, CheckCircle,
  MapPin, Info, Shuffle, X, AlertCircle, ChevronRight,
  Home as HomeIcon,
} from 'lucide-react'
import { useSlotStore } from '@/store/slotStore'
import { useReservationStore, vehicleLabel } from '@/store/reservationStore'
import { useAuthStore } from '@/store/authStore'
import { calculateFee, formatDuration } from '@/utils/feeCalculator'
import type { ParkingSession, VehicleType, Reservation } from '@/utils/types'

// ─── Constants ────────────────────────────────────────────────────────────────
const VEHICLE_OPTS: { val: VehicleType; label: string; icon: React.ElementType; desc: string }[] = [
  { val: 'motorbike', label: 'Xe máy',     icon: Bike,  desc: 'Tầng 1 · Khu A' },
  { val: 'car',       label: 'Ô tô',       icon: Car,   desc: 'Tầng 2-3 · Khu B-C' },
  { val: 'truck',     label: 'Xe tải nhỏ', icon: Truck, desc: 'Tầng 2-3 · Khu B-C' },
]

const FLOOR_LABELS: Record<number, string> = {
  1: 'Tầng 1 · Khu A · Xe máy',
  2: 'Tầng 2 · Khu B · Ô tô',
  3: 'Tầng 3 · Khu C · Ô tô',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n) + ' ₫'
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function defaultArrival() {
  const h = (new Date().getHours() + 1) % 24
  return `${String(h).padStart(2, '0')}:00`
}

function defaultDeparture(arrival: string) {
  const [h] = arrival.split(':').map(Number)
  const dh  = (h + 2) % 24
  return `${String(dh).padStart(2, '0')}:00`
}

function parseMins(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function estimateFee(vt: VehicleType, date: string, arrival: string, departure: string): number {
  const checkIn  = new Date(`${date}T${arrival}:00`)
  const checkOut = new Date(`${date}T${departure}:00`)
  if (checkOut <= checkIn) return 0
  // Tạo mock session tối thiểu để calculateFee hoạt động
  const mock: ParkingSession = {
    id: '', slotId: '', slotCode: '', vehiclePlate: '',
    vehicleType: vt, staffCheckInId: '',
    checkInTime: checkIn.toISOString(), status: 'active', qrCode: '',
  }
  return calculateFee(mock, checkOut).total
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DriverBooking() {
  const navigate   = useNavigate()
  const slots      = useSlotStore((s) => s.slots)
  const updateSlot = useSlotStore((s) => s.updateSlotStatus)
  const { addReservation, expireOverdue } = useReservationStore()
  const { user }   = useAuthStore()

  // ── Form state ─────────────────────────────────────────────────────────────
  const initArrival    = defaultArrival()
  const initDeparture  = defaultDeparture(initArrival)

  const [vehicleType,    setVehicleType]    = useState<VehicleType>('motorbike')
  const [date,           setDate]           = useState(todayStr())
  const [arrivalTime,    setArrivalTime]    = useState(initArrival)
  const [departureTime,  setDepartureTime]  = useState(initDeparture)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null) // null = auto-assign
  const [formError,      setFormError]      = useState<string | null>(null)
  const [booking,        setBooking]        = useState<Reservation | null>(null)

  // Dọn expired reservations khi vào trang
  useEffect(() => {
    const expired = expireOverdue()
    expired.forEach((r) => updateSlot(r.slotId, 'available'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────
  // Xe tải dùng chung slot với ô tô (không có slot riêng trong mock data)
  const slotVehicleType: VehicleType = vehicleType === 'truck' ? 'car' : vehicleType

  const availableSlots = useMemo(
    () => slots.filter((s) => s.vehicleType === slotVehicleType && s.status === 'available'),
    [slots, slotVehicleType],
  )

  const slotsByFloor = useMemo(() => {
    const floors = [...new Set(availableSlots.map((s) => s.floor))].sort()
    return floors.map((floor) => ({
      floor,
      label: FLOOR_LABELS[floor] ?? `Tầng ${floor}`,
      slots: availableSlots.filter((s) => s.floor === floor),
    }))
  }, [availableSlots])

  const durationMins = parseMins(departureTime) - parseMins(arrivalTime)
  const estimatedFee = durationMins >= 30
    ? estimateFee(vehicleType, date, arrivalTime, departureTime)
    : 0

  const selectedSlot = slots.find((s) => s.id === selectedSlotId) ?? null

  // Deselect slot if it becomes unavailable (e.g., someone else books it)
  useEffect(() => {
    if (selectedSlotId && !availableSlots.find((s) => s.id === selectedSlotId)) {
      setSelectedSlotId(null)
    }
  }, [availableSlots, selectedSlotId])

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): string | null {
    const today = todayStr()
    if (date < today) return 'Ngày đặt không thể là ngày trong quá khứ'

    if (durationMins < 30) return 'Thời gian đỗ tối thiểu 30 phút (giờ ra phải sau giờ vào ít nhất 30 phút)'

    // Nếu đặt cho hôm nay, giờ vào phải ở tương lai
    if (date === todayStr()) {
      const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
      if (parseMins(arrivalTime) <= nowMins) {
        return 'Giờ vào dự kiến phải sau thời điểm hiện tại'
      }
    }

    if (availableSlots.length === 0) {
      return `Hiện không có slot trống phù hợp cho ${vehicleLabel(vehicleType)}`
    }

    return null
  }

  // ── Confirm booking ───────────────────────────────────────────────────────
  function handleConfirm() {
    const err = validate()
    if (err) { setFormError(err); return }
    setFormError(null)

    // Chọn slot: cụ thể nếu đã chọn, ngược lại lấy slot đầu tiên
    const chosenSlot   = selectedSlot ?? availableSlots[0]
    const isAutoAssigned = !selectedSlot

    // Tính expiresAt: giờ vào dự kiến + 15 phút
    const arrivalDT = new Date(`${date}T${arrivalTime}:00`)
    const expiresAt = new Date(arrivalDT.getTime() + 15 * 60_000).toISOString()

    // Cập nhật slot → RESERVED
    updateSlot(chosenSlot.id, 'reserved')

    // Tạo reservation
    const rsv = addReservation({
      driverId:           user?.id ?? 'unknown',
      vehicleType,
      slotId:             chosenSlot.id,
      slotCode:           chosenSlot.code,
      date,
      estimatedArrival:   arrivalTime,
      estimatedDeparture: departureTime,
      durationMinutes:    durationMins,
      estimatedFee:       estimatedFee,
      isAutoAssigned,
      status:             'pending',
      expiresAt,
    })

    setBooking(rsv)
  }

  // ── Confirmed view ────────────────────────────────────────────────────────
  if (booking) {
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border-2 border-green-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-green-500 px-5 py-5 text-white text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-2" />
            <h2 className="text-xl font-bold">Đặt chỗ thành công!</h2>
            <p className="text-green-100 text-sm mt-1">{booking.code}</p>
          </div>

          <div className="p-5 space-y-5">
            {/* QR code mã đặt chỗ */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-semibold text-gray-700">
                Xuất trình mã này khi vào bãi để check-in nhanh
              </p>
              <div className="bg-white p-4 rounded-2xl shadow-inner border border-gray-100">
                <QRCodeCanvas
                  value={`PARKINGOS:RSV:${booking.code}`}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <p className="font-mono font-bold text-2xl tracking-widest text-gray-800">
                {booking.code}
              </p>
            </div>

            {/* Summary */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-t pt-4">
              <dt className="text-gray-500">Loại xe</dt>
              <dd className="font-medium">{vehicleLabel(booking.vehicleType)}</dd>

              <dt className="text-gray-500">Slot đặt trước</dt>
              <dd className="font-mono font-semibold">
                {booking.slotCode}
                {booking.isAutoAssigned && (
                  <span className="ml-1.5 text-xs text-gray-400 font-sans">(tự động)</span>
                )}
              </dd>

              <dt className="text-gray-500">Ngày</dt>
              <dd>{new Date(booking.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</dd>

              <dt className="text-gray-500">Giờ vào</dt>
              <dd className="font-semibold">{booking.estimatedArrival}</dd>

              <dt className="text-gray-500">Giờ ra</dt>
              <dd>{booking.estimatedDeparture}</dd>

              <dt className="text-gray-500">Thời gian</dt>
              <dd>{formatDuration(booking.durationMinutes)}</dd>

              <dt className="text-gray-500">Phí ước tính</dt>
              <dd className="font-semibold text-blue-600">{fmt(booking.estimatedFee)}</dd>
            </dl>

            {/* Expiry warning */}
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Slot sẽ được giữ đến <strong>15 phút</strong> sau giờ vào dự kiến.
                Nếu không check-in trước{' '}
                <strong>
                  {(() => {
                    const d = new Date(booking.expiresAt)
                    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  })()}
                </strong>
                , đặt chỗ sẽ bị hủy tự động.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setBooking(null)
                  setSelectedSlotId(null)
                }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
              >
                Đặt chỗ khác
              </button>
              <button
                onClick={() => navigate('/driver')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                <HomeIcon className="w-4 h-4" /> Trang chủ
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── 2-column booking layout ───────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Đặt chỗ trước</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Chọn thông tin xe và thời gian — slot được giữ RESERVED cho bạn
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ══ CỘT TRÁI — Form ═══════════════════════════════════════════════ */}
        <div className="space-y-4">

          {/* Loại xe */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 text-sm">
              <Car className="w-4 h-4 text-blue-500" /> Loại xe
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {VEHICLE_OPTS.map(({ val, label, icon: Icon, desc }) => (
                <button
                  key={val}
                  onClick={() => { setVehicleType(val); setSelectedSlotId(null); setFormError(null) }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-xs font-medium transition-all ${
                    vehicleType === val
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-6 h-6" />
                  <div>
                    <p>{label}</p>
                    <p className="text-gray-400 font-normal">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Ngày & Thời gian */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
              <CalendarDays className="w-4 h-4 text-blue-500" /> Ngày &amp; Thời gian
            </h3>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ngày đặt</label>
              <input
                type="date"
                value={date}
                min={todayStr()}
                onChange={(e) => { setDate(e.target.value); setFormError(null) }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Time pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Giờ vào
                </label>
                <input
                  type="time"
                  value={arrivalTime}
                  onChange={(e) => { setArrivalTime(e.target.value); setFormError(null) }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Giờ ra
                </label>
                <input
                  type="time"
                  value={departureTime}
                  onChange={(e) => { setDepartureTime(e.target.value); setFormError(null) }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Fee estimate preview */}
            {durationMins >= 30 ? (
              <div className="bg-blue-50 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-500 font-medium">Ước tính</p>
                  <p className="text-sm font-semibold text-blue-800">
                    {formatDuration(durationMins)} · {fmt(estimatedFee)}
                  </p>
                </div>
                <Info className="w-4 h-4 text-blue-400" />
              </div>
            ) : durationMins < 0 ? (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Giờ ra phải sau giờ vào
              </p>
            ) : (
              <p className="text-xs text-amber-500 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Tối thiểu 30 phút
              </p>
            )}
          </div>

          {/* Validation error */}
          {formError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {formError}
            </div>
          )}

          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Xác nhận đặt chỗ
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Summary selected slot */}
          {selectedSlot && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm">
              <MapPin className="w-4 h-4 text-green-500 shrink-0" />
              <span className="text-green-700">
                Slot đã chọn: <strong className="font-mono">{selectedSlot.code}</strong>
              </span>
              <button
                onClick={() => setSelectedSlotId(null)}
                className="ml-auto text-green-400 hover:text-green-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ══ CỘT PHẢI — Slot Grid ══════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-500" />
                Slot trống — {vehicleLabel(vehicleType)}
                <span className="ml-1 text-xs text-gray-400 font-normal">
                  ({availableSlots.length} slot)
                </span>
              </h3>
            </div>

            {/* Tự động phân bổ chip */}
            <button
              onClick={() => setSelectedSlotId(null)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all mb-4 ${
                selectedSlotId === null
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <Shuffle className="w-4 h-4 shrink-0" />
              <div className="text-left">
                <p>Hệ thống tự phân bổ</p>
                <p className="text-xs text-gray-400 font-normal">
                  {availableSlots[0]
                    ? `Sẽ chọn slot ${availableSlots[0].code} (hoặc slot tốt nhất)`
                    : 'Không có slot trống'}
                </p>
              </div>
              {selectedSlotId === null && <CheckCircle className="w-4 h-4 ml-auto text-blue-500" />}
            </button>

            {/* Slot grid theo tầng */}
            {availableSlots.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <MapPin className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Không có slot trống cho {vehicleLabel(vehicleType)}</p>
                {vehicleType === 'truck' && (
                  <p className="text-xs mt-1 text-gray-400">Xe tải dùng slot ô tô — liên hệ nhân viên nếu cần hỗ trợ</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {slotsByFloor.map(({ floor, label, slots: floorSlots }) => (
                  <div key={floor}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      {label}
                    </p>
                    <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
                      {floorSlots.map((slot) => {
                        const isSelected = selectedSlotId === slot.id
                        return (
                          <button
                            key={slot.id}
                            onClick={() =>
                              setSelectedSlotId(isSelected ? null : slot.id)
                            }
                            title={`Slot ${slot.code}`}
                            className={`py-2 rounded-lg text-xs font-mono font-semibold transition-all border ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                            }`}
                          >
                            {slot.code}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Chú thích màu */}
            <div className="mt-4 flex gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-600 inline-block" />
                Đã chọn
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-gray-100 border border-gray-200 inline-block" />
                Trống
              </span>
            </div>
          </div>

          {/* Thông tin giữ slot */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-700 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              Slot được giữ <strong>RESERVED</strong> từ lúc đặt. Nếu không check-in trong vòng
              <strong> 15 phút</strong> sau giờ vào dự kiến, hệ thống sẽ tự hủy và trả slot về
              pool trống.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

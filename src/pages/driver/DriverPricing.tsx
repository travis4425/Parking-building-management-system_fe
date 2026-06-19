// Driver Portal — Bảng giá đầy đủ, timeline cao điểm, thông tin bãi, tính phí nhanh
import { useState, useMemo, useEffect } from 'react'
import {
  Bike, Car, Clock, MapPin, Phone,
  Calculator, CheckCircle2, X, Zap, ShieldCheck,
  ChevronRight, Moon,
} from 'lucide-react'
import { usePricingStore } from '@/store/pricingStore'
import { calculateFee, type FeeBreakdown } from '@/utils/feeCalculator'
import type { ParkingSession, VehicleType, PeakHourRange } from '@/utils/types'

// ─── Constants ────────────────────────────────────────────────────────────────
const VEHICLE_ICONS: Record<VehicleType, React.ElementType> = {
  motorbike: Bike,
  bicycle:   Bike,
  car:       Car,
}

const VEHICLE_LABELS: Record<VehicleType, string> = {
  motorbike: 'Xe máy',
  bicycle:   'Xe đạp',
  car:       'Ô tô',
}

const DURATION_OPTS: { val: number; label: string }[] = [
  { val: 0.5, label: '30 phút'        },
  { val: 1,   label: '1 giờ'          },
  { val: 1.5, label: '1 giờ 30 phút'  },
  { val: 2,   label: '2 giờ'          },
  { val: 3,   label: '3 giờ'          },
  { val: 4,   label: '4 giờ'          },
  { val: 6,   label: '6 giờ'          },
  { val: 8,   label: '8 giờ'          },
  { val: 12,  label: '12 giờ'         },
  { val: 13,  label: 'Qua đêm (>12h)' },
]

const PARKING_RULES = [
  'Phí tính tối thiểu 1 giờ, làm tròn lên 30 phút',
  'Gửi xe máy tại Tầng 1 (Khu A), ô tô tại Tầng 2-3 (Khu B-C)',
  'Xe qua đêm (>12 giờ): áp dụng gói cố định, không tính theo giờ',
  'Mất vé QR: phụ thu 50.000 đ thêm vào phí bình thường',
  'Đặt chỗ trước: slot được giữ 15 phút sau giờ dự kiến vào',
  'Bãi không chịu trách nhiệm với tài sản để lại bên trong xe',
  'Camera an ninh hoạt động 24/7 — giám sát toàn bộ các tầng',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number) { return new Intl.NumberFormat('vi-VN').format(n) + ' ₫' }

function estimateFeeFromHours(
  vehicleType: VehicleType,
  startTime: string,
  durationH: number,
): FeeBreakdown {
  const [h, m] = startTime.split(':').map(Number)
  const checkIn = new Date()
  checkIn.setHours(h, m, 0, 0)
  const checkOut = new Date(checkIn.getTime() + durationH * 3_600_000)

  const mock: ParkingSession = {
    id: '', slotId: '', slotCode: '', vehiclePlate: '',
    vehicleType, staffCheckInId: '',
    checkInTime: checkIn.toISOString(),
    status: 'active', qrCode: '',
  }
  return calculateFee(mock, checkOut)
}

// ─── Peak Timeline ────────────────────────────────────────────────────────────
// Một hàng timeline 24 giờ (48 ô × 30 phút), tô màu theo cao điểm
function PeakTimeline({
  ranges,
  label,
}: {
  ranges: PeakHourRange[]
  label: string
}) {
  // Mỗi phần tử = 1 ô 30 phút (index 0 = 00:00, index 47 = 23:30)
  const slots = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => {
        const h    = Math.floor(i / 2)
        const m    = i % 2 === 0 ? '00' : '30'
        const time = `${String(h).padStart(2, '0')}:${m}`
        const isPeak = ranges.some(
          (r) => time >= r.startTime && time < r.endTime,
        )
        return { time, isPeak }
      }),
    [ranges],
  )

  // Nhãn mỗi 4 giờ (0, 4, 8, ..., 20)
  const hourLabels = [0, 4, 8, 12, 16, 20]

  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-1.5">{label}</p>
      {/* Thanh màu */}
      <div className="flex h-5 rounded-lg overflow-hidden">
        {slots.map((s, i) => (
          <div
            key={i}
            title={s.time}
            className={`flex-1 ${s.isPeak ? 'bg-red-300' : 'bg-green-200'}`}
          />
        ))}
      </div>
      {/* Nhãn giờ */}
      <div className="relative h-4 mt-0.5">
        {hourLabels.map((h) => (
          <span
            key={h}
            className="absolute text-[10px] text-gray-400 -translate-x-1/2"
            style={{ left: `${(h / 24) * 100}%` }}
          >
            {String(h).padStart(2, '0')}:00
          </span>
        ))}
        <span className="absolute right-0 text-[10px] text-gray-400">24:00</span>
      </div>
    </div>
  )
}

// ─── Floor Map SVG ────────────────────────────────────────────────────────────
function FloorMap() {
  const floors = [
    { label: 'Tầng 1 — Khu A', sub: 'Xe máy / Xe đạp (24 chỗ)', color: '#bfdbfe', stroke: '#3b82f6' },
    { label: 'Tầng 2 — Khu B', sub: 'Ô tô (24 chỗ)', color: '#bbf7d0', stroke: '#22c55e' },
    { label: 'Tầng 3 — Khu C', sub: 'Ô tô (24 chỗ)', color: '#bbf7d0', stroke: '#22c55e' },
  ]

  return (
    <svg viewBox="0 0 280 190" className="w-full max-w-xs mx-auto" role="img" aria-label="Sơ đồ tầng bãi xe">
      {floors.map(({ label, sub, color, stroke }, fi) => {
        const y = 10 + fi * 58
        return (
          <g key={fi}>
            {/* Khung tầng */}
            <rect x="10" y={y} width="260" height="48" rx="6"
              fill={color} stroke={stroke} strokeWidth="1.5" />
            {/* Cột phân ô (6 ô/hàng × 4 hàng = 24) */}
            {Array.from({ length: 5 }).map((_, ci) => (
              <line key={ci}
                x1={10 + (ci + 1) * (260 / 6)} y1={y + 2}
                x2={10 + (ci + 1) * (260 / 6)} y2={y + 46}
                stroke={stroke} strokeWidth="0.8" strokeOpacity="0.5" />
            ))}
            {/* Hàng chia đôi */}
            <line x1="10" y1={y + 24} x2="270" y2={y + 24}
              stroke={stroke} strokeWidth="0.8" strokeOpacity="0.5" />
            {/* Nhãn */}
            <text x="14" y={y + 14} fontSize="10" fontWeight="700" fill={stroke}>{label}</text>
            <text x="14" y={y + 28} fontSize="8.5" fill="#6b7280">{sub}</text>
            {/* Biển hiệu lối vào */}
            <rect x="248" y={y + 18} width="18" height="12" rx="2"
              fill={stroke} />
            <text x="257" y={y + 27} fontSize="7" textAnchor="middle" fill="white">IN</text>
          </g>
        )
      })}
      {/* Ký hiệu */}
      <rect x="10" y="180" width="10" height="7" rx="1" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1" />
      <text x="24" y="186" fontSize="8" fill="#6b7280">Xe máy</text>
      <rect x="75" y="180" width="10" height="7" rx="1" fill="#bbf7d0" stroke="#22c55e" strokeWidth="1" />
      <text x="89" y="186" fontSize="8" fill="#6b7280">Ô tô</text>
    </svg>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DriverPricing() {
  const rules = usePricingStore((s) => s.rules)
  const peakRanges = usePricingStore((s) => s.peakRanges)
  const isLoaded = usePricingStore((s) => s.isLoaded)
  const loadPricing = usePricingStore((s) => s.loadPricing)

  useEffect(() => {
    if (!isLoaded) loadPricing()
  }, [isLoaded, loadPricing])

  const [showCalc,    setShowCalc]    = useState(false)
  const [calcVehicle, setCalcVehicle] = useState<VehicleType>('motorbike')
  const [calcStart,   setCalcStart]   = useState('08:00')
  const [calcDur,     setCalcDur]     = useState(2)
  const [calcResult,  setCalcResult]  = useState<FeeBreakdown | null>(null)

  function handleCalc() {
    setCalcResult(estimateFeeFromHours(calcVehicle, calcStart, calcDur))
  }

  // BE chỉ lưu 1 mảng giờ cao điểm chung cho mọi ngày — không phân biệt ngày thường/cuối tuần

  return (
    <div className="p-4 sm:p-5 max-w-lg mx-auto space-y-5 pb-24">

      {/* ── 1. Pricing table ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-blue-500" />
          <h2 className="font-bold text-gray-800">Bảng giá đỗ xe</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  Loại xe
                </th>
                <th className="text-right px-3 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  Giờ thường
                </th>
                <th className="text-right px-3 py-3 font-semibold text-orange-600 text-xs uppercase tracking-wide">
                  Cao điểm
                </th>
                <th className="text-right px-3 py-3 font-semibold text-indigo-600 text-xs uppercase tracking-wide">
                  Qua đêm
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rules.map((rule) => {
                const Icon      = VEHICLE_ICONS[rule.vehicleType]
                const isPopular = rule.vehicleType === 'motorbike'
                return (
                  <tr
                    key={rule.vehicleType}
                    className={isPopular ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${isPopular ? 'text-blue-500' : 'text-gray-400'}`} />
                        <span className={`font-medium ${isPopular ? 'text-blue-700' : 'text-gray-700'}`}>
                          {VEHICLE_LABELS[rule.vehicleType]}
                        </span>
                        {isPopular && (
                          <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold">
                            Phổ biến
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-gray-800">
                      {fmt(rule.normalRate)}<span className="text-xs text-gray-400 font-normal">/h</span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-orange-600">
                      {fmt(rule.peakRate)}<span className="text-xs text-orange-300 font-normal">/h</span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-indigo-600">
                      {fmt(rule.overnightRate)}<span className="text-xs text-indigo-300 font-normal">/đêm</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Tính tối thiểu <strong>1 giờ</strong> · Làm tròn lên <strong>30 phút</strong> · Qua đêm áp dụng khi gửi &gt; 12 giờ
          </p>
        </div>
      </div>

      {/* ── 2. Khung giờ cao điểm — timeline ────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-500" />
          <h2 className="font-bold text-gray-800">Khung giờ cao điểm</h2>
        </div>

        <div className="space-y-4">
          <PeakTimeline ranges={peakRanges} label="Áp dụng mọi ngày trong tuần" />
        </div>

        {/* Legend */}
        <div className="flex gap-5 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded bg-red-300 inline-block" />
            Giờ cao điểm
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded bg-green-200 inline-block" />
            Giờ bình thường
          </span>
        </div>

        {/* Peak detail list */}
        <div className="space-y-2">
          {peakRanges.map((ph) => (
            <div
              key={ph.id}
              className="flex items-center justify-between text-sm bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5"
            >
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span className="font-medium text-orange-800">{ph.label}</span>
              </div>
              <div className="text-right text-xs text-orange-600">
                <p className="font-mono font-semibold">{ph.startTime} – {ph.endTime}</p>
                <p className="text-orange-400">Hằng ngày</p>
              </div>
            </div>
          ))}
          {peakRanges.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-2">Chưa có khung giờ cao điểm nào</p>
          )}
        </div>
      </div>

      {/* ── 3. Thông tin bãi xe ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-5">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-500" />
          <h2 className="font-bold text-gray-800">Thông tin bãi xe</h2>
        </div>

        {/* Contact info */}
        <div className="space-y-2">
          {[
            { icon: MapPin,  text: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM' },
            { icon: Phone,   text: '(028) 3822 xxxx — Hotline: 1900 1234' },
            { icon: Clock,   text: 'Hoạt động hàng ngày: 06:00 — 23:00' },
            { icon: Moon,    text: 'Nhận xe qua đêm theo yêu cầu (liên hệ trước)' },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-start gap-3 text-sm text-gray-600">
              <Icon className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* Floor map */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Sơ đồ bãi xe
          </p>
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <FloorMap />
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">
            Tổng 72 chỗ · Tầng 1: xe máy &amp; xe đạp · Tầng 2-3: ô tô
          </p>
        </div>

        {/* Rules */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Quy định gửi xe
          </p>
          <ul className="space-y-2">
            {PARKING_RULES.map((rule, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                {rule}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Nút tính phí nhanh (floating) ───────────────────────────────── */}
      <div className="fixed bottom-20 right-4 z-30">
        <button
          onClick={() => { setShowCalc(true); setCalcResult(null) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg shadow-blue-500/30 font-medium text-sm transition-all active:scale-95"
        >
          <Calculator className="w-4 h-4" />
          Tính phí nhanh
        </button>
      </div>

      {/* ── Quick fee calculator modal ───────────────────────────────────── */}
      {showCalc && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCalc(false)} />

          <div className="relative z-10 bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-gray-800">Tính phí nhanh</h3>
              </div>
              <button
                onClick={() => setShowCalc(false)}
                className="text-gray-400 hover:text-gray-600 rounded-full p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Vehicle type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Loại xe</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(VEHICLE_LABELS) as VehicleType[]).map((vt) => {
                    const Icon = VEHICLE_ICONS[vt]
                    return (
                      <button
                        key={vt}
                        onClick={() => { setCalcVehicle(vt); setCalcResult(null) }}
                        className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                          calcVehicle === vt
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {VEHICLE_LABELS[vt]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Start time */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Giờ vào dự kiến
                </label>
                <input
                  type="time"
                  value={calcStart}
                  onChange={(e) => { setCalcStart(e.target.value); setCalcResult(null) }}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Thời gian gửi
                </label>
                <select
                  value={calcDur}
                  onChange={(e) => { setCalcDur(Number(e.target.value)); setCalcResult(null) }}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                >
                  {DURATION_OPTS.map((d) => (
                    <option key={d.val} value={d.val}>{d.label}</option>
                  ))}
                </select>
              </div>

              {/* Calculate button */}
              <button
                onClick={handleCalc}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Calculator className="w-4 h-4" />
                Tính phí
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Result */}
              {calcResult && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-blue-800">Phí ước tính</p>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-700">
                        {fmt(calcResult.total)}
                      </p>
                      {calcResult.isPeak && (
                        <p className="text-xs text-orange-500 flex items-center gap-1 justify-end">
                          <Zap className="w-3 h-3" /> Áp dụng giá cao điểm
                        </p>
                      )}
                      {calcResult.isOvernight && (
                        <p className="text-xs text-indigo-500 flex items-center gap-1 justify-end">
                          <Moon className="w-3 h-3" /> Gói qua đêm
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-blue-600 space-y-0.5 border-t border-blue-100 pt-2">
                    <div className="flex justify-between">
                      <span>{VEHICLE_LABELS[calcVehicle]}</span>
                      <span>{calcResult.billableHours}h tính tiền</span>
                    </div>
                    {calcResult.isOvernight ? (
                      <div className="flex justify-between">
                        <span>Gói qua đêm</span>
                        <span>{fmt(calcResult.overnightFee)}</span>
                      </div>
                    ) : calcResult.isPeak ? (
                      <div className="flex justify-between">
                        <span>Giá cao điểm × {calcResult.peakHours}h</span>
                        <span>{fmt(calcResult.peakFee)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between">
                        <span>Giá thường × {calcResult.normalHours}h</span>
                        <span>{fmt(calcResult.normalFee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-blue-400">
                      <span>Vào: {calcStart}</span>
                      <span>
                        Ra: {(() => {
                          const [h, m] = calcStart.split(':').map(Number)
                          const out = new Date()
                          out.setHours(h, m)
                          out.setTime(out.getTime() + calcDur * 3_600_000)
                          return out.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

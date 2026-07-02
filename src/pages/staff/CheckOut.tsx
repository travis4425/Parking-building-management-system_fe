// Trang check-out xe ra — quét QR vé, tính phí, thanh toán, mở barrier, in receipt
import { useState, type ComponentType } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import {
  ScanLine, Search, AlertCircle, CheckCircle, Car,
  Clock, CreditCard, Banknote, QrCode, X,
  ChevronRight, TriangleAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import PageWrapper from '@/components/layout/PageWrapper'
import QRScanner from '@/components/staff/QRScanner'
import Receipt from '@/components/staff/Receipt'
import { BarrierGate } from '@/components/iot/BarrierStatus'
import { decodeToken }  from '@/utils/qrToken'
import { useSessionStore } from '@/store/sessionStore'
import { fetchSessionById, fetchActiveSessionByPlate } from '@/api/sessionsApi'
import { useSlotStore } from '@/store/slotStore'
import { calculateFee, formatDuration, LOST_TICKET_SURCHARGE, type FeeBreakdown } from '@/utils/feeCalculator'
import type { ParkingSession, PayMethod } from '@/utils/types'

const VEHICLE_LABELS: Record<string, string> = {
  motorbike: 'Xe máy', car: 'Ô tô', bicycle: 'Xe đạp',
}

// 🐞 SỬA: làm tròn về số nguyên trước khi format — VND không có phần thập phân (hào/xu),
// trong khi totalFee BE trả về có thể có .xx do phép tính giờ × đơn giá.
function fmt(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫'
}

// ── Danh sách phương thức thanh toán ────────────────────────────────────────
const PAY_OPTIONS: { val: PayMethod; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { val: 'cash', label: 'Tiền mặt',  Icon: Banknote  },
  { val: 'qr',   label: 'QR Code',   Icon: QrCode    },
  { val: 'card', label: 'Thẻ NH',    Icon: CreditCard },
]

// ── Main page ────────────────────────────────────────────────────────────────
export default function CheckOut() {
  const sessions      = useSessionStore((s) => s.sessions)
  const findByQR      = useSessionStore((s) => s.findByQR)
  const findByPlate   = useSessionStore((s) => s.findByPlate)
  const checkOutSession = useSessionStore((s) => s.checkOutSession)
  const updateSlot    = useSlotStore((s) => s.updateSlotStatus)
  const [submitting,  setSubmitting]  = useState(false)

  const [scanActive,   setScanActive]   = useState(true)
  const [plateInput,   setPlateInput]   = useState('')
  const [isLostTicket, setLostTicket]   = useState(false)
  const [lookupErr,    setLookupErr]    = useState('')

  const [session,  setSession]  = useState<ParkingSession | null>(null)
  const [checkOut, setCheckOut] = useState<Date>(new Date())
  const [fee,      setFee]      = useState<FeeBreakdown | null>(null)

  const [payMethod,   setPayMethod]   = useState<PayMethod | null>(null)
  const [barrierOpen, setBarrierOpen] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [confirmed,   setConfirmed]   = useState(false)

  function applySession(found: ParkingSession | undefined, lost = false) {
    if (!found) {
      setLookupErr('Không tìm thấy phiên đỗ xe đang hoạt động.')
      toast.error('Không tìm thấy lượt gửi xe với thông tin này')
      return
    }
    const now = new Date()
    setSession(found)
    setCheckOut(now)
    setFee(calculateFee(found, now, lost))
    setLookupErr('')
    setScanActive(false)
  }

  // 🐞 SỬA: handleQRScan bất đồng bộ — khi không tìm thấy session trong local store
  // (vd. vừa vào trang chưa load, hoặc session được tạo ở tab/máy khác), gọi thẳng
  // BE để lấy session theo sessionId decode từ PKG token thay vì báo "không tìm thấy".
  async function handleQRScan(text: string) {
    setScanActive(false)
    const decoded = decodeToken(text)

    if (decoded.ok) {
      // 1. Thử local store trước (nhanh hơn)
      let sess = sessions.find((s) => s.id === decoded.sessionId && s.status === 'active')

      // 2. Không có trong store → fetch thẳng từ BE theo sessionId
      if (!sess) {
        try {
          const remote = await fetchSessionById(decoded.sessionId)
          if (remote.status !== 'active') {
            toast.error('Mã QR không hợp lệ hoặc đã hết hiệu lực')
            setScanActive(true)
            return
          }
          sess = remote
        } catch {
          toast.error('Không tìm thấy lượt gửi xe — mã QR có thể đã hết hiệu lực')
          setScanActive(true)
          return
        }
      }

      applySession(sess)
    } else if (decoded.reason === 'invalid_checksum') {
      toast.error('Mã QR không hợp lệ hoặc đã hết hiệu lực')
      setScanActive(true)
    } else {
      // Không phải PKG format — có thể là UUID (qrToken) staff nhập tay
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (UUID_RE.test(text.trim())) {
        try {
          const remote = await fetchSessionById(text.trim().toLowerCase())
          if (remote.status === 'active') {
            applySession(remote)
          } else {
            toast.error('Phiên đỗ xe này đã kết thúc')
            setScanActive(true)
          }
        } catch {
          toast.error('Không tìm thấy phiên đỗ xe với mã này')
          setScanActive(true)
        }
      } else {
        applySession(findByQR(text))
      }
    }
  }

  async function handlePlateSearch() {
    if (!plateInput.trim()) return
    // 1. Thử local store trước
    const local = findByPlate(plateInput)
    if (local) { applySession(local, isLostTicket); return }
    // 2. Không có → fetch từ BE (session tạo ở tab/máy khác hoặc reload trang)
    try {
      const remote = await fetchActiveSessionByPlate(plateInput)
      applySession(remote ?? undefined, isLostTicket)
    } catch {
      setLookupErr('Không tìm thấy phiên đỗ xe đang hoạt động.')
      toast.error('Không tìm thấy lượt gửi xe với biển số này')
    }
  }

  async function handleConfirmPayment() {
    if (!session || !fee || !payMethod) return
    setSubmitting(true)
    try {
      // BE tính phí thật (pricing thật, có overnightRate + phụ thu mất vé) — dùng làm số liệu chính thức
      const result = await checkOutSession(session.qrCode, { lostTicket: isLostTicket })
      if (result.priceBreakdown) {
        setFee({ ...fee, total: result.priceBreakdown.totalFee, isPeak: result.priceBreakdown.isPeakHour, isOvernight: result.priceBreakdown.isOvernight })
      }
      updateSlot(session.slotId, 'available')
      setConfirmed(true)
      setBarrierOpen(true)
      setTimeout(() => setBarrierOpen(false), 4000)

      toast.success('Thanh toán thành công — Barrier đã mở')
      setTimeout(() => setShowReceipt(true), 1200)
    } catch (err: unknown) {
      console.error('Check-out thất bại:', err)
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Không thể check-out — vui lòng thử lại'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setSession(null);   setFee(null);        setPayMethod(null)
    setBarrierOpen(false); setShowReceipt(false); setConfirmed(false)
    setLookupErr('');   setPlateInput('');   setLostTicket(false)
    setScanActive(true)
  }

  return (
    <PageWrapper>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Xe ra (Check-out)</h1>
        <p className="text-sm text-gray-500 mt-0.5">Quét vé QR hoặc tra cứu biển số để thanh toán</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── CỘT TRÁI ── */}
        <div className="space-y-4">
          {/* QR Scanner */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <ScanLine className="w-4 h-4 text-blue-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Quét mã QR vé</h2>
              {session && (
                <button onClick={handleReset}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <X className="w-3.5 h-3.5" /> Đặt lại
                </button>
              )}
            </div>

            <QRScanner onScan={handleQRScan} active={scanActive && !session} />

            {session && (
              <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700
                              bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                Đã xác nhận —{' '}
                <span className="font-mono font-bold">{session.vehiclePlate}</span>
              </div>
            )}
          </div>

          {/* Tra cứu biển số / mất vé */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Search className="w-4 h-4 text-amber-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Tra cứu theo biển số</h2>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={plateInput}
                onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handlePlateSearch()}
                placeholder="Ví dụ: 51G-123.45"
                disabled={!!session}
                className="flex-1 px-3 py-2.5 text-sm font-mono rounded-xl border border-gray-300
                           focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                           disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button onClick={handlePlateSearch} disabled={!!session || !plateInput.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                           text-white text-sm font-medium rounded-xl transition-colors
                           flex items-center gap-1.5">
                <Search className="w-4 h-4" /> Tra cứu
              </button>
            </div>

            <label className="mt-3 flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={isLostTicket}
                onChange={(e) => {
                  setLostTicket(e.target.checked)
                  if (session) setFee(calculateFee(session, checkOut, e.target.checked))
                }}
                className="w-4 h-4 rounded accent-amber-500"
              />
              <span className="text-sm text-gray-600 group-hover:text-gray-800">
                Mất vé — phụ thu thêm{' '}
                <span className="font-semibold text-amber-600">{fmt(LOST_TICKET_SURCHARGE)}</span>
              </span>
            </label>

            {lookupErr && (
              <div className="mt-3 flex items-center gap-2 text-sm text-red-600
                              bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {lookupErr}
              </div>
            )}
          </div>

          {/* Barrier */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="py-2">
              <BarrierGate
                open={barrierOpen}
                label="Cổng B — Ra"
                lastOpened={barrierOpen ? new Date().toISOString() : null}
              />
              {barrierOpen && (
                <p className="text-xs text-emerald-600 text-center font-medium mt-2">
                  ✓ Barrier đã mở — xe có thể ra
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── CỘT PHẢI ── */}
        <div className="space-y-4">
          {!session ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200
                            flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
              <Car className="w-12 h-12 opacity-20" />
              <p className="text-sm">Quét QR vé hoặc nhập biển số để xem thông tin</p>
            </div>
          ) : (
            <>
              {/* Thông tin xe */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Car className="w-4 h-4 text-emerald-600" />
                  </div>
                  <h2 className="font-semibold text-gray-900">Thông tin xe</h2>
                  {isLostTicket && (
                    <span className="ml-auto flex items-center gap-1 text-xs font-medium
                                     text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                      <TriangleAlert className="w-3 h-3" /> Mất vé
                    </span>
                  )}
                </div>

                <div className="space-y-0 text-sm divide-y divide-gray-50">
                  {([
                    ['Biển số',   session.vehiclePlate,                                  'font-mono font-bold text-lg'],
                    ['Loại xe',   VEHICLE_LABELS[session.vehicleType],                   ''],
                    ['Slot',      session.slotCode,                                       'font-mono'],
                    ['Giờ vào',   new Date(session.checkInTime).toLocaleString('vi-VN'),  ''],
                    ['Giờ ra',    checkOut.toLocaleString('vi-VN'),                       ''],
                    ['Thời gian', fee ? formatDuration(fee.durationMinutes) : '—',        'font-medium'],
                  ] as [string, string, string][]).map(([label, value, extra]) => (
                    <div key={label} className="flex justify-between items-center py-2">
                      <span className="text-gray-500">{label}</span>
                      <span className={`text-gray-900 ${extra}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Phí */}
              {fee && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-violet-600" />
                    </div>
                    <h2 className="font-semibold text-gray-900">Tính phí</h2>
                    {fee.isPeak && (
                      <span className="ml-auto text-xs font-medium text-orange-700
                                       bg-orange-100 border border-orange-200 px-2 py-0.5 rounded-full">
                        ⚡ Cao điểm
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    {!fee.isOvernight && fee.basePrice > 0 && (
                      <FeeRow label="Phí cơ bản" amount={fee.basePrice} />
                    )}
                    {fee.isOvernight
                      ? <FeeRow label="Phí qua đêm (> 12 giờ)" amount={fee.overnightFee} />
                      : fee.isPeak
                        ? <FeeRow label={`${fee.billableHours.toFixed(2)}h × ${fmt(fee.ratePeak)}/h (cao điểm)`} amount={fee.peakFee} />
                        : <FeeRow label={`${fee.billableHours.toFixed(2)}h × ${fmt(fee.rateNormal)}/h (thường)`} amount={fee.normalFee} />
                    }
                    {fee.surcharge > 0 && <FeeRow label="Phụ thu mất vé" amount={fee.surcharge} warn />}

                    <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                      <span className="font-semibold text-gray-900">Tổng cộng</span>
                      <span className="text-xl font-bold text-blue-600">{fmt(fee.total)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Thanh toán */}
              {!confirmed && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h2 className="font-semibold text-gray-900 mb-3">Phương thức thanh toán</h2>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {PAY_OPTIONS.map(({ val, label, Icon }) => (
                      <button key={val} onClick={() => setPayMethod(val)}
                        className={`py-3 rounded-xl border text-xs font-medium transition-all
                                    flex flex-col items-center gap-1.5 ${
                          payMethod === val
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-200 text-gray-700 hover:border-blue-300'
                        }`}>
                        <Icon className="w-5 h-5" />
                        {label}
                      </button>
                    ))}
                  </div>

                  {payMethod === 'qr' && fee && (
                    <div className="flex flex-col items-center gap-2 py-3 bg-gray-50 rounded-xl mb-4">
                      <QRCodeCanvas value={`PAYMENT:${session.id}:${fee.total}`} size={140} level="M" />
                      <p className="text-xs text-gray-500">Quét bằng app ngân hàng</p>
                      <p className="text-sm font-bold text-blue-600">{fmt(fee.total)}</p>
                    </div>
                  )}

                  <button onClick={handleConfirmPayment} disabled={!payMethod || submitting}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700
                               disabled:opacity-40 disabled:cursor-not-allowed
                               text-white font-semibold flex items-center justify-center gap-2 transition-colors">
                    <CheckCircle className="w-5 h-5" />
                    {submitting ? 'Đang xử lý...' : 'Xác nhận thanh toán & Mở barrier'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {confirmed && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center space-y-2">
                  <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
                  <p className="font-semibold text-emerald-800">Thanh toán thành công!</p>
                  <p className="text-sm text-emerald-600">Barrier đã mở — xe có thể ra</p>
                  <button onClick={handleReset} className="mt-2 text-sm text-emerald-700 underline">
                    Tiếp nhận xe tiếp theo
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showReceipt && session && fee && payMethod && (
        <Receipt session={session} fee={fee} payMethod={payMethod} onClose={() => setShowReceipt(false)} />
      )}
    </PageWrapper>
  )
}

function FeeRow({ label, amount, warn }: { label: string; amount: number; warn?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className={warn ? 'text-amber-600' : 'text-gray-600'}>{label}</span>
      <span className={`font-semibold ${warn ? 'text-amber-700' : 'text-gray-900'}`}>{fmt(amount)}</span>
    </div>
  )
}

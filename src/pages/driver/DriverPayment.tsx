// Kiosk thanh toán cho tài xế — quét QR vé / nhập biển số → tính phí → TT → sinh mã ra cổng
import { useState, useEffect } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import {
  ScanLine, Search, Car, CreditCard, Banknote, QrCode,
  CheckCircle, AlertCircle, RefreshCw, ChevronRight,
  X, Clock, ShieldCheck,
} from 'lucide-react'
import QRScanner from '@/components/staff/QRScanner'
import { useSessionStore } from '@/store/sessionStore'
import { usePaymentStore } from '@/store/paymentStore'
import { useAuthStore } from '@/store/authStore'
import { calculateFee, formatDuration, type FeeBreakdown } from '@/utils/feeCalculator'
import type { ParkingSession, PayMethod } from '@/utils/types'

// ─── Constants ────────────────────────────────────────────────────────────────
const QR_SECS   = 5 * 60   // 5 phút — thời gian hiệu lực mã QR thanh toán
const EXIT_SECS = 15 * 60  // 15 phút — thời gian hiệu lực mã ra cổng

type KioskStep =
  | 'search'       // Đang chờ tra cứu session
  | 'found'        // Đã tìm được session, chọn hình thức TT
  | 'paying_qr'    // Hiển thị QR thanh toán + đếm ngược
  | 'paying_card'  // Chờ xác nhận quẹt thẻ
  | 'paying_cash'  // Chờ xác nhận nộp tiền mặt
  | 'confirmed'    // Đã thanh toán, hiển thị mã ra cổng

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n) + ' ₫'
}

function fmtCD(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function genExitCode() {
  return `EXIT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

const VEHICLE_LABELS: Record<string, string> = {
  motorbike: 'Xe máy',
  car:       'Ô tô',
  truck:     'Xe tải',
}

const PAY_OPTIONS: { val: PayMethod; label: string; icon: React.ElementType; desc: string }[] = [
  { val: 'qr',   label: 'Ví điện tử / QR', icon: QrCode,     desc: 'VNPay · MoMo · ZaloPay' },
  { val: 'card', label: 'Thẻ ngân hàng',   icon: CreditCard, desc: 'Visa · Mastercard · Debit' },
  { val: 'cash', label: 'Tiền mặt',         icon: Banknote,   desc: 'Nộp tiền trực tiếp / quầy nhân viên' },
]

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DriverPayment() {
  const { findByQR, findByPlate, markAsPaid } = useSessionStore()
  const { addPayment }                         = usePaymentStore()
  const { user }                               = useAuthStore()

  // ── Step & search state ───────────────────────────────────────────────────
  const [step,       setStep]       = useState<KioskStep>('search')
  const [scanActive, setScanActive] = useState(true)
  const [plateInput, setPlateInput] = useState('')
  const [lookupErr,  setLookupErr]  = useState('')
  const [session,    setSession]    = useState<ParkingSession | null>(null)
  const [checkOutAt, setCheckOutAt] = useState<Date>(new Date())
  const [fee,        setFee]        = useState<FeeBreakdown | null>(null)
  const [payMethod,  setPayMethod]  = useState<PayMethod | null>(null)

  // ── QR payment countdown ─────────────────────────────────────────────────
  const [qrKey,  setQrKey]  = useState(0)  // tăng để restart interval
  const [qrSecs, setQrSecs] = useState(QR_SECS)
  const [qrExp,  setQrExp]  = useState(false)

  useEffect(() => {
    if (step !== 'paying_qr') return
    const id = setInterval(() => setQrSecs((p) => Math.max(0, p - 1)), 1000)
    return () => clearInterval(id)
  }, [step, qrKey])

  useEffect(() => {
    if (qrSecs === 0 && step === 'paying_qr') setQrExp(true)
  }, [qrSecs, step])

  // ── Exit code countdown ──────────────────────────────────────────────────
  const [exitCode, setExitCode] = useState('')
  const [exitSecs, setExitSecs] = useState(EXIT_SECS)
  const [exitExp,  setExitExp]  = useState(false)

  useEffect(() => {
    if (step !== 'confirmed') return
    const id = setInterval(() => setExitSecs((p) => Math.max(0, p - 1)), 1000)
    return () => clearInterval(id)
  }, [step])

  useEffect(() => {
    if (exitSecs === 0 && step === 'confirmed') setExitExp(true)
  }, [exitSecs, step])

  // ── Handlers ─────────────────────────────────────────────────────────────
  function applySession(found: ParkingSession | undefined) {
    if (!found) {
      setLookupErr('Không tìm thấy phiên đỗ xe đang hoạt động')
      setScanActive(true)
      return
    }
    const now = new Date()
    setSession(found)
    setCheckOutAt(now)
    setFee(calculateFee(found, now))
    setLookupErr('')
    setScanActive(false)
    setStep('found')
  }

  function handleQRScan(text: string) { applySession(findByQR(text)) }

  function handlePlateSearch() {
    if (!plateInput.trim()) return
    applySession(findByPlate(plateInput))
  }

  function handleSelectPayment(method: PayMethod) {
    setPayMethod(method)
    if (method === 'qr') {
      setQrSecs(QR_SECS)
      setQrExp(false)
      setQrKey((k) => k + 1)
      setStep('paying_qr')
    } else {
      setStep(method === 'card' ? 'paying_card' : 'paying_cash')
    }
  }

  function handleConfirmPayment() {
    if (!session || !fee || !payMethod) return
    markAsPaid(session.id, fee.total, user?.id ?? 'kiosk')
    addPayment({
      sessionId:       session.id,
      vehiclePlate:    session.vehiclePlate,
      vehicleType:     session.vehicleType,
      slotCode:        session.slotCode,
      checkInTime:     session.checkInTime,
      checkOutTime:    checkOutAt.toISOString(),
      durationMinutes: fee.durationMinutes,
      fee:             fee.total,
      payMethod,
      staffId:         user?.id   ?? 'kiosk',
      staffName:       user?.name ?? 'Kiosk tự động',
    })
    setExitCode(genExitCode())
    setExitSecs(EXIT_SECS)
    setExitExp(false)
    setStep('confirmed')
  }

  function handleRetryQR() {
    setQrSecs(QR_SECS)
    setQrExp(false)
    setQrKey((k) => k + 1)
  }

  function handleReset() {
    setStep('search'); setScanActive(true); setPlateInput(''); setLookupErr('')
    setSession(null);  setFee(null);        setPayMethod(null)
    setExitCode('');   setExitSecs(EXIT_SECS); setExitExp(false)
    setQrSecs(QR_SECS); setQrExp(false)
  }

  // ── Confirmed — full-width success view ──────────────────────────────────
  if (step === 'confirmed') {
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border-2 border-green-200 shadow-sm overflow-hidden">
          {/* Success header */}
          <div className="bg-green-500 px-5 py-5 text-white text-center">
            <ShieldCheck className="w-12 h-12 mx-auto mb-2" />
            <h2 className="text-xl font-bold">Thanh toán thành công!</h2>
            <p className="text-green-100 text-sm mt-1">
              {session?.vehiclePlate} · Slot {session?.slotCode} · {fmt(fee?.total ?? 0)}
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* Exit countdown */}
            <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${
              exitExp
                ? 'bg-red-50 border border-red-200'
                : 'bg-blue-50 border border-blue-100'
            }`}>
              <div className="flex items-center gap-2">
                <Clock className={`w-5 h-5 ${exitExp ? 'text-red-400' : 'text-blue-400'}`} />
                <span className={`text-sm font-medium ${exitExp ? 'text-red-700' : 'text-blue-700'}`}>
                  {exitExp ? 'Mã ra cổng đã hết hạn — liên hệ nhân viên' : 'Mã còn hiệu lực'}
                </span>
              </div>
              {!exitExp && (
                <span className="font-mono font-bold text-xl text-blue-700">
                  {fmtCD(exitSecs)}
                </span>
              )}
            </div>

            {/* Exit QR code */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-semibold text-gray-700">
                Mã ra cổng — quét hoặc xuất trình tại barrier
              </p>
              <div className={`bg-white p-4 rounded-2xl shadow-inner border border-gray-100 transition-opacity ${exitExp ? 'opacity-25' : ''}`}>
                <QRCodeCanvas
                  value={`PARKINGOS:EXIT:${exitCode}`}
                  size={220}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div className="text-center">
                <p className={`font-mono font-bold text-2xl tracking-widest ${exitExp ? 'text-gray-300' : 'text-gray-800'}`}>
                  {exitCode}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Nhập thủ công nếu quét không được
                </p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
            >
              Thanh toán mới
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── 2-column kiosk layout ─────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-800">Kiosk Thanh toán</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Quét mã QR vé hoặc nhập biển số để thanh toán phí đỗ xe
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ══ CỘT TRÁI — Tra cứu session ══════════════════════════════════ */}
        <div className="space-y-4">

          {/* QR Scanner */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <ScanLine className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-800">Quét mã QR trên vé</h3>
              {session && (
                <button
                  onClick={handleReset}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Bắt đầu lại
                </button>
              )}
            </div>

            {session ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-700">Đã tìm thấy phiên đỗ xe</p>
                  <p className="text-xs text-green-600 font-mono">
                    {session.vehiclePlate} · Slot {session.slotCode}
                  </p>
                </div>
              </div>
            ) : (
              <QRScanner onScan={handleQRScan} active={scanActive} />
            )}
          </div>

          {/* Plate input */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                <Search className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="font-semibold text-gray-800">Nhập biển số thủ công</h3>
            </div>

            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono uppercase
                           focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
                placeholder="VD: 51B-23456"
                value={plateInput}
                onChange={(e) => { setPlateInput(e.target.value.toUpperCase()); setLookupErr('') }}
                onKeyDown={(e) => e.key === 'Enter' && handlePlateSearch()}
                disabled={!!session}
              />
              <button
                onClick={handlePlateSearch}
                disabled={!!session || !plateInput.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                Tra cứu
              </button>
            </div>

            {lookupErr && (
              <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {lookupErr}
              </div>
            )}
          </div>
        </div>

        {/* ══ CỘT PHẢI — Session + Payment ════════════════════════════════ */}
        <div className="space-y-4">

          {/* Empty state */}
          {step === 'search' && (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-14 text-center text-gray-400 h-full flex flex-col items-center justify-center gap-3">
              <Car className="w-14 h-14 opacity-15" />
              <p className="text-sm">Quét QR vé hoặc nhập biển số<br />để xem thông tin và thanh toán</p>
            </div>
          )}

          {/* Session found → chọn hình thức TT */}
          {step === 'found' && session && fee && (
            <>
              {/* Session info + fee */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Car className="w-4 h-4 text-blue-500" />
                  <h3 className="font-semibold text-gray-800">Thông tin đỗ xe</h3>
                </div>

                <dl className="space-y-0 divide-y divide-gray-50 text-sm">
                  {([
                    ['Biển số',      session.vehiclePlate,                                      'font-mono font-bold text-base'],
                    ['Loại xe',      VEHICLE_LABELS[session.vehicleType] ?? session.vehicleType, ''],
                    ['Slot',         session.slotCode,                                           'font-mono'],
                    ['Giờ vào',      new Date(session.checkInTime).toLocaleString('vi-VN'),       ''],
                    ['Thời gian đỗ', formatDuration(fee.durationMinutes),                        'font-medium'],
                  ] as [string, string, string][]).map(([label, val, extra]) => (
                    <div key={label} className="flex justify-between items-center py-2">
                      <dt className="text-gray-500">{label}</dt>
                      <dd className={`text-gray-900 ${extra}`}>{val}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-3 border-t pt-3 flex justify-between items-center">
                  <span className="font-bold text-gray-800">Tổng phí</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-blue-600">{fmt(fee.total)}</span>
                    {fee.isPeak && (
                      <p className="text-xs text-orange-500">⚡ Giờ cao điểm</p>
                    )}
                    {fee.isOvernight && (
                      <p className="text-xs text-indigo-500">🌙 Qua đêm</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment method selection */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <h3 className="font-semibold text-gray-800 mb-3">Chọn hình thức thanh toán</h3>
                <div className="space-y-2">
                  {PAY_OPTIONS.map(({ val, label, icon: Icon, desc }) => (
                    <button
                      key={val}
                      onClick={() => handleSelectPayment(val)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
                        <Icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* QR payment + countdown */}
          {step === 'paying_qr' && fee && session && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Thanh toán QR</h3>
                <button
                  onClick={() => setStep('found')}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Đổi phương thức
                </button>
              </div>

              {/* Countdown bar */}
              <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl ${
                qrExp ? 'bg-red-50 border border-red-200' : 'bg-blue-50'
              }`}>
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${qrExp ? 'text-red-400' : 'text-blue-400'}`} />
                  <span className={`text-sm font-medium ${qrExp ? 'text-red-700' : 'text-blue-600'}`}>
                    {qrExp ? 'Mã QR đã hết hạn' : 'Mã QR hết hạn sau'}
                  </span>
                </div>
                {qrExp ? (
                  <button
                    onClick={handleRetryQR}
                    className="flex items-center gap-1 text-sm text-red-600 font-semibold hover:underline"
                  >
                    <RefreshCw className="w-4 h-4" /> Tạo lại
                  </button>
                ) : (
                  <span className="font-mono font-bold text-blue-700">{fmtCD(qrSecs)}</span>
                )}
              </div>

              {/* Payment QR */}
              <div className={`flex flex-col items-center gap-3 transition-opacity ${qrExp ? 'opacity-25 pointer-events-none' : ''}`}>
                <p className="text-xs text-gray-500">Quét bằng app ngân hàng hoặc ví điện tử</p>
                <div className="bg-white p-3 rounded-2xl shadow-inner border border-gray-100">
                  <QRCodeCanvas
                    value={`PARKINGOS:PAY:${session.id}:${fee.total}:${qrKey}`}
                    size={200}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <p className="text-xl font-bold text-blue-600">{fmt(fee.total)}</p>
                <div className="flex gap-2 flex-wrap justify-center">
                  {['VNPay', 'MoMo', 'ZaloPay', 'Agribank', 'VCB'].map((p) => (
                    <span key={p} className="text-xs px-2.5 py-1 bg-gray-100 rounded-full text-gray-500">{p}</span>
                  ))}
                </div>
              </div>

              <button
                onClick={handleConfirmPayment}
                disabled={qrExp}
                className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Xác nhận đã thanh toán
              </button>
            </div>
          )}

          {/* Card payment */}
          {step === 'paying_card' && fee && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Thanh toán thẻ NH</h3>
                <button onClick={() => setStep('found')} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <X className="w-3.5 h-3.5" /> Đổi phương thức
                </button>
              </div>
              <div className="flex items-start gap-4 bg-violet-50 border border-violet-200 rounded-xl p-4">
                <CreditCard className="w-10 h-10 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-violet-800">Cắm hoặc chạm thẻ vào máy POS</p>
                  <p className="text-sm text-violet-600 mt-1">
                    Số tiền cần thanh toán:{' '}
                    <span className="font-bold">{fmt(fee.total)}</span>
                  </p>
                  <p className="text-xs text-violet-400 mt-2">Visa · Mastercard · ATM nội địa</p>
                </div>
              </div>
              <button
                onClick={handleConfirmPayment}
                className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Xác nhận đã quẹt thẻ
              </button>
            </div>
          )}

          {/* Cash payment */}
          {step === 'paying_cash' && fee && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Thanh toán tiền mặt</h3>
                <button onClick={() => setStep('found')} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <X className="w-3.5 h-3.5" /> Đổi phương thức
                </button>
              </div>
              <div className="flex items-start gap-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <Banknote className="w-10 h-10 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-800">Nộp tiền vào ngăn thu tiền</p>
                  <p className="text-sm text-emerald-600 mt-1">
                    Số tiền cần nộp:{' '}
                    <span className="font-bold">{fmt(fee.total)}</span>
                  </p>
                  <p className="text-xs text-emerald-400 mt-2">
                    Hoặc đến quầy nhân viên nếu cần hỗ trợ đổi tiền
                  </p>
                </div>
              </div>
              <button
                onClick={handleConfirmPayment}
                className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Xác nhận đã thanh toán
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

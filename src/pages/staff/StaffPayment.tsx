// Trang thu phí & quản lý thanh toán — 2 tab: Thu phí nhanh + Lịch sử ca
import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { QRCodeCanvas } from 'qrcode.react'
import {
  CreditCard, Banknote, QrCode, Search, CheckCircle,
  Car, Clock, Receipt as ReceiptIcon, Download,
  ChevronRight, AlertCircle, X, Wallet, Loader2,
} from 'lucide-react'
import Receipt from '@/components/staff/Receipt'
import { useSessionStore } from '@/store/sessionStore'
import { usePaymentStore } from '@/store/paymentStore'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'
import { createCashPayment, createVnpayPaymentUrl } from '@/api/paymentsApi'
import { getSocket } from '@/lib/socket'
import { calculateFee, formatDuration, LOST_TICKET_SURCHARGE } from '@/utils/feeCalculator'
import type { FeeBreakdown } from '@/utils/feeCalculator'
import type { ParkingSession, PayMethod } from '@/utils/types'

type TabId = 'quick' | 'history'
type HistoryFilter = 'all' | PayMethod

// 🐞 SỬA: làm tròn về số nguyên trước khi format — VND không có phần thập phân
function fmt(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫'
}

const VEHICLE_LABELS: Record<string, string> = {
  motorbike: 'Xe máy',
  car:       'Ô tô',
  bicycle:   'Xe đạp',
}

const PAY_OPTIONS: { val: PayMethod; label: string; icon: React.ElementType; color: string }[] = [
  { val: 'cash', label: 'Tiền mặt',     icon: Banknote,    color: 'emerald' },
  { val: 'qr',   label: 'QR Code',      icon: QrCode,      color: 'blue'    },
  { val: 'card', label: 'Thẻ NH',       icon: CreditCard,  color: 'violet'  },
]

const PAY_LABELS: Record<PayMethod, string> = {
  cash: 'Tiền mặt',
  qr:   'QR Code',
  card: 'Thẻ ngân hàng',
}

const COLOR_MAP: Record<string, string> = {
  emerald: 'bg-emerald-600 border-emerald-600 text-white',
  blue:    'bg-blue-600 border-blue-600 text-white',
  violet:  'bg-violet-600 border-violet-600 text-white',
}

export default function StaffPayment() {
  const { findByPlate, findByQR, findById, markAsPaid } = useSessionStore()
  const { payments, addPayment, getShiftTotal }                   = usePaymentStore()
  const { user } = useAuthStore()

  const [activeTab, setActiveTab] = useState<TabId>('quick')

  // --- Tab 1: Thu phí nhanh ---
  const [searchInput,  setSearchInput]  = useState('')
  const [searchDone,   setSearchDone]   = useState(false)
  const [searchErr,    setSearchErr]    = useState('')
  const [session,      setSession]      = useState<ParkingSession | null>(null)
  const [checkOutTime, setCheckOutTime] = useState<Date>(new Date())
  const [fee,          setFee]          = useState<FeeBreakdown | null>(null)
  const [isLostTicket, setIsLostTicket] = useState(false)
  const [payMethod,    setPayMethod]    = useState<PayMethod | null>(null)
  const [cashGiven,    setCashGiven]    = useState('')
  const [confirmed,    setConfirmed]    = useState(false)
  const [showReceipt,  setShowReceipt]  = useState(false)
  const [lastReceiptNo, setLastReceiptNo] = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [submitErr,    setSubmitErr]    = useState('')

  // QR thật qua VNPay — thay cho mã QR giả trước đây. createVnpayPaymentUrl trả về
  // link thanh toán thật, mã hoá thành QR cho khách quét bằng app ngân hàng/VNPay.
  // Khi khách quét & thanh toán xong, VNPay gọi IPN về BE, BE bắn socket event
  // `payment:success` — FE nghe event này để tự động hoàn tất, KHÔNG cần staff bấm xác nhận.
  const [qrLoading, setQrLoading] = useState(false)
  const [qrUrl,     setQrUrl]     = useState('')

  // --- Tab 2: Lịch sử ---
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')

  // --- Search logic ---
  function handleSearch() {
    const raw = searchInput.trim()
    if (!raw) return

    const now = new Date()
    // Thử tìm theo biển số → QR code → session ID
    const found =
      findByPlate(raw) ??
      findByQR(raw) ??
      (() => {
        const s = findById(raw)
        return s?.status === 'active' ? s : undefined
      })()

    if (!found) {
      setSearchErr('Không tìm thấy phiên đỗ xe đang hoạt động cho "' + raw + '"')
      setSession(null)
      setSearchDone(true)
      return
    }
    setSession(found)
    setCheckOutTime(now)
    setFee(calculateFee(found, now, isLostTicket))
    setSearchErr('')
    setSearchDone(true)
    setConfirmed(false)
    setPayMethod(null)
    setCashGiven('')
  }

  function handleLostTicketChange(checked: boolean) {
    setIsLostTicket(checked)
    if (session) setFee(calculateFee(session, checkOutTime, checked))
  }

  function handleReset() {
    setSearchInput(''); setSearchDone(false); setSearchErr('')
    setSession(null);   setFee(null);         setPayMethod(null)
    setCashGiven('');   setConfirmed(false);  setShowReceipt(false)
    setIsLostTicket(false)
    setQrUrl('');       setQrLoading(false);  setSubmitErr('')
  }

  // Ghi nhận cục bộ sau khi BE xác nhận thanh toán thành công — dùng cho hóa đơn
  // & báo cáo ca (paymentStore vẫn chỉ là state UI trong ca, không phải nguồn sự thật).
  function finalizeLocalPayment(method: PayMethod) {
    if (!session || !fee) return
    markAsPaid(session.id, fee.total, user?.id ?? 'staff')
    addPayment({
      sessionId:       session.id,
      vehiclePlate:    session.vehiclePlate,
      vehicleType:     session.vehicleType,
      slotCode:        session.slotCode,
      checkInTime:     session.checkInTime,
      checkOutTime:    checkOutTime.toISOString(),
      durationMinutes: fee.durationMinutes,
      fee:             fee.total,
      payMethod:       method,
      staffId:         user?.id   ?? 'staff',
      staffName:       user?.name ?? 'Nhân viên',
    })
    setConfirmed(true)
    toast.success('Thanh toán thành công — Barrier đã mở')
    setTimeout(() => {
      const latest = usePaymentStore.getState().payments[0]
      setLastReceiptNo(latest?.receiptNo ?? '')
      setShowReceipt(true)
    }, 600)
  }

  // --- Confirm payment (tiền mặt / thẻ — staff xác nhận trực tiếp) ---
  // Gọi BE thật: POST /api/payments — BE đóng phiên (status COMPLETED), giải phóng
  // slot và bắn socket `payment:success`. Lưu ý: nghĩa là với luồng tiền mặt/thẻ,
  // slot được giải phóng ngay khi thu phí (không đợi xe ra cổng) — đúng theo service
  // hiện tại của BE; nếu nhóm muốn "thu phí xong xe vẫn đỗ tới khi ra cổng mới giải
  // phóng slot" thì cần BE thêm trạng thái riêng, ngoài phạm vi sửa của FE.
  async function handleConfirm() {
    if (!session || !fee || !payMethod) return
    if (payMethod === 'qr') return // QR tự hoàn tất qua socket khi VNPay báo về, không cần bấm

    const cashNum = payMethod === 'cash' ? parseFloat(cashGiven.replace(/[^\d]/g, '')) : undefined
    if (payMethod === 'cash' && (isNaN(cashNum!) || cashNum! < fee.total)) return

    setSubmitting(true)
    setSubmitErr('')
    try {
      await createCashPayment(session.id, fee.total, payMethod === 'cash' ? 'CASH' : 'CARD')
      finalizeLocalPayment(payMethod)
    } catch (err: any) {
      console.error('Lỗi xác nhận thanh toán:', err)
      setSubmitErr(err?.response?.data?.message ?? 'Không thể xác nhận thanh toán, vui lòng thử lại')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Luồng QR: tạo URL VNPay thật khi staff chọn "QR Code" ---
  useEffect(() => {
    if (payMethod !== 'qr' || !session || !fee) return
    setQrLoading(true)
    setQrUrl('')
    createVnpayPaymentUrl(session.id, fee.total)
      .then(setQrUrl)
      .catch((err) => {
        console.error('Lỗi tạo URL thanh toán VNPay:', err)
        setSubmitErr('Không tạo được mã QR thanh toán, vui lòng thử phương thức khác')
      })
      .finally(() => setQrLoading(false))
  }, [payMethod, session, fee])

  // --- Nghe socket `payment:success` để tự xác nhận khi khách quét QR thanh toán xong ---
  const confirmedRef = useRef(confirmed)
  confirmedRef.current = confirmed
  useEffect(() => {
    if (payMethod !== 'qr' || !session) return
    const socket = getSocket()
    function onPaymentSuccess(payload: { sessionId: string }) {
      if (payload?.sessionId === session!.id && !confirmedRef.current) {
        finalizeLocalPayment('qr')
      }
    }
    socket.on('payment:success', onPaymentSuccess)
    return () => { socket.off('payment:success', onPaymentSuccess) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payMethod, session])

  // --- Cash validation ---
  const cashNum = parseFloat(cashGiven.replace(/[^\d]/g, '')) || 0
  const change  = cashNum - (fee?.total ?? 0)
  const cashOk  = payMethod !== 'cash' || cashNum >= (fee?.total ?? 0)

  // --- History ---
  const filteredPayments = historyFilter === 'all'
    ? payments
    : payments.filter((p) => p.payMethod === historyFilter)

  function exportExcel() {
    const rows = filteredPayments.map((p, i) => ({
      'STT':              i + 1,
      'Số HĐ':           p.receiptNo,
      'Biển số':         p.vehiclePlate,
      'Loại xe':         VEHICLE_LABELS[p.vehicleType] ?? p.vehicleType,
      'Slot':            p.slotCode,
      'Giờ vào':         new Date(p.checkInTime).toLocaleString('vi-VN'),
      'Giờ thu phí':     new Date(p.paidAt).toLocaleString('vi-VN'),
      'Thời gian đỗ':    formatDuration(p.durationMinutes),
      'Số tiền (₫)':    p.fee,
      'Hình thức TT':    PAY_LABELS[p.payMethod],
      'Nhân viên':       p.staffName,
    }))

    // Thêm dòng tổng kết
    rows.push({
      'STT':           '' as unknown as number,
      'Số HĐ':        'TỔNG',
      'Biển số':       '',
      'Loại xe':       '',
      'Slot':          '',
      'Giờ vào':       '',
      'Giờ thu phí':   '',
      'Thời gian đỗ':  `${filteredPayments.length} giao dịch`,
      'Số tiền (₫)':  filteredPayments.reduce((s, p) => s + p.fee, 0),
      'Hình thức TT':  '',
      'Nhân viên':     '',
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 5 }, { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 7 },
      { wch: 18 }, { wch: 18 }, { wch: 13 }, { wch: 14 }, { wch: 15 }, { wch: 14 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Lịch sử thu phí')
    XLSX.writeFile(wb, `bao-cao-ca-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-800">Thu phí &amp; Quản lý thanh toán</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Thu phí độc lập với luồng xe ra — session chuyển sang trạng thái <span className="font-mono text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">PAID</span> sau khi xác nhận
        </p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { id: 'quick',   label: 'Thu phí nhanh',     icon: Wallet     },
          { id: 'history', label: 'Lịch sử ca này',    icon: ReceiptIcon },
        ] as { id: TabId; label: string; icon: React.ElementType }[]).map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.id
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {t.id === 'history' && payments.length > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                  {payments.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab 1 — Thu phí nhanh */}
      {activeTab === 'quick' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cột trái — tìm kiếm & phương thức TT */}
          <div className="space-y-4">
            {/* Search card */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Search className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-800">Tìm phiên đỗ xe</h3>
                {session && (
                  <button
                    onClick={handleReset}
                    className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Đặt lại
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
                  placeholder="Biển số, mã QR hoặc session ID"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value.toUpperCase())
                    setSearchDone(false)
                    setSearchErr('')
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  disabled={!!session}
                />
                <button
                  onClick={handleSearch}
                  disabled={!searchInput.trim() || !!session}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                >
                  <Search className="w-4 h-4" /> Tra cứu
                </button>
              </div>

              {/* Mất vé */}
              <label className="mt-3 flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={isLostTicket}
                  onChange={(e) => handleLostTicketChange(e.target.checked)}
                  disabled={!!session}
                  className="w-4 h-4 rounded accent-amber-500"
                />
                <span className="text-sm text-gray-600 group-hover:text-gray-800">
                  Mất vé — phụ thu thêm{' '}
                  <span className="font-semibold text-amber-600">{fmt(LOST_TICKET_SURCHARGE)}</span>
                </span>
              </label>

              {searchErr && (
                <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {searchErr}
                </div>
              )}
            </div>

            {/* Phương thức thanh toán — chỉ hiện khi có session */}
            {session && fee && !confirmed && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                <h3 className="font-semibold text-gray-800">Phương thức thanh toán</h3>

                <div className="grid grid-cols-3 gap-2">
                  {PAY_OPTIONS.map(({ val, label, icon: Icon, color }) => (
                    <button
                      key={val}
                      onClick={() => { setPayMethod(val); setCashGiven('') }}
                      className={`py-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                        payMethod === val
                          ? COLOR_MAP[color]
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Cash: input khách đưa */}
                {payMethod === 'cash' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Khách đưa (₫)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="Nhập số tiền khách đưa..."
                      value={cashGiven}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^\d]/g, '')
                        setCashGiven(digits ? parseInt(digits).toLocaleString('vi-VN') : '')
                      }}
                    />
                    {cashNum > 0 && (
                      <div className={`flex justify-between text-sm px-3 py-2 rounded-lg ${change >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        <span>{change >= 0 ? 'Tiền thối' : 'Còn thiếu'}</span>
                        <span className="font-bold">{fmt(Math.abs(change))}</span>
                      </div>
                    )}
                    {cashNum > 0 && change < 0 && (
                      <p className="text-xs text-red-500">Số tiền chưa đủ</p>
                    )}
                  </div>
                )}

                {/* QR: mã QR thanh toán VNPay thật — tự hoàn tất qua socket payment:success */}
                {payMethod === 'qr' && (
                  <div className="flex flex-col items-center gap-2 py-4 bg-gray-50 rounded-xl">
                    {qrLoading ? (
                      <div className="flex flex-col items-center gap-2 py-6 text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <p className="text-xs">Đang tạo mã QR thanh toán...</p>
                      </div>
                    ) : qrUrl ? (
                      <>
                        <QRCodeCanvas value={qrUrl} size={140} level="M" includeMargin />
                        <p className="text-xs text-gray-500">Quét bằng app ngân hàng / VNPay</p>
                        <p className="text-base font-bold text-blue-600">{fmt(fee.total)}</p>
                        <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Đang chờ khách thanh toán...
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-red-500">Không tạo được mã QR</p>
                    )}
                  </div>
                )}

                {/* Card: thông báo đơn giản */}
                {payMethod === 'card' && (
                  <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl p-3">
                    <CreditCard className="w-8 h-8 text-violet-400 shrink-0" />
                    <p className="text-sm text-violet-700">
                      Yêu cầu khách quẹt thẻ vào máy POS, sau đó xác nhận bên dưới.
                    </p>
                  </div>
                )}

                {submitErr && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {submitErr}
                  </div>
                )}

                {/* Nút xác nhận — QR tự hoàn tất qua socket, không cần bấm */}
                {payMethod !== 'qr' && (
                  <button
                    onClick={handleConfirm}
                    disabled={!payMethod || !cashOk || submitting}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                    {submitting ? 'Đang xác nhận...' :
                     payMethod === 'cash'  ? 'Xác nhận thu tiền mặt' :
                     payMethod === 'card'  ? 'Xác nhận đã quẹt thẻ' :
                     'Xác nhận thanh toán'}
                    {!submitting && <ChevronRight className="w-4 h-4" />}
                  </button>
                )}
              </div>
            )}

            {/* Đã thanh toán */}
            {confirmed && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-2">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
                <p className="font-semibold text-emerald-700 text-lg">Đã thu phí thành công!</p>
                <p className="text-emerald-600 text-sm">
                  Session chuyển sang trạng thái{' '}
                  <span className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded">PAID</span>
                  {' '}— xe có thể ra khi được xác nhận tại cổng
                </p>
                <div className="flex gap-2 justify-center mt-4">
                  <button
                    onClick={() => setShowReceipt(true)}
                    className="text-sm text-emerald-700 border border-emerald-300 rounded-lg px-3 py-1.5 hover:bg-emerald-100 transition-colors"
                  >
                    Xem lại hóa đơn
                  </button>
                  <button
                    onClick={handleReset}
                    className="text-sm text-emerald-700 underline"
                  >
                    Thu phí xe tiếp theo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Cột phải — thông tin session & breakdown phí */}
          <div className="space-y-4">
            {!searchDone && !session && (
              <div className="bg-white border border-dashed border-gray-300 rounded-xl p-14 text-center text-gray-400">
                <Car className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Nhập biển số hoặc mã session để tra cứu</p>
              </div>
            )}

            {searchDone && !session && (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="font-medium text-gray-600">Không tìm thấy phiên đỗ xe</p>
              </div>
            )}

            {session && fee && (
              <>
                {/* Card thông tin session */}
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <Car className="w-4 h-4 text-emerald-600" />
                    </div>
                    <h3 className="font-semibold text-gray-800">Thông tin xe</h3>
                    <span className="ml-auto font-mono text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                      {session.status === 'paid' ? '✓ PAID' : 'ACTIVE'}
                    </span>
                  </div>

                  <dl className="space-y-0 divide-y divide-gray-50 text-sm">
                    {([
                      ['Biển số',     session.vehiclePlate,                                   'font-mono font-bold text-lg'],
                      ['Loại xe',     VEHICLE_LABELS[session.vehicleType] ?? session.vehicleType, ''],
                      ['Slot',        session.slotCode,                                          'font-mono'],
                      ['Giờ vào',     new Date(session.checkInTime).toLocaleString('vi-VN'),      ''],
                      ['Giờ tra cứu', checkOutTime.toLocaleString('vi-VN'),                       ''],
                      ['Thời gian đỗ', formatDuration(fee.durationMinutes),                      'font-medium'],
                    ] as [string, string, string][]).map(([label, value, extra]) => (
                      <div key={label} className="flex justify-between items-center py-2">
                        <dt className="text-gray-500">{label}</dt>
                        <dd className={`text-gray-900 ${extra}`}>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {/* Breakdown phí chi tiết */}
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
                      <Clock className="w-4 h-4 text-violet-600" />
                    </div>
                    <h3 className="font-semibold text-gray-800">Chi tiết phí</h3>
                    {fee.isPeak && (
                      <span className="ml-auto text-xs font-medium text-orange-700 bg-orange-100 border border-orange-200 px-2 py-0.5 rounded-full">
                        ⚡ Cao điểm
                      </span>
                    )}
                    {fee.isOvernight && (
                      <span className="ml-auto text-xs font-medium text-indigo-700 bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-full">
                        🌙 Qua đêm
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    {/* Dòng phí chính */}
                    {!fee.isOvernight && fee.basePrice > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Phí cơ bản</span>
                        <span className="font-semibold">{fmt(fee.basePrice)}</span>
                      </div>
                    )}
                    {fee.isOvernight ? (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Phí qua đêm (&gt; 12h)</span>
                        <span className="font-semibold">{fmt(fee.overnightFee)}</span>
                      </div>
                    ) : fee.isPeak ? (
                      <>
                        <div className="flex justify-between items-start">
                          <span className="text-gray-500">
                            {fee.billableHours.toFixed(2)}h × {fmt(fee.ratePeak)}/h
                            <br />
                            <span className="text-xs text-orange-500">Giờ cao điểm</span>
                          </span>
                          <span className="font-semibold">{fmt(fee.peakFee)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between items-start">
                        <span className="text-gray-500">
                          {fee.billableHours.toFixed(2)}h × {fmt(fee.rateNormal)}/h
                          <br />
                          <span className="text-xs text-gray-400">Giờ thường</span>
                        </span>
                        <span className="font-semibold">{fmt(fee.normalFee)}</span>
                      </div>
                    )}

                    {/* Phụ thu */}
                    {fee.surcharge > 0 && (
                      <div className="flex justify-between items-center text-amber-600">
                        <span>Phụ thu mất vé</span>
                        <span className="font-semibold">+ {fmt(fee.surcharge)}</span>
                      </div>
                    )}

                    {/* Tổng */}
                    <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                      <span className="font-bold text-gray-900">Tổng cộng</span>
                      <span className="text-2xl font-bold text-blue-600">{fmt(fee.total)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 2 — Lịch sử ca này */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Tổng kết + filter + export */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-3">
              <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-center min-w-28">
                <p className="text-2xl font-bold text-gray-800">{payments.length}</p>
                <p className="text-xs text-gray-500">Giao dịch</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-center min-w-36">
                <p className="text-2xl font-bold text-blue-600">{fmt(getShiftTotal())}</p>
                <p className="text-xs text-gray-500">Doanh thu ca</p>
              </div>
            </div>

            <div className="flex gap-2">
              {/* Filter */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {([
                  { val: 'all',  label: 'Tất cả' },
                  { val: 'cash', label: 'Tiền mặt' },
                  { val: 'qr',   label: 'QR' },
                  { val: 'card', label: 'Thẻ' },
                ] as { val: HistoryFilter; label: string }[]).map((f) => (
                  <button
                    key={f.val}
                    onClick={() => setHistoryFilter(f.val)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      historyFilter === f.val
                        ? 'bg-white shadow text-gray-800'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Export */}
              <button
                onClick={exportExcel}
                disabled={filteredPayments.length === 0}
                className="flex items-center gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Xuất Excel
              </button>
            </div>
          </div>

          {/* Bảng lịch sử */}
          {filteredPayments.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
              <ReceiptIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Chưa có giao dịch nào trong ca này</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['STT', 'Biển số', 'Loại xe', 'Thời gian đỗ', 'Số tiền', 'Hình thức TT', 'Giờ thu', 'Số HĐ'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredPayments.map((p, i) => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-gray-800">{p.vehiclePlate}</td>
                        <td className="px-4 py-3 text-gray-600">{VEHICLE_LABELS[p.vehicleType] ?? p.vehicleType}</td>
                        <td className="px-4 py-3 text-gray-600">{formatDuration(p.durationMinutes)}</td>
                        <td className="px-4 py-3 font-semibold text-blue-600">{fmt(p.fee)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                            p.payMethod === 'cash' ? 'bg-emerald-100 text-emerald-700' :
                            p.payMethod === 'qr'   ? 'bg-blue-100 text-blue-700' :
                            'bg-violet-100 text-violet-700'
                          }`}>
                            {p.payMethod === 'cash' ? '💵' : p.payMethod === 'qr' ? '📱' : '💳'}
                            {PAY_LABELS[p.payMethod]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {new Date(p.paidAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{p.receiptNo}</td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Tổng kết cuối bảng */}
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 font-semibold text-gray-700">
                        Tổng: {filteredPayments.length} giao dịch
                      </td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 font-bold text-blue-700 text-base">
                        {fmt(filteredPayments.reduce((s, p) => s + p.fee, 0))}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Receipt modal */}
      {showReceipt && session && fee && payMethod && (
        <Receipt
          session={session}
          fee={fee}
          payMethod={payMethod}
          cashGiven={payMethod === 'cash' ? cashNum : undefined}
          receiptNo={lastReceiptNo || undefined}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  )
}

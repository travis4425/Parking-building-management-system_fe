// Trang xe ra & thu phí — gộp CheckOut + StaffPayment thành một luồng thống nhất:
// QR scan / tra biển số → tính phí → thu tiền → mở barrier → ghi lịch sử ca
import { useState, useEffect, useRef, type ComponentType } from 'react'
import * as XLSX from 'xlsx'
import { QRCodeCanvas } from 'qrcode.react'
import {
  ScanLine, Search, AlertCircle, CheckCircle, Car,
  Clock, CreditCard, Banknote, QrCode, X,
  ChevronRight, TriangleAlert, Receipt as ReceiptIcon,
  Download, Wallet, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import PageWrapper from '@/components/layout/PageWrapper'
import QRScanner from '@/components/staff/QRScanner'
import Receipt from '@/components/staff/Receipt'
import { BarrierGate } from '@/components/iot/BarrierStatus'
import { decodeToken } from '@/utils/qrToken'
import { useSessionStore } from '@/store/sessionStore'
import { fetchSessionById, fetchActiveSessionByPlate } from '@/api/sessionsApi'
import { useSlotStore } from '@/store/slotStore'
import { usePaymentStore } from '@/store/paymentStore'
import { useAuthStore } from '@/store/authStore'
import { createCashPayment, createVnpayPaymentUrl } from '@/api/paymentsApi'
import { getSocket } from '@/lib/socket'
import { calculateFee, formatDuration, LOST_TICKET_SURCHARGE, type FeeBreakdown } from '@/utils/feeCalculator'
import type { ParkingSession, PayMethod } from '@/utils/types'

type TabId = 'checkout' | 'history'
type HistoryFilter = 'all' | PayMethod

const VEHICLE_LABELS: Record<string, string> = {
  motorbike: 'Xe máy', car: 'Ô tô', bicycle: 'Xe đạp',
}

function fmt(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫'
}

const PAY_OPTIONS: { val: PayMethod; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { val: 'cash', label: 'Tiền mặt', Icon: Banknote   },
  { val: 'qr',   label: 'QR Code',  Icon: QrCode     },
  { val: 'card', label: 'Thẻ NH',   Icon: CreditCard },
]

const PAY_LABELS: Record<PayMethod, string> = {
  cash: 'Tiền mặt', qr: 'QR Code', card: 'Thẻ ngân hàng',
}

export default function CheckOut() {
  const sessions        = useSessionStore((s) => s.sessions)
  const findByQR        = useSessionStore((s) => s.findByQR)
  const findByPlate     = useSessionStore((s) => s.findByPlate)
  const checkOutSession = useSessionStore((s) => s.checkOutSession)
  const markAsPaid      = useSessionStore((s) => s.markAsPaid)
  const updateSlot      = useSlotStore((s) => s.updateSlotStatus)
  const { payments, addPayment, getShiftTotal } = usePaymentStore()
  const { user } = useAuthStore()

  const [activeTab, setActiveTab] = useState<TabId>('checkout')

  // --- Tra cứu ---
  const [scanActive,   setScanActive]   = useState(true)
  const [plateInput,   setPlateInput]   = useState('')
  const [isLostTicket, setLostTicket]   = useState(false)
  const [lookupErr,    setLookupErr]    = useState('')

  // --- Session / phí ---
  const [session,  setSession]  = useState<ParkingSession | null>(null)
  const [checkOut, setCheckOut] = useState<Date>(new Date())
  const [fee,      setFee]      = useState<FeeBreakdown | null>(null)

  // --- Thanh toán ---
  const [payMethod,     setPayMethod]     = useState<PayMethod | null>(null)
  const [cashGiven,     setCashGiven]     = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [barrierOpen,   setBarrierOpen]   = useState(false)
  const [showReceipt,   setShowReceipt]   = useState(false)
  const [confirmed,     setConfirmed]     = useState(false)
  const [lastReceiptNo, setLastReceiptNo] = useState('')

  // --- VNPay QR ---
  const [qrLoading, setQrLoading] = useState(false)
  const [qrUrl,     setQrUrl]     = useState('')

  // --- Lịch sử ca ---
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')

  // ── Áp session vừa tra được ──────────────────────────────────────────────
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

  // ── Quét mã QR vé ────────────────────────────────────────────────────────
  async function handleQRScan(text: string) {
    setScanActive(false)
    const decoded = decodeToken(text)

    if (decoded.ok) {
      // 1. Local store trước (nhanh)
      let sess = sessions.find((s) => s.id === decoded.sessionId && s.status === 'active')
      // 2. Không có → fetch BE
      if (!sess) {
        try {
          const remote = await fetchSessionById(decoded.sessionId)
          // Chấp nhận cả PAYMENT_PENDING — có thể checkOutSession đã gọi nhưng payment chưa xong
          if (remote.status !== 'active' && remote.status !== 'payment_pending') {
            toast.error('Phiên đỗ xe này đã kết thúc')
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
      // Thử UUID thuần (staff nhập tay)
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (UUID_RE.test(text.trim())) {
        try {
          const remote = await fetchSessionById(text.trim().toLowerCase())
          if (remote.status === 'active' || remote.status === 'payment_pending') {
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

  // ── Tra cứu biển số ───────────────────────────────────────────────────────
  async function handlePlateSearch() {
    if (!plateInput.trim()) return
    const local = findByPlate(plateInput)
    if (local) { applySession(local, isLostTicket); return }
    try {
      const remote = await fetchActiveSessionByPlate(plateInput)
      applySession(remote ?? undefined, isLostTicket)
    } catch {
      setLookupErr('Không tìm thấy phiên đỗ xe đang hoạt động.')
      toast.error('Không tìm thấy lượt gửi xe với biển số này')
    }
  }

  // ── Ghi nhận vào lịch sử ca ──────────────────────────────────────────────
  function recordToShift(method: PayMethod, amount: number) {
    if (!session || !fee) return
    markAsPaid(session.id, amount, user?.id ?? 'staff')
    addPayment({
      sessionId:       session.id,
      vehiclePlate:    session.vehiclePlate,
      vehicleType:     session.vehicleType,
      slotCode:        session.slotCode,
      checkInTime:     session.checkInTime,
      checkOutTime:    checkOut.toISOString(),
      durationMinutes: fee.durationMinutes,
      fee:             amount,
      payMethod:       method,
      staffId:         user?.id   ?? 'staff',
      staffName:       user?.name ?? 'Nhân viên',
    })
  }

  // ── Hoàn tất checkout (dùng chung cho cash/card/qr) ─────────────────────
  function finalizeCheckout(amount: number, method: PayMethod) {
    if (!session) return
    updateSlot(session.slotId, 'available')
    recordToShift(method, amount)
    setConfirmed(true)
    setBarrierOpen(true)
    setTimeout(() => setBarrierOpen(false), 4000)
    toast.success('Thanh toán thành công — Barrier đã mở')
    setTimeout(() => {
      const latest = usePaymentStore.getState().payments[0]
      setLastReceiptNo(latest?.receiptNo ?? '')
      setShowReceipt(true)
    }, 1200)
  }

  // ── Xác nhận thanh toán tiền mặt / thẻ ──────────────────────────────────
  async function handleConfirmPayment() {
    if (!session || !fee || !payMethod || payMethod === 'qr') return
    if (payMethod === 'cash') {
      const cn = parseFloat(cashGiven.replace(/[^\d]/g, '')) || 0
      if (cn < fee.total) return
    }

    setSubmitting(true)
    try {
      // 1. Checkout: ghi exitTime + official fee vào DB
      let officialFee = fee.total
      try {
        const result = await checkOutSession(session.qrCode, { lostTicket: isLostTicket })
        if (result.priceBreakdown) {
          officialFee = result.priceBreakdown.totalFee
          setFee((prev) => prev ? { ...prev, total: officialFee } : prev)
        }
      } catch (coErr: unknown) {
        // Session đã PAYMENT_PENDING (gọi lại lần 2) — bỏ qua, dùng fee hiện có
        const status = (coErr as { response?: { status?: number } })?.response?.status
        if (status !== 400) throw coErr
      }

      // 2. Ghi nhận thanh toán → session COMPLETED + slot freed trong DB
      await createCashPayment(session.id, officialFee, payMethod === 'cash' ? 'CASH' : 'CARD')
      finalizeCheckout(officialFee, payMethod)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Không thể xử lý — vui lòng thử lại'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ── VNPay: tạo URL khi chọn phương thức QR ───────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (payMethod !== 'qr' || !session || !fee) return
    setQrLoading(true)
    setQrUrl('')
    createVnpayPaymentUrl(session.id, fee.total)
      .then(setQrUrl)
      .catch(() => toast.error('Không tạo được mã QR thanh toán, thử phương thức khác'))
      .finally(() => setQrLoading(false))
  }, [payMethod, session?.id]) // chỉ chạy khi đổi sang QR hoặc session mới

  // ── Socket: lắng nghe payment:success từ VNPay IPN ───────────────────────
  const confirmedRef = useRef(confirmed)
  confirmedRef.current = confirmed
  const feeRef = useRef(fee)
  feeRef.current = fee
  useEffect(() => {
    if (payMethod !== 'qr' || !session) return
    const socket = getSocket()
    function onSuccess(payload: { sessionId: string }) {
      if (payload?.sessionId === session!.id && !confirmedRef.current) {
        finalizeCheckout(feeRef.current?.total ?? 0, 'qr')
      }
    }
    socket.on('payment:success', onSuccess)
    return () => { socket.off('payment:success', onSuccess) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payMethod, session?.id])

  // ── Reset về trạng thái ban đầu ──────────────────────────────────────────
  function handleReset() {
    setSession(null);     setFee(null);          setPayMethod(null)
    setBarrierOpen(false); setShowReceipt(false); setConfirmed(false)
    setLookupErr('');     setPlateInput('');     setLostTicket(false)
    setCashGiven('');     setQrUrl('');          setQrLoading(false)
    setScanActive(true)
  }

  // Cash calculator
  const cashNum = parseFloat(cashGiven.replace(/[^\d]/g, '')) || 0
  const change  = cashNum - (fee?.total ?? 0)
  const cashOk  = payMethod !== 'cash' || cashNum >= (fee?.total ?? 0)

  // Lịch sử ca
  const filteredPayments = historyFilter === 'all'
    ? payments
    : payments.filter((p) => p.payMethod === historyFilter)

  function exportExcel() {
    const rows = filteredPayments.map((p, i) => ({
      'STT':           i + 1,
      'Số HĐ':         p.receiptNo,
      'Biển số':       p.vehiclePlate,
      'Loại xe':       VEHICLE_LABELS[p.vehicleType] ?? p.vehicleType,
      'Slot':          p.slotCode,
      'Giờ vào':       new Date(p.checkInTime).toLocaleString('vi-VN'),
      'Giờ thu phí':   new Date(p.paidAt).toLocaleString('vi-VN'),
      'Thời gian đỗ':  formatDuration(p.durationMinutes),
      'Số tiền (₫)':  p.fee,
      'Hình thức TT':  PAY_LABELS[p.payMethod],
      'Nhân viên':     p.staffName,
    }))
    rows.push({
      'STT': '' as unknown as number, 'Số HĐ': 'TỔNG', 'Biển số': '', 'Loại xe': '',
      'Slot': '', 'Giờ vào': '', 'Giờ thu phí': '',
      'Thời gian đỗ': `${filteredPayments.length} giao dịch`,
      'Số tiền (₫)': filteredPayments.reduce((s, p) => s + p.fee, 0),
      'Hình thức TT': '', 'Nhân viên': '',
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

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <PageWrapper>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Xe ra / Thu phí</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Quét vé QR hoặc tra biển số → xác nhận thanh toán → mở barrier
        </p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5">
        {([
          { id: 'checkout', label: 'Xe ra / Thu phí', icon: Wallet      },
          { id: 'history',  label: 'Lịch sử ca này',  icon: ReceiptIcon },
        ] as { id: TabId; label: string; icon: ComponentType<{ className?: string }> }[]).map((t) => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
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

      {/* ── TAB 1: Xe ra / Thu phí ─────────────────────────────────────────── */}
      {activeTab === 'checkout' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* CỘT TRÁI */}
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

            {/* Tra biển số */}
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
                <button
                  onClick={handlePlateSearch}
                  disabled={!!session || !plateInput.trim()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                             text-white text-sm font-medium rounded-xl transition-colors
                             flex items-center gap-1.5">
                  <Search className="w-4 h-4" /> Tra cứu
                </button>
              </div>
              <label className="mt-3 flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={isLostTicket}
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

          {/* CỘT PHẢI */}
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
                      ['Loại xe',   VEHICLE_LABELS[session.vehicleType] ?? '',             ''],
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
                      {fee.isOvernight && (
                        <span className="ml-auto text-xs font-medium text-indigo-700
                                         bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-full">
                          🌙 Qua đêm
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
                {!confirmed && fee && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
                    <h2 className="font-semibold text-gray-900">Phương thức thanh toán</h2>

                    <div className="grid grid-cols-3 gap-2">
                      {PAY_OPTIONS.map(({ val, label, Icon }) => (
                        <button
                          key={val}
                          onClick={() => { setPayMethod(val); setCashGiven(''); setQrUrl('') }}
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

                    {/* Tiền mặt: nhập khách đưa + tiền thối */}
                    {payMethod === 'cash' && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Khách đưa (₫)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono
                                     focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          placeholder="Nhập số tiền khách đưa..."
                          value={cashGiven}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/[^\d]/g, '')
                            setCashGiven(digits ? parseInt(digits).toLocaleString('vi-VN') : '')
                          }}
                        />
                        {cashNum > 0 && (
                          <div className={`flex justify-between text-sm px-3 py-2 rounded-lg ${
                            change >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                            <span>{change >= 0 ? 'Tiền thối' : 'Còn thiếu'}</span>
                            <span className="font-bold">{fmt(Math.abs(change))}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* QR: VNPay thật — tự hoàn tất qua socket payment:success */}
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

                    {/* Thẻ ngân hàng */}
                    {payMethod === 'card' && (
                      <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl p-3">
                        <CreditCard className="w-8 h-8 text-violet-400 flex-shrink-0" />
                        <p className="text-sm text-violet-700">
                          Yêu cầu khách quẹt thẻ vào máy POS, sau đó xác nhận bên dưới.
                        </p>
                      </div>
                    )}

                    {/* Nút xác nhận (QR tự hoàn tất qua socket, không cần bấm) */}
                    {payMethod !== 'qr' && (
                      <button
                        onClick={handleConfirmPayment}
                        disabled={!payMethod || !cashOk || submitting}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700
                                   disabled:opacity-40 disabled:cursor-not-allowed
                                   text-white font-semibold flex items-center justify-center gap-2 transition-colors">
                        {submitting ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Đang xử lý...</>
                        ) : (
                          <>
                            <CheckCircle className="w-5 h-5" />
                            {payMethod === 'cash' ? 'Xác nhận thu tiền mặt' : 'Xác nhận đã quẹt thẻ'}
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Đã hoàn tất */}
                {confirmed && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center space-y-2">
                    <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
                    <p className="font-semibold text-emerald-800">Thanh toán thành công!</p>
                    <p className="text-sm text-emerald-600">Barrier đã mở — xe có thể ra</p>
                    <div className="flex gap-2 justify-center mt-2">
                      <button
                        onClick={() => setShowReceipt(true)}
                        className="text-sm text-emerald-700 border border-emerald-300 rounded-lg px-3 py-1.5 hover:bg-emerald-100">
                        Xem hóa đơn
                      </button>
                      <button onClick={handleReset} className="text-sm text-emerald-700 underline">
                        Tiếp nhận xe tiếp theo
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: Lịch sử ca ──────────────────────────────────────────────── */}
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
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {([
                  { val: 'all',  label: 'Tất cả'   },
                  { val: 'cash', label: 'Tiền mặt' },
                  { val: 'qr',   label: 'QR'       },
                  { val: 'card', label: 'Thẻ'      },
                ] as { val: HistoryFilter; label: string }[]).map((f) => (
                  <button
                    key={f.val}
                    onClick={() => setHistoryFilter(f.val)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      historyFilter === f.val ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>

              <button
                onClick={exportExcel}
                disabled={filteredPayments.length === 0}
                className="flex items-center gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-700
                           disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                <Download className="w-4 h-4" />
                Xuất Excel
              </button>
            </div>
          </div>

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
                        <th key={h}
                          className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
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

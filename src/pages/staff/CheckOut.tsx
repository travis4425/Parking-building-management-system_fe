// Trang check-out xe ra — quét QR vé, tính phí, thanh toán, mở barrier, in receipt
import { useState, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import {
  ScanLine, Search, AlertCircle, CheckCircle, Car,
  Clock, CreditCard, Banknote, QrCode, X, Printer,
  ChevronRight, TriangleAlert,
} from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import QRScanner from '@/components/staff/QRScanner'
import { useSessionStore } from '@/store/sessionStore'
import { useSlotStore } from '@/store/slotStore'
import { useAuthStore } from '@/store/authStore'
import { calculateFee, formatDuration, LOST_TICKET_SURCHARGE, type FeeBreakdown } from '@/utils/feeCalculator'
import type { ParkingSession } from '@/utils/types'

type PayMethod = 'cash' | 'qr' | 'card'

const VEHICLE_LABELS: Record<string, string> = {
  motorbike: 'Xe máy', car: 'Ô tô', truck: 'Xe tải nhỏ',
}

function fmt(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n) + ' ₫'
}

// ── Barrier animation ────────────────────────────────────────────────────────
function BarrierGate({ open }: { open: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 py-4 select-none">
      <div className="relative w-44 h-28">
        {/* Trụ barrier */}
        <div className="absolute bottom-0 left-6 w-3 h-20 bg-gray-600 rounded-t-sm" />
        {/* Cần barrier — xoay lên khi open */}
        <div
          className={`absolute bottom-20 left-6 h-4 w-36 rounded-r-full origin-left
                      transition-transform duration-1000 ease-in-out
                      flex items-center overflow-hidden
                      ${open ? '-rotate-90' : 'rotate-0'}`}
          style={{ background: open ? '#16a34a' : '#dc2626' }}
        >
          {/* Sọc kẻ trên cần */}
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-full w-5 opacity-40 flex-shrink-0"
              style={{ background: 'repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(0,0,0,.3) 4px,rgba(0,0,0,.3) 8px)' }}
            />
          ))}
        </div>
        {/* Đường kẻ mặt đất */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded" />
      </div>
      <p className={`text-xs font-semibold ${open ? 'text-emerald-600' : 'text-red-500'}`}>
        {open ? '✓ Barrier đã mở — xe có thể ra' : 'Barrier đang đóng'}
      </p>
    </div>
  )
}

// ── Receipt modal ────────────────────────────────────────────────────────────
function ReceiptModal({
  session, fee, payMethod, onClose,
}: {
  session: ParkingSession
  fee: FeeBreakdown
  payMethod: PayMethod
  onClose: () => void
}) {
  const receiptRef = useRef<HTMLDivElement>(null)

  const PAY_LABELS: Record<PayMethod, string> = {
    cash: 'Tiền mặt', qr: 'QR Code', card: 'Thẻ ngân hàng',
  }

  function handlePrint() {
    const content = receiptRef.current?.innerHTML ?? ''
    const win = window.open('', '_blank', 'width=360,height=640')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">
<title>Receipt</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
  body { padding: 20px; }
  .receipt { border: 2px dashed #333; border-radius: 8px; padding: 20px; max-width: 300px; margin: 0 auto; }
  h2 { text-align: center; font-size: 16px; margin-bottom: 4px; }
  .sub { text-align: center; font-size: 11px; color: #666; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
  td { padding: 3px 2px; border-bottom: 1px dotted #eee; }
  td:last-child { text-align: right; font-weight: bold; }
  .divider { border-top: 2px dashed #333; margin: 8px 0; }
  .total-row td { font-size: 14px; color: #1d4ed8; }
  .footer { text-align: center; font-size: 10px; color: #888; margin-top: 10px; }
</style></head><body><div class="receipt">${content}</div></body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Thanh toán thành công</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt content */}
        <div className="px-5 py-4 overflow-y-auto max-h-96">
          <div ref={receiptRef}>
            <h2>🅿 ParkingOS</h2>
            <p className="sub">BIÊN NHẬN THANH TOÁN</p>
            <table>
              <tbody>
                <tr><td>Biển số</td><td>{session.vehiclePlate}</td></tr>
                <tr><td>Loại xe</td><td>{VEHICLE_LABELS[session.vehicleType]}</td></tr>
                <tr><td>Slot</td><td>{session.slotCode}</td></tr>
                <tr><td>Giờ vào</td><td>{new Date(session.checkInTime).toLocaleTimeString('vi-VN')}</td></tr>
                <tr><td>Giờ ra</td><td>{fee.checkOutTime.toLocaleTimeString('vi-VN')}</td></tr>
                <tr><td>Thời gian gửi</td><td>{formatDuration(fee.durationMinutes)}</td></tr>
              </tbody>
            </table>
            <div className="divider" />
            <table>
              <tbody>
                {fee.isOvernight ? (
                  <tr><td>Phí qua đêm</td><td>{fmt(fee.overnightFee)}</td></tr>
                ) : fee.isPeak ? (
                  <tr><td>{fee.billableHours}h × {fmt(fee.ratePeak)}/h (cao điểm)</td><td>{fmt(fee.peakFee)}</td></tr>
                ) : (
                  <tr><td>{fee.billableHours}h × {fmt(fee.rateNormal)}/h</td><td>{fmt(fee.normalFee)}</td></tr>
                )}
                {fee.surcharge > 0 && (
                  <tr><td>Phụ thu mất vé</td><td>{fmt(fee.surcharge)}</td></tr>
                )}
              </tbody>
            </table>
            <div className="divider" />
            <table>
              <tbody>
                <tr className="total-row">
                  <td><strong>Tổng cộng</strong></td>
                  <td><strong>{fmt(fee.total)}</strong></td>
                </tr>
                <tr><td>Thanh toán qua</td><td>{PAY_LABELS[payMethod]}</td></tr>
              </tbody>
            </table>
            <p className="footer">Cảm ơn quý khách! ParkingOS v1.0</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                       bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
            <Printer className="w-4 h-4" /> In biên nhận
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50
                       text-gray-700 text-sm">
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function CheckOut() {
  const findByQR    = useSessionStore((s) => s.findByQR)
  const findByPlate = useSessionStore((s) => s.findByPlate)
  const complete    = useSessionStore((s) => s.completeSession)
  const updateSlot  = useSlotStore((s) => s.updateSlotStatus)
  const { user }    = useAuthStore()

  // Lookup state
  const [scanActive,  setScanActive]  = useState(true)
  const [plateInput,  setPlateInput]  = useState('')
  const [isLostTicket, setLostTicket] = useState(false)
  const [lookupErr,   setLookupErr]   = useState('')

  // Session state — fixed checkout time khi lookup thành công
  const [session,  setSession]  = useState<ParkingSession | null>(null)
  const [checkOut, setCheckOut] = useState<Date>(new Date())
  const [fee,      setFee]      = useState<FeeBreakdown | null>(null)

  // Payment state
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null)

  // Completion state
  const [barrierOpen,  setBarrierOpen]  = useState(false)
  const [showReceipt,  setShowReceipt]  = useState(false)
  const [confirmed,    setConfirmed]    = useState(false)

  function applySession(found: ParkingSession | undefined, lost = false) {
    if (!found) {
      setLookupErr('Không tìm thấy phiên đỗ xe đang hoạt động.')
      return
    }
    const now = new Date()
    setSession(found)
    setCheckOut(now)
    setFee(calculateFee(found, now, lost))
    setLookupErr('')
    setScanActive(false)
  }

  // Quét QR thành công — text = UUID qrCode của session
  function handleQRScan(text: string) {
    setScanActive(false)
    applySession(findByQR(text))
  }

  // Tra cứu theo biển số (có thể là mất vé)
  function handlePlateSearch() {
    if (!plateInput.trim()) return
    applySession(findByPlate(plateInput), isLostTicket)
  }

  function handleConfirmPayment() {
    if (!session || !fee || !payMethod) return
    complete(session.id, fee.total, user?.id ?? 'staff')
    updateSlot(session.slotId, 'available')
    setConfirmed(true)
    setBarrierOpen(true)
    setTimeout(() => setShowReceipt(true), 1200)
  }

  function handleReset() {
    setSession(null); setFee(null); setPayMethod(null)
    setBarrierOpen(false); setShowReceipt(false); setConfirmed(false)
    setLookupErr(''); setPlateInput(''); setLostTicket(false)
    setScanActive(true)
  }

  return (
    <PageWrapper>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Xe ra (Check-out)</h1>
        <p className="text-sm text-gray-500 mt-0.5">Quét vé QR hoặc tra cứu biển số để thanh toán</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── CỘT TRÁI: Quét QR + tra cứu biển số ── */}
        <div className="space-y-4">
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

            {/* QR scanner — tắt sau khi tìm được session */}
            <QRScanner onScan={handleQRScan} active={scanActive && !session} />

            {session && (
              <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700
                              bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                Đã quét vé — <span className="font-mono font-bold">{session.vehiclePlate}</span>
              </div>
            )}
          </div>

          {/* Tra cứu theo biển số (fallback / mất vé) */}
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
                placeholder="Ví dụ: 51G-123.45"
                disabled={!!session}
                className="flex-1 px-3 py-2.5 text-sm font-mono rounded-xl border border-gray-300
                           focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                           disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button onClick={handlePlateSearch} disabled={!!session || !plateInput.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                           text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-1.5">
                <Search className="w-4 h-4" /> Tra cứu
              </button>
            </div>

            {/* Checkbox mất vé */}
            <label className="mt-3 flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={isLostTicket}
                onChange={(e) => {
                  setLostTicket(e.target.checked)
                  if (session && fee) setFee(calculateFee(session, checkOut, e.target.checked))
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

          {/* Barrier animation */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <BarrierGate open={barrierOpen} />
          </div>
        </div>

        {/* ── CỘT PHẢI: Thông tin session + thanh toán ── */}
        <div className="space-y-4">
          {!session ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200
                            flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
              <Car className="w-12 h-12 opacity-20" />
              <p className="text-sm">Quét QR vé hoặc nhập biển số để hiển thị thông tin</p>
            </div>
          ) : (
            <>
              {/* Thông tin session */}
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

                <div className="space-y-2 text-sm">
                  {[
                    ['Biển số',    session.vehiclePlate,                                         'font-mono font-bold text-lg'],
                    ['Loại xe',    VEHICLE_LABELS[session.vehicleType],                          ''],
                    ['Slot',       session.slotCode,                                              'font-mono'],
                    ['Giờ vào',    new Date(session.checkInTime).toLocaleString('vi-VN'),         ''],
                    ['Giờ ra',     checkOut.toLocaleString('vi-VN'),                              ''],
                    ['Thời gian',  formatDuration(fee!.durationMinutes),                          'font-medium'],
                  ].map(([label, value, extra]) => (
                    <div key={label} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                      <span className="text-gray-500">{label}</span>
                      <span className={`text-gray-900 ${extra}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Breakdown phí */}
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
                        ⚡ Giờ cao điểm
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    {fee.isOvernight ? (
                      <FeeRow label="Phí qua đêm (> 12 giờ)" amount={fee.overnightFee} />
                    ) : fee.isPeak ? (
                      <FeeRow
                        label={`${fee.billableHours}h × ${fmt(fee.ratePeak)}/h (cao điểm)`}
                        amount={fee.peakFee}
                      />
                    ) : (
                      <FeeRow
                        label={`${fee.billableHours}h × ${fmt(fee.rateNormal)}/h (thường)`}
                        amount={fee.normalFee}
                      />
                    )}

                    {fee.surcharge > 0 && (
                      <FeeRow label="Phụ thu mất vé" amount={fee.surcharge} warn />
                    )}

                    <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                      <span className="font-semibold text-gray-900">Tổng cộng</span>
                      <span className="text-xl font-bold text-blue-600">{fmt(fee.total)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Phương thức thanh toán */}
              {!confirmed && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h2 className="font-semibold text-gray-900 mb-3">Thanh toán</h2>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {([
                      ['cash', 'Tiền mặt',   Banknote],
                      ['qr',   'QR Code',    QrCode],
                      ['card', 'Thẻ NH',     CreditCard],
                    ] as [PayMethod, string, React.ComponentType<{ className?: string }>][]).map(([val, label, Icon]) => (
                      <button key={val} onClick={() => setPayMethod(val)}
                        className={`py-3 rounded-xl border text-xs font-medium transition-all flex flex-col items-center gap-1.5 ${
                          payMethod === val
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-200 text-gray-700 hover:border-blue-300'
                        }`}>
                        <Icon className="w-5 h-5" />
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* QR thanh toán mock */}
                  {payMethod === 'qr' && fee && (
                    <div className="flex flex-col items-center gap-2 py-3 bg-gray-50 rounded-xl mb-3">
                      <QRCodeCanvas
                        value={`PAYMENT:${session.id}:${fee.total}`}
                        size={140}
                        level="M"
                      />
                      <p className="text-xs text-gray-500">Quét bằng app ngân hàng để thanh toán</p>
                      <p className="text-sm font-bold text-blue-600">{fmt(fee.total)}</p>
                    </div>
                  )}

                  <button
                    onClick={handleConfirmPayment}
                    disabled={!payMethod}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700
                               disabled:opacity-40 disabled:cursor-not-allowed
                               text-white font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Xác nhận thanh toán &amp; Mở barrier
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Trạng thái đã xác nhận */}
              {confirmed && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center space-y-2">
                  <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
                  <p className="font-semibold text-emerald-800">Thanh toán thành công!</p>
                  <p className="text-sm text-emerald-600">Barrier đang mở — xe có thể ra</p>
                  <button onClick={handleReset}
                    className="mt-2 text-sm text-emerald-700 underline">
                    Tiếp nhận xe tiếp theo
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Receipt modal */}
      {showReceipt && session && fee && payMethod && (
        <ReceiptModal
          session={session}
          fee={fee}
          payMethod={payMethod}
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
      <span className={`font-semibold ${warn ? 'text-amber-700' : 'text-gray-900'}`}>
        {fmt(amount)}
      </span>
    </div>
  )
}

// React import cần thiết cho ComponentType trong JSX
import React from 'react'

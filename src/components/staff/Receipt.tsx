// Biên nhận thanh toán — dùng chung giữa CheckOut và StaffPayment, hỗ trợ in qua window.open
import { useRef } from 'react'
import { CheckCircle, Printer, X } from 'lucide-react'
import { formatDuration } from '@/utils/feeCalculator'
import type { FeeBreakdown } from '@/utils/feeCalculator'
import type { ParkingSession, PayMethod } from '@/utils/types'

export interface ReceiptProps {
  session:     ParkingSession
  fee:         FeeBreakdown
  payMethod:   PayMethod
  cashGiven?:  number       // Số tiền khách đưa (khi thanh toán tiền mặt)
  receiptNo?:  string       // Số hóa đơn — tự generate nếu không truyền
  onClose:     () => void
}

const PAY_LABELS: Record<PayMethod, string> = {
  cash: 'Tiền mặt',
  qr:   'QR Code (chuyển khoản)',
  card: 'Thẻ ngân hàng',
}

// 🐞 SỬA: làm tròn về số nguyên trước khi format — VND không có phần thập phân
function fmt(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫'
}

const VEHICLE_LABELS: Record<string, string> = {
  motorbike: 'Xe máy',
  car:       'Ô tô',
  bicycle:   'Xe đạp',
}

function generateReceiptNo(sessionId: string) {
  const suffix = sessionId.slice(-4).toUpperCase()
  const ts     = Date.now().toString().slice(-5)
  return `INV-${ts}-${suffix}`
}

export default function Receipt({ session, fee, payMethod, cashGiven, receiptNo, onClose }: ReceiptProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const displayNo  = receiptNo ?? generateReceiptNo(session.id)
  const change     = cashGiven !== undefined ? cashGiven - fee.total : 0

  function handlePrint() {
    const html = contentRef.current?.innerHTML ?? ''
    const win  = window.open('', '_blank', 'width=380,height=680')
    if (!win) return

    win.document.write(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Biên nhận — ${displayNo}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; padding: 24px; background: #fff; }
    .receipt { border: 2px dashed #555; border-radius: 8px; padding: 20px; max-width: 320px; margin: 0 auto; }
    .logo { text-align: center; font-size: 22px; font-weight: 900; letter-spacing: 1px; margin-bottom: 2px; }
    .tagline { text-align: center; font-size: 10px; color: #888; margin-bottom: 4px; }
    .receipt-no { text-align: center; font-size: 11px; color: #555; border: 1px solid #ddd; border-radius: 4px; padding: 3px 8px; display: inline-block; margin: 4px auto 12px; }
    .center { text-align: center; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
    td { padding: 4px 2px; border-bottom: 1px dotted #eee; vertical-align: top; }
    td:last-child { text-align: right; font-weight: 600; }
    .divider { border-top: 2px dashed #aaa; margin: 8px 0; }
    .total td { font-size: 15px; color: #1d4ed8; padding-top: 6px; }
    .change-row td { color: #15803d; font-size: 13px; }
    .footer { text-align: center; font-size: 10px; color: #999; margin-top: 12px; line-height: 1.5; }
    @media print {
      body { padding: 0; }
      .receipt { border: none; }
    }
  </style>
</head>
<body>
  <div class="receipt">${html}</div>
</body>
</html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 400)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-600 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Thanh toán thành công</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white rounded-full p-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt content — cùng HTML sẽ được dùng khi in */}
        <div className="px-5 py-4 overflow-y-auto max-h-[480px]">
          <div ref={contentRef}>
            {/* Logo */}
            <p className="logo">🅿 ParkingOS</p>
            <p className="tagline" style={{ textAlign: 'center', fontSize: 10, color: '#888', marginBottom: 4 }}>
              Hệ thống quản lý bãi đỗ xe thông minh
            </p>
            <p style={{ textAlign: 'center', marginBottom: 12 }}>
              <span className="receipt-no" style={{
                display: 'inline-block', border: '1px solid #ddd', borderRadius: 4,
                padding: '2px 8px', fontSize: 11, color: '#555',
              }}>
                {displayNo}
              </span>
            </p>

            {/* Thông tin xe */}
            <table><tbody>
              <tr><td>Biển số</td><td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{session.vehiclePlate}</td></tr>
              <tr><td>Loại xe</td><td>{VEHICLE_LABELS[session.vehicleType] ?? session.vehicleType}</td></tr>
              <tr><td>Slot</td><td>{session.slotCode}</td></tr>
              <tr><td>Giờ vào</td><td>{new Date(session.checkInTime).toLocaleString('vi-VN')}</td></tr>
              <tr><td>Giờ thu phí</td><td>{fee.checkOutTime.toLocaleString('vi-VN')}</td></tr>
              <tr><td>Thời gian đỗ</td><td>{formatDuration(fee.durationMinutes)}</td></tr>
            </tbody></table>

            <div className="divider" style={{ borderTop: '2px dashed #aaa', margin: '8px 0' }} />

            {/* Chi tiết phí */}
            <table><tbody>
              {!fee.isOvernight && fee.basePrice > 0 && (
                <tr><td>Phí cơ bản</td><td>{fmt(fee.basePrice)}</td></tr>
              )}
              {fee.isOvernight ? (
                <tr><td>Phí qua đêm (&gt; 12h)</td><td>{fmt(fee.overnightFee)}</td></tr>
              ) : fee.isPeak ? (
                <tr>
                  <td>{fee.billableHours.toFixed(2)}h × {fmt(fee.ratePeak)}/h<br /><small style={{ color: '#ea580c' }}>Giờ cao điểm</small></td>
                  <td>{fmt(fee.peakFee)}</td>
                </tr>
              ) : (
                <tr>
                  <td>{fee.billableHours.toFixed(2)}h × {fmt(fee.rateNormal)}/h</td>
                  <td>{fmt(fee.normalFee)}</td>
                </tr>
              )}
              {fee.surcharge > 0 && (
                <tr><td style={{ color: '#b45309' }}>Phụ thu mất vé</td><td style={{ color: '#b45309' }}>{fmt(fee.surcharge)}</td></tr>
              )}
            </tbody></table>

            <div className="divider" style={{ borderTop: '2px dashed #aaa', margin: '8px 0' }} />

            {/* Tổng */}
            <table><tbody>
              <tr className="total">
                <td><strong>Tổng cộng</strong></td>
                <td style={{ color: '#1d4ed8', fontSize: 16 }}><strong>{fmt(fee.total)}</strong></td>
              </tr>
              <tr><td>Hình thức TT</td><td>{PAY_LABELS[payMethod]}</td></tr>
              {payMethod === 'cash' && cashGiven !== undefined && (
                <>
                  <tr><td>Khách đưa</td><td>{fmt(cashGiven)}</td></tr>
                  <tr className="change-row">
                    <td style={{ color: '#15803d' }}>Tiền thối</td>
                    <td style={{ color: '#15803d' }}>{fmt(Math.max(0, change))}</td>
                  </tr>
                </>
              )}
            </tbody></table>

            <p style={{ textAlign: 'center', fontSize: 10, color: '#999', marginTop: 12 }}>
              Cảm ơn quý khách!<br />
              ParkingOS v1.0 — Lưu giữ để đối chiếu khi cần
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
          >
            <Printer className="w-4 h-4" /> In hóa đơn
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

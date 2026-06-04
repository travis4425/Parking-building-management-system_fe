// Driver Portal — Lịch sử gửi xe: filter, phân trang, modal chi tiết + in hóa đơn
import { useState, useEffect, useRef, useMemo } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import {
  History, Bike, Car, Truck, CalendarDays, Clock,
  CheckCircle2, X, Printer, ChevronLeft,
  ChevronRight, Search, Filter,
} from 'lucide-react'
import { useSessionStore } from '@/store/sessionStore'
import { useAuthStore } from '@/store/authStore'
import { formatDuration } from '@/utils/feeCalculator'
import type { ParkingSession, VehicleType } from '@/utils/types'

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 5

type FilterPeriod = '7d' | '30d' | 'custom'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number) { return new Intl.NumberFormat('vi-VN').format(n) + ' ₫' }

function vehicleLabel(t: VehicleType) {
  return t === 'motorbike' ? 'Xe máy' : t === 'car' ? 'Ô tô' : 'Xe tải'
}

const VehicleIcon: Record<VehicleType, React.ElementType> = {
  motorbike: Bike,
  car:       Car,
  truck:     Truck,
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function durationMins(s: ParkingSession): number {
  if (!s.checkOutTime) return 0
  return Math.floor(
    (new Date(s.checkOutTime).getTime() - new Date(s.checkInTime).getTime()) / 60_000,
  )
}

function statusInfo(s: ParkingSession) {
  if (s.status === 'completed') return { label: 'Đã hoàn tất',    cls: 'bg-green-100 text-green-700' }
  if (s.status === 'paid')      return { label: 'Đã thanh toán',  cls: 'bg-blue-100 text-blue-700'   }
  return { label: s.status, cls: 'bg-gray-100 text-gray-600' }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DriverHistory() {
  const sessions = useSessionStore((s) => s.sessions)
  const { user } = useAuthStore()

  // ── Filter state ──────────────────────────────────────────────────────────
  const [period,   setPeriod]   = useState<FilterPeriod>('30d')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const [page,     setPage]     = useState(1)

  // ── Modal state ───────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<ParkingSession | null>(null)
  const qrRef = useRef<HTMLDivElement>(null)

  // Reset to page 1 when filter changes
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1) }, [period, dateFrom, dateTo])

  // ── Derived ───────────────────────────────────────────────────────────────
  const driverHistory = useMemo(
    () =>
      sessions
        .filter(
          (s) =>
            s.driverId === user?.id &&
            (s.status === 'completed' || s.status === 'paid'),
        )
        .sort(
          (a, b) =>
            new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime(),
        ),
    [sessions, user?.id],
  )

  const filtered = useMemo(() => {
    const now = new Date()
    return driverHistory.filter((s) => {
      const ci = new Date(s.checkInTime)
      if (period === '7d')  return ci >= new Date(now.getTime() - 7  * 86_400_000)
      if (period === '30d') return ci >= new Date(now.getTime() - 30 * 86_400_000)
      if (period === 'custom') {
        const from = dateFrom ? new Date(dateFrom)                    : new Date(0)
        const to   = dateTo   ? new Date(dateTo + 'T23:59:59')        : now
        return ci >= from && ci <= to
      }
      return true
    })
  }, [driverHistory, period, dateFrom, dateTo])

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged       = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const totalFee    = filtered.reduce((s, r) => s + (r.fee ?? 0), 0)

  // ── Print handler ─────────────────────────────────────────────────────────
  function handlePrint(s: ParkingSession) {
    const canvas  = qrRef.current?.querySelector('canvas') as HTMLCanvasElement | null
    const qrImg   = canvas?.toDataURL('image/png') ?? ''
    const dur     = durationMins(s)
    const win     = window.open('', '_blank', 'width=400,height=640')
    if (!win) return

    win.document.write(`<!DOCTYPE html>
<html lang="vi"><head>
<meta charset="UTF-8"><title>Hóa đơn — ${s.id}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}
  body{padding:20px;max-width:360px;margin:0 auto}
  h2{text-align:center;font-size:18px;margin-bottom:2px}
  .sub{text-align:center;font-size:11px;color:#777;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px}
  td{padding:4px 2px;border-bottom:1px dotted #eee;vertical-align:top}
  td:last-child{text-align:right;font-weight:700}
  .divider{border-top:2px dashed #bbb;margin:8px 0}
  .total td{font-size:15px;color:#1d4ed8;padding-top:6px}
  .qr{text-align:center;margin:14px 0}
  .footer{text-align:center;font-size:10px;color:#aaa;margin-top:14px;line-height:1.6}
  @media print{body{padding:0}}
</style></head>
<body>
<h2>🅿 ParkingOS</h2>
<p class="sub">HÓA ĐƠN DỊCH VỤ ĐỖ XE</p>
<table><tbody>
  <tr><td>Biển số</td><td>${s.vehiclePlate}</td></tr>
  <tr><td>Loại xe</td><td>${vehicleLabel(s.vehicleType)}</td></tr>
  <tr><td>Slot</td><td>${s.slotCode}</td></tr>
  <tr><td>Giờ vào</td><td>${new Date(s.checkInTime).toLocaleString('vi-VN')}</td></tr>
  <tr><td>Giờ ra</td><td>${s.checkOutTime ? new Date(s.checkOutTime).toLocaleString('vi-VN') : '—'}</td></tr>
  <tr><td>Thời gian</td><td>${dur > 0 ? formatDuration(dur) : '—'}</td></tr>
</tbody></table>
<div class="divider"></div>
<table><tbody>
  <tr class="total"><td><strong>Tổng phí</strong></td><td><strong>${fmt(s.fee ?? 0)}</strong></td></tr>
  <tr><td>Trạng thái</td><td>${statusInfo(s).label}</td></tr>
  <tr><td>Mã vé</td><td style="font-family:monospace;font-size:10px">${s.qrCode}</td></tr>
</tbody></table>
${qrImg ? `<div class="qr"><img src="${qrImg}" width="120" height="120" alt="QR"/></div>` : ''}
<p class="footer">Cảm ơn quý khách đã sử dụng ParkingOS!<br/>Lưu giữ để đối chiếu khi cần thiết.</p>
</body></html>`)

    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 400)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-5 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <History className="w-5 h-5 text-blue-500" />
          Lịch sử gửi xe
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Tất cả {driverHistory.length} lượt gửi xe của bạn
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-600">Khoảng thời gian</span>
        </div>

        <div className="flex gap-2">
          {([
            { val: '7d',     label: '7 ngày'    },
            { val: '30d',    label: '30 ngày'   },
            { val: 'custom', label: 'Tùy chọn' },
          ] as { val: FilterPeriod; label: string }[]).map((f) => (
            <button
              key={f.val}
              onClick={() => setPeriod(f.val)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                period === f.val
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Từ ngày</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Đến ngày</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">{filtered.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Lượt gửi xe</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-center">
          <p className="text-lg font-bold text-blue-600 leading-tight">{fmt(totalFee)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Tổng chi tiêu</p>
        </div>
      </div>

      {/* Session list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center text-gray-400">
          <Search className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Không có lượt gửi xe nào trong khoảng thời gian này</p>
        </div>
      ) : (
        <div className="space-y-2">
          {paged.map((s) => {
            const Icon   = VehicleIcon[s.vehicleType] ?? Car
            const dur    = durationMins(s)
            const status = statusInfo(s)
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:border-blue-300 hover:shadow-md transition-all text-left"
              >
                <div className="flex items-start gap-3">
                  {/* Vehicle icon */}
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-blue-500" />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono font-semibold text-gray-800">
                        {s.vehiclePlate}
                      </span>
                      <span className="text-xs text-gray-400">Slot {s.slotCode}</span>
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {fmtDate(s.checkInTime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {fmtTime(s.checkInTime)}
                        {s.checkOutTime && ` — ${fmtTime(s.checkOutTime)}`}
                      </span>
                      {dur > 0 && <span>{formatDuration(dur)}</span>}
                    </div>
                  </div>

                  {/* Fee */}
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-blue-600 text-sm">{fmt(s.fee ?? 0)}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Trước
          </button>
          <span className="text-sm text-gray-500">
            Trang <strong>{currentPage}</strong> / {totalPages}
            <span className="text-xs text-gray-400 ml-2">({filtered.length} lượt)</span>
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Sau <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Detail modal ──────────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />

          <div className="relative z-10 bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <h3 className="font-bold text-gray-800">Chi tiết lượt gửi xe</h3>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 rounded-full p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body — scrollable */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {/* Info table */}
              <dl className="space-y-0 divide-y divide-gray-50 text-sm">
                {([
                  ['Biển số',     selected.vehiclePlate,                                      'font-mono font-bold text-base'],
                  ['Loại xe',     vehicleLabel(selected.vehicleType),                          ''],
                  ['Slot',        selected.slotCode,                                           'font-mono'],
                  ['Giờ vào',     new Date(selected.checkInTime).toLocaleString('vi-VN'),       ''],
                  ['Giờ ra',      selected.checkOutTime
                                    ? new Date(selected.checkOutTime).toLocaleString('vi-VN')
                                    : '—',                                                     ''],
                  ['Thời gian',   durationMins(selected) > 0
                                    ? formatDuration(durationMins(selected))
                                    : '—',                                                     'font-medium'],
                  ['Cổng vào',    selected.entryGate ?? '—',                                   ''],
                  ['Trạng thái',  statusInfo(selected).label,                                  ''],
                ] as [string, string, string][]).map(([label, val, extra]) => (
                  <div key={label} className="flex justify-between items-center py-2">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className={`text-gray-800 ${extra}`}>{val}</dd>
                  </div>
                ))}
                <div className="flex justify-between items-center py-2">
                  <dt className="font-bold text-gray-700">Tổng phí</dt>
                  <dd className="font-bold text-lg text-blue-600">{fmt(selected.fee ?? 0)}</dd>
                </div>
              </dl>

              {/* QR code */}
              <div className="flex flex-col items-center gap-2 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 font-medium">Mã vé QR (dùng để tra cứu)</p>
                <div ref={qrRef} className="bg-white p-3 rounded-xl shadow-inner border border-gray-100">
                  <QRCodeCanvas
                    value={`PARKINGOS:${selected.qrCode}`}
                    size={160}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <p className="text-xs text-gray-400 font-mono">{selected.qrCode}</p>
              </div>

              {/* Notes */}
              {selected.notes && (
                <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-xs text-gray-600">
                  <span className="font-medium text-gray-700">Ghi chú:</span> {selected.notes}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-5 pb-5 pt-3 border-t border-gray-100 shrink-0 flex gap-2">
              <button
                onClick={() => handlePrint(selected)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                <Printer className="w-4 h-4" /> Tải hóa đơn
              </button>
              <button
                onClick={() => setSelected(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

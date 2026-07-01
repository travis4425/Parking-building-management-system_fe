// Trang theo dõi ngoại lệ — Manager giám sát, ghi chú, đánh dấu, xuất báo cáo
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import {
  AlertTriangle, QrCode, ScanLine, Clock, Cpu,
  FileDown, Eye, ChevronLeft, ChevronRight,
  MessageSquare, CheckCircle, Wrench, X, CircleDot,
  Image,
} from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import { useSessionStore } from '@/store/sessionStore'
import { useAlertStore }   from '@/store/alertStore'
import { useSlotStore }    from '@/store/slotStore'
import { useConfigStore }  from '@/store/configStore'
import { calculateFee }    from '@/utils/feeCalculator'
import { cn } from '@/utils/cn'
import { fetchExceptionsApi } from '@/api/exceptionsApi'
import { mapException } from '@/api/mappers'
import type { ManagerException, ExceptionType, ExceptionStatus } from '@/utils/types'

// ─── Label / màu ─────────────────────────────────────────────────────────────
const EX_TYPE_LABEL: Record<ExceptionType, string> = {
  lost_qr:      'Mất thẻ QR',
  wrong_plate:  'Sai biển số',
  wrong_zone:   'Sai khu vực',
  overtime:     'Quá hạn',
  sensor_error: 'Sensor lỗi',
}

const EX_TYPE_COLOR: Record<ExceptionType, string> = {
  lost_qr:      'bg-red-100 text-red-700 border-red-200',
  wrong_plate:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  wrong_zone:   'bg-purple-100 text-purple-700 border-purple-200',
  overtime:     'bg-orange-100 text-orange-700 border-orange-200',
  sensor_error: 'bg-gray-100 text-gray-600 border-gray-300',
}

const EX_TYPE_ICON: Record<ExceptionType, React.ReactNode> = {
  lost_qr:      <QrCode    className="w-4 h-4" />,
  wrong_plate:  <ScanLine  className="w-4 h-4" />,
  wrong_zone:   <AlertTriangle className="w-4 h-4" />,
  overtime:     <Clock     className="w-4 h-4" />,
  sensor_error: <Cpu       className="w-4 h-4" />,
}

const EX_STATUS_LABEL: Record<ExceptionStatus, string> = {
  pending:    'Chờ xử lý',
  resolved:   'Đã xử lý',
  monitoring: 'Đang theo dõi',
}

const EX_STATUS_COLOR: Record<ExceptionStatus, string> = {
  pending:    'bg-red-50 text-red-600 border-red-200',
  resolved:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  monitoring: 'bg-blue-50 text-blue-700 border-blue-200',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// 🐞 SỬA: làm tròn về số nguyên trước khi format — VND không có phần thập phân
function fmt(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫'
}

function formatDurationFull(ms: number) {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  return `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`
}

function todayStart() {
  const d = new Date(); d.setHours(0,0,0,0); return d.getTime()
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function MetricCard({
  label, value, sub, color, icon,
}: {
  label: string; value: number; sub?: string; color: string; icon: React.ReactNode
}) {
  return (
    <div className={cn('bg-white rounded-xl border shadow-sm p-4 flex items-center gap-3', color)}>
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color.replace('border','bg').replace('-200','-50'))}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium leading-none mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function TypeBadge({ type }: { type: ExceptionType }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border',
      EX_TYPE_COLOR[type],
    )}>
      {EX_TYPE_ICON[type]}
      {EX_TYPE_LABEL[type]}
    </span>
  )
}

function StatusBadge({ status }: { status: ExceptionStatus }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border',
      EX_STATUS_COLOR[status],
    )}>
      <CircleDot className="w-3 h-3" />
      {EX_STATUS_LABEL[status]}
    </span>
  )
}

const PAGE_SIZE = 10

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ManagerExceptions() {
  const navigate       = useNavigate()
  const sessions       = useSessionStore((s) => s.sessions)
  const alerts         = useAlertStore((s) => s.alerts)
  const updateSlot     = useSlotStore((s) => s.updateSlotStatus)
  const slots          = useSlotStore((s) => s.slots)
  const threshold      = useConfigStore((s) => s.overtimeThresholdHours)
  const surchargePct   = useConfigStore((s) => s.overtimeSurchargePercent)

  // Danh sách ngoại lệ thật từ BE (GET /exceptions) — status/notes/timeline chỉ tồn tại trên FE
  // vì BE Exception là log append-only, không có các trường này
  const [exceptions,   setExceptions]   = useState<ManagerException[]>([])

  useEffect(() => {
    fetchExceptionsApi()
      .then((list) => setExceptions(list.map(mapException)))
      .catch((err) => console.error('Lỗi tải danh sách ngoại lệ:', err))
  }, [])
  const [nowMs,        setNowMs]        = useState(() => Date.now())
  const [filterType,   setFilterType]   = useState<ExceptionType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<ExceptionStatus | 'all'>('all')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [page,         setPage]         = useState(1)
  const [detailEx,     setDetailEx]     = useState<ManagerException | null>(null)
  // Ghi chú nhanh cho exception / overtime session
  const [noteModal,    setNoteModal]    = useState<{ id: string; current: string } | null>(null)
  const [noteDraft,    setNoteDraft]    = useState('')
  // Overtime sessions đang monitoring
  const [monitoredIds, setMonitoredIds] = useState<Set<string>>(new Set())

  // Realtime tick mỗi giây cho countdown quá hạn
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // ── Tính toán overtime sessions từ sessionStore ──────────────────────────
  const now = nowMs
  const overtimeSessions = sessions.filter(
    (s) => s.status === 'active' &&
           (now - new Date(s.checkInTime).getTime()) > threshold * 3_600_000,
  )

  // ── Sensor error alerts đang active ──────────────────────────────────────
  const sensorAlerts = alerts.filter(
    (a) => a.type === 'sensor_error' && a.status === 'pending',
  )

  // ── Metrics ───────────────────────────────────────────────────────────────
  const today = todayStart()
  const lostQrToday    = exceptions.filter((e) => e.type === 'lost_qr'     && new Date(e.timestamp).getTime() >= today).length
  const wrongPlateToday= exceptions.filter((e) => e.type === 'wrong_plate' && new Date(e.timestamp).getTime() >= today).length
  const overtimeCount  = overtimeSessions.length
  const sensorErrCount = sensorAlerts.length

  // ── Filter & paginate ────────────────────────────────────────────────────
  const filtered = exceptions.filter((e) => {
    if (filterType   !== 'all' && e.type   !== filterType)   return false
    if (filterStatus !== 'all' && e.status !== filterStatus) return false
    if (dateFrom && new Date(e.timestamp) < new Date(dateFrom))  return false
    if (dateTo   && new Date(e.timestamp) > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Xử lý khi filter thay đổi → reset trang
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1) }, [filterType, filterStatus, dateFrom, dateTo])

  // ── Actions ───────────────────────────────────────────────────────────────
  const changeStatus = useCallback((id: string, status: ExceptionStatus) => {
    setExceptions((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status } : e)),
    )
  }, [])

  function openNoteModal(id: string, current?: string) {
    setNoteDraft(current ?? '')
    setNoteModal({ id, current: current ?? '' })
  }

  function saveNote() {
    if (!noteModal) return
    setExceptions((prev) =>
      prev.map((e) => (e.id === noteModal.id ? { ...e, notes: noteDraft } : e)),
    )
    setNoteModal(null)
    toast.success('Đã lưu ghi chú')
  }

  function toggleMonitor(sessionId: string) {
    setMonitoredIds((prev) => {
      const next = new Set(prev)
      if (next.has(sessionId)) { next.delete(sessionId) } else { next.add(sessionId) }
      return next
    })
  }

  function moveToMaintenance(slotCode: string) {
    const slot = slots.find((s) => s.id === slotCode || s.code === slotCode)
    if (slot) updateSlot(slot.id, 'maintenance')
  }

  // ── Export Excel ──────────────────────────────────────────────────────────
  function exportExcel() {
    const rows = filtered.map((e) => ({
      'ID':          e.id,
      'Loại':        EX_TYPE_LABEL[e.type],
      'Biển số':     e.vehiclePlate,
      'Slot':        e.slotCode,
      'Thời gian':   new Date(e.timestamp).toLocaleString('vi-VN'),
      'Nhân viên':   e.staffName,
      'Trạng thái':  EX_STATUS_LABEL[e.status],
      'Ghi chú':     e.notes ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ngoại lệ')
    XLSX.writeFile(wb, `ngoai-le-${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success('Đang tải file xuống...')
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Theo dõi ngoại lệ</h1>
          <p className="text-sm text-gray-500 mt-0.5">Giám sát và theo dõi các sự kiện bất thường trong bãi xe</p>
        </div>
        <button
          onClick={exportExcel}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700
                     text-white text-sm font-medium shadow-sm transition-colors"
        >
          <FileDown className="w-4 h-4" />
          Xuất báo cáo ({filtered.length} bản ghi)
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard
          label="Mất thẻ QR hôm nay"
          value={lostQrToday}
          color="border-red-200"
          icon={<QrCode className="w-5 h-5 text-red-500" />}
        />
        <MetricCard
          label="Sai biển số hôm nay"
          value={wrongPlateToday}
          color="border-yellow-200"
          icon={<ScanLine className="w-5 h-5 text-yellow-500" />}
        />
        <MetricCard
          label="Xe đang quá hạn"
          value={overtimeCount}
          sub={`Ngưỡng ${threshold}h`}
          color={overtimeCount > 0 ? 'border-orange-300' : 'border-gray-200'}
          icon={<Clock className={cn('w-5 h-5', overtimeCount > 0 ? 'text-orange-500' : 'text-gray-400')} />}
        />
        <MetricCard
          label="Sensor lỗi active"
          value={sensorErrCount}
          color={sensorErrCount > 0 ? 'border-gray-400' : 'border-gray-200'}
          icon={<Cpu className={cn('w-5 h-5', sensorErrCount > 0 ? 'text-gray-600' : 'text-gray-400')} />}
        />
      </div>

      {/* Section: Xe quá hạn */}
      {overtimeSessions.length > 0 && OvertimeSection()}

      {/* Section: Sensor lỗi */}
      {sensorAlerts.length > 0 && SensorSection()}

      {/* Filter + Table */}
      {ExceptionTable()}

      {/* Detail modal */}
      {detailEx && DetailModal()}

      {/* Note modal */}
      {noteModal && NoteModal()}
    </PageWrapper>
  )

  // ─── Section: xe quá hạn ─────────────────────────────────────────────────
  function OvertimeSection() {
    return (
      <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden mb-6">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-orange-100 bg-orange-50">
          <Clock className="w-4 h-4 text-orange-500" />
          <h2 className="font-semibold text-orange-800 text-sm">
            Xe đang quá hạn ({overtimeSessions.length})
          </h2>
          <span className="ml-auto text-xs text-orange-500">
            Ngưỡng {threshold}h · Phụ trội {surchargePct}%
          </span>
        </div>
        <div className="divide-y divide-orange-50">
          {overtimeSessions.map((sess) => {
            const diffMs    = Date.now() - new Date(sess.checkInTime).getTime()
            const overMs    = diffMs - threshold * 3_600_000
            const fee       = calculateFee(sess, new Date())
            const surcharge = Math.round(fee.total * surchargePct / 100)
            const estimated = fee.total + surcharge
            const isMonitor = monitoredIds.has(sess.id)

            return (
              <div key={sess.id}
                className={cn(
                  'px-5 py-3.5 flex flex-wrap items-center gap-3 transition-colors',
                  isMonitor ? 'bg-blue-50/50' : 'hover:bg-orange-50/30',
                )}>
                {/* Biển số + slot */}
                <div className="min-w-[120px]">
                  <p className="font-mono font-bold text-gray-900 text-sm">{sess.vehiclePlate}</p>
                  <p className="text-xs text-gray-500">Slot {sess.slotCode}</p>
                </div>

                {/* Giờ vào */}
                <div className="min-w-[110px]">
                  <p className="text-xs text-gray-500">Giờ vào</p>
                  <p className="text-sm font-medium text-gray-800">
                    {new Date(sess.checkInTime).toLocaleString('vi-VN', {
                      hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit',
                    })}
                  </p>
                </div>

                {/* Thời gian quá hạn — realtime */}
                <div className="min-w-[140px]">
                  <p className="text-xs text-gray-500">Tổng thời gian</p>
                  <p className="text-sm font-mono font-bold text-orange-600">
                    {formatDurationFull(diffMs)}
                  </p>
                  <p className="text-xs text-red-500 font-medium">
                    Quá: {formatDurationFull(overMs)}
                  </p>
                </div>

                {/* Phí ước tính */}
                <div className="min-w-[130px]">
                  <p className="text-xs text-gray-500">Phí ước tính</p>
                  <p className="text-sm font-semibold text-gray-900">{fmt(estimated)}</p>
                  <p className="text-xs text-orange-500">Phụ trội: +{fmt(surcharge)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => toggleMonitor(sess.id)}
                    className={cn(
                      'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors',
                      isMonitor
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700',
                    )}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {isMonitor ? 'Đang theo dõi' : 'Theo dõi'}
                  </button>
                  {/* Tìm exception tương ứng để ghi chú */}
                  {(() => {
                    const linked = exceptions.find((e) => e.sessionId === sess.id)
                    return (
                      <button
                        onClick={() => linked && openNoteModal(linked.id, linked.notes)}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg
                                   bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Ghi chú
                      </button>
                    )
                  })()}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── Section: sensor lỗi ─────────────────────────────────────────────────
  function SensorSection() {
    return (
      <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden mb-6">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-200 bg-gray-50">
          <Cpu className="w-4 h-4 text-gray-600" />
          <h2 className="font-semibold text-gray-800 text-sm">
            Sensor lỗi đang active ({sensorAlerts.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {sensorAlerts.map((alert) => (
            <div key={alert.id}
              className="px-5 py-3.5 flex flex-wrap items-center gap-3 hover:bg-gray-50 transition-colors">
              {/* Slot code */}
              <div className="min-w-[100px]">
                <p className="text-xs text-gray-500">Slot</p>
                <p className="font-mono font-bold text-gray-900">{alert.slotCode}</p>
              </div>

              {/* Message */}
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm text-gray-700">{alert.message}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(alert.timestamp).toLocaleString('vi-VN')}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <button
                  onClick={() => navigate(`/manager/slots?highlight=${alert.slotCode}`)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg
                             bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Xem trên SlotGrid
                </button>
                <button
                  onClick={() => moveToMaintenance(alert.slotCode)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg
                             bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors border border-amber-200"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  Chuyển Bảo trì
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── Exception table ─────────────────────────────────────────────────────
  function ExceptionTable() {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-gray-50">
          <AlertTriangle className="w-4 h-4 text-gray-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-800">Danh sách ngoại lệ</span>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as ExceptionType | 'all')}
            className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5
                       bg-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">Tất cả loại</option>
            <option value="lost_qr">Mất thẻ QR</option>
            <option value="wrong_plate">Sai biển số</option>
            <option value="wrong_zone">Sai khu vực</option>
            <option value="overtime">Quá hạn</option>
            <option value="sensor_error">Sensor lỗi</option>
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ExceptionStatus | 'all')}
            className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5
                       bg-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chờ xử lý</option>
            <option value="monitoring">Đang theo dõi</option>
            <option value="resolved">Đã xử lý</option>
          </select>

          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white
                         focus:outline-none focus:border-blue-500"
            />
            <span className="text-gray-400 text-sm">—</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white
                         focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Clear filters */}
          {(filterType !== 'all' || filterStatus !== 'all' || dateFrom || dateTo) && (
            <button
              onClick={() => { setFilterType('all'); setFilterStatus('all'); setDateFrom(''); setDateTo('') }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Xóa filter
            </button>
          )}

          <span className="ml-auto text-xs text-gray-400">{filtered.length} bản ghi</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-semibold">ID</th>
                <th className="px-4 py-3 text-left font-semibold">Loại ngoại lệ</th>
                <th className="px-4 py-3 text-left font-semibold">Biển số</th>
                <th className="px-4 py-3 text-left font-semibold">Slot</th>
                <th className="px-4 py-3 text-left font-semibold">Thời gian phát sinh</th>
                <th className="px-4 py-3 text-left font-semibold">Nhân viên</th>
                <th className="px-4 py-3 text-left font-semibold">Trạng thái</th>
                <th className="px-4 py-3 text-center font-semibold">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-gray-400">
                    Không có ngoại lệ nào phù hợp với điều kiện lọc
                  </td>
                </tr>
              ) : pageData.map((ex) => (
                <tr key={ex.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{ex.id}</td>
                  <td className="px-4 py-3"><TypeBadge type={ex.type} /></td>
                  <td className="px-4 py-3 font-mono font-semibold text-gray-800">{ex.vehiclePlate}</td>
                  <td className="px-4 py-3">
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono font-semibold">
                      {ex.slotCode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {new Date(ex.timestamp).toLocaleString('vi-VN')}
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{ex.staffName}</td>
                  <td className="px-4 py-3"><StatusBadge status={ex.status} /></td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setDetailEx(ex)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600
                                 hover:text-blue-800 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">
              Trang {page}/{totalPages} · {filtered.length} bản ghi
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | '…')[]>((acc, p, i, arr) => {
                  if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('…')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) =>
                  p === '…' ? (
                    <span key={`dots-${i}`} className="px-2 text-gray-400 text-xs">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={cn(
                        'w-8 h-8 text-xs rounded-lg transition-colors font-medium',
                        page === p ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 text-gray-600',
                      )}
                    >
                      {p}
                    </button>
                  ),
                )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Detail modal ─────────────────────────────────────────────────────────
  function DetailModal() {
    if (!detailEx) return null
    const ex = detailEx
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={() => setDetailEx(null)} />
        <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh]
                        overflow-y-auto flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 rounded-t-2xl">
            <TypeBadge type={ex.type} />
            <StatusBadge status={ex.status} />
            <button onClick={() => setDetailEx(null)} className="ml-auto text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Thông tin cơ bản */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-xs text-gray-500">Biển số</span>
                <p className="font-mono font-bold text-gray-900">{ex.vehiclePlate}</p>
              </div>
              <div><span className="text-xs text-gray-500">Slot</span>
                <p className="font-mono font-semibold text-gray-800">{ex.slotCode}</p>
              </div>
              <div><span className="text-xs text-gray-500">Thời gian phát sinh</span>
                <p className="font-medium text-gray-800">
                  {new Date(ex.timestamp).toLocaleString('vi-VN')}
                </p>
              </div>
              <div><span className="text-xs text-gray-500">Nhân viên phụ trách</span>
                <p className="font-medium text-gray-800">{ex.staffName}</p>
              </div>
            </div>

            {/* Ghi chú nhân viên */}
            {ex.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" /> Ghi chú nhân viên
                </p>
                <p className="text-sm text-amber-900">{ex.notes}</p>
              </div>
            )}

            {/* Ảnh xác minh — camera chưa tích hợp */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                <Image className="w-3.5 h-3.5" /> Ảnh xác minh
              </p>
              <div className="grid grid-cols-2 gap-2">
                {['Camera vào', 'Camera khu vực'].map((label) => (
                  <div key={label}
                    className="bg-gray-100 border border-dashed border-gray-300 rounded-xl
                               h-24 flex flex-col items-center justify-center gap-1 text-gray-400">
                    <Image className="w-6 h-6" />
                    <p className="text-xs">{label}</p>
                    <p className="text-xs text-gray-300">Chưa có camera</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-3">Timeline xử lý</p>
              <ol className="relative border-l border-gray-200 space-y-4 ml-2">
                {ex.timeline.map((ev, i) => (
                  <li key={i} className="ml-4">
                    <div className="absolute -left-1.5 w-3 h-3 rounded-full border-2 border-white
                                    bg-blue-400 mt-0.5" />
                    <time className="text-xs text-gray-400">
                      {new Date(ev.time).toLocaleString('vi-VN')}
                    </time>
                    <p className="text-xs font-semibold text-gray-700 mt-0.5">{ev.actor}</p>
                    <p className="text-sm text-gray-800">{ev.action}</p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Thay đổi trạng thái */}
            {ex.status !== 'resolved' && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                <p className="w-full text-xs font-semibold text-gray-600 mb-1">Cập nhật trạng thái</p>
                {ex.status === 'pending' && (
                  <button
                    onClick={() => { changeStatus(ex.id, 'monitoring'); setDetailEx({ ...ex, status: 'monitoring' }) }}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium
                               bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> Đánh dấu Theo dõi
                  </button>
                )}
                <button
                  onClick={() => { changeStatus(ex.id, 'resolved'); setDetailEx({ ...ex, status: 'resolved' }) }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium
                             bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Đánh dấu Đã xử lý
                </button>
                <button
                  onClick={() => { setDetailEx(null); openNoteModal(ex.id, ex.notes) }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium
                             bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Thêm ghi chú
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── Note modal ───────────────────────────────────────────────────────────
  function NoteModal() {
    if (!noteModal) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={() => setNoteModal(null)} />
        <div className="relative z-10 bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              Ghi chú
            </h3>
            <button onClick={() => setNoteModal(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Nhập ghi chú quan sát, hành động đã thực hiện..."
            rows={4}
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-300 resize-none
                       focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            autoFocus
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={saveNote}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white
                         text-sm font-medium transition-colors"
            >
              Lưu ghi chú
            </button>
            <button
              onClick={() => setNoteModal(null)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50
                         text-gray-700 text-sm transition-colors"
            >
              Hủy
            </button>
          </div>
        </div>
      </div>
    )
  }
}

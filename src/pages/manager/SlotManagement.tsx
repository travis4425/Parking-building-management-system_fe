// Trang quản lý slot — bảng, filter, phân trang, modal sửa trạng thái, confirm dialog
// Bãi xe cố định — không cho thêm/xóa slot
import { useState, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Pencil, Search, ChevronLeft, ChevronRight,
  X, AlertTriangle, ParkingSquare, Filter,
} from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import { useSlotStore } from '@/store/slotStore'
import { cn } from '@/utils/cn'
import type { ParkingSlot, SlotStatus, VehicleType } from '@/utils/types'

// ─── Hằng số ─────────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 10

const STATUS_META: Record<SlotStatus, { label: string; badge: string; desc: string }> = {
  available:   { label: 'Trống',     badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', desc: 'Slot sẵn sàng nhận xe'          },
  occupied:    { label: 'Có xe',     badge: 'bg-red-100 text-red-700 border-red-200',             desc: 'Đang có xe — hệ thống quản lý'   },
  reserved:    { label: 'Đặt trước', badge: 'bg-yellow-100 text-yellow-700 border-yellow-200',    desc: 'Đã đặt trước — hệ thống quản lý' },
  maintenance: { label: 'Bảo trì',   badge: 'bg-orange-100 text-orange-700 border-orange-200',    desc: 'Tạm ngừng — đang sửa chữa'       },
  locked:      { label: 'Khóa',      badge: 'bg-slate-100 text-slate-700 border-slate-300',       desc: 'Khóa hoàn toàn — không sử dụng'  },
}

const VEHICLE_LABEL: Record<VehicleType, string> = {
  motorbike: 'Xe máy',
  car:       'Ô tô',
  truck:     'Xe tải',
}

// Chỉ manager mới được set 3 trạng thái này thủ công
type EditableStatus = 'available' | 'maintenance' | 'locked'
const EDITABLE_STATUSES: EditableStatus[] = ['available', 'maintenance', 'locked']

// ─── StatusBadge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: SlotStatus }) {
  const { label, badge } = STATUS_META[status]
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', badge)}>
      {label}
    </span>
  )
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// ─── Confirm dialog (chỉ dùng khi chuyển sang Bảo trì) ───────────────────────
function ConfirmDialog({ open, slotCode, onConfirm, onCancel }: {
  open: boolean; slotCode: string; onConfirm: () => void; onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative z-10 bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Xác nhận chuyển Bảo trì?</p>
            <p className="text-sm text-gray-500 mt-1">
              Slot <span className="font-mono font-bold text-gray-800">{slotCode}</span> sẽ
              tạm ngừng hoạt động. Xe đang đặt chỗ (nếu có) sẽ bị hủy.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700">
            Hủy
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium">
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal sửa trạng thái — dùng useState thay react-hook-form (radio group đơn giản) ──
function EditStatusModal({ open, slot, onClose, onSave }: {
  open: boolean
  slot: ParkingSlot | null
  onClose: () => void
  onSave: (status: EditableStatus) => void
}) {
  const [selected, setSelected] = useState<EditableStatus>('available')

  // Đồng bộ giá trị mỗi khi mở modal với slot khác nhau
  useEffect(() => {
    if (slot) {
      const safe: EditableStatus = (EDITABLE_STATUSES as string[]).includes(slot.status)
        ? (slot.status as EditableStatus)
        : 'available'
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(safe)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot?.id])

  if (!slot) return null

  const isSystemControlled = slot.status === 'occupied' || slot.status === 'reserved'

  return (
    <Modal open={open} onClose={onClose} title={`Sửa trạng thái — ${slot.code}`}>
      {/* Cảnh báo nếu slot đang do hệ thống quản lý */}
      {isSystemControlled && (
        <div className="flex items-start gap-2 p-3 mb-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-yellow-600" />
          <span>
            Slot đang ở trạng thái <strong>{STATUS_META[slot.status].label}</strong> — do hệ thống quản lý.
            Ghi đè sẽ hủy phiên đỗ hiện tại.
          </span>
        </div>
      )}

      <div className="space-y-2 mb-5">
        {EDITABLE_STATUSES.map((status) => (
          <label
            key={status}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
              selected === status
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            )}
          >
            <input
              type="radio"
              name="edit-status"
              value={status}
              checked={selected === status}
              onChange={() => setSelected(status)}
              className="accent-blue-600 w-4 h-4 shrink-0"
            />
            <div className="flex items-center gap-2.5 min-w-0">
              <StatusBadge status={status} />
              <span className="text-sm text-gray-600 truncate">
                {STATUS_META[status].desc}
              </span>
            </div>
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onClose}
          className="flex-1 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700">
          Hủy
        </button>
        <button
          type="button"
          onClick={() => onSave(selected)}
          className="flex-1 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
        >
          Lưu thay đổi
        </button>
      </div>
    </Modal>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ current, total, onChange }: {
  current: number; total: number; onChange: (p: number) => void
}) {
  if (total <= 1) return null

  const pages: (number | '...')[] = []
  const add = (n: number) => { if (!pages.includes(n)) pages.push(n) }

  add(1)
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) add(i)
  add(total)

  const withEllipsis: (number | '...')[] = []
  pages.forEach((p, i) => {
    if (i > 0 && typeof p === 'number' && typeof pages[i - 1] === 'number') {
      if ((p as number) - (pages[i - 1] as number) > 1) withEllipsis.push('...')
    }
    withEllipsis.push(p)
  })

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(current - 1)} disabled={current === 1}
        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600">
        <ChevronLeft className="w-4 h-4" />
      </button>
      {withEllipsis.map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} className="px-1.5 text-gray-400 text-sm">…</span>
        ) : (
          <button key={p} onClick={() => onChange(p as number)}
            className={cn(
              'min-w-[32px] h-8 px-2 text-sm rounded-lg border transition-colors',
              current === p
                ? 'bg-blue-600 border-blue-600 text-white font-medium'
                : 'border-gray-200 hover:bg-gray-50 text-gray-700'
            )}>
            {p}
          </button>
        )
      )}
      <button onClick={() => onChange(current + 1)} disabled={current === total}
        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SlotManagement() {
  // Đọc từ store — cùng nguồn dữ liệu với Dashboard
  const slots           = useSlotStore((s) => s.slots)
  const updateSlotStatus = useSlotStore((s) => s.updateSlotStatus)

  // Filter state
  const [search, setSearch]           = useState('')
  const [floorFilter, setFloorFilter] = useState<number | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<SlotStatus | 'all'>('all')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // Modal state
  const [editSlot, setEditSlot]         = useState<ParkingSlot | null>(null)
  const [confirmData, setConfirmData]   = useState<{ slot: ParkingSlot; newStatus: SlotStatus } | null>(null)

  // ── Filtered & paginated ──
  const filtered = useMemo(() => slots.filter((s) => {
    const matchSearch = s.code.toLowerCase().includes(search.toLowerCase())
    const matchFloor  = floorFilter === 'all' || s.floor === floorFilter
    const matchStatus = statusFilter === 'all' || s.status === statusFilter
    return matchSearch && matchFloor && matchStatus
  }), [slots, search, floorFilter, statusFilter])

  // Reset trang 1 khi filter thay đổi
  function applyFilter<T>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) {
    setter(value)
    setCurrentPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated  = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  // ── Xử lý save từ modal ──
  function handleEditSave(newStatus: EditableStatus) {
    if (!editSlot) return
    if (newStatus === 'maintenance') {
      setConfirmData({ slot: editSlot, newStatus })
      setEditSlot(null)
    } else {
      updateSlotStatus(editSlot.id, newStatus)
      setEditSlot(null)
      toast.success('Đã lưu thông tin slot')
    }
  }

  function confirmStatusChange(slotId: string, newStatus: SlotStatus) {
    const slot = slots.find((s) => s.id === slotId)
    updateSlotStatus(slotId, newStatus)
    setConfirmData(null)
    if (newStatus === 'maintenance' && slot) toast.warning(`Slot ${slot.code} đã chuyển sang Bảo trì`)
  }

  // ── Summary stats ──
  const summary = useMemo(() => ({
    total:       slots.length,
    available:   slots.filter((s) => s.status === 'available').length,
    occupied:    slots.filter((s) => s.status === 'occupied').length,
    maintenance: slots.filter((s) => s.status === 'maintenance').length,
    locked:      slots.filter((s) => s.status === 'locked').length,
  }), [slots])

  return (
    <PageWrapper>
      {/* ── Header ── */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Quản lý slot</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Bãi xe cố định · Tổng <strong>{summary.total}</strong> slot
        </p>
      </div>

      {/* ── Summary badges ── */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { label: 'Trống',    value: summary.available,   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          { label: 'Có xe',   value: summary.occupied,    cls: 'bg-red-50 text-red-700 border-red-200'             },
          { label: 'Bảo trì', value: summary.maintenance, cls: 'bg-orange-50 text-orange-700 border-orange-200'    },
          { label: 'Khóa',    value: summary.locked,      cls: 'bg-slate-50 text-slate-700 border-slate-200'       },
        ].map(({ label, value, cls }) => (
          <span key={label} className={cn('text-xs font-medium px-2.5 py-1 rounded-full border', cls)}>
            {label}: <strong>{value}</strong>
          </span>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm mã slot..."
            value={search}
            onChange={(e) => applyFilter(setSearch, e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-white
                       outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Floor filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={floorFilter}
            onChange={(e) => applyFilter(setFloorFilter, e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="pl-2 pr-6 py-2 text-sm rounded-lg border border-gray-200 bg-white outline-none
                       focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Tất cả tầng</option>
            {[1, 2, 3].map((f) => <option key={f} value={f}>Tầng {f}</option>)}
          </select>
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => applyFilter(setStatusFilter, e.target.value as SlotStatus | 'all')}
          className="pl-2 pr-6 py-2 text-sm rounded-lg border border-gray-200 bg-white outline-none
                     focus:border-blue-500 cursor-pointer"
        >
          <option value="all">Tất cả trạng thái</option>
          {(Object.keys(STATUS_META) as SlotStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>

        {/* Xóa filter */}
        {(search || floorFilter !== 'all' || statusFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setFloorFilter('all'); setStatusFilter('all'); setCurrentPage(1) }}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700
                       rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Xóa lọc
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Mã slot</th>
                <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Tầng</th>
                <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Khu vực</th>
                <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Loại xe</th>
                <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Trạng thái</th>
                <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Cập nhật</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-center whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <ParkingSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Không có slot nào phù hợp</p>
                  </td>
                </tr>
              ) : (
                paginated.map((slot) => (
                  <tr key={slot.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">{slot.code}</td>
                    <td className="px-4 py-3 text-gray-700">Tầng {slot.floor}</td>
                    <td className="px-4 py-3 text-gray-700">Khu {slot.zone}</td>
                    <td className="px-4 py-3 text-gray-700">{VEHICLE_LABEL[slot.vehicleType]}</td>
                    <td className="px-4 py-3"><StatusBadge status={slot.status} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(slot.updatedAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setEditSlot(slot)}
                        title="Sửa trạng thái"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600
                                   hover:bg-blue-50 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination + info ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Hiển thị{' '}
          <span className="font-medium text-gray-700">
            {filtered.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}
            –{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}
          </span>
          {' '}/ <span className="font-medium text-gray-700">{filtered.length}</span> slot
        </p>
        <Pagination current={currentPage} total={totalPages} onChange={setCurrentPage} />
      </div>

      {/* ── Modals ── */}
      <EditStatusModal
        open={editSlot !== null}
        slot={editSlot}
        onClose={() => setEditSlot(null)}
        onSave={handleEditSave}
      />

      <ConfirmDialog
        open={confirmData !== null}
        slotCode={confirmData?.slot.code ?? ''}
        onConfirm={() => confirmData && confirmStatusChange(confirmData.slot.id, confirmData.newStatus)}
        onCancel={() => setConfirmData(null)}
      />
    </PageWrapper>
  )
}

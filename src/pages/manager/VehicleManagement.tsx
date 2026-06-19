// Trang quản lý loại phương tiện: bảng CRUD + ma trận phân tầng theo loại xe
// Đã nối API thật: GET/PATCH/DELETE /vehicle-types, GET /zones, GET/POST/DELETE /zone-vehicle-rules
// Lưu ý: hệ thống chỉ vận hành đúng 3 loại xe cố định (Xe máy/Xe đạp/Ô tô) — mã loại xe (code)
// được dùng cứng ở tầng tính phí & check-in (xem src/api/mappers.ts), nên không cho thêm loại xe mới ở đây.
import { useEffect, useState } from 'react'
import PageWrapper from '@/components/layout/PageWrapper'
import { toast } from 'sonner'
import {
  Pencil, Trash2, X,
  Car, AlertTriangle, Layers, Loader2,
} from 'lucide-react'
import {
  fetchVehicleTypes, updateVehicleTypeApi, deleteVehicleTypeApi,
  fetchZones, fetchZoneVehicleRules, setZoneVehicleRule,
  type BeVehicleType, type BeZone,
} from '@/api/vehicleTypesApi'

// ─── Kiểu dữ liệu nội bộ ────────────────────────────────────────────────────

interface VehicleForm {
  name:        string
  description: string
  maxWidth:    string    // cm — string để control input dễ hơn
  maxHeight:   string    // cm
}

type FormErrors = Partial<Record<'name' | 'maxWidth' | 'maxHeight', string>>

const FORM_INIT: VehicleForm = { name: '', description: '', maxWidth: '', maxHeight: '' }

function toForm(v: BeVehicleType): VehicleForm {
  return {
    name:        v.name,
    description: v.description ?? '',
    maxWidth:    v.maxWidth  != null ? String(v.maxWidth)  : '',
    maxHeight:   v.maxHeight != null ? String(v.maxHeight) : '',
  }
}

const DIM_FIELDS = [
  { key: 'maxWidth'  as const, label: 'Rộng' },
  { key: 'maxHeight' as const, label: 'Cao' },
]

// ─── Component chính ─────────────────────────────────────────────────────────

export default function VehicleManagement() {
  const [vehicles, setVehicles]   = useState<BeVehicleType[]>([])
  const [zones, setZones]         = useState<BeZone[]>([])
  // vehicleTypeId -> Set<zoneId> đang được phép đỗ
  const [rules, setRules]         = useState<Record<string, Set<string>>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [savingCell, setSavingCell] = useState<string | null>(null) // `${vehicleId}-${floor}`

  const [editId, setEditId]         = useState<string | null>(null)
  const [form, setForm]             = useState<VehicleForm>(FORM_INIT)
  const [formErr, setFormErr]       = useState<FormErrors>({})
  const [isSaving, setIsSaving]     = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const [vTypes, zoneList] = await Promise.all([fetchVehicleTypes(), fetchZones()])
        if (cancelled) return
        setVehicles(vTypes)
        setZones(zoneList)
        const ruleLists = await Promise.all(vTypes.map((v) => fetchZoneVehicleRules(v.id)))
        if (cancelled) return
        const next: Record<string, Set<string>> = {}
        vTypes.forEach((v, i) => { next[v.id] = new Set(ruleLists[i].map((r) => r.zoneId)) })
        setRules(next)
      } catch (err) {
        console.error('Lỗi tải loại phương tiện:', err)
        toast.error('Không tải được dữ liệu loại phương tiện')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const floors = [...new Set(zones.map((z) => z.floor))].sort((a, b) => a - b)
  const zonesByFloor = (floor: number) => zones.filter((z) => z.floor === floor).map((z) => z.id)

  function allowedFloors(vehicleId: string): number[] {
    const zoneIds = rules[vehicleId] ?? new Set<string>()
    return floors.filter((f) => zonesByFloor(f).some((zid) => zoneIds.has(zid)))
  }

  // ── Modal sửa ───────────────────────────────────────────────────────────────

  function openEdit(v: BeVehicleType) {
    setForm(toForm(v))
    setFormErr({})
    setEditId(v.id)
  }

  function closeModal() { setEditId(null); setFormErr({}) }

  function validate(): boolean {
    const errs: FormErrors = {}
    if (!form.name.trim()) errs.name = 'Tên loại xe không được để trống'
    if (form.maxWidth  && isNaN(Number(form.maxWidth)))  errs.maxWidth  = 'Phải là số'
    if (form.maxHeight && isNaN(Number(form.maxHeight))) errs.maxHeight = 'Phải là số'
    setFormErr(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!editId || !validate()) return
    setIsSaving(true)
    try {
      const updated = await updateVehicleTypeApi(editId, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        maxWidth: form.maxWidth ? Number(form.maxWidth) : undefined,
        maxHeight: form.maxHeight ? Number(form.maxHeight) : undefined,
      })
      setVehicles((prev) => prev.map((v) => (v.id === editId ? updated : v)))
      toast.success('Đã lưu thay đổi')
      closeModal()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Lưu thất bại')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDeleteConfirm() {
    if (!confirmDeleteId) return
    setIsDeleting(true)
    try {
      await deleteVehicleTypeApi(confirmDeleteId)
      setVehicles((prev) => prev.filter((v) => v.id !== confirmDeleteId))
      toast.success('Đã xóa loại xe')
      setConfirmDeleteId(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Xóa thất bại — loại xe có thể đang được dùng trong phiên đỗ/bảng giá')
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Ma trận phân tầng ────────────────────────────────────────────────────────

  async function toggleMatrix(floor: number, vehicleId: string) {
    const cellKey = `${vehicleId}-${floor}`
    const zoneIds = zonesByFloor(floor)
    if (zoneIds.length === 0) return
    const current = rules[vehicleId] ?? new Set<string>()
    const isAllowed = zoneIds.some((zid) => current.has(zid))
    setSavingCell(cellKey)
    try {
      if (isAllowed) {
        await Promise.all(zoneIds.filter((zid) => current.has(zid)).map((zid) => setZoneVehicleRule(zid, vehicleId, false)))
      } else {
        await Promise.all(zoneIds.filter((zid) => !current.has(zid)).map((zid) => setZoneVehicleRule(zid, vehicleId, true)))
      }
      setRules((prev) => {
        const next = new Set(prev[vehicleId] ?? [])
        zoneIds.forEach((zid) => (isAllowed ? next.delete(zid) : next.add(zid)))
        return { ...prev, [vehicleId]: next }
      })
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Cập nhật phân tầng thất bại')
    } finally {
      setSavingCell(null)
    }
  }

  // ──────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center py-24 text-gray-400 gap-2">
          <Loader2 size={18} className="animate-spin" /> Đang tải dữ liệu loại phương tiện...
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      {/* ── Header ── */}
      <div className="mb-6 flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Quản lý loại phương tiện</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {vehicles.length} loại xe — hệ thống chỉ hỗ trợ đúng 3 loại xe cố định (Xe máy / Xe đạp / Ô tô)
          </p>
        </div>
      </div>

      {/* ── Bảng danh sách loại phương tiện ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Tên loại xe', 'Mã', 'Mô tả', 'Kích thước tối đa (cm)', 'Tầng được phép', 'Thao tác'].map((h) => (
                  <th key={h}
                    className="px-4 py-3 text-left font-semibold text-gray-600
                               text-xs uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-400">
                    Chưa có loại phương tiện nào trong hệ thống.
                  </td>
                </tr>
              ) : vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Car size={15} className="text-blue-600" />
                      </div>
                      <span className="font-semibold text-gray-800">{v.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-xs text-gray-500">{v.code}</span>
                  </td>
                  <td className="px-4 py-3.5 max-w-xs">
                    <span className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {v.description || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-xs text-gray-700 bg-gray-100
                                     px-2.5 py-1 rounded-md whitespace-nowrap">
                      {v.maxWidth ?? '—'} × {v.maxHeight ?? '—'}
                    </span>
                    <div className="text-xs text-gray-400 mt-0.5">rộng × cao</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1.5 flex-wrap">
                      {floors.map((f) => (
                        <span key={f}
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold
                            ${allowedFloors(v.id).includes(f)
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-300 line-through'}`}>
                          T{f}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                   bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                        <Pencil size={11} /> Sửa
                      </button>
                      <button onClick={() => setConfirmDeleteId(v.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                   bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                        <Trash2 size={11} /> Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section phân tầng theo loại xe ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Layers size={15} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Phân tầng theo loại xe</h3>
              <p className="text-xs text-gray-400 mt-0.5">Bật/tắt sẽ lưu ngay vào hệ thống (zone-vehicle-rules)</p>
            </div>
          </div>
        </div>

        {vehicles.length === 0 || floors.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            Chưa có dữ liệu loại xe hoặc khu/tầng để cấu hình phân tầng
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600
                                  text-xs uppercase tracking-wide w-36">
                    Tầng
                  </th>
                  {vehicles.map((v) => (
                    <th key={v.id}
                      className="px-4 py-3 text-center font-semibold text-gray-600
                                  text-xs uppercase tracking-wide whitespace-nowrap">
                      {v.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {floors.map((floor) => (
                  <tr key={floor} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700
                                         text-xs font-bold flex items-center justify-center">
                          {floor}
                        </span>
                        <span className="font-semibold text-gray-700">Tầng {floor}</span>
                      </div>
                    </td>
                    {vehicles.map((v) => {
                      const allowed = allowedFloors(v.id).includes(floor)
                      const cellKey = `${v.id}-${floor}`
                      const busy = savingCell === cellKey
                      return (
                        <td key={v.id} className="px-4 py-4 text-center">
                          <label className="inline-flex flex-col items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={allowed}
                              disabled={busy}
                              onChange={() => toggleMatrix(floor, v.id)}
                              className="w-5 h-5 rounded accent-indigo-600 cursor-pointer disabled:opacity-50"
                            />
                            <span className={`text-xs font-medium ${
                              allowed ? 'text-green-600' : 'text-gray-300'
                            }`}>
                              {busy ? '...' : allowed ? '✓ Cho phép' : '✗ Không'}
                            </span>
                          </label>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal sửa loại xe ── */}
      {editId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <h3 className="font-bold text-gray-800">Chỉnh sửa loại xe</h3>
              <button onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tên loại xe <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none
                    focus:ring-2 focus:ring-blue-300 transition-colors
                    ${formErr.name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                />
                {formErr.name && <p className="text-red-500 text-xs mt-1">{formErr.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mô tả</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Mô tả ngắn về loại xe, phạm vi áp dụng..."
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Kích thước tối đa (cm)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {DIM_FIELDS.map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <input
                        type="number" min="0"
                        value={form[key]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        placeholder="0"
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none
                          focus:ring-2 focus:ring-blue-300
                          ${formErr[key] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                      />
                      {formErr[key] && (
                        <p className="text-red-500 text-xs mt-0.5">{formErr[key]}</p>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Rộng × Cao — để trống nếu không giới hạn</p>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-5 pt-2 shrink-0 border-t border-gray-100">
              <button onClick={closeModal} disabled={isSaving}
                className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium
                           text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                Hủy
              </button>
              <button onClick={handleSave} disabled={isSaving}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium
                           hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60
                           flex items-center justify-center gap-2">
                {isSaving && <Loader2 size={14} className="animate-spin" />}
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm xóa ── */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 mb-1">Xác nhận xóa loại xe</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Hệ thống chỉ vận hành đúng 3 loại xe cố định. Xóa loại xe này có thể làm{' '}
                  <strong>hỏng luồng check-in và tính phí</strong> cho loại xe đó, và ảnh hưởng
                  bảng giá/slot đang cấu hình liên quan. Hành động không thể hoàn tác.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} disabled={isDeleting}
                className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium
                           text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                Hủy
              </button>
              <button onClick={handleDeleteConfirm} disabled={isDeleting}
                className="flex-1 bg-red-600 text-white rounded-lg py-2.5 text-sm font-medium
                           hover:bg-red-700 transition-colors shadow-sm disabled:opacity-60
                           flex items-center justify-center gap-2">
                {isDeleting && <Loader2 size={14} className="animate-spin" />}
                Xóa loại xe
              </button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  )
}

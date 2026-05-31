// Trang quản lý loại phương tiện: bảng CRUD + ma trận phân tầng theo loại xe
import { useState } from 'react'
import PageWrapper from '@/components/layout/PageWrapper'
import {
  Plus, Pencil, Trash2, X, Save,
  Car, CheckCircle, AlertTriangle, Layers,
} from 'lucide-react'

const FLOORS = [1, 2, 3] as const

// ─── Kiểu dữ liệu nội bộ ────────────────────────────────────────────────────

interface VehicleCategory {
  id:            number
  name:          string
  description:   string
  maxLength:     number    // cm
  maxWidth:      number    // cm
  maxHeight:     number    // cm
  allowedFloors: number[]
  status:        'active' | 'inactive'
}

interface VehicleForm {
  name:          string
  description:   string
  maxLength:     string    // string để control input dễ hơn
  maxWidth:      string
  maxHeight:     string
  allowedFloors: number[]
  status:        'active' | 'inactive'
}

type FormErrors = Partial<Record<'name' | 'allowedFloors' | 'maxLength' | 'maxWidth' | 'maxHeight', string>>

// ─── Mock data ban đầu ───────────────────────────────────────────────────────

const INITIAL_DATA: VehicleCategory[] = [
  {
    id: 1, name: 'Xe máy',
    description: 'Xe máy, xe đạp điện, xe tay ga, xe 2 bánh dưới 50cc–300cc',
    maxLength: 200, maxWidth: 80, maxHeight: 120,
    allowedFloors: [1, 2, 3], status: 'active',
  },
  {
    id: 2, name: 'Ô tô',
    description: 'Ô tô du lịch, SUV, sedan, MPV, xe 7 chỗ trở xuống',
    maxLength: 500, maxWidth: 200, maxHeight: 180,
    allowedFloors: [1, 2, 3], status: 'active',
  },
  {
    id: 3, name: 'Xe tải nhỏ',
    description: 'Xe tải nhẹ dưới 2.5 tấn, xe pickup, xe van',
    maxLength: 600, maxWidth: 220, maxHeight: 220,
    allowedFloors: [1], status: 'active',
  },
]

const FORM_INIT: VehicleForm = {
  name: '', description: '',
  maxLength: '', maxWidth: '', maxHeight: '',
  allowedFloors: [1, 2, 3], status: 'active',
}

function toForm(v: VehicleCategory): VehicleForm {
  return {
    name:          v.name,
    description:   v.description,
    maxLength:     String(v.maxLength),
    maxWidth:      String(v.maxWidth),
    maxHeight:     String(v.maxHeight),
    allowedFloors: [...v.allowedFloors],
    status:        v.status,
  }
}

// ─── Dimension fields config ─────────────────────────────────────────────────

const DIM_FIELDS = [
  { key: 'maxLength' as const, label: 'Dài' },
  { key: 'maxWidth'  as const, label: 'Rộng' },
  { key: 'maxHeight' as const, label: 'Cao' },
]

// ─── Component chính ─────────────────────────────────────────────────────────

export default function VehicleManagement() {
  const [vehicles, setVehicles] = useState<VehicleCategory[]>(INITIAL_DATA)

  // null = đóng modal, 'add' = thêm mới, number = sửa theo id
  const [modalId, setModalId]       = useState<null | 'add' | number>(null)
  const [form, setForm]             = useState<VehicleForm>(FORM_INIT)
  const [formErr, setFormErr]       = useState<FormErrors>({})
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  // Ma trận phân tầng — draft riêng, chỉ lưu khi nhấn nút
  const [matrixDraft, setMatrixDraft] = useState<Record<number, number[]>>(
    () => Object.fromEntries(INITIAL_DATA.map(v => [v.id, [...v.allowedFloors]]))
  )
  const [matrixSaved, setMatrixSaved] = useState(false)

  // ── Modal handlers ─────────────────────────────────────────────────────────

  function openAdd() {
    setForm(FORM_INIT)
    setFormErr({})
    setModalId('add')
  }

  function openEdit(v: VehicleCategory) {
    setForm(toForm(v))
    setFormErr({})
    setModalId(v.id)
  }

  function closeModal() { setModalId(null); setFormErr({}) }

  function toggleFloor(floor: number) {
    setForm(f => {
      const has = f.allowedFloors.includes(floor)
      return {
        ...f,
        allowedFloors: has
          ? f.allowedFloors.filter(fl => fl !== floor)
          : [...f.allowedFloors, floor].sort((a, b) => a - b),
      }
    })
  }

  function validate(): boolean {
    const errs: FormErrors = {}
    if (!form.name.trim()) errs.name = 'Tên loại xe không được để trống'
    if (form.allowedFloors.length === 0) errs.allowedFloors = 'Phải chọn ít nhất 1 tầng'
    if (form.maxLength && isNaN(Number(form.maxLength))) errs.maxLength = 'Phải là số'
    if (form.maxWidth  && isNaN(Number(form.maxWidth)))  errs.maxWidth  = 'Phải là số'
    if (form.maxHeight && isNaN(Number(form.maxHeight))) errs.maxHeight = 'Phải là số'
    setFormErr(errs)
    return Object.keys(errs).length === 0
  }

  function handleSave() {
    if (!validate()) return
    const data: Omit<VehicleCategory, 'id'> = {
      name:          form.name.trim(),
      description:   form.description.trim(),
      maxLength:     Math.max(0, Number(form.maxLength) || 0),
      maxWidth:      Math.max(0, Number(form.maxWidth)  || 0),
      maxHeight:     Math.max(0, Number(form.maxHeight) || 0),
      allowedFloors: [...form.allowedFloors],
      status:        form.status,
    }
    if (modalId === 'add') {
      const newId = Math.max(0, ...vehicles.map(v => v.id)) + 1
      setVehicles(prev => [...prev, { id: newId, ...data }])
      setMatrixDraft(prev => ({ ...prev, [newId]: data.allowedFloors }))
    } else {
      const id = modalId as number
      setVehicles(prev => prev.map(v => v.id === id ? { ...v, ...data } : v))
      setMatrixDraft(prev => ({ ...prev, [id]: data.allowedFloors }))
    }
    closeModal()
  }

  // ── Delete handlers ────────────────────────────────────────────────────────

  function handleDeleteConfirm() {
    if (confirmDeleteId === null) return
    setVehicles(prev => prev.filter(v => v.id !== confirmDeleteId))
    setMatrixDraft(prev => {
      const next = { ...prev }
      delete next[confirmDeleteId]
      return next
    })
    setConfirmDeleteId(null)
  }

  // ── Matrix handlers ────────────────────────────────────────────────────────

  function toggleMatrix(floor: number, vehicleId: number) {
    setMatrixDraft(prev => {
      const floors = prev[vehicleId] ?? []
      const has    = floors.includes(floor)
      return {
        ...prev,
        [vehicleId]: has
          ? floors.filter(f => f !== floor)
          : [...floors, floor].sort((a, b) => a - b),
      }
    })
    setMatrixSaved(false)
  }

  function handleSaveMatrix() {
    setVehicles(prev => prev.map(v => ({
      ...v,
      allowedFloors: matrixDraft[v.id] ?? v.allowedFloors,
    })))
    setMatrixSaved(true)
    setTimeout(() => setMatrixSaved(false), 2000)
  }

  // ──────────────────────────────────────────────────────────────────────────

  const isModalOpen = modalId !== null
  const isAddMode   = modalId === 'add'

  return (
    <PageWrapper>
      {/* ── Header ── */}
      <div className="mb-6 flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Quản lý loại phương tiện</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {vehicles.length} loại xe · {vehicles.filter(v => v.status === 'active').length} đang áp dụng
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg
                     hover:bg-blue-700 text-sm font-medium shadow-sm transition-colors">
          <Plus size={15} /> Thêm loại xe
        </button>
      </div>

      {/* ── Bảng danh sách loại phương tiện ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  'Tên loại xe', 'Mô tả', 'Kích thước tối đa (cm)',
                  'Tầng được phép', 'Trạng thái', 'Thao tác',
                ].map(h => (
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
                    Chưa có loại phương tiện nào. Nhấn "Thêm loại xe" để bắt đầu.
                  </td>
                </tr>
              ) : vehicles.map(v => (
                <tr key={v.id} className="hover:bg-gray-50/70 transition-colors">
                  {/* Tên */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Car size={15} className="text-blue-600" />
                      </div>
                      <span className="font-semibold text-gray-800">{v.name}</span>
                    </div>
                  </td>
                  {/* Mô tả */}
                  <td className="px-4 py-3.5 max-w-xs">
                    <span className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {v.description || '—'}
                    </span>
                  </td>
                  {/* Kích thước */}
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-xs text-gray-700 bg-gray-100
                                     px-2.5 py-1 rounded-md whitespace-nowrap">
                      {v.maxLength} × {v.maxWidth} × {v.maxHeight}
                    </span>
                    <div className="text-xs text-gray-400 mt-0.5">dài × rộng × cao</div>
                  </td>
                  {/* Tầng */}
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1.5 flex-wrap">
                      {FLOORS.map(f => (
                        <span key={f}
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold
                            ${v.allowedFloors.includes(f)
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-300 line-through'}`}>
                          T{f}
                        </span>
                      ))}
                    </div>
                  </td>
                  {/* Trạng thái */}
                  <td className="px-4 py-3.5">
                    {v.status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600">
                        <CheckCircle size={13} /> Đang áp dụng
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
                        <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" />
                        Tạm ngưng
                      </span>
                    )}
                  </td>
                  {/* Thao tác */}
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
        {/* Section header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Layers size={15} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Phân tầng theo loại xe</h3>
              <p className="text-xs text-gray-400 mt-0.5">Cấu hình tầng nào cho phép loại xe nào đỗ</p>
            </div>
          </div>
          <button onClick={handleSaveMatrix}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                        shadow-sm transition-all duration-200
                        ${matrixSaved
                          ? 'bg-green-600 text-white scale-95'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
            <Save size={14} />
            {matrixSaved ? 'Đã lưu!' : 'Lưu cấu hình'}
          </button>
        </div>

        {/* Matrix table */}
        {vehicles.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            Thêm loại xe trước để cấu hình phân tầng
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
                  {vehicles.map(v => (
                    <th key={v.id}
                      className="px-4 py-3 text-center font-semibold text-gray-600
                                  text-xs uppercase tracking-wide whitespace-nowrap">
                      {v.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {FLOORS.map(floor => (
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
                    {vehicles.map(v => {
                      const allowed = (matrixDraft[v.id] ?? v.allowedFloors).includes(floor)
                      return (
                        <td key={v.id} className="px-4 py-4 text-center">
                          <label className="inline-flex flex-col items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={allowed}
                              onChange={() => toggleMatrix(floor, v.id)}
                              className="w-5 h-5 rounded accent-indigo-600 cursor-pointer"
                            />
                            <span className={`text-xs font-medium ${
                              allowed ? 'text-green-600' : 'text-gray-300'
                            }`}>
                              {allowed ? '✓ Cho phép' : '✗ Không'}
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

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs text-gray-400">
            Thay đổi trong ma trận sẽ cập nhật cột "Tầng được phép" của từng loại xe. Nhấn "Lưu cấu hình" để áp dụng.
          </p>
        </div>
      </div>

      {/* ── Modal thêm / sửa loại xe ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <h3 className="font-bold text-gray-800">
                {isAddMode ? 'Thêm loại xe mới' : 'Chỉnh sửa loại xe'}
              </h3>
              <button onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
              {/* Tên loại xe */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tên loại xe <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="VD: Xe máy, Ô tô, Xe tải..."
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none
                    focus:ring-2 focus:ring-blue-300 transition-colors
                    ${formErr.name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                />
                {formErr.name && <p className="text-red-500 text-xs mt-1">{formErr.name}</p>}
              </div>

              {/* Mô tả */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mô tả</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Mô tả ngắn về loại xe, phạm vi áp dụng..."
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                />
              </div>

              {/* Kích thước */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Kích thước tối đa (cm)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {DIM_FIELDS.map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <input
                        type="number" min="0"
                        value={form[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
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
                <p className="text-xs text-gray-400 mt-1.5">
                  Dài × Rộng × Cao — để trống nếu không giới hạn
                </p>
              </div>

              {/* Tầng được phép */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tầng được phép đỗ <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  {FLOORS.map(floor => (
                    <label key={floor}
                      className="flex items-center gap-2 cursor-pointer select-none group">
                      <input
                        type="checkbox"
                        checked={form.allowedFloors.includes(floor)}
                        onChange={() => toggleFloor(floor)}
                        className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                      />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600
                                       transition-colors">
                        Tầng {floor}
                      </span>
                    </label>
                  ))}
                </div>
                {formErr.allowedFloors && (
                  <p className="text-red-500 text-xs mt-1">{formErr.allowedFloors}</p>
                )}
              </div>

              {/* Trạng thái toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Trạng thái</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      status: f.status === 'active' ? 'inactive' : 'active',
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full
                                transition-colors duration-200 focus:outline-none
                                ${form.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`}
                    aria-label="Toggle trạng thái"
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow
                                  transition-transform duration-200
                                  ${form.status === 'active' ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                  <span className={`text-sm font-medium transition-colors ${
                    form.status === 'active' ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {form.status === 'active' ? 'Đang áp dụng' : 'Tạm ngưng'}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 pb-5 pt-2 shrink-0 border-t border-gray-100">
              <button onClick={closeModal}
                className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium
                           text-gray-700 hover:bg-gray-50 transition-colors">
                Hủy
              </button>
              <button onClick={handleSave}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium
                           hover:bg-blue-700 transition-colors shadow-sm">
                {isAddMode ? 'Thêm loại xe' : 'Lưu thay đổi'}
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
                  Xóa loại xe này sẽ ảnh hưởng đến{' '}
                  <strong>bảng giá và slot đang cấu hình</strong> liên quan.
                  Hành động không thể hoàn tác.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium
                           text-gray-700 hover:bg-gray-50 transition-colors">
                Hủy
              </button>
              <button onClick={handleDeleteConfirm}
                className="flex-1 bg-red-600 text-white rounded-lg py-2.5 text-sm font-medium
                           hover:bg-red-700 transition-colors shadow-sm">
                Xóa loại xe
              </button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  )
}

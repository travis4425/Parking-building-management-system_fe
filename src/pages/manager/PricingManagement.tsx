// Trang quản lý bảng giá — thêm/sửa mức giá theo loại xe và quản lý khung giờ cao điểm
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Plus, X, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import { cn } from '@/utils/cn'
import { MOCK_PRICING, MOCK_PEAK_HOURS } from '@/api/mockPricing'
import type { PricingRule, PeakHourRange, VehicleType } from '@/utils/types'

// ─── Hằng số ─────────────────────────────────────────────────────────────────
const VEHICLE_META: Record<VehicleType, { label: string; icon: string }> = {
  motorbike: { label: 'Xe máy',  icon: '🛵' },
  car:       { label: 'Ô tô',    icon: '🚗' },
  truck:     { label: 'Xe tải',  icon: '🚚' },
}

function formatVND(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n) + ' ₫'
}

// ─── Zod schema mức giá — dùng valueAsNumber trên input ──────────────────────
const pricingSchema = z.object({
  vehicleType:   z.enum(['motorbike', 'car', 'truck']),
  normalRate:    z.number({ error: 'Nhập giá giờ thường' }).min(1_000, 'Tối thiểu 1,000 ₫'),
  peakRate:      z.number({ error: 'Nhập giá giờ cao điểm' }).min(1_000, 'Tối thiểu 1,000 ₫'),
  overnightRate: z.number({ error: 'Nhập giá qua đêm' }).min(1_000, 'Tối thiểu 1,000 ₫'),
  isActive:      z.boolean(),
})
type PricingForm = z.infer<typeof pricingSchema>

// ─── Zod schema khung giờ ────────────────────────────────────────────────────
const peakHourSchema = z.object({
  label:     z.string().min(1, 'Vui lòng nhập tên khung giờ'),
  startTime: z.string().min(1, 'Chọn giờ bắt đầu'),
  endTime:   z.string().min(1, 'Chọn giờ kết thúc'),
})
type PeakHourForm = z.infer<typeof peakHourSchema>

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-xl shadow-xl w-full max-w-lg">
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

// ─── Input field helper ───────────────────────────────────────────────────────
function Field({ label, error, children }: {
  label: string; error?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

const inputCls = (err?: string) => cn(
  'w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors bg-white',
  'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
  err ? 'border-red-400' : 'border-gray-300'
)

// ─── Modal sửa/thêm mức giá ───────────────────────────────────────────────────
function PricingModal({ open, rule, onClose, onSave }: {
  open: boolean
  rule: PricingRule | null   // null = thêm mới
  onClose: () => void
  onSave: (data: PricingForm) => void
}) {
  const isEdit = rule !== null
  const { register, handleSubmit, formState: { errors } } = useForm<PricingForm>({
    resolver: zodResolver(pricingSchema),
    values: rule
      ? { vehicleType: rule.vehicleType, normalRate: rule.normalRate, peakRate: rule.peakRate, overnightRate: rule.overnightRate, isActive: rule.isActive }
      : { vehicleType: 'motorbike', normalRate: 5000, peakRate: 8000, overnightRate: 20000, isActive: true },
  })

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Sửa giá — ${VEHICLE_META[rule!.vehicleType].label}` : 'Thêm mức giá'}>
      <form onSubmit={handleSubmit(onSave)} className="space-y-4">
        {/* Loại xe — ẩn khi edit */}
        {!isEdit && (
          <Field label="Loại xe" error={errors.vehicleType?.message}>
            <select {...register('vehicleType')} className={inputCls(errors.vehicleType?.message)}>
              {(Object.keys(VEHICLE_META) as VehicleType[]).map((vt) => (
                <option key={vt} value={vt}>{VEHICLE_META[vt].icon} {VEHICLE_META[vt].label}</option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Field label="Giờ thường (₫)" error={errors.normalRate?.message}>
            <input type="number" min={1000} step={500}
              {...register('normalRate', { valueAsNumber: true })}
              className={inputCls(errors.normalRate?.message)} />
          </Field>
          <Field label="Giờ cao điểm (₫)" error={errors.peakRate?.message}>
            <input type="number" min={1000} step={500}
              {...register('peakRate', { valueAsNumber: true })}
              className={inputCls(errors.peakRate?.message)} />
          </Field>
          <Field label="Qua đêm (₫)" error={errors.overnightRate?.message}>
            <input type="number" min={1000} step={1000}
              {...register('overnightRate', { valueAsNumber: true })}
              className={inputCls(errors.overnightRate?.message)} />
          </Field>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input type="checkbox" id="isActive" {...register('isActive')}
            className="w-4 h-4 rounded accent-blue-600" />
          <label htmlFor="isActive" className="text-sm text-gray-700 cursor-pointer">
            Áp dụng mức giá này
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700">
            Hủy
          </button>
          <button type="submit"
            className="flex-1 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">
            {isEdit ? 'Lưu thay đổi' : 'Thêm mức giá'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Modal sửa khung giờ cao điểm ────────────────────────────────────────────
function PeakHourModal({ open, peak, onClose, onSave }: {
  open: boolean
  peak: PeakHourRange | null  // null = thêm mới
  onClose: () => void
  onSave: (data: PeakHourForm) => void
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<PeakHourForm>({
    resolver: zodResolver(peakHourSchema),
    values: peak
      ? { label: peak.label, startTime: peak.startTime, endTime: peak.endTime }
      : { label: '', startTime: '07:00', endTime: '09:00' },
  })

  return (
    <Modal open={open} onClose={onClose} title={peak ? 'Sửa khung giờ' : 'Thêm khung giờ cao điểm'}>
      <form onSubmit={handleSubmit(onSave)} className="space-y-4">
        <Field label="Tên khung giờ" error={errors.label?.message}>
          <input type="text" placeholder="Ví dụ: Cao điểm sáng"
            {...register('label')} className={inputCls(errors.label?.message)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Giờ bắt đầu" error={errors.startTime?.message}>
            <input type="time" {...register('startTime')} className={inputCls(errors.startTime?.message)} />
          </Field>
          <Field label="Giờ kết thúc" error={errors.endTime?.message}>
            <input type="time" {...register('endTime')} className={inputCls(errors.endTime?.message)} />
          </Field>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700">
            Hủy
          </button>
          <button type="submit"
            className="flex-1 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">
            Lưu
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PricingManagement() {
  const [rules, setRules]          = useState<PricingRule[]>(MOCK_PRICING)
  const [peakHours, setPeakHours]  = useState<PeakHourRange[]>(MOCK_PEAK_HOURS)

  const [pricingModal, setPricingModal] = useState<{ open: boolean; rule: PricingRule | null }>({ open: false, rule: null })
  const [peakModal, setPeakModal]       = useState<{ open: boolean; peak: PeakHourRange | null }>({ open: false, peak: null })

  function handleSavePricing(data: PricingForm) {
    setRules((prev) => {
      const existing = prev.find((r) => r.id === pricingModal.rule?.id)
      if (existing) {
        return prev.map((r) =>
          r.id === existing.id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r
        )
      }
      return [...prev, { id: `pr-${Date.now()}`, ...data, updatedAt: new Date().toISOString() }]
    })
    setPricingModal({ open: false, rule: null })
  }

  function handleSavePeakHour(data: PeakHourForm) {
    setPeakHours((prev) => {
      const existing = prev.find((p) => p.id === peakModal.peak?.id)
      if (existing) {
        return prev.map((p) => p.id === existing.id ? { ...p, ...data } : p)
      }
      return [...prev, { id: `ph-${Date.now()}`, ...data, days: ['T2', 'T3', 'T4', 'T5', 'T6'] }]
    })
    setPeakModal({ open: false, peak: null })
  }

  function deleteRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id))
  }

  function deletePeakHour(id: string) {
    setPeakHours((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <PageWrapper>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Bảng giá</h2>
          <p className="text-sm text-gray-500 mt-0.5">Quản lý giá đỗ xe theo loại phương tiện</p>
        </div>
        <button
          onClick={() => setPricingModal({ open: true, rule: null })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                     text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Thêm mức giá
        </button>
      </div>

      {/* ── Bảng giá ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Loại xe</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-right">Giờ thường</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-right">Giờ cao điểm</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-right">Qua đêm</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Trạng thái</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Cập nhật</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{VEHICLE_META[rule.vehicleType].icon}</span>
                      <span className="font-medium text-gray-900">{VEHICLE_META[rule.vehicleType].label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{formatVND(rule.normalRate)}</td>
                  <td className="px-4 py-3 text-right font-mono text-orange-600 font-medium">{formatVND(rule.peakRate)}</td>
                  <td className="px-4 py-3 text-right font-mono text-purple-600 font-medium">{formatVND(rule.overnightRate)}</td>
                  <td className="px-4 py-3">
                    {rule.isActive
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"><CheckCircle className="w-3 h-3" />Áp dụng</span>
                      : <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200"><XCircle className="w-3 h-3" />Tạm dừng</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(rule.updatedAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setPricingModal({ open: true, rule })}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Sửa mức giá"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Xóa mức giá"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Khung giờ cao điểm ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold text-gray-900">Khung giờ cao điểm</h3>
          </div>
          <button
            onClick={() => setPeakModal({ open: true, peak: null })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200
                       rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm khung giờ
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {peakHours.map((peak) => (
            <div key={peak.id}
              className="bg-white border border-orange-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-orange-600" />
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">{peak.label}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setPeakModal({ open: true, peak })}
                    className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deletePeakHour(peak.id)}
                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Thời gian</span>
                  <span className="font-mono font-semibold text-gray-900">
                    {peak.startTime} – {peak.endTime}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Áp dụng</span>
                  <div className="flex gap-1">
                    {peak.days.map((d) => (
                      <span key={d} className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-medium">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {peakHours.length === 0 && (
            <div className="col-span-3 py-8 text-center text-gray-400">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Chưa có khung giờ cao điểm nào</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <PricingModal
        open={pricingModal.open}
        rule={pricingModal.rule}
        onClose={() => setPricingModal({ open: false, rule: null })}
        onSave={handleSavePricing}
      />
      <PeakHourModal
        open={peakModal.open}
        peak={peakModal.peak}
        onClose={() => setPeakModal({ open: false, peak: null })}
        onSave={handleSavePeakHour}
      />
    </PageWrapper>
  )
}

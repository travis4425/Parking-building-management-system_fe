// SlotGrid — hiển thị lưới slot theo tầng, click để xem chi tiết, IoT animation khi slot đổi trạng thái
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/utils/cn'
import { slotsByFloor } from '@/hooks/useSlotSimulation'
import type { ParkingSlot, SlotStatus } from '@/utils/types'

// ─── Màu sắc theo trạng thái ────────────────────────────────────────────────
const STATUS_STYLES: Record<SlotStatus, string> = {
  available:   'bg-emerald-400 hover:bg-emerald-500 border-emerald-500',
  occupied:    'bg-red-500 hover:bg-red-600 border-red-600',
  reserved:    'bg-yellow-400 hover:bg-yellow-500 border-yellow-500',
  maintenance: 'bg-gray-100 border-2 border-dashed border-gray-400 hover:bg-gray-200',
  locked:      'bg-slate-600 hover:bg-slate-700 border-slate-700',
}

const STATUS_LABEL: Record<SlotStatus, string> = {
  available:   'Trống',
  occupied:    'Có xe',
  reserved:    'Đặt trước',
  maintenance: 'Bảo trì',
  locked:      'Khóa',
}

const STATUS_TEXT: Record<SlotStatus, string> = {
  available:   'text-emerald-700',
  occupied:    'text-red-700',
  reserved:    'text-yellow-700',
  maintenance: 'text-gray-500',
  locked:      'text-slate-700',
}

// ─── Legend ──────────────────────────────────────────────────────────────────
const LEGEND_ITEMS: { status: SlotStatus; label: string }[] = [
  { status: 'available',   label: 'Trống' },
  { status: 'occupied',    label: 'Có xe' },
  { status: 'reserved',    label: 'Đặt trước' },
  { status: 'maintenance', label: 'Bảo trì' },
  { status: 'locked',      label: 'Khóa' },
]

// ─── Format thời gian cập nhật ────────────────────────────────────────────────
function formatUpdatedAt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface SlotGridProps {
  slots: ParkingSlot[]
  lastUpdated: Date
  changedIds: Set<string>
  floors?: number[]
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SlotGrid({
  slots,
  lastUpdated,
  changedIds,
  floors = [1, 2, 3],
}: SlotGridProps) {
  const [activeFloor, setActiveFloor] = useState<number>(floors[0])
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null)

  const floorSlots = slotsByFloor(slots, activeFloor)

  function handleSlotClick(slot: ParkingSlot) {
    setSelectedSlot((prev) => (prev?.id === slot.id ? null : slot))
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">Bản đồ slot thời gian thực</h3>
          <p className="text-xs text-gray-400 mt-0.5">IoT Simulation — cập nhật mỗi 5 giây</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '5s' }} />
          <span>
            {lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Floor tabs */}
      <div className="flex border-b border-gray-100 bg-gray-50">
        {floors.map((floor) => {
          const count = slotsByFloor(slots, floor).filter((s) => s.status === 'available').length
          return (
            <button
              key={floor}
              onClick={() => { setActiveFloor(floor); setSelectedSlot(null) }}
              className={cn(
                'flex-1 py-2.5 text-sm font-medium transition-colors relative',
                activeFloor === floor
                  ? 'text-blue-600 bg-white border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              )}
            >
              Tầng {floor}
              <span className={cn(
                'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                activeFloor === floor ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 text-gray-500'
              )}>
                {count} trống
              </span>
            </button>
          )
        })}
      </div>

      {/* Slot grid — 6 cột × 4 hàng */}
      <div className="p-4">
        <div className="grid grid-cols-6 gap-2">
          {floorSlots.map((slot) => (
            <button
              key={slot.id}
              onClick={() => handleSlotClick(slot)}
              title={slot.code}
              className={cn(
                'aspect-square rounded-lg border text-xs font-bold text-white',
                'flex items-center justify-center',
                'transition-all duration-200 cursor-pointer',
                'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1',
                STATUS_STYLES[slot.status],
                // Highlight animation khi IoT cập nhật
                changedIds.has(slot.id) && 'ring-2 ring-white ring-offset-1 scale-110 shadow-lg',
                slot.status === 'maintenance' && 'text-gray-400',
                selectedSlot?.id === slot.id && 'ring-2 ring-blue-500 ring-offset-1 scale-105',
              )}
            >
              {slot.code.split('-')[1]}
            </button>
          ))}
        </div>

        {/* Detail card khi click slot */}
        <div className={cn(
          'mt-4 rounded-lg border transition-all duration-200 overflow-hidden',
          selectedSlot ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50',
        )}>
          {selectedSlot ? (
            <div className="px-4 py-3 flex items-start justify-between gap-4">
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                <div>
                  <span className="text-gray-500 text-xs">Mã slot</span>
                  <p className="font-bold text-gray-900">{selectedSlot.code}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Tầng</span>
                  <p className="font-semibold text-gray-800">Tầng {selectedSlot.floor}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Trạng thái</span>
                  <p className={cn('font-semibold', STATUS_TEXT[selectedSlot.status])}>
                    {STATUS_LABEL[selectedSlot.status]}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Loại xe</span>
                  <p className="font-semibold text-gray-800">
                    {selectedSlot.vehicleType === 'motorbike' ? 'Xe máy' : 'Ô tô'}
                  </p>
                </div>
                {selectedSlot.currentPlate && (
                  <div>
                    <span className="text-gray-500 text-xs">Biển số</span>
                    <p className="font-mono font-bold text-gray-900">{selectedSlot.currentPlate}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-500 text-xs">Cập nhật lúc</span>
                  <p className="font-semibold text-gray-800">{formatUpdatedAt(selectedSlot.updatedAt)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSlot(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0"
                aria-label="Đóng"
              >
                ×
              </button>
            </div>
          ) : (
            <p className="px-4 py-3 text-xs text-gray-400 text-center">
              Click vào ô slot để xem chi tiết
            </p>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
        {LEGEND_ITEMS.map(({ status, label }) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn(
              'w-4 h-4 rounded',
              status === 'maintenance'
                ? 'bg-gray-100 border-2 border-dashed border-gray-400'
                : STATUS_STYLES[status].split(' ')[0],
            )} />
            <span className="text-xs text-gray-600">{label}</span>
          </div>
        ))}
        <span className="text-xs text-gray-400 ml-auto">
          {slots.filter(s => s.status === 'available').length}/{slots.length} slot trống
        </span>
      </div>
    </div>
  )
}

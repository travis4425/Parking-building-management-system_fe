// Hook giả lập IoT realtime: mỗi 5 giây random thay đổi 1-2 slot (không động vào slot maintenance)
import { useState, useEffect, useCallback } from 'react'
import type { ParkingSlot, SlotStatus } from '@/utils/types'

function getNextStatus(current: SlotStatus): SlotStatus {
  // Xác suất chuyển trạng thái: available→occupied nhiều nhất
  if (current === 'available') return Math.random() < 0.7 ? 'occupied' : 'reserved'
  if (current === 'occupied')  return Math.random() < 0.8 ? 'available' : 'reserved'
  return Math.random() < 0.5 ? 'available' : 'occupied'
}

export function useSlotSimulation(initialSlots: ParkingSlot[], intervalMs = 5000) {
  const [slots, setSlots] = useState<ParkingSlot[]>(initialSlots)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  // Lưu id các slot vừa thay đổi để highlight animation
  const [changedIds, setChangedIds] = useState<Set<string>>(new Set())

  const tick = useCallback(() => {
    setSlots((prev) => {
      // Lọc chỉ slot active (bỏ maintenance)
      const activeIndices = prev
        .map((s, i) => (s.status !== 'maintenance' ? i : -1))
        .filter((i) => i !== -1)

      if (activeIndices.length === 0) return prev

      // Chọn ngẫu nhiên 1-2 slot để thay đổi
      const changeCount = Math.random() < 0.4 ? 2 : 1
      const chosen = [...activeIndices]
        .sort(() => Math.random() - 0.5)
        .slice(0, changeCount)

      const next = [...prev]
      const ids = new Set<string>()

      chosen.forEach((idx) => {
        const slot = next[idx]
        const newStatus = getNextStatus(slot.status)
        next[idx] = {
          ...slot,
          status: newStatus,
          currentPlate: newStatus === 'occupied' ? `51A-${Math.floor(10000 + Math.random() * 89999)}` : undefined,
          updatedAt: new Date().toISOString(),
        }
        ids.add(slot.id)
      })

      setChangedIds(ids)
      // Xóa highlight sau 1.2s
      setTimeout(() => setChangedIds(new Set()), 1200)

      return next
    })
    setLastUpdated(new Date())
  }, [])

  useEffect(() => {
    const timer = setInterval(tick, intervalMs)
    return () => clearInterval(timer)
  }, [tick, intervalMs])

  // Computed: đếm slot theo trạng thái
  const stats = {
    available:   slots.filter((s) => s.status === 'available').length,
    occupied:    slots.filter((s) => s.status === 'occupied').length,
    reserved:    slots.filter((s) => s.status === 'reserved').length,
    maintenance: slots.filter((s) => s.status === 'maintenance').length,
    total:       slots.length,
  }

  return { slots, lastUpdated, changedIds, stats }
}

// Lọc slot theo tầng
export function slotsByFloor(slots: ParkingSlot[], floor: number): ParkingSlot[] {
  return slots.filter((s) => s.floor === floor)
}

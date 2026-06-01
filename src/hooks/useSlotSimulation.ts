// Hook IoT simulation — đọc slot từ slotStore, ghi kết quả tick trở lại store
// Dùng getState() bên trong tick để tránh stale closure
import { useState, useEffect, useCallback } from 'react'
import { useSlotStore } from '@/store/slotStore'
import type { SlotStatus } from '@/utils/types'

function getNextStatus(current: SlotStatus): SlotStatus {
  if (current === 'available') return Math.random() < 0.7 ? 'occupied' : 'reserved'
  if (current === 'occupied')  return Math.random() < 0.8 ? 'available' : 'reserved'
  return Math.random() < 0.5 ? 'available' : 'occupied'
}

export function useSlotSimulation(intervalMs = 5000) {
  // Đọc reactive từ store — tự re-render khi store thay đổi
  const slots               = useSlotStore((s) => s.slots)
  const applySimulationTick = useSlotStore((s) => s.applySimulationTick)

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [changedIds,  setChangedIds]  = useState<Set<string>>(new Set())

  const tick = useCallback(() => {
    // getState() lấy snapshot mới nhất, tránh stale closure trong setInterval
    const current = useSlotStore.getState().slots
    const active  = current.filter((s) => s.status !== 'maintenance' && s.status !== 'locked')
    if (active.length === 0) return

    // 1 slot (40%), 2 slots (40%), 3 slots (20%) — simulate nhiều cảm biến cùng lúc
    const rnd    = Math.random()
    const count  = rnd < 0.2 ? 3 : rnd < 0.6 ? 2 : 1
    const chosen = [...active].sort(() => Math.random() - 0.5).slice(0, count)

    const updates = chosen.map((slot) => ({
      id:        slot.id,
      newStatus: getNextStatus(slot.status),
      plate:     `51A-${Math.floor(10000 + Math.random() * 89999)}`,
    }))

    applySimulationTick(updates)
    setChangedIds(new Set(updates.map((u) => u.id)))
    setLastUpdated(new Date())
    setTimeout(() => setChangedIds(new Set()), 1200)
  }, [applySimulationTick])

  useEffect(() => {
    const timer = setInterval(tick, intervalMs)
    return () => clearInterval(timer)
  }, [tick, intervalMs])

  // Stats tính từ store (reactive)
  const stats = {
    available:   slots.filter((s) => s.status === 'available').length,
    occupied:    slots.filter((s) => s.status === 'occupied').length,
    reserved:    slots.filter((s) => s.status === 'reserved').length,
    maintenance: slots.filter((s) => s.status === 'maintenance').length,
    locked:      slots.filter((s) => s.status === 'locked').length,
    total:       slots.length,
  }

  return { slots, lastUpdated, changedIds, stats }
}

// Helper lọc slot theo tầng
export function slotsByFloor(slots: ReturnType<typeof useSlotStore.getState>['slots'], floor: number) {
  return slots.filter((s) => s.floor === floor)
}

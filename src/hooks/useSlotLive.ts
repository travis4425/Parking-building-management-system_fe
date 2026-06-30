// Hook đọc dữ liệu slot THẬT từ BE, tự fetch lại theo chu kỳ để cảm giác "thời gian thực"
// — KHÔNG random/giả lập dữ liệu như useSlotSimulation cũ (đã xóa).
import { useEffect, useRef, useState } from 'react'
import { useSlotStore } from '@/store/slotStore'

export function useSlotLive(intervalMs = 15_000) {
  const slots      = useSlotStore((s) => s.slots)
  const loadSlots  = useSlotStore((s) => s.loadSlots)

  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [changedIds,  setChangedIds]  = useState<Set<string>>(new Set())
  const prevStatusRef = useRef<Map<string, string>>(new Map())

  // Tải lần đầu + tải lại định kỳ — gọi API thật (GET /api/slots)
  useEffect(() => {
    loadSlots()
    const timer = setInterval(loadSlots, intervalMs)
    return () => clearInterval(timer)
  }, [loadSlots, intervalMs])

  // So sánh với lần fetch trước để biết slot nào vừa đổi trạng thái (để highlight UI)
  useEffect(() => {
    const prev = prevStatusRef.current
    const changed = new Set<string>()
    for (const s of slots) {
      const prevStatus = prev.get(s.id)
      if (prevStatus !== undefined && prevStatus !== s.status) changed.add(s.id)
    }
    prevStatusRef.current = new Map(slots.map((s) => [s.id, s.status]))
    setChangedIds(changed)
    setLastUpdated(new Date())
  }, [slots])

  const stats = {
    total:       slots.length,
    available:   slots.filter((s) => s.status === 'available').length,
    occupied:    slots.filter((s) => s.status === 'occupied').length,
    reserved:    slots.filter((s) => s.status === 'reserved').length,
    maintenance: slots.filter((s) => s.status === 'maintenance').length,
  }

  return { slots, lastUpdated, changedIds, stats }
}

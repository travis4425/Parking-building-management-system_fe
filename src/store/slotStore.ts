// Zustand store cho slots — nguồn dữ liệu chung giữa Dashboard và SlotManagement
import { create } from 'zustand'
import { INITIAL_SLOTS } from '@/api/mockSlots'
import type { ParkingSlot, SlotStatus } from '@/utils/types'

interface SlotStore {
  slots: ParkingSlot[]

  // Manager cập nhật thủ công
  updateSlotStatus: (slotId: string, newStatus: SlotStatus) => void

  // IoT simulation ghi hàng loạt mỗi tick
  applySimulationTick: (
    updates: Array<{ id: string; newStatus: SlotStatus; plate?: string }>
  ) => void
}

export const useSlotStore = create<SlotStore>((set) => ({
  slots: [...INITIAL_SLOTS],

  updateSlotStatus: (slotId, newStatus) =>
    set((state) => ({
      slots: state.slots.map((s) =>
        s.id === slotId
          ? { ...s, status: newStatus, currentPlate: newStatus !== 'occupied' ? undefined : s.currentPlate, updatedAt: new Date().toISOString() }
          : s
      ),
    })),

  applySimulationTick: (updates) =>
    set((state) => {
      const map = new Map(updates.map((u) => [u.id, u]))
      return {
        slots: state.slots.map((s) => {
          const upd = map.get(s.id)
          if (!upd) return s
          return {
            ...s,
            status: upd.newStatus,
            currentPlate: upd.newStatus === 'occupied' ? upd.plate : undefined,
            updatedAt: new Date().toISOString(),
          }
        }),
      }
    }),
}))

// Zustand store cho slots — nguồn dữ liệu chung giữa Dashboard và SlotManagement
import { create } from 'zustand'
import { fetchSlots, updateSlotStatusApi } from '@/api/slotsApi'
import type { ParkingSlot, SlotStatus } from '@/utils/types'

interface SlotStore {
  slots: ParkingSlot[]
  isLoading: boolean

  // Tải danh sách slot thật từ BE
  loadSlots: () => Promise<void>

  // Manager cập nhật thủ công — gọi API thật, rollback nếu lỗi
  updateSlotStatus: (slotId: string, newStatus: SlotStatus) => Promise<void>

  // IoT simulation ghi hàng loạt mỗi tick — chỉ cập nhật state cục bộ (demo, không có BE push)
  applySimulationTick: (
    updates: Array<{ id: string; newStatus: SlotStatus; plate?: string }>
  ) => void
}

export const useSlotStore = create<SlotStore>((set, get) => ({
  slots: [],
  isLoading: false,

  loadSlots: async () => {
    set({ isLoading: true })
    try {
      const slots = await fetchSlots()
      set({ slots, isLoading: false })
    } catch (err) {
      console.error('Không tải được danh sách slot:', err)
      set({ isLoading: false })
    }
  },

  updateSlotStatus: async (slotId, newStatus) => {
    const prevSlots = get().slots
    // Optimistic update
    set((state) => ({
      slots: state.slots.map((s) =>
        s.id === slotId
          ? { ...s, status: newStatus, currentPlate: newStatus !== 'occupied' ? undefined : s.currentPlate, updatedAt: new Date().toISOString() }
          : s
      ),
    }))

    try {
      await updateSlotStatusApi(slotId, newStatus)
    } catch (err) {
      console.error('Cập nhật trạng thái slot thất bại, rollback:', err)
      set({ slots: prevSlots })
    }
  },

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

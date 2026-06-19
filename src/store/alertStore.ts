// Zustand store quản lý cảnh báo (Alert) — đã nối với BE thật (GET/POST/PATCH/DELETE /alerts)
import { create } from 'zustand'
import { fetchAlerts, createAlertApi, resolveAlertApi, deleteAlertApi } from '@/api/alertsApi'
import { useSlotStore } from '@/store/slotStore'
import type { ParkingAlert, AlertType } from '@/utils/types'

interface AlertStore {
  alerts: ParkingAlert[]
  isLoading: boolean
  loadAlerts: () => Promise<void>
  addAlert: (alert: Omit<ParkingAlert, 'id' | 'timestamp' | 'status'>) => Promise<void>
  resolveAlert: (id: string) => Promise<void>
  deleteAlert: (id: string) => Promise<void>
  pendingCount: () => number
}

export const useAlertStore = create<AlertStore>((set, get) => ({
  alerts: [],
  isLoading: false,

  loadAlerts: async () => {
    set({ isLoading: true })
    try {
      const alerts = await fetchAlerts()
      set({ alerts, isLoading: false })
    } catch (err) {
      console.error('Lỗi tải danh sách cảnh báo:', err)
      set({ isLoading: false })
    }
  },

  addAlert: async (payload) => {
    // payload.slotCode → tra slotId thật từ slotStore đã load (BE cần slotId, không nhận slotCode)
    const slot = useSlotStore.getState().slots.find((s) => s.code === payload.slotCode)
    try {
      const created = await createAlertApi({
        type: payload.type,
        slotId: slot?.id,
        message: payload.message,
      })
      // Giữ lại slotCode gốc nếu BE không trả về slot (vd. không tìm thấy slotId)
      set((state) => ({ alerts: [{ ...created, slotCode: created.slotCode || payload.slotCode }, ...state.alerts] }))
    } catch (err) {
      console.error('Lỗi tạo cảnh báo:', err)
    }
  },

  resolveAlert: async (id) => {
    // Optimistic update + rollback nếu lỗi
    const prev = get().alerts
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, status: 'resolved' as const } : a)),
    }))
    try {
      await resolveAlertApi(id)
    } catch (err) {
      console.error('Lỗi resolve cảnh báo:', err)
      set({ alerts: prev })
    }
  },

  deleteAlert: async (id) => {
    const prev = get().alerts
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) }))
    try {
      await deleteAlertApi(id)
    } catch (err) {
      console.error('Lỗi xóa cảnh báo:', err)
      set({ alerts: prev })
    }
  },

  pendingCount: () => get().alerts.filter((a) => a.status === 'pending').length,
}))

// Hàm tiện ích lấy label tiếng Việt theo loại cảnh báo
export function alertTypeLabel(type: AlertType) {
  const map: Record<AlertType, string> = {
    sensor_error:     'Cảm biến lỗi',
    session_overtime: 'Session quá hạn',
    wrong_zone:       'Đỗ sai khu vực',
  }
  return map[type]
}

// Màu badge theo loại cảnh báo
export function alertTypeColor(type: AlertType) {
  const map: Record<AlertType, string> = {
    sensor_error:     'bg-red-100 text-red-700 border-red-200',
    session_overtime: 'bg-amber-100 text-amber-700 border-amber-200',
    wrong_zone:       'bg-orange-100 text-orange-700 border-orange-200',
  }
  return map[type]
}

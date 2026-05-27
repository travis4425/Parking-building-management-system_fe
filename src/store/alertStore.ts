// Zustand store quản lý danh sách cảnh báo IoT — dùng chung giữa StaffDashboard và trang ngoại lệ
import { create } from 'zustand'
import { MOCK_ALERTS } from '@/api/mockAlerts'
import type { ParkingAlert, AlertType } from '@/utils/types'

interface AlertStore {
  alerts: ParkingAlert[]
  addAlert: (alert: Omit<ParkingAlert, 'id' | 'timestamp' | 'status'>) => void
  resolveAlert: (id: string) => void
  pendingCount: () => number
}

export const useAlertStore = create<AlertStore>((set, get) => ({
  alerts: [...MOCK_ALERTS],

  addAlert: (payload) => set((state) => ({
    alerts: [
      {
        ...payload,
        id: `alert-${Date.now()}`,
        timestamp: new Date().toISOString(),
        status: 'pending',
      },
      ...state.alerts,
    ],
  })),

  resolveAlert: (id) => set((state) => ({
    alerts: state.alerts.map((a) =>
      a.id === id ? { ...a, status: 'resolved' as const } : a
    ),
  })),

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

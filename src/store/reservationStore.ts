// Zustand store quản lý đặt chỗ trước của tài xế — tự hủy nếu không check-in sau 15 phút
import { create } from 'zustand'
import type { Reservation, VehicleType } from '@/utils/types'

let seqCounter = 1

function genCode() {
  const seq = String(seqCounter++).padStart(4, '0')
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `RSV-${rand}${seq}`
}

interface ReservationStore {
  reservations: Reservation[]

  // Tạo đặt chỗ mới — trả về reservation vừa tạo để hiển thị QR
  addReservation: (
    data: Omit<Reservation, 'id' | 'code' | 'createdAt'>
  ) => Reservation

  cancelReservation: (id: string) => void

  // Đánh dấu expired các reservation quá giờ → trả về list để caller giải phóng slot
  expireOverdue: () => Reservation[]

  getActiveByDriver: (driverId: string) => Reservation[]
}

export const useReservationStore = create<ReservationStore>((set, get) => ({
  reservations: [],

  addReservation: (data) => {
    const r: Reservation = {
      ...data,
      id:        `rsv-${Date.now()}`,
      code:       genCode(),
      createdAt: new Date().toISOString(),
    }
    set((s) => ({ reservations: [r, ...s.reservations] }))
    return r
  },

  cancelReservation: (id) =>
    set((s) => ({
      reservations: s.reservations.map((r) =>
        r.id === id ? { ...r, status: 'cancelled' as const } : r
      ),
    })),

  expireOverdue: () => {
    const now  = new Date()
    const toExpire = get().reservations.filter(
      (r) => r.status === 'pending' && new Date(r.expiresAt) < now
    )
    if (toExpire.length === 0) return []
    const expireIds = new Set(toExpire.map((r) => r.id))
    set((s) => ({
      reservations: s.reservations.map((r) =>
        expireIds.has(r.id) ? { ...r, status: 'expired' as const } : r
      ),
    }))
    return toExpire
  },

  getActiveByDriver: (driverId) =>
    get().reservations.filter(
      (r) => r.driverId === driverId && r.status === 'pending'
    ),
}))

// Tên hiển thị loại xe
export function vehicleLabel(t: VehicleType): string {
  return t === 'motorbike' ? 'Xe máy' : t === 'car' ? 'Ô tô' : 'Xe đạp'
}

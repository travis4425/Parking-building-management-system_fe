// Zustand store quản lý danh sách phiên đỗ xe — dùng chung giữa Check-in, Check-out và báo cáo
import { create } from 'zustand'
import { MOCK_SESSIONS } from '@/api/mockSessions'
import type { ParkingSession } from '@/utils/types'

interface SessionStore {
  sessions: ParkingSession[]
  addSession:      (session: ParkingSession) => void
  completeSession: (id: string, fee: number, staffId: string) => void
  markAsPaid:      (id: string, fee: number, staffId: string) => void
  updatePlate:     (id: string, newPlate: string) => void
  findById:        (id: string)     => ParkingSession | undefined
  getBySlot:       (slotId: string) => ParkingSession | undefined
  findByQR:        (qrCode: string) => ParkingSession | undefined
  findByPlate:     (plate: string)  => ParkingSession | undefined
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [...MOCK_SESSIONS],

  addSession: (session) =>
    set((s) => ({ sessions: [session, ...s.sessions] })),

  completeSession: (id, fee, staffId) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id
          ? { ...sess, status: 'completed', fee, staffCheckOutId: staffId, checkOutTime: new Date().toISOString() }
          : sess
      ),
    })),

  // Đánh dấu đã thu phí — xe vẫn còn trong bãi, slot chưa được giải phóng
  markAsPaid: (id, fee, staffId) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id
          ? { ...sess, status: 'paid', fee, staffCheckOutId: staffId }
          : sess
      ),
    })),

  updatePlate: (id, newPlate) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, vehiclePlate: newPlate } : sess
      ),
    })),

  findById:    (id)      => get().sessions.find((s) => s.id === id),
  getBySlot:   (slotId)  => get().sessions.find((s) => s.slotId === slotId && s.status === 'active'),
  findByQR:    (qrCode)  => get().sessions.find((s) => s.qrCode === qrCode && s.status === 'active'),
  findByPlate: (plate)   => get().sessions.find(
    (s) => s.vehiclePlate.replace(/[.\-\s]/g, '').toUpperCase() ===
           plate.replace(/[.\-\s]/g, '').toUpperCase() && s.status === 'active'
  ),
}))

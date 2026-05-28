// Zustand store quản lý danh sách phiên đỗ xe — dùng chung giữa Check-in, Check-out và báo cáo
import { create } from 'zustand'
import type { ParkingSession } from '@/utils/types'

interface SessionStore {
  sessions: ParkingSession[]
  addSession:      (session: ParkingSession) => void
  completeSession: (id: string, fee: number, staffId: string) => void
  getBySlot:       (slotId: string) => ParkingSession | undefined
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],

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

  getBySlot: (slotId) =>
    get().sessions.find((s) => s.slotId === slotId && s.status === 'active'),
}))

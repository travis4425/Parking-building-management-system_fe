// Zustand store quản lý danh sách phiên đỗ xe — dùng chung giữa Check-in, Check-out và báo cáo
// Đã nối với BE thật: loadSessions (GET /sessions), checkInSession (POST /sessions),
// checkOutSession (POST /sessions/checkout). markAsPaid giữ lại như cập nhật local
// (chưa có API riêng cho luồng "đã thu phí nhưng xe chưa ra").
import { create } from 'zustand'
import { fetchSessions, checkInApi, checkOutApi } from '@/api/sessionsApi'
import { getVehicleTypeId } from '@/api/vehicleTypesApi'
import type { ParkingSession, VehicleType } from '@/utils/types'

interface SessionStore {
  sessions: ParkingSession[]
  isLoading: boolean
  loadSessions: () => Promise<void>

  // Check-in thật qua BE — trả về session đã tạo (đã map sang FE shape)
  checkInSession: (data: {
    slotId: string
    // Tuỳ chọn — xe đạp thường không có biển số chính thức, để trống thì BE tự sinh mã quản lý
    licensePlate?: string
    vehicleType: VehicleType
    gateInId?: string
  }) => Promise<ParkingSession>

  // Check-out thật qua BE — tìm theo qrToken, BE tự tính phí (pricing thật, có overnightRate)
  checkOutSession: (qrToken: string, opts?: { gateOutId?: string; lostTicket?: boolean }) => Promise<ParkingSession & { priceBreakdown?: any }>

  addSession:      (session: ParkingSession) => void
  markAsPaid:      (id: string, fee: number, staffId: string) => void
  findById:        (id: string)     => ParkingSession | undefined
  getBySlot:       (slotId: string) => ParkingSession | undefined
  findByQR:        (qrCode: string) => ParkingSession | undefined
  findByPlate:     (plate: string)  => ParkingSession | undefined
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  isLoading: false,

  loadSessions: async () => {
    set({ isLoading: true })
    try {
      const sessions = await fetchSessions()
      set({ sessions, isLoading: false })
    } catch (err) {
      console.error('Lỗi tải danh sách phiên gửi xe:', err)
      set({ isLoading: false })
    }
  },

  checkInSession: async ({ slotId, licensePlate, vehicleType, gateInId }) => {
    const vehicleTypeId = await getVehicleTypeId(vehicleType)
    const session = await checkInApi({ slotId, licensePlate, vehicleTypeId, gateInId })
    set((s) => ({ sessions: [session, ...s.sessions] }))
    return session
  },

  checkOutSession: async (qrToken, opts) => {
    const result = await checkOutApi({ qrToken, gateOutId: opts?.gateOutId, lostTicket: opts?.lostTicket })
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === result.id ? { ...sess, ...result } : sess)),
    }))
    return result
  },

  addSession: (session) =>
    set((s) => ({ sessions: [session, ...s.sessions] })),

  // Đánh dấu đã thu phí — xe vẫn còn trong bãi, slot chưa được giải phóng
  markAsPaid: (id, fee, staffId) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id
          ? { ...sess, status: 'paid', fee, staffCheckOutId: staffId }
          : sess
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

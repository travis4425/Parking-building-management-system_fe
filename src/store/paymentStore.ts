// Zustand store quản lý giao dịch thanh toán trong ca — dùng cho StaffPayment và báo cáo ca
import { create } from 'zustand'
import type { PayMethod, VehicleType } from '@/utils/types'

export interface PaymentRecord {
  id: string
  receiptNo: string
  sessionId: string
  vehiclePlate: string
  vehicleType: VehicleType
  slotCode: string
  checkInTime: string
  checkOutTime: string   // Thời điểm thu phí (không phải thời điểm xe ra)
  durationMinutes: number
  fee: number
  payMethod: PayMethod
  paidAt: string         // ISO string
  staffId: string
  staffName: string
}

interface PaymentStore {
  payments: PaymentRecord[]
  addPayment:    (p: Omit<PaymentRecord, 'id' | 'receiptNo' | 'paidAt'>) => void
  getShiftTotal: () => number
  clearShift:    () => void
}

let receiptCounter = 1

export const usePaymentStore = create<PaymentStore>((set, get) => ({
  payments: [],

  addPayment: (p) => {
    const now = new Date()
    const seq = String(receiptCounter++).padStart(4, '0')
    const receiptNo = `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${seq}`
    set((s) => ({
      payments: [
        { ...p, id: `pay-${Date.now()}`, receiptNo, paidAt: now.toISOString() },
        ...s.payments,
      ],
    }))
  },

  getShiftTotal: () => get().payments.reduce((sum, p) => sum + p.fee, 0),

  clearShift: () => {
    receiptCounter = 1
    set({ payments: [] })
  },
}))

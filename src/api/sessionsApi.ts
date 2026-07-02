// API phiên gửi xe — check-in / check-out / danh sách thật từ BE
import { apiClient } from './client'
import { mapSession } from './mappers'
import type { ParkingSession } from '@/utils/types'

export async function fetchSessions(params?: { status?: string }): Promise<ParkingSession[]> {
  const res = await apiClient.get('/sessions', { params })
  const list = (res.data.data as any[]) ?? []
  return list.map(mapSession)
}

export async function fetchSessionById(id: string): Promise<ParkingSession> {
  const res = await apiClient.get(`/sessions/${id}`)
  return mapSession(res.data.data)
}

// Tìm session chưa hoàn tất theo biển số — chấp nhận cả ACTIVE và PAYMENT_PENDING
// (PAYMENT_PENDING xảy ra khi checkOutSession đã được gọi nhưng payment chưa hoàn tất)
export async function fetchActiveSessionByPlate(plate: string): Promise<ParkingSession | null> {
  const res = await apiClient.get('/sessions', {
    params: { licensePlate: plate.trim().toUpperCase(), limit: 5 },
  })
  const list = (res.data.data as any[]) ?? []
  // Ưu tiên ACTIVE, fallback sang PAYMENT_PENDING
  const found = list.find((s: any) => {
    const st = (s.status ?? '').toUpperCase()
    return st === 'ACTIVE' || st === 'PAYMENT_PENDING'
  })
  return found ? mapSession(found) : null
}

export interface CheckInPayload {
  slotId: string
  // Tuỳ chọn — xe đạp thường không có biển số chính thức, để trống thì BE tự sinh mã quản lý
  licensePlate?: string
  vehicleTypeId: string
  gateInId?: string
}

export async function checkInApi(payload: CheckInPayload): Promise<ParkingSession> {
  const res = await apiClient.post('/sessions', payload)
  return mapSession(res.data.data)
}

export interface CheckOutPayload {
  qrToken: string
  gateOutId?: string
  lostTicket?: boolean
}

export interface CheckOutResult extends ParkingSession {
  priceBreakdown?: {
    basePrice: number
    hourlyRate: number
    durationHours: number
    isOvernight: boolean
    overnightRate: number
    surcharge: number
    totalFee: number
    isPeakHour: boolean
  }
}

export async function checkOutApi(payload: CheckOutPayload): Promise<CheckOutResult> {
  const res = await apiClient.post('/sessions/checkout', payload)
  const data = res.data.data
  return { ...mapSession(data), priceBreakdown: data.priceBreakdown }
}

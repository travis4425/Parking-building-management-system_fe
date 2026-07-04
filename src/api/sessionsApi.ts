// API phiên gửi xe — check-in / check-out / danh sách thật từ BE
import { apiClient } from './client'
import { mapSession } from './mappers'
import type { ParkingSession } from '@/utils/types'

export async function fetchSessions(params?: { status?: string; qrToken?: string }): Promise<ParkingSession[]> {
  const res = await apiClient.get('/sessions', { params })
  const list = (res.data.data as any[]) ?? []
  return list.map(mapSession)
}

export async function fetchSessionByQrToken(qrToken: string): Promise<ParkingSession | null> {
  const sessions = await fetchSessions({ qrToken: qrToken.trim() })
  return sessions[0] ?? null
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
  gateInId?: string
  // Luồng cũ (nhập tay)
  licensePlate?: string
  vehicleTypeId?: string
  // Luồng mới (quét QR account driver)
  driverQrToken?: string
}

export interface DriverQrInfo {
  id: string
  fullName: string | null
  licensePlate: string
  vehicleType: { id: string; name: string; code: string }
}

// Tìm active session của driver bằng user.qrToken (account QR, khác với session.qrToken)
export async function fetchActiveSessionByDriverQr(driverQrToken: string): Promise<ParkingSession | null> {
  try {
    // 1. Tìm thông tin driver theo qrToken
    const driver = await lookupDriverByQr(driverQrToken)
    if (!driver?.licensePlate) return null
    // 2. Tìm active session theo biển số của driver
    return await fetchActiveSessionByPlate(driver.licensePlate)
  } catch {
    return null
  }
}

export async function lookupDriverByQr(token: string): Promise<DriverQrInfo> {
  const res = await apiClient.get<{ success: boolean; data: DriverQrInfo }>(`/users/by-qr/${token}`)
  return res.data.data
}

export async function checkInApi(payload: CheckInPayload): Promise<ParkingSession> {
  const res = await apiClient.post('/sessions', payload)
  return mapSession(res.data.data)
}

export interface CheckOutPayload {
  qrToken?: string        // QR session (luồng cũ)
  driverQrToken?: string  // QR account driver (luồng mới)
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

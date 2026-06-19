// API ngoại lệ (Exception) — mất vé / sai biển số / sai khu vực — thật từ BE
import { apiClient } from './client'

export interface BeException {
  id: string
  sessionId: string
  type: 'LOST_TICKET' | 'WRONG_PLATE' | 'WRONG_ZONE'
  description?: string | null
  extraFee?: number | null
  oldLicensePlate?: string | null
  newLicensePlate?: string | null
  createdAt: string
  updatedAt: string
  session?: { licensePlate?: string; qrToken?: string } | null
}

export async function fetchExceptionsApi(): Promise<BeException[]> {
  const res = await apiClient.get('/exceptions')
  return (res.data.data as BeException[]) ?? []
}

export async function reportLostTicketApi(payload: {
  licensePlate: string
  description?: string
}): Promise<BeException> {
  const res = await apiClient.post('/exceptions/lost-ticket', payload)
  return res.data.data
}

export async function reportWrongPlateApi(payload: {
  sessionId: string
  newLicensePlate: string
  userId: string
  description?: string
}): Promise<BeException> {
  const res = await apiClient.post('/exceptions/wrong-plate', payload)
  return res.data.data
}

export async function reportWrongZoneApi(payload: {
  sessionId: string
  description?: string
}): Promise<BeException> {
  const res = await apiClient.post('/exceptions/wrong-zone', payload)
  return res.data.data
}

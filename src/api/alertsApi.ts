// API cảnh báo (Alert) — danh sách / tạo / resolve / xóa thật từ BE
import { apiClient } from './client'
import { mapAlert, feToBeAlertType } from './mappers'
import type { ParkingAlert, AlertType } from '@/utils/types'

export async function fetchAlerts(): Promise<ParkingAlert[]> {
  const res = await apiClient.get('/alerts')
  const list = (res.data.data as any[]) ?? []
  return list.map(mapAlert)
}

export interface CreateAlertPayload {
  type: AlertType
  slotId?: string
  message: string
}

export async function createAlertApi(payload: CreateAlertPayload): Promise<ParkingAlert> {
  const res = await apiClient.post('/alerts', {
    type: feToBeAlertType(payload.type),
    slotId: payload.slotId,
    message: payload.message,
  })
  return mapAlert(res.data.data)
}

export async function resolveAlertApi(id: string): Promise<ParkingAlert> {
  const res = await apiClient.patch(`/alerts/${id}/resolve`)
  return mapAlert(res.data.data)
}

export async function deleteAlertApi(id: string): Promise<void> {
  await apiClient.delete(`/alerts/${id}`)
}

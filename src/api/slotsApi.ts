// API thật cho Slots — thay cho mockSlots
import { apiClient } from './client'
import { mapSlot, feToBeSlotStatus } from './mappers'
import type { ParkingSlot, SlotStatus } from '@/utils/types'

export async function fetchSlots(): Promise<ParkingSlot[]> {
  const res = await apiClient.get('/slots/realtime')
  return (res.data.data as any[]).map(mapSlot)
}

export async function updateSlotStatusApi(slotId: string, status: SlotStatus): Promise<ParkingSlot> {
  const res = await apiClient.patch(`/slots/${slotId}/status`, {
    status: feToBeSlotStatus(status),
  })
  return mapSlot(res.data.data)
}

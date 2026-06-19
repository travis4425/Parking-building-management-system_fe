// API loại xe — tra cứu vehicleTypeId thật khi check-in + CRUD quản lý loại xe (VehicleManagement.tsx)
import { apiClient } from './client'
import type { VehicleType } from '@/utils/types'
import { feToBeVehicleTypeCode } from './mappers'

export interface BeVehicleType {
  id: string
  name: string
  code: string
  description?: string | null
  maxHeight?: number | null
  maxWidth?: number | null
}

export interface BeZone {
  id: string
  name: string
  floor: number
}

let cache: BeVehicleType[] | null = null

export function invalidateVehicleTypesCache() {
  cache = null
}

export async function fetchVehicleTypes(): Promise<BeVehicleType[]> {
  if (cache) return cache
  const res = await apiClient.get('/vehicle-types', { params: { limit: 100 } })
  cache = res.data.data as BeVehicleType[]
  return cache
}

// Tra id thật của BE theo loại xe FE (motorbike/bicycle/car) — dùng cho check-in
export async function getVehicleTypeId(type: VehicleType): Promise<stri
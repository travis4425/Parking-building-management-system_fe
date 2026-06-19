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
export async function getVehicleTypeId(type: VehicleType): Promise<string> {
  const types = await fetchVehicleTypes()
  const code = feToBeVehicleTypeCode(type)
  const found = types.find((t) => t.code?.toUpperCase() === code)
  if (!found) throw new Error(`Không tìm thấy vehicleTypeId cho loại xe ${type}`)
  return found.id
}

export interface VehicleTypePayload {
  name: string
  code: string
  description?: string
  maxHeight?: number
  maxWidth?: number
}

export async function createVehicleTypeApi(data: VehicleTypePayload): Promise<BeVehicleType> {
  const res = await apiClient.post('/vehicle-types', data)
  invalidateVehicleTypesCache()
  return res.data.data
}

export async function updateVehicleTypeApi(id: string, data: Partial<VehicleTypePayload>): Promise<BeVehicleType> {
  const res = await apiClient.patch(`/vehicle-types/${id}`, data)
  invalidateVehicleTypesCache()
  return res.data.data
}

export async function deleteVehicleTypeApi(id: string): Promise<void> {
  await apiClient.delete(`/vehicle-types/${id}`)
  invalidateVehicleTypesCache()
}

// ─── Zones & quy tắc tầng được phép theo loại xe ───────────────────────────

export async function fetchZones(): Promise<BeZone[]> {
  const res = await apiClient.get('/zones', { params: { limit: 100 } })
  return res.data.data as BeZone[]
}

export async function fetchZoneVehicleRules(vehicleTypeId: string): Promise<{ zoneId: string }[]> {
  const res = await apiClient.get('/zone-vehicle-rules', { params: { vehicleTypeId } })
  return res.data.data
}

export async function setZoneVehicleRule(zoneId: string, vehicleTypeId: string, allowed: boolean): Promise<void> {
  if (allowed) {
    await apiClient.post('/zone-vehicle-rules', { zoneId, vehicleTypeId })
  } else {
    await apiClient.delete('/zone-vehicle-rules', { params: { zoneId, vehicleTypeId } })
  }
}

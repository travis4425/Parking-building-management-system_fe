// API bảng giá & giờ cao điểm — CRUD thật từ BE (PricePolicy + SystemConfig.PEAK_HOURS)
import { apiClient } from './client'
import { mapPricePolicy, feToBeVehicleTypeCode } from './mappers'
import { getVehicleTypeId } from './vehicleTypesApi'
import type { PricingRule, PeakHourRange, VehicleType } from '@/utils/types'

// ─── BẢNG GIÁ (PricePolicy) ───────────────────────────────────────────────────

export async function fetchActivePricing(): Promise<PricingRule[]> {
  const res = await apiClient.get('/pricing/active')
  const list = (res.data.data as any[]) ?? []
  return list.map(mapPricePolicy)
}

export interface SavePricingInput {
  vehicleType: VehicleType
  normalRate: number
  peakRate: number
  overnightRate: number
  isActive: boolean
}

// Lưu 1 rule giá — nếu đã có policy active cho loại xe này thì PATCH, chưa có thì POST mới
export async function savePricingRuleApi(
  input: SavePricingInput,
  existingId?: string
): Promise<PricingRule> {
  const peakMultiplier = input.normalRate > 0 ? input.peakRate / input.normalRate : 1.5

  if (existingId) {
    const res = await apiClient.patch(`/pricing/${existingId}`, {
      pricePerHour: input.normalRate,
      peakMultiplier,
      overnightRate: input.overnightRate,
      isActive: input.isActive,
    })
    return mapPricePolicy(res.data.data)
  }

  const vehicleTypeId = await getVehicleTypeId(input.vehicleType)
  const res = await apiClient.post('/pricing', {
    vehicleTypeId,
    name: `Bảng giá ${feToBeVehicleTypeCode(input.vehicleType)}`,
    basePrice: 0,
    pricePerHour: input.normalRate,
    peakMultiplier,
    overnightRate: input.overnightRate,
    effectiveFrom: new Date().toISOString(),
  })
  return mapPricePolicy(res.data.data)
}

export async function deletePricingApi(id: string): Promise<void> {
  await apiClient.delete(`/pricing/${id}`)
}

// ─── GIỜ CAO ĐIỂM (SystemConfig.PEAK_HOURS) ───────────────────────────────────

const ALL_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

export interface PeakHoursResult {
  hours: number[]
  ranges: PeakHourRange[]
}

export async function fetchPeakHoursApi(): Promise<PeakHoursResult> {
  const res = await apiClient.get('/pricing/peak-hours')
  const data = res.data.data as { hours: number[]; ranges: { startTime: string; endTime: string }[] }
  const ranges: PeakHourRange[] = (data.ranges ?? []).map((r, i) => ({
    id: `ph-${i}`,
    label: `Cao điểm ${i + 1}`,
    startTime: r.startTime,
    endTime: r.endTime,
    days: ALL_DAYS, // BE áp dụng giờ cao điểm mọi ngày, không phân biệt thứ
  }))
  return { hours: data.hours ?? [], ranges }
}

// Cập nhật toàn bộ mảng giờ cao điểm (0-23) — ghi vào SystemConfig key PEAK_HOURS
export async function updatePeakHoursApi(hours: number[]): Promise<void> {
  const value = JSON.stringify(hours)
  try {
    await apiClient.patch('/admin/system-config/PEAK_HOURS', { value })
  } catch (err: any) {
    if (err?.response?.status === 404) {
      await apiClient.post('/admin/system-config', {
        key: 'PEAK_HOURS',
        value,
        description: 'Danh sách giờ cao điểm (0-23)',
        type: 'json',
      })
    } else {
      throw err
    }
  }
}

// Chuyển range giờ "HH:MM"-"HH:MM" thành mảng số giờ (dùng khi manager sửa range trên UI)
export function rangeToHours(startTime: string, endTime: string): number[] {
  const start = parseInt(startTime.split(':')[0], 10)
  const end = parseInt(endTime.split(':')[0], 10)
  const hours: number[] = []
  for (let h = start; h < end; h++) hours.push(h)
  return hours
}

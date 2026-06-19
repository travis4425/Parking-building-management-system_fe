// Mock data bảng giá theo loại xe và khung giờ cao điểm
import type { PricingRule, PeakHourRange } from '@/utils/types'

export const MOCK_PRICING: PricingRule[] = [
  {
    id: 'pr-motorbike',
    vehicleType: 'motorbike',
    normalRate:    5_000,
    peakRate:      8_000,
    overnightRate: 20_000,
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pr-car',
    vehicleType: 'car',
    normalRate:    15_000,
    peakRate:      25_000,
    overnightRate: 60_000,
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pr-truck',
    vehicleType: 'truck',
    normalRate:    25_000,
    peakRate:      40_000,
    overnightRate: 100_000,
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
]

export const MOCK_PEAK_HOURS: PeakHourRange[] = [
  {
    id: 'ph-morning',
    label: 'Cao điểm sáng',
    startTime: '07:00',
    endTime: '09:00',
    days: ['T2', 'T3', 'T4', 'T5', 'T6'],
  },
  {
    id: 'ph-evening',
    label: 'Cao điểm chiều',
    startTime: '17:00',
    endTime: '19:30',
    days: ['T2', 'T3', 'T4', 'T5', 'T6'],
  },
  {
    id: 'ph-weekend',
    label: 'Cuối tuần',
    startTime: '08:00',
    endTime: '22:00',
    days: ['T7', 'CN'],
  },
]

// Zustand store quản lý bảng giá & giờ cao điểm — nối thật với BE (PricePolicy + SystemConfig.PEAK_HOURS)
import { create } from 'zustand'
import {
  fetchActivePricing,
  savePricingRuleApi,
  deletePricingApi,
  fetchPeakHoursApi,
  updatePeakHoursApi,
  rangeToHours,
  type SavePricingInput,
} from '@/api/pricingApi'
import type { PricingRule, PeakHourRange } from '@/utils/types'

interface PricingStore {
  rules: PricingRule[]
  peakRanges: PeakHourRange[]
  peakHours: number[]
  isLoaded: boolean
  isLoading: boolean
  loadPricing: () => Promise<void>
  saveRule: (input: SavePricingInput, existingId?: string) => Promise<void>
  deleteRule: (id: string) => Promise<void>
  savePeakRange: (range: { id?: string; label: string; startTime: string; endTime: string }) => Promise<void>
  deletePeakRange: (id: string) => Promise<void>
}

export const usePricingStore = create<PricingStore>((set, get) => ({
  rules: [],
  peakRanges: [],
  peakHours: [],
  isLoaded: false,
  isLoading: false,

  loadPricing: async () => {
    set({ isLoading: true })
    try {
      const [rules, peak] = await Promise.all([fetchActivePricing(), fetchPeakHoursApi()])
      set({ rules, peakRanges: peak.ranges, peakHours: peak.hours, isLoaded: true, isLoading: false })
    } catch (err) {
      console.error('Lỗi tải bảng giá / giờ cao điểm:', err)
      set({ isLoading: false })
    }
  },

  saveRule: async (input, existingId) => {
    try {
      const saved = await savePricingRuleApi(input, existingId)
      set((state) => {
        const exists = state.rules.some((r) => r.id === saved.id)
        return {
          rules: exists
            ? state.rules.map((r) => (r.id === saved.id ? saved : r))
            : [...state.rules.filter((r) => r.vehicleType !== saved.vehicleType), saved],
        }
      })
    } catch (err) {
      console.error('Lỗi lưu bảng giá:', err)
      throw err
    }
  },

  deleteRule: async (id) => {
    const prev = get().rules
    set((state) => ({ rules: state.rules.filter((r) => r.id !== id) }))
    try {
      await deletePricingApi(id)
    } catch (err) {
      console.error('Lỗi xóa bảng giá:', err)
      set({ rules: prev })
      throw err
    }
  },

  // BE chỉ lưu 1 mảng giờ cao điểm chung (không phân biệt ngày) — mọi range cộng lại thành 1 mảng hours
  savePeakRange: async (range) => {
    const prevRanges = get().peakRanges
    const newHours = rangeToHours(range.startTime, range.endTime)
    const otherRanges = prevRanges.filter((r) => r.id !== range.id)
    const otherHours = otherRanges.flatMap((r) => rangeToHours(r.startTime, r.endTime))
    const mergedHours = Array.from(new Set([...otherHours, ...newHours])).sort((a, b) => a - b)

    try {
      await updatePeakHoursApi(mergedHours)
      const peak = await fetchPeakHoursApi()
      set({ peakRanges: peak.ranges, peakHours: peak.hours })
    } catch (err) {
      console.error('Lỗi lưu giờ cao điểm:', err)
      throw err
    }
  },

  deletePeakRange: async (id) => {
    const range = get().peakRanges.find((r) => r.id === id)
    if (!range) return
    const removeHours = new Set(rangeToHours(range.startTime, range.endTime))
    const remainingHours = get().peakHours.filter((h) => !removeHours.has(h))
    try {
      await updatePeakHoursApi(remainingHours)
      const peak = await fetchPeakHoursApi()
      set({ peakRanges: peak.ranges, peakHours: peak.hours })
    } catch (err) {
      console.error('Lỗi xóa giờ cao điểm:', err)
      throw err
    }
  },
}))

// Đọc đồng bộ (cache) — dùng trong feeCalculator.ts vì hàm calculateFee() phải chạy đồng bộ
export function getCachedPricing() {
  return usePricingStore.getState()
}

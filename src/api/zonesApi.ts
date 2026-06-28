// API thật cho thống kê số chỗ trống theo zone/tầng — dùng cho màn hình hiển thị
// "tầng X còn Y chỗ" để staff hướng dẫn driver. Theo quyết định bỏ AI gợi ý slot:
// hệ thống chỉ đảm bảo còn chỗ hay không, không gợi ý slot cụ thể.
import { apiClient } from './client'

export interface ZoneSummary {
  id: string
  name: string
  floor: number
  status: 'ACTIVE' | 'INACTIVE'
  totalSlots: number
  availableSlots: number
  occupiedSlots: number
  occupancyRate: number
}

export async function fetchZoneSummary(): Promise<ZoneSummary[]> {
  const res = await apiClient.get('/zones/summary')
  return res.data.data as ZoneSummary[]
}

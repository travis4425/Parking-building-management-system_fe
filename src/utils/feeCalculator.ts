// Tính phí đỗ xe theo loại xe, thời gian, giờ cao điểm — dùng bảng giá thật từ pricingStore (BE)
import { getCachedPricing } from '@/store/pricingStore'
import type { ParkingSession } from '@/utils/types'

export const LOST_TICKET_SURCHARGE = 50_000  // Phụ thu mất vé: 50,000 VND (khớp BE pricing.service.ts)

export interface FeeBreakdown {
  checkInTime:      Date
  checkOutTime:     Date
  durationMinutes:  number
  billableHours:    number     // Số giờ tính tiền (tối thiểu 1h, làm tròn lên 0.5h)
  isPeak:           boolean
  isOvernight:      boolean    // Gửi xe qua đêm (> 12 giờ)
  normalHours:      number
  peakHours:        number
  normalFee:        number
  peakFee:          number
  overnightFee:     number
  surcharge:        number     // Phụ thu (mất vé)
  total:            number
  rateNormal:       number     // Giá giờ thường (VND/giờ)
  ratePeak:         number     // Giá giờ cao điểm (VND/giờ)
  rateOvernight:    number     // Giá qua đêm (VND/lần)
}

function toHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// BE chỉ lưu giờ cao điểm dạng mảng số (0-23), không phân biệt ngày trong tuần
function isPeakTime(date: Date): boolean {
  const { peakHours } = getCachedPricing()
  if (peakHours.length > 0) return peakHours.includes(date.getHours())

  // Chưa load được pricingStore (vd. gọi trước khi AppLayout mount) → dùng mặc định khớp BE
  const time = toHHMM(date)
  const defaultRanges = [['07:00', '09:00'], ['17:00', '19:00']]
  return defaultRanges.some(([start, end]) => time >= start && time <= end)
}

export function calculateFee(
  session:     ParkingSession,
  checkOut:    Date = new Date(),
  lostTicket:  boolean = false,
): FeeBreakdown {
  const { rules } = getCachedPricing()
  const pricing = rules.find((p) => p.vehicleType === session.vehicleType)
  const rateNormal     = pricing?.normalRate    ?? 5_000
  const ratePeak       = pricing?.peakRate      ?? 8_000
  const rateOvernight  = pricing?.overnightRate ?? 20_000

  const checkIn        = new Date(session.checkInTime)
  const durationMs     = Math.max(0, checkOut.getTime() - checkIn.getTime())
  const durationMinutes = Math.ceil(durationMs / 60_000)
  const rawHours       = durationMinutes / 60
  const surcharge      = lostTicket ? LOST_TICKET_SURCHARGE : 0

  // Qua đêm (> 12 giờ) → tính phí flat overnightRate
  if (rawHours > 12) {
    return {
      checkInTime: checkIn, checkOutTime: checkOut,
      durationMinutes, billableHours: rawHours,
      isPeak: false, isOvernight: true,
      normalHours: 0, peakHours: 0,
      normalFee: 0, peakFee: 0,
      overnightFee: rateOvernight,
      surcharge, total: rateOvernight + surcharge,
      rateNormal, ratePeak, rateOvernight,
    }
  }

  // Làm tròn lên bội số 0.5 giờ, tối thiểu 1 giờ
  const billableHours = Math.max(1, Math.ceil(rawHours * 2) / 2)

  // Nếu giờ vào HOẶC giờ ra là cao điểm → toàn bộ tính giá cao điểm (đơn giản hoá)
  const isPeak = isPeakTime(checkIn) || isPeakTime(checkOut)

  const peakHours   = isPeak ? billableHours : 0
  const normalHours = isPeak ? 0 : billableHours
  const normalFee   = normalHours * rateNormal
  const peakFee     = peakHours   * ratePeak

  return {
    checkInTime: checkIn, checkOutTime: checkOut,
    durationMinutes, billableHours,
    isPeak, isOvernight: false,
    normalHours, peakHours,
    normalFee, peakFee, overnightFee: 0,
    surcharge, total: normalFee + peakFee + surcharge,
    rateNormal, ratePeak, rateOvernight,
  }
}

// Format thời gian gửi xe ra chuỗi dễ đọc
export function formatDuration(minutes: number): string {
  if (minutes < 60)  return `${minutes} phút`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`
}

// Mock data 72 slot đỗ xe — 3 tầng × 24 slot, phân bổ trạng thái thực tế
import type { ParkingSlot, SlotStatus, VehicleType } from '@/utils/types'

// Phân bổ trạng thái ban đầu: ~55% trống, ~35% có xe, ~5% đặt trước, ~5% bảo trì
const INITIAL_STATUSES: SlotStatus[] = [
  'available', 'available', 'available', 'available', 'available', 'available',
  'available', 'available', 'available', 'available', 'available', 'available',
  'available', 'occupied',  'occupied',  'occupied',  'occupied',  'occupied',
  'occupied',  'occupied',  'occupied',  'reserved',  'reserved',  'maintenance',
]

// Loại xe theo vị trí — tầng 1 xe máy, tầng 2-3 ô tô
const VEHICLE_TYPE_BY_FLOOR: Record<number, VehicleType> = {
  1: 'motorbike',
  2: 'car',
  3: 'car',
}

// Biển số ngẫu nhiên cho slot có xe
const MOCK_PLATES = [
  '51A-12345', '29B-98765', '30G-11223', '43C-55678',
  '92H-77890', '50K-34512', '77L-00123', '61D-45678',
]

function generateSlots(): ParkingSlot[] {
  const slots: ParkingSlot[] = []
  const zones = ['A', 'B', 'C']
  const now = new Date().toISOString()

  zones.forEach((zone, zoneIdx) => {
    const floor = zoneIdx + 1
    const vehicleType = VEHICLE_TYPE_BY_FLOOR[floor]

    // Shuffle trạng thái để phân bổ ngẫu nhiên mỗi lần
    const shuffled = [...INITIAL_STATUSES].sort(() => Math.random() - 0.5)

    for (let i = 0; i < 24; i++) {
      const num = String(i + 1).padStart(2, '0')
      const status = shuffled[i]
      const plateIdx = Math.floor(Math.random() * MOCK_PLATES.length)

      slots.push({
        id: `${zone}-${num}`,
        code: `${zone}-${num}`,
        floor,
        zone,
        status,
        vehicleType,
        currentPlate: status === 'occupied' ? MOCK_PLATES[plateIdx] : undefined,
        updatedAt: now,
      })
    }
  })

  return slots
}

// Export singleton — gọi 1 lần khi app khởi động
export const INITIAL_SLOTS: ParkingSlot[] = generateSlots()

// Thống kê mock cho metric cards
export const MOCK_STATS = {
  todayVehicles: 47,
  todayRevenue: 4_250_000,   // VND
  activeAlerts: 3,
}

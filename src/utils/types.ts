// Định nghĩa các kiểu dữ liệu dùng chung toàn hệ thống

// 4 role người dùng trong hệ thống
export type UserRole = 'manager' | 'staff' | 'driver' | 'admin'

export interface User {
  id: string
  username: string
  name: string
  email: string
  role: UserRole
  avatar?: string
}

// Trạng thái của từng slot đỗ xe
// available/occupied/reserved: do hệ thống tự set | maintenance/locked: do manager set thủ công
export type SlotStatus = 'available' | 'occupied' | 'reserved' | 'maintenance' | 'locked'

// Loại xe
export type VehicleType = 'motorbike' | 'car' | 'truck'

export interface ParkingSlot {
  id: string
  code: string        // Ví dụ: "A-01", "B-12"
  floor: number
  zone: string        // Khu vực: A, B, C
  status: SlotStatus
  vehicleType: VehicleType
  currentPlate?: string
  sessionId?: string
  updatedAt: string   // ISO string — dùng cho IoT simulation timestamp
}

export interface ParkingSession {
  id: string
  slotId: string
  slotCode: string
  vehiclePlate: string
  vehicleType: VehicleType
  driverId?: string
  staffCheckInId: string
  staffCheckOutId?: string
  checkInTime: string   // ISO string
  checkOutTime?: string
  fee?: number
  status: 'active' | 'completed' | 'exception'
  qrCode: string        // UUID dùng để quét khi xe ra
  entryGate?: string    // Cổng vào xe
  notes?: string        // Ghi chú của nhân viên
}

export interface PricingRule {
  id: string
  vehicleType: VehicleType
  normalRate: number      // VND/giờ thường
  peakRate: number        // VND/giờ cao điểm
  overnightRate: number   // VND/đêm
  isActive: boolean
  updatedAt: string
}

export interface PeakHourRange {
  id: string
  label: string       // Ví dụ: "Buổi sáng"
  startTime: string   // "07:00"
  endTime: string     // "09:00"
  days: string[]      // ["T2","T3","T4","T5","T6"]
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}

// Loại cảnh báo IoT từ cảm biến hoặc hệ thống phát hiện
export type AlertType = 'sensor_error' | 'session_overtime' | 'wrong_zone'

export interface ParkingAlert {
  id: string
  type: AlertType
  slotCode: string
  message: string
  timestamp: string   // ISO string
  status: 'pending' | 'resolved'
}

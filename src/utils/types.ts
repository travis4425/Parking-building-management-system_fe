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
export type SlotStatus = 'available' | 'occupied' | 'reserved' | 'maintenance'

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
  qrCode: string        // Mã QR của session
}

export interface PricingRule {
  id: string
  vehicleType: VehicleType
  ratePerHour: number
  rateFirstHour: number
  maxDailyRate: number
  effectiveFrom: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}

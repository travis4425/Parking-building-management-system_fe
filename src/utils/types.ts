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

// Loại xe — đúng 3 loại chuẩn hoá với BE: MOTORBIKE / BICYCLE / CAR
export type VehicleType = 'motorbike' | 'bicycle' | 'car'

export interface ParkingSlot {
  id: string
  code: string        // Ví dụ: "A-01", "B-12"
  floor: number
  zone: string        // Khu vực: A, B, C
  status: SlotStatus
  vehicleType: VehicleType
  currentPlate?: string
  checkInTime?: string  // ISO string — thời gian xe vào (từ active session)
  sessionId?: string
  updatedAt: string   // ISO string — dùng cho IoT simulation timestamp
}

// Hình thức thanh toán — dùng chung giữa CheckOut, StaffPayment, Receipt
export type PayMethod = 'cash' | 'qr' | 'card'

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
  // paid = đã thu phí nhưng xe chưa ra | completed = xe đã ra, slot freed
  status: 'active' | 'paid' | 'completed' | 'exception'
  qrCode: string        // UUID dùng để quét khi xe ra
  entryGate?: string    // Cổng vào xe
  notes?: string        // Ghi chú của nhân viên
}

export interface PricingRule {
  id: string
  vehicleType: VehicleType
  basePrice: number       // Phí cơ bản (VND) — cộng thêm trước khi tính theo giờ, khớp BE pricing.service.ts
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

// Ngoại lệ (Exception) — khớp 3 loại BE thật (LOST_TICKET/WRONG_PLATE/WRONG_ZONE) + overtime/sensor_error
// tính trực tiếp từ sessionStore/alertStore (không lưu trong BE Exception table)
export type ExceptionType   = 'lost_qr' | 'wrong_plate' | 'wrong_zone' | 'overtime' | 'sensor_error'
// BE Exception không có field status/notes/timeline — các trường này chỉ tồn tại trên FE trong phiên làm việc
export type ExceptionStatus = 'pending' | 'resolved' | 'monitoring'

export interface TimelineEvent {
  time:   string   // ISO
  actor:  string
  action: string
}

export interface ManagerException {
  id:          string
  type:        ExceptionType
  vehiclePlate: string
  slotCode:    string
  timestamp:   string          // ISO — thời điểm phát sinh
  staffId:     string
  staffName:   string
  status:      ExceptionStatus
  notes?:      string
  sessionId?:  string
  timeline:    TimelineEvent[]
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}

// Đặt chỗ trước — driver đặt slot, slot chuyển RESERVED, tự hủy sau 15 phút nếu không check-in
export interface Reservation {
  id:                   string
  code:                 string          // RSV-XXXXXX
  driverId:             string
  vehicleType:          VehicleType
  slotId:               string          // slot được giữ
  slotCode:             string
  date:                 string          // YYYY-MM-DD
  estimatedArrival:     string          // HH:mm
  estimatedDeparture:   string          // HH:mm
  durationMinutes:      number
  estimatedFee:         number
  isAutoAssigned:       boolean         // true nếu hệ thống tự chọn slot
  status:               'pending' | 'checked_in' | 'cancelled' | 'expired'
  createdAt:            string          // ISO
  expiresAt:            string          // arrival + 15 phút (ISO) — deadline check-in
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

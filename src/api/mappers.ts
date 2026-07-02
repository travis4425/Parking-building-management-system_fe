// Mapper dùng chung — chuyển dữ liệu thô từ BE (enum UPPERCASE, field name khác) sang type FE đang dùng
import type {
  ParkingSlot,
  SlotStatus,
  VehicleType,
  ParkingSession,
  ParkingAlert,
  AlertType,
  PricingRule,
  ManagerException,
  ExceptionType,
} from '@/utils/types'
import type { BeException } from './exceptionsApi'

export function mapSlotStatus(beStatus: string): SlotStatus {
  const map: Record<string, SlotStatus> = {
    AVAILABLE: 'available',
    OCCUPIED: 'occupied',
    RESERVED: 'reserved',
    MAINTENANCE: 'maintenance',
    LOCKED: 'locked',
  }
  return map[beStatus] ?? 'available'
}

export function feToBeSlotStatus(feStatus: SlotStatus): string {
  const map: Record<SlotStatus, string> = {
    available: 'AVAILABLE',
    occupied: 'OCCUPIED',
    reserved: 'RESERVED',
    maintenance: 'MAINTENANCE',
    locked: 'LOCKED',
  }
  return map[feStatus]
}

// BE chỉ có 3 code chuẩn: MOTORBIKE / BICYCLE / CAR
export function mapVehicleTypeCode(code?: string | null): VehicleType {
  const map: Record<string, VehicleType> = {
    MOTORBIKE: 'motorbike',
    BICYCLE: 'bicycle',
    CAR: 'car',
  }
  return map[(code ?? '').toUpperCase()] ?? 'car'
}

export function feToBeVehicleTypeCode(type: VehicleType): string {
  const map: Record<VehicleType, string> = {
    motorbike: 'MOTORBIKE',
    bicycle: 'BICYCLE',
    car: 'CAR',
  }
  return map[type]
}

interface BeSlot {
  id: string
  code: string
  status: string
  zone?: { id: string; name?: string; floor: number } | null
  vehicleType?: { id: string; name?: string; code?: string } | null
  updatedAt?: string
}

export function mapSlot(beSlot: BeSlot): ParkingSlot {
  const active = (beSlot as any).activeSession ?? null
  return {
    id: beSlot.id,
    code: beSlot.code,
    floor: beSlot.zone?.floor ?? 0,
    zone: beSlot.zone?.name ?? '',
    status: mapSlotStatus(beSlot.status),
    vehicleType: mapVehicleTypeCode(beSlot.vehicleType?.code),
    updatedAt: beSlot.updatedAt ?? new Date().toISOString(),
    currentPlate: active?.licensePlate ?? undefined,
    checkInTime: active?.entryTime ?? undefined,
  }
}

interface BeSession {
  id: string
  slotId?: string | null
  slot?: { code?: string } | null
  licensePlate: string
  vehicleType?: { code?: string } | null
  vehicleTypeId?: string
  entryTime: string
  exitTime?: string | null
  status: string
  totalFee?: number | null
  qrToken: string
}

export function mapSessionStatus(beStatus: string): ParkingSession['status'] {
  const map: Record<string, ParkingSession['status']> = {
    ACTIVE: 'active',
    PAYMENT_PENDING: 'paid',
    COMPLETED: 'completed',
    CANCELLED: 'exception',
  }
  return map[beStatus] ?? 'active'
}

export function mapSession(beSession: BeSession): ParkingSession {
  return {
    id: beSession.id,
    slotId: beSession.slotId ?? '',
    slotCode: beSession.slot?.code ?? '',
    vehiclePlate: beSession.licensePlate,
    vehicleType: mapVehicleTypeCode(beSession.vehicleType?.code),
    staffCheckInId: '',
    checkInTime: beSession.entryTime,
    checkOutTime: beSession.exitTime ?? undefined,
    fee: beSession.totalFee ?? undefined,
    status: mapSessionStatus(beSession.status),
    qrCode: beSession.qrToken,
  }
}

interface BeAlert {
  id: string
  type: string
  slot?: { code?: string } | null
  slotId?: string | null
  message: string
  status: string
  createdAt: string
}

export function mapAlertType(beType: string): AlertType {
  const map: Record<string, AlertType> = {
    SENSOR_ERROR: 'sensor_error',
    SESSION_OVERTIME: 'session_overtime',
    WRONG_ZONE: 'wrong_zone',
  }
  return map[beType] ?? 'sensor_error'
}

export function feToBeAlertType(type: AlertType): string {
  const map: Record<AlertType, string> = {
    sensor_error: 'SENSOR_ERROR',
    session_overtime: 'SESSION_OVERTIME',
    wrong_zone: 'WRONG_ZONE',
  }
  return map[type]
}

export function mapAlert(beAlert: BeAlert): ParkingAlert {
  return {
    id: beAlert.id,
    type: mapAlertType(beAlert.type),
    slotCode: beAlert.slot?.code ?? '',
    message: beAlert.message,
    timestamp: beAlert.createdAt,
    status: beAlert.status === 'RESOLVED' ? 'resolved' : 'pending',
  }
}

interface BePricePolicy {
  id: string
  vehicleTypeId: string
  vehicleType?: { id: string; name?: string; code?: string } | null
  basePrice: number
  pricePerHour: number
  peakMultiplier?: number | null
  overnightRate: number
  isActive: boolean
  effectiveFrom: string
  effectiveTo?: string | null
}

// BE lưu giá theo (basePrice + pricePerHour × giờ), FE hiển thị flat normalRate/peakRate/overnightRate
// → normalRate ≈ pricePerHour, peakRate ≈ pricePerHour × peakMultiplier
// 🐞 SỬA: giữ lại basePrice (trước đây bị bỏ qua) — feeCalculator.ts cần cộng đúng
// phí cơ bản này thì số tiền ước tính trước khi thanh toán mới khớp số BE tính thật.
export function mapPricePolicy(p: BePricePolicy): PricingRule {
  const peakMultiplier = p.peakMultiplier ?? 1.5
  return {
    id: p.id,
    vehicleType: mapVehicleTypeCode(p.vehicleType?.code),
    basePrice: p.basePrice,
    normalRate: p.pricePerHour,
    peakRate: Math.round(p.pricePerHour * peakMultiplier),
    overnightRate: p.overnightRate,
    isActive: p.isActive,
    updatedAt: p.effectiveFrom,
  }
}

// BE Exception chỉ có 3 type (LOST_TICKET/WRONG_PLATE/WRONG_ZONE), không có status/notes/timeline
// → map sang ManagerException FE, các field không có trên BE dùng giá trị mặc định hợp lý
const BE_EXCEPTION_TYPE_MAP: Record<string, ExceptionType> = {
  LOST_TICKET: 'lost_qr',
  WRONG_PLATE: 'wrong_plate',
  WRONG_ZONE: 'wrong_zone',
}

export function mapException(e: BeException): ManagerException {
  return {
    id: e.id,
    type: BE_EXCEPTION_TYPE_MAP[e.type] ?? 'lost_qr',
    vehiclePlate: e.newLicensePlate || e.session?.licensePlate || e.oldLicensePlate || '—',
    slotCode: '—', // BE Exception không lưu slotCode trực tiếp
    timestamp: e.createdAt,
    staffId: '',
    staffName: '—',
    status: 'pending',
    notes: e.description ?? undefined,
    sessionId: e.sessionId,
    timeline: [
      { time: e.createdAt, actor: 'Hệ thống', action: e.description || 'Ghi nhận ngoại lệ' },
    ],
  }
}

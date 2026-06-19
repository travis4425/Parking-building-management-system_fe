// Mock sessions ban đầu — bao gồm xe quá hạn > 24h và lịch sử hoàn thành của driver01
import type { ParkingSession } from '@/utils/types'

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString()
}

// Helper: tạo ISO string từ X ngày trước, giờ h:m
function past(days: number, hour: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export const MOCK_SESSIONS: ParkingSession[] = [
  // Xe quá hạn > 24h (active) — hiển thị trong tab Xe quá hạn
  {
    id: 'sess-mock-001',
    slotId: 'A-03',
    slotCode: 'A-03',
    vehiclePlate: '51G-12345',
    vehicleType: 'motorbike',
    staffCheckInId: 'staff-01',
    checkInTime: hoursAgo(26),
    status: 'active',
    qrCode: 'qr-mock-001',
    entryGate: 'gate-1',
  },
  {
    id: 'sess-mock-002',
    slotId: 'B-15',
    slotCode: 'B-15',
    vehiclePlate: '30A-56789',
    vehicleType: 'car',
    staffCheckInId: 'staff-02',
    checkInTime: hoursAgo(31),
    status: 'active',
    qrCode: 'qr-mock-002',
    entryGate: 'gate-3',
    notes: 'Xe dài, đỗ ở cuối hàng',
  },
  {
    id: 'sess-mock-003',
    slotId: 'C-08',
    slotCode: 'C-08',
    vehiclePlate: '92H-99001',
    vehicleType: 'car',
    staffCheckInId: 'staff-01',
    checkInTime: hoursAgo(25),
    status: 'active',
    qrCode: 'qr-mock-003',
    entryGate: 'gate-2',
  },
  // Xe bình thường — gắn với tài khoản driver01 (u003) để demo trang Driver Portal
  {
    id: 'sess-mock-004',
    slotId: 'A-10',
    slotCode: 'A-10',
    vehiclePlate: '51B-23456',
    vehicleType: 'motorbike',
    driverId: 'u003',           // ← khớp với user.id của driver01
    staffCheckInId: 'staff-01',
    checkInTime: hoursAgo(3),
    status: 'active',
    qrCode: 'qr-mock-004',
    entryGate: 'gate-1',
  },
  {
    id: 'sess-mock-005',
    slotId: 'B-04',
    slotCode: 'B-04',
    vehiclePlate: '43C-77001',
    vehicleType: 'motorbike',
    staffCheckInId: 'staff-02',
    checkInTime: hoursAgo(1),
    status: 'active',
    qrCode: 'qr-mock-005',
    entryGate: 'gate-1',
  },

  // ── Lịch sử gửi xe đã hoàn thành của driver01 (u003) — 10 lượt ────────────
  {
    id: 'hist-001',
    slotId: 'A-05', slotCode: 'A-05',
    vehiclePlate: '51B-23456', vehicleType: 'motorbike',
    driverId: 'u003', staffCheckInId: 'staff-01', staffCheckOutId: 'staff-02',
    checkInTime: past(1, 8), checkOutTime: past(1, 10),
    fee: 10_000, status: 'completed', qrCode: 'qr-hist-001', entryGate: 'gate-1',
  },
  {
    id: 'hist-002',
    slotId: 'A-12', slotCode: 'A-12',
    vehiclePlate: '51B-23456', vehicleType: 'motorbike',
    driverId: 'u003', staffCheckInId: 'staff-02', staffCheckOutId: 'staff-01',
    checkInTime: past(2, 7, 30), checkOutTime: past(2, 9, 0),
    fee: 12_000, status: 'completed', qrCode: 'qr-hist-002', entryGate: 'gate-1',
    notes: 'Cao điểm sáng',
  },
  {
    id: 'hist-003',
    slotId: 'A-08', slotCode: 'A-08',
    vehiclePlate: '51B-23456', vehicleType: 'motorbike',
    driverId: 'u003', staffCheckInId: 'staff-01', staffCheckOutId: 'staff-01',
    checkInTime: past(3, 14), checkOutTime: past(3, 17),
    fee: 15_000, status: 'completed', qrCode: 'qr-hist-003', entryGate: 'gate-2',
  },
  {
    id: 'hist-004',
    slotId: 'A-17', slotCode: 'A-17',
    vehiclePlate: '51B-23456', vehicleType: 'motorbike',
    driverId: 'u003', staffCheckInId: 'staff-02', staffCheckOutId: 'staff-02',
    checkInTime: past(5, 17, 30), checkOutTime: past(5, 19, 0),
    fee: 12_000, status: 'completed', qrCode: 'qr-hist-004', entryGate: 'gate-1',
    notes: 'Cao điểm chiều',
  },
  {
    id: 'hist-005',
    slotId: 'A-21', slotCode: 'A-21',
    vehiclePlate: '51B-23456', vehicleType: 'motorbike',
    driverId: 'u003', staffCheckInId: 'staff-01', staffCheckOutId: 'staff-02',
    checkInTime: past(7, 9), checkOutTime: past(7, 11, 30),
    fee: 12_500, status: 'completed', qrCode: 'qr-hist-005', entryGate: 'gate-1',
  },
  {
    id: 'hist-006',
    slotId: 'A-02', slotCode: 'A-02',
    vehiclePlate: '51B-23456', vehicleType: 'motorbike',
    driverId: 'u003', staffCheckInId: 'staff-02', staffCheckOutId: 'staff-01',
    checkInTime: past(9, 7), checkOutTime: past(9, 8, 30),
    fee: 8_000, status: 'completed', qrCode: 'qr-hist-006', entryGate: 'gate-1',
    notes: 'Cao điểm sáng — tối thiểu 1 giờ',
  },
  {
    id: 'hist-007',
    slotId: 'B-09', slotCode: 'B-09',
    vehiclePlate: '51B-56789', vehicleType: 'car',
    driverId: 'u003', staffCheckInId: 'staff-01', staffCheckOutId: 'staff-01',
    checkInTime: past(11, 10), checkOutTime: past(11, 12),
    fee: 30_000, status: 'completed', qrCode: 'qr-hist-007', entryGate: 'gate-3',
    notes: 'Xe ô tô mượn',
  },
  {
    id: 'hist-008',
    slotId: 'A-11', slotCode: 'A-11',
    vehiclePlate: '51B-23456', vehicleType: 'motorbike',
    driverId: 'u003', staffCheckInId: 'staff-02', staffCheckOutId: 'staff-02',
    checkInTime: past(14, 13), checkOutTime: past(14, 15, 30),
    fee: 12_500, status: 'completed', qrCode: 'qr-hist-008', entryGate: 'gate-2',
  },
  {
    id: 'hist-009',
    slotId: 'A-14', slotCode: 'A-14',
    vehiclePlate: '51B-23456', vehicleType: 'motorbike',
    driverId: 'u003', staffCheckInId: 'staff-01', staffCheckOutId: 'staff-01',
    checkInTime: past(19, 7, 30), checkOutTime: past(19, 9, 30),
    fee: 16_000, status: 'completed', qrCode: 'qr-hist-009', entryGate: 'gate-1',
    notes: 'Cao điểm sáng',
  },
  {
    id: 'hist-010',
    slotId: 'A-06', slotCode: 'A-06',
    vehiclePlate: '51B-23456', vehicleType: 'motorbike',
    driverId: 'u003', staffCheckInId: 'staff-02', staffCheckOutId: 'staff-02',
    checkInTime: past(25, 15), checkOutTime: past(25, 17),
    fee: 10_000, status: 'completed', qrCode: 'qr-hist-010', entryGate: 'gate-2',
  },
]

// Thông tin liên hệ chủ xe (mock) — dùng cho tab Xe quá hạn
export const MOCK_CONTACT_MAP: Record<string, { name: string; phone: string }> = {
  '51G-12345': { name: 'Nguyễn Văn An',   phone: '0901 234 567' },
  '30A-56789': { name: 'Trần Thị Bình',   phone: '0912 345 678' },
  '92H-99001': { name: 'Lê Văn Chung',    phone: '0898 765 432' },
}

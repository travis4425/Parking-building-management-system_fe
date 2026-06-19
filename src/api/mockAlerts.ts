// Mock data cảnh báo IoT ban đầu — sensor lỗi, session quá hạn, đỗ sai khu vực
import type { ParkingAlert } from '@/utils/types'

function ago(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString()
}

export const MOCK_ALERTS: ParkingAlert[] = [
  {
    id: 'alert-001',
    type: 'sensor_error',
    slotCode: 'B-07',
    message: 'Cảm biến siêu âm mất tín hiệu liên tục > 5 phút',
    timestamp: ago(12),
    status: 'pending',
  },
  {
    id: 'alert-002',
    type: 'session_overtime',
    slotCode: 'A-03',
    message: 'Xe 51G-12345 đỗ vượt quá 24 giờ, chưa thanh toán',
    timestamp: ago(45),
    status: 'pending',
  },
  {
    id: 'alert-003',
    type: 'wrong_zone',
    slotCode: 'C-11',
    message: 'Phát hiện ô tô đỗ tại khu vực dành riêng cho xe máy',
    timestamp: ago(8),
    status: 'pending',
  },
  {
    id: 'alert-004',
    type: 'sensor_error',
    slotCode: 'A-18',
    message: 'Cảm biến báo sai trạng thái — slot trống nhưng ghi nhận occupied',
    timestamp: ago(30),
    status: 'pending',
  },
]

// Pool slot code ngẫu nhiên dùng cho IoT simulation
export const ALERT_SLOT_POOL = [
  'A-02', 'A-09', 'A-15', 'B-04', 'B-12', 'B-19',
  'C-06', 'C-14', 'C-22', 'A-21', 'B-08', 'C-01',
]

// Template message theo loại cảnh báo
export const ALERT_TEMPLATES: Record<string, string[]> = {
  sensor_error: [
    'Cảm biến siêu âm mất tín hiệu đột ngột',
    'Cảm biến báo sai trạng thái liên tục',
    'Module cảm biến không phản hồi > 3 phút',
  ],
  session_overtime: [
    'Xe đỗ vượt 24 giờ, chưa thanh toán',
    'Phiên đỗ xe đã vượt thời hạn tối đa',
    'Xe không rời bãi sau khi hết thời hạn đăng ký',
  ],
  wrong_zone: [
    'Phát hiện ô tô đỗ tại khu xe máy',
    'Xe tải đỗ sai khu vực cho phép',
    'Loại xe không khớp với khu vực đăng ký',
  ],
}

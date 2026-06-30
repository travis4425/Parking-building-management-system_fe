// Cấu hình menu sidebar cho từng role — thêm/bớt item ở đây thay vì sửa component
import type { UserRole } from '@/utils/types'
import {
  LayoutDashboard,
  ParkingSquare,
  Car,
  DollarSign,
  BarChart2,
  AlertTriangle,
  LogIn,
  LogOut,
  Receipt,
  Users,
  ShieldCheck,
  Settings,
  ScrollText,
  Home,
  CalendarCheck,
  History,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
}

export const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  manager: [
    { label: 'Dashboard',  path: '/manager',            icon: LayoutDashboard },
    { label: 'Bãi xe',     path: '/manager/slots',      icon: ParkingSquare   },
    { label: 'Phương tiện',path: '/manager/vehicles',   icon: Car             },
    { label: 'Bảng giá',  path: '/manager/pricing',    icon: DollarSign      },
    { label: 'Báo cáo',   path: '/manager/reports',    icon: BarChart2       },
    { label: 'Ngoại lệ',  path: '/manager/exceptions', icon: AlertTriangle   },
  ],
  staff: [
    { label: 'Dashboard',  path: '/staff',              icon: LayoutDashboard },
    { label: 'Xe vào',    path: '/staff/checkin',      icon: LogIn           },
    { label: 'Xe ra',     path: '/staff/checkout',     icon: LogOut          },
    { label: 'Thu phí',   path: '/staff/payment',      icon: Receipt         },
    { label: 'Ngoại lệ',  path: '/staff/exceptions',   icon: AlertTriangle   },
  ],
  driver: [
    { label: 'Trang chủ', path: '/driver',             icon: Home            },
    { label: 'Bảng giá',  path: '/driver/pricing',     icon: DollarSign      },
    { label: 'Đặt chỗ',   path: '/driver/booking',     icon: CalendarCheck   },
    { label: 'Lịch sử',   path: '/driver/history',     icon: History         },
  ],
  admin: [
    { label: 'Tài khoản',   path: '/admin/users',       icon: Users           },
    { label: 'Phân quyền',  path: '/admin/permissions', icon: ShieldCheck     },
    { label: 'Cấu hình',    path: '/admin/config',      icon: Settings        },
    { label: 'Audit Log',   path: '/admin/audit',       icon: ScrollText      },
  ],
}

// Label hiển thị tên role trong badge
export const ROLE_LABELS: Record<UserRole, string> = {
  manager: 'Quản lý',
  staff:   'Nhân viên',
  driver:  'Tài xế',
  admin:   'Admin',
}

// Màu badge theo role
export const ROLE_COLORS: Record<UserRole, string> = {
  manager: 'bg-blue-100 text-blue-700',
  staff:   'bg-green-100 text-green-700',
  driver:  'bg-orange-100 text-orange-700',
  admin:   'bg-purple-100 text-purple-700',
}

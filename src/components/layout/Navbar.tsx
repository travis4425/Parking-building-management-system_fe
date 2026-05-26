// Thanh điều hướng trên cùng — hiển thị tên user, role badge, nút logout và nút mở sidebar mobile
import { Menu, LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { ROLE_LABELS, ROLE_COLORS } from './navConfig'
import { cn } from '@/utils/cn'
import type { UserRole } from '@/utils/types'

interface NavbarProps {
  onMenuToggle: () => void
  pageTitle?: string
}

export default function Navbar({ onMenuToggle, pageTitle }: NavbarProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const role = (user?.role ?? 'driver') as UserRole

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-10 h-14 flex items-center gap-3 px-4 bg-white border-b border-gray-200 shadow-sm">
      {/* Hamburger — chỉ hiện trên mobile */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-1.5 rounded-md hover:bg-gray-100 transition-colors"
        aria-label="Mở menu"
      >
        <Menu className="w-5 h-5 text-gray-600" />
      </button>

      {/* Tiêu đề trang */}
      <h1 className="flex-1 text-base font-semibold text-gray-800 truncate">
        {pageTitle ?? 'ParkingOS'}
      </h1>

      {/* Thông tin user */}
      <div className="flex items-center gap-3">
        {/* Role badge */}
        <span className={cn(
          'hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
          ROLE_COLORS[role]
        )}>
          {ROLE_LABELS[role]}
        </span>

        {/* Avatar + tên */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
            {user?.avatar
              ? <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
              : <User className="w-4 h-4 text-gray-500" />
            }
          </div>
          <span className="hidden md:block text-sm font-medium text-gray-700 max-w-[140px] truncate">
            {user?.name}
          </span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-5 bg-gray-200" />

        {/* Nút đăng xuất */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
          title="Đăng xuất"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Đăng xuất</span>
        </button>
      </div>
    </header>
  )
}

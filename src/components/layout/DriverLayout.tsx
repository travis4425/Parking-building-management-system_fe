// Layout dành riêng cho Driver Portal — không có sidebar, chỉ có header nhỏ + bottom nav
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ParkingSquare, LogOut, User } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import DriverBottomNav from './DriverBottomNav'

interface DriverLayoutProps {
  children: ReactNode
  pageTitle?: string
}

export default function DriverLayout({ children, pageTitle }: DriverLayoutProps) {
  const { user, logout } = useAuthStore()
  const navigate         = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Compact header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 h-14 bg-white border-b border-gray-200 shadow-sm">
        <ParkingSquare className="w-5 h-5 text-blue-600 shrink-0" />
        <h1 className="flex-1 font-semibold text-gray-800 truncate text-sm">
          {pageTitle ?? 'ParkingOS'}
        </h1>

        {/* User info */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5 text-orange-600" />
          </div>
          <span className="hidden sm:block text-sm text-gray-700 max-w-[120px] truncate">
            {user?.name}
          </span>

          <button
            onClick={handleLogout}
            title="Đăng xuất"
            className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* Nội dung trang — pb-20 để không bị bottom nav che */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <DriverBottomNav />
    </div>
  )
}

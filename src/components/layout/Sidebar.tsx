// Sidebar điều hướng — render menu khác nhau theo role, hỗ trợ collapse trên mobile
import { NavLink } from 'react-router-dom'
import { X, ParkingSquare } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { NAV_ITEMS, ROLE_LABELS, ROLE_COLORS } from './navConfig'
import { cn } from '@/utils/cn'
import type { UserRole } from '@/utils/types'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuthStore()
  const role = (user?.role ?? 'driver') as UserRole
  const navItems = NAV_ITEMS[role]

  return (
    <>
      {/* Overlay mờ khi sidebar mở trên mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-30 h-full w-64 flex flex-col',
          'bg-gray-900 text-white',
          'transform transition-transform duration-200 ease-in-out',
          // Mobile: trượt vào/ra
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: luôn hiện
          'lg:translate-x-0 lg:static lg:z-auto'
        )}
      >
        {/* Header logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <ParkingSquare className="w-7 h-7 text-blue-400" />
            <span className="font-bold text-lg tracking-tight">ParkingOS</span>
          </div>
          {/* Nút đóng — chỉ hiện trên mobile */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded hover:bg-gray-700 transition-colors"
            aria-label="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role badge */}
        <div className="px-5 py-3 border-b border-gray-700">
          <span className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            ROLE_COLORS[role]
          )}>
            {ROLE_LABELS[role]}
          </span>
          {user && (
            <p className="mt-1 text-sm text-gray-300 truncate">{user.name}</p>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/manager' || item.path === '/staff' || item.path === '/driver'}
                  onClick={() => {
                    // Đóng sidebar trên mobile sau khi chọn item
                    if (window.innerWidth < 1024) onClose()
                  }}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                      'transition-colors duration-150',
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    )
                  }
                >
                  <item.icon className="w-4.5 h-4.5 shrink-0" strokeWidth={1.75} />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer version */}
        <div className="px-5 py-3 border-t border-gray-700">
          <p className="text-xs text-gray-500">ParkingOS v1.0.0</p>
        </div>
      </aside>
    </>
  )
}

// Bottom navigation dành riêng cho Driver Portal — thay thế sidebar, mobile-first
import { NavLink } from 'react-router-dom'
import { Home, DollarSign, CalendarCheck, History } from 'lucide-react'

const NAV = [
  { to: '/driver',           label: 'Trang chủ', icon: Home,          exact: true  },
  { to: '/driver/pricing',   label: 'Bảng giá',  icon: DollarSign,    exact: false },
  { to: '/driver/booking',   label: 'Đặt chỗ',   icon: CalendarCheck, exact: false },
  { to: '/driver/history',   label: 'Lịch sử',   icon: History,       exact: false },
]

export default function DriverBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 shadow-[0_-1px_6px_rgba(0,0,0,.06)]">
      <div className="flex max-w-lg mx-auto">
        {NAV.map(({ to, label, icon: Icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className="w-5 h-5"
                  strokeWidth={isActive ? 2.5 : 1.75}
                />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

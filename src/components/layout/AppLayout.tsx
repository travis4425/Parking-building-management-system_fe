// Layout bọc toàn bộ các trang có sidebar — quản lý trạng thái mở/đóng sidebar mobile
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { useSlotStore } from '@/store/slotStore'
import { useSessionStore } from '@/store/sessionStore'
import { useAlertStore } from '@/store/alertStore'
import { usePricingStore } from '@/store/pricingStore'

interface AppLayoutProps {
  children: React.ReactNode
  pageTitle?: string
}

export default function AppLayout({ children, pageTitle }: AppLayoutProps) {
  // Trạng thái sidebar trên mobile (desktop luôn hiện qua CSS)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Tải dữ liệu thật từ BE 1 lần khi vào layout (đã đăng nhập)
  const loadSlots = useSlotStore((s) => s.loadSlots)
  const loadSessions = useSessionStore((s) => s.loadSessions)
  const loadAlerts = useAlertStore((s) => s.loadAlerts)
  const loadPricing = usePricingStore((s) => s.loadPricing)

  useEffect(() => {
    loadSlots()
    loadSessions()
    loadAlerts()
    loadPricing()
  }, [loadSlots, loadSessions, loadAlerts, loadPricing])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Vùng nội dung bên phải */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Navbar trên cùng */}
        <Navbar
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          pageTitle={pageTitle}
        />

        {/* Nội dung trang — scroll độc lập */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

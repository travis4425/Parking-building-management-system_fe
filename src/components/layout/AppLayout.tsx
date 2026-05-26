// Layout bọc toàn bộ các trang có sidebar — quản lý trạng thái mở/đóng sidebar mobile
import { useState } from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

interface AppLayoutProps {
  children: React.ReactNode
  pageTitle?: string
}

export default function AppLayout({ children, pageTitle }: AppLayoutProps) {
  // Trạng thái sidebar trên mobile (desktop luôn hiện qua CSS)
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

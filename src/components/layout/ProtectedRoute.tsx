// Component bảo vệ route theo role — redirect về login nếu chưa xác thực
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/utils/types'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()

  // Chưa đăng nhập → về trang login, lưu lại trang muốn vào
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Sai role → về trang tương ứng với role hiện tại
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const roleHome: Record<UserRole, string> = {
      manager: '/manager',
      staff: '/staff',
      driver: '/driver',
      admin: '/admin',
    }
    return <Navigate to={roleHome[user.role]} replace />
  }

  return <>{children}</>
}

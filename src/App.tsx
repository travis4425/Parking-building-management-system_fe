// App root — cấu hình React Router v6 với 4 role routes, ProtectedRoute và AppLayout
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/auth/LoginPage'
import ManagerDashboard   from '@/pages/manager/ManagerDashboard'
import SlotManagement    from '@/pages/manager/SlotManagement'
import VehicleManagement from '@/pages/manager/VehicleManagement'
import PricingManagement from '@/pages/manager/PricingManagement'
import Reports           from '@/pages/manager/Reports'
import ManagerExceptions from '@/pages/manager/ManagerExceptions'
import StaffDashboard from '@/pages/staff/StaffDashboard'
import CheckIn from '@/pages/staff/CheckIn'
import CheckOut from '@/pages/staff/CheckOut'
import StaffPayment from '@/pages/staff/StaffPayment'
import StaffExceptions from '@/pages/staff/StaffExceptions'
import DriverHome from '@/pages/driver/DriverHome'
import DriverPayment from '@/pages/driver/DriverPayment'
import DriverBooking from '@/pages/driver/DriverBooking'
import DriverHistory from '@/pages/driver/DriverHistory'
import DriverPricing from '@/pages/driver/DriverPricing'
import DriverFeedback from '@/pages/driver/DriverFeedback'
import DriverLayout from '@/components/layout/DriverLayout'
import AdminDashboard    from '@/pages/admin/AdminDashboard'
import AdminUsers        from '@/pages/admin/AdminUsers'
import AdminPermissions  from '@/pages/admin/AdminPermissions'
import AdminConfig       from '@/pages/admin/AdminConfig'
import AdminAuditLog     from '@/pages/admin/AdminAuditLog'
import AdminDevices      from '@/pages/admin/AdminDevices'
import { useAuthStore, getHomeByRole } from '@/store/authStore'

function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore()
  if (isAuthenticated && user) {
    return <Navigate to={getHomeByRole(user.role)} replace />
  }
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root redirect theo role */}
        <Route path="/" element={<RootRedirect />} />

        {/* Trang đăng nhập — public, không có sidebar */}
        <Route path="/login" element={<LoginPage />} />

        {/* === MANAGER ROUTES — bọc trong AppLayout === */}
        <Route
          path="/manager"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <AppLayout pageTitle="Dashboard">
                <ManagerDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/slots"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <AppLayout pageTitle="Quản lý slot">
                <SlotManagement />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/vehicles"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <AppLayout pageTitle="Quản lý loại phương tiện">
                <VehicleManagement />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/pricing"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <AppLayout pageTitle="Bảng giá">
                <PricingManagement />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/reports"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <AppLayout pageTitle="Báo cáo">
                <Reports />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/exceptions"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <AppLayout pageTitle="Theo dõi ngoại lệ">
                <ManagerExceptions />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* === STAFF ROUTES === */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <AppLayout pageTitle="Dashboard ca trực">
                <StaffDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        {/* /staff/dashboard alias → cùng component với /staff */}
        <Route
          path="/staff/dashboard"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <AppLayout pageTitle="Dashboard ca trực">
                <StaffDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/checkin"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <AppLayout pageTitle="Xe vào">
                <CheckIn />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/checkout"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <AppLayout pageTitle="Xe ra">
                <CheckOut />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/payment"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <AppLayout pageTitle="Thu phí">
                <StaffPayment />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/exceptions"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <AppLayout pageTitle="Xử lý ngoại lệ">
                <StaffExceptions />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* === DRIVER ROUTES — dùng DriverLayout (bottom nav, không có sidebar) === */}
        <Route
          path="/driver"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <DriverLayout pageTitle="Trang chủ">
                <DriverHome />
              </DriverLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver/pricing"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <DriverLayout pageTitle="Bảng giá & Thông tin bãi">
                <DriverPricing />
              </DriverLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver/booking"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <DriverLayout pageTitle="Đặt chỗ trước">
                <DriverBooking />
              </DriverLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver/history"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <DriverLayout pageTitle="Lịch sử gửi xe">
                <DriverHistory />
              </DriverLayout>
            </ProtectedRoute>
          }
        />
        {/* Phản hồi & khiếu nại (optional) */}
        <Route
          path="/driver/feedback"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <DriverLayout pageTitle="Phản hồi & Khiếu nại">
                <DriverFeedback />
              </DriverLayout>
            </ProtectedRoute>
          }
        />
        {/* Kiosk thanh toán — accessible trực tiếp từ URL, không có trong bottom nav */}
        <Route
          path="/driver/payment"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <DriverLayout pageTitle="Kiosk Thanh toán">
                <DriverPayment />
              </DriverLayout>
            </ProtectedRoute>
          }
        />

        {/* === ADMIN ROUTES === */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout pageTitle="Quản lý hệ thống">
                <AdminDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout pageTitle="Quản lý tài khoản">
                <AdminUsers />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/permissions"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout pageTitle="Phân quyền">
                <AdminPermissions />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/config"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout pageTitle="Cấu hình hệ thống">
                <AdminConfig />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout pageTitle="Audit Log">
                <AdminAuditLog />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/devices"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout pageTitle="Thiết bị IoT">
                <AdminDevices />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Catch-all → redirect về root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

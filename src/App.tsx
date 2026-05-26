// App root — cấu hình React Router v6 với 4 role routes, ProtectedRoute và AppLayout
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/auth/LoginPage'
import ManagerDashboard from '@/pages/manager/ManagerDashboard'
import StaffDashboard from '@/pages/staff/StaffDashboard'
import DriverHome from '@/pages/driver/DriverHome'
import AdminDashboard from '@/pages/admin/AdminDashboard'
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
              <AppLayout pageTitle="Quản lý bãi xe">
                <ManagerDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/vehicles"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <AppLayout pageTitle="Phương tiện">
                <ManagerDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/pricing"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <AppLayout pageTitle="Bảng giá">
                <ManagerDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/reports"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <AppLayout pageTitle="Báo cáo">
                <ManagerDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/exceptions"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <AppLayout pageTitle="Ngoại lệ">
                <ManagerDashboard />
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
        <Route
          path="/staff/checkin"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <AppLayout pageTitle="Xe vào">
                <StaffDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/checkout"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <AppLayout pageTitle="Xe ra">
                <StaffDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/payment"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <AppLayout pageTitle="Thu phí">
                <StaffDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/exceptions"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <AppLayout pageTitle="Ngoại lệ">
                <StaffDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* === DRIVER ROUTES === */}
        <Route
          path="/driver"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <AppLayout pageTitle="Trang chủ">
                <DriverHome />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver/pricing"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <AppLayout pageTitle="Bảng giá">
                <DriverHome />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver/booking"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <AppLayout pageTitle="Đặt chỗ">
                <DriverHome />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver/history"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <AppLayout pageTitle="Lịch sử">
                <DriverHome />
              </AppLayout>
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
              <AppLayout pageTitle="Tài khoản">
                <AdminDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/permissions"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout pageTitle="Phân quyền">
                <AdminDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/config"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout pageTitle="Cấu hình hệ thống">
                <AdminDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout pageTitle="Audit Log">
                <AdminDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/devices"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout pageTitle="Thiết bị IoT">
                <AdminDashboard />
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

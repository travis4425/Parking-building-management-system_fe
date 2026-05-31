// Admin landing page — redirect về /admin/users (trang đầu tiên trong sidebar admin)
import { Navigate } from 'react-router-dom'

export default function AdminDashboard() {
  return <Navigate to="/admin/users" replace />
}

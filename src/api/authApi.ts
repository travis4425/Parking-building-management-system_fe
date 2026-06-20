// API xác thực — nối thật với BE (POST /api/auth/login). BE dùng email, FE form dùng "username"
// (với các tài khoản demo, username = phần trước "@" của email thật, xem mapping bên dưới).
import { apiClient } from './client'
import type { User, UserRole } from '@/utils/types'

export interface LoginResponse {
  user: User
  token: string
  refreshToken: string
}

interface BeUser {
  id: string
  email: string
  fullName: string | null
  phone?: string | null
  role: 'MANAGER' | 'STAFF' | 'DRIVER' | 'ADMIN'
  status?: string
}

interface BeLoginData {
  user: BeUser
  accessToken: string
  refreshToken: string
}

// Map role BE (uppercase) → role FE (lowercase, dùng cho routing/quyền)
function mapRole(role: BeUser['role']): UserRole {
  return role.toLowerCase() as UserRole
}

// BE chỉ có "email", FE form đăng nhập hiện thu "username" (cho 4 tài khoản demo) —
// quy ước: username demo chính là phần trước "@" trong email thật (manager01, staff01, driver01).
// Admin dùng nguyên email "admin@gmail.com" làm username vì không theo quy ước demo.
function usernameToEmail(username: string): string {
  if (username.includes('@')) return username
  if (username === 'admin01') return 'admin@gmail.com'
  return `${username}@parking.vn`
}

function mapBeUser(beUser: BeUser): User {
  return {
    id: beUser.id,
    username: beUser.email.split('@')[0],
    name: beUser.fullName ?? beUser.email,
    email: beUser.email,
    role: mapRole(beUser.role),
  }
}

export async function loginApi(username: string, password: string): Promise<LoginResponse> {
  try {
    const res = await apiClient.post<{ success: boolean; message: string; data: BeLoginData }>(
      '/auth/login',
      { email: usernameToEmail(username), password },
    )
    const { user, accessToken, refreshToken } = res.data.data
    return { user: mapBeUser(user), token: accessToken, refreshToken }
  } catch (err: any) {
    const message = err?.response?.data?.message ?? 'Tên đăng nhập hoặc mật khẩu không đúng'
    throw new Error(message)
  }
}

export async function logoutApi(): Promise<void> {
  try {
    await apiClient.post('/auth/logout')
  } catch {
    // Logout phía FE (xóa token local) vẫn diễn ra dù gọi BE lỗi — không throw ở đây
  }
}

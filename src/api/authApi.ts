// API xác thực — dùng mock data, sau này swap sang axios call thật
import { MOCK_USERS } from './mockData'
import type { User } from '@/utils/types'

export interface LoginResponse {
  user: User
  token: string
}

// Giả lập delay mạng để demo realworld feel
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))

export async function loginApi(username: string, password: string): Promise<LoginResponse> {
  await delay(500)

  const found = MOCK_USERS.find(
    (u) => u.username === username && u.password === password
  )

  if (!found) {
    throw new Error('Tên đăng nhập hoặc mật khẩu không đúng')
  }

  // Loại bỏ password trước khi trả về
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _pw, ...user } = found

  return {
    user,
    token: `mock-token-${user.id}-${Date.now()}`,
  }
}

export async function logoutApi(): Promise<void> {
  await delay(150)
}

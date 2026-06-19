// Mock data dùng thay thế API thật trong giai đoạn đầu phát triển
import type { User } from '@/utils/types'

export type MockUser = User & { password: string }

// Danh sách tài khoản test — mỗi role một tài khoản
export const MOCK_USERS: MockUser[] = [
  {
    id: 'u001',
    username: 'manager01',
    name: 'Nguyễn Quản Lý',
    email: 'manager@parking.vn',
    password: '123456',
    role: 'manager',
  },
  {
    id: 'u002',
    username: 'staff01',
    name: 'Trần Nhân Viên',
    email: 'staff@parking.vn',
    password: '123456',
    role: 'staff',
  },
  {
    id: 'u003',
    username: 'driver01',
    name: 'Lê Tài Xế',
    email: 'driver@parking.vn',
    password: '123456',
    role: 'driver',
  },
  {
    id: 'u004',
    username: 'admin01',
    name: 'Admin Hệ Thống',
    email: 'admin@parking.vn',
    password: '123456',
    role: 'admin',
  },
]

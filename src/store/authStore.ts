// Zustand store quản lý trạng thái xác thực — persist localStorage (remember me) hoặc sessionStorage
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User, UserRole } from '@/utils/types'
import { getMeApi } from '@/api/authApi'

interface AuthStore {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean

  login: (user: User, token: string, refreshToken?: string, rememberMe?: boolean) => void
  logout: () => void
  updateUser: (partial: Partial<User>) => void
  refreshUser: () => Promise<void>  // Gọi GET /auth/me để cập nhật user data (qrToken, plate...)
}

// Lưu lựa chọn "remember me" riêng để dùng khi khởi tạo storage
const REMEMBER_KEY = 'parking-remember-me'

// Storage động: nếu rememberMe → localStorage, ngược lại → sessionStorage
function resolveStorage() {
  const remember = localStorage.getItem(REMEMBER_KEY)
  return remember === 'true' ? localStorage : sessionStorage
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,

      login: (user, token, refreshToken, rememberMe = false) => {
        // Ghi nhớ preference trước khi lưu state
        localStorage.setItem(REMEMBER_KEY, String(rememberMe))
        set({ user, token, refreshToken: refreshToken ?? null, isAuthenticated: true })
      },

      logout: () => {
        localStorage.removeItem(REMEMBER_KEY)
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false })
      },

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),

      refreshUser: async () => {
        try {
          const fresh = await getMeApi()
          set((state) => ({
            user: state.user ? { ...state.user, ...fresh } : fresh,
          }))
        } catch {
          // Không làm gì — keep user hiện tại nếu refresh thất bại
        }
      },
    }),
    {
      name: 'parking-auth',
      storage: createJSONStorage(resolveStorage),
    }
  )
)

// Helper lấy trang home theo role
export function getHomeByRole(role: UserRole): string {
  const map: Record<UserRole, string> = {
    manager: '/manager',
    staff:   '/staff',
    driver:  '/driver',
    admin:   '/admin',
  }
  return map[role]
}

// Trang đăng nhập — form validate với react-hook-form + zod, redirect theo role sau login
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Navigate } from 'react-router-dom'
import {
  Eye, EyeOff, ParkingSquare, Loader2,
  ShieldCheck, Zap, BarChart2, Smartphone,
} from 'lucide-react'
import { loginApi } from '@/api/authApi'
import { useAuthStore, getHomeByRole } from '@/store/authStore'
import { cn } from '@/utils/cn'
import { ROLE_LABELS } from '@/components/layout/navConfig'
import type { UserRole } from '@/utils/types'

// ─── Zod schema validate form ───────────────────────────────────────────────
const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'Vui lòng nhập tên đăng nhập')
    .max(50, 'Tên đăng nhập quá dài'),
  password: z
    .string()
    .min(6, 'Mật khẩu ít nhất 6 ký tự')
    .max(100, 'Mật khẩu quá dài'),
  rememberMe: z.boolean().optional(),
})

type LoginForm = z.infer<typeof loginSchema>

// ─── Demo accounts để hiển thị hint ─────────────────────────────────────────
const DEMO_ACCOUNTS: { username: string; role: UserRole }[] = [
  { username: 'manager01', role: 'manager' },
  { username: 'staff01',   role: 'staff'   },
  { username: 'driver01',  role: 'driver'  },
  { username: 'admin01',   role: 'admin'   },
]

const ROLE_BADGE_COLORS: Record<UserRole, string> = {
  manager: 'bg-blue-50 text-blue-700 border-blue-200',
  staff:   'bg-green-50 text-green-700 border-green-200',
  driver:  'bg-orange-50 text-orange-700 border-orange-200',
  admin:   'bg-purple-50 text-purple-700 border-purple-200',
}

// ─── Features list hiển thị bên trái ─────────────────────────────────────────
const FEATURES = [
  { icon: ShieldCheck, text: 'Phân quyền 4 cấp: Quản lý, Nhân viên, Tài xế, Admin' },
  { icon: Zap,         text: 'IoT simulation realtime — cảm biến slot, LED, barrier' },
  { icon: Smartphone,  text: 'Quét QR bằng camera trình duyệt, không cần thiết bị' },
  { icon: BarChart2,   text: 'Báo cáo doanh thu & AI gợi ý slot tối ưu (Gemini)' },
]

export default function LoginPage() {
  const { isAuthenticated, user, login } = useAuthStore()
  const navigate = useNavigate()

  const [showPassword, setShowPassword] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: false },
  })

  // Đã đăng nhập → redirect ngay
  if (isAuthenticated && user) {
    return <Navigate to={getHomeByRole(user.role)} replace />
  }

  async function onSubmit(data: LoginForm) {
    setApiError(null)
    try {
      const { user: loggedUser, token } = await loginApi(data.username, data.password)
      login(loggedUser, token, data.rememberMe ?? false)
      navigate(getHomeByRole(loggedUser.role), { replace: true })
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Đăng nhập thất bại')
    }
  }

  // Click vào demo account → điền sẵn form
  function fillDemo(username: string) {
    setValue('username', username)
    setValue('password', '123456')
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Panel trái: branding ─────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 flex-col justify-between
                      bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900
                      p-10 text-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full
                          bg-blue-500/10 blur-3xl" />
          <div className="absolute bottom-10 -left-10 w-56 h-56 rounded-full
                          bg-blue-400/10 blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg">
            <ParkingSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight">ParkingOS</p>
            <p className="text-xs text-blue-300">Building Management System</p>
          </div>
        </div>

        {/* Tagline */}
        <div className="relative z-10 space-y-4">
          <h1 className="text-4xl font-bold leading-tight">
            Quản lý bãi xe<br />
            <span className="text-blue-400">thông minh & hiện đại</span>
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
            Hệ thống tích hợp IoT simulation, quét QR bằng camera,
            và AI gợi ý slot tối ưu — được thiết kế cho đồ án môn học.
          </p>
        </div>

        {/* Features */}
        <div className="relative z-10 space-y-3">
          {FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-3">
              <div className="mt-0.5 w-7 h-7 rounded-lg bg-blue-500/20 flex items-center
                              justify-center shrink-0 border border-blue-500/30">
                <Icon className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <p className="text-sm text-gray-300 leading-snug">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Panel phải: form ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center
                      bg-white px-6 py-10">
        <div className="w-full max-w-sm space-y-7">
          {/* Logo mobile (chỉ hiện khi không có panel trái) */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <ParkingSquare className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">ParkingOS</span>
          </div>

          {/* Header */}
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-gray-900">Đăng nhập</h2>
            <p className="text-sm text-gray-500">Nhập thông tin tài khoản để tiếp tục</p>
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {/* API error */}
            {apiError && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border
                              border-red-200 rounded-lg text-sm text-red-700">
                <span className="shrink-0 text-base">⚠️</span>
                {apiError}
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Tên đăng nhập
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="Nhập tên đăng nhập..."
                {...register('username')}
                className={cn(
                  'w-full px-3 py-2.5 text-sm rounded-lg border bg-white',
                  'placeholder:text-gray-400 outline-none transition-colors',
                  'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
                  errors.username
                    ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
                    : 'border-gray-300'
                )}
              />
              {errors.username && (
                <p className="text-xs text-red-600">{errors.username.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu..."
                  {...register('password')}
                  className={cn(
                    'w-full px-3 py-2.5 pr-10 text-sm rounded-lg border bg-white',
                    'placeholder:text-gray-400 outline-none transition-colors',
                    'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
                    errors.password
                      ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
                      : 'border-gray-300'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2
                             text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2">
              <input
                id="rememberMe"
                type="checkbox"
                {...register('rememberMe')}
                className="w-4 h-4 rounded border-gray-300 text-blue-600
                           accent-blue-600 cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-sm text-gray-600 cursor-pointer select-none">
                Ghi nhớ đăng nhập
              </label>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'w-full flex items-center justify-center gap-2',
                'py-2.5 px-4 rounded-lg text-sm font-semibold text-white',
                'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
                'transition-colors shadow-sm',
                'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-blue-600'
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang đăng nhập...
                </>
              ) : (
                'Đăng nhập'
              )}
            </button>
          </form>

          {/* ── Demo accounts ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 shrink-0">Tài khoản demo</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map(({ username, role }) => (
                <button
                  key={username}
                  type="button"
                  onClick={() => fillDemo(username)}
                  className={cn(
                    'flex flex-col items-start px-3 py-2 rounded-lg border text-left',
                    'hover:shadow-sm transition-all duration-150 cursor-pointer',
                    ROLE_BADGE_COLORS[role]
                  )}
                >
                  <span className="text-xs font-semibold leading-none">
                    {ROLE_LABELS[role]}
                  </span>
                  <span className="text-xs mt-1 opacity-75 font-mono">{username}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-center text-gray-400">
              Mật khẩu: <span className="font-mono font-medium text-gray-500">123456</span>
              {' · '}Click để điền tự động
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-10 text-xs text-gray-400 text-center">
          ParkingOS © 2025 · Đồ án môn học
        </p>
      </div>
    </div>
  )
}

// Trang quản lý tài khoản: bảng người dùng, filter, tìm kiếm, modal thêm mới, khóa/mở khóa
// Đã nối thật với BE (GET/POST /api/admin/users, PATCH .../status, PATCH .../role)
import { useState, useMemo, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import PageWrapper from '@/components/layout/PageWrapper'
import {
  Search, Plus, Lock, Unlock, Eye, EyeOff, X,
  UserCheck, UserX, ChevronDown, Loader2,
} from 'lucide-react'
import type { UserRole } from '@/utils/types'
import {
  fetchUsers, createUserApi, updateUserStatusApi,
  type BeManagedUser, type BeUserStatus,
} from '@/api/adminUsersApi'

interface ManagedUser {
  id: string
  username: string
  name: string
  email: string
  role: UserRole
  status: 'active' | 'locked'
  createdAt: string
  lastLogin: string
}

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin', manager: 'Quản lý', staff: 'Nhân viên', driver: 'Tài xế',
}
const ROLE_COLOR: Record<UserRole, string> = {
  admin:   'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100  text-blue-700',
  staff:   'bg-green-100  text-green-700',
  driver:  'bg-orange-100 text-orange-700',
}

// BE chỉ có email/status uppercase — map sang shape FE đang dùng cho bảng
function mapBeUser(u: BeManagedUser): ManagedUser {
  return {
    id: u.id,
    username: u.email.split('@')[0],
    name: u.fullName ?? u.email,
    email: u.email,
    role: u.role.toLowerCase() as UserRole,
    status: u.status === 'ACTIVE' ? 'active' : 'locked',
    createdAt: u.createdAt,
    lastLogin: '—', // BE chưa track lastLogin riêng
  }
}

interface UserForm {
  name: string; username: string; email: string
  password: string; role: UserRole; status: 'active' | 'locked'
}
const FORM_INIT: UserForm = { name: '', username: '', email: '', password: '', role: 'driver', status: 'active' }

function fmtDate(iso: string) {
  if (iso === '—') return '—'
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminUsers() {
  const [users, setUsers]         = useState<ManagedUser[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterRole, setFilterRole]     = useState<UserRole | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'locked'>('all')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState<UserForm>(FORM_INIT)
  const [showPwd, setShowPwd]     = useState(false)
  const [formErr, setFormErr]     = useState<Partial<Record<keyof UserForm, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await fetchUsers({ limit: 200 })
      setUsers(data.map(mapBeUser))
    } catch (err) {
      console.error('Lỗi tải danh sách tài khoản:', err)
      toast.error('Không tải được danh sách tài khoản')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter(u => {
      const matchQ      = !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      const matchRole   = filterRole === 'all'   || u.role   === filterRole
      const matchStatus = filterStatus === 'all' || u.status === filterStatus
      return matchQ && matchRole && matchStatus
    })
  }, [users, search, filterRole, filterStatus])

  const counts = useMemo(() => {
    const c = { total: users.length, active: 0, locked: 0 }
    users.forEach(u => u.status === 'active' ? c.active++ : c.locked++)
    return c
  }, [users])

  async function toggleLock(id: string) {
    const target = users.find(u => u.id === id)
    if (!target) return
    const willLock = target.status === 'active'
    const newStatus: BeUserStatus = willLock ? 'BLOCKED' : 'ACTIVE'

    setTogglingId(id)
    try {
      await updateUserStatusApi(id, newStatus)
      setUsers(prev => prev.map(u =>
        u.id === id ? { ...u, status: willLock ? 'locked' : 'active' } : u
      ))
      if (willLock) toast.warning(`Đã khóa tài khoản ${target.username}`)
      else          toast.success(`Đã mở khóa tài khoản ${target.username}`)
    } catch (err) {
      console.error('Lỗi đổi trạng thái tài khoản:', err)
      toast.error('Không đổi được trạng thái tài khoản')
    } finally {
      setTogglingId(null)
    }
  }

  function closeModal() {
    setShowModal(false)
    setForm(FORM_INIT)
    setFormErr({})
    setShowPwd(false)
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof UserForm, string>> = {}
    if (!form.name.trim())     errs.name     = 'Bắt buộc nhập họ tên'
    if (!form.email.trim())    errs.email    = 'Bắt buộc nhập email'
    else if (users.some(u => u.email === form.email.trim())) errs.email = 'Email đã tồn tại'
    if (!form.password || form.password.length < 6) errs.password = 'Mật khẩu tối thiểu 6 ký tự'
    setFormErr(errs)
    return Object.keys(errs).length === 0
  }

  async function handleAdd() {
    if (!validate()) return
    setSubmitting(true)
    try {
      const created = await createUserApi({
        email: form.email.trim(),
        password: form.password,
        fullName: form.name.trim(),
        role: form.role,
      })
      setUsers(prev => [mapBeUser(created), ...prev])
      closeModal()
      toast.success('Tạo tài khoản thành công')
    } catch (err: any) {
      const message = err?.response?.data?.message ?? 'Tạo tài khoản thất bại'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageWrapper>
      {/* Header */}
      <div className="mb-6 flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Quản lý tài khoản</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Tổng {counts.total} · {counts.active} hoạt động · {counts.locked} bị khóa
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm">
          <Plus size={15} /> Thêm tài khoản
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm tên, username, email..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>

        <div className="relative">
          <select value={filterRole} onChange={e => setFilterRole(e.target.value as UserRole | 'all')}
            className="appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
            <option value="all">Tất cả role</option>
            <option value="admin">Admin</option>
            <option value="manager">Quản lý</option>
            <option value="staff">Nhân viên</option>
            <option value="driver">Tài xế</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as 'all' | 'active' | 'locked')}
            className="appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="locked">Bị khóa</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Họ tên', 'Username', 'Email', 'Role', 'Trạng thái', 'Ngày tạo', 'Đăng nhập gần nhất', 'Thao tác'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Đang tải danh sách tài khoản...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-gray-400">Không tìm thấy tài khoản nào</td>
                </tr>
              ) : filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 bg-gray-50/50">{u.username}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLOR[u.role]}`}>
                      {ROLE_LABEL[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.status === 'active'
                      ? <span className="flex items-center gap-1.5 text-green-600 text-xs font-medium"><UserCheck size={13} /> Hoạt động</span>
                      : <span className="flex items-center gap-1.5 text-red-500  text-xs font-medium"><UserX     size={13} /> Bị khóa</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(u.lastLogin)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleLock(u.id)} disabled={togglingId === u.id}
                      title={u.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50
                        ${u.status === 'active'
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                      {togglingId === u.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : u.status === 'active'
                          ? <><Lock   size={12} /> Khóa</>
                          : <><Unlock size={12} /> Mở khóa</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            Hiển thị {filtered.length} / {users.length} tài khoản
          </div>
        )}
      </div>

      {/* ─── Modal thêm tài khoản ─── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-800">Thêm tài khoản mới</h3>
              <button onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              {/* Họ tên */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Họ tên <span className="text-red-500">*</span>
                </label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nguyễn Văn A"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300
                    ${formErr.name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
                {formErr.name && <p className="text-red-500 text-xs mt-1">{formErr.name}</p>}
              </div>

              {/* Email — BE dùng email làm định danh đăng nhập (không có username riêng) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="user@parking.vn"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300
                    ${formErr.email ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
                {formErr.email && <p className="text-red-500 text-xs mt-1">{formErr.email}</p>}
              </div>

              {/* Mật khẩu */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mật khẩu <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Tối thiểu 6 ký tự"
                    className={`w-full border rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300
                      ${formErr.password ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {formErr.password && <p className="text-red-500 text-xs mt-1">{formErr.password}</p>}
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                  <option value="driver">Tài xế</option>
                  <option value="staff">Nhân viên</option>
                  <option value="manager">Quản lý</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={closeModal} disabled={submitting}
                className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                Hủy
              </button>
              <button onClick={handleAdd} disabled={submitting}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Tạo tài khoản
              </button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  )
}

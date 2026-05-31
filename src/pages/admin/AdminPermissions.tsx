// Trang phân quyền: ma trận module × quyền (read/write/delete) cho từng role
import { useState } from 'react'
import PageWrapper from '@/components/layout/PageWrapper'
import { ShieldCheck, RotateCcw, Save, Info } from 'lucide-react'
import type { UserRole } from '@/utils/types'

interface Perm { read: boolean; write: boolean; delete: boolean }
type PermMatrix = Record<string, Record<string, Perm>>

// Module trong hệ thống
const MODULES = [
  { key: 'dashboard',  label: 'Bảng điều khiển',  desc: 'Xem tổng quan hệ thống' },
  { key: 'slots',      label: 'Quản lý slot',      desc: 'Xem, cập nhật trạng thái slot đỗ xe' },
  { key: 'sessions',   label: 'Phiên đỗ xe',       desc: 'Check-in / check-out phương tiện' },
  { key: 'payment',    label: 'Thu phí',            desc: 'Xử lý thanh toán, xem lịch sử ca' },
  { key: 'pricing',    label: 'Bảng giá',           desc: 'Xem và cập nhật quy tắc giá' },
  { key: 'reports',    label: 'Báo cáo',            desc: 'Xem và xuất báo cáo doanh thu' },
  { key: 'exceptions', label: 'Ngoại lệ',           desc: 'Xử lý mất QR, sai biển số, xe quá hạn' },
  { key: 'users',      label: 'Tài khoản',          desc: 'Quản lý người dùng hệ thống' },
  { key: 'config',     label: 'Cấu hình',           desc: 'Thiết lập tham số hệ thống' },
  { key: 'audit',      label: 'Audit Log',          desc: 'Xem nhật ký thao tác toàn hệ thống' },
  { key: 'devices',    label: 'Thiết bị IoT',       desc: 'Giám sát camera, cảm biến, barrier' },
]

const ROLES: { key: UserRole; label: string; color: string }[] = [
  { key: 'admin',   label: 'Admin',     color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { key: 'manager', label: 'Quản lý',   color: 'text-blue-700   bg-blue-50   border-blue-200' },
  { key: 'staff',   label: 'Nhân viên', color: 'text-green-700  bg-green-50  border-green-200' },
  { key: 'driver',  label: 'Tài xế',    color: 'text-orange-700 bg-orange-50 border-orange-200' },
]

// Quyền mặc định — admin luôn full access
function defaultPerms(): PermMatrix {
  const all: Perm = { read: true, write: true, delete: true }
  const r:   Perm = { read: true, write: false, delete: false }
  const rw:  Perm = { read: true, write: true,  delete: false }
  const no:  Perm = { read: false, write: false, delete: false }

  return {
    admin: Object.fromEntries(MODULES.map(m => [m.key, { ...all }])),
    manager: {
      dashboard:  { ...r  },
      slots:      { ...rw },
      sessions:   { ...rw },
      payment:    { ...r  },
      pricing:    { read: true, write: true, delete: true },
      reports:    { ...r  },
      exceptions: { ...rw },
      users:      { ...r  },
      config:     { ...r  },
      audit:      { ...r  },
      devices:    { ...rw },
    },
    staff: {
      dashboard:  { ...r  },
      slots:      { ...r  },
      sessions:   { ...rw },
      payment:    { ...rw },
      pricing:    { ...r  },
      reports:    { ...no },
      exceptions: { ...rw },
      users:      { ...no },
      config:     { ...no },
      audit:      { ...no },
      devices:    { ...no },
    },
    driver: {
      dashboard:  { ...r  },
      slots:      { ...r  },
      sessions:   { ...r  },
      payment:    { ...r  },
      pricing:    { ...r  },
      reports:    { ...no },
      exceptions: { ...r  },
      users:      { ...no },
      config:     { ...no },
      audit:      { ...no },
      devices:    { ...no },
    },
  }
}

export default function AdminPermissions() {
  const [perms, setPerms]           = useState<PermMatrix>(defaultPerms)
  const [activeRole, setActiveRole] = useState<UserRole>('manager')
  const [saved, setSaved]           = useState(false)

  function toggle(moduleKey: string, perm: keyof Perm) {
    if (activeRole === 'admin') return // admin: bất biến
    setPerms(prev => ({
      ...prev,
      [activeRole]: {
        ...prev[activeRole],
        [moduleKey]: {
          ...prev[activeRole][moduleKey],
          [perm]: !prev[activeRole][moduleKey][perm],
        },
      },
    }))
    setSaved(false)
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleReset() {
    setPerms(defaultPerms())
    setSaved(false)
  }

  const rolePerms = perms[activeRole]
  const isAdmin   = activeRole === 'admin'

  return (
    <PageWrapper>
      {/* Header */}
      <div className="mb-6 flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck size={20} className="text-purple-600" /> Phân quyền hệ thống
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Cấu hình quyền truy cập cho từng role</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <RotateCcw size={14} /> Đặt lại mặc định
          </button>
          <button onClick={handleSave}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            <Save size={14} /> {saved ? 'Đã lưu!' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      {/* Role tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {ROLES.map(role => (
          <button key={role.key} onClick={() => setActiveRole(role.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
              ${activeRole === role.key ? role.color + ' shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {role.label}
            {role.key === 'admin' && <span className="ml-1.5 text-xs opacity-70">(full access)</span>}
          </button>
        ))}
      </div>

      {/* Admin note */}
      {isAdmin && (
        <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-xl p-4 mb-5 text-sm text-purple-700">
          <Info size={16} className="shrink-0 mt-0.5" />
          <span>Admin có toàn quyền trên tất cả module và không thể thay đổi. Đây là thiết kế bảo mật của hệ thống.</span>
        </div>
      )}

      {/* Permissions table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide w-1/3">Module</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600 text-xs uppercase tracking-wide">Read</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600 text-xs uppercase tracking-wide">Write</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600 text-xs uppercase tracking-wide">Delete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {MODULES.map(mod => {
              const p = rolePerms[mod.key]
              return (
                <tr key={mod.key} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-gray-800">{mod.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{mod.desc}</div>
                  </td>
                  {(['read', 'write', 'delete'] as const).map(perm => (
                    <td key={perm} className="px-4 py-3.5 text-center">
                      <label className={`inline-flex items-center justify-center ${isAdmin ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={p[perm]}
                          disabled={isAdmin}
                          onChange={() => toggle(mod.key, perm)}
                          className="w-4 h-4 rounded accent-blue-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </label>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
        <span><strong>Read:</strong> Xem dữ liệu, báo cáo</span>
        <span><strong>Write:</strong> Tạo mới, chỉnh sửa</span>
        <span><strong>Delete:</strong> Xóa, hủy bỏ dữ liệu</span>
      </div>
    </PageWrapper>
  )
}

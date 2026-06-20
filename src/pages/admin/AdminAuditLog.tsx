// Trang audit log: nhật ký thao tác hệ thống — ai, làm gì, lúc nào, IP
// Đã nối thật với BE (GET /api/admin/audit-logs) — BE không lưu trạng thái success/failed
// (chỉ ghi log khi hành động thành công) nên bỏ cột "Trạng thái" so với bản mock cũ.
import { useState, useMemo, useEffect, useCallback } from 'react'
import PageWrapper from '@/components/layout/PageWrapper'
import { Search, ChevronLeft, ChevronRight, ChevronDown, Download, Loader2 } from 'lucide-react'
import type { UserRole } from '@/utils/types'
import { fetchAuditLogs, type BeAuditLog } from '@/api/adminUsersApi'
import { fetchUsers } from '@/api/adminUsersApi'

interface AuditEntry {
  id: string
  timestamp: string
  userId: string
  userName: string
  userRole: UserRole | null
  action: string
  actionLabel: string
  target: string
  detail: string
  ip: string
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN:                 'Đăng nhập',
  LOGOUT:                'Đăng xuất',
  REGISTER:              'Đăng ký tài khoản',
  CHANGE_PASSWORD:       'Đổi mật khẩu',
  CREATE:                'Tạo mới',
  UPDATE:                'Cập nhật',
  UPDATE_STATUS:         'Đổi trạng thái',
  UPDATE_LICENSE_PLATE:  'Sửa biển số',
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN:                'bg-blue-100 text-blue-700',
  LOGOUT:               'bg-gray-100 text-gray-600',
  REGISTER:             'bg-purple-100 text-purple-700',
  CHANGE_PASSWORD:      'bg-yellow-100 text-yellow-700',
  CREATE:               'bg-green-100 text-green-700',
  UPDATE:               'bg-indigo-100 text-indigo-700',
  UPDATE_STATUS:        'bg-orange-100 text-orange-700',
  UPDATE_LICENSE_PLATE: 'bg-pink-100 text-pink-700',
}

const ROLE_COLOR: Record<UserRole, string> = {
  admin:   'text-purple-700',
  manager: 'text-blue-700',
  staff:   'text-green-700',
  driver:  'text-orange-700',
}

const PAGE_SIZE = 10

const ACTION_OPTIONS = [
  { value: 'all',                  label: 'Tất cả hành động' },
  { value: 'LOGIN',                label: 'Đăng nhập' },
  { value: 'LOGOUT',               label: 'Đăng xuất' },
  { value: 'REGISTER',             label: 'Đăng ký tài khoản' },
  { value: 'CHANGE_PASSWORD',      label: 'Đổi mật khẩu' },
  { value: 'CREATE',               label: 'Tạo mới' },
  { value: 'UPDATE',               label: 'Cập nhật' },
  { value: 'UPDATE_STATUS',        label: 'Đổi trạng thái' },
  { value: 'UPDATE_LICENSE_PLATE', label: 'Sửa biển số' },
]

function mapBeLog(log: BeAuditLog, userMap: Map<string, { name: string; role: UserRole }>): AuditEntry {
  const u = userMap.get(log.userId)
  const detailParts: string[] = []
  if (log.oldData) detailParts.push(`Trước: ${log.oldData}`)
  if (log.newData) detailParts.push(`Sau: ${log.newData}`)

  return {
    id: log.id,
    timestamp: log.createdAt,
    userId: log.userId,
    userName: u?.name ?? log.userId,
    userRole: u?.role ?? null,
    action: log.action,
    actionLabel: ACTION_LABELS[log.action] ?? log.action,
    target: log.resource + (log.resourceId ? ` #${log.resourceId.slice(0, 8)}` : ''),
    detail: detailParts.join(' · ') || '—',
    ip: log.ipAddress ?? '—',
  }
}

export default function AdminAuditLog() {
  const [logs, setLogs]             = useState<AuditEntry[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [filterPeriod, setFilterPeriod] = useState<'1d' | '7d' | '30d'>('7d')
  const [page, setPage]             = useState(1)

  const loadLogs = useCallback(async (period: '1d' | '7d' | '30d') => {
    setLoading(true)
    try {
      const days = period === '1d' ? 1 : period === '7d' ? 7 : 30
      const startDate = new Date(Date.now() - days * 86_400_000).toISOString()

      const [{ data: rawLogs }, { data: users }] = await Promise.all([
        fetchAuditLogs({ startDate, limit: 500 }),
        fetchUsers({ limit: 200 }),
      ])

      const userMap = new Map(
        users.map((u) => [u.id, { name: u.fullName ?? u.email, role: u.role.toLowerCase() as UserRole }])
      )
      setLogs(rawLogs.map((l) => mapBeLog(l, userMap)))
    } catch (err) {
      console.error('Lỗi tải audit log:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadLogs(filterPeriod) }, [filterPeriod, loadLogs])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return logs
      .filter(log => {
        const matchQ      = !q || log.userName.toLowerCase().includes(q) || log.target.toLowerCase().includes(q) || log.detail.toLowerCase().includes(q)
        const matchAction = filterAction === 'all' || log.action === filterAction
        return matchQ && matchAction
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [logs, search, filterAction])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleExport() {
    const rows = ['Thời gian,Người dùng,Role,Hành động,Đối tượng,Chi tiết,IP',
      ...filtered.map(l => [
        new Date(l.timestamp).toLocaleString('vi-VN'),
        l.userName, l.userRole ?? '', l.actionLabel, l.target,
        `"${l.detail}"`, l.ip,
      ].join(','))
    ].join('\n')
    const blob = new Blob(['﻿' + rows], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: `audit-log-${Date.now()}.csv` })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PageWrapper>
      {/* Header */}
      <div className="mb-6 flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Audit Log</h2>
          <p className="text-sm text-gray-500 mt-0.5">Nhật ký thao tác toàn hệ thống</p>
        </div>
        <button onClick={handleExport}
          className="flex items-center gap-2 border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium">
          <Download size={14} /> Xuất CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Tìm người dùng, đối tượng, chi tiết..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>

        <div className="relative">
          <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1) }}
            className="appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
            {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          {(['1d', '7d', '30d'] as const).map(p => (
            <button key={p} onClick={() => { setFilterPeriod(p); setPage(1) }}
              className={`px-3 py-2 text-sm font-medium transition-colors
                ${filterPeriod === p ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {p === '1d' ? 'Hôm nay' : p === '7d' ? '7 ngày' : '30 ngày'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Thời gian', 'Người dùng', 'Hành động', 'Đối tượng', 'Chi tiết', 'IP'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Đang tải nhật ký...
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-gray-400">Không có nhật ký nào trong khoảng thời gian này</td>
                </tr>
              ) : paged.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap font-mono">
                    {new Date(log.timestamp).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'medium' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800 text-xs">{log.userName}</div>
                    {log.userRole && <div className={`text-xs ${ROLE_COLOR[log.userRole]}`}>{log.userRole}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-700'}`}>
                      {log.actionLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{log.target}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-xs">
                    <span className="line-clamp-2">{log.detail}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            {filtered.length === 0 ? 'Không có kết quả' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} / ${filtered.length} bản ghi`}
          </span>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}

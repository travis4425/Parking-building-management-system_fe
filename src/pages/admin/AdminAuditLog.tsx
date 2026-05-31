// Trang audit log: nhật ký thao tác hệ thống — ai, làm gì, lúc nào, IP, trạng thái
import { useState, useMemo } from 'react'
import PageWrapper from '@/components/layout/PageWrapper'
import { Search, ChevronLeft, ChevronRight, ChevronDown, Download } from 'lucide-react'
import type { UserRole } from '@/utils/types'

interface AuditEntry {
  id: string
  timestamp: string
  userId: string
  userName: string
  userRole: UserRole
  action: string
  actionLabel: string
  target: string
  detail: string
  ip: string
  status: 'success' | 'failed'
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN:              'bg-blue-100 text-blue-700',
  LOGOUT:             'bg-gray-100 text-gray-600',
  CHECKIN:            'bg-green-100 text-green-700',
  CHECKOUT:           'bg-teal-100 text-teal-700',
  COLLECT_PAYMENT:    'bg-yellow-100 text-yellow-700',
  UPDATE_PRICE:       'bg-orange-100 text-orange-700',
  ADD_USER:           'bg-purple-100 text-purple-700',
  LOCK_USER:          'bg-red-100 text-red-700',
  UNLOCK_USER:        'bg-green-100 text-green-700',
  UPDATE_SLOT:        'bg-indigo-100 text-indigo-700',
  RESOLVE_EXCEPTION:  'bg-pink-100 text-pink-700',
  EXPORT_REPORT:      'bg-cyan-100 text-cyan-700',
}

const ROLE_COLOR: Record<UserRole, string> = {
  admin:   'text-purple-700',
  manager: 'text-blue-700',
  staff:   'text-green-700',
  driver:  'text-orange-700',
}

function pastTs(daysAgo: number, hour: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

const MOCK_LOGS: AuditEntry[] = [
  { id: 'log-001', timestamp: pastTs(0, 8, 5),  userId: 'u001', userName: 'admin01',   userRole: 'admin',   action: 'LOGIN',             actionLabel: 'Đăng nhập',          target: 'Hệ thống',          detail: 'Đăng nhập thành công từ trình duyệt Chrome',                        ip: '192.168.1.100', status: 'success' },
  { id: 'log-002', timestamp: pastTs(0, 8, 12), userId: 'u001', userName: 'admin01',   userRole: 'admin',   action: 'ADD_USER',          actionLabel: 'Thêm tài khoản',     target: 'staff04',           detail: 'Tạo tài khoản nhân viên mới: Nguyễn Thị Dung',                      ip: '192.168.1.100', status: 'success' },
  { id: 'log-003', timestamp: pastTs(0, 8, 30), userId: 'u002', userName: 'manager01', userRole: 'manager', action: 'LOGIN',             actionLabel: 'Đăng nhập',          target: 'Hệ thống',          detail: 'Đăng nhập thành công',                                               ip: '192.168.1.105', status: 'success' },
  { id: 'log-004', timestamp: pastTs(0, 8, 45), userId: 'u002', userName: 'manager01', userRole: 'manager', action: 'UPDATE_PRICE',      actionLabel: 'Cập nhật giá',       target: 'Xe máy',            detail: 'Đổi giá thường: 5.000 → 6.000 VND/h',                               ip: '192.168.1.105', status: 'success' },
  { id: 'log-005', timestamp: pastTs(0, 9, 0),  userId: 'u005', userName: 'staff01',   userRole: 'staff',   action: 'LOGIN',             actionLabel: 'Đăng nhập',          target: 'Hệ thống',          detail: 'Đăng nhập thành công',                                               ip: '10.0.0.12',     status: 'success' },
  { id: 'log-006', timestamp: pastTs(0, 9, 3),  userId: 'u005', userName: 'staff01',   userRole: 'staff',   action: 'CHECKIN',           actionLabel: 'Xe vào',             target: '51G-12345',         detail: 'Check-in xe máy, slot A-03, cổng gate-1',                            ip: '10.0.0.12',     status: 'success' },
  { id: 'log-007', timestamp: pastTs(0, 9, 15), userId: 'u005', userName: 'staff01',   userRole: 'staff',   action: 'CHECKIN',           actionLabel: 'Xe vào',             target: '30A-56789',         detail: 'Check-in ô tô, slot B-05, cổng gate-1',                              ip: '10.0.0.12',     status: 'success' },
  { id: 'log-008', timestamp: pastTs(0, 10, 0), userId: 'u005', userName: 'staff01',   userRole: 'staff',   action: 'CHECKOUT',          actionLabel: 'Xe ra',              target: '51G-12345',         detail: 'Check-out xe máy A-03, phí 10.000 VND',                              ip: '10.0.0.12',     status: 'success' },
  { id: 'log-009', timestamp: pastTs(0, 10, 5), userId: 'u005', userName: 'staff01',   userRole: 'staff',   action: 'COLLECT_PAYMENT',   actionLabel: 'Thu phí',            target: 'INV-20260601-0001', detail: 'Thanh toán QR 30.000 VND, biển 30A-56789',                           ip: '10.0.0.12',     status: 'success' },
  { id: 'log-010', timestamp: pastTs(0, 11, 0), userId: 'u001', userName: 'admin01',   userRole: 'admin',   action: 'LOCK_USER',         actionLabel: 'Khóa tài khoản',     target: 'manager02',         detail: 'Khóa tài khoản manager02 theo yêu cầu HR',                           ip: '192.168.1.100', status: 'success' },
  { id: 'log-011', timestamp: pastTs(0, 11, 30),userId: 'u006', userName: 'staff02',   userRole: 'staff',   action: 'RESOLVE_EXCEPTION', actionLabel: 'Xử lý ngoại lệ',    target: '92H-99001',         detail: 'Giải quyết xe quá hạn 25h, thu phí ngoại lệ 150.000 VND',           ip: '10.0.0.15',     status: 'success' },
  { id: 'log-012', timestamp: pastTs(0, 13, 0), userId: 'u002', userName: 'manager01', userRole: 'manager', action: 'EXPORT_REPORT',     actionLabel: 'Xuất báo cáo',       target: 'Doanh thu T5/2026', detail: 'Xuất Excel báo cáo doanh thu tháng 5/2026',                          ip: '192.168.1.105', status: 'success' },
  { id: 'log-013', timestamp: pastTs(0, 14, 0), userId: 'u005', userName: 'staff01',   userRole: 'staff',   action: 'CHECKIN',           actionLabel: 'Xe vào',             target: '43C-77001',         detail: 'Check-in xe máy, slot B-04, cổng gate-1',                            ip: '10.0.0.12',     status: 'success' },
  { id: 'log-014', timestamp: pastTs(0, 14, 5), userId: 'u006', userName: 'staff02',   userRole: 'staff',   action: 'CHECKIN',           actionLabel: 'Xe vào',             target: '99A-11223',         detail: 'Thử check-in xe tải — biển số không hợp lệ định dạng',               ip: '10.0.0.15',     status: 'failed'  },
  { id: 'log-015', timestamp: pastTs(1, 9, 0),  userId: 'u002', userName: 'manager01', userRole: 'manager', action: 'UPDATE_SLOT',       actionLabel: 'Cập nhật slot',      target: 'C-12',              detail: 'Chuyển slot C-12 sang trạng thái bảo trì (sensor lỗi)',              ip: '192.168.1.105', status: 'success' },
  { id: 'log-016', timestamp: pastTs(1, 10, 0), userId: 'u005', userName: 'staff01',   userRole: 'staff',   action: 'RESOLVE_EXCEPTION', actionLabel: 'Xử lý ngoại lệ',    target: '51G-99999',         detail: 'Mất thẻ QR: check-out thủ công bằng biển số',                        ip: '10.0.0.12',     status: 'success' },
  { id: 'log-017', timestamp: pastTs(1, 17, 0), userId: 'u001', userName: 'admin01',   userRole: 'admin',   action: 'UNLOCK_USER',       actionLabel: 'Mở khóa tài khoản', target: 'staff03',           detail: 'Mở khóa tài khoản staff03 sau xác minh',                            ip: '192.168.1.100', status: 'success' },
  { id: 'log-018', timestamp: pastTs(2, 8, 0),  userId: 'u002', userName: 'manager01', userRole: 'manager', action: 'LOGIN',             actionLabel: 'Đăng nhập',          target: 'Hệ thống',          detail: 'Đăng nhập thất bại — sai mật khẩu',                                 ip: '192.168.1.107', status: 'failed'  },
  { id: 'log-019', timestamp: pastTs(2, 8, 2),  userId: 'u002', userName: 'manager01', userRole: 'manager', action: 'LOGIN',             actionLabel: 'Đăng nhập',          target: 'Hệ thống',          detail: 'Đăng nhập thành công',                                               ip: '192.168.1.105', status: 'success' },
  { id: 'log-020', timestamp: pastTs(3, 16, 0), userId: 'u001', userName: 'admin01',   userRole: 'admin',   action: 'UPDATE_PRICE',      actionLabel: 'Cập nhật giá',       target: 'Ô tô',              detail: 'Cập nhật giá ô tô cao điểm: 25.000 → 30.000 VND/h',                ip: '192.168.1.100', status: 'success' },
]

const PAGE_SIZE = 10

const ACTION_OPTIONS = [
  { value: 'all',               label: 'Tất cả hành động' },
  { value: 'LOGIN',             label: 'Đăng nhập / Đăng xuất' },
  { value: 'CHECKIN',           label: 'Xe vào' },
  { value: 'CHECKOUT',          label: 'Xe ra' },
  { value: 'COLLECT_PAYMENT',   label: 'Thu phí' },
  { value: 'UPDATE_PRICE',      label: 'Cập nhật giá' },
  { value: 'ADD_USER',          label: 'Thêm tài khoản' },
  { value: 'LOCK_USER',         label: 'Khóa / Mở khóa' },
  { value: 'UPDATE_SLOT',       label: 'Cập nhật slot' },
  { value: 'RESOLVE_EXCEPTION', label: 'Xử lý ngoại lệ' },
  { value: 'EXPORT_REPORT',     label: 'Xuất báo cáo' },
]

export default function AdminAuditLog() {
  const [search, setSearch]         = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [filterPeriod, setFilterPeriod] = useState<'1d' | '7d' | '30d'>('7d')
  const [page, setPage]             = useState(1)

  const filtered = useMemo(() => {
    const q   = search.toLowerCase()
    const now = Date.now()
    const periodMs = filterPeriod === '1d' ? 86_400_000 : filterPeriod === '7d' ? 7 * 86_400_000 : 30 * 86_400_000

    return MOCK_LOGS
      .filter(log => {
        const matchQ      = !q || log.userName.toLowerCase().includes(q) || log.target.toLowerCase().includes(q) || log.detail.toLowerCase().includes(q)
        const matchAction = filterAction === 'all' || log.action === filterAction || (filterAction === 'LOGIN' && log.action === 'LOGOUT')
        const matchPeriod = now - new Date(log.timestamp).getTime() <= periodMs
        return matchQ && matchAction && matchPeriod
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [search, filterAction, filterPeriod])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleExport() {
    const rows = ['Thời gian,Người dùng,Role,Hành động,Đối tượng,Chi tiết,IP,Trạng thái',
      ...filtered.map(l => [
        new Date(l.timestamp).toLocaleString('vi-VN'),
        l.userName, l.userRole, l.actionLabel, l.target,
        `"${l.detail}"`, l.ip, l.status === 'success' ? 'Thành công' : 'Thất bại'
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
                {['Thời gian', 'Người dùng', 'Hành động', 'Đối tượng', 'Chi tiết', 'IP', 'Trạng thái'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-gray-400">Không có nhật ký nào trong khoảng thời gian này</td>
                </tr>
              ) : paged.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap font-mono">
                    {new Date(log.timestamp).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'medium' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800 text-xs">{log.userName}</div>
                    <div className={`text-xs ${ROLE_COLOR[log.userRole]}`}>{log.userRole}</div>
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
                  <td className="px-4 py-3">
                    {log.status === 'success'
                      ? <span className="text-green-600 text-xs font-medium">✓ Thành công</span>
                      : <span className="text-red-500  text-xs font-medium">✗ Thất bại</span>}
                  </td>
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

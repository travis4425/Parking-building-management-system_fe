// Trang quản lý thiết bị IoT: camera LPR, cảm biến siêu âm, barrier — online/offline
import { useState, useMemo } from 'react'
import PageWrapper from '@/components/layout/PageWrapper'
import {
  Camera, Radio, BarChart2, Server,
  Wifi, WifiOff, AlertTriangle,
  RefreshCw, ChevronDown,
} from 'lucide-react'

type DeviceType = 'camera_lpr' | 'sensor' | 'barrier' | 'server'
type DeviceStatus = 'online' | 'offline' | 'warning'

interface IoTDevice {
  id: string
  name: string
  type: DeviceType
  location: string
  status: DeviceStatus
  lastSeen: string
  ip: string
  firmware: string
  uptime?: string
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString()
}
function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString()
}

const INITIAL_DEVICES: IoTDevice[] = [
  // Camera LPR
  { id: 'dev-cam-01', name: 'Camera LPR Cổng 1',  type: 'camera_lpr', location: 'Cổng vào/ra 1 (Tầng 1)', status: 'online',  lastSeen: minutesAgo(1),  ip: '10.0.1.10', firmware: 'v2.4.1', uptime: '12 ngày 5h' },
  { id: 'dev-cam-02', name: 'Camera LPR Cổng 2',  type: 'camera_lpr', location: 'Cổng vào/ra 2 (Tầng 1)', status: 'online',  lastSeen: minutesAgo(0),  ip: '10.0.1.11', firmware: 'v2.4.1', uptime: '12 ngày 5h' },
  { id: 'dev-cam-03', name: 'Camera LPR Cổng 3',  type: 'camera_lpr', location: 'Cổng vào/ra 3 (Tầng 2)', status: 'offline', lastSeen: hoursAgo(3),    ip: '10.0.1.12', firmware: 'v2.3.8' },

  // Cảm biến siêu âm
  { id: 'dev-sns-01', name: 'Cảm biến A-01',       type: 'sensor',     location: 'Slot A-01 (Tầng 1 – Khu A)', status: 'online',  lastSeen: minutesAgo(2),  ip: '10.0.2.101', firmware: 'v1.2.0', uptime: '30 ngày' },
  { id: 'dev-sns-02', name: 'Cảm biến A-02',       type: 'sensor',     location: 'Slot A-02 (Tầng 1 – Khu A)', status: 'online',  lastSeen: minutesAgo(2),  ip: '10.0.2.102', firmware: 'v1.2.0', uptime: '30 ngày' },
  { id: 'dev-sns-03', name: 'Cảm biến B-01',       type: 'sensor',     location: 'Slot B-01 (Tầng 2 – Khu B)', status: 'warning', lastSeen: minutesAgo(15), ip: '10.0.2.201', firmware: 'v1.1.9' },
  { id: 'dev-sns-04', name: 'Cảm biến B-02',       type: 'sensor',     location: 'Slot B-02 (Tầng 2 – Khu B)', status: 'online',  lastSeen: minutesAgo(2),  ip: '10.0.2.202', firmware: 'v1.2.0', uptime: '25 ngày' },
  { id: 'dev-sns-05', name: 'Cảm biến C-01',       type: 'sensor',     location: 'Slot C-01 (Tầng 3 – Khu C)', status: 'online',  lastSeen: minutesAgo(2),  ip: '10.0.2.301', firmware: 'v1.2.0', uptime: '20 ngày' },

  // Cần chắn (Barrier)
  { id: 'dev-bar-01', name: 'Barrier Cổng 1 Vào',  type: 'barrier',    location: 'Cổng 1 – chiều vào',          status: 'online',  lastSeen: minutesAgo(1),  ip: '10.0.3.10',  firmware: 'v3.0.2', uptime: '12 ngày 5h' },
  { id: 'dev-bar-02', name: 'Barrier Cổng 1 Ra',   type: 'barrier',    location: 'Cổng 1 – chiều ra',           status: 'online',  lastSeen: minutesAgo(1),  ip: '10.0.3.11',  firmware: 'v3.0.2', uptime: '12 ngày 5h' },
  { id: 'dev-bar-03', name: 'Barrier Cổng 2 Vào',  type: 'barrier',    location: 'Cổng 2 – chiều vào',          status: 'online',  lastSeen: minutesAgo(1),  ip: '10.0.3.12',  firmware: 'v3.0.2', uptime: '12 ngày 5h' },
  { id: 'dev-bar-04', name: 'Barrier Cổng 3 Ra',   type: 'barrier',    location: 'Cổng 3 – chiều ra',           status: 'offline', lastSeen: hoursAgo(1),    ip: '10.0.3.30',  firmware: 'v3.0.1' },

  // Server/Hub
  { id: 'dev-srv-01', name: 'IoT Hub Chính',       type: 'server',     location: 'Phòng máy chủ (Tầng 1)',     status: 'online',  lastSeen: minutesAgo(0),  ip: '10.0.0.1',   firmware: 'v5.1.3', uptime: '45 ngày 2h' },
]

const TYPE_META: Record<DeviceType, { label: string; Icon: typeof Camera; color: string }> = {
  camera_lpr: { label: 'Camera LPR',        Icon: Camera,   color: 'bg-blue-50   text-blue-600'   },
  sensor:     { label: 'Cảm biến siêu âm',  Icon: Radio,    color: 'bg-green-50  text-green-600'  },
  barrier:    { label: 'Cần chắn',          Icon: BarChart2, color: 'bg-orange-50 text-orange-600' },
  server:     { label: 'Máy chủ IoT',       Icon: Server,   color: 'bg-purple-50 text-purple-600' },
}

const STATUS_META: Record<DeviceStatus, { label: string; color: string; dot: string }> = {
  online:  { label: 'Online',   color: 'text-green-600', dot: 'bg-green-500' },
  offline: { label: 'Offline',  color: 'text-red-500',   dot: 'bg-red-400'   },
  warning: { label: 'Cảnh báo', color: 'text-yellow-600',dot: 'bg-yellow-400'},
}

function fmtLastSeen(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (diff < 1)   return 'Vừa xong'
  if (diff < 60)  return `${diff} phút trước`
  const h = Math.floor(diff / 60)
  if (h < 24)     return `${h} giờ trước`
  return `${Math.floor(h / 24)} ngày trước`
}

export default function AdminDevices() {
  const [devices, setDevices]           = useState<IoTDevice[]>(INITIAL_DEVICES)
  const [filterType, setFilterType]     = useState<DeviceType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<DeviceStatus | 'all'>('all')
  const [refreshing, setRefreshing]     = useState(false)

  const filtered = useMemo(() =>
    devices.filter(d =>
      (filterType   === 'all' || d.type   === filterType) &&
      (filterStatus === 'all' || d.status === filterStatus)
    ), [devices, filterType, filterStatus])

  const summary = useMemo(() => {
    const c = { total: devices.length, online: 0, offline: 0, warning: 0 }
    devices.forEach(d => c[d.status]++)
    return c
  }, [devices])

  function toggleStatus(id: string) {
    setDevices(prev => prev.map(d => {
      if (d.id !== id) return d
      const next: DeviceStatus = d.status === 'online' ? 'offline' : 'online'
      return { ...d, status: next, lastSeen: next === 'online' ? new Date().toISOString() : d.lastSeen }
    }))
  }

  function handleRefresh() {
    setRefreshing(true)
    setTimeout(() => {
      // Giả lập cập nhật lastSeen của thiết bị online
      setDevices(prev => prev.map(d =>
        d.status === 'online' ? { ...d, lastSeen: new Date().toISOString() } : d
      ))
      setRefreshing(false)
    }, 1200)
  }

  return (
    <PageWrapper>
      {/* Header */}
      <div className="mb-6 flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Thiết bị IoT</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {summary.total} thiết bị · {summary.online} online · {summary.offline} offline
            {summary.warning > 0 && ` · ${summary.warning} cảnh báo`}
          </p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-2 border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-60">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Đang cập nhật...' : 'Làm mới'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Tổng thiết bị', value: summary.total,   color: 'text-gray-800',  bg: 'bg-gray-50'    },
          { label: 'Online',         value: summary.online,  color: 'text-green-600', bg: 'bg-green-50'   },
          { label: 'Offline',        value: summary.offline, color: 'text-red-500',   bg: 'bg-red-50'     },
          { label: 'Cảnh báo',       value: summary.warning, color: 'text-yellow-600',bg: 'bg-yellow-50'  },
        ].map(card => (
          <div key={card.label} className={`${card.bg} rounded-xl border border-gray-200 p-4`}>
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative">
          <select value={filterType} onChange={e => setFilterType(e.target.value as DeviceType | 'all')}
            className="appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
            <option value="all">Tất cả loại thiết bị</option>
            <option value="camera_lpr">Camera LPR</option>
            <option value="sensor">Cảm biến siêu âm</option>
            <option value="barrier">Cần chắn</option>
            <option value="server">Máy chủ IoT</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as DeviceStatus | 'all')}
            className="appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
            <option value="all">Tất cả trạng thái</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="warning">Cảnh báo</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <span className="text-sm text-gray-500 ml-auto">Hiển thị {filtered.length} / {devices.length} thiết bị</span>
      </div>

      {/* Device cards grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400">
          Không có thiết bị nào phù hợp bộ lọc
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(dev => {
            const meta   = TYPE_META[dev.type]
            const status = STATUS_META[dev.status]
            const Icon   = meta.Icon
            return (
              <div key={dev.id}
                className={`bg-white rounded-xl border p-5 flex flex-col gap-3 transition-shadow hover:shadow-md
                  ${dev.status === 'offline' ? 'border-red-200' : dev.status === 'warning' ? 'border-yellow-200' : 'border-gray-200'}`}>

                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800 text-sm leading-tight">{dev.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{meta.label}</div>
                    </div>
                  </div>
                  {/* Status indicator */}
                  <div className={`flex items-center gap-1.5 text-xs font-medium shrink-0 ${status.color}`}>
                    <span className={`w-2 h-2 rounded-full ${status.dot} ${dev.status === 'online' ? 'animate-pulse' : ''}`} />
                    {status.label}
                  </div>
                </div>

                {/* Info rows */}
                <div className="space-y-1.5 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-20 shrink-0">Vị trí:</span>
                    <span className="truncate">{dev.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-20 shrink-0">IP:</span>
                    <span className="font-mono">{dev.ip}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-20 shrink-0">Firmware:</span>
                    <span className="font-mono">{dev.firmware}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-20 shrink-0">Cuối:</span>
                    <span className={dev.status === 'offline' ? 'text-red-400' : ''}>{fmtLastSeen(dev.lastSeen)}</span>
                  </div>
                  {dev.uptime && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-20 shrink-0">Uptime:</span>
                      <span className="text-green-600">{dev.uptime}</span>
                    </div>
                  )}
                </div>

                {/* Warning message */}
                {dev.status === 'warning' && (
                  <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700">
                    <AlertTriangle size={13} className="shrink-0" />
                    Tín hiệu yếu — phản hồi chậm ({'>'}10s). Kiểm tra nguồn điện hoặc kết nối mạng.
                  </div>
                )}

                {/* Toggle button */}
                <button onClick={() => toggleStatus(dev.id)}
                  className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition-colors mt-auto
                    ${dev.status === 'online' || dev.status === 'warning'
                      ? 'border-red-200 text-red-600 hover:bg-red-50'
                      : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                  {dev.status === 'online' || dev.status === 'warning'
                    ? <><WifiOff size={13} /> Ngắt kết nối (simulate)</>
                    : <><Wifi    size={13} /> Kết nối lại (simulate)</>}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </PageWrapper>
  )
}

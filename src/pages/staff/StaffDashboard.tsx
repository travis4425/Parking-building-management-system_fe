// Dashboard ca trực nhân viên — metric, cảnh báo IoT, trạng thái thiết bị + barrier live
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle, Clock, Cpu,
  ParkingSquare, Car, ChevronRight, Camera, Wifi, WifiOff,
} from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import BarrierStatusPanel from '@/components/iot/BarrierStatus'
import { useSlotStore } from '@/store/slotStore'
import { useAlertStore, alertTypeLabel, alertTypeColor } from '@/store/alertStore'
import { useIotStore }  from '@/store/iotStore'
import { useAlertSimulation } from '@/hooks/useAlertSimulation'
import { cn } from '@/utils/cn'
import type { ParkingAlert } from '@/utils/types'

const CURRENT_SHIFT = {
  label:     'Ca 06:00 – 14:00',
  staffName: 'Nguyễn Văn A',
  date:      new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }),
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return `${diff} giây trước`
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  return `${Math.floor(diff / 3600)} giờ trước`
}

function AlertIcon({ type }: { type: ParkingAlert['type'] }) {
  const cls = 'w-5 h-5'
  if (type === 'sensor_error')     return <Cpu       className={`${cls} text-red-500`} />
  if (type === 'session_overtime') return <Clock     className={`${cls} text-amber-500`} />
  return                                  <Car       className={`${cls} text-orange-500`} />
}

// ─── IoT Status Panel ────────────────────────────────────────────────────────
// Hiển thị Camera LPR, Cảm biến slot, tổng quan online/offline
function IotDevicePanel() {
  const devices = useIotStore((s) => s.devices)

  const cameras = devices.filter((d) => d.type === 'camera').sort((a, b) => (a.floor ?? 0) - (b.floor ?? 0))
  const sensors = devices.filter((d) => d.type === 'sensor')

  // Gom sensor theo tầng
  const sensorByFloor = [1, 2, 3].map((floor) => {
    const group = sensors.filter((d) => d.floor === floor)
    const online = group.filter((d) => d.status === 'online').length
    return { floor, total: group.length, online, allOk: online === group.length }
  })

  const totalOnline  = devices.filter((d) => d.status === 'online').length
  const totalOffline = devices.filter((d) => d.status === 'offline').length

  function StatusDot({ status }: { status: string }) {
    return (
      <span className={cn(
        'inline-block w-2 h-2 rounded-full flex-shrink-0',
        status === 'online'  ? 'bg-emerald-500' : 'bg-red-400',
        status === 'online'  && 'animate-pulse',
      )} />
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-800">Trạng thái thiết bị IoT</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-600 font-medium">
            <Wifi    className="w-3.5 h-3.5" /> {totalOnline} online
          </span>
          {totalOffline > 0 && (
            <span className="flex items-center gap-1 text-red-500 font-medium">
              <WifiOff className="w-3.5 h-3.5" /> {totalOffline} offline
            </span>
          )}
        </div>
      </div>

      {/* 3 cột: Camera | Cảm biến | Thông tin tóm tắt */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        {/* Camera LPR */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Camera className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Camera LPR</span>
          </div>
          <ul className="space-y-2">
            {cameras.map((cam) => (
              <li key={cam.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">Tầng {cam.floor}</span>
                <span className={cn(
                  'flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full',
                  cam.status === 'online'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-600',
                )}>
                  <StatusDot status={cam.status} />
                  {cam.status === 'online' ? 'Online' : 'Offline'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Cảm biến slot */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Cpu className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Cảm biến slot</span>
          </div>
          <ul className="space-y-2">
            {sensorByFloor.map(({ floor, total, online, allOk }) => (
              <li key={floor} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">Tầng {floor}</span>
                <span className={cn(
                  'flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full',
                  allOk ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
                )}>
                  <StatusDot status={allOk ? 'online' : 'offline'} />
                  {online}/{total} hoạt động
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Tóm tắt / ghi chú */}
        <div className="px-5 py-4 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 mb-3">
            <CheckCircle className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tổng quan</span>
          </div>
          <div className="space-y-2 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Tổng thiết bị</span>
              <span className="font-semibold text-gray-800">{devices.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Đang hoạt động</span>
              <span className="font-semibold text-emerald-700">{totalOnline}</span>
            </div>
            {totalOffline > 0 && (
              <div className="flex justify-between">
                <span>Mất kết nối</span>
                <span className="font-semibold text-red-600">{totalOffline}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Cập nhật ngẫu nhiên mỗi 60 giây
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function StaffDashboard() {
  const navigate     = useNavigate()
  const slots        = useSlotStore((s) => s.slots)
  const alerts       = useAlertStore((s) => s.alerts)
  const resolveAlert = useAlertStore((s) => s.resolveAlert)

  // Sinh cảnh báo IoT mỗi 30 giây
  useAlertSimulation(30_000)

  // Simulate 1 thiết bị offline ngẫu nhiên mỗi 60 giây, tự phục hồi sau 15 giây
  useEffect(() => {
    const timer = setInterval(() => {
      const { devices, setDeviceStatus } = useIotStore.getState()
      const candidates = devices.filter((d) => d.type !== 'barrier' && d.status === 'online')
      if (!candidates.length) return
      const pick = candidates[Math.floor(Math.random() * candidates.length)]
      setDeviceStatus(pick.id, 'offline')
      setTimeout(() => useIotStore.getState().setDeviceStatus(pick.id, 'online'), 15_000)
    }, 60_000)
    return () => clearInterval(timer)
  }, [])

  const availableCount = slots.filter((s) => s.status === 'available').length
  const occupiedCount  = slots.filter((s) => s.status === 'occupied').length
  const pendingAlerts  = alerts.filter((a) => a.status === 'pending')

  function handleProcess(alert: ParkingAlert) {
    const params = new URLSearchParams({
      alertId:  alert.id,
      slotCode: alert.slotCode,
      type:     alert.type,
      message:  alert.message,
    })
    navigate(`/staff/exceptions?${params.toString()}`)
  }

  return (
    <PageWrapper>
      {/* ── Header ca trực ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard ca trực</h1>
          <p className="text-sm text-gray-500 mt-0.5">{CURRENT_SHIFT.date}</p>
        </div>
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{CURRENT_SHIFT.label}</p>
            <p className="text-xs text-gray-500">{CURRENT_SHIFT.staffName}</p>
          </div>
          <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-medium
                           bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Đang hoạt động
          </span>
        </div>
      </div>

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-emerald-100 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
            <ParkingSquare className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Slot trống</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{availableCount}</p>
          </div>
        </div>
        <div className="bg-white border border-blue-100 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
            <Car className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Xe trong bãi</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{occupiedCount}</p>
          </div>
        </div>
        <div className={cn('bg-white rounded-xl p-5 flex items-center gap-4 shadow-sm border',
          pendingAlerts.length > 0 ? 'border-red-200' : 'border-gray-100',
        )}>
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center',
            pendingAlerts.length > 0 ? 'bg-red-50' : 'bg-gray-50',
          )}>
            <AlertTriangle className={cn('w-6 h-6',
              pendingAlerts.length > 0 ? 'text-red-500' : 'text-gray-400',
            )} />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Cảnh báo IoT</p>
            <p className={cn('text-2xl font-bold mt-0.5',
              pendingAlerts.length > 0 ? 'text-red-600' : 'text-gray-900',
            )}>
              {pendingAlerts.length}
            </p>
          </div>
        </div>
      </div>

      {/* ── IoT Device Status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <IotDevicePanel />
        </div>
        <div>
          <BarrierStatusPanel />
        </div>
      </div>

      {/* ── Danh sách cảnh báo cần xử lý ── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-gray-900">Cảnh báo cần xử lý</h2>
            {pendingAlerts.length > 0 && (
              <span className="text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                {pendingAlerts.length}
              </span>
            )}
          </div>
          {pendingAlerts.length > 0 && (
            <span className="text-xs text-gray-400">Cập nhật mỗi 30 giây</span>
          )}
        </div>

        {pendingAlerts.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Không có cảnh báo nào</p>
            <p className="text-xs text-gray-400 mt-1">Hệ thống IoT đang hoạt động bình thường</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {pendingAlerts.map((alert) => (
              <li key={alert.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  <AlertIcon type={alert.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full border',
                      alertTypeColor(alert.type),
                    )}>
                      {alertTypeLabel(alert.type)}
                    </span>
                    <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {alert.slotCode}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 truncate">{alert.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(alert.timestamp)}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => handleProcess(alert)}
                    className="flex items-center gap-1 text-sm font-medium text-blue-600
                               hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Xử lý
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => resolveAlert(alert.id)}
                    className="text-xs text-gray-400 hover:text-emerald-600 hover:bg-emerald-50
                               px-2.5 py-1.5 rounded-lg transition-colors"
                    title="Đánh dấu đã xử lý"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageWrapper>
  )
}

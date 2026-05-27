// Dashboard ca trực nhân viên — thông tin ca, metric cards, danh sách cảnh báo IoT cần xử lý
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle, Clock, Cpu, ParkingSquare, Car, ChevronRight } from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import { useSlotStore } from '@/store/slotStore'
import { useAlertStore, alertTypeLabel, alertTypeColor } from '@/store/alertStore'
import { useAlertSimulation } from '@/hooks/useAlertSimulation'
import type { ParkingAlert } from '@/utils/types'

// Thông tin ca trực mock — thực tế sẽ lấy từ API
const CURRENT_SHIFT = {
  label: 'Ca 06:00 – 14:00',
  status: 'active' as const,   // active | ending | ended
  staffName: 'Nguyễn Văn A',
  date: new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
}

// Thời gian tương đối (vd: "5 phút trước")
function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)  return `${diff} giây trước`
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  return `${Math.floor(diff / 3600)} giờ trước`
}

// Icon theo loại cảnh báo
function AlertIcon({ type }: { type: ParkingAlert['type'] }) {
  const cls = 'w-5 h-5'
  if (type === 'sensor_error')     return <Cpu className={`${cls} text-red-500`} />
  if (type === 'session_overtime') return <Clock className={`${cls} text-amber-500`} />
  return <Car className={`${cls} text-orange-500`} />
}

export default function StaffDashboard() {
  const navigate  = useNavigate()
  const slots     = useSlotStore((s) => s.slots)
  const alerts    = useAlertStore((s) => s.alerts)
  const resolveAlert = useAlertStore((s) => s.resolveAlert)

  // Khởi động IoT simulation sinh cảnh báo mỗi 30 giây
  useAlertSimulation(30_000)

  // Tính toán metric từ store
  const availableCount = slots.filter((s) => s.status === 'available').length
  const occupiedCount  = slots.filter((s) => s.status === 'occupied').length
  const pendingAlerts  = alerts.filter((a) => a.status === 'pending')

  // Nhấn "Xử lý" → chuyển sang trang ngoại lệ với query param pre-fill thông tin
  function handleProcess(alert: ParkingAlert) {
    const params = new URLSearchParams({
      alertId:   alert.id,
      slotCode:  alert.slotCode,
      type:      alert.type,
      message:   alert.message,
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

        {/* Card thông tin ca */}
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
        {/* Slot trống */}
        <div className="bg-white border border-emerald-100 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
            <ParkingSquare className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Slot trống</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{availableCount}</p>
          </div>
        </div>

        {/* Xe đang trong bãi */}
        <div className="bg-white border border-blue-100 rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
            <Car className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Xe trong bãi</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{occupiedCount}</p>
          </div>
        </div>

        {/* Cảnh báo IoT chờ xử lý */}
        <div className={`bg-white rounded-xl p-5 flex items-center gap-4 shadow-sm border ${
          pendingAlerts.length > 0 ? 'border-red-200' : 'border-gray-100'
        }`}>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
            pendingAlerts.length > 0 ? 'bg-red-50' : 'bg-gray-50'
          }`}>
            <AlertTriangle className={`w-6 h-6 ${pendingAlerts.length > 0 ? 'text-red-500' : 'text-gray-400'}`} />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Cảnh báo IoT</p>
            <p className={`text-2xl font-bold mt-0.5 ${pendingAlerts.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {pendingAlerts.length}
            </p>
          </div>
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
          /* Trạng thái không có cảnh báo */
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
                {/* Icon loại cảnh báo */}
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  <AlertIcon type={alert.type} />
                </div>

                {/* Nội dung */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${alertTypeColor(alert.type)}`}>
                      {alertTypeLabel(alert.type)}
                    </span>
                    <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {alert.slotCode}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 truncate">{alert.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(alert.timestamp)}</p>
                </div>

                {/* Actions */}
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

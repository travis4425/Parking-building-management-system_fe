// Trang xử lý ngoại lệ cho nhân viên — 4 tab: Mất thẻ QR, Sai biển số, Xe quá hạn, Sensor lỗi
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSessionStore } from '@/store/sessionStore'
import { useSlotStore } from '@/store/slotStore'
import { useAlertStore } from '@/store/alertStore'
import { useAuthStore } from '@/store/authStore'
import { calculateFee, formatDuration, LOST_TICKET_SURCHARGE } from '@/utils/feeCalculator'
import { reportLostTicketApi, reportWrongPlateApi } from '@/api/exceptionsApi'
import type { ParkingSession, ParkingAlert } from '@/utils/types'
import { toast } from 'sonner'
import {
  QrCode, Car, Clock, Cpu, Search, CheckCircle,
  AlertTriangle, Phone, Wrench, Edit3, FileText,
  X, User, CameraOff, CheckCheck, AlertCircle, Info,
} from 'lucide-react'

type TabId = 'lost-qr' | 'wrong-plate' | 'overtime' | 'sensor'

interface AuditEntry {
  id: string
  time: string
  action: string
  staffName: string
  detail: string
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'lost-qr',     label: 'Mất thẻ QR',  icon: QrCode },
  { id: 'wrong-plate', label: 'Sai biển số',  icon: Edit3  },
  { id: 'overtime',    label: 'Xe quá hạn',   icon: Clock  },
  { id: 'sensor',      label: 'Sensor lỗi',   icon: Cpu    },
]

export default function StaffExceptions() {
  const [searchParams]  = useSearchParams()
  const { sessions, findByPlate, checkOutSession, loadSessions } = useSessionStore()
  const { slots, updateSlotStatus } = useSlotStore()
  const { alerts, resolveAlert }    = useAlertStore()
  const { user } = useAuthStore()

  const urlType    = searchParams.get('type')
  const urlAlertId = searchParams.get('alertId')

  function getInitialTab(): TabId {
    if (urlType === 'sensor_error')     return 'sensor'
    if (urlType === 'session_overtime') return 'overtime'
    return 'lost-qr'
  }

  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab)
  const [auditLog,  setAuditLog]  = useState<AuditEntry[]>([])

  // --- Tab 1: Mất thẻ QR ---
  const [lqPlate,    setLQPlate]    = useState('')
  const [lqSession,  setLQSession]  = useState<ParkingSession | null>(null)
  const [lqSearched, setLQSearched] = useState(false)
  const [lqDone,     setLQDone]     = useState(false)

  // --- Tab 2: Sai biển số ---
  const [wpOldPlate, setWPOldPlate] = useState('')
  const [wpSession,  setWPSession]  = useState<ParkingSession | null>(null)
  const [wpSearched, setWPSearched] = useState(false)
  const [wpNewPlate, setWPNewPlate] = useState('')
  const [wpDone,     setWPDone]     = useState(false)

  // --- Tab 3: Xe quá hạn ---
  const [otContact, setOTContact] = useState<ParkingSession | null>(null)

  // --- Tab 4: Sensor lỗi ---
  const [snReason, setSNReason] = useState<Record<string, string>>({})
  const [snDone,   setSNDone]   = useState<Set<string>>(new Set())

  // --- Helpers ---
  const now = new Date()

  const sensorAlerts = alerts.filter(
    (a) => a.type === 'sensor_error' && a.status === 'pending',
  )

  const overtimeSessions = sessions.filter((s) => {
    if (s.status !== 'active') return false
    const elapsedH = (now.getTime() - new Date(s.checkInTime).getTime()) / 3_600_000
    return elapsedH >= 24
  })

  function addAudit(action: string, detail: string) {
    setAuditLog((prev) => [
      {
        id:        `audit-${Date.now()}`,
        time:       new Date().toISOString(),
        action,
        staffName:  user?.name ?? 'Nhân viên',
        detail,
      },
      ...prev,
    ])
  }

  // 🐞 SỬA: làm tròn về số nguyên trước khi format — VND không có phần thập phân
  function formatVND(n: number) {
    return Math.round(n).toLocaleString('vi-VN') + 'đ'
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString('vi-VN', {
      hour: '2-digit', minute: '2-digit',
      day:  '2-digit', month: '2-digit', year: 'numeric',
    })
  }

  function elapsedLabel(iso: string) {
    const mins = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000)
    return formatDuration(mins)
  }

  function vehicleLabel(t: string) {
    return t === 'motorbike' ? 'Xe máy' : t === 'car' ? 'Ô tô' : 'Xe đạp'
  }

  // --- Tab 1 handlers ---
  function handleLQSearch() {
    setLQSession(findByPlate(lqPlate) ?? null)
    setLQSearched(true)
    setLQDone(false)
  }

  async function handleLQConfirm() {
    if (!lqSession) return
    const fee = calculateFee(lqSession, now, true)
    try {
      // BE tự tính phí thật (đã bao gồm LOST_TICKET_SURCHARGE) khi checkout với lostTicket: true
      const result = await checkOutSession(lqSession.qrCode, { lostTicket: true })
      // Ghi nhận Exception (mất thẻ) để có log/audit phía BE — không chặn luồng nếu lỗi
      try {
        await reportLostTicketApi({
          licensePlate: lqSession.vehiclePlate,
          description: `Xử lý mất thẻ QR tại quầy, slot ${lqSession.slotCode}`,
        })
      } catch (err) {
        console.error('Không ghi được log Exception mất thẻ QR:', err)
      }
      const totalFee = result.fee ?? fee.total
      addAudit(
        'Xử lý mất thẻ QR',
        `Biển số: ${lqSession.vehiclePlate}, Slot: ${lqSession.slotCode}, Tổng phí: ${formatVND(totalFee)} (incl. phụ thu ${formatVND(LOST_TICKET_SURCHARGE)})`,
      )
      setLQDone(true)
      toast.success('Đã xử lý và ghi log ngoại lệ')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Xử lý mất thẻ QR thất bại')
    }
  }

  // --- Tab 2 handlers ---
  function handleWPSearch() {
    setWPSession(findByPlate(wpOldPlate) ?? null)
    setWPSearched(true)
    setWPDone(false)
    setWPNewPlate('')
  }

  async function handleWPConfirm() {
    if (!wpSession || !wpNewPlate.trim()) return
    const oldPlate = wpSession.vehiclePlate
    const newPlate = wpNewPlate.trim().toUpperCase()
    try {
      // BE tự cập nhật licensePlate của session + ghi Exception + AuditLog trong 1 transaction
      await reportWrongPlateApi({
        sessionId: wpSession.id,
        newLicensePlate: newPlate,
        userId: user?.id ?? '',
        description: `Sửa biển số tại quầy, slot ${wpSession.slotCode}`,
      })
      loadSessions().catch(() => {})
      addAudit(
        'Sửa biển số',
        `Slot: ${wpSession.slotCode} | ${oldPlate} → ${newPlate}`,
      )
      setWPDone(true)
      toast.success('Đã cập nhật biển số thành công')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Cập nhật biển số thất bại')
    }
  }

  // --- Tab 4 handler ---
  function handleSensorMaintenance(alert: ParkingAlert) {
    const slot = slots.find((s) => s.code === alert.slotCode)
    if (slot) updateSlotStatus(slot.id, 'maintenance')
    resolveAlert(alert.id)
    setSNDone((prev) => new Set([...prev, alert.id]))
    const reason = snReason[alert.id]?.trim() || '(Không ghi lý do)'
    addAudit('Chuyển slot sang Bảo trì', `Slot ${alert.slotCode}: ${reason}`)
    toast.success('Đã xử lý và ghi log ngoại lệ')
  }

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-800">Xử lý ngoại lệ</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Xử lý các tình huống đặc biệt: mất thẻ QR, sai biển số, xe quá hạn, cảm biến lỗi
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {TABS.map((t) => {
          const Icon = t.icon
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab content — gọi như function (không phải JSX component) để tránh unmount khi re-render */}
      <div className="min-h-96">
        {activeTab === 'lost-qr'     && LostQRContent()}
        {activeTab === 'wrong-plate' && WrongPlateContent()}
        {activeTab === 'overtime'    && OvertimeContent()}
        {activeTab === 'sensor'      && SensorContent()}
      </div>

      {/* Audit log ca này */}
      {auditLog.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4" />
            Nhật ký xử lý ca này ({auditLog.length} thao tác)
          </h3>
          <div className="space-y-2">
            {auditLog.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs border-b border-gray-50 pb-2"
              >
                <span className="text-gray-400 shrink-0">{formatTime(e.time)}</span>
                <span className="font-semibold text-gray-700">{e.action}</span>
                <span className="text-gray-500 flex-1">{e.detail}</span>
                <span className="text-gray-400 shrink-0">{e.staffName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // ==================== TAB COMPONENTS (inner, capture closure) ====================

  function LostQRContent() {
    const fee = lqSession && !lqDone ? calculateFee(lqSession, now, true) : null

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cột trái */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2 text-sm">
              <Search className="w-4 h-4 text-amber-500" />
              Tra cứu theo biển số
            </h3>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-50"
                placeholder="VD: 51G-12345"
                value={lqPlate}
                onChange={(e) => {
                  setLQPlate(e.target.value.toUpperCase())
                  setLQSearched(false)
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleLQSearch()}
                disabled={lqDone}
              />
              <button
                onClick={handleLQSearch}
                disabled={!lqPlate.trim() || lqDone}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Tìm
              </button>
            </div>
          </div>

          {/* Mock camera LPR */}
          <div
            className="bg-gray-900 rounded-xl overflow-hidden relative flex items-center justify-center"
            style={{ minHeight: 200 }}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
              <CameraOff className="w-10 h-10 text-gray-600" />
              <p className="text-gray-500 text-sm text-center">
                Camera LPR — Ảnh chụp biển số lúc xe vào
              </p>
              {lqSession && (
                <div className="bg-yellow-400/20 border border-yellow-400/40 rounded-lg px-5 py-3 text-center">
                  <p className="text-yellow-300 font-mono font-bold text-xl tracking-wider">
                    {lqSession.vehiclePlate}
                  </p>
                  <p className="text-yellow-400/70 text-xs mt-1">
                    Ghi nhận lúc {formatTime(lqSession.checkInTime)}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-amber-700 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
              Xe mất thẻ QR phải nộp phụ thu{' '}
              <strong>{formatVND(LOST_TICKET_SURCHARGE)}</strong> ngoài phí đỗ bình thường.
            </p>
          </div>
        </div>

        {/* Cột phải */}
        <div className="space-y-4">
          {!lqSearched && (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-400">
              <QrCode className="w-12 h-12 mx-auto mb-2 opacity-25" />
              <p className="text-sm">Nhập biển số để tra cứu phiên đỗ xe</p>
            </div>
          )}

          {lqSearched && !lqSession && !lqDone && (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
              <AlertCircle className="w-10 h-10 mx-auto text-gray-400 mb-3" />
              <p className="font-medium text-gray-600">Không tìm thấy xe đang đỗ</p>
              <p className="text-gray-400 text-sm mt-1">
                Biển số <span className="font-mono">"{lqPlate}"</span> không có phiên nào đang hoạt động
              </p>
            </div>
          )}

          {lqDone && lqSession && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
              <p className="font-semibold text-green-700 text-lg">Đã xử lý thành công</p>
              <p className="text-green-600 text-sm mt-1">
                Xe <span className="font-mono font-semibold">{lqSession.vehiclePlate}</span> đã hoàn tất ra bãi
              </p>
              <button
                onClick={() => {
                  setLQPlate('')
                  setLQSession(null)
                  setLQSearched(false)
                  setLQDone(false)
                }}
                className="mt-5 text-sm text-green-600 hover:text-green-700 underline"
              >
                Xử lý xe khác
              </button>
            </div>
          )}

          {lqSession && !lqDone && fee && (
            <>
              {/* Thông tin phiên */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-gray-700 text-sm">Thông tin phiên đỗ xe</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-gray-500">Biển số</dt>
                  <dd className="font-mono font-semibold">{lqSession.vehiclePlate}</dd>
                  <dt className="text-gray-500">Slot</dt>
                  <dd>{lqSession.slotCode}</dd>
                  <dt className="text-gray-500">Loại xe</dt>
                  <dd>{vehicleLabel(lqSession.vehicleType)}</dd>
                  <dt className="text-gray-500">Giờ vào</dt>
                  <dd>{formatTime(lqSession.checkInTime)}</dd>
                  <dt className="text-gray-500">Thời gian đỗ</dt>
                  <dd>{elapsedLabel(lqSession.checkInTime)}</dd>
                </dl>
              </div>

              {/* Chi tiết phí */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-700 text-sm">Chi tiết phí</h3>
                <div className="space-y-1.5 text-sm">
                  {fee.isOvernight ? (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Phí qua đêm</span>
                      <span>{formatVND(fee.overnightFee)}</span>
                    </div>
                  ) : fee.isPeak ? (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Phí cao điểm ({fee.peakHours}h)</span>
                      <span>{formatVND(fee.peakFee)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Phí thường ({fee.normalHours}h)</span>
                      <span>{formatVND(fee.normalFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-amber-600 font-medium">
                    <span>Phụ thu mất thẻ QR</span>
                    <span>+ {formatVND(LOST_TICKET_SURCHARGE)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-bold text-gray-800">
                    <span>Tổng cộng</span>
                    <span className="text-lg">{formatVND(fee.total)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleLQConfirm}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Xác nhận thu phí &amp; cho xe ra
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  function WrongPlateContent() {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cột trái */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-700 mb-1 flex items-center gap-2 text-sm">
              <Search className="w-4 h-4 text-blue-500" />
              Tra cứu phiên đỗ xe
            </h3>
            <p className="text-xs text-gray-400 mb-3">Nhập biển số đang lưu trong hệ thống (có thể sai)</p>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
                placeholder="Biển số trong hệ thống"
                value={wpOldPlate}
                onChange={(e) => {
                  setWPOldPlate(e.target.value.toUpperCase())
                  setWPSearched(false)
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleWPSearch()}
                disabled={wpDone}
              />
              <button
                onClick={handleWPSearch}
                disabled={!wpOldPlate.trim() || wpDone}
                className="bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Tìm
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-blue-700 text-sm flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
              Mọi thay đổi biển số đều được ghi vào nhật ký xử lý với tên nhân viên và thời gian thực hiện.
            </p>
          </div>
        </div>

        {/* Cột phải */}
        <div className="space-y-4">
          {!wpSearched && (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-400">
              <Edit3 className="w-12 h-12 mx-auto mb-2 opacity-25" />
              <p className="text-sm">Tra cứu xe để hiệu chỉnh biển số</p>
            </div>
          )}

          {wpSearched && !wpSession && !wpDone && (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
              <AlertCircle className="w-10 h-10 mx-auto text-gray-400 mb-3" />
              <p className="font-medium text-gray-600">Không tìm thấy phiên đỗ xe</p>
              <p className="text-gray-400 text-sm mt-1">
                <span className="font-mono">"{wpOldPlate}"</span> không đang đỗ trong bãi
              </p>
            </div>
          )}

          {wpDone && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
              <p className="font-semibold text-green-700 text-lg">Đã cập nhật biển số</p>
              <p className="text-green-600 text-sm mt-1 font-mono">
                {wpOldPlate} → {wpNewPlate.toUpperCase()}
              </p>
              <button
                onClick={() => {
                  setWPOldPlate('')
                  setWPSession(null)
                  setWPSearched(false)
                  setWPNewPlate('')
                  setWPDone(false)
                }}
                className="mt-5 text-sm text-green-600 hover:text-green-700 underline"
              >
                Sửa xe khác
              </button>
            </div>
          )}

          {wpSession && !wpDone && (
            <>
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-gray-700 text-sm">Phiên đỗ xe tìm thấy</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-gray-500">Biển số hiện tại</dt>
                  <dd className="font-mono font-semibold text-red-600">{wpSession.vehiclePlate}</dd>
                  <dt className="text-gray-500">Slot</dt>
                  <dd>{wpSession.slotCode}</dd>
                  <dt className="text-gray-500">Giờ vào</dt>
                  <dd>{formatTime(wpSession.checkInTime)}</dd>
                  <dt className="text-gray-500">Nhân viên check-in</dt>
                  <dd>{wpSession.staffCheckInId}</dd>
                </dl>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-gray-700 text-sm">Biển số đúng (mới)</h3>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="VD: 51G-12345"
                  value={wpNewPlate}
                  onChange={(e) => setWPNewPlate(e.target.value.toUpperCase())}
                />
                {wpNewPlate &&
                  wpNewPlate.toUpperCase() === wpSession.vehiclePlate && (
                    <p className="text-xs text-orange-500">Biển số mới giống biển số cũ</p>
                  )}
              </div>

              <button
                onClick={handleWPConfirm}
                disabled={
                  !wpNewPlate.trim() ||
                  wpNewPlate.toUpperCase() === wpSession.vehiclePlate
                }
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Cập nhật biển số
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  function OvertimeContent() {
    return (
      <div className="space-y-4">
        {overtimeSessions.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-14 text-center">
            <CheckCheck className="w-12 h-12 mx-auto text-green-400 mb-3" />
            <p className="font-medium text-gray-600">Không có xe quá hạn</p>
            <p className="text-gray-400 text-sm mt-1">
              Tất cả xe đang đỗ đều trong thời hạn cho phép
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
              <p className="text-orange-700 text-sm font-medium">
                {overtimeSessions.length} xe đã đỗ quá 24 giờ — cần liên hệ chủ xe ngay
              </p>
            </div>

            {overtimeSessions.map((s) => {
              const elapsedMin  = Math.floor((now.getTime() - new Date(s.checkInTime).getTime()) / 60_000)
              const overtimeMin = elapsedMin - 24 * 60
              const fee         = calculateFee(s, now)
              return (
                <div
                  key={s.id}
                  className="bg-white border border-orange-200 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                        <Car className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="font-mono font-bold text-gray-800">{s.vehiclePlate}</p>
                        <p className="text-sm text-gray-500">
                          Slot {s.slotCode} · {vehicleLabel(s.vehicleType)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setOTContact(s)}
                      className="flex items-center gap-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors shrink-0"
                    >
                      <Phone className="w-4 h-4" />
                      Liên hệ
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-400 text-xs mb-0.5">Giờ vào</p>
                      <p className="font-medium text-xs">{formatTime(s.checkInTime)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-400 text-xs mb-0.5">Tổng thời gian</p>
                      <p className="font-medium text-xs">{formatDuration(elapsedMin)}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2">
                      <p className="text-orange-400 text-xs mb-0.5">Quá hạn</p>
                      <p className="font-medium text-xs text-orange-600">
                        +{formatDuration(overtimeMin)}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between text-sm pt-1 border-t border-gray-100">
                    <span className="text-gray-500">Phí ước tính (chưa tính phạt)</span>
                    <span className="font-semibold">{formatVND(fee.total)}</span>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* Modal liên hệ chủ xe */}
        {otContact && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-800">Liên hệ chủ xe</h3>
                <button
                  onClick={() => setOTContact(null)}
                  className="text-gray-400 hover:text-gray-600 rounded-lg p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-center py-2">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-blue-500" />
                </div>
                {/* BE chưa lưu số điện thoại chủ xe cho phiên đỗ vãng lai (không đăng nhập) nên
                    không có thông tin liên hệ thật để hiển thị — dùng hotline chung của bãi xe. */}
                <p className="text-gray-500 text-sm">
                  Biển số:{' '}
                  <span className="font-mono font-semibold">{otContact.vehiclePlate}</span>
                </p>
                <p className="text-gray-400 text-xs mt-2">
                  Không có thông tin liên hệ trong hệ thống
                </p>
                <p className="text-blue-600 font-bold text-xl mt-3 font-mono">1900 1234</p>
                <p className="text-xs text-gray-400 mt-1">Hotline thông báo xe quá hạn</p>
                <p className="mt-4 text-sm text-gray-500">
                  Xe đỗ tại <strong>Slot {otContact.slotCode}</strong> từ{' '}
                  {formatTime(otContact.checkInTime)}
                </p>
              </div>

              <button
                onClick={() => {
                  addAudit(
                    'Liên hệ chủ xe',
                    `Biển số: ${otContact.vehiclePlate}, Slot: ${otContact.slotCode}`,
                  )
                  setOTContact(null)
                }}
                className="mt-5 w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-xl font-medium transition-colors"
              >
                Đã liên hệ xong
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  function SensorContent() {
    return (
      <div className="space-y-4">
        {sensorAlerts.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-14 text-center">
            <CheckCheck className="w-12 h-12 mx-auto text-green-400 mb-3" />
            <p className="font-medium text-gray-600">Không có cảm biến lỗi đang chờ xử lý</p>
            <p className="text-gray-400 text-sm mt-1">Tất cả cảm biến hoạt động bình thường</p>
          </div>
        ) : (
          sensorAlerts.map((alert) => {
            const isDone        = snDone.has(alert.id)
            const isHighlighted = alert.id === urlAlertId
            return (
              <div
                key={alert.id}
                className={`bg-white rounded-xl p-4 transition-all border ${
                  isDone
                    ? 'border-green-200 opacity-60'
                    : isHighlighted
                    ? 'border-red-400 ring-2 ring-red-100'
                    : 'border-red-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      isDone ? 'bg-green-100' : 'bg-red-100'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Cpu className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="font-mono font-bold text-gray-800">
                        Slot {alert.slotCode}
                      </span>
                      {isDone && (
                        <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
                          Đã chuyển bảo trì
                        </span>
                      )}
                      {isHighlighted && !isDone && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                          Từ Dashboard
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatTime(alert.timestamp)}</p>
                  </div>
                </div>

                {!isDone && (
                  <div className="mt-4 space-y-3 pl-0">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Lý do / Ghi chú xử lý
                      </label>
                      <input
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                        placeholder="VD: Cảm biến siêu âm hỏng, cần thay module mới..."
                        value={snReason[alert.id] ?? ''}
                        onChange={(e) =>
                          setSNReason((prev) => ({ ...prev, [alert.id]: e.target.value }))
                        }
                      />
                    </div>
                    <button
                      onClick={() => handleSensorMaintenance(alert)}
                      className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Wrench className="w-4 h-4" />
                      Chuyển Slot {alert.slotCode} sang Bảo trì
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    )
  }
}

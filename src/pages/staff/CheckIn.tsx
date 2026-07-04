// Trang check-in xe vào — QR scanner (driver account) hoặc LPR + nhập tay
import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  CheckCircle, AlertCircle,
  Printer, X, ClipboardList, Car, Clock, Camera,
} from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import LPRCamera from '@/components/staff/LPRCamera'
import QRScanner from '@/components/staff/QRScanner'
import { BarrierGate } from '@/components/iot/BarrierStatus'
import { useSlotStore } from '@/store/slotStore'
import { useSessionStore } from '@/store/sessionStore'
import { toast } from 'sonner'
import { fetchEntryGates, type BeGate } from '@/api/gatesApi'
import { fetchZoneSummary, type ZoneSummary } from '@/api/zonesApi'
import { Building2 } from 'lucide-react'
import type { VehicleType, ParkingSession } from '@/utils/types'
import { apiErrorMessage } from '@/api/errors'
import { lookupDriverByQr, type DriverQrInfo } from '@/api/sessionsApi'

const VEHICLE_OPTIONS: { value: VehicleType; label: string; icon: string }[] = [
  { value: 'motorbike', label: 'Xe máy', icon: '🛵' },
  { value: 'bicycle',   label: 'Xe đạp', icon: '🚲' },
  { value: 'car',       label: 'Ô tô',   icon: '🚗' },
]

// ─── Modal xác nhận + in QR ─────────────────────────────────────────────────
function SessionConfirmModal({
  session, gateLabel, onClose, onReset,
}: {
  session: ParkingSession
  gateLabel: string
  onClose: () => void
  onReset: () => void
}) {
  const qrContainerRef = useRef<HTMLDivElement>(null)
  const vehicleLabel = VEHICLE_OPTIONS.find((v) => v.value === session.vehicleType)?.label ?? session.vehicleType

  function handlePrint() {
    const svg = qrContainerRef.current?.querySelector('svg')
    const qrDataUrl = svg
      ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
      : ''
    const html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8"><title>Vé đỗ xe - ${session.vehiclePlate}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;display:flex;justify-content:center;padding:20px;background:#fff}
  .ticket{border:2px dashed #333;border-radius:8px;padding:24px;width:280px;text-align:center}
  .logo{font-size:20px;font-weight:bold;margin-bottom:2px}
  .sub{font-size:11px;color:#666;margin-bottom:14px;letter-spacing:2px}
  .qr{margin:10px 0}
  table{width:100%;border-collapse:collapse;margin:10px 0;font-size:12px}
  td{padding:4px 2px;border-bottom:1px dotted #ddd;text-align:left}
  td:last-child{text-align:right;font-weight:bold}
  .note{font-size:10px;color:#888;margin-top:12px;line-height:1.4}
  .code{font-size:11px;font-family:monospace;color:#444}
</style></head><body>
<div class="ticket">
  <div class="logo">🅿 ParkingOS</div>
  <div class="sub">VÉ ĐỖ XE</div>
  <div class="qr"><img src="${qrDataUrl}" width="160" height="160"/></div>
  <table>
    <tr><td>Biển số</td><td>${session.vehiclePlate}</td></tr>
    <tr><td>Loại xe</td><td>${vehicleLabel}</td></tr>
    <tr><td>Slot</td><td>${session.slotCode}</td></tr>
    <tr><td>Giờ vào</td><td>${new Date(session.checkInTime).toLocaleString('vi-VN')}</td></tr>
    ${gateLabel ? `<tr><td>Cổng vào</td><td>${gateLabel.split('—')[0].trim()}</td></tr>` : ''}
  </table>
  <div class="note">Quét mã QR khi xe ra để thanh toán<br/>
    <span class="code">Mã: ${session.qrCode}</span>
  </div>
</div></body></html>`
    const win = window.open('', '_blank', 'width=360,height=580')
    if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 600) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-emerald-600 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Tạo session thành công!</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex justify-center" ref={qrContainerRef}>
            <div className="p-3 border-2 border-gray-200 rounded-xl bg-white">
              <QRCodeSVG value={session.qrCode} size={200} level="M" marginSize={4} bgColor="#ffffff" fgColor="#000000" />
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <InfoRow label="Biển số" value={session.vehiclePlate} mono />
            <InfoRow label="Loại xe" value={vehicleLabel} />
            <InfoRow label="Slot" value={session.slotCode} mono />
            <InfoRow label="Giờ vào" value={new Date(session.checkInTime).toLocaleTimeString('vi-VN')} />
            {gateLabel && <InfoRow label="Cổng vào" value={gateLabel.split('—')[0].trim()} />}
          </div>
          <div className="text-xs text-center text-gray-400">
            <span>Mã QR:</span>
            <span className="mt-1 block break-all font-mono text-gray-600 select-all">{session.qrCode}</span>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                       bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
            <Printer className="w-4 h-4" /> In QR
          </button>
          <button onClick={() => { onClose(); onReset() }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                       border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm transition-colors">
            <Car className="w-4 h-4" /> Xe tiếp theo
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function CheckIn() {
  const slots          = useSlotStore((s) => s.slots)
  const updateSlot     = useSlotStore((s) => s.updateSlotStatus)
  const checkInSession = useSessionStore((s) => s.checkInSession)
  const [submitting,  setSubmitting]  = useState(false)

  // Camera panel: 'qr' (default) hoặc 'lpr'
  const [camMode, setCamMode] = useState<'qr' | 'lpr'>('qr')
  const [scanActive, setScanActive] = useState(true)

  // Driver info từ QR scan
  const [scannedQrToken, setScannedQrToken] = useState('')
  const [driverInfo,     setDriverInfo]     = useState<DriverQrInfo | null>(null)
  const [qrLookupErr,    setQrLookupErr]    = useState('')
  const [qrLooking,      setQrLooking]      = useState(false)

  // Form state
  const [plate,       setPlate]       = useState('')
  const [vehicleType, setVehicleType] = useState<VehicleType>('motorbike')
  const [gates,       setGates]       = useState<BeGate[]>([])
  const [entryGate,   setEntryGate]   = useState('')
  const [notes,       setNotes]       = useState('')

  // Session / UI state
  const [session,     setSession]     = useState<ParkingSession | null>(null)
  const [modalOpen,   setModalOpen]   = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [barrierOpen, setBarrierOpen] = useState(false)
  const [zones,       setZones]       = useState<ZoneSummary[]>([])

  const [now, setNow] = useState(new Date())

  useEffect(() => {
    fetchEntryGates()
      .then((list) => { setGates(list); if (list.length > 0) setEntryGate(list[0].id) })
      .catch((err) => console.error('Lỗi tải cổng vào:', err))
    fetchZoneSummary()
      .then(setZones)
      .catch((err) => console.error('Lỗi tải thống kê zone:', err))
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  async function handleQrScan(token: string) {
    if (!token.trim()) return
    setScanActive(false)
    setScannedQrToken(token.trim())
    setQrLooking(true)
    setQrLookupErr('')
    setDriverInfo(null)
    try {
      const info = await lookupDriverByQr(token.trim())
      setDriverInfo(info)
      const code = info.vehicleType?.code?.toLowerCase()
      if (code === 'car') setVehicleType('car')
      else if (code === 'bicycle') setVehicleType('bicycle')
      else setVehicleType('motorbike')
    } catch (err: any) {
      setQrLookupErr(err?.response?.data?.message ?? 'Mã QR không hợp lệ hoặc tài xế chưa cập nhật biển số')
      setScanActive(true)
    } finally {
      setQrLooking(false)
    }
  }

  function clearDriverInfo() {
    setDriverInfo(null)
    setScannedQrToken('')
    setQrLookupErr('')
    setScanActive(true)
  }

  async function handleCreateSession() {
    setSubmitError('')
    const isQrMode = !!driverInfo

    if (!isQrMode && !plate.trim() && vehicleType !== 'bicycle') {
      const msg = 'Vui lòng nhận diện hoặc nhập biển số xe.'
      setSubmitError(msg); toast.error(msg); return
    }

    const targetSlot = slots.find((s) => s.status === 'available' && s.vehicleType === vehicleType)
    if (!targetSlot) {
      const msg = 'Không tìm thấy slot trống phù hợp. Hãy tải lại trang và chọn đúng loại xe.'
      setSubmitError(msg); toast.error(msg); return
    }

    setSubmitting(true)
    try {
      const newSession = await checkInSession(
        isQrMode
          ? { slotId: targetSlot.id, driverQrToken: scannedQrToken, vehicleTypeId: driverInfo!.vehicleType.id, gateInId: entryGate || undefined }
          : { slotId: targetSlot.id, licensePlate: plate.trim() ? plate.trim().toUpperCase() : undefined, vehicleType, gateInId: entryGate || undefined }
      )
      updateSlot(targetSlot.id, 'occupied')
      setBarrierOpen(true)
      setTimeout(() => setBarrierOpen(false), 4000)
      toast.success(`Tạo lượt gửi xe thành công! Mã: #${newSession.id.slice(0, 8).toUpperCase()}`)
      setSession(newSession)
      setModalOpen(true)
    } catch (err) {
      const msg = apiErrorMessage(err, 'Không thể tạo lượt gửi xe — vui lòng thử lại.')
      setSubmitError(msg); toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setPlate(''); setVehicleType('motorbike'); setEntryGate(gates[0]?.id ?? '')
    setNotes(''); setSubmitError(''); setSession(null)
    clearDriverInfo()
    setCamMode('qr'); setScanActive(true)
  }

  const availableCount = slots.filter((s) => s.status === 'available' && s.vehicleType === vehicleType).length

  return (
    <PageWrapper>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Xe vào (Check-in)</h1>
        <p className="text-sm text-gray-500 mt-0.5">Quét QR tài xế hoặc nhập thủ công biển số xe</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── CỘT TRÁI: Camera (QR scanner mặc định, có thể chuyển sang LPR) ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            {/* Header camera với toggle nhỏ */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Camera className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="font-semibold text-gray-900">
                  {camMode === 'qr' ? 'Quét QR tài xế' : 'Nhận diện biển số (LPR)'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = camMode === 'qr' ? 'lpr' : 'qr'
                  setCamMode(next)
                  if (next === 'qr') { setScanActive(true); clearDriverInfo() }
                }}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200
                           text-gray-500 hover:bg-gray-50 transition-colors"
              >
                {camMode === 'qr' ? '📷 Dùng LPR' : '📱 Dùng QR'}
              </button>
            </div>

            {/* Camera content */}
            {camMode === 'qr' ? (
              <div>
                {qrLooking ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-blue-600 text-sm bg-gray-50 rounded-xl">
                    <span className="animate-spin inline-block">⏳</span> Đang tra cứu tài xế...
                  </div>
                ) : driverInfo ? (
                  /* Đã quét xong — hiển thị thông tin driver */
                  <div className="space-y-3">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4" /> Tìm thấy tài xế
                        </p>
                        <button
                          type="button"
                          onClick={clearDriverInfo}
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p className="text-gray-600">Tên: <span className="font-semibold text-gray-900">{driverInfo.fullName}</span></p>
                        <p className="text-gray-600">Biển số: <span className="font-mono font-bold text-gray-900 text-base">{driverInfo.licensePlate}</span></p>
                        <p className="text-gray-600">Loại xe: <span className="font-medium text-gray-900">{driverInfo.vehicleType?.name}</span></p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 text-center">Thông tin đã được điền tự động vào form →</p>
                  </div>
                ) : (
                  /* Scanner camera */
                  <div className="space-y-2">
                    <QRScanner active={scanActive} onScan={handleQrScan} />
                    {qrLookupErr && (
                      <p className="text-xs text-red-500 flex items-center gap-1 px-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {qrLookupErr}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <LPRCamera plate={plate} onPlateChange={setPlate} plateOptional={vehicleType === 'bicycle'} />
            )}
          </div>

          {/* Chỗ trống theo tầng */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-sky-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Chỗ trống theo tầng</h2>
            </div>
            {zones.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">Đang tải dữ liệu...</p>
            ) : (
              <div className="space-y-1.5">
                {zones.map((z) => (
                  <div key={z.id}
                    className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                    <span className="text-gray-700">Tầng {z.floor} · {z.name}</span>
                    {z.availableSlots > 0
                      ? <span className="font-semibold text-emerald-600">Còn {z.availableSlots} chỗ</span>
                      : <span className="font-semibold text-red-500">Hết chỗ</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── CỘT PHẢI: Form ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <ClipboardList className="w-4 h-4 text-violet-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Thông tin xe vào</h2>
            </div>

            <div className="space-y-4">
              {/* Biển số — chỉ hiện khi không có driverInfo (manual mode) */}
              {!driverInfo && camMode === 'lpr' && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Biển số xe</label>
                  <input
                    type="text"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    placeholder="VD: 51F-970.22"
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-300 font-mono
                               focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 uppercase"
                  />
                </div>
              )}

              {/* Loại xe */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Loại xe</label>
                <div className="grid grid-cols-3 gap-2">
                  {VEHICLE_OPTIONS.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => !driverInfo && setVehicleType(v.value)}
                      disabled={!!driverInfo}
                      className={`py-2.5 rounded-xl border text-sm font-medium transition-all
                        ${vehicleType === v.value
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'}
                        ${driverInfo ? 'opacity-70 cursor-default' : ''}`}
                    >
                      <span className="block text-lg">{v.icon}</span>
                      <span className="text-xs">{v.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400">{availableCount} slot trống cho loại xe này</p>
              </div>

              {/* Cổng vào */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Cổng vào</label>
                <select
                  value={entryGate}
                  onChange={(e) => setEntryGate(e.target.value)}
                  disabled={gates.length === 0}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-300 bg-white
                             focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                             disabled:bg-gray-50 disabled:text-gray-400"
                >
                  {gates.length === 0 && <option>Đang tải...</option>}
                  {gates.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              {/* Thời gian */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  <Clock className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                  Thời gian vào
                </label>
                <div className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-mono text-gray-700 select-none">
                  {now.toLocaleString('vi-VN')}
                </div>
              </div>

              {/* Ghi chú */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Ghi chú</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Xe đặc biệt, tình trạng xe..."
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-300
                             focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                             resize-none bg-white"
                />
              </div>
            </div>
          </div>

          {/* Barrier */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <BarrierGate open={barrierOpen} label="Cổng A — Vào" lastOpened={barrierOpen ? new Date().toISOString() : null} />
            {barrierOpen && (
              <p className="text-xs text-emerald-600 text-center font-medium mt-2">✓ Barrier đã mở — xe có thể vào</p>
            )}
          </div>

          {submitError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {submitError}
            </div>
          )}

          <button
            onClick={handleCreateSession}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700
                       text-white font-semibold text-base shadow-sm transition-colors
                       flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <CheckCircle className="w-5 h-5" />
            {submitting ? 'Đang tạo...' : 'Tạo session & In QR'}
          </button>
        </div>
      </div>

      {modalOpen && session && (
        <SessionConfirmModal
          session={session}
          gateLabel={gates.find((g) => g.id === entryGate)?.name ?? ''}
          onClose={() => setModalOpen(false)}
          onReset={handleReset}
        />
      )}
    </PageWrapper>
  )
}

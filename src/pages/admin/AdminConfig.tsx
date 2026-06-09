// Trang cấu hình hệ thống — 4 nhóm: tòa nhà, vận hành, IoT, AI — lưu vào configStore + localStorage
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Building2, Settings, Cpu, Brain,
  Save, RefreshCw, RotateCcw, Wifi, WifiOff,
  Eye, EyeOff, Zap, AlertTriangle,
  CheckCircle, Power, X,
} from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import { useConfigStore, CONFIG_DEFAULTS, type SystemConfig } from '@/store/configStore'
import { useSlotStore } from '@/store/slotStore'
import { geminiFlashText } from '@/ai/geminiClient'

// ─── Kiểu IoT device (chỉ dùng trong trang này) ──────────────────────────────

type DeviceType   = 'camera' | 'sensor' | 'barrier'
type DeviceStatus = 'online' | 'offline'
type PingState    = 'idle' | 'pinging' | 'ok' | 'timeout'

interface CfgDevice {
  id:       number
  name:     string
  type:     DeviceType
  location: string
  status:   DeviceStatus
  ip:       string
}

const INITIAL_DEVICES: CfgDevice[] = [
  { id: 1, name: 'Camera LPR Cổng A',   type: 'camera',  location: 'Cổng vào/ra A',      status: 'online',  ip: '10.0.1.10' },
  { id: 2, name: 'Camera LPR Cổng B',   type: 'camera',  location: 'Cổng vào/ra B',      status: 'online',  ip: '10.0.1.11' },
  { id: 3, name: 'Cảm biến tầng 1',     type: 'sensor',  location: 'Tầng 1 (24 slot)',   status: 'online',  ip: '10.0.2.1'  },
  { id: 4, name: 'Cảm biến tầng 2',     type: 'sensor',  location: 'Tầng 2 (24 slot)',   status: 'online',  ip: '10.0.2.2'  },
  { id: 5, name: 'Cảm biến tầng 3',     type: 'sensor',  location: 'Tầng 3 (24 slot)',   status: 'offline', ip: '10.0.2.3'  },
  { id: 6, name: 'Barrier Cổng A',      type: 'barrier', location: 'Cổng A — Vào/Ra',    status: 'online',  ip: '10.0.3.1'  },
  { id: 7, name: 'Barrier Cổng B',      type: 'barrier', location: 'Cổng B — Vào/Ra',    status: 'online',  ip: '10.0.3.2'  },
]

const DEVICE_TYPE_LABEL: Record<DeviceType, string> = {
  camera:  'Camera LPR',
  sensor:  'Cảm biến',
  barrier: 'Barrier',
}

// ─── Cấu hình tab sidebar ─────────────────────────────────────────────────────

type ConfigTab = 'building' | 'operations' | 'iot' | 'ai'

const TABS: { id: ConfigTab; label: string; Icon: typeof Building2 }[] = [
  { id: 'building',    label: 'Thông tin tòa nhà',   Icon: Building2 },
  { id: 'operations',  label: 'Cấu hình vận hành',   Icon: Settings  },
  { id: 'iot',         label: 'Thiết bị IoT',         Icon: Cpu       },
  { id: 'ai',          label: 'Cấu hình AI',          Icon: Brain     },
]

// ─── Helper components ────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} aria-label="toggle"
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full
                  transition-colors duration-200
                  ${value ? 'bg-green-500' : 'bg-gray-300'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow
                        transition-transform duration-200
                        ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function ToggleRow({
  label, desc, value, onChange,
}: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-gray-100 last:border-0">
      <div className="mr-4">
        <div className="text-sm font-medium text-gray-800">{label}</div>
        {desc && <div className="text-xs text-gray-500 mt-0.5">{desc}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs font-medium ${value ? 'text-green-600' : 'text-gray-400'}`}>
          {value ? 'Bật' : 'Tắt'}
        </span>
        <Toggle value={value} onChange={onChange} />
      </div>
    </div>
  )
}

function NumberField({
  label, desc, value, onChange, min, max, unit,
}: {
  label: string; desc?: string; value: number
  onChange: (v: number) => void; min?: number; max?: number; unit?: string
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="mr-4">
        <div className="text-sm font-medium text-gray-800">{label}</div>
        {desc && <div className="text-xs text-gray-500 mt-0.5">{desc}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number" value={value} min={min} max={max}
          onChange={e => onChange(Number(e.target.value))}
          className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right
                     focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        {unit && <span className="text-xs text-gray-500 w-10">{unit}</span>}
      </div>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-5">
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function SaveButton({ saved, onClick, label = 'Lưu thay đổi' }: {
  saved: boolean; onClick: () => void; label?: string
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium
                  shadow-sm transition-all duration-200
                  ${saved ? 'bg-green-600 text-white scale-95' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
      {saved ? <CheckCircle size={15} /> : <Save size={15} />}
      {saved ? 'Đã lưu!' : label}
    </button>
  )
}

// ─── Trang chính ──────────────────────────────────────────────────────────────

export default function AdminConfig() {
  // ── Config store ──────────────────────────────────────────────────────────
  const config       = useConfigStore()
  const updateConfig = useConfigStore(s => s.updateConfig)
  const totalSlots   = useSlotStore(s => s.slots.length)

  const [activeTab, setActiveTab] = useState<ConfigTab>('building')

  // ── Draft states (mỗi section có form riêng, Lưu mới commit vào store) ──
  const [building, setBuilding] = useState({
    parkingName: config.parkingName,
    address:     config.address,
    phone:       config.phone,
    openTime:    config.openTime,
    closeTime:   config.closeTime,
    totalFloors: config.totalFloors,
  })

  const [ops, setOps] = useState({
    slotPendingMinutes:       config.slotPendingMinutes,
    exitCodeMinutes:          config.exitCodeMinutes,
    overtimeThresholdHours:   config.overtimeThresholdHours,
    lostQrSurcharge:          config.lostQrSurcharge,
    overtimeSurchargePercent: config.overtimeSurchargePercent,
    allowBooking:             config.allowBooking,
    enableAI:                 config.enableAI,
  })

  // ── Trạng thái saved feedback ─────────────────────────────────────────────
  const [savedSection, setSavedSection] = useState<string | null>(null)
  function markSaved(section: string) {
    setSavedSection(section)
    setTimeout(() => setSavedSection(null), 2000)
  }

  // ── IoT state ────────────────────────────────────────────────────────────
  const [devices, setDevices]         = useState<CfgDevice[]>(INITIAL_DEVICES)
  const [pingStates, setPingStates]   = useState<Record<number, PingState>>({})
  const [restartTarget, setRestartTarget] = useState<number | null>(null)
  const [restartingId, setRestartingId]   = useState<number | null>(null)
  const [offlineFallback, setOfflineFallback] = useState(config.offlineFallbackMode)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  function handlePing(id: number) {
    setPingStates(p => ({ ...p, [id]: 'pinging' }))
    setTimeout(() => {
      const dev = devices.find(d => d.id === id)
      setPingStates(p => ({ ...p, [id]: dev?.status === 'online' ? 'ok' : 'timeout' }))
    }, 1000)
  }

  function handleRestartConfirm() {
    if (restartTarget === null) return
    const id = restartTarget
    setRestartTarget(null)
    setRestartingId(id)
    setTimeout(() => {
      setDevices(prev => prev.map(d => d.id === id ? { ...d, status: 'online' } : d))
      setRestartingId(null)
    }, 3000)
  }

  function saveIot() {
    updateConfig({ offlineFallbackMode: offlineFallback })
    markSaved('iot')
  }

  // ── AI state ─────────────────────────────────────────────────────────────
  const envKey    = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? ''
  const activeKey = config.geminiApiKey || envKey
  const maskedKey = activeKey.length > 8
    ? `${'●'.repeat(activeKey.length - 4)}${activeKey.slice(-4)}`
    : activeKey ? '●●●●●●●●' : '(chưa cấu hình)'

  const [showKeyEdit, setShowKeyEdit]   = useState(false)
  const [newKey, setNewKey]             = useState('')
  const [showNewKey, setShowNewKey]     = useState(false)
  const [aiModel, setAiModel]           = useState<SystemConfig['geminiModel']>(config.geminiModel)
  const [lprThreshold, setLprThreshold] = useState(config.lprConfidenceThreshold)
  const [peakPred, setPeakPred]         = useState(config.enablePeakPrediction)

  const [testing,     setTesting]     = useState(false)
  const [testCooldown, setTestCooldown] = useState(false)
  const [testResult,  setTestResult]  = useState<{ ok: boolean; msg: string } | null>(null)

  async function handleTestAI() {
    if (testCooldown) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await geminiFlashText.generateContent(
        'Xin chào từ hệ thống ParkingOS. Bạn có thể trả lời ngắn gọn bằng tiếng Việt không?'
      )
      const text = result.response.text().trim().slice(0, 120)
      setTestResult({ ok: true, msg: text })
    } catch (err) {
      const isRateLimit = err instanceof Error && err.message === 'RATE_LIMIT'
      setTestResult({
        ok:  false,
        msg: isRateLimit
          ? 'API đang bận (429 Too Many Requests) — thử lại sau vài giây'
          : (err instanceof Error ? err.message : 'Lỗi không xác định'),
      })
    } finally {
      setTesting(false)
      setTestCooldown(true)
      setTimeout(() => setTestCooldown(false), 8_000)
    }
  }

  function saveAI() {
    updateConfig({
      geminiModel:            aiModel,
      lprConfidenceThreshold: lprThreshold,
      enablePeakPrediction:   peakPred,
      ...(newKey.trim() ? { geminiApiKey: newKey.trim() } : {}),
    })
    if (newKey.trim()) { setNewKey(''); setShowKeyEdit(false) }
    markSaved('ai')
  }

  // ─── Section renderers (gọi như function, không phải JSX component) ────────

  function BuildingSection() {
    return (
      <>
        <SectionCard title="Thông tin cơ bản">
          <div className="space-y-4">
            {([
              { key: 'parkingName' as const, label: 'Tên bãi xe', placeholder: 'ParkingOS' },
              { key: 'address'     as const, label: 'Địa chỉ',    placeholder: '123 Đường...' },
              { key: 'phone'       as const, label: 'Điện thoại', placeholder: '028 xxxx xxxx' },
            ]).map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  value={building[key] as string}
                  onChange={e => setBuilding(b => ({ ...b, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Giờ hoạt động & Tầng">
          <div className="grid grid-cols-2 gap-4 mb-4">
            {([
              { key: 'openTime'  as const, label: 'Giờ mở cửa' },
              { key: 'closeTime' as const, label: 'Giờ đóng cửa' },
            ]).map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type="time" value={building[key] as string}
                  onChange={e => setBuilding(b => ({ ...b, [key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tổng số tầng</label>
              <input
                type="number" min={1} max={10} value={building.totalFloors}
                onChange={e => setBuilding(b => ({ ...b, totalFloors: Number(e.target.value) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tổng sức chứa
                <span className="ml-1 text-xs text-gray-400">(tự động)</span>
              </label>
              <div className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm
                              bg-gray-50 text-gray-600 font-semibold select-none">
                {totalSlots} slot
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="flex justify-end">
          <SaveButton
            saved={savedSection === 'building'}
            label="Lưu thông tin"
            onClick={() => { updateConfig(building); markSaved('building') }}
          />
        </div>
      </>
    )
  }

  function OpsSection() {
    return (
      <>
        <SectionCard title="Thời gian & phụ thu">
          <NumberField
            label="Pending slot tối đa" unit="phút" value={ops.slotPendingMinutes} min={1} max={60}
            desc="AI giữ slot bao lâu trước khi nhả nếu xe chưa vào"
            onChange={v => setOps(o => ({ ...o, slotPendingMinutes: v }))}
          />
          <NumberField
            label="Hiệu lực mã ra cổng" unit="phút" value={ops.exitCodeMinutes} min={5} max={120}
            desc="Mã xác nhận xe ra cổng hết hạn sau bao lâu"
            onChange={v => setOps(o => ({ ...o, exitCodeMinutes: v }))}
          />
          <NumberField
            label="Ngưỡng quá hạn" unit="giờ" value={ops.overtimeThresholdHours} min={1} max={72}
            desc="Xe gửi vượt quá số giờ này bị coi là quá hạn"
            onChange={v => setOps(o => ({ ...o, overtimeThresholdHours: v }))}
          />
          <NumberField
            label="Phụ thu mất thẻ QR" unit="VND" value={ops.lostQrSurcharge} min={0}
            desc="Khoản phụ thu khi xe check-out không có mã QR"
            onChange={v => setOps(o => ({ ...o, lostQrSurcharge: v }))}
          />
          <NumberField
            label="Phụ thu quá hạn" unit="%" value={ops.overtimeSurchargePercent} min={0} max={100}
            desc="Cộng thêm % trên tổng phí khi xe gửi quá hạn"
            onChange={v => setOps(o => ({ ...o, overtimeSurchargePercent: v }))}
          />
        </SectionCard>

        <SectionCard title="Tính năng">
          <ToggleRow
            label="Cho phép đặt chỗ trước" value={ops.allowBooking}
            desc="Tài xế có thể đặt slot qua ứng dụng trước khi đến"
            onChange={v => setOps(o => ({ ...o, allowBooking: v }))}
          />
          <ToggleRow
            label="Bật AI gợi ý slot" value={ops.enableAI}
            desc="Tắt để dùng thuật toán đơn giản (slot trống đầu tiên)"
            onChange={v => setOps(o => ({ ...o, enableAI: v }))}
          />
          {!ops.enableAI && (
            <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50
                            border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle size={13} className="shrink-0" />
              AI đang tắt — trang check-in sẽ dùng slot trống đầu tiên theo thứ tự
            </div>
          )}
        </SectionCard>

        <div className="flex justify-end">
          <SaveButton
            saved={savedSection === 'ops'}
            label="Lưu cấu hình vận hành"
            onClick={() => { updateConfig(ops); markSaved('ops') }}
          />
        </div>
      </>
    )
  }

  function IotSection() {
    return (
      <>
        <SectionCard title="Trạng thái thiết bị">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Thiết bị', 'Loại', 'Vị trí', 'IP', 'Trạng thái', 'Thao tác'].map(h => (
                    <th key={h}
                      className="py-2 pr-4 text-left text-xs font-semibold text-gray-500
                                 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {devices.map(dev => {
                  const ping      = pingStates[dev.id] ?? 'idle'
                  const restarting = restartingId === dev.id

                  return (
                    <tr key={dev.id} className="hover:bg-gray-50/50">
                      <td className="py-3 pr-4 font-medium text-gray-800 whitespace-nowrap">{dev.name}</td>
                      <td className="py-3 pr-4 text-gray-500 text-xs">{DEVICE_TYPE_LABEL[dev.type]}</td>
                      <td className="py-3 pr-4 text-gray-500 text-xs">{dev.location}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-gray-500">{dev.ip}</td>

                      {/* Status */}
                      <td className="py-3 pr-4">
                        {restarting ? (
                          <span className="flex items-center gap-1.5 text-xs text-blue-600">
                            <RefreshCw size={12} className="animate-spin" /> Khởi động...
                          </span>
                        ) : dev.status === 'online' ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Online
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
                            <span className="w-2 h-2 bg-red-400 rounded-full" /> Offline
                          </span>
                        )}
                        {ping !== 'idle' && !restarting && (
                          <div className={`text-xs mt-0.5 ${
                            ping === 'pinging' ? 'text-gray-400' :
                            ping === 'ok'      ? 'text-green-500' : 'text-red-400'
                          }`}>
                            {ping === 'pinging' ? '⏳ Đang ping...' :
                             ping === 'ok'      ? '✓ Online (12ms)' : '✗ Timeout'}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button onClick={() => handlePing(dev.id)}
                            disabled={ping === 'pinging' || restarting}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                                       bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-40
                                       transition-colors whitespace-nowrap">
                            <Wifi size={11} /> Ping
                          </button>
                          <button onClick={() => setRestartTarget(dev.id)}
                            disabled={restarting}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                                       bg-orange-50 text-orange-600 hover:bg-orange-100 disabled:opacity-40
                                       transition-colors whitespace-nowrap">
                            <Power size={11} /> Restart
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Chế độ dự phòng">
          <ToggleRow
            label="Chế độ offline fallback" value={offlineFallback}
            desc="Khi mất điện/mạng — nhân viên chuyển sang quy trình thủ công, không dùng cảm biến"
            onChange={setOfflineFallback}
          />
          {offlineFallback && (
            <div className="mt-3 flex items-start gap-2 text-xs text-orange-700 bg-orange-50
                            border border-orange-200 rounded-lg px-3 py-2.5">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <div>
                <strong>Chế độ thủ công đang BẬT.</strong> Tất cả cảm biến và camera bị bỏ qua.
                Nhân viên cần ghi nhận xe vào/ra thủ công trên sổ tay.
              </div>
            </div>
          )}
        </SectionCard>

        <div className="flex justify-end">
          <SaveButton saved={savedSection === 'iot'} label="Lưu cấu hình IoT" onClick={saveIot} />
        </div>

        {/* Confirm restart dialog */}
        {restartTarget !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                  <Power size={18} className="text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-1">Khởi động lại thiết bị?</h3>
                  <p className="text-sm text-gray-600">
                    <strong>{devices.find(d => d.id === restartTarget)?.name}</strong> sẽ offline
                    trong khoảng 3 giây trong quá trình khởi động lại.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRestartTarget(null)}
                  className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium
                             text-gray-700 hover:bg-gray-50 transition-colors">
                  Hủy
                </button>
                <button onClick={handleRestartConfirm}
                  className="flex-1 bg-orange-600 text-white rounded-lg py-2.5 text-sm font-medium
                             hover:bg-orange-700 transition-colors">
                  Khởi động lại
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  function AiSection() {
    return (
      <>
        {/* API Key */}
        <SectionCard title="Gemini API Key">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 font-mono text-sm bg-gray-50 border border-gray-200
                            rounded-lg px-4 py-2.5 text-gray-600 select-none">
              {maskedKey}
            </div>
            <button onClick={() => setShowKeyEdit(v => !v)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium
                         border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap">
              {showKeyEdit ? <X size={14} /> : <Eye size={14} />}
              {showKeyEdit ? 'Hủy' : 'Đổi key'}
            </button>
          </div>

          {showKeyEdit && (
            <div className="flex items-center gap-2 mt-2">
              <div className="relative flex-1">
                <input
                  type={showNewKey ? 'text' : 'password'}
                  value={newKey}
                  onChange={e => setNewKey(e.target.value)}
                  placeholder="Nhập API key mới từ Google AI Studio..."
                  className="w-full border border-blue-300 rounded-lg px-3 py-2.5 pr-10 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono"
                />
                <button type="button" onClick={() => setShowNewKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNewKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Lấy key miễn phí tại <span className="text-blue-500">aistudio.google.com/app/apikey</span>
            {' '}· 15 RPM · 1M token/ngày
          </p>
        </SectionCard>

        {/* Model & ngưỡng */}
        <SectionCard title="Cài đặt mô hình">
          {/* Model dropdown */}
          <div className="flex items-center justify-between py-3.5 border-b border-gray-100">
            <div>
              <div className="text-sm font-medium text-gray-800">Model AI</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Pro chính xác hơn nhưng tốn quota nhiều hơn
              </div>
            </div>
            <select value={aiModel} onChange={e => setAiModel(e.target.value as SystemConfig['geminiModel'])}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none
                         focus:ring-2 focus:ring-blue-300 bg-white">
              <option value="gemini-2.0-flash">gemini-2.0-flash (nhanh, miễn phí)</option>
              <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite (nhẹ hơn, tiết kiệm quota)</option>
            </select>
          </div>

          {/* LPR threshold slider */}
          <div className="py-3.5 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-gray-800">Ngưỡng độ tin cậy LPR</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Dưới ngưỡng này → flag "cần xác minh thủ công"
                </div>
              </div>
              <span className="text-lg font-bold text-blue-600 w-16 text-right">{lprThreshold}%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-8">50%</span>
              <input
                type="range" min={50} max={99} step={1} value={lprThreshold}
                onChange={e => setLprThreshold(Number(e.target.value))}
                className="flex-1 accent-blue-600 h-2 cursor-pointer"
              />
              <span className="text-xs text-gray-400 w-8">99%</span>
            </div>
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-500 rounded-full transition-all"
                style={{ width: `${((lprThreshold - 50) / 49) * 100}%` }}
              />
            </div>
          </div>

          <ToggleRow
            label="Dự báo giờ cao điểm" value={peakPred}
            desc="AI phân tích lịch sử để dự báo khung giờ bận — tốn ~500 token/lần gọi"
            onChange={setPeakPred}
          />
        </SectionCard>

        {/* Thống kê AI hôm nay */}
        <SectionCard title="Thống kê AI hôm nay">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { label: 'Số lần gọi API', value: '23', color: 'text-blue-600' },
              { label: 'Token đã dùng',  value: '14.230', color: 'text-orange-600' },
              { label: 'Token còn lại',  value: '985.770', color: 'text-green-600' },
            ].map(stat => (
              <div key={stat.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            ※ Số liệu mock — tracking thực tế cần backend middleware
          </p>
        </SectionCard>

        {/* Test kết nối */}
        <SectionCard title="Kiểm tra kết nối AI">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={handleTestAI} disabled={testing || testCooldown}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                         bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60
                         shadow-sm transition-colors">
              {testing
                ? <><RefreshCw size={14} className="animate-spin" /> Đang kiểm tra...</>
                : <><Zap size={14} /> Test kết nối AI</>}
            </button>
            {testResult && (
              <div className={`flex items-start gap-2 text-sm px-4 py-2.5 rounded-lg border flex-1 min-w-0
                ${testResult.ok
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-600'}`}>
                {testResult.ok
                  ? <CheckCircle size={15} className="shrink-0 mt-0.5" />
                  : <WifiOff size={15} className="shrink-0 mt-0.5" />}
                <span className="line-clamp-2 text-xs">{testResult.msg}</span>
              </div>
            )}
          </div>
        </SectionCard>

        <div className="flex justify-end">
          <SaveButton saved={savedSection === 'ai'} label="Lưu cấu hình AI" onClick={saveAI} />
        </div>
      </>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <PageWrapper>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">Cấu hình hệ thống</h2>
        <p className="text-sm text-gray-500 mt-0.5">Thiết lập tham số hoạt động cho ParkingOS</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Sidebar tabs ── */}
        <div className="w-52 shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm
                        overflow-hidden sticky top-4">
          {TABS.map(tab => {
            const active = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium
                            text-left transition-colors border-b border-gray-100 last:border-0
                            ${active
                              ? 'bg-blue-50 text-blue-700 border-l-2 border-l-blue-600'
                              : 'text-gray-600 hover:bg-gray-50 border-l-2 border-l-transparent'}`}>
                <tab.Icon size={16} className={active ? 'text-blue-600' : 'text-gray-400'} />
                <span className="leading-tight">{tab.label}</span>
              </button>
            )
          })}

          {/* Reset về default — dùng state dialog thay cho confirm() */}
          <div className="p-3 border-t border-gray-100">
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                           text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <RotateCcw size={12} /> Đặt lại mặc định
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-red-600 font-medium text-center">Đặt lại tất cả về mặc định?</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      useConfigStore.getState().resetToDefaults()
                      setBuilding({
                        parkingName: CONFIG_DEFAULTS.parkingName, address: CONFIG_DEFAULTS.address,
                        phone: CONFIG_DEFAULTS.phone, openTime: CONFIG_DEFAULTS.openTime,
                        closeTime: CONFIG_DEFAULTS.closeTime, totalFloors: CONFIG_DEFAULTS.totalFloors,
                      })
                      setOps({
                        slotPendingMinutes: CONFIG_DEFAULTS.slotPendingMinutes,
                        exitCodeMinutes: CONFIG_DEFAULTS.exitCodeMinutes,
                        overtimeThresholdHours: CONFIG_DEFAULTS.overtimeThresholdHours,
                        lostQrSurcharge: CONFIG_DEFAULTS.lostQrSurcharge,
                        overtimeSurchargePercent: CONFIG_DEFAULTS.overtimeSurchargePercent,
                        allowBooking: CONFIG_DEFAULTS.allowBooking, enableAI: CONFIG_DEFAULTS.enableAI,
                      })
                      setAiModel(CONFIG_DEFAULTS.geminiModel)
                      setLprThreshold(CONFIG_DEFAULTS.lprConfidenceThreshold)
                      setPeakPred(CONFIG_DEFAULTS.enablePeakPrediction)
                      setOfflineFallback(CONFIG_DEFAULTS.offlineFallbackMode)
                      setShowResetConfirm(false)
                      toast.success('Đã đặt lại cấu hình về mặc định')
                    }}
                    className="flex-1 text-xs px-2 py-1.5 bg-red-500 hover:bg-red-600
                               text-white rounded-lg transition-colors font-medium"
                  >
                    Xác nhận
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 text-xs px-2 py-1.5 border border-gray-200
                               hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0">
          {activeTab === 'building'   && BuildingSection()}
          {activeTab === 'operations' && OpsSection()}
          {activeTab === 'iot'        && IotSection()}
          {activeTab === 'ai'         && AiSection()}
        </div>
      </div>
    </PageWrapper>
  )
}

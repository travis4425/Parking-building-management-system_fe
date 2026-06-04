// QR Scanner dùng camera thật — html5-qrcode, viewfinder CSS, beep khi quét được,
// phân loại lỗi camera chi tiết, fallback input nhập tay token
import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { toast } from 'sonner'
import { ScanLine, CameraOff, Loader2, KeyboardIcon, ArrowRight } from 'lucide-react'

interface QRScannerProps {
  onScan:  (text: string) => void
  active:  boolean
}

type CamError = 'permission' | 'notfound' | 'other' | null

const SCANNER_DIV_ID = 'html5-qr-reader'

// Phân loại lỗi camera dựa vào message
function classifyError(err: unknown): CamError {
  const msg = err instanceof Error ? err.message : String(err)
  const low = msg.toLowerCase()
  if (low.includes('notallowederror') || low.includes('permission') || low.includes('denied'))
    return 'permission'
  if (low.includes('notfounderror') || low.includes('not found') || low.includes('no camera'))
    return 'notfound'
  return 'other'
}

// Beep ngắn khi quét thành công — Web Audio API
function playBeep() {
  try {
    const ctx  = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1200, ctx.currentTime)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.12)
  } catch { /* silently fail trên browsers không hỗ trợ */ }
}

export default function QRScanner({ onScan, active }: QRScannerProps) {
  const calledRef     = useRef(false)
  const [starting,    setStarting]    = useState(false)
  const [camError,    setCamError]    = useState<CamError>(null)
  const [scanOk,      setScanOk]      = useState(false)  // highlight xanh khi quét thành công
  const [manualMode,  setManualMode]  = useState(false)
  const [manualInput, setManualInput] = useState('')

  useEffect(() => {
    if (active) {
      setCamError(null)
      setManualMode(false)
      setManualInput('')
      setScanOk(false)
    }
  }, [active])

  useEffect(() => {
    if (!active) return

    calledRef.current = false
    setStarting(true)
    setCamError(null)
    setScanOk(false)

    let scanner: Html5Qrcode | null = null
    let isStarted     = false
    let cleanupCalled = false

    try {
      scanner = new Html5Qrcode(SCANNER_DIV_ID)
    } catch {
      setCamError('other')
      setStarting(false)
      return
    }

    const s = scanner

    s.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 130 } },
      (decodedText: string) => {
        if (calledRef.current) return
        calledRef.current = true
        playBeep()
        setScanOk(true)
        s.stop().catch(() => {}).finally(() => {
          setTimeout(() => setScanOk(false), 600)
          onScan(decodedText)
        })
      },
      () => {},
    )
      .then(() => {
        isStarted = true
        if (!cleanupCalled) setStarting(false)
        else s.stop().catch(() => {})
      })
      .catch((err: unknown) => {
        if (!cleanupCalled) {
          const type = classifyError(err)
          setCamError(type)
          setStarting(false)
          if (type === 'permission') toast.error('Không thể truy cập camera — Vui lòng cấp quyền')
        }
      })

    return () => {
      cleanupCalled = true
      if (isStarted) s.stop().catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  function handleManualSubmit() {
    const val = manualInput.trim()
    if (!val) return
    setManualInput('')
    setManualMode(false)
    onScan(val)
  }

  return (
    <div className="space-y-3">
      {/* Vùng camera + viewfinder overlay */}
      <div className="relative bg-gray-900 rounded-xl overflow-hidden" style={{ minHeight: 200 }}>
        <div id={SCANNER_DIV_ID} className="w-full" />

        {/* Viewfinder — khung ngắm 4 góc, hiện khi camera đang chạy */}
        {!starting && !camError && (
          <div className={`absolute inset-0 pointer-events-none transition-all duration-300 ${
            scanOk ? 'bg-emerald-500/20' : ''
          }`}>
            {/* 4 góc viewfinder */}
            {[
              'top-[20%] left-[15%] border-t-2 border-l-2 rounded-tl-sm',
              'top-[20%] right-[15%] border-t-2 border-r-2 rounded-tr-sm',
              'bottom-[20%] left-[15%] border-b-2 border-l-2 rounded-bl-sm',
              'bottom-[20%] right-[15%] border-b-2 border-r-2 rounded-br-sm',
            ].map((cls, i) => (
              <div key={i} className={`absolute w-6 h-6 ${cls} ${
                scanOk ? 'border-emerald-400' : 'border-blue-400'
              }`} />
            ))}
            {/* Scan line animation */}
            <div className={`absolute left-[15%] right-[15%] h-0.5 top-[50%]
                            opacity-70 animate-pulse ${
              scanOk ? 'bg-emerald-400' : 'bg-blue-400'
            }`} />
          </div>
        )}

        {/* Đang khởi động */}
        {starting && !camError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900">
            <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
            <p className="text-sm text-gray-300">Đang khởi động camera...</p>
            <p className="text-xs text-gray-500">Vui lòng cho phép truy cập camera khi được hỏi</p>
          </div>
        )}

        {/* Lỗi permission */}
        {camError === 'permission' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900 p-4">
            <CameraOff className="w-8 h-8 text-amber-400" />
            <p className="text-sm font-semibold text-amber-300">Camera bị chặn</p>
            <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-300 space-y-1.5 w-full max-w-xs">
              <p className="font-medium text-gray-200 mb-2">Cách mở quyền camera:</p>
              <p>1. Nhấn icon 🔒 hoặc ℹ️ trên thanh địa chỉ</p>
              <p>2. Tìm mục <strong>Camera</strong> → chọn <strong>Cho phép</strong></p>
              <p>3. Tải lại trang (F5) và thử lại</p>
            </div>
            <button onClick={() => setManualMode(true)}
              className="text-xs text-blue-400 hover:text-blue-300 underline">
              Hoặc nhập mã QR thủ công
            </button>
          </div>
        )}

        {/* Lỗi không có camera */}
        {camError === 'notfound' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900 p-4">
            <CameraOff className="w-8 h-8 text-gray-500" />
            <p className="text-sm text-gray-300">Không tìm thấy camera</p>
            <p className="text-xs text-gray-500 text-center">
              Thiết bị không có camera hoặc camera đang dùng bởi app khác
            </p>
            <button onClick={() => setManualMode(true)}
              className="text-xs text-blue-400 hover:text-blue-300 underline mt-1">
              Nhập mã QR thủ công
            </button>
          </div>
        )}

        {/* Lỗi khác */}
        {camError === 'other' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900">
            <CameraOff className="w-8 h-8 text-red-400" />
            <p className="text-sm text-gray-300">Lỗi camera</p>
            <button onClick={() => setManualMode(true)}
              className="text-xs text-blue-400 hover:text-blue-300 underline">
              Nhập mã QR thủ công
            </button>
          </div>
        )}

        {/* Hướng dẫn khi camera đang chạy */}
        {!starting && !camError && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
            <div className="flex items-center gap-1.5 bg-black/50 text-blue-300 text-xs px-3 py-1 rounded-full">
              <ScanLine className="w-3.5 h-3.5" />
              Hướng camera vào mã QR trên vé
            </div>
          </div>
        )}
      </div>

      {/* Nút chuyển nhập thủ công (khi camera OK) */}
      {!camError && !starting && !manualMode && active && (
        <button onClick={() => setManualMode(true)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
          <KeyboardIcon className="w-3.5 h-3.5" />
          Nhập mã QR thủ công
        </button>
      )}

      {/* Fallback input — nhập PKG token từ vé */}
      {manualMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-medium text-blue-800 flex items-center gap-1.5">
            <KeyboardIcon className="w-3.5 h-3.5" />
            Nhập mã PKG từ vé (dán hoặc gõ tay)
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
              placeholder="PKG-... hoặc mã QR UUID"
              className="flex-1 text-xs px-3 py-2 rounded-lg border border-blue-300
                         focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white"
              autoFocus
            />
            <button onClick={handleManualSubmit} disabled={!manualInput.trim()}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700
                         disabled:opacity-40 text-white text-xs font-medium transition-colors">
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {!camError && (
            <button onClick={() => setManualMode(false)}
              className="text-xs text-blue-500 hover:text-blue-700">
              ← Quay lại quét camera
            </button>
          )}
        </div>
      )}
    </div>
  )
}

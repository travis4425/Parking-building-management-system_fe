// QR Scanner dùng camera thật — html5-qrcode, viewfinder CSS, beep khi quét được,
// phân loại lỗi camera chi tiết, fallback input nhập tay token
import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import jsQR from 'jsqr'
import { toast } from 'sonner'
import { ScanLine, CameraOff, Loader2, KeyboardIcon, ArrowRight, Upload } from 'lucide-react'

interface QRScannerProps {
  onScan:  (text: string) => void
  active:  boolean
}

type CamError = 'permission' | 'notfound' | 'other' | 'in_app_browser' | null

const SCANNER_DIV_ID = 'html5-qr-reader'
const FILE_SCANNER_DIV_ID = 'html5-qr-file-reader'

// 🐞 SỬA: webview trong-app (Zalo, Messenger, Instagram, Zoom...) thường chặn/giả
// lập camera không ổn định — html5-qrcode có thể throw lỗi không phải Error chuẩn
// (string/object trống) làm crash cả app. Phát hiện trước qua User-Agent để khỏi
// thử camera trong các webview này, tránh crash, hiện luôn hướng dẫn mở bằng
// trình duyệt thật (Safari/Chrome).
function isInAppBrowser(): boolean {
  const ua = navigator.userAgent || ''
  return /Zalo|FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|TikTok/i.test(ua)
}

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

// QR trong ảnh chụp toàn màn hình thường quá nhỏ so với tổng ảnh khiến ZXing
// không định vị được. Tạo các ô crop chồng lấn để QR trở thành phần đủ lớn.
async function createQrCropCandidates(file: File): Promise<File[]> {
  const bitmap = await createImageBitmap(file)
  const candidates: File[] = []
  const cols = 3
  const rows = 3
  const tileWidth = Math.ceil(bitmap.width / 2)
  const tileHeight = Math.ceil(bitmap.height / 2)

  try {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const sx = Math.round((bitmap.width - tileWidth) * col / (cols - 1))
        const sy = Math.round((bitmap.height - tileHeight) * row / (rows - 1))
        const canvas = document.createElement('canvas')
        canvas.width = tileWidth
        canvas.height = tileHeight
        const context = canvas.getContext('2d')
        if (!context) continue
        context.fillStyle = '#fff'
        context.fillRect(0, 0, tileWidth, tileHeight)
        context.drawImage(bitmap, sx, sy, tileWidth, tileHeight, 0, 0, tileWidth, tileHeight)
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
        if (blob) candidates.push(new File([blob], `qr-crop-${row}-${col}.png`, { type: 'image/png' }))
      }
    }
  } finally {
    bitmap.close()
  }

  return candidates
}

async function decodeWithJsQr(files: File[]): Promise<string | undefined> {
  for (const file of files) {
    const bitmap = await createImageBitmap(file)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) continue
      context.drawImage(bitmap, 0, 0)
      const image = context.getImageData(0, 0, canvas.width, canvas.height)
      const result = jsQR(image.data, image.width, image.height, {
        inversionAttempts: 'attemptBoth',
      })
      if (result?.data) return result.data
    } finally {
      bitmap.close()
    }
  }
  return undefined
}

async function decodeWithNativeBarcodeDetector(file: File): Promise<string | undefined> {
  const Detector = (window as unknown as {
    BarcodeDetector?: new (options: { formats: string[] }) => {
      detect(source: ImageBitmap): Promise<Array<{ rawValue: string }>>
    }
  }).BarcodeDetector
  if (!Detector) return undefined

  const bitmap = await createImageBitmap(file)
  try {
    const detector = new Detector({ formats: ['qr_code'] })
    const [result] = await detector.detect(bitmap)
    return result?.rawValue || undefined
  } finally {
    bitmap.close()
  }
}

export default function QRScanner({ onScan, active }: QRScannerProps) {
  const calledRef     = useRef(false)
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const [starting,    setStarting]    = useState(false)
  const [camError,    setCamError]    = useState<CamError>(null)
  const [scanOk,      setScanOk]      = useState(false)  // highlight xanh khi quét thành công
  const [manualMode,  setManualMode]  = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [uploading,   setUploading]   = useState(false)  // đang đọc QR từ ảnh tải lên

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

    if (isInAppBrowser()) {
      setCamError('in_app_browser')
      setStarting(false)
      setManualMode(true)
      return
    }

    calledRef.current = false

    setStarting(true)

    setCamError(null)

    setScanOk(false)

    let isStarted     = false
    let cleanupCalled = false

    // 🐞 SỬA: Safari (đặc biệt qua HTTP/IP nội bộ, không phải HTTPS hoặc localhost)
    // không cấp `navigator.mediaDevices` — gọi getUserMedia khi đó throw lỗi ĐỒNG BỘ
    // ngay trong html5-qrcode (không phải reject promise), nên .catch() ở dưới không
    // bắt được → lỗi bay lên ngoài effect → React crash trắng cả màn hình (không có
    // error boundary nào chặn trước đây). Kiểm tra hỗ trợ trước + bọc try/catch quanh
    // cả lệnh start() để luôn hiện màn hình lỗi thân thiện thay vì crash trắng.
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('other')
      setStarting(false)
      toast.error('Trình duyệt/kết nối này không hỗ trợ camera (cần HTTPS) — vui lòng nhập mã QR thủ công')
      return
    }

    let s: Html5Qrcode
    try {
      s = new Html5Qrcode(SCANNER_DIV_ID)
    } catch {

      setCamError('other')

      setStarting(false)
      return
    }

    try {
      s.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
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
    } catch (err) {
      // Một số lỗi (vd. trên Safari) throw đồng bộ thay vì reject promise
      if (!cleanupCalled) {
        const type = classifyError(err)
        setCamError(type)
        setStarting(false)
      }
    }

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

  // Đọc mã QR từ ảnh tải lên từ máy (thay cho camera) — dùng html5-qrcode scanFile,
  // không cần camera nên hoạt động cả khi camera bị chặn/lỗi/đang ở webview app chat.
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    let fileScanner: Html5Qrcode | undefined
    try {
      let decodedText = await decodeWithNativeBarcodeDetector(file)

      // Không dùng chung element với camera scanner đang chạy. html5-qrcode giữ
      // state theo element; hai instance trên cùng element làm scanFile thất bại.
      fileScanner = new Html5Qrcode(FILE_SCANNER_DIV_ID)
      if (!decodedText) try {
        decodedText = await fileScanner.scanFile(file, false)
      } catch {
        const crops = await createQrCropCandidates(file)
        for (const crop of crops) {
          try {
            decodedText = await fileScanner.scanFile(crop, false)
            break
          } catch {
            // Thử vùng tiếp theo cho tới khi tìm thấy QR.
          }
        }
        if (!decodedText) {
          decodedText = await decodeWithJsQr([file, ...crops])
        }
      }
      if (!decodedText) throw new Error('Không tìm thấy QR trong ảnh')
      playBeep()
      onScan(decodedText)
    } catch (error) {
      console.error('Không đọc được QR từ ảnh:', error)
      const detail = error instanceof Error ? error.message : String(error)
      toast.error(`Không đọc được mã QR: ${detail || 'không tìm thấy QR trong ảnh'}`)
    } finally {
      try { fileScanner?.clear() } catch { /* scanner chưa render thì không cần clear */ }
      setUploading(false)
    }
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

        {/* Mở trong webview app chat (Zalo, Messenger...) — camera không ổn định */}
        {camError === 'in_app_browser' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900 p-4 text-center">
            <CameraOff className="w-8 h-8 text-amber-400" />
            <p className="text-sm font-semibold text-amber-300">Đang mở trong app chat</p>
            <p className="text-xs text-gray-400">
              Camera không hoạt động ổn định khi mở từ Zalo/Messenger... Vui lòng nhấn{' '}
              <strong>•••</strong> ở góc trên/dưới và chọn <strong>Mở bằng Safari/Chrome</strong>,
              hoặc nhập mã QR thủ công bên dưới.
            </p>
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

      {/* Input ẩn dùng để chọn ảnh từ máy/thư mục */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Vùng decode file riêng, đặt ngoài màn hình để không xung đột camera scanner. */}
      <div
        id={FILE_SCANNER_DIV_ID}
        className="fixed -left-[10000px] top-0 h-[600px] w-[600px] overflow-hidden bg-white"
        aria-hidden="true"
      />

      {/* Nút tải ảnh QR lên — 🐞 SỬA: trước đây bị ẩn lúc manualMode=true (vd. khi
          "Không tìm thấy camera" tự bật manualMode), nên luôn hiện khi đang active,
          không phụ thuộc manualMode/camError vì cách này không cần camera */}
      {active && (
        <div className="flex items-center gap-4">
          {!manualMode && !camError && !starting && (
            <button onClick={() => setManualMode(true)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <KeyboardIcon className="w-3.5 h-3.5" />
              Nhập mã QR thủ công
            </button>
          )}
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600
                       disabled:opacity-50 transition-colors">
            {uploading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Upload className="w-3.5 h-3.5" />
            }
            {uploading ? 'Đang đọc ảnh...' : 'Tải ảnh QR lên từ máy'}
          </button>
        </div>
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

// Component quét QR bằng camera — html5-qrcode, xử lý race condition cleanup vs start
import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { ScanLine, CameraOff, Loader2 } from 'lucide-react'

interface QRScannerProps {
  onScan: (text: string) => void
  active: boolean
}

const SCANNER_DIV_ID = 'html5-qr-reader'

export default function QRScanner({ onScan, active }: QRScannerProps) {
  const calledRef  = useRef(false)
  const [starting, setStarting] = useState(false)
  const [camError, setCamError] = useState(false)

  useEffect(() => {
    if (!active) return

    calledRef.current = false
    setStarting(true)
    setCamError(false)

    let scanner: Html5Qrcode | null = null
    let isStarted = false       // true chỉ sau khi start() resolve thành công
    let cleanupCalled = false   // true khi effect cleanup đã chạy

    try {
      scanner = new Html5Qrcode(SCANNER_DIV_ID)
    } catch {
      setCamError(true)
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
        // Dừng scanner trước khi báo kết quả
        s.stop().catch(() => {}).finally(() => onScan(decodedText))
      },
      () => {}, // ignore per-frame scan failure
    )
      .then(() => {
        isStarted = true
        if (!cleanupCalled) setStarting(false)
        else {
          // Cleanup đã chạy trong khi đang start — dừng ngay
          s.stop().catch(() => {})
        }
      })
      .catch(() => {
        if (!cleanupCalled) {
          setCamError(true)
          setStarting(false)
        }
      })

    return () => {
      cleanupCalled = true
      // Chỉ stop khi scanner đã thực sự start xong
      if (isStarted) {
        s.stop().catch(() => {})
      }
      // Nếu chưa start xong thì block then() ở trên sẽ stop sau khi resolve
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return (
    <div className="space-y-2">
      <div className="relative bg-gray-900 rounded-xl overflow-hidden" style={{ minHeight: 200 }}>
        <div id={SCANNER_DIV_ID} className="w-full" />

        {starting && !camError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900">
            <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
            <p className="text-sm text-gray-300">Đang khởi động camera...</p>
          </div>
        )}

        {camError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900">
            <CameraOff className="w-8 h-8 text-gray-500" />
            <p className="text-sm text-gray-400">Không truy cập được camera</p>
            <p className="text-xs text-gray-500">Dùng ô nhập biển số bên dưới</p>
          </div>
        )}

        {!starting && !camError && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
            <div className="flex items-center gap-1.5 bg-black/50 text-blue-300 text-xs px-3 py-1 rounded-full">
              <ScanLine className="w-3.5 h-3.5" />
              Hướng camera vào mã QR trên vé
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

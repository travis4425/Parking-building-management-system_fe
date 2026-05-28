// Component camera LPR — hiển thị webcam thật và simulate nhận diện biển số
import { useState, useCallback } from 'react'
import Webcam from 'react-webcam'
import { Camera, Loader2, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import { MOCK_PLATES } from '@/api/mockLPR'

interface LPRResult {
  plate:      string
  confidence: number
}

interface LPRCameraProps {
  plate:       string
  onPlateChange: (plate: string) => void
}

const VIDEO_CONSTRAINTS: MediaStreamConstraints['video'] = {
  width: 640, height: 360, facingMode: 'environment',
}

export default function LPRCamera({ plate, onPlateChange }: LPRCameraProps) {
  const [cameraReady, setCameraReady]   = useState(false)
  const [cameraError, setCameraError]   = useState(false)
  const [detecting, setDetecting]       = useState(false)
  const [result, setResult]             = useState<LPRResult | null>(null)

  const handleUserMedia = useCallback(() => {
    setCameraReady(true)
    setCameraError(false)
  }, [])

  const handleUserMediaError = useCallback(() => {
    setCameraError(true)
  }, [])

  // Simulate LPR processing 1.5 giây rồi trả về biển số ngẫu nhiên
  function handleDetect() {
    setDetecting(true)
    setResult(null)
    setTimeout(() => {
      const detected = MOCK_PLATES[Math.floor(Math.random() * MOCK_PLATES.length)]
      const confidence = Math.floor(Math.random() * 15) + 85 // 85–99
      const lpr: LPRResult = { plate: detected, confidence }
      setResult(lpr)
      onPlateChange(detected)
      setDetecting(false)
    }, 1500)
  }

  function handleReset() {
    setResult(null)
    onPlateChange('')
  }

  const lowConfidence = result !== null && result.confidence < 90

  return (
    <div className="space-y-3">
      {/* Khung camera */}
      <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video">
        {!cameraError ? (
          <Webcam
            audio={false}
            videoConstraints={VIDEO_CONSTRAINTS}
            onUserMedia={handleUserMedia}
            onUserMediaError={handleUserMediaError}
            screenshotFormat="image/jpeg"
            className="w-full h-full object-cover"
            mirrored={false}
          />
        ) : (
          /* Fallback khi không có camera hoặc bị từ chối quyền */
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
            <Camera className="w-10 h-10 opacity-40" />
            <p className="text-sm">Không truy cập được camera</p>
            <p className="text-xs opacity-60">Kiểm tra quyền truy cập trình duyệt</p>
          </div>
        )}

        {/* Overlay khung ngắm khi camera sẵn sàng */}
        {cameraReady && !cameraError && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Góc khung ngắm */}
            <div className="absolute top-4 left-4 w-10 h-10 border-t-2 border-l-2 border-blue-400 rounded-tl" />
            <div className="absolute top-4 right-4 w-10 h-10 border-t-2 border-r-2 border-blue-400 rounded-tr" />
            <div className="absolute bottom-4 left-4 w-10 h-10 border-b-2 border-l-2 border-blue-400 rounded-bl" />
            <div className="absolute bottom-4 right-4 w-10 h-10 border-b-2 border-r-2 border-blue-400 rounded-br" />
            <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-blue-300 opacity-80">
              Đặt biển số vào khung
            </p>
          </div>
        )}

        {/* Scanning animation khi đang nhận diện */}
        {detecting && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-sm text-white font-medium">Đang nhận diện biển số...</p>
            {/* Scan line animation */}
            <div className="w-2/3 h-0.5 bg-blue-400/60 animate-pulse" />
          </div>
        )}
      </div>

      {/* Nút nhận diện */}
      <button
        onClick={handleDetect}
        disabled={detecting || cameraError}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                   bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                   text-white font-medium text-sm transition-colors"
      >
        {detecting
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang nhận diện...</>
          : <><Camera className="w-4 h-4" /> Nhận diện biển số</>
        }
      </button>

      {/* Kết quả LPR */}
      {result && (
        <div className={`rounded-xl border p-3 ${
          lowConfidence
            ? 'bg-amber-50 border-amber-200'
            : 'bg-emerald-50 border-emerald-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {lowConfidence
                ? <AlertTriangle className="w-4 h-4 text-amber-500" />
                : <CheckCircle className="w-4 h-4 text-emerald-600" />
              }
              <span className="text-xs font-medium text-gray-700">
                Độ tin cậy: <span className={`font-bold ${lowConfidence ? 'text-amber-600' : 'text-emerald-700'}`}>
                  {result.confidence}%
                </span>
              </span>
            </div>
            <button onClick={handleReset}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          {lowConfidence && (
            <p className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded mb-2">
              ⚠ Độ tin cậy thấp — cần xác minh thủ công
            </p>
          )}
        </div>
      )}

      {/* Input biển số — cho phép sửa tay */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
          Biển số xe
        </label>
        <input
          type="text"
          value={plate}
          onChange={(e) => onPlateChange(e.target.value.toUpperCase())}
          placeholder="Ví dụ: 51G-123.45"
          className="w-full px-3 py-2.5 text-base font-mono font-semibold tracking-wider
                     rounded-xl border border-gray-300 focus:outline-none
                     focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                     bg-white placeholder:font-normal placeholder:tracking-normal"
        />
        <p className="text-xs text-gray-400">Có thể nhập tay hoặc sửa kết quả LPR</p>
      </div>
    </div>
  )
}

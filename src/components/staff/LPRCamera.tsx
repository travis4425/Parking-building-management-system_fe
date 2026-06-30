// Component camera LPR — nhận diện biển số qua BE thật (Plate Recognizer), không còn Tesseract.js
import { useState, useCallback, useRef } from 'react'
import Webcam from 'react-webcam'
import { Camera, Loader2, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import { recognizePlate } from '@/api/aiApi'

interface LPRCameraProps {
  plate:         string
  onPlateChange: (plate: string) => void
}

const VIDEO_CONSTRAINTS: MediaStreamConstraints['video'] = {
  width:      1280,
  height:     720,
  facingMode: 'environment',
}

type DetectStatus = 'idle' | 'loading' | 'success' | 'error'

const LOW_CONFIDENCE_THRESHOLD = 60  // dưới 60% → cảnh báo nhưng vẫn hiện kết quả

export default function LPRCamera({ plate, onPlateChange }: LPRCameraProps) {
  const webcamRef     = useRef<Webcam>(null)
  const plateInputRef = useRef<HTMLInputElement>(null)

  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(false)
  const [status,      setStatus]      = useState<DetectStatus>('idle')
  const [confidence,  setConfidence]  = useState(0)

  const handleUserMedia = useCallback(() => {
    setCameraReady(true)
    setCameraError(false)
  }, [])

  const handleUserMediaError = useCallback(() => {
    setCameraError(true)
  }, [])

  async function handleDetect() {
    // Chụp frame từ webcam — lấy full data URL
    const screenshot = webcamRef.current?.getScreenshot({ width: 1280, height: 720 })
    if (!screenshot) { setStatus('error'); return }

    setStatus('loading')
    onPlateChange('')

    try {
      const result = await recognizePlate(screenshot)
      // BE không đọc được biển số (vd. ảnh mờ, hoặc chưa cấu hình API key) → để nhập tay
      if (!result.licensePlate) {
        setStatus('error')
        return
      }
      setConfidence(result.confidence)
      onPlateChange(result.licensePlate)
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  function handleReset() {
    setStatus('idle')
    setConfidence(0)
    onPlateChange('')
  }

  const lowConfidence = status === 'success' && confidence < LOW_CONFIDENCE_THRESHOLD

  return (
    <div className="space-y-3">
      {/* Khung camera */}
      <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video">
        {!cameraError ? (
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.95}
            videoConstraints={VIDEO_CONSTRAINTS}
            onUserMedia={handleUserMedia}
            onUserMediaError={handleUserMediaError}
            className="w-full h-full object-cover"
            mirrored={false}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
            <Camera className="w-10 h-10 opacity-40" />
            <p className="text-sm">Không truy cập được camera</p>
            <p className="text-xs opacity-60">Kiểm tra quyền truy cập trình duyệt</p>
          </div>
        )}

        {/* Overlay loading — đang gửi ảnh lên BE phân tích */}
        {status === 'loading' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-sm text-white font-medium">Đang nhận diện...</p>
            <p className="text-xs text-gray-300">Đang gửi ảnh lên hệ thống phân tích</p>
            <div className="w-2/3 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        )}
      </div>

      {/* Nút nhận diện — disabled khi đang xử lý hoặc camera chưa sẵn sàng */}
      <button
        onClick={handleDetect}
        disabled={status === 'loading' || cameraError || !cameraReady}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                   bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                   text-white font-medium text-sm transition-colors"
      >
        {status === 'loading'
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang nhận diện...</>
          : <><Camera className="w-4 h-4" /> Nhận diện biển số</>
        }
      </button>

      {/* Kết quả thành công */}
      {status === 'success' && (
        <div className={`rounded-xl border p-3 ${
          lowConfidence ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {lowConfidence
                ? <AlertTriangle className="w-4 h-4 text-amber-500" />
                : <CheckCircle    className="w-4 h-4 text-emerald-600" />
              }
              <span className="text-xs text-gray-600">
                Plate Recognizer •{' '}
                <span className={`font-bold ${lowConfidence ? 'text-amber-600' : 'text-emerald-700'}`}>
                  {confidence}%
                </span>
              </span>
            </div>
            <button onClick={handleReset}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-white">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          {lowConfidence && (
            <p className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded mt-2">
              ⚠ Độ chính xác thấp — vui lòng kiểm tra lại biển số bên dưới
            </p>
          )}
        </div>
      )}

      {/* Lỗi xử lý ảnh */}
      {status === 'error' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-red-700 flex-1">
            <p className="font-medium">Không thể xử lý ảnh. Nhập biển số thủ công.</p>
          </div>
          <button onClick={handleReset} className="text-red-400 hover:text-red-600">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input biển số — cho phép sửa tay */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
          Biển số xe
        </label>
        <input
          ref={plateInputRef}
          type="text"
          value={plate}
          onChange={(e) => onPlateChange(e.target.value.toUpperCase())}
          placeholder="Ví dụ: 51G-123.45"
          className="w-full px-3 py-2.5 text-base font-mono font-semibold tracking-wider
                     rounded-xl border border-gray-300 focus:outline-none
                     focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                     bg-white placeholder:font-normal placeholder:tracking-normal"
        />
        <p className="text-xs text-gray-400">Có thể sửa trực tiếp nếu nhận diện chưa đúng</p>
      </div>
    </div>
  )
}

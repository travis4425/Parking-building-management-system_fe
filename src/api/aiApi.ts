// API nhận diện biển số thật — gọi BE (proxy tới Plate Recognizer), thay cho Tesseract.js chạy client-side
import { apiClient } from './client'

export interface PlateRecognizeResult {
  licensePlate: string
  confidence:   number  // 0–100
}

// Ảnh chụp từ webcam là data URL (data:image/jpeg;base64,...) — BE nhận trực tiếp định dạng này
export async function recognizePlate(imageDataUrl: string): Promise<PlateRecognizeResult> {
  const res = await apiClient.post('/ai/plate-recognize', { image: imageDataUrl })
  const data = res.data.data as { plate?: string; plateNumber?: string; confidence?: number; confidenceScore?: number }

  return {
    licensePlate: (data.plateNumber || data.plate || '').trim(),
    // BE trả confidence dạng 0–1 (vd. 0.97) — quy đổi sang % để khớp UI hiện tại (0–100)
    confidence: Math.round((data.confidenceScore ?? data.confidence ?? 0) * 100),
  }
}

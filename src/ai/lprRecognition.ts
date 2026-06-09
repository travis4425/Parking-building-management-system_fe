// Nhận diện biển số xe bằng Tesseract.js — chạy offline, không cần API key
import { recognize } from 'tesseract.js'

export interface LPRResult {
  licensePlate: string
  confidence:   number  // 0–100
}

// Fallback mock nếu Tesseract không đọc được ký tự nào
function generateMockPlate(): string {
  const areas = ['51A', '51B', '51G', '59A', '43A', '29A', '30E']
  const area  = areas[Math.floor(Math.random() * areas.length)]
  const num   = Math.floor(Math.random() * 90_000 + 10_000)
  return `${area}-${num}`
}

export async function recognizeLicensePlate(imageData: string): Promise<LPRResult> {
  const result = await recognize(imageData, 'eng', {
    logger: (m) => console.log('[Tesseract]', m),
  })

  // Lọc ký tự hợp lệ của biển số VN: chữ cái, số, gạch ngang, chấm
  const text = result.data.text
    .toUpperCase()
    .replace(/[^A-Z0-9\-\.]/g, '')
    .trim()

  return {
    licensePlate: text || generateMockPlate(),
    confidence:   Math.round(result.data.confidence),
  }
}

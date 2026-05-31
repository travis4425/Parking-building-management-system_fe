// Khởi tạo Google Generative AI client — cấu hình chung cho tất cả module AI
import { GoogleGenerativeAI } from '@google/generative-ai'

const API_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? ''

if (!API_KEY) {
  console.warn('[Gemini] VITE_GEMINI_API_KEY chưa được cấu hình trong .env')
}

export const genAI = new GoogleGenerativeAI(API_KEY || 'missing-key')

// Model gemini-1.5-flash: nhanh, miễn phí 15 RPM / 1M token mỗi ngày
// responseMimeType: 'application/json' — Gemini trả về JSON hợp lệ, không có markdown wrapper
export const geminiFlash = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: {
    temperature:        0.3,              // Thấp → output ổn định, ít "sáng tạo" ngoài ý muốn
    responseMimeType:   'application/json',
  },
})

// Model text thông thường (không ép JSON) — dùng cho predictPeakHours, giải thích tự do
export const geminiFlashText = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: { temperature: 0.5 },
})

export const isConfigured = !!API_KEY

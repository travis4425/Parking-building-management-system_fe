// Zustand store cấu hình hệ thống — persist vào localStorage để giữ qua session
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SystemConfig {
  // ── Thông tin tòa nhà ────────────────────────────────────────────────────
  parkingName:  string
  address:      string
  phone:        string
  openTime:     string   // "HH:mm"
  closeTime:    string
  totalFloors:  number

  // ── Vận hành ─────────────────────────────────────────────────────────────
  slotPendingMinutes:       number   // AI giữ slot tối đa N phút trước khi nhả
  exitCodeMinutes:          number   // Mã ra cổng hết hạn sau N phút
  overtimeThresholdHours:   number   // Sau N giờ thì coi là quá hạn
  lostQrSurcharge:          number   // Phụ thu mất thẻ QR (VND)
  overtimeSurchargePercent: number   // Phụ thu quá hạn (% trên tổng phí)
  allowBooking:             boolean  // Cho phép đặt chỗ trước
  enableAI:                 boolean  // Bật AI gợi ý slot (tắt → thuật toán đơn giản)

  // ── IoT ──────────────────────────────────────────────────────────────────
  offlineFallbackMode: boolean  // Chế độ thủ công khi mất mạng/điện

  // ── AI ───────────────────────────────────────────────────────────────────
  geminiApiKey:           string                               // Lưu để hiện trong UI (thực tế dùng env)
  geminiModel:            'gemini-1.5-flash' | 'gemini-1.5-pro'
  lprConfidenceThreshold: number   // 50–99 — dưới ngưỡng này flag "cần xác minh"
  enablePeakPrediction:   boolean
}

export const CONFIG_DEFAULTS: SystemConfig = {
  parkingName:  'Bãi Đỗ Xe ParkingOS',
  address:      '123 Đường Nguyễn Huệ, Quận 1, TP.HCM',
  phone:        '028 3822 0000',
  openTime:     '06:00',
  closeTime:    '23:00',
  totalFloors:  3,

  slotPendingMinutes:       5,
  exitCodeMinutes:          15,
  overtimeThresholdHours:   24,
  lostQrSurcharge:          10_000,
  overtimeSurchargePercent: 20,
  allowBooking:             true,
  enableAI:                 true,

  offlineFallbackMode: false,

  geminiApiKey:           '',
  geminiModel:            'gemini-1.5-flash',
  lprConfidenceThreshold: 90,
  enablePeakPrediction:   true,
}

interface ConfigStore extends SystemConfig {
  updateConfig:    (partial: Partial<SystemConfig>) => void
  resetToDefaults: () => void
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set) => ({
      ...CONFIG_DEFAULTS,
      updateConfig:    (partial) => set((s) => ({ ...s, ...partial })),
      resetToDefaults: ()        => set(() => ({ ...CONFIG_DEFAULTS })),
    }),
    { name: 'parking-system-config' }
  )
)

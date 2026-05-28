// Module gợi ý slot tối ưu dùng Gemini API — fallback tự động nếu API lỗi hoặc không có key
import axios from 'axios'
import type { ParkingSlot, VehicleType } from '@/utils/types'

export interface SlotSuggestion {
  slotId:   string
  floor:    number
  zone:     string
  slotCode: string
  reason:   string
}

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

// Xây prompt gửi Gemini — chỉ gửi slot phù hợp loại xe để giữ prompt ngắn
function buildPrompt(
  available: Pick<ParkingSlot, 'id' | 'code' | 'floor' | 'zone'>[],
  vehicleType: VehicleType,
  entryGate: string,
): string {
  const vehicleLabels: Record<VehicleType, string> = {
    motorbike: 'xe máy', car: 'ô tô', truck: 'xe tải',
  }
  return (
    `Tôi có bãi xe 3 tầng. Dữ liệu slot trống phù hợp cho ${vehicleLabels[vehicleType]}: ` +
    `${JSON.stringify(available)}. ` +
    `Xe vào qua ${entryGate}. ` +
    `Hãy gợi ý slot tối ưu nhất (ưu tiên gần cổng vào, ít leo cầu thang) và giải thích ngắn gọn lý do (tối đa 2 câu). ` +
    `Trả về JSON thuần túy không có markdown: ` +
    `{"slotId":"...","floor":1,"zone":"A","slotCode":"A-01","reason":"..."}`
  )
}

// Fallback: slot trống đầu tiên khớp loại xe
function fallback(
  slots: ParkingSlot[],
  vehicleType: VehicleType,
): SlotSuggestion | null {
  const slot = slots.find((s) => s.status === 'available' && s.vehicleType === vehicleType)
  if (!slot) return null
  return {
    slotId:   slot.id,
    floor:    slot.floor,
    zone:     slot.zone,
    slotCode: slot.code,
    reason:   'Đây là slot trống đầu tiên phù hợp với loại xe của bạn.',
  }
}

export async function suggestSlot(
  slots:       ParkingSlot[],
  vehicleType: VehicleType,
  entryGate:   string,
): Promise<SlotSuggestion | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined

  // Tính toán slot available trước để dùng cả trong fallback
  const availableSlots = slots.filter(
    (s) => s.status === 'available' && s.vehicleType === vehicleType,
  )
  if (availableSlots.length === 0) return null

  if (!apiKey) return fallback(slots, vehicleType)

  try {
    const body = {
      contents: [{ parts: [{ text: buildPrompt(
        availableSlots.map((s) => ({ id: s.id, code: s.code, floor: s.floor, zone: s.zone })),
        vehicleType,
        entryGate,
      ) }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
    }
    const res = await axios.post(`${GEMINI_URL}?key=${apiKey}`, body, { timeout: 10_000 })
    const raw: string = res.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    // Strip markdown code fences nếu Gemini trả về
    const jsonStr = raw.replace(/```(?:json)?\n?/g, '').trim()
    const parsed = JSON.parse(jsonStr) as SlotSuggestion
    // Validate rằng slot đó thực sự available
    const valid = availableSlots.find((s) => s.id === parsed.slotId)
    if (!valid) return fallback(slots, vehicleType)
    return { ...parsed, slotCode: valid.code }
  } catch {
    return fallback(slots, vehicleType)
  }
}

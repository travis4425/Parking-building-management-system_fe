// Gợi ý slot tối ưu bằng Gemini AI SDK — fallback tự động nếu API lỗi hoặc không có key
import { geminiFlash, isConfigured } from './geminiClient'
import type { ParkingSlot, VehicleType } from '@/utils/types'

export interface SlotSuggestion {
  slotId:     string
  slotCode:   string
  floor:      number
  zone:       string
  reason:     string
  confidence: number   // 0.0 – 1.0, hiển thị thanh độ tin cậy
}

// Mô tả cổng vào để AI hiểu vị trí địa lý trong bãi xe
const GATE_DESC: Record<string, string> = {
  'gate-1': 'Cổng 1 tầng 1, gần khu A',
  'gate-2': 'Cổng 2 tầng 2, gần khu B',
  'gate-3': 'Cổng 3 tầng 2, gần khu C',
}

const VEHICLE_DESC: Record<VehicleType, string> = {
  motorbike: 'xe máy (slot nhỏ)',
  car:       'ô tô (slot vừa)',
  bicycle:   'xe đạp (slot nhỏ)',
}

// Parse JSON an toàn — xử lý cả trường hợp Gemini bọc trong markdown code block
function safeParseJSON(text: string): Record<string, unknown> | null {
  const candidates = [
    text.trim(),
    (text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? '').trim(),
    (text.match(/\{[\s\S]*\}/)?.[0] ?? '').trim(),
  ]
  for (const c of candidates) {
    if (!c) continue
    try { return JSON.parse(c) as Record<string, unknown> } catch { /* thử tiếp */ }
  }
  return null
}

// Fallback khi AI lỗi hoặc không có key — slot trống đầu tiên khớp loại xe
function fallback(slots: ParkingSlot[], vehicleType: VehicleType): SlotSuggestion | null {
  const slot = slots.find(s => s.status === 'available' && s.vehicleType === vehicleType)
  if (!slot) return null
  return {
    slotId:     slot.id,
    slotCode:   slot.code,
    floor:      slot.floor,
    zone:       slot.zone,
    reason:     'Slot trống gần nhất phù hợp với loại xe (chế độ fallback — không có kết nối AI).',
    confidence: 0.6,
  }
}

/**
 * Gợi ý slot tối ưu dùng Gemini AI SDK.
 * Tham số theo thứ tự: vehicleType, entryGate, slots — dùng trong suggestOptimalSlot().
 */
export async function suggestOptimalSlot(
  vehicleType: VehicleType,
  entryGate:   string,
  slots:        ParkingSlot[],
): Promise<SlotSuggestion | null> {
  const available = slots
    .filter(s => s.status === 'available' && s.vehicleType === vehicleType)
    .map(s => ({ id: s.id, code: s.code, floor: s.floor, zone: s.zone }))

  if (available.length === 0) return null
  if (!isConfigured) return fallback(slots, vehicleType)

  const prompt = `
Bạn là hệ thống quản lý bãi đỗ xe thông minh ParkingOS. Chọn slot tối ưu cho xe vừa vào.

THÔNG TIN XE:
- Loại xe: ${VEHICLE_DESC[vehicleType]}
- Cổng vào: ${GATE_DESC[entryGate] ?? entryGate}

SLOT TRỐNG (${available.length} slot):
${JSON.stringify(available, null, 2)}

TIÊU CHÍ (ưu tiên lần lượt):
1. Gần cổng vào nhất (cùng khu hoặc tầng tương ứng)
2. Tầng thấp hơn ưu tiên hơn
3. Phân bổ đều giữa các khu

Chọn đúng 1 slot. Trả về JSON:
{
  "slotId": "<id chính xác từ danh sách>",
  "slotCode": "<code chính xác>",
  "floor": <số tầng>,
  "zone": "<A|B|C>",
  "reason": "<lý do ngắn bằng tiếng Việt, tối đa 1 câu>",
  "confidence": <0.70 đến 0.97>
}`.trim()

  try {
    const result  = await geminiFlash.generateContent(prompt)
    const raw     = result.response.text()
    const parsed  = safeParseJSON(raw)
    if (!parsed) return fallback(slots, vehicleType)

    const matched = available.find(s => s.id === parsed.slotId || s.code === parsed.slotCode)
    if (!matched) return fallback(slots, vehicleType)

    return {
      slotId:     matched.id,
      slotCode:   matched.code,
      floor:      matched.floor,
      zone:       matched.zone,
      reason:     typeof parsed.reason     === 'string' ? parsed.reason     : 'AI đã chọn slot tối ưu.',
      confidence: typeof parsed.confidence === 'number'
        ? Math.min(0.99, Math.max(0.5, parsed.confidence))
        : 0.82,
    }
  } catch (err) {
    console.error('[Gemini] suggestOptimalSlot error:', err)
    return fallback(slots, vehicleType)
  }
}

// Alias cho CheckIn.tsx — thứ tự tham số: (slots, vehicleType, entryGate)
export async function suggestSlot(
  slots:       ParkingSlot[],
  vehicleType: VehicleType,
  entryGate:   string,
): Promise<SlotSuggestion | null> {
  return suggestOptimalSlot(vehicleType, entryGate, slots)
}

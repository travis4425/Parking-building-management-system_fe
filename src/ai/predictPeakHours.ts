// Dự báo giờ cao điểm từ lịch sử phiên đỗ xe — optional, dùng khi còn quota Gemini
import { geminiFlash, isConfigured } from './geminiClient'
import type { ParkingSession } from '@/utils/types'

export interface HourPrediction {
  hour:          number                         // 0–23
  predictedLoad: number                         // 0.0–1.0 (% công suất dự báo)
  label:         'thấp' | 'trung bình' | 'cao' | 'cao điểm'
  tip:           string                         // Gợi ý điều hành bằng tiếng Việt
}

export interface PeakForecast {
  predictions:   HourPrediction[]
  summary:       string                         // Tổng quan ngắn bằng tiếng Việt
  peakHours:     number[]                       // Các giờ được dự báo là cao điểm
  generatedAt:   string                         // ISO timestamp
}

// Tổng hợp lịch sử: đếm số lượt vào theo giờ trong ngày
function aggregateByHour(sessions: ParkingSession[]): number[] {
  const counts = new Array<number>(24).fill(0)
  for (const s of sessions) {
    const h = new Date(s.checkInTime).getHours()
    counts[h]++
  }
  return counts
}

// Chuẩn hoá về 0–1 dựa trên max
function normalize(counts: number[]): number[] {
  const max = Math.max(...counts, 1)
  return counts.map(c => c / max)
}

function labelLoad(load: number): HourPrediction['label'] {
  if (load >= 0.8) return 'cao điểm'
  if (load >= 0.55) return 'cao'
  if (load >= 0.3) return 'trung bình'
  return 'thấp'
}

// Fallback không dùng AI — chỉ dựa trên thống kê lịch sử
function fallbackForecast(sessions: ParkingSession[]): PeakForecast {
  const counts = aggregateByHour(sessions)
  const loads  = normalize(counts)
  const predictions: HourPrediction[] = loads.map((load, hour) => ({
    hour,
    predictedLoad: load,
    label: labelLoad(load),
    tip: load >= 0.8
      ? 'Chuẩn bị thêm nhân viên cho khung giờ này.'
      : load >= 0.55
        ? 'Theo dõi sát tình trạng slot trong giờ này.'
        : 'Hoạt động bình thường.',
  }))
  const peakHours = predictions.filter(p => p.label === 'cao điểm').map(p => p.hour)
  return {
    predictions,
    summary: peakHours.length > 0
      ? `Giờ cao điểm dự báo: ${peakHours.map(h => `${h}h`).join(', ')}. Khuyến nghị bố trí thêm nhân viên trong khung giờ này.`
      : 'Không có giờ cao điểm rõ ràng trong dữ liệu lịch sử.',
    peakHours,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Dự báo giờ cao điểm dùng Gemini AI.
 * Input: mảng sessions đã hoàn thành (completed/paid).
 * Output: dự báo 24 giờ kèm lý do và gợi ý điều hành.
 */
export async function predictPeakHours(
  sessions: ParkingSession[],
): Promise<PeakForecast> {
  const completed = sessions.filter(s => s.status === 'completed' || s.status === 'paid')
  if (completed.length === 0 || !isConfigured) return fallbackForecast(completed)

  const counts = aggregateByHour(completed)
  const total  = completed.length

  const prompt = `
Bạn là chuyên gia phân tích dữ liệu bãi đỗ xe. Hãy dự báo giờ cao điểm.

THỐNG KÊ LƯỢT VÀO THEO GIỜ (tổng ${total} phiên):
${counts.map((c, h) => `${String(h).padStart(2, '0')}h: ${c} lượt`).join('\n')}

Phân tích và trả về JSON dự báo cho 24 giờ (chỉ gồm những giờ có lượt vào > 0 và thêm các giờ điển hình bãi xe):
{
  "predictions": [
    { "hour": 7, "predictedLoad": 0.85, "label": "cao điểm", "tip": "Bố trí thêm nhân viên" },
    ...
  ],
  "summary": "<tổng quan ngắn 1-2 câu bằng tiếng Việt>",
  "peakHours": [7, 8, 17, 18]
}

Label phải là một trong: "thấp", "trung bình", "cao", "cao điểm".
predictedLoad: 0.0-1.0 (tỷ lệ công suất dự báo).
tip: gợi ý ngắn bằng tiếng Việt.`.trim()

  try {
    const result  = await geminiFlash.generateContent(prompt)
    const raw     = result.response.text()
    const parsed  = JSON.parse(raw) as {
      predictions: HourPrediction[]
      summary:     string
      peakHours:   number[]
    }

    if (!Array.isArray(parsed.predictions)) throw new Error('invalid response')

    // Bổ sung các giờ còn thiếu từ 0–23 bằng fallback nếu AI bỏ qua
    const fallback     = fallbackForecast(completed)
    const aiHours      = new Set(parsed.predictions.map(p => p.hour))
    const merged       = [...parsed.predictions]
    for (const fp of fallback.predictions) {
      if (!aiHours.has(fp.hour)) merged.push(fp)
    }
    merged.sort((a, b) => a.hour - b.hour)

    return {
      predictions:  merged,
      summary:      parsed.summary ?? fallback.summary,
      peakHours:    parsed.peakHours ?? [],
      generatedAt:  new Date().toISOString(),
    }
  } catch (err) {
    console.error('[Gemini] predictPeakHours error:', err)
    return fallbackForecast(completed)
  }
}

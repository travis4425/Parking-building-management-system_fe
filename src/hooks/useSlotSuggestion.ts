// Custom hook bọc logic gọi AI gợi ý slot — tập trung loading/error state, tái dùng ở nhiều trang
import { useState, useCallback } from 'react'
import { suggestOptimalSlot, type SlotSuggestion } from '@/ai/slotSuggestion'
import { useSlotStore } from '@/store/slotStore'
import type { VehicleType } from '@/utils/types'

interface UseSlotSuggestionReturn {
  suggestion: SlotSuggestion | null
  isLoading:  boolean
  error:      string | null
  suggest:    (vehicleType: VehicleType, entryGate: string) => Promise<void>
  reset:      () => void
}

export function useSlotSuggestion(): UseSlotSuggestionReturn {
  const slots = useSlotStore(s => s.slots)
  const [suggestion, setSuggestion] = useState<SlotSuggestion | null>(null)
  const [isLoading,  setIsLoading]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const suggest = useCallback(async (vehicleType: VehicleType, entryGate: string) => {
    setIsLoading(true)
    setSuggestion(null)
    setError(null)
    try {
      const result = await suggestOptimalSlot(vehicleType, entryGate, slots)
      if (result) {
        setSuggestion(result)
      } else {
        setError('Không còn slot trống phù hợp hoặc AI không phản hồi hợp lệ.')
      }
    } catch {
      setError('Lỗi kết nối Gemini AI. Kiểm tra VITE_GEMINI_API_KEY và kết nối mạng.')
    } finally {
      setIsLoading(false)
    }
  }, [slots])

  const reset = useCallback(() => {
    setSuggestion(null)
    setError(null)
  }, [])

  return { suggestion, isLoading, error, suggest, reset }
}

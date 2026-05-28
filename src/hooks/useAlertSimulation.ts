// Hook IoT simulation — tạo cảnh báo ngẫu nhiên mỗi 30 giây để giả lập tín hiệu cảm biến
import { useEffect } from 'react'
import { useAlertStore } from '@/store/alertStore'
import { ALERT_SLOT_POOL, ALERT_TEMPLATES } from '@/api/mockAlerts'
import type { AlertType } from '@/utils/types'

const ALERT_TYPES: AlertType[] = ['sensor_error', 'session_overtime', 'wrong_zone']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function useAlertSimulation(intervalMs = 30_000) {
  useEffect(() => {
    const timer = setInterval(() => {
      const type = pick(ALERT_TYPES)
      const slotCode = pick(ALERT_SLOT_POOL)
      const message = pick(ALERT_TEMPLATES[type])

      // Dùng getState() để tránh stale closure — giống pattern trong useSlotSimulation
      useAlertStore.getState().addAlert({ type, slotCode, message })
    }, intervalMs)

    return () => clearInterval(timer)
  }, [intervalMs])
}

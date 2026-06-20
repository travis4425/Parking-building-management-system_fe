// API cổng vào/ra bãi xe — nối thật với BE (GET /api/gates)
import { apiClient } from './client'

export interface BeGate {
  id: string
  name: string
  code: string
  type: 'ENTRY' | 'EXIT' | 'BOTH'
  zoneId: string
  status: string
}

let cache: BeGate[] | null = null

export async function fetchGates(): Promise<BeGate[]> {
  if (cache) return cache
  const res = await apiClient.get('/gates', { params: { limit: 100 } })
  cache = (res.data.data ?? []) as BeGate[]
  return cache
}

// Chỉ lấy cổng dùng để xe vào (ENTRY hoặc BOTH)
export async function fetchEntryGates(): Promise<BeGate[]> {
  const gates = await fetchGates()
  return gates.filter((g) => g.type === 'ENTRY' || g.type === 'BOTH')
}

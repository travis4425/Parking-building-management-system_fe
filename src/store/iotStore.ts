// Zustand store trạng thái thiết bị IoT thời gian thực — camera LPR, cảm biến, barrier
import { create } from 'zustand'

export type DeviceStatus = 'online' | 'offline' | 'warning'
export type DeviceType   = 'camera' | 'sensor' | 'barrier'

export interface IotDevice {
  id:       string
  name:     string
  type:     DeviceType
  floor?:   number
  gate?:    'A' | 'B'
  status:   DeviceStatus
  lastSeen: string   // ISO
}

interface GateState {
  open:         boolean
  lastOpenedAt: string | null
}

interface IotStore {
  devices:  IotDevice[]
  barrierA: GateState
  barrierB: GateState

  setDeviceStatus: (id: string, status: DeviceStatus) => void
  openBarrier:     (gate: 'A' | 'B') => void
  closeBarrier:    (gate: 'A' | 'B') => void
}

function ts() { return new Date().toISOString() }

const INITIAL_DEVICES: IotDevice[] = [
  // Camera LPR — nhận diện biển số, mỗi tầng 1 camera
  { id: 'cam-1',  name: 'Camera LPR Tầng 1',   type: 'camera',  floor: 1, status: 'online', lastSeen: ts() },
  { id: 'cam-2',  name: 'Camera LPR Tầng 2',   type: 'camera',  floor: 2, status: 'online', lastSeen: ts() },
  { id: 'cam-3',  name: 'Camera LPR Tầng 3',   type: 'camera',  floor: 3, status: 'online', lastSeen: ts() },
  // Cảm biến slot — phát hiện xe đỗ, khu A và khu B mỗi tầng
  { id: 'sen-1a', name: 'Cảm biến T1 Khu A',   type: 'sensor',  floor: 1, status: 'online', lastSeen: ts() },
  { id: 'sen-1b', name: 'Cảm biến T1 Khu B',   type: 'sensor',  floor: 1, status: 'online', lastSeen: ts() },
  { id: 'sen-2a', name: 'Cảm biến T2 Khu A',   type: 'sensor',  floor: 2, status: 'online', lastSeen: ts() },
  { id: 'sen-2b', name: 'Cảm biến T2 Khu B',   type: 'sensor',  floor: 2, status: 'online', lastSeen: ts() },
  { id: 'sen-3a', name: 'Cảm biến T3 Khu A',   type: 'sensor',  floor: 3, status: 'online', lastSeen: ts() },
  { id: 'sen-3b', name: 'Cảm biến T3 Khu B',   type: 'sensor',  floor: 3, status: 'online', lastSeen: ts() },
  // Barrier cổng xe
  { id: 'bar-a',  name: 'Barrier Cổng A (Vào)', type: 'barrier', gate: 'A', status: 'online', lastSeen: ts() },
  { id: 'bar-b',  name: 'Barrier Cổng B (Ra)',  type: 'barrier', gate: 'B', status: 'online', lastSeen: ts() },
]

export const useIotStore = create<IotStore>((set) => ({
  devices:  INITIAL_DEVICES,
  barrierA: { open: false, lastOpenedAt: null },
  barrierB: { open: false, lastOpenedAt: null },

  setDeviceStatus: (id, status) =>
    set((s) => ({
      devices: s.devices.map((d) =>
        d.id === id ? { ...d, status, lastSeen: ts() } : d,
      ),
    })),

  openBarrier: (gate) =>
    gate === 'A'
      ? set({ barrierA: { open: true, lastOpenedAt: ts() } })
      : set({ barrierB: { open: true, lastOpenedAt: ts() } }),

  closeBarrier: (gate) =>
    gate === 'A'
      ? set((s) => ({ barrierA: { ...s.barrierA, open: false } }))
      : set((s) => ({ barrierB: { ...s.barrierB, open: false } })),
}))

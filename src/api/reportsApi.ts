// API báo cáo & thống kê — thật từ BE (/reports/*), thay cho mockReports.ts
import { apiClient } from './client'

export interface BeZoneRef {
  id: string
  name: string
  floor: number
}

export interface RevenueReport {
  period: string
  startDate: string
  endDate: string
  totalRevenue: number
  totalSessions: number
  byZone: { zone?: BeZoneRef | null; totalSessions: number; totalRevenue: number }[]
}

export async function fetchRevenueReport(params?: {
  period?: 'day' | 'week' | 'month'
  startDate?: string
  endDate?: string
}): Promise<RevenueReport> {
  const res = await apiClient.get('/reports/revenue', { params })
  return res.data.data
}

export interface TrafficReport {
  startDate: string
  endDate: string
  hourly: { hour: number; count: number }[]
  totalVehicles: number
}

export async function fetchTrafficReport(params?: {
  startDate?: string
  endDate?: string
}): Promise<TrafficReport> {
  const res = await apiClient.get('/reports/traffic', { params })
  return res.data.data
}

export interface OccupancyReport {
  startDate: string
  endDate: string
  byZone: { zone?: BeZoneRef | null; occupiedSlots: number; totalCapacity: number; occupancyRate: number }[]
  averageOccupancy: number
}

export async function fetchOccupancyReport(params?: {
  startDate?: string
  endDate?: string
}): Promise<OccupancyReport> {
  const res = await apiClient.get('/reports/occupancy', { params })
  return res.data.data
}

export interface VehicleTypeReport {
  startDate: string
  endDate: string
  totalVehicles: number
  byVehicleType: { vehicleType?: { id: string; name: string; code: string } | null; count: number; percentage: number }[]
}

export async function fetchVehicleTypeReport(params?: {
  startDate?: string
  endDate?: string
}): Promise<VehicleTypeReport> {
  const res = await apiClient.get('/reports/vehicle-types', { params })
  return res.data.data
}

export interface PeakHoursReport {
  startDate: string
  endDate: string
  hourly: { hour: number; entries: number; exits: number; active: number }[]
  peakHours: number[]
  statistics: { totalEntries: number; totalExits: number; averageHourlyTraffic: number }
}

export async function fetchPeakHoursReport(params?: {
  startDate?: string
  endDate?: string
}): Promise<PeakHoursReport> {
  const res = await apiClient.get('/reports/peak-hours', { params })
  return res.data.data
}

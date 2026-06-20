// API quản lý tài khoản (Admin) — nối thật với BE (/api/admin/users, /api/admin/audit-logs)
import { apiClient } from './client'
import type { UserRole } from '@/utils/types'

export type BeUserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED'

export interface BeManagedUser {
  id: string
  email: string
  fullName: string | null
  phone?: string | null
  role: 'MANAGER' | 'STAFF' | 'DRIVER' | 'ADMIN'
  status: BeUserStatus
  createdAt: string
  updatedAt?: string
}

export interface FetchUsersParams {
  role?: string
  status?: string
  page?: number
  limit?: number
}

export async function fetchUsers(params?: FetchUsersParams): Promise<{ data: BeManagedUser[]; total: number }> {
  const res = await apiClient.get('/admin/users', { params })
  return { data: res.data.data, total: res.data.pagination?.total ?? res.data.data.length }
}

export async function createUserApi(payload: {
  email: string
  password: string
  fullName: string
  phone?: string
  role: UserRole
}): Promise<BeManagedUser> {
  const res = await apiClient.post('/admin/users', {
    email: payload.email,
    password: payload.password,
    fullName: payload.fullName,
    phone: payload.phone,
    role: payload.role.toUpperCase(),
  })
  return res.data.data
}

export async function updateUserStatusApi(id: string, status: BeUserStatus): Promise<BeManagedUser> {
  const res = await apiClient.patch(`/admin/users/${id}/status`, { status })
  return res.data.data
}

export async function updateUserRoleApi(id: string, role: UserRole): Promise<BeManagedUser> {
  const res = await apiClient.patch(`/admin/users/${id}/role`, { role: role.toUpperCase() })
  return res.data.data
}

// ─── Audit logs ──────────────────────────────────────────────────────────────
export interface BeAuditLog {
  id: string
  userId: string
  action: string
  resource: string
  resourceId?: string | null
  oldData?: string | null
  newData?: string | null
  ipAddress?: string | null
  createdAt: string
  user?: { email: string; fullName: string | null }
}

export async function fetchAuditLogs(params?: {
  userId?: string
  action?: string
  resource?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}): Promise<{ data: BeAuditLog[]; total: number }> {
  const res = await apiClient.get('/admin/audit-logs', { params })
  return { data: res.data.data, total: res.data.pagination?.total ?? res.data.data.length }
}

// API thật cho thanh toán — thay cho việc StaffPayment chỉ cập nhật local state.
// Khớp với BE: src/routes/payment.routes.ts (mount tại /api/payments).
import { apiClient } from './client'

export type BePaymentMethod = 'CASH' | 'QR' | 'CARD'

export interface BePayment {
  id: string
  sessionId: string
  amount: number
  paymentMethod: BePaymentMethod
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
}

// Luồng 1: thanh toán tiền mặt / quẹt thẻ tại quầy — BE đóng phiên ngay (status COMPLETED,
// giải phóng slot) và bắn socket event `payment:success`.
export async function createCashPayment(
  sessionId: string,
  amount: number,
  paymentMethod: 'CASH' | 'CARD'
): Promise<BePayment> {
  const res = await apiClient.post('/payments', { sessionId, amount, paymentMethod })
  return res.data.data as BePayment
}

// Luồng 2: tạo URL thanh toán VNPay (quét QR) — trả về link để hiển thị mã QR thật,
// chờ VNPay gọi IPN về (GET /api/payments/vnpay-ipn) rồi BE tự bắn `payment:success`.
export async function createVnpayPaymentUrl(sessionId: string, amount: number): Promise<string> {
  const res = await apiClient.post('/payments/create-url', { sessionId, amount })
  return res.data.data.paymentUrl as string
}

export async function getPaymentBySessionId(sessionId: string): Promise<BePayment> {
  const res = await apiClient.get(`/payments/${sessionId}`)
  return res.data.data as BePayment
}

export interface PaymentSummaryItem {
  paymentMethod: BePaymentMethod
  totalAmount: number
  totalTransactions: number
}

export async function getPaymentSummary(): Promise<PaymentSummaryItem[]> {
  const res = await apiClient.get('/payments/summary')
  return res.data.data as PaymentSummaryItem[]
}

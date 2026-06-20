// API client chung — dùng axios, tự động gắn Bearer token và xử lý lỗi 401
import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  timeout: 15000,
})

// Gắn token vào mọi request nếu đã đăng nhập
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Lưu ý: KHÔNG tự động logout toàn cục khi gặp 401.
// Lý do: nhiều trang gọi đồng thời nhiều API nền (slots, sessions, alerts, pricing...)
// ngay sau khi đăng nhập — nếu chỉ 1 API phụ bị lỗi 401 (BE chưa deploy đủ route,
// token tạm thời lỗi, v.v.) thì cả phiên đăng nhập hợp lệ cũng bị đá ra ngoài,
// gây cảm giác "vừa đăng nhập xong đã bị out". Để mỗi nơi gọi API tự xử lý lỗi
// 401 của riêng nó (hiển thị thông báo / yêu cầu đăng nhập lại khi cần), thay vì
// xóa session toàn cục từ một request nền không liên quan.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error)
  }
)

// Helper rút gọn lấy `data` từ response BE (luôn có dạng { success, data, ... })
export function unwrap<T>(promise: Promise<{ data: { data: T } }>): Promise<T> {
  return promise.then((res) => res.data.data)
}

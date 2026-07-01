// ErrorBoundary toàn app — chặn lỗi runtime crash trắng cả màn hình.
// Trước đây app không có error boundary nào: chỉ 1 lỗi JS chưa bắt (vd. camera
// không hỗ trợ trên Safari) là React unmount toàn bộ cây component → màn hình trắng.
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    // 🐞 SỬA: một số lỗi (đặc biệt từ webview trong-app như Zalo) throw ra string
    // hoặc object thường, không phải Error thật → error.message sẽ là undefined,
    // khiến ô hiển thị lỗi trống trơn không có thông tin gì để debug.
    const normalized = error instanceof Error ? error : new Error(String(error))
    return { error: normalized }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lỗi runtime chưa được xử lý:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="font-semibold text-gray-900">Đã có lỗi xảy ra</h2>
            <p className="text-sm text-gray-500">
              Trang gặp lỗi không mong muốn. Vui lòng tải lại trang để tiếp tục.
            </p>
            <p className="text-xs text-gray-400 font-mono break-all bg-gray-50 rounded-lg p-2">
              {this.state.error.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600
                         hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Tải lại trang
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

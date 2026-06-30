// Component animation barrier cổng xe — CSS transform xoay cần lên/xuống khi nâng/hạ
// Chỉ là hiệu ứng UI xác nhận hành động check-in/check-out thật, không gắn với thiết bị nào.
import { cn } from '@/utils/cn'

// ─── Cần barrier (phần xoay) ─────────────────────────────────────────────────
function BarrierArm({ open, compact = false }: { open: boolean; compact?: boolean }) {
  const postH  = compact ? 'h-12' : 'h-20'
  const armW   = compact ? 'w-20' : 'w-36'
  const armH   = compact ? 'h-3'  : 'h-4'
  const bottom = compact ? 48 : 80

  return (
    <div className={cn('relative select-none', compact ? 'w-28 h-16' : 'w-44 h-28')}>
      {/* Trụ đứng */}
      <div className={cn(
        'absolute bottom-0 left-5 w-3 rounded-t-sm transition-colors duration-500',
        postH,
        open ? 'bg-emerald-700' : 'bg-gray-600',
      )} />

      {/* Cần barrier — xoay origin-left -90° khi mở, 700ms ease-in-out */}
      <div
        className={cn(
          'absolute left-5 rounded-r-full overflow-hidden flex items-center',
          'transition-transform duration-700 ease-in-out',
          armW, armH,
          open ? '-rotate-90' : 'rotate-0',
        )}
        style={{
          bottom,
          background: open ? '#16a34a' : '#dc2626',
          transformOrigin: '0 50%',
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-full w-5 flex-shrink-0 opacity-40"
            style={{
              background:
                'repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(0,0,0,.3) 4px,rgba(0,0,0,.3) 8px)',
            }}
          />
        ))}
      </div>

      {/* Đường kẻ mặt đất */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded" />
    </div>
  )
}

// ─── Gate đơn — export để CheckOut dùng ──────────────────────────────────────
export interface BarrierGateProps {
  open:         boolean
  label?:       string
  lastOpened?:  string | null
  compact?:     boolean
}

export function BarrierGate({ open, label, lastOpened, compact = false }: BarrierGateProps) {
  function fmtTime(iso: string | null | undefined) {
    if (!iso) return null
    return new Date(iso).toLocaleTimeString('vi-VN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <BarrierArm open={open} compact={compact} />
      {label && <span className="text-xs font-semibold text-gray-700">{label}</span>}
      <span className={cn('text-xs font-medium', open ? 'text-emerald-600' : 'text-red-500')}>
        {open ? '● Đang mở' : '● Đóng'}
      </span>
      {lastOpened && (
        <span className="text-xs text-gray-400">Lần cuối {fmtTime(lastOpened)}</span>
      )}
    </div>
  )
}


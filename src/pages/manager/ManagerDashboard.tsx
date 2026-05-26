// Dashboard quản lý — metric cards tổng quan + IoT slot grid realtime
import { ParkingSquare, Car, Banknote, AlertTriangle, TrendingUp } from 'lucide-react'
import { cn } from '@/utils/cn'
import PageWrapper from '@/components/layout/PageWrapper'
import SlotGrid from '@/components/iot/SlotGrid'
import { useSlotSimulation } from '@/hooks/useSlotSimulation'
import { INITIAL_SLOTS, MOCK_STATS } from '@/api/mockSlots'

// ─── Kiểu dữ liệu metric card ────────────────────────────────────────────────
interface MetricCard {
  label: string
  value: string
  sub: string
  icon: React.ElementType
  color: string        // màu icon + background
  trend?: string       // badge trend (tùy chọn)
  trendUp?: boolean
}

// ─── Format tiền VND ─────────────────────────────────────────────────────────
function formatVND(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M ₫`
  }
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫'
}

export default function ManagerDashboard() {
  const { slots, lastUpdated, changedIds, stats } = useSlotSimulation(INITIAL_SLOTS)

  // Metric cards — 2 card đầu dùng stats realtime từ simulation
  const metrics: MetricCard[] = [
    {
      label: 'Slot trống',
      value: `${stats.available}`,
      sub: `/${stats.total} tổng số slot`,
      icon: ParkingSquare,
      color: 'bg-emerald-50 text-emerald-600',
      trend: `${Math.round((stats.available / stats.total) * 100)}% trống`,
      trendUp: stats.available > stats.total / 2,
    },
    {
      label: 'Lượt xe hôm nay',
      value: `${MOCK_STATS.todayVehicles}`,
      sub: 'lượt ra vào',
      icon: Car,
      color: 'bg-blue-50 text-blue-600',
      trend: '+12% so hôm qua',
      trendUp: true,
    },
    {
      label: 'Doanh thu hôm nay',
      value: formatVND(MOCK_STATS.todayRevenue),
      sub: 'tính đến thời điểm này',
      icon: Banknote,
      color: 'bg-violet-50 text-violet-600',
      trend: '+8.3% so hôm qua',
      trendUp: true,
    },
    {
      label: 'Cảnh báo',
      value: `${MOCK_STATS.activeAlerts}`,
      sub: `${stats.maintenance} slot đang bảo trì`,
      icon: AlertTriangle,
      color: MOCK_STATS.activeAlerts > 0
        ? 'bg-red-50 text-red-600'
        : 'bg-gray-50 text-gray-500',
      trend: MOCK_STATS.activeAlerts > 0 ? 'Cần xử lý' : 'Bình thường',
      trendUp: false,
    },
  ]

  return (
    <PageWrapper>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tổng quan bãi xe</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Cập nhật:{' '}
            <span className="font-medium text-gray-700">
              {lastUpdated.toLocaleTimeString('vi-VN', {
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium text-emerald-700">IoT Online</span>
        </div>
      </div>

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {metrics.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5
                       hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-start justify-between">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', card.color)}>
                <card.icon className="w-5 h-5" />
              </div>
              {card.trend && (
                <span className={cn(
                  'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                  card.trendUp
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-600',
                )}>
                  {card.trendUp ? <TrendingUp className="w-3 h-3" /> : null}
                  {card.trend}
                </span>
              )}
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{card.label}</p>
              <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Slot distribution mini bar ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Phân bổ slot</p>
          <p className="text-xs text-gray-400">{stats.total} slot tổng</p>
        </div>
        <div className="flex rounded-full overflow-hidden h-3 gap-px">
          <div
            className="bg-emerald-400 transition-all duration-700"
            style={{ width: `${(stats.available / stats.total) * 100}%` }}
            title={`Trống: ${stats.available}`}
          />
          <div
            className="bg-red-500 transition-all duration-700"
            style={{ width: `${(stats.occupied / stats.total) * 100}%` }}
            title={`Có xe: ${stats.occupied}`}
          />
          <div
            className="bg-yellow-400 transition-all duration-700"
            style={{ width: `${(stats.reserved / stats.total) * 100}%` }}
            title={`Đặt trước: ${stats.reserved}`}
          />
          <div
            className="bg-gray-300 transition-all duration-700"
            style={{ width: `${(stats.maintenance / stats.total) * 100}%` }}
            title={`Bảo trì: ${stats.maintenance}`}
          />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2.5">
          {[
            { label: 'Trống',      value: stats.available,   color: 'bg-emerald-400' },
            { label: 'Có xe',     value: stats.occupied,    color: 'bg-red-500'     },
            { label: 'Đặt trước', value: stats.reserved,    color: 'bg-yellow-400'  },
            { label: 'Bảo trì',   value: stats.maintenance, color: 'bg-gray-300'    },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className={cn('w-2.5 h-2.5 rounded-sm', color)} />
              {label}: <span className="font-semibold">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── IoT Slot Grid ── */}
      <SlotGrid
        slots={slots}
        lastUpdated={lastUpdated}
        changedIds={changedIds}
        floors={[1, 2, 3]}
      />
    </PageWrapper>
  )
}

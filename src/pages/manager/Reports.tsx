// Trang báo cáo thống kê: doanh thu, lưu lượng xe, tỷ lệ lấp đầy theo tầng + xuất Excel
import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import * as XLSX from 'xlsx'
import {
  HOURLY_TRAFFIC,
  REVENUE_7DAYS,
  FLOOR_OCCUPANCY,
  PERIOD_STATS,
} from '@/api/mockReports'

// Loại khoảng thời gian để lọc số liệu
type Period = 'today' | 'week' | 'month'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'week',  label: '7 ngày qua' },
  { value: 'month', label: 'Tháng này' },
]

// Format số tiền VND gọn (vd: 4.250.000)
function formatVND(n: number) {
  return n.toLocaleString('vi-VN') + ' ₫'
}

// Format số tiền dạng rút gọn cho axis (vd: 6.75tr)
function shortVND(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'tr'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k'
  return String(n)
}

type TooltipProps = { active?: boolean; payload?: { value: number }[]; label?: string }

// Tooltip tùy chỉnh cho biểu đồ doanh thu
function RevenueTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-blue-600">Doanh thu: {formatVND(payload[0]?.value ?? 0)}</p>
      {payload[1] && (
        <p className="text-emerald-600">Lượt xe: {payload[1].value}</p>
      )}
    </div>
  )
}

// Tooltip cho biểu đồ lưu lượng theo giờ
function TrafficTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700">{label}</p>
      <p className="text-indigo-600">Lượt xe: {payload[0]?.value}</p>
    </div>
  )
}

export default function Reports() {
  const [period, setPeriod] = useState<Period>('today')

  // Số liệu metric cards theo khoảng thời gian đã chọn
  const stats = useMemo(() => PERIOD_STATS[period], [period])

  // Xuất Excel — ghi 3 sheet: Lưu lượng giờ, Doanh thu 7 ngày, Lấp đầy tầng
  function handleExportExcel() {
    const wb = XLSX.utils.book_new()

    // Sheet 1: Lưu lượng theo giờ
    const trafficData = HOURLY_TRAFFIC.map((r) => ({
      'Giờ': r.hour,
      'Số lượt xe': r.vehicles,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trafficData), 'Lưu lượng giờ')

    // Sheet 2: Doanh thu 7 ngày
    const revenueData = REVENUE_7DAYS.map((r) => ({
      'Ngày': r.date,
      'Doanh thu (VND)': r.revenue,
      'Số lượt xe': r.vehicles,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(revenueData), 'Doanh thu 7 ngày')

    // Sheet 3: Tỷ lệ lấp đầy tầng
    const occupancyData = FLOOR_OCCUPANCY.map((r) => ({
      'Tầng': r.floor,
      'Đã có xe': r.occupied,
      'Tổng slot': r.total,
      'Tỷ lệ (%)': r.rate,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(occupancyData), 'Lấp đầy tầng')

    XLSX.writeFile(wb, `BaoCao_BaiXe_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success('Đang tải file xuống...')
  }

  return (
    <div className="space-y-6">
      {/* Header + bộ lọc thời gian + nút xuất */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo thống kê</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tổng hợp doanh thu và lưu lượng xe</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Dropdown chọn khoảng thời gian */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {/* Nút xuất Excel */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
            </svg>
            Xuất Excel
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Tổng doanh thu"
          value={formatVND(stats.revenue)}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="blue"
        />
        <MetricCard
          title="Tổng lượt xe"
          value={stats.vehicles.toLocaleString('vi-VN')}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l3 1 3-1 3 1" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 5h7l2 5v5h-2" />
            </svg>
          }
          color="emerald"
        />
        <MetricCard
          title="TB lượt xe / ngày"
          value={stats.avgPerDay.toLocaleString('vi-VN')}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
          color="violet"
        />
      </div>

      {/* Row 1: Biểu đồ lưu lượng theo giờ (BarChart) */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Lưu lượng xe theo giờ trong ngày
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={HOURLY_TRAFFIC} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 11 }}
              interval={1}
              tickFormatter={(v) => v.replace(':00', 'h')}
            />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip content={<TrafficTooltip />} />
            <Bar dataKey="vehicles" name="Lượt xe" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Row 2: Tỷ lệ lấp đầy theo tầng (progress bars) */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Tỷ lệ lấp đầy theo tầng
        </h2>
        <div className="space-y-5">
          {FLOOR_OCCUPANCY.map((floor) => (
            <div key={floor.floor}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium text-gray-700">{floor.floor}</span>
                <span className="text-gray-500">
                  {floor.occupied}/{floor.total} slot —{' '}
                  <span className={
                    floor.rate >= 80 ? 'text-red-600 font-semibold' :
                    floor.rate >= 50 ? 'text-amber-600 font-semibold' :
                    'text-emerald-600 font-semibold'
                  }>
                    {floor.rate}%
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${
                    floor.rate >= 80 ? 'bg-red-500' :
                    floor.rate >= 50 ? 'bg-amber-400' :
                    'bg-emerald-500'
                  }`}
                  style={{ width: `${floor.rate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {/* Chú thích màu */}
        <div className="flex items-center gap-5 mt-5 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            Dưới 50%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
            50–79%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
            Từ 80%
          </span>
        </div>
      </div>

      {/* Row 3: Biểu đồ doanh thu 7 ngày (LineChart) */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Doanh thu 7 ngày gần nhất
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={REVENUE_7DAYS} margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis
              yAxisId="revenue"
              tick={{ fontSize: 11 }}
              tickFormatter={shortVND}
              width={52}
            />
            <YAxis
              yAxisId="vehicles"
              orientation="right"
              tick={{ fontSize: 11 }}
              allowDecimals={false}
              width={36}
            />
            <Tooltip content={<RevenueTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(v) => v === 'revenue' ? 'Doanh thu' : 'Lượt xe'}
            />
            <Line
              yAxisId="revenue"
              type="monotone"
              dataKey="revenue"
              name="revenue"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#3b82f6' }}
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="vehicles"
              type="monotone"
              dataKey="vehicles"
              name="vehicles"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={{ r: 3, fill: '#10b981' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Component metric card tái sử dụng
function MetricCard({
  title, value, icon, color,
}: {
  title: string
  value: string
  icon: React.ReactNode
  color: 'blue' | 'emerald' | 'violet'
}) {
  const colorMap = {
    blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    border: 'border-blue-100' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100' },
    violet:  { bg: 'bg-violet-50',  icon: 'text-violet-600',  border: 'border-violet-100' },
  }
  const c = colorMap[color]
  return (
    <div className={`bg-white rounded-xl border ${c.border} p-5 flex items-center gap-4`}>
      <div className={`${c.bg} ${c.icon} p-3 rounded-xl`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{title}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  )
}

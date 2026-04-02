import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid'
import { Line, LineChart, ResponsiveContainer } from 'recharts'

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  trend?: number[]
  icon?: React.ReactNode
  format?: 'currency' | 'percentage' | 'number' | 'multiplier'
}

export default function KPICard({
  title,
  value,
  change,
  trend,
  icon,
  format = 'number'
}: KPICardProps) {
  const isPositive = change !== undefined && change >= 0
  const trendData = trend?.map((val, idx) => ({ value: val, index: idx })) || []

  const formatValue = (val: string | number): string => {
    if (typeof val === 'string') return val

    switch (format) {
      case 'currency':
        return `$${(val / 1000000).toFixed(1)}M`
      case 'percentage':
        return `${val.toFixed(1)}%`
      case 'multiplier':
        return `${val.toFixed(1)}x`
      default:
        return val.toLocaleString()
    }
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <p className="text-lg font-normal text-gray-700 mb-2">{title}</p>
          <p className="text-3xl font-normal font-heading text-gray-900">{formatValue(value)}</p>

          {change !== undefined && (
            <div className="flex items-center mt-3">
              {isPositive ? (
                <ArrowUpIcon className="h-4 w-4 text-data-green" />
              ) : (
                <ArrowDownIcon className="h-4 w-4 text-accent-red" />
              )}
              <span className={`text-sm ml-1 font-medium ${
                isPositive ? 'text-data-green' : 'text-accent-red'
              }`}>
                {Math.abs(change).toFixed(1)}%
              </span>
              <span className="text-xs ml-1 opacity-75">vs last month</span>
            </div>
          )}
        </div>

        {icon && (
          <div className="text-gray-300">
            {icon}
          </div>
        )}
      </div>

      {/* Sparkline */}
      {trendData.length > 0 && (
        <div className="h-12 -mb-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

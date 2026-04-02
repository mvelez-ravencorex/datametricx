/**
 * Widget de KPI con tendencia y formato configurable
 */

import { KPIWidgetConfig, COLOR_SCHEMES } from '@/types/widgets'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid'

interface KPIWidgetProps {
  config: KPIWidgetConfig
  data?: {
    value: number
    previousValue?: number
  }
}

export default function KPIWidget({ config, data }: KPIWidgetProps) {
  const { settings } = config
  const value = data?.value ?? settings.value
  const previousValue = data?.previousValue ?? settings.previousValue

  // Calcular cambio porcentual
  const change =
    previousValue !== undefined && previousValue !== 0
      ? ((value - previousValue) / previousValue) * 100
      : 0

  const isPositive = change >= 0
  const isTrendGood =
    settings.trendType === 'up-good' ? isPositive : !isPositive

  // Formatear valor
  const formatValue = (val: number): string => {
    const formatted = val.toFixed(settings.decimals ?? 0)

    switch (settings.format) {
      case 'currency':
        return `${settings.prefix ?? '$'}${Number(formatted).toLocaleString()}`
      case 'percentage':
        return `${formatted}${settings.suffix ?? '%'}`
      case 'multiplier':
        return `${formatted}${settings.suffix ?? 'x'}`
      default:
        return `${settings.prefix ?? ''}${Number(formatted).toLocaleString()}${settings.suffix ?? ''}`
    }
  }

  // Obtener colores del esquema
  const colors = COLOR_SCHEMES[settings.colorScheme]
  const primaryColor = colors[0]

  return (
    <div className="h-full flex flex-col justify-center items-center text-center p-4">
      {/* Valor principal */}
      <div className="mb-2">
        <div
          className="text-4xl font-bold"
          style={{ color: primaryColor }}
        >
          {formatValue(value)}
        </div>
      </div>

      {/* Tendencia */}
      {settings.showTrend && previousValue !== undefined && (
        <div
          className={`flex items-center space-x-1 text-sm font-medium ${
            isTrendGood ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {isPositive ? (
            <ArrowUpIcon className="h-4 w-4" />
          ) : (
            <ArrowDownIcon className="h-4 w-4" />
          )}
          <span>{Math.abs(change).toFixed(1)}%</span>
          <span className="text-gray-500 font-normal">vs anterior</span>
        </div>
      )}

      {/* Icono (opcional) */}
      {settings.icon && (
        <div className="mt-3 opacity-20">
          <span className="text-3xl">{settings.icon}</span>
        </div>
      )}
    </div>
  )
}

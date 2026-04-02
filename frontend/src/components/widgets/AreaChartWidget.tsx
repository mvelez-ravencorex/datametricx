/**
 * Widget de gráfico de área configurable
 */

import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { AreaChartWidgetConfig, COLOR_SCHEMES } from '@/types/widgets'
import { formatXAxisValue } from '@/utils/chartFormatters'

interface AreaChartWidgetProps {
  config: AreaChartWidgetConfig
  data: unknown[]
}

export default function AreaChartWidget({ config, data }: AreaChartWidgetProps) {
  const { settings } = config

  // Obtener colores del esquema
  const colors = settings.colors || COLOR_SCHEMES[settings.colorScheme]

  // Configuración del eje X
  const xAxisFormat = settings.xAxisFormat
  const labelRotation = xAxisFormat?.labelRotation ?? 0

  // Formatter para el eje X
  const xAxisTickFormatter = useMemo(() => {
    if (!xAxisFormat || xAxisFormat.type === 'auto') {
      return undefined
    }
    return (value: unknown) => formatXAxisValue(value, xAxisFormat)
  }, [xAxisFormat])

  // Props para el tick del eje X con rotación
  const xAxisTickProps = useMemo(() => {
    const baseProps: { fill: string; fontSize: number; angle?: number; textAnchor?: 'start' | 'end' | 'middle'; dy?: number } = { fill: '#6b7280', fontSize: 12 }
    if (labelRotation !== 0) {
      baseProps.angle = labelRotation
      baseProps.textAnchor = labelRotation > 0 ? 'start' : 'end'
      baseProps.dy = Math.abs(labelRotation) > 45 ? 5 : 0
    }
    return baseProps
  }, [labelRotation])

  return (
    <ResponsiveContainer width="100%" height={settings.height || 300}>
      <AreaChart data={data}>
        {settings.showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        )}

        <XAxis
          dataKey={settings.xAxisKey}
          tick={xAxisTickProps as React.SVGProps<SVGTextElement>}
          tickLine={{ stroke: '#e5e7eb' }}
          tickFormatter={xAxisTickFormatter}
          height={Math.abs(labelRotation) > 30 ? 60 : 30}
        />

        <YAxis
          tick={{ fill: '#6b7280', fontSize: 12 }}
          tickLine={{ stroke: '#e5e7eb' }}
        />

        {settings.showTooltip && (
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
            }}
          />
        )}

        {settings.showLegend && (
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            iconType="rect"
          />
        )}

        <Area
          type={settings.curved ? 'monotone' : 'linear'}
          dataKey={settings.yAxisKey}
          stroke={colors[0]}
          strokeWidth={2}
          fill={colors[0]}
          fillOpacity={settings.opacity ?? 0.3}
          stackId={settings.stacked ? 'stack' : undefined}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

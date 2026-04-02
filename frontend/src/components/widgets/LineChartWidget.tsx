/**
 * Widget de gráfico de líneas configurable
 */

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { LineChartWidgetConfig, COLOR_SCHEMES } from '@/types/widgets'
import { formatXAxisValue } from '@/utils/chartFormatters'

interface LineChartWidgetProps {
  config: LineChartWidgetConfig
  data: unknown[]
}

export default function LineChartWidget({ config, data }: LineChartWidgetProps) {
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
      <LineChart data={data}>
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
            iconType="line"
          />
        )}

        <Line
          type={settings.curved ? 'monotone' : 'linear'}
          dataKey={settings.yAxisKey}
          stroke={colors[0]}
          strokeWidth={2}
          dot={settings.showDots}
          fill={settings.fillArea ? colors[0] : 'none'}
          fillOpacity={settings.fillArea ? 0.2 : 0}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

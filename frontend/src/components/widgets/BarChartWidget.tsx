/**
 * Widget de gráfico de barras configurable
 */

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { BarChartWidgetConfig, COLOR_SCHEMES } from '@/types/widgets'
import { formatXAxisValue } from '@/utils/chartFormatters'

interface BarChartWidgetProps {
  config: BarChartWidgetConfig
  data: unknown[]
}

export default function BarChartWidget({ config, data }: BarChartWidgetProps) {
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
      <BarChart
        data={data}
        layout={settings.orientation === 'horizontal' ? 'horizontal' : 'vertical'}
      >
        {settings.showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        )}

        {settings.orientation === 'vertical' ? (
          <>
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
          </>
        ) : (
          <>
            <XAxis
              type="number"
              tick={{ fill: '#6b7280', fontSize: 12 }}
              tickLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              dataKey={settings.xAxisKey}
              type="category"
              tick={xAxisTickProps as React.SVGProps<SVGTextElement>}
              tickLine={{ stroke: '#e5e7eb' }}
              tickFormatter={xAxisTickFormatter}
              width={Math.abs(labelRotation) > 30 ? 100 : 60}
            />
          </>
        )}

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

        <Bar
          dataKey={settings.yAxisKey}
          fill={colors[0]}
          radius={[4, 4, 0, 0]}
          maxBarSize={50}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

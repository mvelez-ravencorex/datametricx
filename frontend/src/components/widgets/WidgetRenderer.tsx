/**
 * Renderer que selecciona y renderiza el widget correcto según el tipo
 */

import { WidgetConfig } from '@/types/widgets'
import WidgetContainer from './WidgetContainer'
import KPIWidget from './KPIWidget'
import LineChartWidget from './LineChartWidget'
import BarChartWidget from './BarChartWidget'
import AreaChartWidget from './AreaChartWidget'
import TableWidget from './TableWidget'

interface WidgetRendererProps {
  config: WidgetConfig
  data?: unknown
  onRefresh?: () => void
  onConfigure?: () => void
  onDelete?: () => void
  isLoading?: boolean
  error?: string
  isEditMode?: boolean
}

export default function WidgetRenderer({
  config,
  data,
  onRefresh,
  onConfigure,
  onDelete,
  isLoading,
  error,
  isEditMode
}: WidgetRendererProps) {
  const renderWidgetContent = () => {
    switch (config.type) {
      case 'kpi':
        return <KPIWidget config={config} data={data as { value: number; previousValue?: number }} />

      case 'line-chart':
        return <LineChartWidget config={config} data={(data as unknown[]) || []} />

      case 'bar-chart':
        return <BarChartWidget config={config} data={(data as unknown[]) || []} />

      case 'area-chart':
        return <AreaChartWidget config={config} data={(data as unknown[]) || []} />

      case 'table':
        return <TableWidget config={config} data={(data as Record<string, unknown>[]) || []} />

      case 'metric-card':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-2">
                {config.settings.metric}
              </div>
              <div className="text-sm text-gray-500">Metric Card</div>
            </div>
          </div>
        )

      case 'progress-bar':
        return (
          <div className="flex items-center justify-center h-full px-8">
            <div className="w-full">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {config.settings.label}
                </span>
                <span className="text-sm font-medium text-gray-700">
                  {config.settings.current} / {config.settings.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-primary-blue h-3 rounded-full transition-all duration-300"
                  style={{
                    width: `${(config.settings.current / config.settings.total) * 100}%`
                  }}
                />
              </div>
            </div>
          </div>
        )

      case 'text':
        return (
          <div
            className="h-full flex items-center justify-center p-4"
            style={{
              fontSize:
                config.settings.fontSize === 'small'
                  ? '14px'
                  : config.settings.fontSize === 'large'
                  ? '24px'
                  : config.settings.fontSize === 'xlarge'
                  ? '32px'
                  : '16px',
              fontWeight: config.settings.fontWeight,
              textAlign: config.settings.textAlign,
              color: config.settings.color,
              backgroundColor: config.settings.backgroundColor
            }}
          >
            {config.settings.markdown ? (
              <div dangerouslySetInnerHTML={{ __html: config.settings.content }} />
            ) : (
              config.settings.content
            )}
          </div>
        )

      default:
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <div className="text-sm font-medium mb-1">
                Widget tipo: {config.type}
              </div>
              <p className="text-xs">No implementado aún</p>
            </div>
          </div>
        )
    }
  }

  return (
    <WidgetContainer
      config={config}
      onRefresh={onRefresh}
      onConfigure={onConfigure}
      onDelete={onDelete}
      isLoading={isLoading}
      error={error}
      isEditMode={isEditMode}
    >
      {renderWidgetContent()}
    </WidgetContainer>
  )
}

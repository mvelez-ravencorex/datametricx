/**
 * Catálogo de widgets disponibles para agregar al dashboard
 */

import { WidgetTemplate, WidgetType } from '@/types/widgets'
import {
  ChartBarIcon,
  ChartPieIcon,
  TableCellsIcon,
  ArrowTrendingUpIcon,
  Square3Stack3DIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'

interface WidgetCatalogProps {
  isOpen: boolean
  onClose: () => void
  onSelectWidget: (template: WidgetTemplate) => void
}

// Templates de widgets predefinidos
const WIDGET_TEMPLATES: WidgetTemplate[] = [
  {
    id: 'kpi-revenue',
    name: 'KPI - Ingresos',
    description: 'Muestra ingresos totales con tendencia',
    type: 'kpi',
    icon: '💰',
    category: 'analytics',
    defaultConfig: {
      title: 'Ingresos Totales',
      type: 'kpi',
      dataSource: 'mock',
      visible: true,
      layout: { i: '', x: 0, y: 0, w: 4, h: 2 },
      settings: {
        value: 0,
        format: 'currency',
        showTrend: true,
        trendType: 'up-good',
        colorScheme: 'blue',
        decimals: 0
      }
    }
  },
  {
    id: 'line-chart-sales',
    name: 'Gráfico de Líneas',
    description: 'Visualiza tendencias a lo largo del tiempo',
    type: 'line-chart',
    icon: '📈',
    category: 'analytics',
    defaultConfig: {
      title: 'Ventas en el Tiempo',
      type: 'line-chart',
      dataSource: 'mock',
      visible: true,
      layout: { i: '', x: 0, y: 0, w: 8, h: 3 },
      settings: {
        dataKey: 'sales',
        xAxisKey: 'month',
        yAxisKey: 'value',
        showGrid: true,
        showLegend: true,
        showTooltip: true,
        curved: true,
        colorScheme: 'blue',
        height: 300,
        showDots: true,
        fillArea: false
      }
    }
  },
  {
    id: 'bar-chart-comparison',
    name: 'Gráfico de Barras',
    description: 'Compara valores entre categorías',
    type: 'bar-chart',
    icon: '📊',
    category: 'analytics',
    defaultConfig: {
      title: 'Comparación por Categoría',
      type: 'bar-chart',
      dataSource: 'mock',
      visible: true,
      layout: { i: '', x: 0, y: 0, w: 6, h: 3 },
      settings: {
        dataKey: 'value',
        xAxisKey: 'category',
        yAxisKey: 'value',
        orientation: 'vertical',
        showGrid: true,
        showLegend: false,
        showTooltip: true,
        colorScheme: 'green',
        height: 300
      }
    }
  },
  {
    id: 'table-data',
    name: 'Tabla de Datos',
    description: 'Muestra datos tabulares con búsqueda y ordenamiento',
    type: 'table',
    icon: '📋',
    category: 'analytics',
    defaultConfig: {
      title: 'Tabla de Datos',
      type: 'table',
      dataSource: 'mock',
      visible: true,
      layout: { i: '', x: 0, y: 0, w: 12, h: 4 },
      settings: {
        columns: [
          { key: 'name', label: 'Nombre', sortable: true, align: 'left' },
          { key: 'value', label: 'Valor', sortable: true, format: 'number', align: 'right' }
        ],
        pagination: true,
        pageSize: 10,
        searchable: true,
        exportable: true,
        striped: true,
        hoverable: true,
        compact: false
      }
    }
  },
  {
    id: 'metric-card',
    name: 'Tarjeta de Métrica',
    description: 'Muestra una métrica con progreso hacia objetivo',
    type: 'metric-card',
    icon: '🎯',
    category: 'analytics',
    defaultConfig: {
      title: 'Métrica',
      type: 'metric-card',
      dataSource: 'mock',
      visible: true,
      layout: { i: '', x: 0, y: 0, w: 3, h: 2 },
      settings: {
        metric: 'Conversiones',
        value: 0,
        format: 'number',
        showProgress: true,
        colorScheme: 'purple'
      }
    }
  },
  {
    id: 'progress-bar',
    name: 'Barra de Progreso',
    description: 'Visualiza progreso hacia una meta',
    type: 'progress-bar',
    icon: '📶',
    category: 'analytics',
    defaultConfig: {
      title: 'Progreso',
      type: 'progress-bar',
      dataSource: 'mock',
      visible: true,
      layout: { i: '', x: 0, y: 0, w: 6, h: 1 },
      settings: {
        label: 'Objetivo del Mes',
        current: 0,
        total: 100,
        format: 'percentage',
        showLabel: true,
        showValue: true,
        colorScheme: 'green',
        height: 40,
        animated: true
      }
    }
  },
  {
    id: 'text-widget',
    name: 'Widget de Texto',
    description: 'Agrega texto o contenido markdown',
    type: 'text',
    icon: '📝',
    category: 'custom',
    defaultConfig: {
      title: 'Texto Personalizado',
      type: 'text',
      dataSource: 'mock',
      visible: true,
      layout: { i: '', x: 0, y: 0, w: 6, h: 2 },
      settings: {
        content: 'Escribe tu contenido aquí...',
        fontSize: 'medium',
        fontWeight: 'normal',
        textAlign: 'center',
        markdown: false
      }
    }
  }
]

export default function WidgetCatalog({
  isOpen,
  onClose,
  onSelectWidget
}: WidgetCatalogProps) {
  if (!isOpen) return null

  const getIconForType = (type: WidgetType) => {
    const icons = {
      'kpi': ArrowTrendingUpIcon,
      'line-chart': ChartBarIcon,
      'bar-chart': ChartBarIcon,
      'pie-chart': ChartPieIcon,
      'area-chart': ChartBarIcon,
      'table': TableCellsIcon,
      'metric-card': Square3Stack3DIcon,
      'progress-bar': ChartBarIcon,
      'gauge': ChartPieIcon,
      'text': DocumentTextIcon,
      'image': DocumentTextIcon
    }
    return icons[type] || Square3Stack3DIcon
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-white rounded-lg shadow-2xl max-h-[80vh] overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              Agregar Widget al Dashboard
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Selecciona un widget para agregarlo a tu dashboard
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {WIDGET_TEMPLATES.map((template) => {
                const Icon = getIconForType(template.type)

                return (
                  <button
                    key={template.id}
                    onClick={() => {
                      onSelectWidget(template)
                      onClose()
                    }}
                    className="relative p-4 border-2 border-gray-200 rounded-lg hover:border-primary-blue hover:shadow-md transition-all text-left group"
                  >
                    {/* Icon & Badge */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="text-2xl">{template.icon}</div>
                        <Icon className="h-5 w-5 text-gray-400 group-hover:text-primary-blue transition-colors" />
                      </div>
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {template.category}
                      </span>
                    </div>

                    {/* Content */}
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {template.name}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {template.description}
                    </p>

                    {/* Hover indicator */}
                    <div className="absolute inset-0 border-2 border-primary-blue rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

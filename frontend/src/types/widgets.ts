/**
 * Tipos para widgets configurables del dashboard
 */

import { Layout } from 'react-grid-layout'

// ===== TIPOS BASE =====

export type WidgetType =
  | 'kpi'
  | 'line-chart'
  | 'bar-chart'
  | 'pie-chart'
  | 'area-chart'
  | 'table'
  | 'metric-card'
  | 'progress-bar'
  | 'gauge'
  | 'text'
  | 'image'

export type DataSource = 'mock' | 'firestore' | 'api' | 'realtime'

export type ChartColorScheme =
  | 'blue'
  | 'green'
  | 'red'
  | 'purple'
  | 'orange'
  | 'gradient'
  | 'custom'

// ===== FORMATO DE EJES =====

export type XAxisFormatType =
  | 'auto'        // Detecta automáticamente
  | 'text'        // Texto sin formato
  | 'number'      // Formato numérico (1,234)
  | 'currency'    // Formato moneda ($1,234)
  | 'percentage'  // Formato porcentaje (12.5%)
  | 'date'        // Formato fecha
  | 'time'        // Formato hora
  | 'datetime'    // Formato fecha y hora

export type DateFormatPattern =
  | 'dd/MM/yyyy'      // 31/12/2024
  | 'MM/dd/yyyy'      // 12/31/2024
  | 'yyyy-MM-dd'      // 2024-12-31
  | 'dd MMM yyyy'     // 31 Dec 2024
  | 'MMM dd, yyyy'    // Dec 31, 2024
  | 'dd MMM'          // 31 Dec
  | 'MMM yyyy'        // Dec 2024
  | 'yyyy'            // 2024
  | 'MMM'             // Dec
  | 'custom'          // Patrón personalizado

export type TimeFormatPattern =
  | 'HH:mm'           // 14:30 (24h)
  | 'HH:mm:ss'        // 14:30:45 (24h)
  | 'hh:mm a'         // 02:30 PM (12h)
  | 'hh:mm:ss a'      // 02:30:45 PM (12h)
  | 'custom'          // Patrón personalizado

export interface XAxisFormatConfig {
  type: XAxisFormatType
  // Opciones para fecha
  datePattern?: DateFormatPattern
  customDatePattern?: string    // Si datePattern es 'custom'
  // Opciones para hora
  timePattern?: TimeFormatPattern
  customTimePattern?: string    // Si timePattern es 'custom'
  // Opciones para número/moneda
  decimals?: number
  thousandsSeparator?: boolean
  currencySymbol?: string       // Ej: '$', '€', 'S/'
  // Opciones generales
  prefix?: string
  suffix?: string
  // Rotación de etiquetas
  labelRotation?: number        // -90 a 90 grados
}

// ===== CONFIGURACIÓN BASE DE WIDGET =====

export interface BaseWidgetConfig {
  id: string
  type: WidgetType
  title: string
  description?: string
  layout: Layout
  dataSource: DataSource
  refreshInterval?: number // en segundos
  visible: boolean
  createdAt: Date
  updatedAt: Date
}

// ===== CONFIGURACIONES ESPECÍFICAS POR TIPO =====

export interface KPIWidgetConfig extends BaseWidgetConfig {
  type: 'kpi'
  settings: {
    value: number
    previousValue?: number
    format: 'number' | 'currency' | 'percentage' | 'multiplier'
    showTrend: boolean
    trendType?: 'up-good' | 'down-good'
    icon?: string
    colorScheme: ChartColorScheme
    prefix?: string
    suffix?: string
    decimals?: number
  }
}

export interface LineChartWidgetConfig extends BaseWidgetConfig {
  type: 'line-chart'
  settings: {
    dataKey: string
    xAxisKey: string
    yAxisKey: string
    showGrid: boolean
    showLegend: boolean
    showTooltip: boolean
    curved: boolean
    colorScheme: ChartColorScheme
    colors?: string[]
    height?: number
    showDots: boolean
    fillArea: boolean
    xAxisFormat?: XAxisFormatConfig
  }
}

export interface BarChartWidgetConfig extends BaseWidgetConfig {
  type: 'bar-chart'
  settings: {
    dataKey: string
    xAxisKey: string
    yAxisKey: string
    orientation: 'vertical' | 'horizontal'
    showGrid: boolean
    showLegend: boolean
    showTooltip: boolean
    colorScheme: ChartColorScheme
    colors?: string[]
    height?: number
    stacked?: boolean
    xAxisFormat?: XAxisFormatConfig
  }
}

export interface PieChartWidgetConfig extends BaseWidgetConfig {
  type: 'pie-chart'
  settings: {
    dataKey: string
    nameKey: string
    showLabels: boolean
    showLegend: boolean
    showPercentage: boolean
    colorScheme: ChartColorScheme
    colors?: string[]
    innerRadius?: number // 0-100 (0 = pie, >0 = donut)
    height?: number
  }
}

export interface AreaChartWidgetConfig extends BaseWidgetConfig {
  type: 'area-chart'
  settings: {
    dataKey: string
    xAxisKey: string
    yAxisKey: string
    showGrid: boolean
    showLegend: boolean
    showTooltip: boolean
    curved: boolean
    colorScheme: ChartColorScheme
    colors?: string[]
    height?: number
    stacked?: boolean
    opacity?: number
    xAxisFormat?: XAxisFormatConfig
  }
}

export interface TableWidgetConfig extends BaseWidgetConfig {
  type: 'table'
  settings: {
    columns: Array<{
      key: string
      label: string
      width?: string
      align?: 'left' | 'center' | 'right'
      format?: 'text' | 'number' | 'currency' | 'date' | 'percentage'
      sortable?: boolean
    }>
    pagination: boolean
    pageSize?: number
    searchable: boolean
    exportable: boolean
    striped: boolean
    hoverable: boolean
    compact: boolean
  }
}

export interface MetricCardWidgetConfig extends BaseWidgetConfig {
  type: 'metric-card'
  settings: {
    metric: string
    value: number
    target?: number
    format: 'number' | 'currency' | 'percentage'
    showProgress: boolean
    colorScheme: ChartColorScheme
    icon?: string
    subtitle?: string
  }
}

export interface ProgressBarWidgetConfig extends BaseWidgetConfig {
  type: 'progress-bar'
  settings: {
    label: string
    current: number
    total: number
    format: 'number' | 'percentage'
    showLabel: boolean
    showValue: boolean
    colorScheme: ChartColorScheme
    height?: number
    animated?: boolean
  }
}

export interface GaugeWidgetConfig extends BaseWidgetConfig {
  type: 'gauge'
  settings: {
    value: number
    min: number
    max: number
    format: 'number' | 'percentage'
    showValue: boolean
    showMinMax: boolean
    colorScheme: ChartColorScheme
    thresholds?: Array<{
      value: number
      color: string
      label?: string
    }>
  }
}

export interface TextWidgetConfig extends BaseWidgetConfig {
  type: 'text'
  settings: {
    content: string
    fontSize: 'small' | 'medium' | 'large' | 'xlarge'
    fontWeight: 'normal' | 'bold'
    textAlign: 'left' | 'center' | 'right'
    color?: string
    backgroundColor?: string
    markdown: boolean
  }
}

export interface ImageWidgetConfig extends BaseWidgetConfig {
  type: 'image'
  settings: {
    src: string
    alt: string
    fit: 'cover' | 'contain' | 'fill' | 'none'
    position: 'center' | 'top' | 'bottom' | 'left' | 'right'
    showCaption: boolean
    caption?: string
    link?: string
  }
}

// ===== UNION TYPE =====

export type WidgetConfig =
  | KPIWidgetConfig
  | LineChartWidgetConfig
  | BarChartWidgetConfig
  | PieChartWidgetConfig
  | AreaChartWidgetConfig
  | TableWidgetConfig
  | MetricCardWidgetConfig
  | ProgressBarWidgetConfig
  | GaugeWidgetConfig
  | TextWidgetConfig
  | ImageWidgetConfig

// ===== DATOS DE WIDGET =====

export interface WidgetData {
  widgetId: string
  data: unknown[]
  lastUpdate: Date
  error?: string
}

// ===== TEMPLATES DE WIDGETS =====

export interface WidgetTemplate {
  id: string
  name: string
  description: string
  type: WidgetType
  icon: string
  category: 'analytics' | 'sales' | 'marketing' | 'operations' | 'custom'
  defaultConfig: Partial<WidgetConfig>
  preview?: string
}

// ===== COLOR SCHEMES =====

export const COLOR_SCHEMES: Record<ChartColorScheme, string[]> = {
  blue: ['#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE'],
  green: ['#10B981', '#34D399', '#6EE7B7', '#D1FAE5'],
  red: ['#EF4444', '#F87171', '#FCA5A5', '#FEE2E2'],
  purple: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#EDE9FE'],
  orange: ['#F59E0B', '#FBBF24', '#FCD34D', '#FEF3C7'],
  gradient: ['#667eea', '#764ba2', '#f093fb', '#4facfe'],
  custom: []
}

// ===== HELPER TYPES =====

export interface DashboardConfig {
  id: string
  name: string
  userId: string
  widgets: WidgetConfig[]
  createdAt: Date
  updatedAt: Date
  isDefault: boolean
  shared: boolean
  theme?: 'light' | 'dark'
}

export interface WidgetPosition extends Layout {
  widgetId: string
}

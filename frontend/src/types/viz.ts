/**
 * Tipos para Visualizaciones (Viz) de DataMetricX
 * Estructura para guardar y restaurar configuraciones de visualización
 */

import { MetricFilter } from './semantic'
import { ComparisonConfig } from './comparison'

// ============================================================================
// VIZ TYPES
// ============================================================================

export type VizType = 'line' | 'column' | 'area' | 'pie' | 'single' | 'progress' | 'table' | 'scatter'

export type NumberFormat = 'auto' | 'number' | 'compact' | 'percent' | 'currency'

export type DecimalSeparator = 'dot' | 'comma'

export type LabelPosition = 'above' | 'below'

// ============================================================================
// THRESHOLD CONFIG
// ============================================================================

export interface ThresholdConfig {
  min: number | null
  max: number | null
  color: string
}

// ============================================================================
// X-AXIS FORMAT CONFIG
// ============================================================================

export interface XAxisFormatConfig {
  type: 'auto' | 'date' | 'time' | 'datetime' | 'number' | 'text'
  dateFormat?: string
  numberFormat?: string
  labelRotation?: number
}

// ============================================================================
// SELECTED FIELD (Attribute or Metric)
// ============================================================================

export interface SelectedField {
  fieldId: string
  entityId: string
  label?: string
  type?: string
  format?: string
}

// ============================================================================
// ORDER BY CONFIG
// ============================================================================

export interface OrderByConfig {
  field: string
  direction: 'ASC' | 'DESC'
}

// ============================================================================
// CHART-SPECIFIC SETTINGS
// ============================================================================

// Line Chart Settings
export interface LineChartSettings {
  showGrid: boolean
  showDots: boolean
  curved: boolean
  fillArea: boolean
}

// Column/Bar Chart Settings
export interface ColumnChartSettings {
  showGrid: boolean
  orientation: 'vertical' | 'horizontal'
  stacked: boolean
}

// Area Chart Settings
export interface AreaChartSettings {
  showGrid: boolean
  curved: boolean
  stacked: boolean
  opacity: number
}

// Pie Chart Settings
export interface PieChartSettings {
  showLabels: boolean
  showLegend: boolean
  donut: boolean
  innerRadius: number
}

// Single Value Settings
export interface SingleValueSettings {
  label: string
  labelPosition: LabelPosition
  color: string
  labelBold: boolean
  format: NumberFormat
  decimalSeparator: DecimalSeparator
  decimalPlaces: number
  useThresholds: boolean
  thresholds: ThresholdConfig[]
}

// Progress Bar Settings
export interface ProgressBarSettings {
  fontSize: number
  showValues: boolean
  useThresholds: boolean
  thresholds: ThresholdConfig[]
}

// Table Settings
export interface TableSettings {
  showHeader: boolean
  striped: boolean
  compact: boolean
  sortable: boolean
  showRowNumbers: boolean
}

// Scatter Chart Settings
export interface ScatterChartSettings {
  showGrid: boolean
  showLegend: boolean
  dotSize: number
}

// Union of all chart settings
export type ChartSettings =
  | { type: 'line'; settings: LineChartSettings }
  | { type: 'column'; settings: ColumnChartSettings }
  | { type: 'area'; settings: AreaChartSettings }
  | { type: 'pie'; settings: PieChartSettings }
  | { type: 'single'; settings: SingleValueSettings }
  | { type: 'progress'; settings: ProgressBarSettings }
  | { type: 'table'; settings: TableSettings }
  | { type: 'scatter'; settings: ScatterChartSettings }

// ============================================================================
// VIZ CONFIGURATION (Complete state to serialize)
// ============================================================================

export interface VizConfig {
  // Dataset reference
  datasetId: string

  // Selected fields
  selectedAttributes: SelectedField[]
  selectedMetrics: SelectedField[]

  // Filters
  filters: MetricFilter[]

  // Ordering
  orderBy: OrderByConfig[]

  // Row limit
  rowLimit: number

  // Visualization type and settings
  vizType: VizType
  chartSettings: ChartSettings

  // Common chart options
  colorScheme: string
  customColors?: string[]
  chartRowLimit?: number
  chartRowLimitEnabled?: boolean

  // Series configuration (colors, labels per series)
  seriesConfig?: Record<string, { label?: string; color?: string }>

  // X-Axis formatting
  xAxisFormat?: XAxisFormatConfig

  // Runtime chart settings - stored in the format used by DashboardVizData.chartSettings
  // This is used to preserve all chart settings when executing the dashboard
  runtimeChartSettings?: {
    showDataLabels: boolean
    showXGridLines: boolean
    showYGridLines: boolean
    pointStyle?: string
    pieInnerRadius?: number
    yAxisFormatType?: string
    areaFillType?: 'solid' | 'gradient'
    treatNullsAsZero?: boolean
    // Reference line Y (horizontal) for line/column/area charts
    referenceLineY?: {
      enabled: boolean
      value: number
      color: string
    }
    // Reference line X (vertical) for line/column/area charts
    referenceLineX?: {
      enabled: boolean
      value: string
      color: string
    }
  }

  // Single value settings for 'single' viz type
  singleValueSettings?: {
    label: string
    labelPosition: 'above' | 'below'
    color: string
    labelBold: boolean
    format: 'auto' | 'number' | 'compact' | 'percent' | 'currency'
    decimalSeparator: 'dot' | 'comma'
    decimalPlaces: number
  }

  // Table-specific settings
  tableSettings?: {
    fontSize: 'xs' | 'sm' | 'base' | 'lg'
    headerBg: 'white' | 'gray' | 'black'
    headerAlign: 'left' | 'center' | 'right'
    showHeader: boolean
    showRowNumbers: boolean
    striped: boolean
    showTotals: boolean
    columnWidths: Record<string, number>
  }

  // Column totals for table visualization
  columnTotals?: Record<string, number>

  // Period over Period comparison configuration
  comparisonConfig?: ComparisonConfig
}

// ============================================================================
// FIRESTORE DOCUMENTS
// ============================================================================

export interface VizDocument {
  id: string
  tenantId: string
  name: string
  description?: string
  folderId: string | null  // null = root
  config: VizConfig
  createdAt: Date
  createdBy: string
  updatedAt: Date
  updatedBy: string
  isPublic: boolean  // Si se puede compartir con URL pública
  publicToken?: string  // Token para acceso público
}

export interface FolderDocument {
  id: string
  tenantId: string
  name: string
  parentId: string | null  // null = root
  createdAt: Date
  createdBy: string
  updatedAt: Date
  isCore?: boolean  // Core folders are visible to all tenants (read-only except SysOwner)
}

// ============================================================================
// DASHBOARD ELEMENT TYPES
// ============================================================================

export type DashboardElementType = 'visualization' | 'text' | 'image' | 'menu' | 'button' | 'filter'

// Base position for all elements
export interface ElementPosition {
  x: number
  y: number
  width: number
  height: number
}

// Visualization Element - references a saved viz or embeds config directly
export interface VisualizationElement {
  type: 'visualization'
  id: string
  position: ElementPosition
  // Can either reference a saved viz by ID or embed the config directly
  vizId?: string  // Reference to saved viz
  embeddedConfig?: VizConfig  // Or embed the config directly (for dashboards that want self-contained viz)
  title?: string  // Optional override title
  showTitle?: boolean
  titleAlign?: 'left' | 'center' | 'right'  // Title alignment
}

// Text Element - rich text content
export interface TextElement {
  type: 'text'
  id: string
  position: ElementPosition
  content: string  // HTML or markdown content
  style?: {
    fontSize?: number
    fontWeight?: 'normal' | 'bold' | 'light'
    fontFamily?: string
    color?: string
    backgroundColor?: string
    textAlign?: 'left' | 'center' | 'right'
    padding?: number
  }
}

// Image Element
export interface ImageElement {
  type: 'image'
  id: string
  position: ElementPosition
  src: string  // URL or base64
  alt?: string
  fit?: 'contain' | 'cover' | 'fill' | 'none'
  borderRadius?: number
}

// Menu Element - navigation links
export interface MenuElement {
  type: 'menu'
  id: string
  position: ElementPosition
  items: {
    label: string
    link?: string  // URL or dashboard ID
    icon?: string
  }[]
  orientation: 'horizontal' | 'vertical'
  style?: {
    backgroundColor?: string
    textColor?: string
    activeColor?: string
  }
}

// Button Element
export interface ButtonElement {
  type: 'button'
  id: string
  position: ElementPosition
  label: string
  action: {
    type: 'link' | 'filter' | 'refresh' | 'export'
    target?: string  // URL for link, filter field for filter
    value?: string
  }
  style?: {
    backgroundColor?: string
    textColor?: string
    borderRadius?: number
    variant?: 'solid' | 'outline' | 'ghost'
  }
}

// Filter Element - allows users to filter dashboard data
export interface FilterElement {
  type: 'filter'
  id: string
  position: ElementPosition
  label: string
  datasetId: string  // Dataset the filter belongs to
  fieldId: string  // Field to filter on
  fieldLabel?: string  // Display label for the field
  filterType: 'select' | 'multiselect' | 'date' | 'daterange' | 'text' | 'number'
  displayType?: 'dropdown' | 'button' | 'option'  // How the filter is displayed
  defaultValue?: unknown
  currentValue?: unknown  // Current selected value
  options?: { label: string; value: unknown }[]  // For select/multiselect
  // Which visualizations this filter affects (empty = all)
  affectsElements?: string[]
  // For date filters: predefined timeframe using DateFilterOperator from semantic types
  // e.g., 'last_7_days', 'this_month', 'last_quarter', 'last_5_working_days'
  timeframe?: string
}

// Union of all dashboard elements
export type DashboardElement =
  | VisualizationElement
  | TextElement
  | ImageElement
  | MenuElement
  | ButtonElement
  | FilterElement

// ============================================================================
// DASHBOARD CONFIGURATION
// ============================================================================

export interface DashboardConfig {
  // Layout settings
  layout: {
    columns: number  // Grid columns (e.g., 12 for standard grid)
    rowHeight: number  // Base row height in pixels
    gap: number  // Gap between elements
    padding: number  // Dashboard padding
  }

  // Theme/styling
  theme: {
    backgroundColor: string
    fontFamily: string
    primaryColor: string
  }

  // Global filters that affect all visualizations
  globalFilters?: MetricFilter[]

  // All elements in the dashboard
  elements: DashboardElement[]

  // Variables/parameters that can be used across the dashboard
  variables?: {
    name: string
    type: 'string' | 'number' | 'date' | 'boolean'
    defaultValue?: unknown
  }[]
}

// Legacy widget type (keeping for backwards compatibility)
export interface DashboardWidget {
  vizId: string
  position: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface DashboardDocument {
  id: string
  tenantId: string
  name: string
  description?: string
  folderId: string | null
  config: DashboardConfig  // New: full dashboard config
  widgets?: DashboardWidget[]  // Legacy: kept for backwards compatibility
  createdAt: Date
  createdBy: string
  updatedAt: Date
  updatedBy: string
  isPublic: boolean
  publicToken?: string
  isCore?: boolean  // Core dashboards are visible to all tenants (read-only except SysOwner)
}

// ============================================================================
// DASHBOARD API TYPES
// ============================================================================

export interface CreateDashboardRequest {
  name: string
  description?: string
  folderId: string | null
  config: DashboardConfig
}

export interface UpdateDashboardRequest {
  name?: string
  description?: string
  folderId?: string | null
  config?: DashboardConfig
  isPublic?: boolean
}

export interface DashboardListItem {
  id: string
  name: string
  description?: string
  folderId: string | null
  elementCount: number
  updatedAt: Date
  updatedBy: string
  isCore?: boolean  // Core dashboards are visible to all tenants
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateVizRequest {
  name: string
  description?: string
  folderId: string | null
  config: VizConfig
}

export interface UpdateVizRequest {
  name?: string
  description?: string
  folderId?: string | null
  config?: VizConfig
  isPublic?: boolean
}

export interface CreateFolderRequest {
  name: string
  parentId: string | null
}

export interface VizListItem {
  id: string
  name: string
  description?: string
  folderId: string | null
  vizType: VizType
  datasetId: string
  updatedAt: Date
  updatedBy: string
}

export interface FolderListItem {
  id: string
  name: string
  parentId: string | null
  isCore?: boolean  // Core folders are visible to all tenants
}

export interface VizTreeNode {
  type: 'folder' | 'viz' | 'dashboard'
  id: string
  name: string
  children?: VizTreeNode[]
  vizType?: VizType
  datasetId?: string
  updatedAt?: Date
  updatedBy?: string
  isCore?: boolean  // Core items are visible to all tenants
}

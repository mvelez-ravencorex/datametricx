/**
 * Tipos para Datasets - Estructura unificada de datos de diferentes fuentes
 */

// ===== DATASET BASE =====

export interface Dataset {
  id: string
  userId: string
  name: string
  description?: string
  source: DataSource
  columns: DataColumn[]
  rows: DataRow[]
  metadata: DatasetMetadata
  createdAt: Date
  updatedAt: Date
}

// ===== DATA SOURCE =====

export type DataSourceType =
  | 'meta-ads'
  | 'google-analytics-4'
  | 'shopify'
  | 'tiendanube'
  | 'mercadolibre'
  | 'tiktok'
  | 'manual'
  | 'csv'
  | 'api'

export interface DataSource {
  type: DataSourceType
  connectionId?: string
  config?: Record<string, any>
}

// ===== COLUMNS =====

export type DataType =
  | 'string'
  | 'number'
  | 'currency'
  | 'percentage'
  | 'date'
  | 'datetime'
  | 'boolean'

export type AggregationType =
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | 'first'
  | 'last'

export interface DataColumn {
  id: string
  name: string
  displayName: string
  dataType: DataType
  aggregation?: AggregationType
  format?: string // Ej: "$0,0.00", "0.00%", "YYYY-MM-DD"
  description?: string

  // Metadata
  isMetric?: boolean // Es una métrica (KPI)
  isDimension?: boolean // Es una dimensión (para agrupar)
  isCalculated?: boolean // Es un campo calculado
  calculation?: string // Fórmula de cálculo

  // For date/time fields (dimension_groups)
  timeframe?: string // raw, time, date, week, month, quarter, year, etc.
  sourceDatatype?: 'date' | 'timestamp' | 'datetime' // Original data type in BigQuery
  baseFieldName?: string // Original field name without timeframe suffix

  // Validación
  required?: boolean
  unique?: boolean
  min?: number
  max?: number
}

// ===== ROWS =====

export type DataValue = string | number | boolean | Date | null

export interface DataRow {
  id: string
  data: Record<string, DataValue> // columnId: value
  metadata?: {
    source?: string
    entityId?: string
    entityType?: string
  }
}

// ===== METADATA =====

export interface DatasetMetadata {
  totalRows: number
  totalColumns: number
  dateRange?: {
    start: Date
    end: Date
  }
  lastRefresh?: Date
  refreshStatus?: 'idle' | 'loading' | 'error' | 'success'
  error?: string

  // Información de la fuente
  sourceEntity?: {
    type: 'campaign' | 'adset' | 'ad' | 'account' | 'property' | 'product'
    id: string
    name: string
  }
}

// ===== DATASET QUERY =====

export interface DatasetQuery {
  // Filtros
  filters?: DataFilter[]

  // Agrupación
  groupBy?: string[] // columnIds

  // Ordenamiento
  orderBy?: {
    columnId: string
    direction: 'asc' | 'desc'
  }[]

  // Paginación
  limit?: number
  offset?: number

  // Rango de fechas
  dateRange?: {
    columnId: string
    start: Date
    end: Date
  }
}

export type DateFilterOperator =
  | 'is_in_the_last'
  | 'is_on_the_day'
  | 'is_in_range'
  | 'is_before'
  | 'is_on_or_after'
  | 'is_in_the_year'
  | 'is_in_the_month'
  | 'is_this'
  | 'is_next'
  | 'is_previous'
  | 'is'
  | 'is_null'
  | 'is_any_time'
  | 'is_not_null'

export type TimeUnit =
  | 'seconds'
  | 'minutes'
  | 'hours'
  | 'days'
  | 'weeks'
  | 'months'
  | 'quarters'
  | 'years'

export interface DataFilter {
  columnId: string
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'starts_with'
    | 'ends_with'
    | 'greater_than'
    | 'less_than'
    | 'greater_or_equal'
    | 'less_or_equal'
    | 'in'
    | 'not_in'
    | 'is_null'
    | 'is_not_null'
    | DateFilterOperator
  value?: DataValue | DataValue[]
  timeUnit?: TimeUnit
}

// ===== DATASET TRANSFORMATIONS =====

export interface DatasetTransformation {
  type:
    | 'filter'
    | 'aggregate'
    | 'sort'
    | 'calculate'
    | 'pivot'
    | 'join'
  config: Record<string, any>
}

// ===== PRESET DATASETS FOR META ADS =====

/**
 * Configuración para Dataset de Campaigns
 */
export interface MetaCampaignsDatasetConfig {
  entity: 'campaigns'
  dateRange: { start: Date; end: Date }
  includeInsights?: boolean
}

/**
 * Configuración para Dataset de Performance Diario
 */
export interface MetaDailyPerformanceDatasetConfig {
  entity: 'insights'
  entityType: 'campaign' | 'adset' | 'ad'
  entityId: string
  dateRange: { start: Date; end: Date }
}

// ===== DATASET BUILDER =====

export interface DatasetBuilder {
  // Configuración
  setSource(source: DataSource): DatasetBuilder
  setDateRange(start: Date, end: Date): DatasetBuilder

  // Selección de columnas
  selectColumns(columnIds: string[]): DatasetBuilder
  addCalculatedColumn(column: DataColumn): DatasetBuilder

  // Filtros y transformaciones
  addFilter(filter: DataFilter): DatasetBuilder
  groupBy(columnIds: string[]): DatasetBuilder
  orderBy(columnId: string, direction: 'asc' | 'desc'): DatasetBuilder

  // Ejecución
  build(): Promise<Dataset>
  refresh(): Promise<Dataset>
}

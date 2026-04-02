/**
 * Tipos para la Capa Semántica de DataMetricX
 * Versión: 1.5
 */

// ============================================================================
// ATTRIBUTE (Dimensión)
// ============================================================================

export type AttributeType = 'string' | 'number' | 'date' | 'boolean' | 'location'

export interface PivotConfig {
  enabled: boolean           // Si este atributo puede usarse como pivot
  default?: boolean          // Si es el pivot por defecto del dataset
  max_values?: number        // Límite de valores únicos para pivot (ej: 12 meses)
  sort?: 'asc' | 'desc'      // Ordenamiento de valores del pivot
  format?: string            // Formato para labels del pivot (ej: "MMM YYYY" para fechas)
}

export interface SemanticAttribute {
  id: string
  label?: string
  type: AttributeType
  field?: string          // Mapeo directo a columna
  sql?: string            // SQL personalizado con {TABLE}
  primary_key?: boolean
  hidden?: boolean
  description?: string
  group?: string          // Para agrupar en UI (ej: "Fechas", "Campaña")
  pivot?: PivotConfig     // Configuración para uso como pivot en visualizaciones
}

// ============================================================================
// METRIC (Medida)
// ============================================================================

export type MetricType = 'number' | 'currency' | 'percent'

export type AggregationType =
  | 'SUM'
  | 'SUM_DISTINCT'
  | 'AVG'
  | 'AVG_DISTINCT'
  | 'COUNT'
  | 'COUNT_DISTINCT'
  | 'MIN'
  | 'MAX'
  | 'CUSTOM'

// Date filter operators for Looker-style date filtering
export type DateFilterOperator =
  | 'today' | 'yesterday'
  | 'last_7_days' | 'last_14_days' | 'last_30_days' | 'last_60_days' | 'last_90_days'
  | 'this_week' | 'this_month' | 'this_quarter' | 'this_year'
  | 'last_week' | 'last_month' | 'last_quarter' | 'last_year'

export type ComparisonOperator = '=' | '!=' | '>' | '>=' | '<' | '<='
export type TextOperator = 'contains' | 'starts_with' | 'ends_with'
export type NullOperator = 'is_null' | 'is_not_null'
export type ListOperator = 'in' | 'not_in' | 'between'

export interface MetricFilter {
  field: string
  operator: ComparisonOperator | TextOperator | NullOperator | ListOperator | DateFilterOperator
  value: string | number | boolean | (string | number)[] | null
}

export interface SemanticMetric {
  id: string
  label?: string
  type: MetricType
  sql: string             // Expresión a nivel fila
  sql_agg: AggregationType
  format?: string         // Formato Numeral.js (ej: "$0,0.00")
  hidden?: boolean
  filters?: MetricFilter[]
  group?: string          // Para agrupar en UI (ej: "Alcance", "Conversiones")
  description?: string    // Descripción de la métrica
}

// ============================================================================
// SOURCE (Origen de datos)
// ============================================================================

export interface SourcePersistence {
  strategy: 'ephemeral' | 'persistent'
  trigger?: '24_hours' | '1_hour' | 'on_demand'
  partition_by?: {
    field: string
    type: 'day' | 'month' | 'year'
  }
  table_name?: string
}

export interface EntitySource {
  type: 'table' | 'derived'
  sql_table?: string      // Para type: 'table'
  sql?: string            // Para type: 'derived'
  sql_filter?: string     // WHERE permanente
  persistence?: SourcePersistence
}

// ============================================================================
// ENTITY
// ============================================================================

export interface SemanticEntity {
  id: string
  type: 'entity'
  label: string
  description?: string
  category?: string
  subcategory?: string
  hidden?: boolean
  extends?: string        // ID de entidad padre para herencia
  source: EntitySource
  attributes: SemanticAttribute[]
  metrics: SemanticMetric[]
}

// ============================================================================
// DATASET (Relaciones / Explores)
// ============================================================================

export interface DatasetRelationship {
  entity: string
  join_type: 'left' | 'inner' | 'full'
  sql_on: string
}

export interface DatasetGovernance {
  default_filter?: string
  partition_field?: string
  max_rows?: number
}

export interface SemanticDataset {
  id: string
  type: 'dataset'
  label: string
  description?: string
  base_entity: string
  relationships: DatasetRelationship[]
  governance?: DatasetGovernance
  fields?: string[]  // Lista de campos a mostrar (entity.field_id). Si no se especifica, muestra todos
}

// ============================================================================
// FILE TREE (Para UI de Development)
// ============================================================================

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileTreeNode[]
  entityType?: 'entity' | 'dataset'  // Solo para archivos
}

export interface FileTreeResponse {
  tree: FileTreeNode[]
  providers: string[]
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ProvidersResponse {
  providers: string[]
}

export interface EntityListItem {
  id: string
  label: string
  description?: string
  category?: string
  subcategory?: string
}

export interface EntitiesListResponse {
  entities: EntityListItem[]
}

export interface EntitySchemaField {
  id: string
  label: string
  type: string
  format?: string
}

export interface EntitySchemaResponse {
  id: string
  label: string
  description?: string
  dimensions: Record<string, EntitySchemaField[]>  // Agrupado por group
  metrics: Record<string, EntitySchemaField[]>     // Agrupado por group
  total_fields: number
  visible_fields: number
}

// ============================================================================
// COMPARISON CONFIG (For Period over Period)
// ============================================================================

export type ComparisonType =
  | 'none'
  | 'same_point'
  | 'full_previous'
  | 'same_point_yoy'
  | 'full_previous_yoy'
  | 'custom'

export type MetricVariant = 'current' | 'previous' | 'delta' | 'delta_pct'

/**
 * Configuration for Period over Period comparison
 * This is sent to the backend which generates CTEs for efficient comparison
 */
export interface QueryComparisonConfig {
  enabled: boolean
  type: ComparisonType
  date_field: string
  variants: MetricVariant[]
  custom_range?: {
    start: string
    end: string
  }
}

export interface QueryRequest {
  dataset_id: string
  attributes: string[]
  metrics: string[]
  filters?: MetricFilter[]
  order_by?: { field: string; direction: 'ASC' | 'DESC' }[]
  limit?: number
  comparison?: QueryComparisonConfig
}

export interface QueryColumnInfo {
  id: string
  label: string
  type: string
  format?: string
}

/**
 * Information about the comparison query result (from backend)
 */
export interface QueryComparisonInfo {
  current_range: {
    start: string
    end: string
  }
  previous_range: {
    start: string
    end: string
  }
  offset_days: number
  variant_columns: string[]
}

export interface QueryResponse {
  success: boolean
  data: Record<string, unknown>[]
  columns: QueryColumnInfo[]
  meta: {
    row_count: number
    sql?: string
  }
  comparison_info?: QueryComparisonInfo
}

// ============================================================================
// FILE CONTENT (Para Development IDE)
// ============================================================================

export interface FileContentResponse {
  path: string
  content: SemanticEntity | SemanticDataset
  raw: string  // JSON string original
}

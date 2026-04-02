/**
 * Type definitions for Dataset Schema (JSON definitions)
 * Based on Looker/LookML patterns
 *
 * These types define the structure of dataset JSON files
 * that describe how to query and transform data from BigQuery
 */

// ==================== SOURCE ====================

export interface DatasetSource {
  type: 'bigquery' | 'firestore' | 'api'
  project?: string
  dataset?: string
  table?: string
  query?: string // For derived tables
}

// ==================== DIMENSIONS ====================

export type DimensionType = 'string' | 'number' | 'yesno'

export interface Dimension {
  name: string
  label: string
  type: DimensionType
  description?: string
  sql: string
  primary_key?: boolean
  hidden?: boolean
  group_label?: string
}

// ==================== DIMENSION GROUPS (for dates) ====================

export type TimeframeType =
  | 'raw'
  | 'time'        // Solo hora HH:MM AM/PM
  | 'datetime'    // Fecha y hora completa
  | 'date'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'day_of_week'
  | 'day_of_month'
  | 'week_of_year'
  | 'month_name'

export interface DimensionGroup {
  name: string
  label: string
  type: 'time'
  description?: string
  sql: string
  timeframes: TimeframeType[]
  convert_tz?: boolean
  datatype: 'date' | 'timestamp' | 'datetime'
  hidden?: boolean
}

// ==================== MEASURES ====================

export type MeasureType = 'sum' | 'count' | 'average' | 'min' | 'max' | 'count_distinct'

export interface Measure {
  name: string
  label: string
  type: MeasureType
  description?: string
  sql: string
  value_format?: string
  hidden?: boolean
  drill_fields?: string[]
}

// ==================== CALCULATIONS ====================

export type CalculationType = 'number' | 'string' | 'yesno'

export interface Calculation {
  name: string
  label: string
  type: CalculationType
  description?: string
  sql: string
  value_format?: string
  hidden?: boolean
}

// ==================== FILTERS ====================

export type FilterType = 'string' | 'number' | 'date' | 'yesno'
export type FilterOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'starts_with' | 'ends_with'

export interface DatasetFilter {
  name: string
  label: string
  type: FilterType
  field: string
  allowed_values?: string[]
  suggestions?: boolean
  default_value?: any
  operator?: FilterOperator
}

// ==================== DATASET SCHEMA ====================

export interface DatasetSchema {
  // Metadata
  name: string
  label: string
  description?: string
  category?: string

  // Source
  source: DatasetSource

  // Primary key
  primary_key?: string[]

  // Fields
  dimensions?: Dimension[]
  dimension_groups?: DimensionGroup[]
  measures?: Measure[]
  calculations?: Calculation[]

  // Filters
  filters?: DatasetFilter[]

  // Relations (for joins - future)
  relationships?: DatasetRelationship[]

  // Metadata
  hidden?: boolean
  required_access_grants?: string[]
}

// ==================== RELATIONSHIPS (for future joins) ====================

export type RelationshipType = 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many'

export interface DatasetRelationship {
  name: string
  type: RelationshipType
  target_dataset: string
  sql_on: string
  relationship_type?: 'inner' | 'left' | 'right' | 'full'
}

// ==================== FIELD REFERENCE ====================

/**
 * Generic field that can be a dimension, measure, or calculation
 */
export interface DatasetField {
  name: string
  label: string
  type: string
  description?: string
  sql?: string
  value_format?: string
  field_type: 'dimension' | 'dimension_group' | 'measure' | 'calculation'
  // For dimension_groups (date fields)
  timeframe?: TimeframeType
  source_datatype?: 'date' | 'timestamp' | 'datetime'
  base_field_name?: string // Original field name without timeframe suffix
}

// ==================== QUERY BUILDER ====================

/**
 * Query configuration built from dataset
 */
export interface DatasetQuery {
  dataset: string
  dimensions: string[]
  measures: string[]
  filters?: QueryFilter[]
  sorts?: QuerySort[]
  limit?: number
  offset?: number
}

export interface QueryFilter {
  field: string
  operator: FilterOperator
  value: any
}

export interface QuerySort {
  field: string
  direction: 'asc' | 'desc'
}

// ==================== HELPER TYPES ====================

/**
 * All possible field types in a dataset
 */
export type AllFieldTypes = Dimension | DimensionGroup | Measure | Calculation

/**
 * Field reference by name
 */
export interface FieldReference {
  dataset: string
  field: string
  timeframe?: TimeframeType // Only for dimension_groups
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get all fields from a dataset schema
 */
export function getAllFields(schema: DatasetSchema): DatasetField[] {
  const fields: DatasetField[] = []

  // Add dimensions
  schema.dimensions?.forEach(dim => {
    fields.push({
      name: dim.name,
      label: dim.label,
      type: dim.type,
      description: dim.description,
      sql: dim.sql,
      field_type: 'dimension'
    })
  })

  // Add dimension groups (as multiple dimensions, one per timeframe)
  schema.dimension_groups?.forEach(dimGroup => {
    dimGroup.timeframes.forEach(timeframe => {
      fields.push({
        name: `${dimGroup.name}_${timeframe}`,
        label: `${dimGroup.label} (${timeframe})`,
        type: 'string', // Dates are represented as strings
        description: dimGroup.description,
        sql: dimGroup.sql,
        field_type: 'dimension_group',
        timeframe: timeframe,
        source_datatype: dimGroup.datatype,
        base_field_name: dimGroup.name
      })
    })
  })

  // Add measures
  schema.measures?.forEach(measure => {
    fields.push({
      name: measure.name,
      label: measure.label,
      type: 'number',
      description: measure.description,
      sql: measure.sql,
      value_format: measure.value_format,
      field_type: 'measure'
    })
  })

  // Add calculations
  schema.calculations?.forEach(calc => {
    fields.push({
      name: calc.name,
      label: calc.label,
      type: calc.type,
      description: calc.description,
      sql: calc.sql,
      value_format: calc.value_format,
      field_type: 'calculation'
    })
  })

  return fields
}

/**
 * Get dimensions from schema (including timeframes)
 */
export function getDimensions(schema: DatasetSchema): DatasetField[] {
  return getAllFields(schema).filter(
    f => f.field_type === 'dimension' || f.field_type === 'dimension_group'
  )
}

/**
 * Get measures from schema
 */
export function getMeasures(schema: DatasetSchema): DatasetField[] {
  return getAllFields(schema).filter(f => f.field_type === 'measure')
}

/**
 * Get calculations from schema
 */
export function getCalculations(schema: DatasetSchema): DatasetField[] {
  return getAllFields(schema).filter(f => f.field_type === 'calculation')
}

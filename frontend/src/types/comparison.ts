/**
 * Period over Period Comparison Types
 * Sistema de comparacion de periodos para VizBuilder y Dashboard
 *
 * NOTE: The backend now handles PoP comparison with CTEs for better performance.
 * The frontend just configures and sends the comparison parameters.
 */

// Re-export types from semantic.ts to avoid duplication
export type { ComparisonType, MetricVariant, QueryComparisonConfig, QueryComparisonInfo } from './semantic'

// Import for use in this file
import type { ComparisonType, MetricVariant } from './semantic'

// ============================================================================
// COMPARISON CONFIG (Frontend State)
// ============================================================================

/**
 * Frontend state for comparison configuration.
 * This is used by VizBuilder to track the user's comparison settings.
 * It gets converted to QueryComparisonConfig before sending to the backend.
 */
export interface ComparisonConfig {
  /** Si la comparacion esta habilitada */
  enabled: boolean
  /** Tipo de comparacion */
  type: ComparisonType
  /** ID del campo fecha a usar para la comparacion (de los filtros activos) */
  dateFieldId: string
  /** Variantes de metricas habilitadas (global para todas las metricas) */
  enabledVariants: MetricVariant[]
  /** Fecha inicio para comparacion custom */
  customStartDate?: string
  /** Fecha fin para comparacion custom */
  customEndDate?: string
}

/**
 * Rango de fechas calculado (now comes from backend QueryComparisonInfo)
 * @deprecated Use QueryComparisonInfo from backend response instead
 */
export interface ComparisonDateRange {
  /** Fecha inicio del periodo actual */
  currentStart: string
  /** Fecha fin del periodo actual */
  currentEnd: string
  /** Fecha inicio del periodo de comparacion */
  previousStart: string
  /** Fecha fin del periodo de comparacion */
  previousEnd: string
}

// ============================================================================
// CONVERSION HELPER
// ============================================================================

import type { QueryComparisonConfig } from './semantic'

/**
 * Converts frontend ComparisonConfig to backend QueryComparisonConfig
 * @param config Frontend comparison config from VizBuilder state
 * @returns Backend-compatible comparison config for API request
 */
export function toQueryComparisonConfig(config: ComparisonConfig): QueryComparisonConfig | undefined {
  if (!config.enabled || config.type === 'none' || !config.dateFieldId) {
    return undefined
  }

  return {
    enabled: true,
    type: config.type,
    date_field: config.dateFieldId,
    variants: config.enabledVariants,
    custom_range: config.type === 'custom' && config.customStartDate && config.customEndDate
      ? {
          start: config.customStartDate,
          end: config.customEndDate
        }
      : undefined
  }
}

// ============================================================================
// UI LABELS
// ============================================================================

/**
 * Labels para los tipos de comparacion (UI)
 */
export const COMPARISON_TYPE_LABELS: Record<ComparisonType, { label: string; description: string }> = {
  none: {
    label: 'Sin comparar',
    description: ''
  },
  same_point: {
    label: 'Periodo anterior',
    description: 'Mismo punto del periodo anterior'
  },
  full_previous: {
    label: 'Periodo completo anterior',
    description: 'Todo el periodo previo'
  },
  same_point_yoy: {
    label: 'Año anterior (mismo punto)',
    description: 'Mismo punto del año pasado'
  },
  full_previous_yoy: {
    label: 'Año anterior (completo)',
    description: 'Periodo completo del año pasado'
  },
  custom: {
    label: 'Personalizado',
    description: 'Rango de fechas personalizado'
  }
}

/**
 * Labels para las variantes de metricas (UI)
 */
export const METRIC_VARIANT_LABELS: Record<MetricVariant, { label: string; shortLabel: string }> = {
  current: {
    label: 'Valor actual',
    shortLabel: 'Actual'
  },
  previous: {
    label: 'Valor anterior',
    shortLabel: 'Anterior'
  },
  delta: {
    label: 'Diferencia absoluta',
    shortLabel: 'Δ'
  },
  delta_pct: {
    label: 'Variacion porcentual',
    shortLabel: 'Δ%'
  }
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

/**
 * Configuracion por defecto para comparacion
 */
export const DEFAULT_COMPARISON_CONFIG: ComparisonConfig = {
  enabled: false,
  type: 'none',
  dateFieldId: '',
  enabledVariants: ['current', 'previous', 'delta_pct']
}

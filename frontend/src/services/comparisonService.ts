/**
 * Comparison Service - UI Helpers for Period over Period
 *
 * NOTE: The heavy lifting for PoP comparison is now done by the backend.
 * The backend uses CTEs in BigQuery for efficient comparison queries.
 * This file now only contains UI helper functions.
 */

import type { MetricVariant } from '@/types/comparison'

// ============================================================================
// UI HELPER FUNCTIONS
// ============================================================================

/**
 * Generates the additional column IDs for comparison
 * @param baseMetrics Base metric IDs
 * @param enabledVariants Enabled variants
 * @returns Array of column IDs
 */
export function getComparisonColumnIds(
  baseMetrics: string[],
  enabledVariants: MetricVariant[]
): string[] {
  const columns: string[] = []

  for (const metric of baseMetrics) {
    if (enabledVariants.includes('current')) {
      columns.push(`${metric}_current`)
    }
    if (enabledVariants.includes('previous')) {
      columns.push(`${metric}_previous`)
    }
    if (enabledVariants.includes('delta')) {
      columns.push(`${metric}_delta`)
    }
    if (enabledVariants.includes('delta_pct')) {
      columns.push(`${metric}_delta_pct`)
    }
  }

  return columns
}

/**
 * Generates labels for comparison columns
 */
export function getComparisonColumnLabel(
  baseLabel: string,
  variant: MetricVariant
): string {
  switch (variant) {
    case 'current':
      return `${baseLabel} (Actual)`
    case 'previous':
      return `${baseLabel} (Anterior)`
    case 'delta':
      return `${baseLabel} (Δ)`
    case 'delta_pct':
      return `${baseLabel} (Δ%)`
    default:
      return baseLabel
  }
}

/**
 * Extracts the variant from a column ID
 * @example extractVariantFromColumnId('spend_delta_pct') => { baseMetric: 'spend', variant: 'delta_pct' }
 */
export function extractVariantFromColumnId(
  columnId: string
): { baseMetric: string; variant: MetricVariant } | null {
  const suffixes: MetricVariant[] = ['delta_pct', 'delta', 'previous', 'current']

  for (const suffix of suffixes) {
    if (columnId.endsWith(`_${suffix}`)) {
      return {
        baseMetric: columnId.slice(0, -(suffix.length + 1)),
        variant: suffix
      }
    }
  }

  return null
}

/**
 * Checks if a column is a comparison variant column
 */
export function isComparisonColumn(columnId: string): boolean {
  return (
    columnId.endsWith('_current') ||
    columnId.endsWith('_previous') ||
    columnId.endsWith('_delta') ||
    columnId.endsWith('_delta_pct')
  )
}

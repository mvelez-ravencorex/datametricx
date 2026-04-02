/**
 * ComparisonSelector - UI para configurar comparacion de periodos
 * Solo se muestra cuando hay un filtro de fecha activo
 */

import { useMemo } from 'react'
import { ArrowPathIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import type {
  ComparisonConfig,
  ComparisonType,
  MetricVariant
} from '@/types/comparison'
import {
  COMPARISON_TYPE_LABELS,
  METRIC_VARIANT_LABELS
} from '@/types/comparison'
import type { MetricFilter } from '@/types/semantic'
import { isDateFilterOperator } from '@/utils/comparisonDateUtils'
import DateRangePicker from '@/components/ui/DateRangePicker'

// ============================================================================
// TYPES
// ============================================================================

interface DateFieldOption {
  fieldId: string
  label: string
}

interface ComparisonSelectorProps {
  /** Filtros activos */
  filters: MetricFilter[]
  /** Campos de fecha disponibles (de las entities) */
  dateFields: DateFieldOption[]
  /** Configuracion actual */
  config: ComparisonConfig
  /** Callback cuando cambia la configuracion */
  onChange: (config: ComparisonConfig) => void
}

// ============================================================================
// COMPARISON TYPE OPTIONS
// ============================================================================

const COMPARISON_TYPES: ComparisonType[] = [
  'none',
  'same_point',
  'full_previous',
  'same_point_yoy',
  'full_previous_yoy',
  'custom'
]

const METRIC_VARIANTS: MetricVariant[] = [
  'current',
  'previous',
  'delta',
  'delta_pct'
]

// ============================================================================
// COMPONENT
// ============================================================================

export default function ComparisonSelector({
  filters,
  dateFields,
  config,
  onChange
}: ComparisonSelectorProps) {
  // Encontrar filtros de fecha activos
  const activeDateFilters = useMemo(() => {
    return filters.filter(f => {
      // Verificar si el filtro usa un operador de fecha
      if (isDateFilterOperator(f.operator)) return true
      // O si el campo esta en la lista de campos fecha y tiene operador 'between'
      if (f.operator === 'between' && dateFields.some(df => df.fieldId === f.field)) return true
      // O comparadores de fecha especificos
      if (['=', '>=', '<=', '>', '<'].includes(f.operator) && dateFields.some(df => df.fieldId === f.field)) return true
      return false
    })
  }, [filters, dateFields])

  // Auto-seleccionar el primer campo fecha si no hay uno seleccionado
  const effectiveDateFieldId = config.dateFieldId || activeDateFilters[0]?.field || ''

  // Obtener label del campo fecha seleccionado (MUST be before early return to satisfy React hooks rules)
  const selectedDateFieldLabel = useMemo(() => {
    if (activeDateFilters.length === 0) return ''
    const field = dateFields.find(df => df.fieldId === effectiveDateFieldId)
    return field?.label || effectiveDateFieldId
  }, [dateFields, effectiveDateFieldId, activeDateFilters.length])

  // Si no hay filtros de fecha, no mostrar nada
  if (activeDateFilters.length === 0) {
    return null
  }

  // Handlers
  const handleTypeChange = (type: ComparisonType) => {
    onChange({
      ...config,
      enabled: type !== 'none',
      type,
      dateFieldId: effectiveDateFieldId
    })
  }

  const handleDateFieldChange = (fieldId: string) => {
    onChange({
      ...config,
      dateFieldId: fieldId
    })
  }

  const handleVariantToggle = (variant: MetricVariant) => {
    let variants = [...config.enabledVariants]

    if (variants.includes(variant)) {
      variants = variants.filter(v => v !== variant)
    } else {
      variants.push(variant)
    }

    // Asegurar que al menos 'current' este siempre habilitado
    if (!variants.includes('current')) {
      variants.unshift('current')
    }

    onChange({
      ...config,
      enabledVariants: variants
    })
  }

  const handleCustomDateChange = (start: string, end: string) => {
    onChange({
      ...config,
      customStartDate: start,
      customEndDate: end
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <ArrowPathIcon className="h-4 w-4 text-blue-500" />
        <span className="text-xs font-medium text-gray-700">Comparar periodos</span>
      </div>

      {/* Selector de campo fecha (si hay multiples filtros de fecha) */}
      {activeDateFilters.length > 1 && (
        <div className="mb-3">
          <label className="text-[11px] text-gray-500 mb-1 block">Campo de fecha</label>
          <div className="relative">
            <select
              value={effectiveDateFieldId}
              onChange={(e) => handleDateFieldChange(e.target.value)}
              className="w-full h-8 pl-2 pr-8 text-xs border border-gray-300 rounded-md bg-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {activeDateFilters.map(f => {
                const df = dateFields.find(d => d.fieldId === f.field)
                return (
                  <option key={f.field} value={f.field}>
                    {df?.label || f.field}
                  </option>
                )
              })}
            </select>
            <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Selector de tipo de comparacion */}
      <div className="mb-3">
        <label className="text-[11px] text-gray-500 mb-1 block">Tipo de comparacion</label>
        <div className="relative">
          <select
            value={config.type}
            onChange={(e) => handleTypeChange(e.target.value as ComparisonType)}
            className="w-full h-8 pl-2 pr-8 text-xs border border-gray-300 rounded-md bg-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {COMPARISON_TYPES.map(ct => (
              <option key={ct} value={ct}>
                {COMPARISON_TYPE_LABELS[ct].label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
        {/* Descripcion del tipo seleccionado */}
        {config.type !== 'none' && COMPARISON_TYPE_LABELS[config.type].description && (
          <p className="text-[10px] text-gray-400 mt-1">
            {COMPARISON_TYPE_LABELS[config.type].description}
          </p>
        )}
      </div>

      {/* Selector de fechas custom */}
      {config.type === 'custom' && (
        <div className="mb-3">
          <label className="text-[11px] text-gray-500 mb-1 block">Rango de comparacion</label>
          <DateRangePicker
            startDate={config.customStartDate || null}
            endDate={config.customEndDate || null}
            onChange={handleCustomDateChange}
            isRange={true}
            placeholder="Seleccionar rango"
          />
        </div>
      )}

      {/* Checkboxes de variantes de metricas */}
      {config.enabled && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <label className="text-[11px] text-gray-500 mb-2 block">Mostrar valores</label>
          <div className="grid grid-cols-2 gap-2">
            {METRIC_VARIANTS.map(mv => (
              <label
                key={mv}
                className="flex items-center gap-1.5 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={config.enabledVariants.includes(mv)}
                  onChange={() => handleVariantToggle(mv)}
                  disabled={mv === 'current'} // Current siempre habilitado
                  className="h-3.5 w-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className={`text-xs ${mv === 'current' ? 'text-gray-400' : 'text-gray-600 group-hover:text-gray-900'}`}>
                  {METRIC_VARIANT_LABELS[mv].label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Info del campo fecha seleccionado (cuando solo hay uno) */}
      {activeDateFilters.length === 1 && config.enabled && (
        <div className="mt-2 text-[10px] text-gray-400">
          Comparando por: <span className="font-medium text-gray-500">{selectedDateFieldLabel}</span>
        </div>
      )}
    </div>
  )
}

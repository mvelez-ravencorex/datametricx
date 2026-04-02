/**
 * VizBuilder - Componente reutilizable para construir visualizaciones
 *
 * UI para explorar datasets con jerarquía: Entity > Attributes > Metrics
 * Usado en: DatasetsNew, DashboardEditor, VizEditor
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  CubeIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FunnelIcon,
  TableCellsIcon,
  ChartBarIcon,
  CodeBracketIcon,
  TagIcon,
  HashtagIcon,
  XMarkIcon,
  ClipboardIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  CalendarIcon,
  FolderIcon,
  InformationCircleIcon,
  ArrowsRightLeftIcon,
  Cog6ToothIcon,
  BookmarkIcon,
  FolderPlusIcon,
  ArrowPathIcon,
  Bars3Icon,
  Bars3BottomLeftIcon,
  Bars3BottomRightIcon,
} from '@heroicons/react/24/outline'
import { FunnelIcon as FunnelIconSolid } from '@heroicons/react/24/solid'
import type { SemanticDataset, SemanticEntity, QueryRequest, QueryColumnInfo, MetricFilter } from '@/types/semantic'
import type { VizConfig, VizType, FolderListItem, ThresholdConfig, SelectedField, ChartSettings } from '@/types/viz'
import type { ComparisonConfig, ComparisonType, MetricVariant } from '@/types/comparison'
import { DEFAULT_COMPARISON_CONFIG, METRIC_VARIANT_LABELS, toQueryComparisonConfig } from '@/types/comparison'
import type { QueryComparisonInfo } from '@/types/semantic'
import { executeQuery } from '@/services/semanticService'
import { createViz, listFolders, createFolder } from '@/services/vizService'
import { useAuth } from '@/contexts/AuthContext'
import DateRangePicker from '@/components/ui/DateRangePicker'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  ZAxis,
  ReferenceLine,
} from 'recharts'

// ============================================================================
// Types
// ============================================================================

interface DatasetWithMeta extends SemanticDataset {
  group: string
  subgroup: string
  path: string
}

interface FieldItem {
  id: string           // entity.field_id format
  fieldId: string      // Just the field id
  label: string
  type: string
  fieldType: 'attribute' | 'metric'
  entityId: string
  entityLabel: string
  group: string        // Group name for grouping within entity
  description?: string // Field description
  sql?: string         // SQL expression
  sql_agg?: string     // Aggregation type for metrics
}

type GroupedFields = Record<string, FieldItem[]>

// Metric format options
type MetricFormat = 'number' | 'currency' | 'percent' | 'compact' | 'decimal'

const METRIC_FORMAT_OPTIONS: { value: MetricFormat; label: string }[] = [
  { value: 'number', label: 'Número' },
  { value: 'currency', label: 'Moneda ($)' },
  { value: 'percent', label: 'Porcentaje (%)' },
  { value: 'compact', label: 'Compacto (K/M)' },
  { value: 'decimal', label: 'Decimal (2)' },
]

// Types that support date transformations (date and timestamp)
const DATE_LIKE_TYPES = ['date', 'timestamp']

// Date timeframe options for date/timestamp attributes
const DATE_TIMEFRAMES = [
  { value: 'raw', label: 'raw' },
  { value: 'time', label: 'time' },
  { value: 'datetime', label: 'datetime' },
  { value: 'date', label: 'date' },
  { value: 'week', label: 'week' },
  { value: 'month', label: 'month' },
  { value: 'quarter', label: 'quarter' },
  { value: 'year', label: 'year' },
]

// Helper to check if a field type is date-like
const isDateLikeType = (type: string | undefined): boolean => DATE_LIKE_TYPES.includes(type || '')

// X-Axis format options
type XAxisFormatType = 'auto' | 'text' | 'date' | 'time' | 'datetime'

const X_AXIS_FORMAT_OPTIONS: { value: XAxisFormatType; label: string }[] = [
  { value: 'auto', label: 'Automático' },
  { value: 'text', label: 'Texto' },
  { value: 'date', label: 'Fecha' },
  { value: 'time', label: 'Hora' },
  { value: 'datetime', label: 'Fecha y Hora' },
]

const X_AXIS_DATE_PATTERNS: { value: string; label: string; example: string }[] = [
  { value: 'dd/MM/yyyy', label: 'dd/MM/yyyy', example: '31/12/2024' },
  { value: 'MM/dd/yyyy', label: 'MM/dd/yyyy', example: '12/31/2024' },
  { value: 'yyyy-MM-dd', label: 'yyyy-MM-dd', example: '2024-12-31' },
  { value: 'dd MMM yyyy', label: 'dd MMM yyyy', example: '31 Dec 2024' },
  { value: 'MMM dd, yyyy', label: 'MMM dd, yyyy', example: 'Dec 31, 2024' },
  { value: 'dd MMM', label: 'dd MMM', example: '31 Dec' },
  { value: 'MMM yyyy', label: 'MMM yyyy', example: 'Dec 2024' },
  { value: 'yyyy', label: 'yyyy', example: '2024' },
  { value: 'MMM', label: 'MMM', example: 'Dec' },
]

const X_AXIS_TIME_PATTERNS: { value: string; label: string; example: string }[] = [
  { value: 'HH:mm', label: 'HH:mm (24h)', example: '14:30' },
  { value: 'HH:mm:ss', label: 'HH:mm:ss (24h)', example: '14:30:45' },
  { value: 'hh:mm a', label: 'hh:mm a (12h)', example: '02:30 PM' },
  { value: 'hh:mm:ss a', label: 'hh:mm:ss a (12h)', example: '02:30:45 PM' },
]

// Y-Axis format options
export type YAxisFormatType = 'auto' | 'number' | 'compact' | 'percent' | 'percent_raw' | 'currency' | 'decimal'

const Y_AXIS_FORMAT_OPTIONS: { value: YAxisFormatType; label: string; example: string }[] = [
  { value: 'auto', label: 'Automático', example: '1000 / 1K / 1M' },
  { value: 'number', label: 'Número', example: '1,000' },
  { value: 'compact', label: 'Compacto', example: '1K, 1M, 1B' },
  { value: 'percent', label: 'Porcentaje (×100)', example: '0.25 → 25%' },
  { value: 'percent_raw', label: 'Porcentaje', example: '25 → 25%' },
  { value: 'currency', label: 'Moneda', example: '$1,000' },
  { value: 'decimal', label: 'Decimal (2)', example: '1,000.00' },
]

interface EntityFields {
  entityId: string
  entityLabel: string
  isBaseEntity: boolean
  attributesByGroup: GroupedFields
  metricsByGroup: GroupedFields
  totalAttributes: number
  totalMetrics: number
}

// ============================================================================
// Field Item Component (Child field under a group)
// ============================================================================

interface FieldItemRowProps {
  field: FieldItem
  isSelected: boolean
  onToggle: (field: FieldItem) => void
  metricFormat?: MetricFormat
  onFormatChange?: (fieldId: string, format: MetricFormat) => void
  isPivot?: boolean
  onSetPivot?: (fieldId: string | null) => void
  onAddFilter?: (field: FieldItem) => void
  // Comparison props for metrics
  comparisonEnabled?: boolean
  selectedFields?: Set<string>  // To check if variant fields are selected
  onToggleVariantField?: (variantField: FieldItem) => void  // To add/remove variant fields
}

function FieldItemRow({ field, isSelected, onToggle, metricFormat, onFormatChange, isPivot, onSetPivot, onAddFilter, comparisonEnabled, selectedFields, onToggleVariantField }: FieldItemRowProps) {
  const [showFormatMenu, setShowFormatMenu] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const Icon = field.fieldType === 'attribute' ? TagIcon : HashtagIcon
  const iconColor = field.fieldType === 'attribute' ? 'text-blue-400' : 'text-purple-400'

  const currentFormat = metricFormat || 'number'
  // Format label for future use
  void METRIC_FORMAT_OPTIONS.find(o => o.value === currentFormat)?.label

  // Build tooltip content
  const hasTooltipContent = field.description || field.sql || field.type
  const typeLabels: Record<string, string> = {
    string: 'Texto',
    number: 'Número',
    date: 'Fecha',
    boolean: 'Booleano',
    location: 'Ubicación',
    currency: 'Moneda',
    percent: 'Porcentaje',
  }

  // Check if this metric should be expandable (comparison enabled and metric selected)
  const isExpandable = field.fieldType === 'metric' && isSelected && comparisonEnabled

  return (
    <div>
      <div
        className={`flex items-center pl-14 pr-3 py-1 text-xs transition-colors ${
          isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
        }`}
      >
        {/* Expand chevron for metrics with comparison */}
        {isExpandable ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="mr-1 p-0.5 text-gray-400 hover:text-gray-600"
          >
            <ChevronRightIcon className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <div className="w-4" /> // Spacer when not expandable
        )}
        <div
          className="flex items-center flex-1 min-w-0 cursor-pointer"
          onClick={() => onToggle(field)}
        >
          <Icon className={`h-3 w-3 mr-1.5 flex-shrink-0 ${iconColor}`} />
          <span className={`flex-1 truncate ${isSelected ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>
            {field.label}
          </span>
        </div>
      {/* Pivot icon for attributes */}
      {field.fieldType === 'attribute' && onSetPivot && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSetPivot(isPivot ? null : field.id)
          }}
          className={`ml-1 p-0.5 rounded transition-colors ${
            isPivot
              ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
              : 'text-gray-300 hover:text-amber-500 hover:bg-amber-50'
          }`}
          title={isPivot ? 'Quitar pivot' : 'Usar como pivot'}
        >
          <ArrowsRightLeftIcon className="h-3.5 w-3.5" />
        </button>
      )}
      {/* Filter icon */}
      {onAddFilter && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onAddFilter(field)
          }}
          className="ml-1 p-0.5 rounded transition-colors text-gray-300 hover:text-blue-500 hover:bg-blue-50"
          title="Agregar filtro"
        >
          <FunnelIcon className="h-3.5 w-3.5" />
        </button>
      )}
      {/* Info icon with tooltip */}
      {hasTooltipContent && (
        <div
          className="relative ml-1"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <InformationCircleIcon className="h-3.5 w-3.5 text-gray-300 hover:text-gray-500 cursor-help" />
          {showTooltip && (
            <div className="absolute right-0 bottom-full mb-1 z-30 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[200px] max-w-[280px]">
              <div className="space-y-1.5">
                {field.description && (
                  <div>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase">Descripción</span>
                    <p className="text-[11px] text-gray-600 leading-tight">{field.description}</p>
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">Tipo</span>
                  <p className="text-[11px] text-gray-600">{typeLabels[field.type] || field.type}</p>
                </div>
                {field.sql && (
                  <div>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase">
                      SQL {field.sql_agg ? `(${field.sql_agg})` : ''}
                    </span>
                    <p className="text-[11px] text-gray-500 font-mono bg-gray-50 px-1.5 py-0.5 rounded break-all">
                      {field.sql}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Format options button for metrics when selected */}
      {field.fieldType === 'metric' && isSelected && onFormatChange && (
        <div className="relative ml-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowFormatMenu(!showFormatMenu)
            }}
            className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
            title="Formato de número"
          >
            <EllipsisVerticalIcon className="h-4 w-4" />
          </button>

          {/* Dropdown Menu */}
          {showFormatMenu && (
            <>
              {/* Backdrop to close menu */}
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowFormatMenu(false)
                }}
              />
              {/* Menu */}
              <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  Formato
                </div>
                {METRIC_FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation()
                      onFormatChange(field.id, opt.value)
                      setShowFormatMenu(false)
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs hover:bg-purple-50 flex items-center justify-between ${
                      currentFormat === opt.value ? 'text-purple-600 bg-purple-50 font-medium' : 'text-gray-700'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {currentFormat === opt.value && (
                      <CheckIcon className="h-3 w-3 text-purple-600" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      </div>

      {/* Expanded comparison variants section */}
      {isExpandable && isExpanded && onToggleVariantField && (
        <div className="bg-gray-50/50">
          {(['previous', 'delta', 'delta_pct'] as MetricVariant[]).map((variant) => {
            // Create virtual field ID for this variant
            const variantFieldId = `${field.id}_${variant}`
            const variantFieldFieldId = `${field.fieldId}_${variant}`
            const isVariantSelected = selectedFields?.has(variantFieldId) ?? false

            // Create virtual FieldItem for this variant
            const variantField: FieldItem = {
              id: variantFieldId,
              fieldId: variantFieldFieldId,
              label: `${field.label} (${METRIC_VARIANT_LABELS[variant].shortLabel})`,
              type: variant === 'delta_pct' ? 'percent' : 'number',
              fieldType: 'metric',
              entityId: field.entityId,
              entityLabel: field.entityLabel,
              group: field.group,
            }

            return (
              <div
                key={variant}
                onClick={() => onToggleVariantField(variantField)}
                className={`flex items-center pl-20 pr-3 py-1 text-xs transition-colors cursor-pointer ${
                  isVariantSelected ? 'bg-blue-50' : 'hover:bg-gray-100'
                }`}
              >
                <HashtagIcon className={`h-3 w-3 mr-1.5 flex-shrink-0 ${isVariantSelected ? 'text-purple-500' : 'text-gray-400'}`} />
                <span className={`flex-1 truncate ${isVariantSelected ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>
                  {METRIC_VARIANT_LABELS[variant].label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Date Field Item Component (Expandable with timeframes)
// ============================================================================

interface DateFieldItemRowProps {
  field: FieldItem
  selectedFields: Set<string>
  onToggleField: (field: FieldItem) => void
  pivotField?: string | null
  onSetPivot?: (fieldId: string | null) => void
  onAddFilter?: (field: FieldItem) => void
  activeFilterFields?: Set<string>  // Fields that have active filters
}

function DateFieldItemRow({ field, selectedFields, onToggleField, pivotField, onSetPivot, onAddFilter, activeFilterFields }: DateFieldItemRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  // Count how many timeframes are selected for this date field
  const selectedCount = DATE_TIMEFRAMES.filter(tf =>
    selectedFields.has(`${field.id}_${tf.value}`)
  ).length

  // Check if has tooltip content
  const hasTooltipContent = field.description || field.sql || field.type

  return (
    <div>
      {/* Date field header */}
      <div
        className={`flex items-center pl-14 pr-3 py-1 text-xs transition-colors cursor-pointer ${
          selectedCount > 0 ? 'bg-blue-50' : 'hover:bg-gray-50'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ChevronRightIcon
          className={`h-3 w-3 mr-1 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        />
        <CalendarIcon className="h-3 w-3 mr-1.5 flex-shrink-0 text-blue-400" />
        <span className={`flex-1 truncate ${selectedCount > 0 ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>
          {field.label}
        </span>
        {/* Filter icon */}
        {onAddFilter && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddFilter(field)
            }}
            className={`ml-1 p-0.5 rounded transition-colors ${
              activeFilterFields?.has(field.fieldId)
                ? 'text-blue-500'
                : 'text-gray-300 hover:text-blue-500 hover:bg-blue-50'
            }`}
            title="Agregar filtro"
          >
            {activeFilterFields?.has(field.fieldId) ? (
              <FunnelIconSolid className="h-3.5 w-3.5" />
            ) : (
              <FunnelIcon className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        {/* Info icon with tooltip */}
        {hasTooltipContent && (
          <div
            className="relative ml-1"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={(e) => e.stopPropagation()}
          >
            <InformationCircleIcon className="h-3.5 w-3.5 text-gray-300 hover:text-gray-500 cursor-help" />
            {showTooltip && (
              <div className="absolute right-0 bottom-full mb-1 z-30 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[200px] max-w-[280px]">
                <div className="space-y-1.5">
                  {field.description && (
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase">Descripción</span>
                      <p className="text-[11px] text-gray-600 leading-tight">{field.description}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase">Tipo</span>
                    <p className="text-[11px] text-gray-600">Fecha</p>
                  </div>
                  {field.sql && (
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase">SQL</span>
                      <p className="text-[11px] text-gray-500 font-mono bg-gray-50 px-1.5 py-0.5 rounded break-all">
                        {field.sql}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        <span className="text-[10px] text-gray-400 ml-1">{DATE_TIMEFRAMES.length}</span>
      </div>

      {/* Timeframes list */}
      {isExpanded && (
        <div className="bg-gray-50/50">
          {DATE_TIMEFRAMES.map((tf) => {
            const timeframeFieldId = `${field.id}_${tf.value}`
            const isSelected = selectedFields.has(timeframeFieldId)
            // Create a virtual FieldItem for this timeframe
            const timeframeField: FieldItem = {
              id: timeframeFieldId,
              fieldId: `${field.fieldId}_${tf.value}`,
              label: tf.label,
              type: tf.value === 'raw' ? 'datetime' : tf.value,
              fieldType: 'attribute',
              entityId: field.entityId,
              entityLabel: field.entityLabel,
              group: field.group,
            }
            const isPivot = pivotField === timeframeFieldId
            return (
              <div
                key={tf.value}
                className={`flex items-center pl-20 pr-3 py-1 text-xs transition-colors cursor-pointer ${
                  isSelected ? 'bg-blue-50' : 'hover:bg-gray-100'
                }`}
                onClick={() => onToggleField(timeframeField)}
              >
                <FolderIcon className="h-3 w-3 mr-1.5 flex-shrink-0 text-gray-400" />
                <span className={`flex-1 truncate ${isSelected ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>
                  {tf.label}
                </span>
                {/* Filter icon for timeframe */}
                {onAddFilter && (() => {
                  const hasFilter = activeFilterFields?.has(timeframeField.fieldId)
                  return (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddFilter(timeframeField)
                      }}
                      className={`ml-1 p-0.5 rounded transition-colors ${
                        hasFilter
                          ? 'text-blue-500'
                          : 'text-gray-300 hover:text-blue-500 hover:bg-blue-50'
                      }`}
                      title="Agregar filtro"
                    >
                      {hasFilter ? (
                        <FunnelIconSolid className="h-3.5 w-3.5" />
                      ) : (
                        <FunnelIcon className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )
                })()}
                {/* Pivot icon */}
                {onSetPivot && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onSetPivot(isPivot ? null : timeframeFieldId)
                    }}
                    className={`ml-1 p-0.5 rounded transition-colors ${
                      isPivot
                        ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                        : 'text-gray-300 hover:text-amber-500 hover:bg-amber-50'
                    }`}
                    title={isPivot ? 'Quitar pivot' : 'Usar como pivot'}
                  >
                    <ArrowsRightLeftIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Fields Group Component (Expandable group header)
// ============================================================================

interface FieldsGroupProps {
  groupName: string
  fields: FieldItem[]
  selectedFields: Set<string>
  onToggleField: (field: FieldItem) => void
  fieldType: 'attribute' | 'metric'
  defaultExpanded?: boolean
  pivotField?: string | null
  onSetPivot?: (fieldId: string | null) => void
  metricFormats?: Record<string, MetricFormat>
  onFormatChange?: (fieldId: string, format: MetricFormat) => void
  onAddFilter?: (field: FieldItem) => void
  activeFilterFields?: Set<string>
  // Comparison props
  comparisonEnabled?: boolean
}

function FieldsGroup({ groupName, fields, selectedFields, onToggleField, fieldType: _fieldType, defaultExpanded = true, pivotField, onSetPivot, metricFormats, onFormatChange, onAddFilter, activeFilterFields, comparisonEnabled }: FieldsGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  if (fields.length === 0) return null

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between pl-10 pr-3 py-1 text-xs hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center min-w-0">
          <span className="text-gray-700 truncate">{groupName}</span>
        </div>
        <div className="flex items-center space-x-1 flex-shrink-0">
          <span className="text-xs text-gray-400">{fields.length}</span>
          {isExpanded ? (
            <ChevronDownIcon className="h-2.5 w-2.5 text-gray-400" />
          ) : (
            <ChevronRightIcon className="h-2.5 w-2.5 text-gray-400" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="pb-0.5">
          {fields.map((field) => (
            isDateLikeType(field.type) ? (
              <DateFieldItemRow
                key={field.id}
                field={field}
                selectedFields={selectedFields}
                onToggleField={onToggleField}
                pivotField={pivotField}
                onSetPivot={onSetPivot}
                onAddFilter={onAddFilter}
                activeFilterFields={activeFilterFields}
              />
            ) : (
              <FieldItemRow
                key={field.id}
                field={field}
                isSelected={selectedFields.has(field.id)}
                onToggle={onToggleField}
                metricFormat={metricFormats?.[field.id]}
                onFormatChange={onFormatChange}
                isPivot={pivotField === field.id}
                onSetPivot={onSetPivot}
                onAddFilter={onAddFilter}
                comparisonEnabled={comparisonEnabled}
                selectedFields={selectedFields}
                onToggleVariantField={onToggleField}
              />
            )
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Field Type Section Component (Attributes or Metrics with sub-groups)
// ============================================================================

interface FieldTypeSectionProps {
  title: string
  groupedFields: GroupedFields
  totalCount: number
  selectedFields: Set<string>
  onToggleField: (field: FieldItem) => void
  fieldType: 'attribute' | 'metric'
  metricFormats?: Record<string, MetricFormat>
  onFormatChange?: (fieldId: string, format: MetricFormat) => void
  pivotField?: string | null
  onSetPivot?: (fieldId: string | null) => void
  onAddFilter?: (field: FieldItem) => void
  activeFilterFields?: Set<string>
  // Comparison props
  comparisonEnabled?: boolean
}

function FieldTypeSection({ title, groupedFields, totalCount, selectedFields, onToggleField, fieldType, metricFormats, onFormatChange, pivotField, onSetPivot, onAddFilter, activeFilterFields, comparisonEnabled }: FieldTypeSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const Icon = fieldType === 'attribute' ? TagIcon : HashtagIcon
  const iconColor = fieldType === 'attribute' ? 'text-blue-500' : 'text-purple-500'
  const textColor = fieldType === 'attribute' ? 'text-blue-600' : 'text-purple-600'

  if (totalCount === 0) return null

  const groupNames = Object.keys(groupedFields).sort()

  return (
    <div>
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between pl-6 pr-3 py-1.5 text-xs hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center">
          <Icon className={`h-3.5 w-3.5 mr-1.5 flex-shrink-0 ${iconColor}`} />
          <span className={`font-medium ${textColor}`}>{title}</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-xs text-gray-500">{totalCount}</span>
          {isExpanded ? (
            <ChevronDownIcon className="h-2.5 w-2.5 text-gray-400" />
          ) : (
            <ChevronRightIcon className="h-2.5 w-2.5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Sub-groups */}
      {isExpanded && (
        <div className="pb-1">
          {groupNames.map((groupName) => (
            <FieldsGroup
              key={groupName}
              groupName={groupName}
              fields={groupedFields[groupName]}
              selectedFields={selectedFields}
              onToggleField={onToggleField}
              fieldType={fieldType}
              defaultExpanded={true}
              metricFormats={metricFormats}
              onFormatChange={onFormatChange}
              pivotField={pivotField}
              onSetPivot={onSetPivot}
              onAddFilter={onAddFilter}
              activeFilterFields={activeFilterFields}
              comparisonEnabled={comparisonEnabled}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Entity Section Component (Entity > Attributes > Metrics)
// ============================================================================

interface EntitySectionProps {
  entity: EntityFields
  selectedFields: Set<string>
  onToggleField: (field: FieldItem) => void
  defaultExpanded?: boolean
  metricFormats?: Record<string, MetricFormat>
  onFormatChange?: (fieldId: string, format: MetricFormat) => void
  pivotField?: string | null
  onSetPivot?: (fieldId: string | null) => void
  onAddFilter?: (field: FieldItem) => void
  activeFilterFields?: Set<string>
  // Comparison props
  comparisonEnabled?: boolean
}

function EntitySection({ entity, selectedFields, onToggleField, defaultExpanded = true, metricFormats, onFormatChange, pivotField, onSetPivot, onAddFilter, activeFilterFields, comparisonEnabled }: EntitySectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const totalFields = entity.totalAttributes + entity.totalMetrics

  return (
    <div className="border-b border-gray-200">
      {/* Entity Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center min-w-0 flex-1 mr-2">
          <CubeIcon className="h-3 w-3 mr-1.5 flex-shrink-0 text-gray-500" />
          <span className="text-xs font-medium text-gray-900 truncate">{entity.entityLabel}</span>
          {entity.isBaseEntity && (
            <span className="ml-1.5 text-[10px] bg-green-100 text-green-700 px-1 py-0.5 rounded flex-shrink-0">
              Base
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1.5 flex-shrink-0">
          <span className="text-xs text-gray-500">{totalFields}</span>
          <ChevronDownIcon className={`h-3 w-3 text-gray-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
        </div>
      </button>

      {/* Entity Content - Attributes and Metrics */}
      {isExpanded && (
        <div className="pb-1">
          <FieldTypeSection
            title="Attributes"
            groupedFields={entity.attributesByGroup}
            totalCount={entity.totalAttributes}
            selectedFields={selectedFields}
            onToggleField={onToggleField}
            fieldType="attribute"
            pivotField={pivotField}
            onSetPivot={onSetPivot}
            onAddFilter={onAddFilter}
            activeFilterFields={activeFilterFields}
          />
          <FieldTypeSection
            title="Metrics"
            groupedFields={entity.metricsByGroup}
            totalCount={entity.totalMetrics}
            selectedFields={selectedFields}
            onToggleField={onToggleField}
            fieldType="metric"
            metricFormats={metricFormats}
            onFormatChange={onFormatChange}
            onAddFilter={onAddFilter}
            activeFilterFields={activeFilterFields}
            comparisonEnabled={comparisonEnabled}
          />
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Fields Panel Component (Left Side)
// ============================================================================

interface FieldsPanelProps {
  entities: EntityFields[]
  selectedFields: Set<string>
  onToggleField: (field: FieldItem) => void
  onSelectAll: () => void
  onClearAll: () => void
  totalFields: number
  width: number
  onWidthChange: (width: number) => void
  metricFormats: Record<string, MetricFormat>
  onFormatChange: (fieldId: string, format: MetricFormat) => void
  pivotField: string | null
  onSetPivot: (fieldId: string | null) => void
  onAddFilter: (field: FieldItem) => void
  activeFilterFields: Set<string>
  // Dataset info for header
  datasetGroup?: string
  datasetId?: string
  datasetLabel?: string
  datasetDescription?: string
  // Refresh callback
  onRefresh?: () => void
  isRefreshing?: boolean
  // Comparison props
  comparisonEnabled?: boolean
}

function FieldsPanel({
  entities,
  selectedFields,
  onToggleField,
  onSelectAll,
  onClearAll,
  totalFields,
  width,
  onWidthChange,
  metricFormats,
  onFormatChange,
  pivotField,
  onSetPivot,
  onAddFilter,
  activeFilterFields,
  datasetGroup,
  datasetId,
  datasetLabel,
  datasetDescription,
  onRefresh,
  isRefreshing = false,
  comparisonEnabled,
}: FieldsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'inUse'>('all')
  const [isResizing, setIsResizing] = useState(false)

  // Handle resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)

    const startX = e.clientX
    const startWidth = width

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = startWidth + (e.clientX - startX)
      // Limit between 200px and 400px
      onWidthChange(Math.max(200, Math.min(400, newWidth)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Filter entities based on search and tab
  const filteredEntities = useMemo(() => {
    return entities.map(entity => {
      // Filter fields within groups
      const filterGroupedFields = (groupedFields: GroupedFields): GroupedFields => {
        const result: GroupedFields = {}
        for (const [groupName, fields] of Object.entries(groupedFields)) {
          const filtered = fields.filter(field => {
            const matchesSearch = !searchQuery ||
              field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
              field.id.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesTab = activeTab === 'all' || selectedFields.has(field.id)
            return matchesSearch && matchesTab
          })
          if (filtered.length > 0) {
            result[groupName] = filtered
          }
        }
        return result
      }

      const filteredAttrs = filterGroupedFields(entity.attributesByGroup)
      const filteredMetrics = filterGroupedFields(entity.metricsByGroup)
      const totalAttrs = Object.values(filteredAttrs).reduce((sum, arr) => sum + arr.length, 0)
      const totalMetrics = Object.values(filteredMetrics).reduce((sum, arr) => sum + arr.length, 0)

      return {
        ...entity,
        attributesByGroup: filteredAttrs,
        metricsByGroup: filteredMetrics,
        totalAttributes: totalAttrs,
        totalMetrics: totalMetrics,
      }
    }).filter(entity => entity.totalAttributes > 0 || entity.totalMetrics > 0)
  }, [entities, searchQuery, activeTab, selectedFields])

  return (
    <div
      className="border-r border-gray-200 bg-white flex flex-col h-full relative"
      style={{ width: `${width}px` }}
    >
      {/* Dataset Info Header */}
      {datasetLabel && (
        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
          {/* Breadcrumb */}
          <div className="flex items-center text-xs text-gray-500 mb-0.5">
            <span>{datasetGroup}</span>
            <span className="mx-1.5">›</span>
            <span>{datasetId}</span>
          </div>
          <h2 className="text-sm font-semibold text-gray-900">{datasetLabel}</h2>
          {datasetDescription && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{datasetDescription}</p>
          )}
        </div>
      )}

      {/* Search */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar campo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            activeTab === 'all'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setActiveTab('inUse')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            activeTab === 'inUse'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          En Uso
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 text-xs">
        <div className="flex items-center space-x-4">
          <button
            onClick={onSelectAll}
            className="text-blue-600 hover:text-blue-800 hover:underline"
          >
            Agregar todos
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={onClearAll}
            className="text-gray-500 hover:text-gray-700 hover:underline"
          >
            Quitar todos
          </button>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
            title="Recargar campos"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Entities List */}
      <div className="flex-1 overflow-y-auto">
        {filteredEntities.map((entity) => (
          <EntitySection
            key={entity.entityId}
            entity={entity}
            selectedFields={selectedFields}
            onToggleField={onToggleField}
            defaultExpanded={true}
            metricFormats={metricFormats}
            onFormatChange={onFormatChange}
            pivotField={pivotField}
            onSetPivot={onSetPivot}
            onAddFilter={onAddFilter}
            activeFilterFields={activeFilterFields}
            comparisonEnabled={comparisonEnabled}
          />
        ))}
        {filteredEntities.length === 0 && (
          <div className="p-4 text-center text-sm text-gray-500">
            No se encontraron campos
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-200 text-xs text-gray-500 bg-gray-50">
        {totalFields} campos | {selectedFields.size} seleccionados
      </div>

      {/* Resize Handle */}
      <div
        className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 transition-colors ${
          isResizing ? 'bg-blue-500' : 'bg-transparent'
        }`}
        onMouseDown={handleMouseDown}
      />
    </div>
  )
}

// ============================================================================
// Collapsible Section Component
// ============================================================================

interface CollapsibleSectionProps {
  title: string
  color: 'blue' | 'green' | 'purple'
  children: React.ReactNode
  defaultExpanded?: boolean
  forceExpanded?: boolean // When true, forces the section to expand
  count?: number
  resizable?: boolean
  height?: number
  onHeightChange?: (height: number) => void
  minHeight?: number
  maxHeight?: number
}

function CollapsibleSection({
  title,
  color,
  children,
  defaultExpanded = false,
  forceExpanded,
  count,
  resizable = false,
  height,
  onHeightChange,
  minHeight = 150,
  maxHeight = 600,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [isResizing, setIsResizing] = useState(false)

  // Force expand when forceExpanded becomes true
  useEffect(() => {
    if (forceExpanded) {
      setIsExpanded(true)
    }
  }, [forceExpanded])

  // Color configurations
  const colorConfig = {
    blue: {
      border: 'border-blue-500',
      bg: 'bg-blue-50',
      hoverBg: 'hover:bg-blue-100',
      text: 'text-blue-900',
      badge: 'bg-blue-200',
      badgeText: 'text-blue-800',
      chevron: 'text-blue-700',
      resizeBar: 'bg-blue-400',
    },
    green: {
      border: 'border-green-500',
      bg: 'bg-green-50',
      hoverBg: 'hover:bg-green-100',
      text: 'text-green-900',
      badge: 'bg-green-200',
      badgeText: 'text-green-800',
      chevron: 'text-green-700',
      resizeBar: 'bg-green-400',
    },
    purple: {
      border: 'border-purple-500',
      bg: 'bg-purple-50',
      hoverBg: 'hover:bg-purple-100',
      text: 'text-purple-900',
      badge: 'bg-purple-200',
      badgeText: 'text-purple-800',
      chevron: 'text-purple-700',
      resizeBar: 'bg-purple-400',
    },
  }

  const colors = colorConfig[color]

  // Handle resize
  const handleResizeStart = (e: React.MouseEvent) => {
    if (!resizable || !onHeightChange) return
    e.preventDefault()
    setIsResizing(true)

    const startY = e.clientY
    const startHeight = height || minHeight

    const handleMouseMove = (e: MouseEvent) => {
      const newHeight = startHeight + (e.clientY - startY)
      onHeightChange(Math.max(minHeight, Math.min(maxHeight, newHeight)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div className="border-b border-gray-200 relative">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full px-4 py-1.5 flex items-center justify-between ${colors.bg} ${colors.hoverBg} transition-colors border-l-4 ${colors.border}`}
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${colors.text}`}>{title}</span>
          {count !== undefined && count > 0 && (
            <span className={`px-2 py-0.5 text-xs font-medium ${colors.badge} ${colors.badgeText} rounded-full`}>
              {count}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDownIcon className={`h-5 w-5 ${colors.chevron}`} />
        ) : (
          <ChevronRightIcon className={`h-5 w-5 ${colors.chevron}`} />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div
          className="px-6 py-4 bg-white border-t border-gray-100 relative"
          style={resizable && height ? { height: `${height}px`, overflow: 'auto' } : undefined}
        >
          {children}

          {/* Resize Handle */}
          {resizable && (
            <div
              className={`absolute bottom-0 left-0 right-0 h-2 ${colors.resizeBar} cursor-ns-resize flex items-center justify-center transition-colors ${
                isResizing ? 'opacity-100' : 'opacity-70 hover:opacity-100'
              }`}
              onMouseDown={handleResizeStart}
            >
              <div className="w-12 h-1 bg-white/50 rounded-full" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Metric Value Formatter
// ============================================================================

function formatMetricValue(value: unknown, format: MetricFormat = 'number'): string {
  if (value === null || value === undefined) return '—'

  const numValue = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(numValue)) return String(value)

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numValue)
    case 'percent':
      return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numValue / 100)
    case 'compact':
      return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 1,
      }).format(numValue)
    case 'decimal':
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numValue)
    case 'number':
    default:
      return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 0,
      }).format(numValue)
  }
}

// ============================================================================
// X-Axis Value Formatter
// ============================================================================

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatXAxisValue(
  value: unknown,
  formatType: XAxisFormatType,
  datePattern: string = 'dd/MM/yyyy',
  timePattern: string = 'HH:mm'
): string {
  if (value === null || value === undefined || value === '') return ''

  // Auto format: just return string
  if (formatType === 'auto' || formatType === 'text') {
    return String(value)
  }

  // Try to parse as date
  let date: Date | null = null
  if (value instanceof Date) {
    date = value
  } else if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!isNaN(parsed.getTime())) {
      date = parsed
    }
  }

  if (!date) return String(value)

  const pad = (n: number) => n < 10 ? `0${n}` : String(n)
  const day = pad(date.getDate())
  const month = pad(date.getMonth() + 1)
  const year = String(date.getFullYear())
  const monthShort = MONTHS_SHORT[date.getMonth()]
  const hours24 = pad(date.getHours())
  const hours12 = pad(date.getHours() % 12 || 12)
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())
  const ampm = date.getHours() >= 12 ? 'PM' : 'AM'

  const formatDate = (pattern: string) => {
    return pattern
      .replace('yyyy', year)
      .replace('MMM', monthShort)  // MMM debe ir antes de MM
      .replace('MM', month)
      .replace('dd', day)
  }

  const formatTime = (pattern: string) => {
    return pattern
      .replace('HH', hours24)
      .replace('hh', hours12)
      .replace('mm', minutes)
      .replace('ss', seconds)
      .replace('a', ampm)
  }

  switch (formatType) {
    case 'date':
      return formatDate(datePattern)
    case 'time':
      return formatTime(timePattern)
    case 'datetime':
      return `${formatDate(datePattern)} ${formatTime(timePattern)}`
    default:
      return String(value)
  }
}

function formatYAxisValue(value: number, formatType: YAxisFormatType): string {
  if (value === null || value === undefined) return ''

  switch (formatType) {
    case 'auto':
      // Default behavior: compact for large numbers
      if (Math.abs(value) >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`
      if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`
      if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`
      return value.toLocaleString('es-ES')

    case 'number':
      return value.toLocaleString('es-ES')

    case 'compact':
      if (Math.abs(value) >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`
      if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`
      if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`
      return value.toString()

    case 'percent':
      return `${(value * 100).toLocaleString('es-ES', { maximumFractionDigits: 2 })}%`

    case 'percent_raw':
      return `${value.toLocaleString('es-ES', { maximumFractionDigits: 2 })}%`

    case 'currency':
      return `$${value.toLocaleString('es-ES')}`

    case 'decimal':
      return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    default:
      return value.toString()
  }
}

// ============================================================================
// SQL Generator
// ============================================================================

interface SQLGeneratorProps {
  dataset: DatasetWithMeta
  entities: Map<string, SemanticEntity>
  selectedFields: FieldItem[]
  filters?: MetricFilter[]
  allFields?: FieldItem[]
}

// Helper to generate SQL condition for a filter
function generateFilterCondition(filter: MetricFilter, allFields: FieldItem[], baseEntityId: string): string | null {
  if (!filter.field || filter.value === '' || filter.value === null) {
    // Allow operators that don't need values
    const noValueOperators = [
      'is_null', 'is_not_null',
      'today', 'yesterday',
      'last_7_days', 'last_14_days', 'last_30_days', 'last_60_days', 'last_90_days',
      'this_week', 'this_month', 'this_quarter', 'this_year',
      'last_week', 'last_month', 'last_quarter', 'last_year'
    ]
    if (!noValueOperators.includes(filter.operator)) {
      return null
    }
  }

  // Find the field to get its SQL expression
  const field = allFields.find(f => f.fieldId === filter.field)
  const fieldExpr = field?.sql?.replace(/\{TABLE\}/g, baseEntityId) || `${baseEntityId}.${filter.field}`

  switch (filter.operator) {
    // Standard operators
    case '=':
      return typeof filter.value === 'string'
        ? `${fieldExpr} = '${filter.value}'`
        : `${fieldExpr} = ${filter.value}`
    case '!=':
      return typeof filter.value === 'string'
        ? `${fieldExpr} != '${filter.value}'`
        : `${fieldExpr} != ${filter.value}`
    case '>':
      return `${fieldExpr} > ${typeof filter.value === 'string' ? `'${filter.value}'` : filter.value}`
    case '>=':
      return `${fieldExpr} >= ${typeof filter.value === 'string' ? `'${filter.value}'` : filter.value}`
    case '<':
      return `${fieldExpr} < ${typeof filter.value === 'string' ? `'${filter.value}'` : filter.value}`
    case '<=':
      return `${fieldExpr} <= ${typeof filter.value === 'string' ? `'${filter.value}'` : filter.value}`
    case 'contains':
      return `${fieldExpr} LIKE '%${filter.value}%'`
    case 'starts_with':
      return `${fieldExpr} LIKE '${filter.value}%'`
    case 'ends_with':
      return `${fieldExpr} LIKE '%${filter.value}'`
    case 'is_null':
      return `${fieldExpr} IS NULL`
    case 'is_not_null':
      return `${fieldExpr} IS NOT NULL`
    case 'between':
      if (Array.isArray(filter.value) && filter.value.length === 2) {
        return `${fieldExpr} BETWEEN '${filter.value[0]}' AND '${filter.value[1]}'`
      }
      return null

    // Date relative operators
    case 'today':
      return `${fieldExpr} = CURRENT_DATE()`
    case 'yesterday':
      return `${fieldExpr} = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)`
    case 'last_7_days':
      return `${fieldExpr} >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)`
    case 'last_14_days':
      return `${fieldExpr} >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)`
    case 'last_30_days':
      return `${fieldExpr} >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)`
    case 'last_60_days':
      return `${fieldExpr} >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)`
    case 'last_90_days':
      return `${fieldExpr} >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)`
    case 'this_week':
      return `${fieldExpr} >= DATE_TRUNC(CURRENT_DATE(), WEEK)`
    case 'this_month':
      return `${fieldExpr} >= DATE_TRUNC(CURRENT_DATE(), MONTH)`
    case 'this_quarter':
      return `${fieldExpr} >= DATE_TRUNC(CURRENT_DATE(), QUARTER)`
    case 'this_year':
      return `${fieldExpr} >= DATE_TRUNC(CURRENT_DATE(), YEAR)`
    case 'last_week':
      return `${fieldExpr} >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 WEEK), WEEK) AND ${fieldExpr} < DATE_TRUNC(CURRENT_DATE(), WEEK)`
    case 'last_month':
      return `${fieldExpr} >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), MONTH) AND ${fieldExpr} < DATE_TRUNC(CURRENT_DATE(), MONTH)`
    case 'last_quarter':
      return `${fieldExpr} >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 QUARTER), QUARTER) AND ${fieldExpr} < DATE_TRUNC(CURRENT_DATE(), QUARTER)`
    case 'last_year':
      return `${fieldExpr} >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 YEAR), YEAR) AND ${fieldExpr} < DATE_TRUNC(CURRENT_DATE(), YEAR)`

    default:
      return null
  }
}

function generateSQL({ dataset, entities, selectedFields, filters, allFields }: SQLGeneratorProps): string {
  if (selectedFields.length === 0) {
    return '-- Selecciona campos para generar SQL'
  }

  const baseEntity = entities.get(dataset.base_entity)
  if (!baseEntity) {
    return '-- Error: Entidad base no encontrada'
  }

  // Separate attributes and metrics
  const attributes = selectedFields.filter(f => f.fieldType === 'attribute')
  const metrics = selectedFields.filter(f => f.fieldType === 'metric')

  // Get unique entities used
  const usedEntityIds = new Set(selectedFields.map(f => f.entityId))

  // Build SELECT clause
  const selectParts: string[] = []

  // Add attributes (including date timeframe fields)
  for (const field of attributes) {
    const entity = entities.get(field.entityId)
    if (!entity) continue

    // Check if this is a timeframe field (e.g., fieldId = "fecha_date")
    const timeframeMatch = DATE_TIMEFRAMES.find(tf => field.fieldId.endsWith(`_${tf.value}`))
    let attrId = field.fieldId
    let timeframe: string | null = null

    if (timeframeMatch) {
      // Extract the parent attribute ID
      attrId = field.fieldId.slice(0, -(timeframeMatch.value.length + 1))
      timeframe = timeframeMatch.value
    }

    const attr = entity.attributes.find(a => a.id === attrId)
    if (!attr) continue

    const tableAlias = field.entityId
    let columnExpr: string

    if (attr.sql) {
      // Replace {TABLE} with alias
      columnExpr = attr.sql.replace(/\{TABLE\}/g, tableAlias)
    } else if (attr.field) {
      columnExpr = `${tableAlias}.${attr.field}`
    } else {
      columnExpr = `${tableAlias}.${attr.id}`
    }

    // Apply timeframe transformation for date fields
    if (timeframe) {
      switch (timeframe) {
        case 'raw':
          // No transformation, use as-is
          break
        case 'time':
          columnExpr = `TIME(${columnExpr})`
          break
        case 'datetime':
          columnExpr = `DATETIME(${columnExpr})`
          break
        case 'date':
          columnExpr = `DATE(${columnExpr})`
          break
        case 'week':
          columnExpr = `DATE_TRUNC(${columnExpr}, WEEK)`
          break
        case 'month':
          columnExpr = `DATE_TRUNC(${columnExpr}, MONTH)`
          break
        case 'quarter':
          columnExpr = `DATE_TRUNC(${columnExpr}, QUARTER)`
          break
        case 'year':
          columnExpr = `DATE_TRUNC(${columnExpr}, YEAR)`
          break
      }
    }

    selectParts.push(`  ${columnExpr} AS ${field.fieldId}`)
  }

  // Add metrics with aggregation
  for (const field of metrics) {
    const entity = entities.get(field.entityId)
    if (!entity) continue

    const metric = entity.metrics.find(m => m.id === field.fieldId)
    if (!metric) continue

    const tableAlias = field.entityId
    let columnExpr = metric.sql.replace(/\{TABLE\}/g, tableAlias)

    // Apply aggregation
    if (metric.sql_agg === 'CUSTOM') {
      // Use expression as-is
      selectParts.push(`  ${columnExpr} AS ${field.fieldId}`)
    } else if (metric.sql_agg === 'COUNT_DISTINCT') {
      selectParts.push(`  COUNT(DISTINCT ${columnExpr}) AS ${field.fieldId}`)
    } else if (metric.sql_agg === 'SUM_DISTINCT') {
      selectParts.push(`  SUM(DISTINCT ${columnExpr}) AS ${field.fieldId}`)
    } else if (metric.sql_agg === 'AVG_DISTINCT') {
      selectParts.push(`  AVG(DISTINCT ${columnExpr}) AS ${field.fieldId}`)
    } else {
      selectParts.push(`  ${metric.sql_agg}(${columnExpr}) AS ${field.fieldId}`)
    }
  }

  // Build FROM clause
  let fromClause: string
  if (baseEntity.source.type === 'derived' && baseEntity.source.sql) {
    fromClause = `(\n  ${baseEntity.source.sql}\n) AS ${baseEntity.id}`
  } else {
    fromClause = `${baseEntity.source.sql_table} AS ${baseEntity.id}`
  }

  // Build JOIN clauses
  const joinClauses: string[] = []
  for (const rel of dataset.relationships || []) {
    if (!usedEntityIds.has(rel.entity)) continue

    const joinEntity = entities.get(rel.entity)
    if (!joinEntity) continue

    const joinType = rel.join_type.toUpperCase()
    let joinTable: string

    if (joinEntity.source.type === 'derived' && joinEntity.source.sql) {
      joinTable = `(\n    ${joinEntity.source.sql}\n  )`
    } else {
      joinTable = joinEntity.source.sql_table || rel.entity
    }

    // Replace {TABLE} references in sql_on
    const onClause = rel.sql_on
      .replace(/\{BASE\}/g, dataset.base_entity)
      .replace(/\{TABLE\}/g, rel.entity)

    joinClauses.push(`${joinType} JOIN ${joinTable} AS ${rel.entity}\n  ON ${onClause}`)
  }

  // Build WHERE clause from filters
  let whereClause = ''
  if (filters && filters.length > 0 && allFields) {
    const conditions = filters
      .map(f => generateFilterCondition(f, allFields, baseEntity.id))
      .filter(Boolean)

    if (conditions.length > 0) {
      whereClause = `WHERE\n  ${conditions.join('\n  AND ')}`
    }
  }

  // Build GROUP BY clause (always group by attributes to get distinct values)
  let groupByClause = ''
  if (attributes.length > 0) {
    const groupByParts = attributes.map((_, idx) => (idx + 1).toString())
    groupByClause = `GROUP BY\n  ${groupByParts.join(', ')}`
  }

  // Assemble final SQL
  const sql = [
    'SELECT',
    selectParts.join(',\n'),
    'FROM',
    `  ${fromClause}`,
    ...joinClauses.map(j => j),
    whereClause,
    groupByClause,
  ].filter(Boolean).join('\n')

  return sql
}

// ============================================================================
// Data Explorer Panel (Right Side)
// ============================================================================

interface DataExplorerPanelProps {
  dataset: DatasetWithMeta
  entities: Map<string, SemanticEntity>
  selectedFields: Set<string>
  fieldSelectionOrder: string[] // Explicit order of field selection
  allFields: FieldItem[]
  metricFormats: Record<string, MetricFormat>
  pivotField: string | null // Full field ID for pivot (e.g., "entity.field_timeframe")
  filters: MetricFilter[]
  onFiltersChange: (filters: MetricFilter[]) => void
  autoRunPending?: boolean // If true, auto-run query when ready
  onAutoRunComplete?: () => void // Callback when auto-run is complete
  // Dashboard integration props
  embedded?: boolean
  onAddToDashboard?: (vizData: DashboardVizData) => void
  // Viz title props
  vizTitle?: string
  onVizTitleChange?: (title: string) => void
  // Initial config for editing existing viz
  initialConfig?: VizConfig
  // Optional: Hide dataset info (breadcrumb, title, description) in header
  hideDatasetInfo?: boolean
  // Period comparison (lifted to parent VizBuilder)
  comparisonConfig: ComparisonConfig
  setComparisonConfig: React.Dispatch<React.SetStateAction<ComparisonConfig>>
}

function DataExplorerPanel({ dataset, entities, selectedFields, fieldSelectionOrder, allFields, metricFormats, pivotField, filters, onFiltersChange, autoRunPending, onAutoRunComplete, embedded, onAddToDashboard, vizTitle, onVizTitleChange, initialConfig, hideDatasetInfo = false, comparisonConfig, setComparisonConfig }: DataExplorerPanelProps) {
  // Get auth context (currentUser and currentTenant)
  const { currentUser, currentTenant } = useAuth()

  const [showSqlModal, setShowSqlModal] = useState(false)
  const [sqlCopied, setSqlCopied] = useState(false)
  const [showTotals, setShowTotals] = useState(false)
  const [rowLimit, setRowLimit] = useState(500)
  const [rowLimitInput, setRowLimitInput] = useState('500')
  const [filtrosHeight, setFiltrosHeight] = useState(150)
  const [datosHeight, setDatosHeight] = useState(300)

  // Query execution state
  const [dataRows, setDataRows] = useState<Record<string, unknown>[]>([])
  const [columns, setColumns] = useState<QueryColumnInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rowCount, setRowCount] = useState<number | null>(null)
  const [executedSQL, setExecutedSQL] = useState<string | null>(null)

  // Visualization state
  const [vizType, setVizType] = useState<'line' | 'column' | 'area' | 'pie' | 'single' | 'progress' | 'table' | 'scatter' | null>(null)
  const [showVizOptions, setShowVizOptions] = useState(false)
  const [vizOptionsTab, setVizOptionsTab] = useState<'general' | 'series' | 'data' | 'x' | 'y' | 'format'>('general')
  const [treatNullsAsZero, setTreatNullsAsZero] = useState(true) // Default to true
  const [pointStyle, setPointStyle] = useState<'filled' | 'outline' | 'none'>('filled')
  const [areaFillType, setAreaFillType] = useState<'solid' | 'gradient'>('solid')
  const [pieInnerRadius, setPieInnerRadius] = useState<number>(0)
  const [chartRowLimit, setChartRowLimit] = useState<number>(6) // default to 6 rows
  const [chartRowLimitEnabled, setChartRowLimitEnabled] = useState<boolean>(false) // disabled by default
  const [seriesConfig, setSeriesConfig] = useState<Record<string, { label?: string; color?: string; format?: MetricFormat; thresholds?: ThresholdConfig[]; align?: 'left' | 'center' | 'right'; fontSize?: 'xs' | 'sm' | 'base' | 'lg' }>>({})
  const [expandedSeries, setExpandedSeries] = useState<string | null>(null)
  const [showDataLabels, setShowDataLabels] = useState(false)
  const [showXGridLines, setShowXGridLines] = useState(true)
  const [showYGridLines, setShowYGridLines] = useState(true)
  // X-Axis format state
  const [xAxisFormatType, setXAxisFormatType] = useState<XAxisFormatType>('auto')
  const [xAxisDatePattern, setXAxisDatePattern] = useState('dd/MM/yyyy')
  const [xAxisTimePattern, setXAxisTimePattern] = useState('HH:mm')
  // Y-Axis format state
  const [yAxisFormatType, setYAxisFormatType] = useState<YAxisFormatType>('auto')
  // Reference line state (horizontal line at a specific Y value)
  const [referenceLineYEnabled, setReferenceLineYEnabled] = useState(false)
  const [referenceLineYValue, setReferenceLineYValue] = useState<number | ''>('')
  const [referenceLineYColor, setReferenceLineYColor] = useState('#EF4444') // Red by default
  // Reference line state for X axis (vertical line at a specific X value/index)
  const [referenceLineXEnabled, setReferenceLineXEnabled] = useState(false)
  const [referenceLineXValue, setReferenceLineXValue] = useState<string>('')
  const [referenceLineXColor, setReferenceLineXColor] = useState('#8B5CF6') // Purple by default
  // Hidden series state (for legend toggle)
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set())
  // Single value options
  const [singleValueLabel, setSingleValueLabel] = useState<string>('')
  const [singleValueLabelPosition, setSingleValueLabelPosition] = useState<'above' | 'below'>('above')
  const [singleValueColor, setSingleValueColor] = useState<string>('#3B82F6')
  const [singleValueLabelBold, setSingleValueLabelBold] = useState<boolean>(false)
  const [singleValueFormat, setSingleValueFormat] = useState<'auto' | 'number' | 'compact' | 'percent' | 'currency'>('auto')
  const [singleValueDecimalSeparator, setSingleValueDecimalSeparator] = useState<'dot' | 'comma'>('dot')
  const [singleValueDecimalPlaces, setSingleValueDecimalPlaces] = useState<number>(0)
  const [singleValueThresholds, setSingleValueThresholds] = useState<Array<{ min: number | null; max: number | null; color: string }>>([])
  const [singleValueUseThresholds, setSingleValueUseThresholds] = useState<boolean>(false)
  // Progress bar chart options
  const [progressBarFontSize, setProgressBarFontSize] = useState<number>(14)
  const [progressBarShowValues, setProgressBarShowValues] = useState<boolean>(false)
  const [progressBarThresholds, setProgressBarThresholds] = useState<Array<{ min: number | null; max: number | null; color: string }>>([])
  const [progressBarUseThresholds, setProgressBarUseThresholds] = useState<boolean>(false)
  // Table visualization options
  const [tableShowHeader, setTableShowHeader] = useState<boolean>(true)
  const [tableStriped, setTableStriped] = useState<boolean>(true)
  const [tableCompact, setTableCompact] = useState<boolean>(false)
  const [tableSortable, setTableSortable] = useState<boolean>(true)
  const [tableShowRowNumbers, setTableShowRowNumbers] = useState<boolean>(false)
  const [tableHeaderBg, setTableHeaderBg] = useState<'white' | 'gray' | 'black'>('gray')
  const [tableHeaderAlign, setTableHeaderAlign] = useState<'left' | 'center' | 'right'>('left')
  const [tableFontSize, setTableFontSize] = useState<'xs' | 'sm' | 'base' | 'lg'>('sm')
  const [tableColumnWidths, setTableColumnWidths] = useState<Record<string, number>>({})
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const [resizeStartX, setResizeStartX] = useState<number>(0)
  const [resizeStartWidth, setResizeStartWidth] = useState<number>(0)

  // Save Viz modal state
  const [showSaveVizModal, setShowSaveVizModal] = useState(false)
  const [saveVizName, setSaveVizName] = useState('')
  const [saveVizDescription, setSaveVizDescription] = useState('')
  const [saveVizFolderId, setSaveVizFolderId] = useState<string | null>(null)
  const [savingViz, setSavingViz] = useState(false)
  const [saveVizError, setSaveVizError] = useState<string | null>(null)
  const [folders, setFolders] = useState<FolderListItem[]>([])
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Multi-column sorting state
  const [sortConfig, setSortConfig] = useState<Array<{ field: string; direction: 'ASC' | 'DESC' }>>([])

  // Column order state for drag & drop
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  // Period over Period comparison info from backend response
  const [_comparisonInfo, setComparisonInfo] = useState<QueryComparisonInfo | null>(null)
  void _comparisonInfo // Used for storing comparison info for future display

  // Listen for viz config from loaded viz
  useEffect(() => {
    const handleApplyVizConfig = (event: CustomEvent<VizConfig>) => {
      const config = event.detail

      // Apply viz type
      setVizType(config.vizType)

      // Apply chart settings based on type
      if (config.chartSettings) {
        const settings = config.chartSettings

        if (settings.type === 'line' && 'showDots' in settings.settings) {
          const s = settings.settings
          setPointStyle(s.showDots ? 'filled' : 'none')
          // curved and fillArea could be added if needed
        } else if (settings.type === 'column' && 'stacked' in settings.settings) {
          // Column settings - stacked is handled differently
        } else if (settings.type === 'area' && 'opacity' in settings.settings) {
          // Area settings
        } else if (settings.type === 'pie' && 'innerRadius' in settings.settings) {
          const s = settings.settings
          setPieInnerRadius(s.innerRadius || 0)
        } else if (settings.type === 'single' && 'label' in settings.settings) {
          const s = settings.settings
          setSingleValueLabel(s.label || '')
          setSingleValueLabelPosition(s.labelPosition || 'above')
          setSingleValueColor(s.color || '#3B82F6')
          setSingleValueLabelBold(s.labelBold || false)
          setSingleValueFormat(s.format || 'auto')
          setSingleValueDecimalSeparator(s.decimalSeparator || 'dot')
          setSingleValueDecimalPlaces(s.decimalPlaces || 0)
          setSingleValueUseThresholds(s.useThresholds || false)
          if (s.thresholds) {
            setSingleValueThresholds(s.thresholds)
          }
        } else if (settings.type === 'progress' && 'fontSize' in settings.settings) {
          const s = settings.settings
          setProgressBarFontSize(s.fontSize || 14)
          setProgressBarShowValues(s.showValues || false)
          setProgressBarUseThresholds(s.useThresholds || false)
          if (s.thresholds) {
            setProgressBarThresholds(s.thresholds)
          }
        }
      }

      // Apply chart row limit
      if (config.chartRowLimit) {
        setChartRowLimit(config.chartRowLimit)
      }
      if (config.chartRowLimitEnabled !== undefined) {
        setChartRowLimitEnabled(config.chartRowLimitEnabled)
      }

      // Apply X-Axis format
      if (config.xAxisFormat) {
        setXAxisFormatType(config.xAxisFormat.type as XAxisFormatType || 'auto')
        if (config.xAxisFormat.dateFormat) {
          setXAxisDatePattern(config.xAxisFormat.dateFormat)
        }
        if (config.xAxisFormat.labelRotation !== undefined) {
          // Label rotation if needed
        }
      }

      // Note: auto-run is now handled by a separate useEffect that watches for autoRunPending
    }

    window.addEventListener('apply-viz-config', handleApplyVizConfig as EventListener)

    return () => {
      window.removeEventListener('apply-viz-config', handleApplyVizConfig as EventListener)
    }
  }, [])

  // Track if initialConfig has been applied
  const initialConfigAppliedRef = useRef<string | null>(null)

  // Apply initial config for viz settings when editing existing viz
  useEffect(() => {
    if (!initialConfig) return

    // Create a key to track which config we've applied
    const configKey = JSON.stringify({
      vizType: initialConfig.vizType,
      chartSettings: initialConfig.chartSettings,
      orderBy: initialConfig.orderBy,
      rowLimit: initialConfig.rowLimit,
      chartRowLimit: initialConfig.chartRowLimit,
      xAxisFormat: initialConfig.xAxisFormat,
    })

    // Skip if we've already applied this config
    if (initialConfigAppliedRef.current === configKey) return
    initialConfigAppliedRef.current = configKey

    // Apply viz type
    setVizType(initialConfig.vizType)

    // Apply chart settings based on type
    if (initialConfig.chartSettings) {
      const settings = initialConfig.chartSettings

      if (settings.type === 'line' && 'showDots' in settings.settings) {
        const s = settings.settings
        setPointStyle(s.showDots ? 'filled' : 'none')
        setShowXGridLines(s.showGrid)
        setShowYGridLines(s.showGrid)
      } else if (settings.type === 'column' && 'stacked' in settings.settings) {
        const s = settings.settings
        setShowXGridLines(s.showGrid)
        setShowYGridLines(s.showGrid)
      } else if (settings.type === 'area' && 'opacity' in settings.settings) {
        const s = settings.settings
        setShowXGridLines(s.showGrid)
        setShowYGridLines(s.showGrid)
      } else if (settings.type === 'pie' && 'innerRadius' in settings.settings) {
        const s = settings.settings
        setPieInnerRadius(s.innerRadius || 0)
      } else if (settings.type === 'single' && 'label' in settings.settings) {
        const s = settings.settings
        setSingleValueLabel(s.label || '')
        setSingleValueLabelPosition(s.labelPosition || 'above')
        setSingleValueColor(s.color || '#3B82F6')
        setSingleValueLabelBold(s.labelBold || false)
        setSingleValueFormat(s.format || 'auto')
        setSingleValueDecimalSeparator(s.decimalSeparator || 'dot')
        setSingleValueDecimalPlaces(s.decimalPlaces || 0)
        setSingleValueUseThresholds(s.useThresholds || false)
        if (s.thresholds) {
          setSingleValueThresholds(s.thresholds)
        }
      } else if (settings.type === 'progress' && 'fontSize' in settings.settings) {
        const s = settings.settings
        setProgressBarFontSize(s.fontSize || 14)
        setProgressBarShowValues(s.showValues || false)
        setProgressBarUseThresholds(s.useThresholds || false)
        if (s.thresholds) {
          setProgressBarThresholds(s.thresholds)
        }
      }
    }

    // Apply chart row limit
    if (initialConfig.chartRowLimit) {
      setChartRowLimit(initialConfig.chartRowLimit)
    }
    if (initialConfig.chartRowLimitEnabled !== undefined) {
      setChartRowLimitEnabled(initialConfig.chartRowLimitEnabled)
    }

    // Apply X-Axis format
    if (initialConfig.xAxisFormat) {
      setXAxisFormatType(initialConfig.xAxisFormat.type as XAxisFormatType || 'auto')
      if (initialConfig.xAxisFormat.dateFormat) {
        setXAxisDatePattern(initialConfig.xAxisFormat.dateFormat)
      }
    }

    // Apply row limit
    if (initialConfig.rowLimit) {
      setRowLimit(initialConfig.rowLimit)
      setRowLimitInput(String(initialConfig.rowLimit))
    }

    // Apply sort/order config
    if (initialConfig.orderBy && initialConfig.orderBy.length > 0) {
      setSortConfig(initialConfig.orderBy)
    }
  }, [initialConfig])

  // Update column order when columns change - always add new columns at the end
  useEffect(() => {
    if (columns.length > 0) {
      setColumnOrder(prev => {
        const existingIds = new Set(columns.map(c => c.id))
        const validExisting = prev.filter(id => existingIds.has(id))
        const newIds = columns.map(c => c.id).filter(id => !validExisting.includes(id))

        // If no new columns, just keep valid existing order
        if (newIds.length === 0) {
          return validExisting
        }

        // Build a map from short ID to index in fieldSelectionOrder
        // fieldSelectionOrder has full IDs like "entity.field_timeframe"
        // columns have short IDs like "field_timeframe"
        const shortIdToSelectionIndex = new Map<string, number>()
        for (let i = 0; i < fieldSelectionOrder.length; i++) {
          const fullId = fieldSelectionOrder[i]
          // Extract the short ID from the full ID
          // For regular fields: "entity.field" -> "field"
          // For timeframe fields: "entity.field_timeframe" -> "field_timeframe"
          const shortId = fullId.includes('.') ? fullId.split('.').slice(1).join('.') : fullId
          shortIdToSelectionIndex.set(shortId, i)
        }

        // Sort new columns based on their position in fieldSelectionOrder
        const sortedNewIds = [...newIds].sort((a, b) => {
          const indexA = shortIdToSelectionIndex.get(a)
          const indexB = shortIdToSelectionIndex.get(b)
          if (indexA !== undefined && indexB !== undefined) return indexA - indexB
          if (indexA !== undefined) return -1
          if (indexB !== undefined) return 1
          return 0
        })

        return [...validExisting, ...sortedNewIds]
      })
    }
  }, [columns, fieldSelectionOrder])

  // Get ordered columns based on fieldSelectionOrder, including newly selected fields
  const orderedColumns = useMemo(() => {
    // Create a map of existing columns from API response (keys are short IDs like "date_time")
    const apiColumnMap = new Map(columns.map(c => [c.id, c]))

    // Build a map from full field ID to short field ID
    // e.g., "fact_meta_performance_ad.date" -> "date"
    const fullToShortId = new Map<string, string>()
    for (const field of allFields) {
      fullToShortId.set(field.id, field.fieldId)
    }

    // Build complete column list from fieldSelectionOrder
    // This includes both columns with data AND newly selected fields without data
    const allColumns: QueryColumnInfo[] = []
    const addedColumnIds = new Set<string>() // Track added column IDs to avoid duplicates

    for (const fullFieldId of fieldSelectionOrder) {
      // Get the short ID for this field
      let shortId = fullToShortId.get(fullFieldId)

      // If not found in allFields, check if it's a timeframe field
      if (!shortId) {
        const timeframeMatch = DATE_TIMEFRAMES.find(tf => fullFieldId.endsWith(`_${tf.value}`))
        if (timeframeMatch) {
          const parentFullId = fullFieldId.slice(0, -(timeframeMatch.value.length + 1))
          const parentShortId = fullToShortId.get(parentFullId)
          if (parentShortId) {
            shortId = `${parentShortId}_${timeframeMatch.value}`
          }
        }
      }

      // Check if we have this column from the API using the short ID
      const apiColumn = shortId ? apiColumnMap.get(shortId) : undefined
      if (apiColumn) {
        // Avoid adding duplicate columns
        if (!addedColumnIds.has(apiColumn.id)) {
          allColumns.push(apiColumn)
          addedColumnIds.add(apiColumn.id)
        }
      } else {
        // This is a newly selected field - create a column for it
        // Use the short ID so it matches the data keys when query runs
        const field = allFields.find(f => f.id === fullFieldId)
        if (field) {
          // Avoid adding duplicate columns
          if (!addedColumnIds.has(field.fieldId)) {
            allColumns.push({
              id: field.fieldId, // Use short ID, not full ID
              label: field.label,
              type: field.fieldType === 'metric' ? 'number' : 'string',
              format: undefined
            })
            addedColumnIds.add(field.fieldId)
          }
        } else {
          // Check if this is a date timeframe field (format: entity.field_timeframe)
          const timeframeMatch = DATE_TIMEFRAMES.find(tf => fullFieldId.endsWith(`_${tf.value}`))
          if (timeframeMatch) {
            const parentFullId = fullFieldId.slice(0, -(timeframeMatch.value.length + 1))
            const parentField = allFields.find(f => f.id === parentFullId)
            if (parentField) {
              // Use short ID: parentFieldId_timeframe
              const columnShortId = `${parentField.fieldId}_${timeframeMatch.value}`
              // Avoid adding duplicate columns
              if (!addedColumnIds.has(columnShortId)) {
                allColumns.push({
                  id: columnShortId,
                  label: `${parentField.label} (${timeframeMatch.label})`,
                  type: 'string',
                  format: undefined
                })
                addedColumnIds.add(columnShortId)
              }
            } else {
              // Fallback: extract short ID from full field ID
              const fallbackShortId = fullFieldId.split('.').pop() || fullFieldId
              // Avoid adding duplicate columns
              if (!addedColumnIds.has(fallbackShortId)) {
                allColumns.push({
                  id: fallbackShortId,
                  label: fallbackShortId,
                  type: 'string',
                  format: undefined
                })
                addedColumnIds.add(fallbackShortId)
              }
            }
          } else {
            // Check if this is a comparison variant field (format: entity.field_variant)
            const VARIANT_SUFFIXES_FOR_COLS: MetricVariant[] = ['previous', 'delta', 'delta_pct']
            const variantMatch = VARIANT_SUFFIXES_FOR_COLS.find(v => fullFieldId.endsWith(`_${v}`))
            if (variantMatch) {
              const parentFullId = fullFieldId.slice(0, -(variantMatch.length + 1))
              const parentField = allFields.find(f => f.id === parentFullId)
              if (parentField && parentField.fieldType === 'metric') {
                // Use short ID: parentFieldId_variant
                const columnShortId = `${parentField.fieldId}_${variantMatch}`
                // Avoid adding duplicate columns
                if (!addedColumnIds.has(columnShortId)) {
                  allColumns.push({
                    id: columnShortId,
                    label: `${parentField.label} (${METRIC_VARIANT_LABELS[variantMatch].shortLabel})`,
                    type: variantMatch === 'delta_pct' ? 'percent' : 'number',
                    format: variantMatch === 'delta_pct' ? 'percent' : undefined
                  })
                  addedColumnIds.add(columnShortId)
                }
              }
            }
          }
        }
      }
    }

    // Add any comparison variant columns from the API response
    // These are columns like "metric_current", "metric_previous", "metric_delta", "metric_delta_pct"
    // They come from the comparison query and are already in the columns array
    for (const apiCol of columns) {
      if (!addedColumnIds.has(apiCol.id)) {
        // Check if this is a comparison column (ends with _current, _previous, _delta, _delta_pct)
        if (apiCol.id.endsWith('_current') || apiCol.id.endsWith('_previous') ||
            apiCol.id.endsWith('_delta') || apiCol.id.endsWith('_delta_pct')) {
          allColumns.push(apiCol)
          addedColumnIds.add(apiCol.id)
        }
      }
    }

    // If columnOrder exists (from drag-n-drop), reorder accordingly
    if (columnOrder.length > 0) {
      const columnMap = new Map(allColumns.map(c => [c.id, c]))
      const orderedByDrag = columnOrder
        .map(id => columnMap.get(id))
        .filter((c): c is QueryColumnInfo => c !== undefined)

      // Add any columns not in columnOrder (newly added) at the end
      const inOrder = new Set(columnOrder)
      const newColumns = allColumns.filter(c => !inOrder.has(c.id))

      return [...orderedByDrag, ...newColumns]
    }

    return allColumns
  }, [columns, columnOrder, fieldSelectionOrder, allFields])

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    setDraggedColumn(columnId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', columnId)
  }

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    if (draggedColumn && draggedColumn !== columnId) {
      setDragOverColumn(columnId)
    }
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault()
    if (!draggedColumn || draggedColumn === targetColumnId) return

    setColumnOrder(prev => {
      // If columnOrder is empty, initialize it from current orderedColumns
      const currentOrder = prev.length > 0 ? [...prev] : orderedColumns.map(c => c.id)

      const draggedIndex = currentOrder.indexOf(draggedColumn)
      const targetIndex = currentOrder.indexOf(targetColumnId)

      if (draggedIndex !== -1 && targetIndex !== -1) {
        currentOrder.splice(draggedIndex, 1)
        currentOrder.splice(targetIndex, 0, draggedColumn)
      }

      return currentOrder
    })

    setDraggedColumn(null)
    setDragOverColumn(null)
  }

  const handleDragEnd = () => {
    setDraggedColumn(null)
    setDragOverColumn(null)
  }

  // Add a new filter
  const addFilter = () => {
    onFiltersChange([...filters, { field: '', operator: '=', value: '' }])
  }

  // Update a filter
  const updateFilter = (index: number, updates: Partial<MetricFilter>) => {
    const updated = [...filters]
    updated[index] = { ...updated[index], ...updates }
    onFiltersChange(updated)
  }

  // Remove a filter
  const removeFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index))
  }

  // Date operators that don't require a value (they are self-contained)
  const dateOperatorsNoValue = [
    'today', 'yesterday',
    'last_7_days', 'last_14_days', 'last_30_days', 'last_60_days', 'last_90_days',
    'this_week', 'this_month', 'this_quarter', 'this_year',
    'last_week', 'last_month', 'last_quarter', 'last_year'
  ]

  // Get valid filters (those with field and value set, or date operators that don't need a value)
  const validFilters = filters.filter(f => {
    if (!f.field) return false
    // Date operators that don't require a value
    if (dateOperatorsNoValue.includes(f.operator as string)) return true
    // Other operators require a non-empty value
    return f.value !== '' && f.value !== null
  })

  // Sort handler - cycles through: none -> asc -> desc -> none
  const handleSort = (fieldId: string) => {
    setSortConfig(prev => {
      const existingIndex = prev.findIndex(s => s.field === fieldId)

      if (existingIndex === -1) {
        // Not in sort config - add as ascending
        return [...prev, { field: fieldId, direction: 'ASC' }]
      }

      const existing = prev[existingIndex]
      if (existing.direction === 'ASC') {
        // Currently ascending - switch to descending
        const updated = [...prev]
        updated[existingIndex] = { field: fieldId, direction: 'DESC' }
        return updated
      }

      // Currently descending - remove from sort config
      return prev.filter(s => s.field !== fieldId)
    })
  }

  // Get sort info for a column
  const getSortInfo = (fieldId: string): { order: number; direction: 'ASC' | 'DESC' } | null => {
    const index = sortConfig.findIndex(s => s.field === fieldId)
    if (index === -1) return null
    return { order: index + 1, direction: sortConfig[index].direction }
  }

  // Get selected field items (including date timeframe fields and comparison variant fields)
  const selectedFieldItems = useMemo(() => {
    const items: FieldItem[] = []
    const seenIds = new Set<string>()

    // Comparison variant suffixes
    const VARIANT_SUFFIXES: MetricVariant[] = ['previous', 'delta', 'delta_pct']

    console.log('🔍 [selectedFieldItems] Processing selectedFields:', Array.from(selectedFields))

    for (const fieldId of selectedFields) {
      // Skip if already added (prevent duplicates)
      if (seenIds.has(fieldId)) continue

      // Check if it's a regular field
      const regularField = allFields.find(f => f.id === fieldId)
      if (regularField) {
        items.push(regularField)
        seenIds.add(fieldId)
      } else {
        // Check if it's a date timeframe field (format: entity.field_timeframe)
        const timeframeMatch = DATE_TIMEFRAMES.find(tf => fieldId.endsWith(`_${tf.value}`))
        if (timeframeMatch) {
          // Extract the parent field ID
          const parentFieldId = fieldId.slice(0, -(timeframeMatch.value.length + 1))
          const parentField = allFields.find(f => f.id === parentFieldId)
          if (parentField) {
            // Create a virtual FieldItem for this timeframe
            items.push({
              id: fieldId,
              fieldId: `${parentField.fieldId}_${timeframeMatch.value}`,
              label: `${parentField.label} (${timeframeMatch.label})`,
              type: timeframeMatch.value,
              fieldType: 'attribute',
              entityId: parentField.entityId,
              entityLabel: parentField.entityLabel,
              group: parentField.group,
            })
            seenIds.add(fieldId)
          }
        } else {
          // Check if it's a comparison variant field (format: entity.field_variant)
          const variantMatch = VARIANT_SUFFIXES.find(v => fieldId.endsWith(`_${v}`))
          if (variantMatch) {
            // Extract the parent field ID
            const parentFieldId = fieldId.slice(0, -(variantMatch.length + 1))
            const parentField = allFields.find(f => f.id === parentFieldId)
            console.log('🔍 [selectedFieldItems] Variant field check:', {
              fieldId,
              variantMatch,
              parentFieldId,
              parentFieldFound: !!parentField,
              parentFieldType: parentField?.fieldType
            })
            if (parentField && parentField.fieldType === 'metric') {
              // Create a virtual FieldItem for this comparison variant
              const virtualField = {
                id: fieldId,
                fieldId: `${parentField.fieldId}_${variantMatch}`,
                label: `${parentField.label} (${METRIC_VARIANT_LABELS[variantMatch].shortLabel})`,
                type: variantMatch === 'delta_pct' ? 'percent' : 'number',
                fieldType: 'metric' as const,
                entityId: parentField.entityId,
                entityLabel: parentField.entityLabel,
                group: parentField.group,
              }
              console.log('🔍 [selectedFieldItems] Created virtual variant field:', virtualField)
              items.push(virtualField)
              seenIds.add(fieldId)
            }
          }
        }
      }
    }

    console.log('🔍 [selectedFieldItems] Final items:', items.map(i => ({ id: i.id, fieldId: i.fieldId, label: i.label, fieldType: i.fieldType })))
    return items
  }, [allFields, selectedFields])

  // Generate SQL
  const generatedSQL = useMemo(() => {
    return generateSQL({ dataset, entities, selectedFields: selectedFieldItems, filters, allFields })
  }, [dataset, entities, selectedFieldItems, filters, allFields])

  // Separate attributes and metrics for display (memoized to prevent infinite loops in useEffect)
  const selectedAttributes = useMemo(() =>
    selectedFieldItems.filter(f => f.fieldType === 'attribute'),
    [selectedFieldItems]
  )
  const selectedMetrics = useMemo(() =>
    selectedFieldItems.filter(f => f.fieldType === 'metric'),
    [selectedFieldItems]
  )

  // ALL attributes and metrics for filter dropdown (not just selected)
  const allAttributes = useMemo(() =>
    allFields.filter(f => f.fieldType === 'attribute'),
    [allFields]
  )
  const allMetrics = useMemo(() =>
    allFields.filter(f => f.fieldType === 'metric'),
    [allFields]
  )

  // Attributes with date transformations for filter dropdown
  // Groups date fields with their transformations (raw, time, datetime, date, week, month, quarter, year)
  const attributesWithDateTransforms = useMemo(() => {
    const result: { field: FieldItem; transforms?: { id: string; fieldId: string; label: string }[] }[] = []

    for (const field of allAttributes) {
      if (isDateLikeType(field.type)) {
        // Date/timestamp field: add with transforms
        const transforms = DATE_TIMEFRAMES.map(tf => ({
          id: `${field.id}_${tf.value}`,
          fieldId: `${field.fieldId}_${tf.value}`,
          label: tf.label
        }))
        result.push({ field, transforms })
      } else {
        // Non-date field: add without transforms
        result.push({ field })
      }
    }

    return result
  }, [allAttributes])

  // Build a map from fieldId to the user-selected format
  const fieldIdToFormat = useMemo(() => {
    const map: Record<string, MetricFormat> = {}
    for (const metric of selectedMetrics) {
      const format = metricFormats[metric.id] || 'number'
      map[metric.fieldId] = format
    }
    return map
  }, [selectedMetrics, metricFormats])

  // Sort data locally based on sortConfig
  const sortedDataRows = useMemo(() => {
    if (sortConfig.length === 0 || dataRows.length === 0) return dataRows

    return [...dataRows].sort((a, b) => {
      for (const { field, direction } of sortConfig) {
        const aVal = a[field]
        const bVal = b[field]

        // Handle null/undefined
        if (aVal == null && bVal == null) continue
        if (aVal == null) return direction === 'ASC' ? 1 : -1
        if (bVal == null) return direction === 'ASC' ? -1 : 1

        // Compare values
        let comparison = 0
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal
        } else {
          comparison = String(aVal).localeCompare(String(bVal))
        }

        if (comparison !== 0) {
          return direction === 'ASC' ? comparison : -comparison
        }
      }
      return 0
    })
  }, [dataRows, sortConfig])

  // Process data for charts - convert nulls to zeros if option is enabled and apply row limit
  const chartData = useMemo(() => {
    // Apply row limit only if enabled
    let data = chartRowLimitEnabled ? sortedDataRows.slice(0, chartRowLimit) : sortedDataRows

    if (!treatNullsAsZero) return data

    return data.map(row => {
      const newRow: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(row)) {
        // Convert null/undefined to 0 for numeric fields (metrics)
        newRow[key] = value == null ? 0 : value
      }
      return newRow
    })
  }, [sortedDataRows, treatNullsAsZero, chartRowLimit, chartRowLimitEnabled])

  // Calculate totals for metric columns (moved here so it can be used in the dashboard event)
  const columnTotalsForDashboard = useMemo(() => {
    const totals: Record<string, number> = {}
    if (dataRows.length === 0 || orderedColumns.length === 0) return totals

    for (const col of orderedColumns) {
      const isMetric = col.type === 'number' || col.type === 'currency' || col.type === 'percent'
      if (isMetric) {
        let sum = 0
        for (const row of dataRows) {
          const val = row[col.id]
          if (typeof val === 'number') {
            sum += val
          } else if (typeof val === 'string') {
            const parsed = parseFloat(val)
            if (!isNaN(parsed)) sum += parsed
          }
        }
        totals[col.id] = sum
      }
    }
    return totals
  }, [dataRows, orderedColumns])

  // Emit viz data to parent when in embedded mode (for dashboard integration)
  useEffect(() => {
    if (!embedded || !onAddToDashboard || !vizType || chartData.length === 0) return

    // Debug: Log sortConfig when emitting
    console.log('📊 VizBuilder emitting vizData - sortConfig:', sortConfig, 'rowLimit:', rowLimit)

    // Create the viz data object
    const vizData: DashboardVizData = {
      datasetId: dataset.id,
      datasetLabel: dataset.label,
      vizType,
      chartData,
      selectedMetrics: selectedMetrics.map(m => ({ fieldId: m.fieldId, label: m.label, entityId: m.entityId })),
      selectedAttributes: selectedAttributes.map(a => ({ fieldId: a.fieldId, label: a.label, entityId: a.entityId })),
      seriesConfig,
      chartSettings: {
        showDataLabels,
        showXGridLines,
        showYGridLines,
        pointStyle,
        pieInnerRadius,
        yAxisFormatType,
        areaFillType,
        treatNullsAsZero,
        // Reference line Y (horizontal) for line/column/area charts
        referenceLineY: referenceLineYEnabled && referenceLineYValue !== '' ? {
          enabled: true,
          value: referenceLineYValue as number,
          color: referenceLineYColor,
        } : undefined,
        // Reference line X (vertical) for line/column/area charts
        referenceLineX: referenceLineXEnabled && referenceLineXValue !== '' ? {
          enabled: true,
          value: referenceLineXValue,
          color: referenceLineXColor,
        } : undefined,
      },
      filters,
      // Include order and limit settings
      orderBy: sortConfig.length > 0 ? sortConfig : undefined,
      rowLimit,
      // Include chart display settings
      chartRowLimit,
      chartRowLimitEnabled,
      xAxisFormat: {
        type: xAxisFormatType,
        dateFormat: xAxisFormatType === 'date' ? xAxisDatePattern : xAxisFormatType === 'datetime' ? `${xAxisDatePattern} ${xAxisTimePattern}` : undefined,
      },
      // Include single value settings
      singleValueSettings: vizType === 'single' ? {
        label: singleValueLabel,
        labelPosition: singleValueLabelPosition,
        color: singleValueColor,
        labelBold: singleValueLabelBold,
        format: singleValueFormat,
        decimalSeparator: singleValueDecimalSeparator,
        decimalPlaces: singleValueDecimalPlaces,
      } : undefined,
      // Include table settings
      tableSettings: vizType === 'table' ? {
        fontSize: tableFontSize,
        headerBg: tableHeaderBg,
        headerAlign: tableHeaderAlign,
        showHeader: tableShowHeader,
        showRowNumbers: tableShowRowNumbers,
        striped: tableStriped,
        showTotals,
        columnWidths: tableColumnWidths,
      } : undefined,
      // Include column totals for table
      columnTotals: vizType === 'table' && showTotals ? columnTotalsForDashboard : undefined,
      // Include viz title for dashboard
      vizTitle,
    }

    // Dispatch custom event that DashboardEditor can listen to
    window.dispatchEvent(new CustomEvent('dashboard-viz-ready', { detail: vizData }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, vizType, chartData, selectedMetrics, selectedAttributes, seriesConfig, showDataLabels, showXGridLines, showYGridLines, pointStyle, pieInnerRadius, yAxisFormatType, areaFillType, treatNullsAsZero, dataset.id, filters, sortConfig, rowLimit, chartRowLimit, chartRowLimitEnabled, xAxisFormatType, xAxisDatePattern, xAxisTimePattern, singleValueLabel, singleValueLabelPosition, singleValueColor, singleValueLabelBold, singleValueFormat, singleValueDecimalSeparator, singleValueDecimalPlaces, vizTitle, tableFontSize, tableHeaderBg, tableHeaderAlign, tableShowHeader, tableShowRowNumbers, tableStriped, showTotals, tableColumnWidths, columnTotalsForDashboard, referenceLineYEnabled, referenceLineYValue, referenceLineYColor, referenceLineXEnabled, referenceLineXValue, referenceLineXColor])

  // Get pivot field info
  const pivotFieldInfo = useMemo(() => {
    if (!pivotField) return null
    // Find the field in allFields
    const field = allFields.find(f => f.id === pivotField)
    if (field) {
      return { fullId: pivotField, shortId: field.fieldId, label: field.label }
    }
    // Check for timeframe fields
    const timeframeMatch = DATE_TIMEFRAMES.find(tf => pivotField.endsWith(`_${tf.value}`))
    if (timeframeMatch) {
      const parentFullId = pivotField.slice(0, -(timeframeMatch.value.length + 1))
      const parentField = allFields.find(f => f.id === parentFullId)
      if (parentField) {
        return {
          fullId: pivotField,
          shortId: `${parentField.fieldId}_${timeframeMatch.value}`,
          label: `${parentField.label} (${timeframeMatch.label})`
        }
      }
    }
    return null
  }, [pivotField, allFields])

  // Non-pivot attributes (for grouping rows)
  const nonPivotAttributes = useMemo(() => {
    if (!pivotFieldInfo) return selectedAttributes
    return selectedAttributes.filter(attr => {
      // Check if this attribute's shortId matches the pivot shortId
      return attr.fieldId !== pivotFieldInfo.shortId
    })
  }, [selectedAttributes, pivotFieldInfo])

  // Get unique pivot values from data
  const pivotValues = useMemo(() => {
    if (!pivotFieldInfo || sortedDataRows.length === 0) return []
    const values = new Set<string>()
    for (const row of sortedDataRows) {
      const val = row[pivotFieldInfo.shortId]
      if (val !== null && val !== undefined) {
        values.add(String(val))
      }
    }
    return Array.from(values).sort()
  }, [sortedDataRows, pivotFieldInfo])

  // Transform data for pivoted display
  const pivotedData = useMemo(() => {
    if (!pivotFieldInfo || pivotValues.length === 0 || nonPivotAttributes.length === 0) {
      return { rows: [], groupKey: '' }
    }

    // Group by non-pivot attributes
    const groupedData = new Map<string, Record<string, unknown>>()

    for (const row of sortedDataRows) {
      // Create group key from non-pivot attribute values
      const groupKey = nonPivotAttributes.map(attr => String(row[attr.fieldId] ?? '')).join('|||')

      if (!groupedData.has(groupKey)) {
        // Initialize with non-pivot attribute values
        const pivotedRow: Record<string, unknown> = {}
        for (const attr of nonPivotAttributes) {
          pivotedRow[attr.fieldId] = row[attr.fieldId]
        }
        groupedData.set(groupKey, pivotedRow)
      }

      // Add metric values for this pivot value
      const pivotVal = String(row[pivotFieldInfo.shortId] ?? '')
      const pivotedRow = groupedData.get(groupKey)!
      for (const metric of selectedMetrics) {
        const pivotedKey = `${pivotVal}__${metric.fieldId}`
        pivotedRow[pivotedKey] = row[metric.fieldId]
      }
    }

    return {
      rows: Array.from(groupedData.values()),
      groupKey: nonPivotAttributes.map(a => a.fieldId).join('|||')
    }
  }, [sortedDataRows, pivotFieldInfo, pivotValues, nonPivotAttributes, selectedMetrics])

  // Calculate totals for metric columns
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    if (dataRows.length === 0 || orderedColumns.length === 0) return totals

    for (const col of orderedColumns) {
      const isMetric = col.type === 'number' || col.type === 'currency' || col.type === 'percent'
      if (isMetric) {
        let sum = 0
        for (const row of dataRows) {
          const val = row[col.id]
          if (typeof val === 'number') {
            sum += val
          } else if (typeof val === 'string') {
            const parsed = parseFloat(val)
            if (!isNaN(parsed)) sum += parsed
          }
        }
        totals[col.id] = sum
      }
    }
    return totals
  }, [dataRows, orderedColumns])

  // Handle copy SQL
  const handleCopySQL = async () => {
    try {
      await navigator.clipboard.writeText(executedSQL || generatedSQL)
      setSqlCopied(true)
      setTimeout(() => setSqlCopied(false), 2000)
    } catch (err) {
      console.error('Error copying SQL:', err)
    }
  }

  // Ref to prevent duplicate queries (React StrictMode causes double renders)
  const isQueryRunning = useRef(false)

  // Handle Run Query
  const handleRun = useCallback(async () => {
    if (selectedFields.size === 0) return
    if (isQueryRunning.current) return // Prevent duplicate calls

    isQueryRunning.current = true
    setIsLoading(true)
    setError(null)
    setDataRows([])
    setColumns([])
    setRowCount(null)
    setComparisonInfo(null)

    try {
      // Variant suffixes for comparison metrics
      const VARIANT_SUFFIXES: MetricVariant[] = ['previous', 'delta', 'delta_pct']

      // Separate base metrics from variant metrics
      // Base metrics: regular metrics without variant suffix
      // Variant metrics: metrics ending with _previous, _delta, or _delta_pct
      const baseMetrics: FieldItem[] = []
      const variantMetrics: { metric: FieldItem; baseFieldId: string; variant: MetricVariant }[] = []

      for (const metric of selectedMetrics) {
        const variantMatch = VARIANT_SUFFIXES.find(v => metric.fieldId.endsWith(`_${v}`))
        if (variantMatch) {
          // This is a variant metric - extract base field ID
          const baseFieldId = metric.fieldId.slice(0, -(variantMatch.length + 1))
          variantMetrics.push({ metric, baseFieldId, variant: variantMatch })
        } else {
          // This is a base metric
          baseMetrics.push(metric)
        }
      }

      // Determine if we need comparison query
      const hasVariantMetrics = variantMetrics.length > 0
      const needsComparisonQuery = (comparisonConfig.enabled && comparisonConfig.dateFieldId) || hasVariantMetrics

      // Get unique base metric fieldIds for the query (union of selected base metrics and base metrics from variants)
      const baseMetricFieldIds = new Set<string>()
      for (const metric of baseMetrics) {
        baseMetricFieldIds.add(metric.fieldId)
      }
      for (const { baseFieldId } of variantMetrics) {
        baseMetricFieldIds.add(baseFieldId)
      }

      // Auto-detect date field from filters if not configured
      let effectiveDateFieldId = comparisonConfig.dateFieldId
      if (needsComparisonQuery && !effectiveDateFieldId) {
        // Try to find a date filter from validFilters
        const dateFilter = validFilters.find(f => {
          // Check if it uses a relative date operator
          const dateOperators = [
            'today', 'yesterday', 'last_7_days', 'last_14_days', 'last_30_days',
            'last_60_days', 'last_90_days', 'this_week', 'this_month', 'this_quarter',
            'this_year', 'last_week', 'last_month', 'last_quarter', 'last_year'
          ]
          if (dateOperators.includes(f.operator)) return true
          // Check for 'between' operator with valid date range
          if (f.operator === 'between' && f.value) {
            const value = f.value
            if (Array.isArray(value) && value.length >= 2) return true
            if (typeof value === 'string' && value.includes(',')) return true
          }
          return false
        })
        if (dateFilter) {
          effectiveDateFieldId = dateFilter.field
          console.log('📊 Auto-detected date field for comparison:', effectiveDateFieldId)
        }
      }

      // Check if comparison is needed and date field is available
      if (needsComparisonQuery && effectiveDateFieldId) {
        // Build enabledVariants from variant metrics
        const enabledVariantsFromSelection = new Set<MetricVariant>(['current']) // Always include current
        for (const { variant } of variantMetrics) {
          enabledVariantsFromSelection.add(variant)
        }

        // Merge with comparisonConfig.enabledVariants if comparison is explicitly enabled
        const effectiveEnabledVariants: MetricVariant[] = comparisonConfig.enabled
          ? Array.from(new Set([...comparisonConfig.enabledVariants, ...enabledVariantsFromSelection]))
          : Array.from(enabledVariantsFromSelection)

        // Find which attribute is the actual date field in the query
        // (could be exact match like 'date_time' or with timeframe suffix like 'date_time_date')
        const dateAttrInQuery = selectedAttributes.find(a =>
          a.fieldId === effectiveDateFieldId ||
          a.fieldId.startsWith(`${effectiveDateFieldId}_`)
        )?.fieldId || effectiveDateFieldId

        console.log('📊 Date field mapping:', {
          filterDateField: effectiveDateFieldId,
          attributeDateField: dateAttrInQuery
        })

        // Build effective comparison config
        const effectiveComparisonConfig: ComparisonConfig = {
          ...comparisonConfig,
          enabled: true,
          dateFieldId: dateAttrInQuery,
          enabledVariants: effectiveEnabledVariants,
        }

        // Convert to backend format
        const queryComparison = toQueryComparisonConfig(effectiveComparisonConfig)

        // Build the query request with comparison
        const queryRequest: QueryRequest = {
          dataset_id: dataset.id,
          attributes: selectedAttributes.map(f => f.fieldId),
          metrics: Array.from(baseMetricFieldIds), // Backend needs base metrics, it generates variants
          filters: validFilters.length > 0 ? validFilters : undefined,
          order_by: sortConfig.length > 0 ? sortConfig : undefined,
          limit: rowLimit,
          comparison: queryComparison,
        }

        console.log('📊 Executing comparison query (backend PoP):', queryRequest, 'tenantId:', currentTenant?.id)

        // Execute query - backend handles the PoP logic with CTEs
        const response = await executeQuery(queryRequest, currentTenant?.id)

        console.log('📊 Query response with comparison:', response)

        if (response.success) {
          setDataRows(response.data)
          setComparisonInfo(response.comparison_info || null)

          // Build columns based on what user selected + comparison columns from backend
          const columnInfos: QueryColumnInfo[] = []

          // Attributes first
          for (const attr of selectedAttributes) {
            columnInfos.push({
              id: attr.fieldId,
              label: attr.label || attr.fieldId,
              type: 'string' as const
            })

            // Add comparison date column right after the date attribute
            if (attr.fieldId === dateAttrInQuery && response.comparison_info) {
              columnInfos.push({
                id: 'comparison_date',
                label: 'Fecha Comparación',
                type: 'string' as const
              })
            }
          }

          // Backend returns variant columns (spend_current, spend_previous, etc.)
          // Use the variant_columns from comparison_info to build column list
          if (response.comparison_info?.variant_columns) {
            // Group variant columns by base metric to maintain order
            const variantsByMetric = new Map<string, string[]>()
            for (const variantCol of response.comparison_info.variant_columns) {
              // Extract base metric name (spend_current -> spend)
              const baseName = variantCol.replace(/_(current|previous|delta|delta_pct)$/, '')
              if (!variantsByMetric.has(baseName)) {
                variantsByMetric.set(baseName, [])
              }
              variantsByMetric.get(baseName)!.push(variantCol)
            }

            // Add columns in order: for each metric, add its variants
            for (const metric of baseMetrics) {
              const variantCols = variantsByMetric.get(metric.fieldId) || []

              for (const variantCol of variantCols) {
                const apiCol = response.columns.find(c => c.id === variantCol)
                const isDeltaPct = variantCol.endsWith('_delta_pct')
                const isDelta = variantCol.endsWith('_delta') && !isDeltaPct
                const isPrevious = variantCol.endsWith('_previous')
                const isCurrent = variantCol.endsWith('_current')

                // Generate label based on variant
                let label = apiCol?.label || variantCol
                if (isCurrent) label = `${metric.label || metric.fieldId} (Actual)`
                else if (isPrevious) label = `${metric.label || metric.fieldId} (Anterior)`
                else if (isDeltaPct) label = `${metric.label || metric.fieldId} (Δ%)`
                else if (isDelta) label = `${metric.label || metric.fieldId} (Δ)`

                columnInfos.push({
                  id: variantCol,
                  label,
                  type: isDeltaPct ? 'percent' : 'number',
                  format: isDeltaPct ? 'percent' : undefined
                })
              }
            }
          } else {
            // Fallback: no comparison_info, just use base metrics
            for (const metric of baseMetrics) {
              columnInfos.push({
                id: metric.fieldId,
                label: metric.label || metric.fieldId,
                type: 'number'
              })
            }
          }

          // If user selected variant metrics directly (e.g., spend_previous), add those
          if (variantMetrics.length > 0) {
            for (const { metric, variant } of variantMetrics) {
              // Only add if not already in columnInfos
              if (!columnInfos.some(c => c.id === metric.fieldId)) {
                columnInfos.push({
                  id: metric.fieldId,
                  label: metric.label || metric.fieldId,
                  type: variant === 'delta_pct' ? 'percent' : 'number',
                  format: variant === 'delta_pct' ? 'percent' : undefined
                })
              }
            }
          }

          setColumns(columnInfos)
          setRowCount(response.meta.row_count)
          setExecutedSQL(response.meta.sql || null)
        } else {
          setError('La consulta no fue exitosa')
        }
      } else if (hasVariantMetrics && !effectiveDateFieldId) {
        // Variant metrics selected but no date filter available
        setError('Para usar metricas de comparacion (Anterior, Δ, Δ%) necesitas agregar un filtro de fecha con un periodo relativo (Ultimos 7 dias, Este mes, etc.)')
      } else {
        // Normal query without comparison
        const queryRequest: QueryRequest = {
          dataset_id: dataset.id,
          attributes: selectedAttributes.map(f => f.fieldId),
          metrics: selectedMetrics.map(f => f.fieldId),
          filters: validFilters.length > 0 ? validFilters : undefined,
          order_by: sortConfig.length > 0 ? sortConfig : undefined,
          limit: rowLimit,
        }

        console.log('📊 Executing query (no comparison):', queryRequest, 'tenantId:', currentTenant?.id)

        const response = await executeQuery(queryRequest, currentTenant?.id)

        console.log('📊 Query response:', response)

        if (response.success) {
          setDataRows(response.data)
          setColumns(response.columns)
          setRowCount(response.meta.row_count)
          setExecutedSQL(response.meta.sql || null)
        } else {
          setError('La consulta no fue exitosa')
        }
      }
    } catch (err: unknown) {
      console.error('Error executing query:', err)
      const errorMessage = err instanceof Error ? err.message : 'Error al ejecutar la consulta'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
      isQueryRunning.current = false
    }
  }, [selectedFields.size, dataset.id, selectedAttributes, selectedMetrics, validFilters, sortConfig, rowLimit, currentTenant?.id, comparisonConfig])

  // Listen for auto-run-query event (triggered when loading a saved viz)
  useEffect(() => {
    const handleAutoRun = () => {
      // Only run if we have selected fields AND they have been resolved to actual field items
      // (selectedFieldItems requires allFields to be populated from loaded entities)
      if (selectedFields.size > 0 && (selectedAttributes.length > 0 || selectedMetrics.length > 0)) {
        handleRun()
      }
    }

    window.addEventListener('auto-run-query', handleAutoRun)

    return () => {
      window.removeEventListener('auto-run-query', handleAutoRun)
    }
  }, [handleRun, selectedFields.size, selectedAttributes.length, selectedMetrics.length])

  // Auto-run query when autoRunPending prop is true and fields are ready
  useEffect(() => {
    if (autoRunPending && selectedFields.size > 0 && (selectedAttributes.length > 0 || selectedMetrics.length > 0)) {
      handleRun()
      onAutoRunComplete?.()
    }
  }, [autoRunPending, selectedFields.size, selectedAttributes.length, selectedMetrics.length, handleRun, onAutoRunComplete])

  return (
    <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex-1 max-w-md">
            {/* Visualization Title Input */}
            {embedded && onVizTitleChange ? (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Título de la visualización</label>
                <input
                  type="text"
                  value={vizTitle || ''}
                  onChange={(e) => onVizTitleChange(e.target.value)}
                  placeholder={dataset.label}
                  className="w-full text-lg font-semibold text-gray-900 bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none py-1 placeholder:text-gray-400"
                />
              </div>
            ) : !hideDatasetInfo ? (
              <>
                {/* Breadcrumb (non-embedded mode) */}
                <div className="flex items-center text-xs text-gray-500 mb-1">
                  <span>{dataset.group}</span>
                  <span className="mx-2">›</span>
                  <span>{dataset.id}</span>
                </div>
                <h1 className="text-lg font-semibold text-gray-900">{dataset.label}</h1>
                {dataset.description && (
                  <p className="text-sm text-gray-600 mt-1">{dataset.description}</p>
                )}
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSqlModal(true)}
              disabled={selectedFields.size === 0}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed rounded transition-colors flex items-center gap-1.5"
              title="Ver SQL"
            >
              <CodeBracketIcon className="h-4 w-4" />
              SQL
            </button>
            <button
              onClick={handleRun}
              disabled={isLoading || selectedFields.size === 0}
              className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded transition-colors"
            >
              {isLoading ? 'Ejecutando...' : 'Run'}
            </button>

            {/* Settings Menu */}
            <div className="relative">
              <button
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                title="Opciones"
              >
                <Cog6ToothIcon className="h-5 w-5" />
              </button>

              {/* Dropdown Menu */}
              {showSettingsMenu && (
                <>
                  {/* Backdrop to close menu */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSettingsMenu(false)}
                  />
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-20">
                    <button
                      onClick={() => {
                        setShowSettingsMenu(false)
                        if (!vizType) {
                          alert('Selecciona un tipo de visualización primero')
                          return
                        }
                        setSaveVizName('')
                        setSaveVizDescription('')
                        setSaveVizFolderId(null)
                        setSaveVizError(null)
                        setShowSaveVizModal(true)
                        if (currentTenant?.id) {
                          listFolders(currentTenant.id).then(setFolders).catch(console.error)
                        }
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <BookmarkIcon className="h-4 w-4" />
                      Guardar como Viz
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Filtros Section */}
        <CollapsibleSection
          title="Filtros"
          color="blue"
          defaultExpanded
          count={validFilters.length}
          resizable
          height={filtrosHeight}
          onHeightChange={setFiltrosHeight}
          minHeight={100}
          maxHeight={400}
        >
          <div className="space-y-2">
            {/* Filter rows */}
            {filters.map((filter, index) => {
              // Get field type for smart operator selection
              const selectedField = allFields.find(f => f.fieldId === filter.field)
              // Check if it's a date/timestamp field or a date transformation
              // Date transformations have fieldIds like: fecha_date, fecha_month, fecha_year, etc.
              const dateTransformSuffixes = ['_date', '_datetime', '_week', '_month', '_quarter', '_year', '_raw', '_time']
              const isDateTransform = dateTransformSuffixes.some(suffix => filter.field.endsWith(suffix))
              const isDateField = isDateLikeType(selectedField?.type) || isDateTransform
              const isNumberField = selectedField?.type === 'number' || selectedField?.fieldType === 'metric'

              // Date operators that don't need a value input
              const dateNoValueOperators = [
                'today', 'yesterday',
                'last_7_days', 'last_14_days', 'last_30_days', 'last_60_days', 'last_90_days',
                'this_week', 'this_month', 'this_quarter', 'this_year',
                'last_week', 'last_month', 'last_quarter', 'last_year'
              ]
              const needsValueInput = !['is_null', 'is_not_null', ...dateNoValueOperators].includes(filter.operator)
              const needsDateRangeInput = filter.operator === 'between' && isDateField
              const needsDateInput = isDateField && ['=', '!=', '>', '>=', '<', '<='].includes(filter.operator)

              return (
                <div key={index} className="flex items-center gap-2">
                  {/* Field selector */}
                  <select
                    value={filter.field}
                    onChange={(e) => updateFilter(index, { field: e.target.value, operator: '=', value: '' })}
                    className="w-44 h-8 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                  >
                    <option value="">Campo...</option>
                    <optgroup label="Atributos">
                      {attributesWithDateTransforms.map(({ field, transforms }) => (
                        transforms ? (
                          // Date field with transforms - render each transform as an option
                          transforms.map(tf => (
                            <option key={tf.id} value={tf.fieldId}>
                              {field.label} ({tf.label})
                            </option>
                          ))
                        ) : (
                          // Non-date field
                          <option key={field.id} value={field.fieldId}>{field.label}</option>
                        )
                      ))}
                    </optgroup>
                    <optgroup label="Métricas">
                      {allMetrics.map((field) => (
                        <option key={field.id} value={field.fieldId}>{field.label}</option>
                      ))}
                    </optgroup>
                  </select>

                  {/* Operator selector - different options based on field type */}
                  <select
                    value={filter.operator}
                    onChange={(e) => updateFilter(index, { operator: e.target.value as MetricFilter['operator'], value: dateNoValueOperators.includes(e.target.value) ? '' : filter.value })}
                    className="w-36 h-8 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                  >
                    {isDateField ? (
                      <>
                        <optgroup label="Relativos">
                          <option value="today">Hoy</option>
                          <option value="yesterday">Ayer</option>
                          <option value="last_7_days">Últimos 7 días</option>
                          <option value="last_14_days">Últimos 14 días</option>
                          <option value="last_30_days">Últimos 30 días</option>
                          <option value="last_60_days">Últimos 60 días</option>
                          <option value="last_90_days">Últimos 90 días</option>
                        </optgroup>
                        <optgroup label="Período actual">
                          <option value="this_week">Esta semana</option>
                          <option value="this_month">Este mes</option>
                          <option value="this_quarter">Este trimestre</option>
                          <option value="this_year">Este año</option>
                        </optgroup>
                        <optgroup label="Período anterior">
                          <option value="last_week">Semana pasada</option>
                          <option value="last_month">Mes pasado</option>
                          <option value="last_quarter">Trimestre pasado</option>
                          <option value="last_year">Año pasado</option>
                        </optgroup>
                        <optgroup label="Específico">
                          <option value="=">Es igual a</option>
                          <option value="!=">No es igual a</option>
                          <option value=">">Después de</option>
                          <option value=">=">Desde</option>
                          <option value="<">Antes de</option>
                          <option value="<=">Hasta</option>
                          <option value="between">Rango de fechas</option>
                        </optgroup>
                        <optgroup label="Nulos">
                          <option value="is_null">Es nulo</option>
                          <option value="is_not_null">No es nulo</option>
                        </optgroup>
                      </>
                    ) : isNumberField ? (
                      <>
                        <option value="=">=</option>
                        <option value="!=">≠</option>
                        <option value=">">&gt;</option>
                        <option value=">=">&ge;</option>
                        <option value="<">&lt;</option>
                        <option value="<=">&le;</option>
                        <option value="between">Entre</option>
                        <option value="is_null">Es nulo</option>
                        <option value="is_not_null">No es nulo</option>
                      </>
                    ) : (
                      <>
                        <option value="=">=</option>
                        <option value="!=">≠</option>
                        <option value="contains">Contiene</option>
                        <option value="starts_with">Empieza con</option>
                        <option value="ends_with">Termina con</option>
                        <option value="is_null">Es nulo</option>
                        <option value="is_not_null">No es nulo</option>
                      </>
                    )}
                  </select>

                  {/* Value input - contextual based on operator */}
                  {needsValueInput && !needsDateRangeInput && !needsDateInput && (
                    <input
                      type={isNumberField ? 'number' : 'text'}
                      value={String(filter.value || '')}
                      onChange={(e) => updateFilter(index, { value: isNumberField ? Number(e.target.value) : e.target.value })}
                      placeholder="Valor..."
                      className="w-32 h-8 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 placeholder-gray-400"
                    />
                  )}

                  {/* Single date input */}
                  {needsDateInput && !needsDateRangeInput && (
                    <DateRangePicker
                      startDate={String(filter.value || '') || null}
                      endDate={null}
                      onChange={(start) => updateFilter(index, { value: start })}
                      isRange={false}
                      placeholder="Seleccionar fecha"
                    />
                  )}

                  {/* Date range inputs */}
                  {needsDateRangeInput && (
                    <DateRangePicker
                      startDate={Array.isArray(filter.value) ? String(filter.value[0] || '') : null}
                      endDate={Array.isArray(filter.value) ? String(filter.value[1] || '') : null}
                      onChange={(start, end) => updateFilter(index, { value: [start, end] })}
                      isRange={true}
                      placeholder="Seleccionar rango"
                    />
                  )}

                  {/* Remove button */}
                  <button
                    onClick={() => removeFilter(index)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Eliminar filtro"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>

                  {/* Comparison dropdown - only for date filters */}
                  {isDateField && (
                    <select
                      value={comparisonConfig.dateFieldId === filter.field ? comparisonConfig.type : 'none'}
                      onChange={(e) => {
                        const newType = e.target.value as ComparisonType
                        setComparisonConfig({
                          ...comparisonConfig,
                          enabled: newType !== 'none',
                          type: newType,
                          dateFieldId: filter.field
                        })
                      }}
                      className="h-8 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                      title="Comparar con periodo"
                    >
                      <option value="none">Sin comparar</option>
                      <option value="same_point">vs Periodo anterior</option>
                      <option value="full_previous">vs Periodo completo</option>
                      <option value="same_point_yoy">vs Año anterior</option>
                      <option value="full_previous_yoy">vs Año completo</option>
                    </select>
                  )}
                </div>
              )
            })}

            {/* Add filter button */}
            <button
              onClick={addFilter}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Agregar filtro
            </button>

            {/* Comparison variants selector - only shown when comparison is enabled */}
            {comparisonConfig.enabled && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-600">Mostrar valores:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['current', 'previous', 'delta', 'delta_pct'] as MetricVariant[]).map((variant) => {
                    const isSelected = comparisonConfig.enabledVariants.includes(variant)
                    const isDisabled = variant === 'current' // Current is always enabled
                    return (
                      <label
                        key={variant}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        } ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => {
                            if (isDisabled) return
                            const variants = [...comparisonConfig.enabledVariants]
                            if (isSelected) {
                              const filtered = variants.filter(v => v !== variant)
                              // Ensure current is always present
                              if (!filtered.includes('current')) {
                                filtered.unshift('current')
                              }
                              setComparisonConfig({
                                ...comparisonConfig,
                                enabledVariants: filtered
                              })
                            } else {
                              setComparisonConfig({
                                ...comparisonConfig,
                                enabledVariants: [...variants, variant]
                              })
                            }
                          }}
                          className="h-3 w-3 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-xs">{METRIC_VARIANT_LABELS[variant].shortLabel}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Empty state */}
            {filters.length === 0 && (
              <div className="flex flex-col items-center justify-center py-4 text-gray-400">
                <FunnelIcon className="h-8 w-8 mb-2 text-gray-300 stroke-[1.5]" />
                <p className="text-xs text-gray-500">Sin filtros activos</p>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Datos Section */}
        <CollapsibleSection
          title="Datos"
          color="green"
          defaultExpanded
          count={selectedFields.size}
          resizable
          height={datosHeight}
          onHeightChange={setDatosHeight}
          minHeight={150}
          maxHeight={500}
        >
          {selectedFields.size === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <TableCellsIcon className="h-12 w-12 mb-3 text-gray-300 stroke-[1.5]" />
              <p className="text-sm text-gray-500">Selecciona columnas para ver los datos</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Error Display */}
              {error && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <svg className="h-5 w-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">Error al ejecutar la consulta</p>
                    <p className="text-xs text-red-600 mt-0.5">{error}</p>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Row Limit Controls */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>Mostrando</span>
                  <span className="font-medium text-gray-900">{dataRows.length}</span>
                  {rowCount !== null && rowCount > dataRows.length && (
                    <>
                      <span>de</span>
                      <span className="font-medium text-gray-900">{rowCount}</span>
                    </>
                  )}
                  <span>filas</span>
                  <span className="text-gray-400">(límite: {rowLimit})</span>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showTotals}
                      onChange={(e) => setShowTotals(e.target.checked)}
                      className="h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                    />
                    <span className="text-xs text-gray-600">Mostrar totales</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">Límite de filas:</label>
                    <input
                      type="number"
                      value={rowLimitInput}
                      onChange={(e) => {
                        setRowLimitInput(e.target.value)
                        const val = parseInt(e.target.value)
                        if (!isNaN(val) && val > 0 && val <= 10000) {
                          setRowLimit(val)
                        }
                      }}
                      min="1"
                      max="10000"
                      className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                      placeholder="500"
                    />
                    <span className="text-xs text-gray-400">(máx 10,000)</span>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 min-h-0 bg-white rounded shadow-sm border border-gray-200 overflow-auto">
                  <table className="min-w-full border-collapse">
                    {/* Pivot Mode Header */}
                    {pivotFieldInfo ? (
                      <thead className="sticky top-0 z-10">
                        {/* First header row: Pivot header over attributes + Metrics with rowSpan */}
                        <tr className="bg-gray-800">
                          {/* Pivot header spanning all non-pivot attribute columns */}
                          {nonPivotAttributes.length > 0 && (
                            <th
                              colSpan={nonPivotAttributes.length}
                              className="px-4 py-2 text-center text-xs font-semibold text-amber-300 border-r border-gray-600 bg-gray-800"
                            >
                              <div className="flex items-center justify-center gap-1">
                                <ArrowsRightLeftIcon className="h-3 w-3" />
                                <span>{pivotFieldInfo.label}</span>
                                <span className="text-amber-400/60 text-[10px]">(pivot)</span>
                              </div>
                            </th>
                          )}
                          {/* Pivot values OR metrics with rowSpan when no data */}
                          {pivotValues.length > 0 ? (
                            // With data: pivot values as column groups
                            pivotValues.map((pivotVal) => (
                              <th
                                key={pivotVal}
                                colSpan={selectedMetrics.length}
                                className="px-3 py-1.5 text-center text-[10px] font-medium text-amber-200 border-r border-gray-600 last:border-r-0 bg-gray-700"
                              >
                                <div className="flex items-center justify-center gap-1">
                                  <span className="truncate max-w-[120px]" title={String(pivotVal)}>{pivotVal}</span>
                                </div>
                              </th>
                            ))
                          ) : (
                            // Without data: metrics with rowSpan=2
                            selectedMetrics.map((metric) => (
                              <th
                                key={metric.id}
                                rowSpan={2}
                                className="px-4 py-2 text-left text-xs font-semibold text-green-300 border-r border-gray-600 last:border-r-0 bg-gray-700 align-bottom"
                              >
                                <div className="flex items-center gap-1">
                                  <HashtagIcon className="h-3 w-3" />
                                  <span>{metric.label}</span>
                                </div>
                              </th>
                            ))
                          )}
                        </tr>
                        {/* Second header row: Attribute columns + Metrics under pivot values */}
                        <tr className="bg-gray-700">
                          {/* Non-pivot attribute columns */}
                          {nonPivotAttributes.map((field) => (
                            <th
                              key={field.id}
                              className="px-4 py-2 text-left text-xs font-semibold text-gray-100 border-r border-gray-600 cursor-pointer hover:bg-gray-600 transition-colors"
                              onClick={() => handleSort(field.fieldId)}
                            >
                              <div className="flex items-center gap-1">
                                <TagIcon className="h-3 w-3 text-blue-300" />
                                <span className="flex-1">{field.label}</span>
                              </div>
                            </th>
                          ))}
                          {/* Metrics under each pivot value (only when there's data) */}
                          {pivotValues.length > 0 && (
                            pivotValues.map((pivotVal) => (
                              selectedMetrics.map((metric) => (
                                <th
                                  key={`${pivotVal}__${metric.id}`}
                                  className="px-3 py-1.5 text-left text-[10px] font-medium text-green-300 border-r border-gray-500 last:border-r-0 bg-gray-600"
                                >
                                  <div className="flex items-center gap-1">
                                    <HashtagIcon className="h-2.5 w-2.5" />
                                    <span>{metric.label}</span>
                                  </div>
                                </th>
                              ))
                            ))
                          )}
                        </tr>
                      </thead>
                    ) : (
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-700">
                        {/* Use ordered columns from API response if available, otherwise use selected fields */}
                        {orderedColumns.length > 0 ? (
                          orderedColumns.map((col) => {
                            const isMetric = col.type === 'number' || col.type === 'currency' || col.type === 'percent'
                            const sortInfo = getSortInfo(col.id)
                            const isDragging = draggedColumn === col.id
                            const isDragOver = dragOverColumn === col.id
                            return (
                              <th
                                key={col.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, col.id)}
                                onDragOver={(e) => handleDragOver(e, col.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, col.id)}
                                onDragEnd={handleDragEnd}
                                onClick={() => handleSort(col.id)}
                                className={`px-4 py-2 text-left text-xs font-semibold border-r border-gray-600 last:border-r-0 cursor-grab hover:bg-gray-600 transition-all select-none ${
                                  isMetric ? 'text-green-300' : 'text-gray-100'
                                } ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'bg-gray-500 border-l-2 border-l-blue-400' : ''}`}
                              >
                                <div className="flex items-center gap-1">
                                  {isMetric ? (
                                    <HashtagIcon className="h-3 w-3" />
                                  ) : (
                                    <TagIcon className="h-3 w-3 text-blue-300" />
                                  )}
                                  <span className="flex-1">{col.label}</span>
                                  {/* Sort badge */}
                                  {sortInfo && (
                                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-200 rounded text-[10px] text-gray-700 font-bold">
                                      <span>{sortInfo.order}</span>
                                      <span>{sortInfo.direction === 'ASC' ? '↑' : '↓'}</span>
                                    </span>
                                  )}
                                </div>
                              </th>
                            )
                          })
                        ) : (
                          <>
                            {selectedAttributes.map((field) => {
                              const sortInfo = getSortInfo(field.fieldId)
                              return (
                                <th
                                  key={field.id}
                                  onClick={() => handleSort(field.fieldId)}
                                  className="px-4 py-2 text-left text-xs font-semibold text-gray-100 border-r border-gray-600 last:border-r-0 cursor-pointer hover:bg-gray-600 transition-colors"
                                >
                                  <div className="flex items-center gap-1">
                                    <TagIcon className="h-3 w-3 text-blue-300" />
                                    <span className="flex-1">{field.label}</span>
                                    {sortInfo && (
                                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-200 rounded text-[10px] text-gray-700 font-bold">
                                        <span>{sortInfo.order}</span>
                                        <span>{sortInfo.direction === 'ASC' ? '↑' : '↓'}</span>
                                      </span>
                                    )}
                                  </div>
                                </th>
                              )
                            })}
                            {selectedMetrics.map((field) => {
                              const sortInfo = getSortInfo(field.fieldId)
                              return (
                                <th
                                  key={field.id}
                                  onClick={() => handleSort(field.fieldId)}
                                  className="px-4 py-2 text-left text-xs font-semibold text-green-300 border-r border-gray-600 last:border-r-0 cursor-pointer hover:bg-gray-600 transition-colors"
                                >
                                  <div className="flex items-center gap-1">
                                    <HashtagIcon className="h-3 w-3" />
                                    <span className="flex-1">{field.label}</span>
                                    {sortInfo && (
                                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-200 rounded text-[10px] text-gray-700 font-bold">
                                        <span>{sortInfo.order}</span>
                                        <span>{sortInfo.direction === 'ASC' ? '↑' : '↓'}</span>
                                      </span>
                                    )}
                                  </div>
                                </th>
                              )
                            })}
                          </>
                        )}
                      </tr>
                    </thead>
                    )}
                    <tbody className="bg-white divide-y divide-gray-200">
                      {isLoading ? (
                        <tr>
                          <td
                            colSpan={orderedColumns.length || selectedFields.size}
                            className="px-4 py-8 text-center"
                          >
                            <div className="flex flex-col items-center justify-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-2"></div>
                              <span className="text-sm text-gray-500">Ejecutando consulta...</span>
                            </div>
                          </td>
                        </tr>
                      ) : sortedDataRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={orderedColumns.length || selectedFields.size}
                            className="px-4 py-8 text-center text-sm text-gray-500"
                          >
                            No hay datos disponibles
                            <br />
                            <span className="text-xs text-gray-400">Haz clic en "Run" para ejecutar la consulta</span>
                          </td>
                        </tr>
                      ) : pivotFieldInfo && pivotValues.length > 0 && pivotedData.rows.length > 0 ? (
                        // Pivot Mode Data Rows
                        pivotedData.rows.map((row, rowIndex) => {
                          const isOddRow = rowIndex % 2 === 1
                          return (
                            <tr
                              key={rowIndex}
                              className="border-b border-gray-200 hover:bg-blue-50"
                            >
                              {/* Non-pivot attribute columns */}
                              {nonPivotAttributes.map((attr) => {
                                const value = row[attr.fieldId]
                                const bgClass = isOddRow ? 'bg-gray-100' : 'bg-white'
                                return (
                                  <td
                                    key={attr.fieldId}
                                    className={`px-4 py-2 text-xs border-r border-gray-200 text-gray-700 ${bgClass}`}
                                  >
                                    {value !== null && value !== undefined ? String(value) : <span className="text-gray-300">—</span>}
                                  </td>
                                )
                              })}
                              {/* Pivoted metric columns */}
                              {pivotValues.map((pivotVal) => (
                                selectedMetrics.map((metric) => {
                                  const pivotedKey = `${pivotVal}__${metric.fieldId}`
                                  const value = row[pivotedKey]
                                  const format = fieldIdToFormat[metric.fieldId] || 'number'
                                  const bgClass = isOddRow ? 'bg-green-100' : 'bg-green-50'
                                  return (
                                    <td
                                      key={pivotedKey}
                                      className={`px-3 py-2 text-xs border-r border-gray-200 last:border-r-0 ${bgClass} text-green-700 font-medium text-right`}
                                    >
                                      {value !== null && value !== undefined
                                        ? formatMetricValue(value, format)
                                        : <span className="text-gray-300">—</span>}
                                    </td>
                                  )
                                })
                              ))}
                            </tr>
                          )
                        })
                      ) : (
                        // Normal Mode Data Rows
                        sortedDataRows.map((row, rowIndex) => {
                          const isOddRow = rowIndex % 2 === 1
                          return (
                            <tr
                              key={rowIndex}
                              className="border-b border-gray-200 hover:bg-blue-50"
                            >
                              {orderedColumns.map((col) => {
                                const isMetric = col.type === 'number' || col.type === 'currency' || col.type === 'percent'
                                const value = row[col.id]
                                const format = fieldIdToFormat[col.id] || 'number'
                                // Alternating backgrounds: odd rows are slightly darker
                                const bgClass = isMetric
                                  ? (isOddRow ? 'bg-green-100' : 'bg-green-50')
                                  : (isOddRow ? 'bg-gray-100' : 'bg-white')
                                return (
                                  <td
                                    key={col.id}
                                    className={`px-4 py-2 text-xs border-r border-gray-200 last:border-r-0 ${bgClass} ${
                                      isMetric ? 'text-green-700 font-medium text-right' : 'text-gray-700'
                                    }`}
                                  >
                                    {value !== null && value !== undefined
                                      ? (isMetric ? formatMetricValue(value, format) : String(value))
                                      : <span className="text-gray-300">—</span>}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                    {/* Totals Footer - Always visible when enabled */}
                    {showTotals && sortedDataRows.length > 0 && (
                      <tfoot className="sticky bottom-0 z-10">
                        <tr className="bg-gray-100 border-t-2 border-gray-300">
                          {orderedColumns.map((col) => {
                            const isMetric = col.type === 'number' || col.type === 'currency' || col.type === 'percent'
                            const total = columnTotals[col.id]
                            const format = fieldIdToFormat[col.id] || 'number'
                            return (
                              <td
                                key={col.id}
                                className={`px-4 py-2 text-xs font-bold border-r border-gray-200 last:border-r-0 ${
                                  isMetric ? 'bg-green-100 text-green-800 text-right' : 'text-gray-700 bg-gray-100'
                                }`}
                              >
                                {isMetric ? (
                                  formatMetricValue(total, format)
                                ) : (
                                  col === orderedColumns[0] ? (
                                    <span className="flex items-center gap-1">
                                      <span>TOTAL</span>
                                      <span className="text-[10px] font-normal text-gray-500">({sortedDataRows.length} filas)</span>
                                    </span>
                                  ) : ''
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
            </div>
          )}
        </CollapsibleSection>

        {/* Visualización Section */}
        <CollapsibleSection title="Visualización" color="purple" forceExpanded={vizType !== null}>
          {/* Visualization Type Icons Bar */}
          <div className="flex items-center justify-between p-2 bg-gray-50 border-b border-gray-200">
            {/* Chart Type Icons */}
            <div className="flex items-center gap-1">
              {/* Line Chart Icon */}
              <button
                onClick={() => setVizType(vizType === 'line' ? null : 'line')}
                className={`p-2 rounded transition-colors ${
                  vizType === 'line'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }`}
                title="Gráfico de líneas"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 8 14 14 10 10 6 16 2 12" />
                  <line x1="2" y1="20" x2="22" y2="20" strokeWidth="1.5" />
                  <line x1="2" y1="20" x2="2" y2="4" strokeWidth="1.5" />
                </svg>
              </button>

              {/* Column Chart Icon */}
              <button
                onClick={() => setVizType(vizType === 'column' ? null : 'column')}
                className={`p-2 rounded transition-colors ${
                  vizType === 'column'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }`}
                title="Gráfico de columnas"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10" width="4" height="10" fill="currentColor" opacity="0.3" />
                  <rect x="10" y="6" width="4" height="14" fill="currentColor" opacity="0.3" />
                  <rect x="16" y="12" width="4" height="8" fill="currentColor" opacity="0.3" />
                  <line x1="2" y1="20" x2="22" y2="20" strokeWidth="1.5" />
                  <line x1="2" y1="20" x2="2" y2="4" strokeWidth="1.5" />
                </svg>
              </button>

              {/* Area Chart Icon */}
              <button
                onClick={() => setVizType(vizType === 'area' ? null : 'area')}
                className={`p-2 rounded transition-colors ${
                  vizType === 'area'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }`}
                title="Gráfico de área"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 20 L6 14 L10 16 L14 10 L18 12 L22 6 L22 20 Z" fill="currentColor" opacity="0.3" />
                  <polyline points="2 20 6 14 10 16 14 10 18 12 22 6" />
                  <line x1="2" y1="20" x2="22" y2="20" strokeWidth="1.5" />
                  <line x1="2" y1="20" x2="2" y2="4" strokeWidth="1.5" />
                </svg>
              </button>

              {/* Pie Chart Icon */}
              <button
                onClick={() => setVizType(vizType === 'pie' ? null : 'pie')}
                className={`p-2 rounded transition-colors ${
                  vizType === 'pie'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }`}
                title="Gráfico circular"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2 A10 10 0 0 1 22 12 L12 12 Z" fill="currentColor" opacity="0.3" />
                  <line x1="12" y1="12" x2="12" y2="2" />
                  <line x1="12" y1="12" x2="22" y2="12" />
                </svg>
              </button>

              {/* Single Value (KPI) Icon */}
              <button
                onClick={() => setVizType(vizType === 'single' ? null : 'single')}
                className={`p-2 rounded transition-colors ${
                  vizType === 'single'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }`}
                title="Valor único"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" fill="currentColor" opacity="0.1" />
                  <text x="12" y="15" textAnchor="middle" fontSize="10" fill="currentColor" stroke="none" fontWeight="bold">123</text>
                </svg>
              </button>

              {/* Progress Bar Chart Icon */}
              <button
                onClick={() => setVizType(vizType === 'progress' ? null : 'progress')}
                className={`p-2 rounded transition-colors ${
                  vizType === 'progress'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }`}
                title="Barras de progreso"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="16" height="4" rx="1" fill="currentColor" opacity="0.3" />
                  <rect x="3" y="10" width="12" height="4" rx="1" fill="currentColor" opacity="0.3" />
                  <rect x="3" y="16" width="8" height="4" rx="1" fill="currentColor" opacity="0.3" />
                </svg>
              </button>

              {/* Table Icon */}
              <button
                onClick={() => setVizType(vizType === 'table' ? null : 'table')}
                className={`p-2 rounded transition-colors ${
                  vizType === 'table'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }`}
                title="Tabla"
              >
                <TableCellsIcon className="h-5 w-5" />
              </button>

              {/* Scatter Plot Icon */}
              <button
                onClick={() => setVizType(vizType === 'scatter' ? null : 'scatter')}
                className={`p-2 rounded transition-colors ${
                  vizType === 'scatter'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }`}
                title="Scatter Plot"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="6" cy="18" r="2" fill="currentColor" />
                  <circle cx="9" cy="12" r="2" fill="currentColor" />
                  <circle cx="14" cy="15" r="2" fill="currentColor" />
                  <circle cx="12" cy="8" r="2" fill="currentColor" />
                  <circle cx="18" cy="6" r="2" fill="currentColor" />
                  <circle cx="17" cy="11" r="2" fill="currentColor" />
                </svg>
              </button>
            </div>

            {/* Settings Icon */}
            <button
              onClick={() => setShowVizOptions(!showVizOptions)}
              className={`p-2 rounded transition-colors ${
                showVizOptions
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
              }`}
              title="Opciones del gráfico"
            >
              <Cog6ToothIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Visualization Content with Sidebar */}
          <div className="flex">
            {/* Chart Area */}
            <div className={`flex-1 ${showVizOptions ? 'border-r border-gray-200' : ''}`}>
              {!vizType ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <ChartBarIcon className="h-12 w-12 mb-3 text-gray-300 stroke-[1.5]" />
                  <p className="text-sm font-medium text-gray-500">Selecciona un tipo de visualización</p>
                  <p className="text-xs text-gray-400 mt-1">Haz clic en uno de los iconos de arriba</p>
                </div>
              ) : sortedDataRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <ChartBarIcon className="h-12 w-12 mb-3 text-gray-300 stroke-[1.5]" />
                  <p className="text-sm font-medium text-gray-500">Sin datos para visualizar</p>
                  <p className="text-xs text-gray-400 mt-1">Ejecuta una consulta para ver el gráfico</p>
                </div>
              ) : selectedAttributes.length === 0 && vizType !== 'single' && vizType !== 'progress' && vizType !== 'table' && vizType !== 'scatter' ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <ChartBarIcon className="h-12 w-12 mb-3 text-gray-300 stroke-[1.5]" />
                  <p className="text-sm font-medium text-gray-500">Selecciona al menos un atributo</p>
                  <p className="text-xs text-gray-400 mt-1">El atributo será usado como eje X</p>
                </div>
              ) : selectedMetrics.length === 0 && vizType !== 'table' ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <ChartBarIcon className="h-12 w-12 mb-3 text-gray-300 stroke-[1.5]" />
                  <p className="text-sm font-medium text-gray-500">Selecciona al menos una métrica</p>
                  <p className="text-xs text-gray-400 mt-1">Las métricas serán los valores del gráfico</p>
                </div>
              ) : (vizType !== 'single' && vizType !== 'progress' && vizType !== 'table') && (
                <div className="p-4 font-montserrat">
                  <ResponsiveContainer width="100%" height={300}>
                    {vizType === 'line' ? (
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={showYGridLines} vertical={showXGridLines} />
                        <XAxis
                          dataKey={selectedAttributes[0]?.fieldId}
                          tick={{ fontSize: 11, fill: '#6b7280' }}
                          tickLine={{ stroke: '#d1d5db' }}
                          axisLine={{ stroke: '#d1d5db' }}
                          tickFormatter={xAxisFormatType !== 'auto' ? (value) => formatXAxisValue(value, xAxisFormatType, xAxisDatePattern, xAxisTimePattern) : undefined}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#6b7280' }}
                          tickLine={{ stroke: '#d1d5db' }}
                          axisLine={{ stroke: '#d1d5db' }}
                          tickFormatter={(value) => formatYAxisValue(value, yAxisFormatType)}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          labelStyle={{ color: '#9ca3af' }}
                          itemStyle={{ color: '#f3f4f6' }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '12px' }}
                          iconType="line"
                          onClick={(e) => {
                            const dataKey = e.dataKey as string
                            setHiddenSeries(prev => {
                              const next = new Set(prev)
                              if (next.has(dataKey)) {
                                next.delete(dataKey)
                              } else {
                                next.add(dataKey)
                              }
                              return next
                            })
                          }}
                          formatter={(value, entry) => {
                            const isHidden = hiddenSeries.has(entry.dataKey as string)
                            return (
                              <span
                                style={{
                                  color: isHidden ? '#9ca3af' : '#374151',
                                  textDecoration: isHidden ? 'line-through' : 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                {value}
                              </span>
                            )
                          }}
                        />
                        {/* Reference Line Y (horizontal) */}
                        {referenceLineYEnabled && referenceLineYValue !== '' && (
                          <ReferenceLine
                            y={referenceLineYValue}
                            stroke={referenceLineYColor}
                            strokeDasharray="5 5"
                            strokeWidth={2}
                          />
                        )}
                        {/* Reference Line X (vertical) */}
                        {referenceLineXEnabled && referenceLineXValue !== '' && (
                          <ReferenceLine
                            x={referenceLineXValue}
                            stroke={referenceLineXColor}
                            strokeDasharray="5 5"
                            strokeWidth={2}
                          />
                        )}
                        {selectedMetrics.map((metric, index) => {
                          const defaultColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
                          const config = seriesConfig[metric.fieldId] || {}
                          const color = config.color || defaultColors[index % defaultColors.length]
                          const label = config.label || metric.label
                          const seriesFormat = config.format || metricFormats[metric.id] || 'number'
                          const isHidden = hiddenSeries.has(metric.fieldId)

                          // Point style configuration
                          let dotConfig: boolean | object = false
                          if (pointStyle === 'filled') {
                            dotConfig = { r: 3, fill: color, stroke: color }
                          } else if (pointStyle === 'outline') {
                            dotConfig = { r: 3, fill: '#fff', stroke: color, strokeWidth: 2 }
                          }
                          // pointStyle === 'none' -> dotConfig stays false

                          return (
                            <Line
                              key={metric.id}
                              type="monotone"
                              dataKey={metric.fieldId}
                              name={label}
                              stroke={color}
                              strokeWidth={2}
                              dot={dotConfig}
                              activeDot={pointStyle !== 'none' ? { r: 5, fill: color } : false}
                              connectNulls={false}
                              hide={isHidden}
                            >
                              {showDataLabels && !isHidden && (
                                <LabelList
                                  dataKey={metric.fieldId}
                                  position="top"
                                  fill="#374151"
                                  fontSize={10}
                                  formatter={(value: number) => formatMetricValue(value, seriesFormat)}
                                />
                              )}
                            </Line>
                          )
                        })}
                      </LineChart>
                    ) : vizType === 'column' ? (
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={showYGridLines} vertical={showXGridLines} />
                        <XAxis
                          dataKey={selectedAttributes[0]?.fieldId}
                          tick={{ fontSize: 11, fill: '#6b7280' }}
                          tickLine={{ stroke: '#d1d5db' }}
                          axisLine={{ stroke: '#d1d5db' }}
                          tickFormatter={xAxisFormatType !== 'auto' ? (value) => formatXAxisValue(value, xAxisFormatType, xAxisDatePattern, xAxisTimePattern) : undefined}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#6b7280' }}
                          tickLine={{ stroke: '#d1d5db' }}
                          axisLine={{ stroke: '#d1d5db' }}
                          tickFormatter={(value) => formatYAxisValue(value, yAxisFormatType)}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          labelStyle={{ color: '#9ca3af' }}
                          itemStyle={{ color: '#f3f4f6' }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '12px' }}
                          iconType="square"
                          onClick={(e) => {
                            const dataKey = e.dataKey as string
                            setHiddenSeries(prev => {
                              const next = new Set(prev)
                              if (next.has(dataKey)) {
                                next.delete(dataKey)
                              } else {
                                next.add(dataKey)
                              }
                              return next
                            })
                          }}
                          formatter={(value, entry) => {
                            const isHidden = hiddenSeries.has(entry.dataKey as string)
                            return (
                              <span
                                style={{
                                  color: isHidden ? '#9ca3af' : '#374151',
                                  textDecoration: isHidden ? 'line-through' : 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                {value}
                              </span>
                            )
                          }}
                        />
                        {/* Reference Line Y (horizontal) */}
                        {referenceLineYEnabled && referenceLineYValue !== '' && (
                          <ReferenceLine
                            y={referenceLineYValue}
                            stroke={referenceLineYColor}
                            strokeDasharray="5 5"
                            strokeWidth={2}
                          />
                        )}
                        {/* Reference Line X (vertical) */}
                        {referenceLineXEnabled && referenceLineXValue !== '' && (
                          <ReferenceLine
                            x={referenceLineXValue}
                            stroke={referenceLineXColor}
                            strokeDasharray="5 5"
                            strokeWidth={2}
                          />
                        )}
                        {selectedMetrics.map((metric, index) => {
                          const defaultColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
                          const config = seriesConfig[metric.fieldId] || {}
                          const color = config.color || defaultColors[index % defaultColors.length]
                          const label = config.label || metric.label
                          const seriesFormat = config.format || metricFormats[metric.id] || 'number'
                          const isHidden = hiddenSeries.has(metric.fieldId)

                          return (
                            <Bar
                              key={metric.id}
                              dataKey={metric.fieldId}
                              name={label}
                              fill={color}
                              radius={[4, 4, 0, 0]}
                              hide={isHidden}
                            >
                              {showDataLabels && !isHidden && (
                                <LabelList
                                  dataKey={metric.fieldId}
                                  position="top"
                                  fill="#374151"
                                  fontSize={10}
                                  formatter={(value: number) => formatMetricValue(value, seriesFormat)}
                                />
                              )}
                            </Bar>
                          )
                        })}
                      </BarChart>
                    ) : vizType === 'area' ? (
                      <AreaChart data={chartData}>
                        <defs>
                          {selectedMetrics.map((metric, index) => {
                            const defaultColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
                            const config = seriesConfig[metric.fieldId] || {}
                            const color = config.color || defaultColors[index % defaultColors.length]
                            return (
                              <linearGradient key={`gradient-${metric.id}`} id={`gradient-${metric.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                                <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                              </linearGradient>
                            )
                          })}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={showYGridLines} vertical={showXGridLines} />
                        <XAxis
                          dataKey={selectedAttributes[0]?.fieldId}
                          tick={{ fontSize: 11, fill: '#6b7280' }}
                          tickLine={{ stroke: '#d1d5db' }}
                          axisLine={{ stroke: '#d1d5db' }}
                          tickFormatter={xAxisFormatType !== 'auto' ? (value) => formatXAxisValue(value, xAxisFormatType, xAxisDatePattern, xAxisTimePattern) : undefined}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#6b7280' }}
                          tickLine={{ stroke: '#d1d5db' }}
                          axisLine={{ stroke: '#d1d5db' }}
                          tickFormatter={(value) => formatYAxisValue(value, yAxisFormatType)}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          labelStyle={{ color: '#9ca3af' }}
                          itemStyle={{ color: '#f3f4f6' }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '12px' }}
                          iconType="rect"
                          onClick={(e) => {
                            const dataKey = e.dataKey as string
                            setHiddenSeries(prev => {
                              const next = new Set(prev)
                              if (next.has(dataKey)) {
                                next.delete(dataKey)
                              } else {
                                next.add(dataKey)
                              }
                              return next
                            })
                          }}
                          formatter={(value, entry) => {
                            const isHidden = hiddenSeries.has(entry.dataKey as string)
                            return (
                              <span
                                style={{
                                  color: isHidden ? '#9ca3af' : '#374151',
                                  textDecoration: isHidden ? 'line-through' : 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                {value}
                              </span>
                            )
                          }}
                        />
                        {/* Reference Line Y (horizontal) */}
                        {referenceLineYEnabled && referenceLineYValue !== '' && (
                          <ReferenceLine
                            y={referenceLineYValue}
                            stroke={referenceLineYColor}
                            strokeDasharray="5 5"
                            strokeWidth={2}
                          />
                        )}
                        {/* Reference Line X (vertical) */}
                        {referenceLineXEnabled && referenceLineXValue !== '' && (
                          <ReferenceLine
                            x={referenceLineXValue}
                            stroke={referenceLineXColor}
                            strokeDasharray="5 5"
                            strokeWidth={2}
                          />
                        )}
                        {selectedMetrics.map((metric, index) => {
                          const defaultColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
                          const config = seriesConfig[metric.fieldId] || {}
                          const color = config.color || defaultColors[index % defaultColors.length]
                          const label = config.label || metric.label
                          const seriesFormat = config.format || metricFormats[metric.id] || 'number'
                          const isHidden = hiddenSeries.has(metric.fieldId)

                          // Point style configuration
                          let dotConfig: boolean | object = false
                          if (pointStyle === 'filled') {
                            dotConfig = { r: 3, fill: color, stroke: color }
                          } else if (pointStyle === 'outline') {
                            dotConfig = { r: 3, fill: '#fff', stroke: color, strokeWidth: 2 }
                          }

                          return (
                            <Area
                              key={metric.id}
                              type="monotone"
                              dataKey={metric.fieldId}
                              name={label}
                              stroke={color}
                              fill={areaFillType === 'gradient' ? `url(#gradient-${metric.id})` : color}
                              fillOpacity={areaFillType === 'gradient' ? 1 : 0.3}
                              strokeWidth={2}
                              hide={isHidden}
                              dot={dotConfig}
                              activeDot={pointStyle !== 'none' ? { r: 5, fill: color } : false}
                            >
                              {showDataLabels && !isHidden && (
                                <LabelList
                                  dataKey={metric.fieldId}
                                  position="top"
                                  fill="#374151"
                                  fontSize={10}
                                  formatter={(value: number) => formatMetricValue(value, seriesFormat)}
                                />
                              )}
                            </Area>
                          )
                        })}
                      </AreaChart>
                    ) : vizType === 'scatter' ? (
                      (() => {
                        // Scatter plot needs at least 2 metrics for X and Y axes
                        if (selectedMetrics.length < 2) {
                          return (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                              <ChartBarIcon className="h-12 w-12 mb-3 text-gray-300 stroke-[1.5]" />
                              <p className="text-sm font-medium text-gray-500">Scatter Plot requiere 2 métricas</p>
                              <p className="text-xs text-gray-400 mt-1">Primera métrica = Eje X, Segunda = Eje Y</p>
                            </div>
                          )
                        }

                        const xMetric = selectedMetrics[0]
                        const yMetric = selectedMetrics[1]
                        const xLabel = seriesConfig[xMetric.fieldId]?.label || xMetric.label
                        const yLabel = seriesConfig[yMetric.fieldId]?.label || yMetric.label
                        const defaultColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

                        // If there's an attribute, group by it for different colors
                        const hasCategory = selectedAttributes.length > 0
                        const categoryField = selectedAttributes[0]?.fieldId

                        // Group data by category if available
                        const groupedData: Record<string, Record<string, unknown>[]> = {}
                        if (hasCategory && categoryField) {
                          chartData.forEach(row => {
                            const category = String(row[categoryField] || 'Sin categoría')
                            if (!groupedData[category]) {
                              groupedData[category] = []
                            }
                            groupedData[category].push(row)
                          })
                        } else {
                          groupedData['data'] = chartData
                        }

                        const categories = Object.keys(groupedData)

                        return (
                          <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                              type="number"
                              dataKey={xMetric.fieldId}
                              name={xLabel}
                              tick={{ fill: '#6b7280', fontSize: 11 }}
                              tickLine={{ stroke: '#e5e7eb' }}
                              axisLine={{ stroke: '#e5e7eb' }}
                              label={{ value: xLabel, position: 'bottom', offset: 0, fill: '#6b7280', fontSize: 11 }}
                            />
                            <YAxis
                              type="number"
                              dataKey={yMetric.fieldId}
                              name={yLabel}
                              tick={{ fill: '#6b7280', fontSize: 11 }}
                              tickLine={{ stroke: '#e5e7eb' }}
                              axisLine={{ stroke: '#e5e7eb' }}
                              label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
                            />
                            <ZAxis range={[60, 60]} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#1f2937',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '8px 12px',
                              }}
                              itemStyle={{ color: '#fff', fontSize: 12 }}
                              labelStyle={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}
                              formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                              labelFormatter={(label) => hasCategory ? `${selectedAttributes[0]?.label}: ${label}` : ''}
                            />
                            {hasCategory && (
                              <Legend
                                wrapperStyle={{ paddingTop: 10 }}
                                formatter={(value: string) => <span style={{ color: '#374151', fontSize: 12 }}>{value}</span>}
                              />
                            )}
                            {categories.map((category, idx) => (
                              <Scatter
                                key={category}
                                name={hasCategory ? category : yLabel}
                                data={groupedData[category]}
                                fill={seriesConfig[`scatter_${category}`]?.color || defaultColors[idx % defaultColors.length]}
                              />
                            ))}
                          </ScatterChart>
                        )
                      })()
                    ) : vizType === 'pie' ? (
                      (() => {
                        // Find the first metric column based on table order (orderedColumns)
                        const firstMetricColumn = orderedColumns.find(col =>
                          col.type === 'number' || col.type === 'currency' || col.type === 'percent'
                        )
                        const firstMetricFieldId = firstMetricColumn?.id
                        const firstMetric = selectedMetrics.find(m => m.fieldId === firstMetricFieldId) || selectedMetrics[0]

                        const metricLabel = seriesConfig[firstMetric?.fieldId]?.label || firstMetric?.label || 'Valor'
                        const metricFormat = seriesConfig[firstMetric?.fieldId]?.format || metricFormats[firstMetric?.id] || 'number'
                        const attrLabel = selectedAttributes[0]?.label || 'Categoría'
                        const defaultColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#EC4899']

                        // Build pie colors from series config or defaults
                        const pieColors = chartData.map((_, index) => {
                          // Check if there's a color configured for this index in seriesConfig
                          // We use the attribute values as keys for pie segment colors
                          const attrValue = chartData[index]?.[selectedAttributes[0]?.fieldId] as string
                          const configKey = `pie_${attrValue}`
                          return seriesConfig[configKey]?.color || defaultColors[index % defaultColors.length]
                        })

                        return (
                          <PieChart>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#1f2937',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '12px',
                                padding: '8px 12px',
                              }}
                              labelStyle={{ color: '#f3f4f6', fontWeight: 500 }}
                              itemStyle={{ color: '#f3f4f6' }}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0]
                                  return (
                                    <div style={{
                                      backgroundColor: '#1f2937',
                                      border: 'none',
                                      borderRadius: '8px',
                                      fontSize: '12px',
                                      padding: '8px 12px',
                                      color: '#f3f4f6'
                                    }}>
                                      <div style={{ marginBottom: '4px' }}>
                                        <span style={{ color: '#9ca3af' }}>{attrLabel}: </span>
                                        <span style={{ fontWeight: 500 }}>{data.name}</span>
                                      </div>
                                      <div>
                                        <span style={{ color: '#9ca3af' }}>{metricLabel}: </span>
                                        <span style={{ fontWeight: 500 }}>{formatMetricValue(data.value as number, metricFormat)}</span>
                                      </div>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Legend
                              wrapperStyle={{ fontSize: '12px' }}
                              iconType="circle"
                            />
                            <Pie
                              data={chartData.map((row, index) => {
                                return {
                                  name: row[selectedAttributes[0]?.fieldId] as string,
                                  value: row[firstMetric?.fieldId] as number,
                                  fill: pieColors[index]
                                }
                              })}
                              cx="50%"
                              cy="50%"
                              innerRadius={pieInnerRadius}
                              outerRadius={100}
                              paddingAngle={2}
                              dataKey="value"
                              nameKey="name"
                              label={showDataLabels ? ({ cx, cy, midAngle, outerRadius, name, percent }) => {
                                const RADIAN = Math.PI / 180
                                const radius = outerRadius * 1.2
                                const x = cx + radius * Math.cos(-midAngle * RADIAN)
                                const y = cy + radius * Math.sin(-midAngle * RADIAN)
                                return (
                                  <text
                                    x={x}
                                    y={y}
                                    fill="#374151"
                                    textAnchor={x > cx ? 'start' : 'end'}
                                    dominantBaseline="central"
                                    fontSize={10}
                                  >
                                    {`${name}: ${(percent * 100).toFixed(0)}%`}
                                  </text>
                                )
                              } : false}
                              labelLine={showDataLabels ? { stroke: '#9ca3af', strokeWidth: 1 } : false}
                            >
                              {chartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={pieColors[index]} />
                              ))}
                            </Pie>
                          </PieChart>
                        )
                      })()
                    ) : vizType === 'single' ? (
                      <></>
                    ) : <></>}
                  </ResponsiveContainer>
                </div>
              )}

              {/* Single Value Visualization (outside ResponsiveContainer) */}
              {vizType === 'single' && (
                (() => {
                  // Get the first column from orderedColumns (first column in table)
                  const firstColumn = orderedColumns[0]
                  const defaultLabel = firstColumn?.label || 'Valor'
                  const displayLabel = singleValueLabel || defaultLabel

                  // Get the first row's value for the first column
                  const firstRow = sortedDataRows[0]
                  const rawValue = firstRow && firstColumn ? (firstRow[firstColumn.id] as number) ?? 0 : 0

                  // Format the value based on single value settings
                  const formatSingleValue = (val: number): string => {
                    const format = singleValueFormat
                    const decPlaces = singleValueDecimalPlaces
                    const useDot = singleValueDecimalSeparator === 'dot'

                    let result: string
                    // For percent format, multiply by 100
                    const displayVal = format === 'percent' ? val * 100 : val

                    switch (format) {
                      case 'compact':
                        if (Math.abs(displayVal) >= 1000000000) result = `${(displayVal / 1000000000).toFixed(1)}B`
                        else if (Math.abs(displayVal) >= 1000000) result = `${(displayVal / 1000000).toFixed(1)}M`
                        else if (Math.abs(displayVal) >= 1000) result = `${(displayVal / 1000).toFixed(1)}K`
                        else result = displayVal.toFixed(decPlaces)
                        break
                      case 'percent':
                        result = `${displayVal.toFixed(decPlaces)}%`
                        break
                      case 'currency':
                        result = `$${displayVal.toFixed(decPlaces)}`
                        break
                      case 'number':
                        result = displayVal.toFixed(decPlaces)
                        break
                      default: // auto
                        result = displayVal.toLocaleString(useDot ? 'en-US' : 'es-ES', {
                          minimumFractionDigits: decPlaces,
                          maximumFractionDigits: decPlaces
                        })
                    }

                    // Apply decimal separator
                    if (!useDot && format !== 'auto') {
                      result = result.replace('.', ',')
                    }
                    return result
                  }

                  const formattedValue = formatSingleValue(rawValue)

                  // Determine color based on thresholds
                  let displayColor = singleValueColor
                  if (singleValueUseThresholds && singleValueThresholds.length > 0) {
                    for (const threshold of singleValueThresholds) {
                      const minOk = threshold.min === null || rawValue >= threshold.min
                      const maxOk = threshold.max === null || rawValue <= threshold.max
                      if (minOk && maxOk) {
                        displayColor = threshold.color
                        break
                      }
                    }
                  }

                  const labelElement = (
                    <div className={`text-sm text-gray-500 ${singleValueLabelBold ? 'font-bold' : 'font-medium'}`}>{displayLabel}</div>
                  )

                  const valueElement = (
                    <div
                      className="text-5xl font-thin"
                      style={{ color: displayColor }}
                    >
                      {formattedValue}
                    </div>
                  )

                  return (
                    <div className="flex justify-center py-6 font-montserrat">
                      <div className="text-center">
                        {singleValueLabelPosition === 'above' ? (
                          <>
                            {labelElement}
                            <div className="mt-2">{valueElement}</div>
                          </>
                        ) : (
                          <>
                            {valueElement}
                            <div className="mt-2">{labelElement}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })()
              )}

              {/* Progress Bar Chart Visualization */}
              {vizType === 'progress' && (
                (() => {
                  // Get attribute and metric columns
                  const attrColumn = orderedColumns.find(col =>
                    selectedAttributes.some(a => a.fieldId === col.id)
                  )
                  const metricColumn = orderedColumns.find(col =>
                    selectedMetrics.some(m => m.fieldId === col.id)
                  )

                  if (!attrColumn || !metricColumn) {
                    return (
                      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                        <p className="text-sm">Selecciona un atributo y una métrica</p>
                      </div>
                    )
                  }

                  // Get max value for calculating bar widths
                  const values = sortedDataRows.map(row => (row[metricColumn.id] as number) || 0)
                  const maxValue = Math.max(...values, 1)

                  // Limit rows based on chartRowLimit if enabled
                  const displayRows = chartRowLimitEnabled ? sortedDataRows.slice(0, chartRowLimit) : sortedDataRows

                  const metricLabel = metricColumn.label || 'Valor'

                  return (
                    <div className="p-4 space-y-3 font-montserrat">
                      {displayRows.map((row, idx) => {
                        const label = String(row[attrColumn.id] || '')
                        const value = (row[metricColumn.id] as number) || 0
                        const percentage = (value / maxValue) * 100

                        // Format value
                        const formattedValue = value >= 1000000
                          ? `$${(value / 1000000).toFixed(1)}M`
                          : value >= 1000
                          ? `$${(value / 1000).toFixed(0)}K`
                          : `$${value.toLocaleString()}`

                        // Full formatted value for tooltip
                        const fullValue = `$${value.toLocaleString()}`

                        // Determine bar color based on thresholds
                        let barColor = '#3B82F6' // default blue
                        if (progressBarUseThresholds && progressBarThresholds.length > 0) {
                          for (const threshold of progressBarThresholds) {
                            const minOk = threshold.min === null || value >= threshold.min
                            const maxOk = threshold.max === null || value <= threshold.max
                            if (minOk && maxOk) {
                              barColor = threshold.color
                              break
                            }
                          }
                        }

                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-800" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 200, fontSize: `${progressBarFontSize}px` }}>{label}</span>
                              <span className="text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 200, fontSize: `${progressBarFontSize}px` }}>{formattedValue}</span>
                            </div>
                            <div className={`w-full bg-gray-100 rounded-full group relative ${progressBarShowValues ? 'h-6' : 'h-2.5'}`}>
                              <div
                                className={`rounded-full transition-all duration-300 ${progressBarShowValues ? 'h-6' : 'h-2.5'}`}
                                style={{ width: `${percentage}%`, backgroundColor: barColor }}
                              >
                                {progressBarShowValues && percentage > 15 && (
                                  <span className="text-white text-xs font-medium px-2 leading-6 block truncate">{fullValue}</span>
                                )}
                              </div>
                              {/* Tooltip */}
                              <div className={`absolute left-1/2 -translate-x-1/2 ${progressBarShowValues ? '-top-16' : '-top-14'} bg-gray-800 text-white text-xs px-3 py-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10`}>
                                <div className="font-medium">{label}</div>
                                <div className="text-gray-300 mt-1">{metricLabel}: {fullValue}</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()
              )}

              {/* Table Visualization */}
              {vizType === 'table' && (
                <div
                  className="p-4 font-montserrat overflow-auto"
                  onMouseMove={(e) => {
                    if (resizingColumn) {
                      const delta = e.clientX - resizeStartX
                      const newWidth = Math.max(60, resizeStartWidth + delta)
                      setTableColumnWidths(prev => ({ ...prev, [resizingColumn]: newWidth }))
                    }
                  }}
                  onMouseUp={() => setResizingColumn(null)}
                  onMouseLeave={() => setResizingColumn(null)}
                >
                  <table className={`border-collapse ${
                    tableFontSize === 'xs' ? 'text-xs' :
                    tableFontSize === 'sm' ? 'text-sm' :
                    tableFontSize === 'base' ? 'text-base' : 'text-lg'
                  }`} style={{ minWidth: '100%' }}>
                    {tableShowHeader && (
                      <thead>
                        <tr className={`border-b-2 ${tableHeaderBg === 'black' ? 'border-gray-700' : 'border-gray-200'}`}>
                          {tableShowRowNumbers && (
                            <th
                              className={`px-3 py-3 font-semibold w-12 ${
                                tableHeaderAlign === 'left' ? 'text-left' :
                                tableHeaderAlign === 'center' ? 'text-center' : 'text-right'
                              } ${
                                tableHeaderBg === 'white' ? 'bg-white text-gray-600' :
                                tableHeaderBg === 'gray' ? 'bg-gray-50 text-gray-600' :
                                'bg-gray-800 text-white'
                              }`}
                            >
                              #
                            </th>
                          )}
                          {orderedColumns.map((col) => (
                            <th
                              key={col.id}
                              className={`px-3 py-3 font-semibold relative ${
                                tableHeaderAlign === 'left' ? 'text-left' :
                                tableHeaderAlign === 'center' ? 'text-center' : 'text-right'
                              } ${
                                tableHeaderBg === 'white' ? 'bg-white text-gray-600' :
                                tableHeaderBg === 'gray' ? 'bg-gray-50 text-gray-600' :
                                'bg-gray-800 text-white'
                              } ${tableSortable ? 'cursor-pointer' : ''}`}
                              style={{ width: tableColumnWidths[col.id] || 'auto', minWidth: 60 }}
                              onClick={() => {
                                if (tableSortable) {
                                  const currentSort = sortConfig.find(s => s.field === col.id)
                                  if (currentSort) {
                                    setSortConfig(prev =>
                                      prev.map(s => s.field === col.id
                                        ? { ...s, direction: s.direction === 'ASC' ? 'DESC' : 'ASC' }
                                        : s
                                      )
                                    )
                                  } else {
                                    setSortConfig([{ field: col.id, direction: 'ASC' }])
                                  }
                                }
                              }}
                            >
                              <div className={`flex items-center gap-1 pr-2 ${
                                tableHeaderAlign === 'center' ? 'justify-center' :
                                tableHeaderAlign === 'right' ? 'justify-end' : 'justify-start'
                              }`}>
                                {seriesConfig[col.id]?.label || col.label}
                                {tableSortable && sortConfig.find(s => s.field === col.id) && (
                                  <span className={tableHeaderBg === 'black' ? 'text-blue-400' : 'text-purple-500'}>
                                    {sortConfig.find(s => s.field === col.id)?.direction === 'ASC' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                              {/* Resize handle */}
                              <div
                                className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 ${
                                  resizingColumn === col.id ? 'bg-blue-500' : ''
                                }`}
                                onMouseDown={(e) => {
                                  e.stopPropagation()
                                  setResizingColumn(col.id)
                                  setResizeStartX(e.clientX)
                                  setResizeStartWidth(tableColumnWidths[col.id] || (e.currentTarget.parentElement?.offsetWidth || 100))
                                }}
                              />
                            </th>
                          ))}
                        </tr>
                      </thead>
                    )}
                    <tbody>
                      {(chartRowLimitEnabled ? sortedDataRows.slice(0, chartRowLimit) : sortedDataRows).map((row, rowIdx) => (
                        <tr
                          key={rowIdx}
                          className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${tableStriped && rowIdx % 2 === 1 ? 'bg-gray-50' : ''}`}
                        >
                          {tableShowRowNumbers && (
                            <td className="px-3 py-2 text-gray-400 font-mono">{rowIdx + 1}</td>
                          )}
                          {orderedColumns.map((col) => {
                            const value = row[col.id]
                            const isMetric = selectedMetrics.some(m => m.fieldId === col.id)
                            const colConfig = seriesConfig[col.id] || {}
                            const colFormat = colConfig.format || metricFormats[col.id] || 'number'
                            const colThresholds = colConfig.thresholds || []

                            // Check if this is a comparison column
                            const isDeltaColumn = col.id.endsWith('_delta')
                            const isDeltaPctColumn = col.id.endsWith('_delta_pct')
                            const isComparisonColumn = col.id.endsWith('_current') || col.id.endsWith('_previous') || isDeltaColumn || isDeltaPctColumn

                            // Format value based on config
                            let formattedValue = String(value ?? '')
                            let comparisonColor: string | undefined

                            if (isDeltaPctColumn && typeof value === 'number') {
                              // Delta percentage: show with arrow and sign
                              const arrow = value > 0 ? '↑' : value < 0 ? '↓' : ''
                              const sign = value > 0 ? '+' : ''
                              formattedValue = `${arrow} ${sign}${value.toFixed(1)}%`
                              comparisonColor = value > 0 ? '#16a34a' : value < 0 ? '#dc2626' : '#6b7280'
                            } else if (isDeltaColumn && typeof value === 'number') {
                              // Delta: show with sign and color
                              const sign = value > 0 ? '+' : ''
                              formattedValue = `${sign}${value.toLocaleString()}`
                              comparisonColor = value > 0 ? '#16a34a' : value < 0 ? '#dc2626' : '#6b7280'
                            } else if ((isMetric || isComparisonColumn) && typeof value === 'number') {
                              switch (colFormat) {
                                case 'currency':
                                  formattedValue = `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  break
                                case 'percent':
                                  formattedValue = `${(value * 100).toFixed(1)}%`
                                  break
                                case 'compact':
                                  if (value >= 1000000000) formattedValue = `${(value / 1000000000).toFixed(1)}B`
                                  else if (value >= 1000000) formattedValue = `${(value / 1000000).toFixed(1)}M`
                                  else if (value >= 1000) formattedValue = `${(value / 1000).toFixed(1)}K`
                                  else formattedValue = value.toLocaleString()
                                  break
                                case 'decimal':
                                  formattedValue = value.toFixed(2)
                                  break
                                default:
                                  formattedValue = value.toLocaleString()
                              }
                            }

                            // Find matching threshold for color
                            let thresholdColor: string | undefined
                            if (isMetric && typeof value === 'number' && colThresholds.length > 0) {
                              for (const threshold of colThresholds) {
                                const minOk = threshold.min === null || value >= threshold.min
                                const maxOk = threshold.max === null || value <= threshold.max
                                if (minOk && maxOk) {
                                  thresholdColor = threshold.color
                                  break
                                }
                              }
                            }

                            // Determine final color: comparison color > threshold color > default
                            const cellColor = comparisonColor || thresholdColor || '#374151'

                            // Get alignment: use series config, or default (right for metrics/comparison, left for attributes)
                            const cellAlign = colConfig.align || ((isMetric || isComparisonColumn) ? 'right' : 'left')
                            const alignClass = cellAlign === 'center' ? 'text-center' : cellAlign === 'right' ? 'text-right' : 'text-left'

                            // Get font size: use series config if set
                            const cellFontSize = colConfig.fontSize
                            const fontSizeClass = cellFontSize
                              ? (cellFontSize === 'xs' ? 'text-xs' : cellFontSize === 'sm' ? 'text-sm' : cellFontSize === 'base' ? 'text-base' : 'text-lg')
                              : ''

                            return (
                              <td
                                key={col.id}
                                className={`px-3 py-2 ${alignClass} ${(isMetric || isComparisonColumn) ? 'font-mono' : ''} ${fontSizeClass}`}
                                style={{
                                  width: tableColumnWidths[col.id] || 'auto',
                                  minWidth: 60,
                                  color: cellColor,
                                  fontWeight: (comparisonColor || thresholdColor) ? 600 : undefined,
                                }}
                              >
                                {formattedValue}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                    {/* Totals Footer */}
                    {showTotals && sortedDataRows.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                          {tableShowRowNumbers && (
                            <td className="px-3 py-2 text-gray-500">Total</td>
                          )}
                          {orderedColumns.map((col) => {
                            const isMetric = selectedMetrics.some(m => m.fieldId === col.id)
                            const total = columnTotals[col.id]
                            const colConfig = seriesConfig[col.id] || {}
                            const colFormat = colConfig.format || metricFormats[col.id] || 'number'

                            // Get alignment from series config
                            const cellAlign = colConfig.align || (isMetric ? 'right' : 'left')
                            const alignClass = cellAlign === 'center' ? 'text-center' : cellAlign === 'right' ? 'text-right' : 'text-left'

                            // Get font size from series config
                            const cellFontSize = colConfig.fontSize
                            const fontSizeClass = cellFontSize
                              ? (cellFontSize === 'xs' ? 'text-xs' : cellFontSize === 'sm' ? 'text-sm' : cellFontSize === 'base' ? 'text-base' : 'text-lg')
                              : ''

                            // Format the total value
                            let formattedTotal = ''
                            if (isMetric && total !== undefined) {
                              switch (colFormat) {
                                case 'currency':
                                  formattedTotal = `$${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  break
                                case 'percent':
                                  formattedTotal = `${(total * 100).toFixed(1)}%`
                                  break
                                case 'compact':
                                  if (total >= 1000000000) formattedTotal = `${(total / 1000000000).toFixed(1)}B`
                                  else if (total >= 1000000) formattedTotal = `${(total / 1000000).toFixed(1)}M`
                                  else if (total >= 1000) formattedTotal = `${(total / 1000).toFixed(1)}K`
                                  else formattedTotal = total.toLocaleString()
                                  break
                                case 'decimal':
                                  formattedTotal = total.toFixed(2)
                                  break
                                default:
                                  formattedTotal = total.toLocaleString()
                              }
                            }

                            return (
                              <td
                                key={col.id}
                                className={`px-3 py-2 ${alignClass} ${isMetric ? 'font-mono' : ''} ${fontSizeClass} text-gray-700`}
                                style={{
                                  width: tableColumnWidths[col.id] || 'auto',
                                  minWidth: 60,
                                }}
                              >
                                {isMetric ? formattedTotal : (tableShowRowNumbers ? '' : (orderedColumns.indexOf(col) === 0 ? 'Total' : ''))}
                              </td>
                            )
                          })}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                  {chartRowLimitEnabled && sortedDataRows.length > chartRowLimit && (
                    <div className="text-center text-xs text-gray-400 mt-3">
                      Mostrando {chartRowLimit} de {sortedDataRows.length} filas
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Options Sidebar */}
            {showVizOptions && (
              <div className="w-64 bg-gray-50 flex-shrink-0">
                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-white">
                  {(['general', 'series', 'data', 'x', 'y', 'format'] as const)
                    .filter(tab => {
                      // Hide X and Y tabs for pie, single value, progress and table charts
                      if ((vizType === 'pie' || vizType === 'single' || vizType === 'progress' || vizType === 'table') && (tab === 'x' || tab === 'y')) {
                        return false
                      }
                      // Hide Series tab for single value and progress (but show for table)
                      if ((vizType === 'single' || vizType === 'progress') && tab === 'series') {
                        return false
                      }
                      // Show Format tab only for table
                      if (tab === 'format' && vizType !== 'table') {
                        return false
                      }
                      return true
                    })
                    .map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setVizOptionsTab(tab)}
                      className={`flex-1 px-1 py-2 text-[10px] font-medium transition-colors ${
                        vizOptionsTab === tab
                          ? 'text-purple-700 border-b-2 border-purple-700 bg-purple-50'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {tab === 'general' ? 'General' :
                       tab === 'series' ? 'Series' :
                       tab === 'data' ? 'Data' :
                       tab === 'x' ? 'X' :
                       tab === 'y' ? 'Y' : 'Formato'}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="p-3 overflow-y-auto" style={{ maxHeight: '280px' }}>
                  {vizOptionsTab === 'general' && (
                    <div className="space-y-4">
                      {/* Table specific options */}
                      {vizType === 'table' ? (
                        <>
                          {/* Show Header toggle */}
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-xs font-medium text-gray-700">Mostrar encabezado</label>
                              <p className="text-[10px] text-gray-400">Mostrar fila de títulos de columnas</p>
                            </div>
                            <button
                              onClick={() => setTableShowHeader(!tableShowHeader)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                tableShowHeader ? 'bg-blue-500' : 'bg-gray-300'
                              }`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                tableShowHeader ? 'translate-x-4' : 'translate-x-0.5'
                              }`} />
                            </button>
                          </div>

                          {/* Striped rows toggle */}
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-xs font-medium text-gray-700">Filas alternadas</label>
                              <p className="text-[10px] text-gray-400">Colorear filas alternadamente</p>
                            </div>
                            <button
                              onClick={() => setTableStriped(!tableStriped)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                tableStriped ? 'bg-blue-500' : 'bg-gray-300'
                              }`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                tableStriped ? 'translate-x-4' : 'translate-x-0.5'
                              }`} />
                            </button>
                          </div>

                          {/* Compact mode toggle */}
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-xs font-medium text-gray-700">Modo compacto</label>
                              <p className="text-[10px] text-gray-400">Reducir espaciado entre filas</p>
                            </div>
                            <button
                              onClick={() => setTableCompact(!tableCompact)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                tableCompact ? 'bg-blue-500' : 'bg-gray-300'
                              }`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                tableCompact ? 'translate-x-4' : 'translate-x-0.5'
                              }`} />
                            </button>
                          </div>

                          {/* Sortable toggle */}
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-xs font-medium text-gray-700">Ordenable</label>
                              <p className="text-[10px] text-gray-400">Permitir ordenar por columnas</p>
                            </div>
                            <button
                              onClick={() => setTableSortable(!tableSortable)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                tableSortable ? 'bg-blue-500' : 'bg-gray-300'
                              }`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                tableSortable ? 'translate-x-4' : 'translate-x-0.5'
                              }`} />
                            </button>
                          </div>

                          {/* Show Row Numbers toggle */}
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-xs font-medium text-gray-700">Números de fila</label>
                              <p className="text-[10px] text-gray-400">Mostrar numeración de filas</p>
                            </div>
                            <button
                              onClick={() => setTableShowRowNumbers(!tableShowRowNumbers)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                tableShowRowNumbers ? 'bg-blue-500' : 'bg-gray-300'
                              }`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                tableShowRowNumbers ? 'translate-x-4' : 'translate-x-0.5'
                              }`} />
                            </button>
                          </div>

                          {/* Row limit option */}
                          <div>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={chartRowLimitEnabled}
                                  onChange={(e) => setChartRowLimitEnabled(e.target.checked)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs font-medium text-gray-700">Mostrar primeras</span>
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="1000"
                                value={chartRowLimit}
                                onChange={(e) => setChartRowLimit(Math.max(1, parseInt(e.target.value) || 6))}
                                disabled={!chartRowLimitEnabled}
                                className={`w-12 h-6 px-1 text-xs text-center border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                  chartRowLimitEnabled
                                    ? 'border-gray-300 bg-white text-gray-700'
                                    : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                              />
                              <span className={`text-xs font-medium ${chartRowLimitEnabled ? 'text-gray-700' : 'text-gray-400'}`}>filas</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">Cantidad de registros a mostrar</p>
                          </div>
                        </>
                      ) : /* Progress Bar specific options */
                      vizType === 'progress' ? (
                        <>
                          {/* Font size slider */}
                          <div>
                            <label className="text-xs font-medium text-gray-700">Tamaño de fuente</label>
                            <p className="text-[10px] text-gray-400 mb-2">Tamaño del texto de los labels ({progressBarFontSize}px)</p>
                            <input
                              type="range"
                              min="10"
                              max="24"
                              value={progressBarFontSize}
                              onChange={(e) => setProgressBarFontSize(parseInt(e.target.value))}
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                              <span>10px</span>
                              <span>24px</span>
                            </div>
                          </div>

                          {/* Row limit option */}
                          <div>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={chartRowLimitEnabled}
                                  onChange={(e) => setChartRowLimitEnabled(e.target.checked)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs font-medium text-gray-700">Mostrar primeras</span>
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="1000"
                                value={chartRowLimit}
                                onChange={(e) => setChartRowLimit(Math.max(1, parseInt(e.target.value) || 6))}
                                disabled={!chartRowLimitEnabled}
                                className={`w-12 h-6 px-1 text-xs text-center border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                  chartRowLimitEnabled
                                    ? 'border-gray-300 bg-white text-gray-700'
                                    : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                              />
                              <span className={`text-xs font-medium ${chartRowLimitEnabled ? 'text-gray-700' : 'text-gray-400'}`}>filas</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">Cantidad de registros a mostrar en el gráfico</p>
                          </div>
                        </>
                      ) : vizType === 'single' ? (
                        <>
                          {/* Label text field */}
                          <div>
                            <label className="text-xs font-medium text-gray-700">Texto del label</label>
                            <p className="text-[10px] text-gray-400 mb-1">Deja vacío para usar el nombre de la métrica</p>
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={singleValueLabel}
                                onChange={(e) => setSingleValueLabel(e.target.value)}
                                placeholder="Nombre de la métrica"
                                className="flex-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                              />
                              <button
                                onClick={() => setSingleValueLabelBold(!singleValueLabelBold)}
                                className={`h-7 w-7 flex items-center justify-center rounded-md border transition-colors ${
                                  singleValueLabelBold
                                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                                    : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                                }`}
                                title="Negrita"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6V4zm0 8h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6v-8z" stroke="currentColor" strokeWidth="2" fill="none"/>
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Label position dropdown */}
                          <div>
                            <label className="text-xs font-medium text-gray-700">Posición del label</label>
                            <select
                              value={singleValueLabelPosition}
                              onChange={(e) => setSingleValueLabelPosition(e.target.value as 'above' | 'below')}
                              className="w-full mt-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                            >
                              <option value="above">Arriba del número</option>
                              <option value="below">Debajo del número</option>
                            </select>
                          </div>

                          {/* Text color option */}
                          <div>
                            <label className="text-xs font-medium text-gray-700">Color del número</label>
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="color"
                                value={singleValueColor}
                                onChange={(e) => setSingleValueColor(e.target.value)}
                                className="w-8 h-7 rounded cursor-pointer border border-gray-300"
                              />
                              <input
                                type="text"
                                value={singleValueColor}
                                onChange={(e) => setSingleValueColor(e.target.value)}
                                className="flex-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Treat nulls as zero switch */}
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-xs font-medium text-gray-700">Nulos como cero</label>
                              <p className="text-[10px] text-gray-400">Tratar valores nulos como 0 en el gráfico</p>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={treatNullsAsZero}
                              onClick={() => setTreatNullsAsZero(!treatNullsAsZero)}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                                treatNullsAsZero ? 'bg-blue-500' : 'bg-gray-200'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  treatNullsAsZero ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>

                          {/* Point style option */}
                          {(vizType === 'line' || vizType === 'area') && (
                            <div>
                              <label className="text-xs font-medium text-gray-700">Estilo de punto</label>
                              <p className="text-[10px] text-gray-400 mb-2">Apariencia de los puntos en la línea</p>
                              <div className="flex gap-1">
                                {[
                                  { value: 'filled', label: 'Lleno', icon: '●' },
                                  { value: 'outline', label: 'Contorno', icon: '○' },
                                  { value: 'none', label: 'Sin punto', icon: '—' },
                                ].map((option) => (
                                  <button
                                    key={option.value}
                                    onClick={() => setPointStyle(option.value as 'filled' | 'outline' | 'none')}
                                    className={`flex-1 px-2 py-1.5 text-xs rounded-md border transition-colors ${
                                      pointStyle === option.value
                                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    <span className="block text-sm">{option.icon}</span>
                                    <span className="block text-[10px] mt-0.5">{option.label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Area fill type option */}
                          {vizType === 'area' && (
                            <div>
                              <label className="text-xs font-medium text-gray-700">Tipo de relleno</label>
                              <p className="text-[10px] text-gray-400 mb-2">Estilo del relleno del área</p>
                              <div className="flex gap-1">
                                {[
                                  { value: 'solid', label: 'Sólido' },
                                  { value: 'gradient', label: 'Degradado' },
                                ].map((option) => (
                                  <button
                                    key={option.value}
                                    onClick={() => setAreaFillType(option.value as 'solid' | 'gradient')}
                                    className={`flex-1 px-3 py-1.5 text-xs rounded-md border transition-colors ${
                                      areaFillType === option.value
                                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Pie inner radius option */}
                          {vizType === 'pie' && (
                            <div>
                              <label className="text-xs font-medium text-gray-700">Radio interior</label>
                              <p className="text-[10px] text-gray-400 mb-2">Tamaño del círculo central (0 = sin hueco)</p>
                              <input
                                type="range"
                                min="0"
                                max="90"
                                value={pieInnerRadius}
                                onChange={(e) => setPieInnerRadius(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>
                          )}

                          {/* Row limit option */}
                          <div>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={chartRowLimitEnabled}
                                  onChange={(e) => setChartRowLimitEnabled(e.target.checked)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs font-medium text-gray-700">Mostrar primeras</span>
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="1000"
                                value={chartRowLimit}
                                onChange={(e) => setChartRowLimit(Math.max(1, parseInt(e.target.value) || 6))}
                                disabled={!chartRowLimitEnabled}
                                className={`w-12 h-6 px-1 text-xs text-center border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                  chartRowLimitEnabled
                                    ? 'border-gray-300 bg-white text-gray-700'
                                    : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                              />
                              <span className={`text-xs font-medium ${chartRowLimitEnabled ? 'text-gray-700' : 'text-gray-400'}`}>filas</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">Cantidad de registros a mostrar en el gráfico</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {vizOptionsTab === 'series' && (
                    <div className="space-y-2">
                      {vizType === 'table' ? (
                        // For table, show all columns (attributes and metrics)
                        [...selectedAttributes, ...selectedMetrics].length === 0 ? (
                          <div className="text-xs text-gray-400 text-center py-6">
                            No hay columnas seleccionadas
                          </div>
                        ) : (
                          [...selectedAttributes, ...selectedMetrics].map((field) => {
                            const isExpanded = expandedSeries === `table_${field.fieldId}`
                            const config = seriesConfig[field.fieldId] || {}
                            const isMetric = selectedMetrics.some(m => m.fieldId === field.fieldId)
                            const thresholds = config.thresholds || []

                            return (
                              <div key={field.fieldId} className="border border-gray-200 rounded-md overflow-hidden">
                                <button
                                  onClick={() => setExpandedSeries(isExpanded ? null : `table_${field.fieldId}`)}
                                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isMetric ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                      {isMetric ? 'M' : 'A'}
                                    </span>
                                    <span className="text-xs font-medium text-gray-700 truncate max-w-[140px]">{config.label || field.label}</span>
                                  </div>
                                  <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                                {isExpanded && (
                                  <div className="px-3 py-3 space-y-3 bg-white">
                                    {/* Label */}
                                    <div>
                                      <label className="text-[10px] font-medium text-gray-500 uppercase">Label</label>
                                      <input
                                        type="text"
                                        value={config.label || ''}
                                        placeholder={field.label}
                                        onChange={(e) => setSeriesConfig(prev => ({
                                          ...prev,
                                          [field.fieldId]: { ...prev[field.fieldId], label: e.target.value || undefined }
                                        }))}
                                        className="w-full mt-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                                      />
                                    </div>

                                    {/* Format (only for metrics/numbers) */}
                                    {isMetric && (
                                      <div>
                                        <label className="text-[10px] font-medium text-gray-500 uppercase">Formato</label>
                                        <select
                                          value={config.format || metricFormats[field.id] || 'number'}
                                          onChange={(e) => setSeriesConfig(prev => ({
                                            ...prev,
                                            [field.fieldId]: { ...prev[field.fieldId], format: e.target.value as MetricFormat }
                                          }))}
                                          className="w-full mt-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                                        >
                                          <option value="number">Número</option>
                                          <option value="currency">Moneda ($)</option>
                                          <option value="percent">Porcentaje (%)</option>
                                          <option value="compact">Compacto (1K, 1M)</option>
                                          <option value="decimal">Decimal (2 dec)</option>
                                        </select>
                                      </div>
                                    )}

                                    {/* Thresholds (only for metrics/numbers) */}
                                    {isMetric && (
                                      <div>
                                        <div className="flex items-center justify-between">
                                          <label className="text-[10px] font-medium text-gray-500 uppercase">Thresholds</label>
                                          <button
                                            onClick={() => {
                                              const newThreshold: ThresholdConfig = { min: null, max: null, color: '#10B981' }
                                              setSeriesConfig(prev => ({
                                                ...prev,
                                                [field.fieldId]: {
                                                  ...prev[field.fieldId],
                                                  thresholds: [...(prev[field.fieldId]?.thresholds || []), newThreshold]
                                                }
                                              }))
                                            }}
                                            className="text-[10px] text-blue-600 hover:text-blue-800"
                                          >
                                            + Agregar
                                          </button>
                                        </div>
                                        {thresholds.length === 0 ? (
                                          <p className="text-[10px] text-gray-400 mt-1">Sin thresholds configurados</p>
                                        ) : (
                                          <div className="mt-2 space-y-2">
                                            {thresholds.map((threshold, thIdx) => (
                                              <div key={thIdx} className="flex items-center gap-1 bg-gray-50 p-2 rounded">
                                                <input
                                                  type="color"
                                                  value={threshold.color}
                                                  onChange={(e) => {
                                                    const newThresholds = [...thresholds]
                                                    newThresholds[thIdx] = { ...threshold, color: e.target.value }
                                                    setSeriesConfig(prev => ({
                                                      ...prev,
                                                      [field.fieldId]: { ...prev[field.fieldId], thresholds: newThresholds }
                                                    }))
                                                  }}
                                                  className="w-6 h-6 rounded border border-gray-300 cursor-pointer"
                                                />
                                                <input
                                                  type="number"
                                                  value={threshold.min ?? ''}
                                                  placeholder="Min"
                                                  onChange={(e) => {
                                                    const newThresholds = [...thresholds]
                                                    newThresholds[thIdx] = { ...threshold, min: e.target.value ? Number(e.target.value) : null }
                                                    setSeriesConfig(prev => ({
                                                      ...prev,
                                                      [field.fieldId]: { ...prev[field.fieldId], thresholds: newThresholds }
                                                    }))
                                                  }}
                                                  className="w-16 h-6 px-1 text-[10px] border border-gray-300 rounded bg-white text-gray-700"
                                                />
                                                <span className="text-[10px] text-gray-400">-</span>
                                                <input
                                                  type="number"
                                                  value={threshold.max ?? ''}
                                                  placeholder="Max"
                                                  onChange={(e) => {
                                                    const newThresholds = [...thresholds]
                                                    newThresholds[thIdx] = { ...threshold, max: e.target.value ? Number(e.target.value) : null }
                                                    setSeriesConfig(prev => ({
                                                      ...prev,
                                                      [field.fieldId]: { ...prev[field.fieldId], thresholds: newThresholds }
                                                    }))
                                                  }}
                                                  className="w-16 h-6 px-1 text-[10px] border border-gray-300 rounded bg-white text-gray-700"
                                                />
                                                <button
                                                  onClick={() => {
                                                    const newThresholds = thresholds.filter((_, i) => i !== thIdx)
                                                    setSeriesConfig(prev => ({
                                                      ...prev,
                                                      [field.fieldId]: { ...prev[field.fieldId], thresholds: newThresholds }
                                                    }))
                                                  }}
                                                  className="p-1 text-gray-400 hover:text-red-500"
                                                >
                                                  <XMarkIcon className="h-3 w-3" />
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Alignment */}
                                    <div>
                                      <label className="text-[10px] font-medium text-gray-500 uppercase">Alineación</label>
                                      <div className="flex gap-1 mt-1">
                                        <button
                                          onClick={() => setSeriesConfig(prev => ({
                                            ...prev,
                                            [field.fieldId]: { ...prev[field.fieldId], align: 'left' }
                                          }))}
                                          className={`flex-1 h-7 flex items-center justify-center rounded border ${
                                            (config.align || 'left') === 'left'
                                              ? 'bg-blue-50 border-blue-300 text-blue-600'
                                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                          }`}
                                          title="Izquierda"
                                        >
                                          <Bars3BottomLeftIcon className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => setSeriesConfig(prev => ({
                                            ...prev,
                                            [field.fieldId]: { ...prev[field.fieldId], align: 'center' }
                                          }))}
                                          className={`flex-1 h-7 flex items-center justify-center rounded border ${
                                            config.align === 'center'
                                              ? 'bg-blue-50 border-blue-300 text-blue-600'
                                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                          }`}
                                          title="Centro"
                                        >
                                          <Bars3Icon className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => setSeriesConfig(prev => ({
                                            ...prev,
                                            [field.fieldId]: { ...prev[field.fieldId], align: 'right' }
                                          }))}
                                          className={`flex-1 h-7 flex items-center justify-center rounded border ${
                                            config.align === 'right'
                                              ? 'bg-blue-50 border-blue-300 text-blue-600'
                                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                          }`}
                                          title="Derecha"
                                        >
                                          <Bars3BottomRightIcon className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Font Size */}
                                    <div>
                                      <label className="text-[10px] font-medium text-gray-500 uppercase">Tamaño</label>
                                      <select
                                        value={config.fontSize || 'sm'}
                                        onChange={(e) => setSeriesConfig(prev => ({
                                          ...prev,
                                          [field.fieldId]: { ...prev[field.fieldId], fontSize: e.target.value as 'xs' | 'sm' | 'base' | 'lg' }
                                        }))}
                                        className="w-full mt-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                                      >
                                        <option value="xs">Extra pequeño</option>
                                        <option value="sm">Pequeño</option>
                                        <option value="base">Normal</option>
                                        <option value="lg">Grande</option>
                                      </select>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )
                      ) : vizType === 'pie' ? (
                        // For pie chart, show segments (attribute values) instead of metrics
                        chartData.length === 0 ? (
                          <div className="text-xs text-gray-400 text-center py-6">
                            Ejecuta la consulta para ver los segmentos
                          </div>
                        ) : (
                          chartData.map((row, idx) => {
                            const attrValue = row[selectedAttributes[0]?.fieldId] as string
                            const configKey = `pie_${attrValue}`
                            const isExpanded = expandedSeries === configKey
                            const config = seriesConfig[configKey] || {}
                            const defaultColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#EC4899']
                            const defaultColor = defaultColors[idx % defaultColors.length]

                            return (
                              <div key={configKey} className="border border-gray-200 rounded-md overflow-hidden">
                                <button
                                  onClick={() => setExpandedSeries(isExpanded ? null : configKey)}
                                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color || defaultColor }} />
                                    <span className="text-xs font-medium text-gray-700">{attrValue}</span>
                                  </div>
                                  <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                                {isExpanded && (
                                  <div className="px-3 py-3 space-y-3 bg-white">
                                    <div>
                                      <label className="text-[10px] font-medium text-gray-500 uppercase">Color</label>
                                      <div className="flex items-center gap-2 mt-1">
                                        <input
                                          type="color"
                                          value={config.color || defaultColor}
                                          onChange={(e) => setSeriesConfig(prev => ({
                                            ...prev,
                                            [configKey]: { ...prev[configKey], color: e.target.value }
                                          }))}
                                          className="w-8 h-7 rounded border border-gray-300 cursor-pointer"
                                        />
                                        <input
                                          type="text"
                                          value={config.color || defaultColor}
                                          onChange={(e) => setSeriesConfig(prev => ({
                                            ...prev,
                                            [configKey]: { ...prev[configKey], color: e.target.value }
                                          }))}
                                          className="flex-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 font-mono"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )
                      ) : selectedMetrics.length === 0 ? (
                        <div className="text-xs text-gray-400 text-center py-6">
                          No hay métricas seleccionadas
                        </div>
                      ) : (
                        selectedMetrics.map((metric, idx) => {
                          const isExpanded = expandedSeries === metric.fieldId
                          const config = seriesConfig[metric.fieldId] || {}
                          const defaultColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']
                          const defaultColor = defaultColors[idx % defaultColors.length]

                          return (
                            <div key={metric.id} className="border border-gray-200 rounded-md overflow-hidden">
                              <button
                                onClick={() => setExpandedSeries(isExpanded ? null : metric.fieldId)}
                                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color || defaultColor }} />
                                  <span className="text-xs font-medium text-gray-700">{config.label || metric.label}</span>
                                </div>
                                <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                              {isExpanded && (
                                <div className="px-3 py-3 space-y-3 bg-white">
                                  <div>
                                    <label className="text-[10px] font-medium text-gray-500 uppercase">Label</label>
                                    <input
                                      type="text"
                                      value={config.label || ''}
                                      placeholder={metric.label}
                                      onChange={(e) => setSeriesConfig(prev => ({
                                        ...prev,
                                        [metric.fieldId]: { ...prev[metric.fieldId], label: e.target.value || undefined }
                                      }))}
                                      className="w-full mt-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-medium text-gray-500 uppercase">Color</label>
                                    <div className="flex items-center gap-2 mt-1">
                                      <input
                                        type="color"
                                        value={config.color || defaultColor}
                                        onChange={(e) => setSeriesConfig(prev => ({
                                          ...prev,
                                          [metric.fieldId]: { ...prev[metric.fieldId], color: e.target.value }
                                        }))}
                                        className="w-8 h-7 rounded border border-gray-300 cursor-pointer"
                                      />
                                      <input
                                        type="text"
                                        value={config.color || defaultColor}
                                        onChange={(e) => setSeriesConfig(prev => ({
                                          ...prev,
                                          [metric.fieldId]: { ...prev[metric.fieldId], color: e.target.value }
                                        }))}
                                        className="flex-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 font-mono"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-medium text-gray-500 uppercase">Formato</label>
                                    <select
                                      value={config.format || metricFormats[metric.id] || 'number'}
                                      onChange={(e) => setSeriesConfig(prev => ({
                                        ...prev,
                                        [metric.fieldId]: { ...prev[metric.fieldId], format: e.target.value as MetricFormat }
                                      }))}
                                      className="w-full mt-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                                    >
                                      <option value="number">Número</option>
                                      <option value="currency">Moneda ($)</option>
                                      <option value="percent">Porcentaje (%)</option>
                                      <option value="compact">Compacto (1K, 1M)</option>
                                      <option value="decimal">Decimal (2 dec)</option>
                                    </select>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                  {vizOptionsTab === 'data' && (
                    <div className="space-y-4">
                      {/* Progress Bar specific data options */}
                      {vizType === 'progress' ? (
                        <>
                          {/* Show values switch */}
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-xs font-medium text-gray-700">Mostrar valores</label>
                              <p className="text-[10px] text-gray-400">Ver valores dentro de las barras</p>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={progressBarShowValues}
                              onClick={() => setProgressBarShowValues(!progressBarShowValues)}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                                progressBarShowValues ? 'bg-blue-500' : 'bg-gray-200'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  progressBarShowValues ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>

                          {/* Thresholds section */}
                          <div className="border-t border-gray-200 pt-3">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-xs font-medium text-gray-700">Umbrales de color</label>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={progressBarUseThresholds}
                                onClick={() => setProgressBarUseThresholds(!progressBarUseThresholds)}
                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                                  progressBarUseThresholds ? 'bg-blue-500' : 'bg-gray-200'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    progressBarUseThresholds ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>

                            {progressBarUseThresholds && (
                              <div className="space-y-2">
                                {progressBarThresholds.map((threshold, idx) => (
                                  <div key={idx} className="flex items-center gap-1 p-2 bg-gray-50 rounded-md">
                                    <input
                                      type="color"
                                      value={threshold.color}
                                      onChange={(e) => {
                                        const newThresholds = [...progressBarThresholds]
                                        newThresholds[idx].color = e.target.value
                                        setProgressBarThresholds(newThresholds)
                                      }}
                                      className="w-6 h-6 rounded cursor-pointer border border-gray-300"
                                    />
                                    <input
                                      type="number"
                                      placeholder="Mín"
                                      value={threshold.min ?? ''}
                                      onChange={(e) => {
                                        const newThresholds = [...progressBarThresholds]
                                        newThresholds[idx].min = e.target.value === '' ? null : parseFloat(e.target.value)
                                        setProgressBarThresholds(newThresholds)
                                      }}
                                      className="w-16 h-6 px-1 text-[10px] border border-gray-300 rounded bg-white text-gray-700"
                                    />
                                    <span className="text-[10px] text-gray-400">-</span>
                                    <input
                                      type="number"
                                      placeholder="Máx"
                                      value={threshold.max ?? ''}
                                      onChange={(e) => {
                                        const newThresholds = [...progressBarThresholds]
                                        newThresholds[idx].max = e.target.value === '' ? null : parseFloat(e.target.value)
                                        setProgressBarThresholds(newThresholds)
                                      }}
                                      className="w-16 h-6 px-1 text-[10px] border border-gray-300 rounded bg-white text-gray-700"
                                    />
                                    <button
                                      onClick={() => {
                                        setProgressBarThresholds(progressBarThresholds.filter((_, i) => i !== idx))
                                      }}
                                      className="p-1 text-gray-400 hover:text-red-500"
                                    >
                                      <XMarkIcon className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  onClick={() => {
                                    setProgressBarThresholds([...progressBarThresholds, { min: null, max: null, color: '#10B981' }])
                                  }}
                                  className="w-full py-1.5 text-[10px] text-blue-600 hover:text-blue-700 border border-dashed border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
                                >
                                  + Agregar umbral
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      ) : vizType === 'single' ? (
                        <>
                          {/* Number format dropdown */}
                          <div>
                            <label className="text-xs font-medium text-gray-700">Formato de número</label>
                            <select
                              value={singleValueFormat}
                              onChange={(e) => setSingleValueFormat(e.target.value as 'auto' | 'number' | 'compact' | 'percent' | 'currency')}
                              className="w-full mt-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                            >
                              <option value="auto">Automático</option>
                              <option value="number">Número</option>
                              <option value="compact">Compacto (K/M/B)</option>
                              <option value="percent">Porcentaje (%)</option>
                              <option value="currency">Moneda ($)</option>
                            </select>
                          </div>

                          {/* Decimal separator option */}
                          <div>
                            <label className="text-xs font-medium text-gray-700">Separador decimal</label>
                            <div className="flex gap-1 mt-1">
                              {[
                                { value: 'dot', label: 'Punto (.)' },
                                { value: 'comma', label: 'Coma (,)' },
                              ].map((option) => (
                                <button
                                  key={option.value}
                                  onClick={() => setSingleValueDecimalSeparator(option.value as 'dot' | 'comma')}
                                  className={`flex-1 px-3 py-1.5 text-xs rounded-md border transition-colors ${
                                    singleValueDecimalSeparator === option.value
                                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Decimal places option */}
                          <div>
                            <label className="text-xs font-medium text-gray-700">Cantidad de decimales</label>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={singleValueDecimalPlaces}
                              onChange={(e) => setSingleValueDecimalPlaces(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
                              className="w-full mt-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                            />
                          </div>

                          {/* Thresholds section */}
                          <div className="border-t border-gray-200 pt-3">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-xs font-medium text-gray-700">Umbrales de color</label>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={singleValueUseThresholds}
                                onClick={() => setSingleValueUseThresholds(!singleValueUseThresholds)}
                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                                  singleValueUseThresholds ? 'bg-blue-500' : 'bg-gray-200'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    singleValueUseThresholds ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>

                            {singleValueUseThresholds && (
                              <div className="space-y-2">
                                {singleValueThresholds.map((threshold, idx) => (
                                  <div key={idx} className="flex items-center gap-1 p-2 bg-gray-50 rounded-md">
                                    <input
                                      type="color"
                                      value={threshold.color}
                                      onChange={(e) => {
                                        const newThresholds = [...singleValueThresholds]
                                        newThresholds[idx].color = e.target.value
                                        setSingleValueThresholds(newThresholds)
                                      }}
                                      className="w-6 h-6 rounded cursor-pointer border border-gray-300"
                                    />
                                    <input
                                      type="number"
                                      placeholder="Mín"
                                      value={threshold.min ?? ''}
                                      onChange={(e) => {
                                        const newThresholds = [...singleValueThresholds]
                                        newThresholds[idx].min = e.target.value === '' ? null : parseFloat(e.target.value)
                                        setSingleValueThresholds(newThresholds)
                                      }}
                                      className="w-16 h-6 px-1 text-[10px] border border-gray-300 rounded bg-white text-gray-700"
                                    />
                                    <span className="text-[10px] text-gray-400">-</span>
                                    <input
                                      type="number"
                                      placeholder="Máx"
                                      value={threshold.max ?? ''}
                                      onChange={(e) => {
                                        const newThresholds = [...singleValueThresholds]
                                        newThresholds[idx].max = e.target.value === '' ? null : parseFloat(e.target.value)
                                        setSingleValueThresholds(newThresholds)
                                      }}
                                      className="w-16 h-6 px-1 text-[10px] border border-gray-300 rounded bg-white text-gray-700"
                                    />
                                    <button
                                      onClick={() => {
                                        setSingleValueThresholds(singleValueThresholds.filter((_, i) => i !== idx))
                                      }}
                                      className="p-1 text-gray-400 hover:text-red-500"
                                    >
                                      <XMarkIcon className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  onClick={() => {
                                    setSingleValueThresholds([...singleValueThresholds, { min: null, max: null, color: '#10B981' }])
                                  }}
                                  className="w-full py-1.5 text-[10px] text-blue-600 hover:text-blue-700 border border-dashed border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
                                >
                                  + Agregar umbral
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Show data labels switch */}
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-xs font-medium text-gray-700">Mostrar valores</label>
                              <p className="text-[10px] text-gray-400">Ver valores de las métricas en el gráfico</p>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={showDataLabels}
                              onClick={() => setShowDataLabels(!showDataLabels)}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                                showDataLabels ? 'bg-blue-500' : 'bg-gray-200'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  showDataLabels ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {vizOptionsTab === 'x' && (
                    <div className="space-y-4">
                      {/* Show X grid lines switch */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-medium text-gray-700">Líneas de cuadrícula</label>
                          <p className="text-[10px] text-gray-400">Mostrar líneas verticales en el gráfico</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={showXGridLines}
                          onClick={() => setShowXGridLines(!showXGridLines)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                            showXGridLines ? 'bg-blue-500' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              showXGridLines ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* X-Axis Format Type */}
                      <div>
                        <label className="text-xs font-medium text-gray-700">Formato de valores</label>
                        <p className="text-[10px] text-gray-400 mb-1">Tipo de formato para las etiquetas del eje X</p>
                        <select
                          value={xAxisFormatType}
                          onChange={(e) => setXAxisFormatType(e.target.value as XAxisFormatType)}
                          className="w-full h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                        >
                          {X_AXIS_FORMAT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Date Pattern (shown when format is date or datetime) */}
                      {(xAxisFormatType === 'date' || xAxisFormatType === 'datetime') && (
                        <div>
                          <label className="text-xs font-medium text-gray-700">Formato de fecha</label>
                          <select
                            value={xAxisDatePattern}
                            onChange={(e) => setXAxisDatePattern(e.target.value)}
                            className="w-full mt-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                          >
                            {X_AXIS_DATE_PATTERNS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label} ({opt.example})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Time Pattern (shown when format is time or datetime) */}
                      {(xAxisFormatType === 'time' || xAxisFormatType === 'datetime') && (
                        <div>
                          <label className="text-xs font-medium text-gray-700">Formato de hora</label>
                          <select
                            value={xAxisTimePattern}
                            onChange={(e) => setXAxisTimePattern(e.target.value)}
                            className="w-full mt-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                          >
                            {X_AXIS_TIME_PATTERNS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label} ({opt.example})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Reference Line X - only for line, column, area charts */}
                      {(vizType === 'line' || vizType === 'column' || vizType === 'area') && (
                        <>
                          <div className="border-t border-gray-200 pt-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <label className="text-xs font-medium text-gray-700">Línea de referencia</label>
                                <p className="text-[10px] text-gray-400">Línea vertical en un valor específico</p>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={referenceLineXEnabled}
                                onClick={() => setReferenceLineXEnabled(!referenceLineXEnabled)}
                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                                  referenceLineXEnabled ? 'bg-blue-500' : 'bg-gray-200'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    referenceLineXEnabled ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {referenceLineXEnabled && (
                            <div className="space-y-3 pl-2 border-l-2 border-purple-200">
                              {/* Reference line X value */}
                              <div>
                                <label className="text-xs font-medium text-gray-700">Valor</label>
                                <input
                                  type="text"
                                  value={referenceLineXValue}
                                  onChange={(e) => setReferenceLineXValue(e.target.value)}
                                  placeholder="Ej: 2025-01-01"
                                  className="w-full mt-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Debe coincidir con un valor del eje X</p>
                              </div>

                              {/* Reference line X color */}
                              <div>
                                <label className="text-xs font-medium text-gray-700">Color</label>
                                <div className="flex items-center gap-2 mt-1">
                                  <input
                                    type="color"
                                    value={referenceLineXColor}
                                    onChange={(e) => setReferenceLineXColor(e.target.value)}
                                    className="w-8 h-7 p-0 border border-gray-300 rounded cursor-pointer"
                                  />
                                  <input
                                    type="text"
                                    value={referenceLineXColor}
                                    onChange={(e) => setReferenceLineXColor(e.target.value)}
                                    className="flex-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {vizOptionsTab === 'y' && (
                    <div className="space-y-4">
                      {/* Y-Axis Format */}
                      <div>
                        <label className="text-xs font-medium text-gray-700">Formato de valores</label>
                        <select
                          value={yAxisFormatType}
                          onChange={(e) => setYAxisFormatType(e.target.value as YAxisFormatType)}
                          className="w-full mt-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                        >
                          {Y_AXIS_FORMAT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label} ({opt.example})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Show Y grid lines switch */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-medium text-gray-700">Líneas de cuadrícula</label>
                          <p className="text-[10px] text-gray-400">Mostrar líneas horizontales en el gráfico</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={showYGridLines}
                          onClick={() => setShowYGridLines(!showYGridLines)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                            showYGridLines ? 'bg-blue-500' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              showYGridLines ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Reference Line - only for line, column, area charts */}
                      {(vizType === 'line' || vizType === 'column' || vizType === 'area') && (
                        <>
                          <div className="border-t border-gray-200 pt-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <label className="text-xs font-medium text-gray-700">Línea de referencia</label>
                                <p className="text-[10px] text-gray-400">Línea horizontal en un valor específico</p>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={referenceLineYEnabled}
                                onClick={() => setReferenceLineYEnabled(!referenceLineYEnabled)}
                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                                  referenceLineYEnabled ? 'bg-blue-500' : 'bg-gray-200'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    referenceLineYEnabled ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {referenceLineYEnabled && (
                            <div className="space-y-3 pl-2 border-l-2 border-blue-200">
                              {/* Reference line value */}
                              <div>
                                <label className="text-xs font-medium text-gray-700">Valor</label>
                                <input
                                  type="number"
                                  value={referenceLineYValue}
                                  onChange={(e) => setReferenceLineYValue(e.target.value === '' ? '' : Number(e.target.value))}
                                  placeholder="Ej: 1000"
                                  className="w-full mt-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                                />
                              </div>

                              {/* Reference line color */}
                              <div>
                                <label className="text-xs font-medium text-gray-700">Color</label>
                                <div className="flex items-center gap-2 mt-1">
                                  <input
                                    type="color"
                                    value={referenceLineYColor}
                                    onChange={(e) => setReferenceLineYColor(e.target.value)}
                                    className="w-8 h-7 p-0 border border-gray-300 rounded cursor-pointer"
                                  />
                                  <input
                                    type="text"
                                    value={referenceLineYColor}
                                    onChange={(e) => setReferenceLineYColor(e.target.value)}
                                    className="flex-1 h-7 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {vizOptionsTab === 'format' && vizType === 'table' && (
                    <div className="space-y-4">
                      {/* Header background color */}
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">Fondo del encabezado</label>
                        <select
                          value={tableHeaderBg}
                          onChange={(e) => setTableHeaderBg(e.target.value as 'white' | 'gray' | 'black')}
                          className="w-full h-8 px-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="white">Blanco</option>
                          <option value="gray">Gris</option>
                          <option value="black">Negro</option>
                        </select>
                        <p className="text-[10px] text-gray-400 mt-1">Color de fondo de los títulos</p>
                      </div>

                      {/* Header text alignment */}
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">Alineación del encabezado</label>
                        <select
                          value={tableHeaderAlign}
                          onChange={(e) => setTableHeaderAlign(e.target.value as 'left' | 'center' | 'right')}
                          className="w-full h-8 px-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="left">Izquierda</option>
                          <option value="center">Centro</option>
                          <option value="right">Derecha</option>
                        </select>
                        <p className="text-[10px] text-gray-400 mt-1">Alineación del texto de los títulos</p>
                      </div>

                      {/* Font size */}
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">Tamaño de fuente</label>
                        <select
                          value={tableFontSize}
                          onChange={(e) => setTableFontSize(e.target.value as 'xs' | 'sm' | 'base' | 'lg')}
                          className="w-full h-8 px-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="xs">Extra pequeño (11px)</option>
                          <option value="sm">Pequeño (13px)</option>
                          <option value="base">Normal (15px)</option>
                          <option value="lg">Grande (17px)</option>
                        </select>
                        <p className="text-[10px] text-gray-400 mt-1">Tamaño de la fuente en toda la tabla</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      </div>

      {/* SQL Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowSqlModal(false)}
            />

            {/* Modal */}
            <div className="relative inline-block w-full max-w-4xl p-6 my-8 text-left align-middle bg-white rounded-lg shadow-xl transform transition-all">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CodeBracketIcon className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">SQL Query</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopySQL}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors flex items-center gap-1.5"
                  >
                    {sqlCopied ? (
                      <>
                        <CheckIcon className="h-4 w-4 text-green-600" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <ClipboardIcon className="h-4 w-4" />
                        Copiar
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowSqlModal(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* SQL Content */}
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-gray-100 font-mono whitespace-pre-wrap">
                  {executedSQL || generatedSQL}
                </pre>
              </div>

              {/* Info */}
              <div className="mt-4 flex items-start gap-2 text-xs text-gray-500">
                <svg className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p>Esta consulta agrupa automáticamente por las dimensiones seleccionadas y aplica agregaciones a las métricas.</p>
                  <p className="mt-1">Las dimensiones van en el GROUP BY, las métricas usan SUM/AVG/COUNT según su definición.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Viz Modal */}
      {showSaveVizModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowSaveVizModal(false)}
            />

            {/* Modal */}
            <div className="relative inline-block w-full max-w-md p-6 my-8 text-left align-middle bg-white rounded-lg shadow-xl transform transition-all">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BookmarkIcon className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Guardar Visualización</h3>
                </div>
                <button
                  onClick={() => setShowSaveVizModal(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Form */}
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={saveVizName}
                    onChange={(e) => setSaveVizName(e.target.value)}
                    placeholder="Ej: Ventas por mes"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm bg-white"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={saveVizDescription}
                    onChange={(e) => setSaveVizDescription(e.target.value)}
                    placeholder="Descripción opcional..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm bg-white"
                  />
                </div>

                {/* Folder Explorer */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Ubicación
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNewFolderInput(true)}
                      className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                      title="Nueva carpeta"
                    >
                      <FolderPlusIcon className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Folder tree */}
                  <div className="border border-gray-200 rounded-md bg-white h-64 overflow-y-auto">
                    {/* Root option */}
                    <div
                      onClick={() => !showNewFolderInput && setSaveVizFolderId(null)}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                        saveVizFolderId === null && !showNewFolderInput
                          ? 'bg-purple-50 text-purple-700'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <FolderIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">/ (Raíz)</span>
                    </div>

                    {/* New folder input at root level */}
                    {showNewFolderInput && saveVizFolderId === null && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50">
                        <FolderIcon className="h-4 w-4 text-blue-500" />
                        <input
                          type="text"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && newFolderName.trim()) {
                              e.preventDefault()
                              if (!currentTenant?.id || !currentUser?.uid) {
                                setSaveVizError('Error: No hay tenant o usuario activo')
                                return
                              }
                              try {
                                const folderId = await createFolder(currentTenant.id, currentUser.uid, {
                                  name: newFolderName.trim(),
                                  parentId: null
                                })
                                const updatedFolders = await listFolders(currentTenant.id)
                                setFolders(updatedFolders)
                                setSaveVizFolderId(folderId)
                                setExpandedFolders(prev => new Set(prev))
                                setNewFolderName('')
                                setShowNewFolderInput(false)
                              } catch (err) {
                                console.error('Error creating folder:', err)
                                setSaveVizError(`Error al crear carpeta: ${err instanceof Error ? err.message : 'Error desconocido'}`)
                              }
                            } else if (e.key === 'Escape') {
                              setNewFolderName('')
                              setShowNewFolderInput(false)
                            }
                          }}
                          onBlur={async () => {
                            if (newFolderName.trim() && currentTenant?.id && currentUser?.uid) {
                              try {
                                const folderId = await createFolder(currentTenant.id, currentUser.uid, {
                                  name: newFolderName.trim(),
                                  parentId: null
                                })
                                const updatedFolders = await listFolders(currentTenant.id)
                                setFolders(updatedFolders)
                                setSaveVizFolderId(folderId)
                              } catch (err) {
                                console.error('Error creating folder:', err)
                                setSaveVizError(`Error al crear carpeta: ${err instanceof Error ? err.message : 'Error desconocido'}`)
                              }
                            }
                            setNewFolderName('')
                            setShowNewFolderInput(false)
                          }}
                          placeholder="Nombre de carpeta"
                          className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                      </div>
                    )}

                    {/* Folders list */}
                    {folders.length === 0 && !showNewFolderInput ? (
                      <div className="px-3 py-2 text-sm text-gray-400 italic">
                        No hay carpetas creadas
                      </div>
                    ) : (
                      folders
                        .filter(f => f.parentId === null)
                        .map((folder) => {
                          const hasChildren = folders.some(f => f.parentId === folder.id)
                          const isExpanded = expandedFolders.has(folder.id)
                          return (
                            <div key={folder.id}>
                              <div
                                onClick={() => !showNewFolderInput && setSaveVizFolderId(folder.id)}
                                onDoubleClick={() => {
                                  if (hasChildren) {
                                    setExpandedFolders(prev => {
                                      const next = new Set(prev)
                                      if (next.has(folder.id)) {
                                        next.delete(folder.id)
                                      } else {
                                        next.add(folder.id)
                                      }
                                      return next
                                    })
                                  }
                                }}
                                className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                                  saveVizFolderId === folder.id && !showNewFolderInput
                                    ? 'bg-purple-50 text-purple-700'
                                    : 'hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                {hasChildren ? (
                                  <ChevronRightIcon className={`h-3 w-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                ) : (
                                  <span className="w-3" />
                                )}
                                <FolderIcon className={`h-4 w-4 ${saveVizFolderId === folder.id ? 'text-purple-500' : 'text-yellow-500'}`} />
                                <span className="text-sm">{folder.name}</span>
                              </div>

                              {/* New folder input inside this folder */}
                              {showNewFolderInput && saveVizFolderId === folder.id && (
                                <div className="flex items-center gap-2 pl-10 pr-3 py-1.5 bg-blue-50">
                                  <FolderIcon className="h-4 w-4 text-blue-500" />
                                  <input
                                    type="text"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    onKeyDown={async (e) => {
                                      if (e.key === 'Enter' && newFolderName.trim()) {
                                        if (!currentTenant?.id || !currentUser?.uid) return
                                        try {
                                          const folderId = await createFolder(currentTenant.id, currentUser.uid, {
                                            name: newFolderName.trim(),
                                            parentId: folder.id
                                          })
                                          const updatedFolders = await listFolders(currentTenant.id)
                                          setFolders(updatedFolders)
                                          setSaveVizFolderId(folderId)
                                          setExpandedFolders(prev => new Set(prev).add(folder.id))
                                          setNewFolderName('')
                                          setShowNewFolderInput(false)
                                        } catch (err) {
                                          console.error('Error creating folder:', err)
                                          setSaveVizError(`Error al crear carpeta: ${err instanceof Error ? err.message : 'Error desconocido'}`)
                                        }
                                      } else if (e.key === 'Escape') {
                                        setNewFolderName('')
                                        setShowNewFolderInput(false)
                                      }
                                    }}
                                    onBlur={async () => {
                                      if (newFolderName.trim() && currentTenant?.id && currentUser?.uid) {
                                        try {
                                          const folderId = await createFolder(currentTenant.id, currentUser.uid, {
                                            name: newFolderName.trim(),
                                            parentId: folder.id
                                          })
                                          const updatedFolders = await listFolders(currentTenant.id)
                                          setFolders(updatedFolders)
                                          setSaveVizFolderId(folderId)
                                          setExpandedFolders(prev => new Set(prev).add(folder.id))
                                        } catch (err) {
                                          console.error('Error creating folder:', err)
                                          setSaveVizError(`Error al crear carpeta: ${err instanceof Error ? err.message : 'Error desconocido'}`)
                                        }
                                      }
                                      setNewFolderName('')
                                      setShowNewFolderInput(false)
                                    }}
                                    placeholder="Nombre de carpeta"
                                    className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    autoFocus
                                  />
                                </div>
                              )}

                              {/* Nested folders (level 1) - only show if expanded */}
                              {isExpanded && folders
                                .filter(f => f.parentId === folder.id)
                                .map((subFolder) => {
                                  const subHasChildren = folders.some(f => f.parentId === subFolder.id)
                                  const subIsExpanded = expandedFolders.has(subFolder.id)
                                  return (
                                    <div key={subFolder.id}>
                                      <div
                                        onClick={() => !showNewFolderInput && setSaveVizFolderId(subFolder.id)}
                                        onDoubleClick={() => {
                                          if (subHasChildren) {
                                            setExpandedFolders(prev => {
                                              const next = new Set(prev)
                                              if (next.has(subFolder.id)) {
                                                next.delete(subFolder.id)
                                              } else {
                                                next.add(subFolder.id)
                                              }
                                              return next
                                            })
                                          }
                                        }}
                                        className={`flex items-center gap-2 pl-8 pr-3 py-2 cursor-pointer transition-colors ${
                                          saveVizFolderId === subFolder.id && !showNewFolderInput
                                            ? 'bg-purple-50 text-purple-700'
                                            : 'hover:bg-gray-50 text-gray-700'
                                        }`}
                                      >
                                        {subHasChildren ? (
                                          <ChevronRightIcon className={`h-3 w-3 text-gray-400 transition-transform ${subIsExpanded ? 'rotate-90' : ''}`} />
                                        ) : (
                                          <span className="w-3" />
                                        )}
                                        <FolderIcon className={`h-4 w-4 ${saveVizFolderId === subFolder.id ? 'text-purple-500' : 'text-yellow-500'}`} />
                                        <span className="text-sm">{subFolder.name}</span>
                                      </div>

                                      {/* New folder input inside subfolder */}
                                      {showNewFolderInput && saveVizFolderId === subFolder.id && (
                                        <div className="flex items-center gap-2 pl-16 pr-3 py-1.5 bg-blue-50">
                                          <FolderIcon className="h-4 w-4 text-blue-500" />
                                          <input
                                            type="text"
                                            value={newFolderName}
                                            onChange={(e) => setNewFolderName(e.target.value)}
                                            onKeyDown={async (e) => {
                                              if (e.key === 'Enter' && newFolderName.trim()) {
                                                if (!currentTenant?.id || !currentUser?.uid) return
                                                try {
                                                  const folderId = await createFolder(currentTenant.id, currentUser.uid, {
                                                    name: newFolderName.trim(),
                                                    parentId: subFolder.id
                                                  })
                                                  const updatedFolders = await listFolders(currentTenant.id)
                                                  setFolders(updatedFolders)
                                                  setSaveVizFolderId(folderId)
                                                  setExpandedFolders(prev => new Set(prev).add(subFolder.id))
                                                  setNewFolderName('')
                                                  setShowNewFolderInput(false)
                                                } catch (err) {
                                                  console.error('Error creating folder:', err)
                                                  setSaveVizError(`Error al crear carpeta: ${err instanceof Error ? err.message : 'Error desconocido'}`)
                                                }
                                              } else if (e.key === 'Escape') {
                                                setNewFolderName('')
                                                setShowNewFolderInput(false)
                                              }
                                            }}
                                            onBlur={async () => {
                                              if (newFolderName.trim() && currentTenant?.id && currentUser?.uid) {
                                                try {
                                                  const folderId = await createFolder(currentTenant.id, currentUser.uid, {
                                                    name: newFolderName.trim(),
                                                    parentId: subFolder.id
                                                  })
                                                  const updatedFolders = await listFolders(currentTenant.id)
                                                  setFolders(updatedFolders)
                                                  setSaveVizFolderId(folderId)
                                                  setExpandedFolders(prev => new Set(prev).add(subFolder.id))
                                                } catch (err) {
                                                  console.error('Error creating folder:', err)
                                                  setSaveVizError(`Error al crear carpeta: ${err instanceof Error ? err.message : 'Error desconocido'}`)
                                                }
                                              }
                                              setNewFolderName('')
                                              setShowNewFolderInput(false)
                                            }}
                                            placeholder="Nombre de carpeta"
                                            className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            autoFocus
                                          />
                                        </div>
                                      )}

                                      {/* Level 2 nested folders */}
                                      {subIsExpanded && folders
                                        .filter(f => f.parentId === subFolder.id)
                                        .map((level2Folder) => (
                                          <div key={level2Folder.id}>
                                            <div
                                              onClick={() => !showNewFolderInput && setSaveVizFolderId(level2Folder.id)}
                                              className={`flex items-center gap-2 pl-14 pr-3 py-2 cursor-pointer transition-colors ${
                                                saveVizFolderId === level2Folder.id && !showNewFolderInput
                                                  ? 'bg-purple-50 text-purple-700'
                                                  : 'hover:bg-gray-50 text-gray-700'
                                              }`}
                                            >
                                              <span className="w-3" />
                                              <FolderIcon className={`h-4 w-4 ${saveVizFolderId === level2Folder.id ? 'text-purple-500' : 'text-yellow-500'}`} />
                                              <span className="text-sm">{level2Folder.name}</span>
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  )
                                })}
                            </div>
                          )
                        })
                    )}
                  </div>
                </div>

                {/* Error message */}
                {saveVizError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                    {saveVizError}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSaveVizModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!saveVizName.trim()) {
                      setSaveVizError('El nombre es obligatorio')
                      return
                    }
                    if (!currentTenant?.id || !currentUser?.uid || !dataset || !vizType) {
                      setSaveVizError('Error: faltan datos necesarios')
                      return
                    }

                    setSavingViz(true)
                    setSaveVizError(null)

                    try {
                      // Build the VizConfig
                      const selectedAttrs: SelectedField[] = []
                      const selectedMets: SelectedField[] = []

                      for (const fullId of fieldSelectionOrder) {
                        const field = allFields.find(f => f.id === fullId)
                        if (field) {
                          const selectedField: SelectedField = {
                            fieldId: field.fieldId,
                            entityId: field.entityId,
                            label: field.label,
                            type: field.type,
                          }
                          if (field.fieldType === 'attribute') {
                            selectedAttrs.push(selectedField)
                          } else {
                            selectedMets.push(selectedField)
                          }
                        }
                      }

                      // Build chart settings based on vizType
                      let chartSettings: ChartSettings
                      switch (vizType) {
                        case 'line':
                          chartSettings = {
                            type: 'line',
                            settings: {
                              showGrid: showXGridLines || showYGridLines,
                              showDots: pointStyle !== 'none',
                              curved: true,
                              fillArea: areaFillType === 'gradient',
                            }
                          }
                          break
                        case 'column':
                          chartSettings = {
                            type: 'column',
                            settings: {
                              showGrid: showXGridLines || showYGridLines,
                              orientation: 'vertical',
                              stacked: false,
                            }
                          }
                          break
                        case 'area':
                          chartSettings = {
                            type: 'area',
                            settings: {
                              showGrid: showXGridLines || showYGridLines,
                              curved: true,
                              stacked: false,
                              opacity: 0.3,
                            }
                          }
                          break
                        case 'pie':
                          chartSettings = {
                            type: 'pie',
                            settings: {
                              showLabels: showDataLabels,
                              showLegend: true,
                              donut: pieInnerRadius > 0,
                              innerRadius: pieInnerRadius,
                            }
                          }
                          break
                        case 'single':
                          chartSettings = {
                            type: 'single',
                            settings: {
                              label: singleValueLabel,
                              labelPosition: singleValueLabelPosition,
                              color: singleValueColor,
                              labelBold: singleValueLabelBold,
                              format: singleValueFormat,
                              decimalSeparator: singleValueDecimalSeparator,
                              decimalPlaces: singleValueDecimalPlaces,
                              useThresholds: singleValueUseThresholds,
                              thresholds: singleValueThresholds as ThresholdConfig[],
                            }
                          }
                          break
                        case 'progress':
                          chartSettings = {
                            type: 'progress',
                            settings: {
                              fontSize: progressBarFontSize,
                              showValues: progressBarShowValues,
                              useThresholds: progressBarUseThresholds,
                              thresholds: progressBarThresholds as ThresholdConfig[],
                            }
                          }
                          break
                        case 'table':
                          chartSettings = {
                            type: 'table',
                            settings: {
                              showHeader: tableShowHeader,
                              striped: tableStriped,
                              compact: tableCompact,
                              sortable: tableSortable,
                              showRowNumbers: tableShowRowNumbers,
                            }
                          }
                          break
                        case 'scatter':
                          chartSettings = {
                            type: 'scatter',
                            settings: {
                              showGrid: showXGridLines || showYGridLines,
                              showLegend: true,
                              dotSize: 60,
                            }
                          }
                          break
                      }

                      const config: VizConfig = {
                        datasetId: dataset.id,
                        selectedAttributes: selectedAttrs,
                        selectedMetrics: selectedMets,
                        filters: filters,
                        orderBy: sortConfig,
                        rowLimit: rowLimit,
                        vizType: vizType as VizType,
                        chartSettings,
                        colorScheme: 'default',
                        chartRowLimit: chartRowLimit,
                        chartRowLimitEnabled: chartRowLimitEnabled,
                        xAxisFormat: {
                          type: xAxisFormatType,
                          dateFormat: xAxisDatePattern,
                          labelRotation: 0,
                        },
                      }

                      await createViz(currentTenant.id, currentUser.uid, {
                        name: saveVizName.trim(),
                        description: saveVizDescription.trim() || undefined,
                        folderId: saveVizFolderId,
                        config,
                      })

                      setShowSaveVizModal(false)
                    } catch (err) {
                      console.error('Error saving viz:', err)
                      setSaveVizError('Error al guardar la visualización')
                    } finally {
                      setSavingViz(false)
                    }
                  }}
                  disabled={savingViz || !saveVizName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingViz ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Exported Types
// ============================================================================

// Export types needed by consumers
export type { MetricFormat }
export type { FieldItem, DatasetWithMeta, EntityFields }

// Export type for dashboard widget visualization data
export interface DashboardVizData {
  datasetId: string
  datasetLabel: string
  vizType: VizType
  chartData: Record<string, unknown>[]
  selectedMetrics: { fieldId: string; label: string; entityId: string }[]
  selectedAttributes: { fieldId: string; label: string; entityId: string }[]
  seriesConfig: Record<string, { label?: string; color?: string; format?: string; align?: 'left' | 'center' | 'right'; fontSize?: 'xs' | 'sm' | 'base' | 'lg'; thresholds?: { min: number | null; max: number | null; color: string }[] }>
  chartSettings: {
    showDataLabels: boolean
    showXGridLines: boolean
    showYGridLines: boolean
    pointStyle?: string
    pieInnerRadius?: number
    yAxisFormatType?: YAxisFormatType
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
  filters?: MetricFilter[]
  // Order and limit settings
  orderBy?: { field: string; direction: 'ASC' | 'DESC' }[]
  rowLimit?: number
  // Chart display settings
  chartRowLimit?: number
  chartRowLimitEnabled?: boolean
  xAxisFormat?: {
    type: string
    dateFormat?: string
    labelRotation?: number
  }
  // Single value settings
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
  // Column totals for table
  columnTotals?: Record<string, number>
  // Visualization title for dashboard
  vizTitle?: string
}

// ============================================================================
// VizBuilder Component
// ============================================================================

export interface VizBuilderProps {
  // Required: Dataset and its entities
  dataset: DatasetWithMeta
  entities: Map<string, SemanticEntity>

  // Required for multi-tenant security: Tenant ID for filtering BigQuery data
  tenantId: string

  // Optional: Initial configuration to load
  initialConfig?: VizConfig

  // Optional: If true, shows dashboard integration features
  embedded?: boolean

  // Callback when viz data changes (for dashboard integration)
  onVizDataChange?: (vizData: DashboardVizData) => void

  // Optional: Show save viz controls
  showSaveControls?: boolean

  // Optional: Custom height class
  heightClass?: string

  // Optional: Visualization title (for dashboard integration)
  vizTitle?: string
  onVizTitleChange?: (title: string) => void

  // Optional: Hide dataset info (breadcrumb, title, description) in header
  hideDatasetInfo?: boolean

  // Optional: Callback to refresh entities data
  onRefresh?: () => void
  isRefreshing?: boolean
}

export default function VizBuilder({
  dataset,
  entities,
  tenantId: _tenantId,
  initialConfig,
  embedded = false,
  onVizDataChange,
  showSaveControls: _showSaveControls = false, // TODO: implement save controls
  heightClass = 'h-full',
  vizTitle,
  onVizTitleChange,
  hideDatasetInfo = false,
  onRefresh,
  isRefreshing = false,
}: VizBuilderProps) {
  // State for field selection
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set())
  const [fieldSelectionOrder, setFieldSelectionOrder] = useState<string[]>([])
  const [panelWidth, setPanelWidth] = useState(280)
  const [metricFormats, setMetricFormats] = useState<Record<string, MetricFormat>>({})
  const [pivotField, setPivotField] = useState<string | null>(null)
  const [filters, setFilters] = useState<MetricFilter[]>([])
  const [autoRunPending, setAutoRunPending] = useState(false)

  // Period comparison state (lifted from DataExplorerPanel for sharing with FieldsPanel)
  const [comparisonConfig, setComparisonConfig] = useState<ComparisonConfig>(DEFAULT_COMPARISON_CONFIG)

  // Create a Set of field IDs that have active filters (for showing filled filter icons)
  const activeFilterFields = useMemo(() => {
    const fields = new Set<string>()
    for (const filter of filters) {
      fields.add(filter.field)
    }
    return fields
  }, [filters])

  // Date operators that don't require a value (they are self-contained)
  const DATE_OPERATORS_NO_VALUE = [
    'today', 'yesterday',
    'last_7_days', 'last_14_days', 'last_30_days', 'last_60_days', 'last_90_days',
    'this_week', 'this_month', 'this_quarter', 'this_year',
    'last_week', 'last_month', 'last_quarter', 'last_year'
  ]

  // Check if there's a date filter available for comparison
  // This determines if the comparison variant options should be shown in the sidebar
  const hasDateFilterForComparison = useMemo(() => {
    return filters.some(f => {
      if (!f.field) return false
      // Check for relative date operators (self-contained, no value needed)
      if (DATE_OPERATORS_NO_VALUE.includes(f.operator as string)) return true
      // Check for 'between' operator with valid date range
      if (f.operator === 'between' && f.value) {
        const value = f.value
        if (Array.isArray(value) && value.length >= 2) return true
        if (typeof value === 'string' && value.includes(',')) return true
      }
      return false
    })
  }, [filters])

  // Clear variant fields when comparison is disabled or no date filter available
  // Using a ref to track if we've already cleared to avoid infinite loops
  const lastComparisonState = useRef<{ type: string; hasDateFilter: boolean }>({
    type: comparisonConfig.type,
    hasDateFilter: hasDateFilterForComparison
  })

  useEffect(() => {
    const shouldClearVariants = comparisonConfig.type === 'none' || !hasDateFilterForComparison
    const stateChanged =
      lastComparisonState.current.type !== comparisonConfig.type ||
      lastComparisonState.current.hasDateFilter !== hasDateFilterForComparison

    // Update ref
    lastComparisonState.current = {
      type: comparisonConfig.type,
      hasDateFilter: hasDateFilterForComparison
    }

    // Only clear if state changed AND we should clear
    if (shouldClearVariants && stateChanged) {
      // Find all variant field IDs (ending with _previous, _delta, _delta_pct)
      const variantSuffixes = ['_previous', '_delta', '_delta_pct']

      setSelectedFields(prev => {
        const variantFieldIds = Array.from(prev).filter(fieldId =>
          variantSuffixes.some(suffix => fieldId.endsWith(suffix))
        )
        if (variantFieldIds.length === 0) return prev

        const next = new Set(prev)
        for (const variantId of variantFieldIds) {
          next.delete(variantId)
        }
        return next
      })

      setFieldSelectionOrder(prev => {
        const hasVariants = prev.some(id =>
          variantSuffixes.some(suffix => id.endsWith(suffix))
        )
        if (!hasVariants) return prev
        return prev.filter(id => !variantSuffixes.some(suffix => id.endsWith(suffix)))
      })
    }
  }, [comparisonConfig.type, hasDateFilterForComparison])

  const [pendingVizApplied, setPendingVizApplied] = useState(false)

  // Handle format change for a metric
  const handleFormatChange = (fieldId: string, format: MetricFormat) => {
    setMetricFormats(prev => ({ ...prev, [fieldId]: format }))
  }

  // Build all fields list from entities
  const allFields = useMemo(() => {
    const fields: FieldItem[] = []
    const seenIds = new Set<string>()

    // Get fields from dataset.fields if specified
    const datasetFieldIds = dataset.fields || []

    const hasFieldsFilter = datasetFieldIds.length > 0

    // DEBUG: Log entities and their attributes
    console.log('🔍 [VizBuilder] Building fields from entities:', {
      entitiesCount: entities.size,
      entityIds: Array.from(entities.keys()),
      datasetFields: datasetFieldIds,
      hasFieldsFilter
    })
    entities.forEach((entity, entityId) => {
      console.log(`  📦 Entity "${entityId}":`, {
        label: entity.label,
        attributesCount: entity.attributes?.length || 0,
        metricsCount: entity.metrics?.length || 0,
        attributeIds: entity.attributes?.map(a => a.id) || []
      })
    })

    entities.forEach((entity, entityId) => {
      // Process attributes
      if (entity.attributes) {
        for (const attr of entity.attributes) {
          const fieldId = `${entityId}.${attr.id}`
          // Skip duplicates
          if (seenIds.has(fieldId)) continue
          // hidden: true has highest priority - always skip hidden fields
          if (attr.hidden === true) continue
          // If dataset has fields filter, only include if this field is in the list
          if (hasFieldsFilter && !datasetFieldIds.includes(attr.id) && !datasetFieldIds.includes(fieldId)) {
            continue
          }
          fields.push({
            id: fieldId,
            fieldId: attr.id,
            label: attr.label || attr.id,
            type: attr.type || 'string',
            fieldType: 'attribute',
            entityId,
            entityLabel: entity.label || entityId,
            group: attr.group || 'General',
            description: attr.description,
            sql: attr.sql,
          })
          seenIds.add(fieldId)
        }
      }

      // Process metrics
      if (entity.metrics) {
        for (const metric of entity.metrics) {
          const fieldId = `${entityId}.${metric.id}`
          // Skip duplicates
          if (seenIds.has(fieldId)) continue
          // hidden: true has highest priority - always skip hidden fields
          if (metric.hidden === true) continue
          // If dataset has fields filter, only include if this field is in the list
          if (hasFieldsFilter && !datasetFieldIds.includes(metric.id) && !datasetFieldIds.includes(fieldId)) {
            continue
          }
          fields.push({
            id: fieldId,
            fieldId: metric.id,
            label: metric.label || metric.id,
            type: 'number',
            fieldType: 'metric',
            entityId,
            entityLabel: entity.label || entityId,
            group: metric.group || 'General',
            description: metric.description,
            sql: metric.sql,
            sql_agg: metric.sql_agg,
          })
          seenIds.add(fieldId)
        }
      }
    })

    return fields
  }, [entities, dataset.fields])

  // Group fields by entity for display
  const entityFieldsList = useMemo(() => {
    const entityMap = new Map<string, EntityFields>()

    for (const field of allFields) {
      if (!entityMap.has(field.entityId)) {
        entityMap.set(field.entityId, {
          entityId: field.entityId,
          entityLabel: field.entityLabel,
          isBaseEntity: false,
          attributesByGroup: {},
          metricsByGroup: {},
          totalAttributes: 0,
          totalMetrics: 0,
        })
      }

      const entityFields = entityMap.get(field.entityId)!
      const targetGroup = field.fieldType === 'attribute' ? entityFields.attributesByGroup : entityFields.metricsByGroup

      if (!targetGroup[field.group]) {
        targetGroup[field.group] = []
      }
      targetGroup[field.group].push(field)

      // Update counts
      if (field.fieldType === 'attribute') {
        entityFields.totalAttributes++
      } else {
        entityFields.totalMetrics++
      }
    }

    return Array.from(entityMap.values())
  }, [allFields])

  const totalFields = allFields.length

  // Track last applied config to detect changes
  const lastAppliedConfigRef = useRef<string | null>(null)

  // Reset pendingVizApplied when initialConfig changes (for editing different visualizations)
  useEffect(() => {
    if (!initialConfig) return

    const configKey = JSON.stringify({
      datasetId: initialConfig.datasetId,
      selectedAttributes: initialConfig.selectedAttributes,
      selectedMetrics: initialConfig.selectedMetrics,
    })

    // If config changed, reset the flag to allow re-application
    if (lastAppliedConfigRef.current !== configKey) {
      setPendingVizApplied(false)
    }
  }, [initialConfig])

  // Apply initial config when provided (only fields and filters - viz settings handled by DataExplorerPanel)
  useEffect(() => {
    if (!initialConfig || pendingVizApplied) return

    // Build field IDs from selected attributes and metrics
    const fieldIds = [
      ...initialConfig.selectedAttributes.map(f => `${f.entityId}.${f.fieldId}`),
      ...initialConfig.selectedMetrics.map(f => `${f.entityId}.${f.fieldId}`)
    ]
    setSelectedFields(new Set(fieldIds))
    setFieldSelectionOrder(fieldIds)
    setFilters(initialConfig.filters || [])

    // Track this config as applied
    const configKey = JSON.stringify({
      datasetId: initialConfig.datasetId,
      selectedAttributes: initialConfig.selectedAttributes,
      selectedMetrics: initialConfig.selectedMetrics,
    })
    lastAppliedConfigRef.current = configKey

    setPendingVizApplied(true)
    setAutoRunPending(true)
  }, [initialConfig, pendingVizApplied])

  // Handle field toggle
  const handleToggleField = (field: FieldItem) => {
    setSelectedFields(prev => {
      const next = new Set(prev)
      if (next.has(field.id)) {
        next.delete(field.id)
        // Also remove from selection order
        setFieldSelectionOrder(order => order.filter(id => id !== field.id))
        // If this was the pivot field, clear it
        if (pivotField === field.id) {
          setPivotField(null)
        }
      } else {
        next.add(field.id)
        // Add to selection order
        setFieldSelectionOrder(order => [...order, field.id])
      }
      return next
    })
  }

  // Select all fields
  const handleSelectAll = () => {
    const allIds = allFields.map(f => f.id)
    setSelectedFields(new Set(allIds))
    setFieldSelectionOrder(allIds)
  }

  // Clear all selections
  const handleClearAll = () => {
    setSelectedFields(new Set())
    setFieldSelectionOrder([])
    setPivotField(null)
  }

  // Toggle a field in the filters section (add if not present, remove if present)
  const handleAddFilter = (field: FieldItem) => {
    const existingFilterIndex = filters.findIndex(f => f.field === field.fieldId)

    // If filter already exists, remove it (toggle behavior)
    if (existingFilterIndex !== -1) {
      setFilters(prev => prev.filter((_, i) => i !== existingFilterIndex))
      return
    }

    let defaultOperator: MetricFilter['operator'] = '='
    let defaultValue: MetricFilter['value'] = ''

    // Check if it's a date/timestamp field or a date transformation (date, week, month, quarter, year, raw, time, datetime)
    const dateTransformTypes = ['date', 'datetime', 'week', 'month', 'quarter', 'year', 'raw', 'time']
    const isDateType = isDateLikeType(field.type) || dateTransformTypes.includes(field.type || '')

    if (field.type === 'number' || field.fieldType === 'metric') {
      defaultOperator = '>='
      defaultValue = 0
    } else if (isDateType) {
      defaultOperator = 'last_30_days'
      defaultValue = ''
    } else if (field.type === 'boolean') {
      defaultOperator = '='
      defaultValue = true
    }

    setFilters(prev => [
      ...prev,
      {
        field: field.fieldId,
        operator: defaultOperator,
        value: defaultValue,
      },
    ])
  }

  return (
    <div className={`${heightClass} flex`}>
      {/* Left Panel - Fields */}
      <FieldsPanel
        entities={entityFieldsList}
        selectedFields={selectedFields}
        onToggleField={handleToggleField}
        onSelectAll={handleSelectAll}
        onClearAll={handleClearAll}
        totalFields={totalFields}
        width={panelWidth}
        onWidthChange={setPanelWidth}
        metricFormats={metricFormats}
        onFormatChange={handleFormatChange}
        pivotField={pivotField}
        onSetPivot={(fieldId) => {
          setPivotField(fieldId)
          if (fieldId && !selectedFields.has(fieldId)) {
            setSelectedFields(prev => new Set([...prev, fieldId]))
            setFieldSelectionOrder(prev => [...prev, fieldId])
          }
        }}
        onAddFilter={handleAddFilter}
        activeFilterFields={activeFilterFields}
        datasetGroup={dataset.group}
        datasetId={dataset.id}
        datasetLabel={dataset.label}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        datasetDescription={dataset.description}
        comparisonEnabled={comparisonConfig.enabled || hasDateFilterForComparison}
      />

      {/* Right Panel - Data Explorer */}
      <DataExplorerPanel
        dataset={dataset}
        entities={entities}
        selectedFields={selectedFields}
        fieldSelectionOrder={fieldSelectionOrder}
        allFields={allFields}
        metricFormats={metricFormats}
        pivotField={pivotField}
        filters={filters}
        onFiltersChange={setFilters}
        autoRunPending={autoRunPending}
        onAutoRunComplete={() => setAutoRunPending(false)}
        embedded={embedded}
        onAddToDashboard={onVizDataChange}
        vizTitle={vizTitle}
        onVizTitleChange={onVizTitleChange}
        initialConfig={initialConfig}
        hideDatasetInfo={hideDatasetInfo}
        comparisonConfig={comparisonConfig}
        setComparisonConfig={setComparisonConfig}
      />
    </div>
  )
}

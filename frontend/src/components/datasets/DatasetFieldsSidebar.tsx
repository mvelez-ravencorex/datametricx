/**
 * Barra lateral con dimensiones y métricas del dataset - Estilo Looker
 * Agrupación por categorías con desplegables
 */

import { useState, useMemo } from 'react'
import { DataColumn } from '@/types/dataset'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  CalendarIcon,
  TagIcon,
  HashtagIcon
} from '@heroicons/react/24/outline'

interface DatasetFieldsSidebarProps {
  title: string
  columns: DataColumn[]
  selectedColumns: string[]
  onFieldClick?: (column: DataColumn) => void
  onAddToFilters?: (column: DataColumn) => void
  onSelectAll?: (columnIds: string[]) => void
  onDeselectAll?: (columnIds: string[]) => void
}

// Definir grupos de campos
interface FieldGroup {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
  borderColor: string
}

const DIMENSION_GROUPS: FieldGroup[] = [
  { id: 'campaign', label: 'Campaign', icon: TagIcon, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-500' },
  { id: 'adset', label: 'Ad Set', icon: TagIcon, color: 'text-cyan-600', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-500' },
  { id: 'ad', label: 'Ad', icon: TagIcon, color: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-500' },
  { id: 'audience', label: 'Audience', icon: TagIcon, color: 'text-pink-600', bgColor: 'bg-pink-50', borderColor: 'border-pink-500' },
  { id: 'geo', label: 'Geography', icon: TagIcon, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-500' },
  { id: 'other', label: 'Other Dimensions', icon: TagIcon, color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-500' },
]

// Time group style (for dynamically created time groups)
const TIME_GROUP_STYLE: Omit<FieldGroup, 'id' | 'label'> = {
  icon: TagIcon,
  color: 'text-purple-600',
  bgColor: 'bg-purple-50',
  borderColor: 'border-purple-500'
}

const METRIC_GROUPS: FieldGroup[] = [
  { id: 'performance', label: 'Performance', icon: HashtagIcon, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-500' },
  { id: 'cost', label: 'Cost & Spend', icon: HashtagIcon, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-500' },
  { id: 'engagement', label: 'Engagement', icon: HashtagIcon, color: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-500' },
  { id: 'conversion', label: 'Conversions', icon: HashtagIcon, color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-500' },
  { id: 'calculated', label: 'Calculated Metrics', icon: HashtagIcon, color: 'text-violet-600', bgColor: 'bg-violet-50', borderColor: 'border-violet-500' },
]

// Función para categorizar dimensiones
function categorizeDimension(column: DataColumn): string {
  const name = column.name.toLowerCase()
  const displayName = column.displayName.toLowerCase()

  // Detectar campos de tiempo por patrón (nombre con timeframe en paréntesis)
  if (displayName.match(/\((raw|time|datetime|date|week|month|quarter|year|day_of_week|day_of_month|week_of_year|month_name)\)$/i)) return 'time'
  if (name.includes('date') || name.includes('time') || displayName.includes('date')) return 'time'
  // Buscar en nombre Y en displayName para mejor categorización
  if (name.includes('campaign') || displayName.includes('campaign')) return 'campaign'
  if (name.includes('adset') || name.includes('ad_set') || displayName.includes('ad set')) return 'adset'
  if (name.includes('ad_') || name === 'ad_id' || name === 'ad_name' || (displayName.includes('ad ') && !displayName.includes('ad set'))) return 'ad'
  if (name.includes('age') || name.includes('gender') || name.includes('audience')) return 'audience'
  if (name.includes('country') || name.includes('region') || name.includes('city') || name.includes('placement') || name.includes('platform') || name.includes('publisher')) return 'geo'
  return 'other'
}

// Extraer el nombre base de un campo de tiempo (ej: "Created (date)" -> "Created")
function getTimeFieldBaseName(displayName: string): string {
  const match = displayName.match(/^(.+?)\s*\((?:raw|time|datetime|date|week|month|quarter|year|day_of_week|day_of_month|week_of_year|month_name)\)$/i)
  return match ? match[1].trim() : displayName
}

// Extraer el timeframe de un campo de tiempo (ej: "Created (date)" -> "date")
function getTimeFieldTimeframe(displayName: string): string {
  const match = displayName.match(/\((\w+)\)$/)
  return match ? match[1] : 'raw'
}

// Agrupar campos de tiempo por nombre base
interface TimeFieldGroup {
  baseName: string
  fields: DataColumn[]
}

function groupTimeFields(columns: DataColumn[]): TimeFieldGroup[] {
  const groups: Record<string, DataColumn[]> = {}

  columns.forEach(col => {
    const baseName = getTimeFieldBaseName(col.displayName)
    if (!groups[baseName]) {
      groups[baseName] = []
    }
    groups[baseName].push(col)
  })

  // Ordenar los timeframes dentro de cada grupo
  const timeframeOrder = ['raw', 'time', 'datetime', 'date', 'week', 'month', 'quarter', 'year', 'day_of_week', 'day_of_month', 'week_of_year', 'month_name']

  return Object.entries(groups).map(([baseName, fields]) => ({
    baseName,
    fields: fields.sort((a, b) => {
      const aTimeframe = getTimeFieldTimeframe(a.displayName)
      const bTimeframe = getTimeFieldTimeframe(b.displayName)
      return timeframeOrder.indexOf(aTimeframe) - timeframeOrder.indexOf(bTimeframe)
    })
  }))
}

// Función para categorizar métricas
function categorizeMetric(column: DataColumn): string {
  const name = column.name.toLowerCase()

  if (name.includes('ctr') || name.includes('cpc') || name.includes('cpm') || name.includes('cpa') || name.includes('cpl') || name.includes('roas') || name.includes('roi') || name.includes('rate') || name.includes('profit')) return 'calculated'
  if (name.includes('spend') || name.includes('cost') || name.includes('budget')) return 'cost'
  if (name.includes('conversion') || name.includes('purchase') || name.includes('revenue')) return 'conversion'
  if (name.includes('engagement') || name.includes('like') || name.includes('comment') || name.includes('share') || name.includes('video') || name.includes('post_')) return 'engagement'
  return 'performance'
}

export default function DatasetFieldsSidebar({
  columns,
  selectedColumns,
  onFieldClick,
  onAddToFilters,
  onSelectAll,
  onDeselectAll
}: DatasetFieldsSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'in-use'>('all')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['dimensions', 'metrics', 'time', 'campaign', 'performance', 'cost'])
  )
  const [activeTooltip, setActiveTooltip] = useState<{ column: DataColumn; x: number; y: number } | null>(null)

  // Campos ocultos que no se deben mostrar
  const hiddenFields = ['tenant_id']

  // Separar dimensiones y métricas (excluyendo campos ocultos)
  const dimensions = columns.filter(col => col.isDimension && !hiddenFields.includes(col.name))
  const metrics = columns.filter(col => col.isMetric && !hiddenFields.includes(col.name))

  // Agrupar dimensiones por categoría (excluyendo time)
  const groupedDimensions = useMemo(() => {
    const groups: Record<string, DataColumn[]> = {}
    DIMENSION_GROUPS.forEach(g => groups[g.id] = [])

    dimensions.forEach(dim => {
      const category = categorizeDimension(dim)
      if (category === 'time') {
        // Time fields are handled separately
        return
      }
      if (groups[category]) {
        groups[category].push(dim)
      } else {
        groups['other'].push(dim)
      }
    })

    return groups
  }, [dimensions])

  // Agrupar campos de tiempo por nombre base (Created, Updated, etc.)
  const timeFieldGroups = useMemo(() => {
    const timeFields = dimensions.filter(dim => categorizeDimension(dim) === 'time')
    return groupTimeFields(timeFields)
  }, [dimensions])

  // Agrupar métricas por categoría
  const groupedMetrics = useMemo(() => {
    const groups: Record<string, DataColumn[]> = {}
    METRIC_GROUPS.forEach(g => groups[g.id] = [])

    metrics.forEach(metric => {
      const category = categorizeMetric(metric)
      if (groups[category]) {
        groups[category].push(metric)
      } else {
        groups['performance'].push(metric)
      }
    })

    return groups
  }, [metrics])

  // Filtrar por término de búsqueda
  const filterColumns = (cols: DataColumn[]) => {
    if (!searchTerm) return cols
    return cols.filter(col =>
      col.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      col.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  // Filtrar por tab activo
  const getDisplayColumns = (cols: DataColumn[]) => {
    const filtered = filterColumns(cols)
    if (activeTab === 'in-use') {
      return filtered.filter(col => selectedColumns.includes(col.id))
    }
    return filtered
  }

  const isSelected = (columnId: string) => selectedColumns.includes(columnId)

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const handleTooltipEnter = (event: React.MouseEvent<HTMLButtonElement>, column: DataColumn) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setActiveTooltip({
      column,
      x: rect.right + 8,
      y: rect.top + rect.height / 2
    })
  }

  const handleTooltipLeave = () => {
    setActiveTooltip(null)
  }

  // Columnas visibles (filtradas por búsqueda y tab)
  const visibleDimensions = getDisplayColumns(dimensions)
  const visibleMetrics = getDisplayColumns(metrics)
  const visibleColumnIds = [...visibleDimensions, ...visibleMetrics].map(col => col.id)
  const totalDisplayed = visibleDimensions.length + visibleMetrics.length

  // IDs de columnas visibles que están seleccionadas
  const selectedVisibleIds = visibleColumnIds.filter(id => selectedColumns.includes(id))

  // Renderizar un campo individual (dimensión no-tiempo)
  const renderField = (column: DataColumn, group: FieldGroup) => {
    const selected = isSelected(column.id)
    return (
      <div
        key={column.id}
        className={`group flex items-center pl-8 pr-4 py-1.5 hover:bg-gray-100 border-l-2 transition-colors cursor-pointer bg-white ${
          selected ? group.borderColor : 'border-transparent'
        }`}
      >
        <button
          onClick={() => onFieldClick?.(column)}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <TagIcon className={`h-3 w-3 flex-shrink-0 ${selected ? group.color : 'text-gray-400'}`} />
          <span className={`text-xs truncate ${selected ? `${group.color} font-medium` : 'text-gray-700'}`}>
            {column.displayName}
          </span>
        </button>

        <div className="flex items-center gap-1">
          <button
            onMouseEnter={(e) => handleTooltipEnter(e, column)}
            onMouseLeave={handleTooltipLeave}
            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded transition-opacity"
          >
            <InformationCircleIcon className="h-3 w-3 text-gray-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddToFilters?.(column)
            }}
            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded transition-opacity"
            title="Add filter"
          >
            <FunnelIcon className={`h-3 w-3 ${group.color}`} />
          </button>
        </div>
      </div>
    )
  }

  // Renderizar un campo de métrica
  const renderMetricField = (column: DataColumn, group: FieldGroup) => {
    const selected = isSelected(column.id)
    return (
      <div
        key={column.id}
        className={`group flex items-center pl-8 pr-4 py-1.5 hover:bg-gray-100 border-l-2 transition-colors cursor-pointer bg-white ${
          selected ? group.borderColor : 'border-transparent'
        }`}
      >
        <button
          onClick={() => onFieldClick?.(column)}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <HashtagIcon className={`h-3 w-3 flex-shrink-0 ${selected ? group.color : 'text-gray-400'}`} />
          <span className={`text-xs truncate ${selected ? `${group.color} font-medium` : 'text-gray-700'}`}>
            {column.displayName}
          </span>
        </button>

        <div className="flex items-center gap-1">
          <button
            onMouseEnter={(e) => handleTooltipEnter(e, column)}
            onMouseLeave={handleTooltipLeave}
            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded transition-opacity"
          >
            <InformationCircleIcon className="h-3 w-3 text-gray-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddToFilters?.(column)
            }}
            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded transition-opacity"
            title="Add filter"
          >
            <FunnelIcon className={`h-3 w-3 ${group.color}`} />
          </button>
        </div>
      </div>
    )
  }

  // Renderizar un campo de tiempo con solo el timeframe
  const renderTimeField = (column: DataColumn, group: FieldGroup) => {
    const selected = isSelected(column.id)
    const timeframe = getTimeFieldTimeframe(column.displayName)

    return (
      <div
        key={column.id}
        className={`group flex items-center pl-12 pr-4 py-1 hover:bg-gray-100 border-l-2 transition-colors cursor-pointer bg-white ${
          selected ? group.borderColor : 'border-transparent'
        }`}
      >
        <button
          onClick={() => onFieldClick?.(column)}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <CalendarIcon className={`h-3 w-3 flex-shrink-0 ${selected ? group.color : 'text-gray-400'}`} />
          <span className={`text-xs truncate ${selected ? `${group.color} font-medium` : 'text-gray-600'}`}>
            {timeframe}
          </span>
        </button>

        <div className="flex items-center gap-1">
          <button
            onMouseEnter={(e) => handleTooltipEnter(e, column)}
            onMouseLeave={handleTooltipLeave}
            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded transition-opacity"
          >
            <InformationCircleIcon className="h-3 w-3 text-gray-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddToFilters?.(column)
            }}
            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded transition-opacity"
            title="Add filter"
          >
            <FunnelIcon className={`h-3 w-3 ${group.color}`} />
          </button>
        </div>
      </div>
    )
  }

  // Renderizar un grupo de tiempo como grupo de nivel superior (ej: Created, Updated, etc.)
  const renderTimeFieldGroup = (timeGroup: TimeFieldGroup) => {
    const displayFields = getDisplayColumns(timeGroup.fields)
    if (displayFields.length === 0) return null

    const groupKey = `time-${timeGroup.baseName}`
    const isExpanded = expandedSections.has(groupKey)
    const Icon = TIME_GROUP_STYLE.icon

    return (
      <div key={timeGroup.baseName} className="border-b border-gray-100 last:border-b-0">
        <button
          onClick={() => toggleSection(groupKey)}
          className={`w-full px-4 py-2 flex items-center gap-2 ${TIME_GROUP_STYLE.bgColor} hover:opacity-80 transition-colors border-l-2 ${TIME_GROUP_STYLE.borderColor}`}
        >
          <Icon className={`h-4 w-4 ${TIME_GROUP_STYLE.color}`} />
          <span className={`text-xs font-medium ${TIME_GROUP_STYLE.color} flex-1 text-left`}>
            {timeGroup.baseName}
          </span>
          <span className="text-xs text-gray-400 mr-1">{displayFields.length}</span>
          {isExpanded ? (
            <ChevronDownIcon className="h-3 w-3 text-gray-400" />
          ) : (
            <ChevronRightIcon className="h-3 w-3 text-gray-400" />
          )}
        </button>

        {isExpanded && (
          <div className="bg-white">
            {displayFields.map(field => renderTimeField(field, { ...TIME_GROUP_STYLE, id: groupKey, label: timeGroup.baseName }))}
          </div>
        )}
      </div>
    )
  }

  // Renderizar un grupo de campos
  const renderFieldGroup = (group: FieldGroup, fields: DataColumn[], _parentSection: string, isMetricGroup: boolean = false) => {
    const displayFields = getDisplayColumns(fields)
    if (displayFields.length === 0) return null

    const isExpanded = expandedSections.has(group.id)
    const Icon = group.icon

    return (
      <div key={group.id} className="border-b border-gray-100 last:border-b-0">
        <button
          onClick={() => toggleSection(group.id)}
          className={`w-full px-4 py-2 flex items-center gap-2 ${group.bgColor} hover:opacity-80 transition-colors border-l-2 ${group.borderColor}`}
        >
          <Icon className={`h-4 w-4 ${group.color}`} />
          <span className={`text-xs font-medium ${group.color} flex-1 text-left`}>
            {group.label}
          </span>
          <span className="text-xs text-gray-400 mr-1">{displayFields.length}</span>
          {isExpanded ? (
            <ChevronDownIcon className="h-3 w-3 text-gray-400" />
          ) : (
            <ChevronRightIcon className="h-3 w-3 text-gray-400" />
          )}
        </button>

        {isExpanded && (
          <div className="bg-white">
            {displayFields.map(field => isMetricGroup ? renderMetricField(field, group) : renderField(field, group))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-80 bg-gray-50 border-r border-gray-300 h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-gray-300">
        {/* Search */}
        <div className="relative mb-3">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Find a Field"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-2 text-sm font-medium transition-colors ${
              activeTab === 'all'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All Fields
          </button>
          <button
            onClick={() => setActiveTab('in-use')}
            className={`pb-2 text-sm font-medium transition-colors ${
              activeTab === 'in-use'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            In Use
          </button>
        </div>

        {/* Select All / Deselect All links */}
        <div className="flex gap-2 mt-2 justify-end">
          <button
            onClick={() => onSelectAll?.(visibleColumnIds)}
            disabled={visibleColumnIds.length === 0 || visibleColumnIds.length === selectedVisibleIds.length}
            className="text-[10px] font-normal text-blue-500 hover:text-blue-700 hover:underline transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:no-underline"
          >
            Agregar todos
          </button>
          <span className="text-[10px] text-gray-300">|</span>
          <button
            onClick={() => onDeselectAll?.(visibleColumnIds)}
            disabled={selectedVisibleIds.length === 0}
            className="text-[10px] font-normal text-gray-400 hover:text-gray-600 hover:underline transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:no-underline"
          >
            Quitar todos
          </button>
        </div>
      </div>

      {/* Fields List */}
      <div className="flex-1 overflow-y-auto">
        {/* Dimensions Section */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => toggleSection('dimensions')}
            className="w-full px-4 py-2.5 flex items-center justify-between bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-sm font-semibold text-blue-900">Dimensions</span>
              <span className="text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                {getDisplayColumns(dimensions).length}
              </span>
            </div>
            {expandedSections.has('dimensions') ? (
              <ChevronDownIcon className="h-4 w-4 text-blue-600" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-blue-600" />
            )}
          </button>

          {expandedSections.has('dimensions') && (
            <div className="bg-white">
              {/* Time field groups (Created, Updated, etc.) */}
              {timeFieldGroups.map(tg => renderTimeFieldGroup(tg))}
              {/* Other dimension groups */}
              {DIMENSION_GROUPS.map(group =>
                renderFieldGroup(group, groupedDimensions[group.id] || [], 'dimensions')
              )}
            </div>
          )}
        </div>

        {/* Metrics Section */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => toggleSection('metrics')}
            className="w-full px-4 py-2.5 flex items-center justify-between bg-green-50 hover:bg-green-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm font-semibold text-green-900">Metrics</span>
              <span className="text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                {getDisplayColumns(metrics).length}
              </span>
            </div>
            {expandedSections.has('metrics') ? (
              <ChevronDownIcon className="h-4 w-4 text-green-600" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-green-600" />
            )}
          </button>

          {expandedSections.has('metrics') && (
            <div className="bg-white">
              {METRIC_GROUPS.map(group =>
                renderFieldGroup(group, groupedMetrics[group.id] || [], 'metrics', true)
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-white border-t border-gray-300">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>{columns.length} fields | {totalDisplayed} displayed</span>
        </div>
      </div>

      {/* Fixed Tooltip */}
      {activeTooltip && (
        <div
          className="fixed px-3 py-2 bg-white border border-gray-300 text-left text-xs rounded shadow-xl z-[9999] w-64 pointer-events-none"
          style={{
            left: `${activeTooltip.x}px`,
            top: `${activeTooltip.y}px`,
            transform: 'translateY(-50%)'
          }}
        >
          <div className="font-semibold mb-2 text-blue-600">{activeTooltip.column.displayName}</div>
          <div className="mb-1.5">
            <span className="font-semibold text-gray-700">DESCRIPTION:</span>
            <span className="text-gray-600 ml-1">{activeTooltip.column.description || 'No description'}</span>
          </div>
          <div className="mb-1.5">
            <span className="font-semibold text-gray-700">TYPE:</span>
            <span className="text-gray-600 ml-1">{activeTooltip.column.dataType}</span>
          </div>
          <div className="mb-1.5">
            <span className="font-semibold text-gray-700">FIELD:</span>
            <span className="text-gray-600 ml-1 font-mono">{activeTooltip.column.name}</span>
          </div>
          {activeTooltip.column.isMetric && activeTooltip.column.aggregation && (
            <div>
              <span className="font-semibold text-gray-700">AGGREGATION:</span>
              <span className="text-gray-600 ml-1">{activeTooltip.column.aggregation}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

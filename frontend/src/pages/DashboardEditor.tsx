import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  PhotoIcon,
  Bars3Icon,
  CursorArrowRaysIcon,
  ChartBarIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  TableCellsIcon,
  FunnelIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
  Bars3BottomLeftIcon,
  Bars3BottomRightIcon,
  FolderIcon,
  FolderPlusIcon,
  BookmarkIcon,
  PlayIcon,
  Cog6ToothIcon,
  DocumentArrowDownIcon,
  UserGroupIcon,
  InformationCircleIcon,
  CalendarDaysIcon,
  DocumentDuplicateIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'

// Grid configuration
const GRID_SIZE = 25 // 25px grid cells
const CANVAS_WIDTH = 1750 // Maximum canvas width in pixels
import { useAuth } from '@/contexts/AuthContext'
import DateRangePicker from '@/components/ui/DateRangePicker'
import { getModelsTree, getFileContent, executeQuery, getDistinctValues } from '@/services/semanticService'
import { toQueryComparisonConfig } from '@/types/comparison'
import {
  createDashboard,
  updateDashboard,
  getDashboard,
  getCoreDashboard,
  getDefaultDashboardConfig,
  listDashboardFolders,
  createDashboardFolder,
} from '@/services/dashboardService'
import type { SemanticDataset, SemanticEntity, FileTreeNode } from '@/types/semantic'
import type {
  DashboardConfig,
  DashboardElement,
  VisualizationElement,
  TextElement,
  ImageElement,
  MenuElement,
  ButtonElement,
  FilterElement,
  FolderListItem,
} from '@/types/viz'
import DatasetsNew, { type DashboardVizData, type YAxisFormatType } from '@/pages/DatasetsNew'
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
  ZAxis,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  ReferenceLine,
} from 'recharts'
import { nanoid } from 'nanoid'

type WidgetType = 'text' | 'image' | 'menu' | 'button' | 'visualization' | 'filter'

interface DatasetOption {
  id: string
  label: string
  path: string
  group: string
  subgroup: string
}

// Date transformation options - matches VizBuilder's DATE_TIMEFRAMES
// These are the granularity/transformation options for date fields
interface DateTransformOption {
  id: string  // Transformation type (raw, date, week, etc.)
  label: string
}

const DATE_TRANSFORM_OPTIONS: DateTransformOption[] = [
  { id: 'raw', label: 'raw' },
  { id: 'time', label: 'time' },
  { id: 'datetime', label: 'datetime' },
  { id: 'date', label: 'date' },
  { id: 'week', label: 'week' },
  { id: 'month', label: 'month' },
  { id: 'quarter', label: 'quarter' },
  { id: 'year', label: 'year' },
]

// X-Axis format type
type XAxisFormatType = 'auto' | 'text' | 'date' | 'time' | 'datetime'

// Month names for date formatting
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Format X-axis values (dates) to match VizBuilder
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
      .replace('MMM', monthShort)  // MMM must come before MM
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

// Format Y-axis values to match VizBuilder
function formatYAxisValue(value: number, formatType: YAxisFormatType = 'auto'): string {
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

export default function DashboardEditor() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { currentTenant, currentUser, isDemoMode, isSysOwner } = useAuth()
  const [showCreateDropdown, setShowCreateDropdown] = useState(false)
  const createDropdownRef = useRef<HTMLDivElement>(null)
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false)
  const settingsDropdownRef = useRef<HTMLDivElement>(null)

  // Dashboard state
  const [dashboardId, setDashboardId] = useState<string | null>(searchParams.get('id'))
  const [isCoreDashboard] = useState<boolean>(searchParams.get('isCore') === 'true')

  // Determine if editing is allowed:
  // - Core dashboards: only SysOwner can edit
  // - Tenant dashboards in demo mode: no one can edit
  // - Tenant dashboards NOT in demo mode: anyone can edit
  const canEdit = isCoreDashboard ? isSysOwner : !isDemoMode

  const [dashboardName, setDashboardName] = useState('Nuevo Dashboard')
  const [dashboardDescription, setDashboardDescription] = useState('')
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>(getDefaultDashboardConfig())
  const [folderId, setFolderId] = useState<string | null>(null)
  const [folders, setFolders] = useState<FolderListItem[]>([])
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([])

  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDescription, setSaveDescription] = useState('')
  const [saveFolderId, setSaveFolderId] = useState<string | null>(null)
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Save state
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(!!dashboardId)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)

  // Visualization modal state
  const [showVizModal, setShowVizModal] = useState(false)
  const [datasets, setDatasets] = useState<DatasetOption[]>([])
  const [selectedDataset, setSelectedDataset] = useState<string>('')
  const [loadingDatasets, setLoadingDatasets] = useState(false)
  const [loadingVizBuilder, setLoadingVizBuilder] = useState(false)
  const [showDatasetDropdown, setShowDatasetDropdown] = useState(false)
  const datasetDropdownRef = useRef<HTMLDivElement>(null)

  // Current viz data from embedded DatasetsNew
  const [currentVizData, setCurrentVizData] = useState<DashboardVizData | null>(null)

  // Element options menu state
  const [openOptionsMenu, setOpenOptionsMenu] = useState<string | null>(null)
  const optionsMenuRef = useRef<HTMLDivElement>(null)

  // Edit mode state
  const [editingElementId, setEditingElementId] = useState<string | null>(null)
  const [editingVizConfig, setEditingVizConfig] = useState<import('@/types/viz').VizConfig | undefined>(undefined)

  // Viz title for modal
  const [vizTitle, setVizTitle] = useState<string>('')

  // Canvas ref for coordinate calculations
  const canvasRef = useRef<HTMLDivElement>(null)

  // Drag and resize state
  const [draggingElement, setDraggingElement] = useState<string | null>(null)
  const [resizingElement, setResizingElement] = useState<{ id: string; handle: string } | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number; elementX: number; elementY: number } | null>(null)
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number; elementX: number; elementY: number } | null>(null)
  const [selectedElement, setSelectedElement] = useState<string | null>(null)

  // Title editing state
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [editingTitleValue, setEditingTitleValue] = useState('')

  // Filter modal state
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [filterModalTab, setFilterModalTab] = useState<'config' | 'apply'>('config')
  const [filterSelectedDataset, setFilterSelectedDataset] = useState<string>('')
  const [filterSelectedField, setFilterSelectedField] = useState<string>('')
  const [filterSelectedDatasetLabel, setFilterSelectedDatasetLabel] = useState<string>('')
  const [filterSelectedFieldLabel, setFilterSelectedFieldLabel] = useState<string>('')
  const [filterLabel, setFilterLabel] = useState('')
  const [filterType, setFilterType] = useState<'select' | 'multiselect' | 'date' | 'daterange' | 'text' | 'number'>('select')
  const [filterDisplayType, setFilterDisplayType] = useState<'dropdown' | 'button' | 'option'>('dropdown')
  const [filterDefaultValue, setFilterDefaultValue] = useState<unknown>(null) // Default value for the filter
  // Map of vizId -> fieldId for each visualization's filter field
  const [filterVizFieldMapping, setFilterVizFieldMapping] = useState<Map<string, string>>(new Map())
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [expandedFilterDatasets, setExpandedFilterDatasets] = useState<Set<string>>(new Set())
  const [filterDatasetAttributes, setFilterDatasetAttributes] = useState<Map<string, { fieldId: string; label: string; type: string }[]>>(new Map())
  const [expandedDateAttributes, setExpandedDateAttributes] = useState<Set<string>>(new Set()) // Track expanded date fields for timeframe options
  const [filterSelectedTimeframe, setFilterSelectedTimeframe] = useState<string | null>(null) // Selected timeframe for date filters
  const [loadingFilterAttributes, setLoadingFilterAttributes] = useState(false)
  const filterDropdownRef = useRef<HTMLDivElement>(null)
  // Track which viz dropdown is open in "Aplicar a" tab
  const [openVizFieldDropdown, setOpenVizFieldDropdown] = useState<string | null>(null)

  // Dashboard filter values state
  const [filterValues, setFilterValues] = useState<Map<string, string[]>>(new Map()) // filterId -> distinct values
  const [loadingFilterValues, setLoadingFilterValues] = useState<Set<string>>(new Set()) // Set of filterIds being loaded
  const [openDashboardFilter, setOpenDashboardFilter] = useState<string | null>(null) // Which filter dropdown is open
  const [customDateMode, setCustomDateMode] = useState<'day' | 'range' | null>(null) // Which custom date picker to show

  // Filter editing state
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null) // ID of filter being edited
  const [openFilterOptionsMenu, setOpenFilterOptionsMenu] = useState<string | null>(null) // Which filter's options menu is open

  // Toggle title visibility for visualization element
  const toggleElementTitle = (elementId: string) => {
    const element = dashboardConfig.elements.find(el => el.id === elementId)
    if (element?.type === 'visualization') {
      const vizElement = element as VisualizationElement
      updateElement(elementId, { showTitle: !vizElement.showTitle })
    }
    setOpenOptionsMenu(null)
  }

  // Set title alignment for visualization element
  const setTitleAlign = (elementId: string, align: 'left' | 'center' | 'right') => {
    const element = dashboardConfig.elements.find(el => el.id === elementId)
    if (element?.type === 'visualization') {
      updateElement(elementId, { titleAlign: align })
    }
    setOpenOptionsMenu(null)
  }

  // Start editing title
  const startEditingTitle = (elementId: string, currentTitle: string) => {
    setEditingTitleId(elementId)
    setEditingTitleValue(currentTitle)
  }

  // Save edited title
  const saveTitle = (elementId: string) => {
    if (editingTitleValue.trim()) {
      updateElement(elementId, { title: editingTitleValue.trim() })
    }
    setEditingTitleId(null)
    setEditingTitleValue('')
  }

  // Cancel title editing
  const cancelTitleEdit = () => {
    setEditingTitleId(null)
    setEditingTitleValue('')
  }

  // Snap to grid helper
  const snapToGrid = useCallback((value: number) => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE
  }, [])

  // Check if two elements overlap
  const checkCollision = useCallback((
    el1: { x: number; y: number; width: number; height: number },
    el2: { x: number; y: number; width: number; height: number }
  ): boolean => {
    return !(
      el1.x + el1.width <= el2.x ||
      el2.x + el2.width <= el1.x ||
      el1.y + el1.height <= el2.y ||
      el2.y + el2.height <= el1.y
    )
  }, [])

  // Displace overlapping elements when dragging
  const displaceOverlappingElements = useCallback((
    movingElementId: string,
    newPosition: { x: number; y: number; width: number; height: number },
    elements: DashboardElement[]
  ): DashboardElement[] => {
    const updatedElements = [...elements]
    const movingIndex = updatedElements.findIndex(el => el.id === movingElementId)
    if (movingIndex === -1) return updatedElements

    // Update the moving element position
    updatedElements[movingIndex] = {
      ...updatedElements[movingIndex],
      position: newPosition
    }

    // Find and displace overlapping elements
    let hasChanges = true
    let iterations = 0
    const maxIterations = 50 // Prevent infinite loops

    while (hasChanges && iterations < maxIterations) {
      hasChanges = false
      iterations++

      for (let i = 0; i < updatedElements.length; i++) {
        if (updatedElements[i].id === movingElementId) continue

        const currentElement = updatedElements[i]

        // Check collision with moving element
        if (checkCollision(newPosition, currentElement.position)) {
          // Calculate displacement direction based on relative positions
          const movingCenterY = newPosition.y + newPosition.height / 2
          const currentCenterY = currentElement.position.y + currentElement.position.height / 2

          // Determine push direction (primarily push down)
          let newY: number
          if (movingCenterY <= currentCenterY) {
            // Moving element is above or at same level, push current element down
            newY = snapToGrid(newPosition.y + newPosition.height)
          } else {
            // Moving element is below, push current element up
            newY = snapToGrid(newPosition.y - currentElement.position.height)
            if (newY < 0) newY = snapToGrid(newPosition.y + newPosition.height) // Can't go negative, push down instead
          }

          if (newY !== currentElement.position.y) {
            updatedElements[i] = {
              ...currentElement,
              position: { ...currentElement.position, y: newY }
            }
            hasChanges = true
          }
        }

        // Check collision with other elements (cascade effect)
        for (let j = 0; j < updatedElements.length; j++) {
          if (i === j || updatedElements[j].id === movingElementId) continue

          if (checkCollision(updatedElements[i].position, updatedElements[j].position)) {
            const el1 = updatedElements[i]
            const el2 = updatedElements[j]

            // Push the element that's lower down even more
            if (el1.position.y <= el2.position.y) {
              const newY = snapToGrid(el1.position.y + el1.position.height)
              if (newY !== el2.position.y) {
                updatedElements[j] = {
                  ...el2,
                  position: { ...el2.position, y: newY }
                }
                hasChanges = true
              }
            }
          }
        }
      }
    }

    return updatedElements
  }, [checkCollision, snapToGrid])

  // Handle mouse move for drag and resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return

      if (draggingElement && dragStart) {
        const deltaX = e.clientX - dragStart.x
        const deltaY = e.clientY - dragStart.y

        const movingElement = dashboardConfig.elements.find(el => el.id === draggingElement)
        if (!movingElement) return

        // Constrain X position to keep element within canvas bounds
        const maxX = CANVAS_WIDTH - movingElement.position.width
        const newX = snapToGrid(Math.max(0, Math.min(maxX, dragStart.elementX + deltaX)))
        const newY = snapToGrid(Math.max(0, dragStart.elementY + deltaY))

        const newPosition = {
          x: newX,
          y: newY,
          width: movingElement.position.width,
          height: movingElement.position.height
        }

        // Displace overlapping elements
        const updatedElements = displaceOverlappingElements(
          draggingElement,
          newPosition,
          dashboardConfig.elements
        )

        // Update all elements at once
        setDashboardConfig(prev => ({
          ...prev,
          elements: updatedElements
        }))
      }

      if (resizingElement && resizeStart) {
        const deltaX = e.clientX - resizeStart.x
        const deltaY = e.clientY - resizeStart.y
        const element = dashboardConfig.elements.find(el => el.id === resizingElement.id)
        if (!element) return

        let newWidth = resizeStart.width
        let newHeight = resizeStart.height
        let newX = resizeStart.elementX
        let newY = resizeStart.elementY

        const handle = resizingElement.handle

        // Handle resize based on which handle is being dragged
        if (handle.includes('e')) {
          // Limit width so element doesn't exceed canvas boundary
          const maxWidth = CANVAS_WIDTH - resizeStart.elementX
          newWidth = snapToGrid(Math.max(GRID_SIZE, Math.min(maxWidth, resizeStart.width + deltaX)))
        }
        if (handle.includes('w')) {
          const widthDelta = snapToGrid(deltaX)
          newWidth = Math.max(GRID_SIZE, resizeStart.width - widthDelta)
          newX = Math.max(0, resizeStart.elementX + (resizeStart.width - newWidth))
          // Recalculate width if X was constrained to 0
          if (newX === 0) {
            newWidth = resizeStart.elementX + resizeStart.width
          }
        }
        if (handle.includes('s')) {
          newHeight = snapToGrid(Math.max(GRID_SIZE, resizeStart.height + deltaY))
        }
        if (handle.includes('n')) {
          const heightDelta = snapToGrid(deltaY)
          newHeight = Math.max(GRID_SIZE, resizeStart.height - heightDelta)
          newY = Math.max(0, resizeStart.elementY + (resizeStart.height - newHeight))
          // Recalculate height if Y was constrained to 0
          if (newY === 0) {
            newHeight = resizeStart.elementY + resizeStart.height
          }
        }

        updateElement(resizingElement.id, {
          position: { x: newX, y: newY, width: newWidth, height: newHeight }
        })
      }
    }

    const handleMouseUp = () => {
      setDraggingElement(null)
      setResizingElement(null)
      setDragStart(null)
      setResizeStart(null)
    }

    if (draggingElement || resizingElement) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingElement, resizingElement, dragStart, resizeStart, dashboardConfig.elements, snapToGrid, displaceOverlappingElements])

  // Start dragging an element
  const handleDragStart = (e: React.MouseEvent, elementId: string) => {
    if (!isEditMode) return // Disable drag in view mode
    e.stopPropagation()
    const element = dashboardConfig.elements.find(el => el.id === elementId)
    if (!element) return

    setDraggingElement(elementId)
    setSelectedElement(elementId)
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      elementX: element.position.x,
      elementY: element.position.y,
    })
  }

  // Start resizing an element
  const handleResizeStart = (e: React.MouseEvent, elementId: string, handle: string) => {
    if (!isEditMode) return // Disable resize in view mode
    e.stopPropagation()
    e.preventDefault()
    const element = dashboardConfig.elements.find(el => el.id === elementId)
    if (!element) return

    setResizingElement({ id: elementId, handle })
    setSelectedElement(elementId)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: element.position.width,
      height: element.position.height,
      elementX: element.position.x,
      elementY: element.position.y,
    })
  }

  // Click on canvas deselects element
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('canvas-grid')) {
      setSelectedElement(null)
    }
  }

  // Load existing dashboard if editing
  useEffect(() => {
    // For core dashboards, we can load without a tenant
    // For tenant dashboards, we need the tenant ID
    if (dashboardId && (isCoreDashboard || currentTenant?.id)) {
      loadDashboard()
    }
  }, [dashboardId, currentTenant?.id, isCoreDashboard])

  // Auto-enable edit mode for new dashboards (but not in demo mode)
  useEffect(() => {
    if (!dashboardId && !isDemoMode) {
      setIsEditMode(true)
    }
  }, [dashboardId, isDemoMode])

  // Load folders
  useEffect(() => {
    if (currentTenant?.id) {
      loadFolders()
    }
  }, [currentTenant?.id])

  const loadDashboard = async () => {
    if (!dashboardId) return
    // For core dashboards, we don't need a tenant ID
    if (!isCoreDashboard && !currentTenant?.id) return

    setIsLoading(true)
    try {
      // Load from core_dashboards or tenant dashboards based on isCore flag
      const dashboard = isCoreDashboard
        ? await getCoreDashboard(dashboardId)
        : await getDashboard(currentTenant!.id, dashboardId)
      if (dashboard) {
        setDashboardName(dashboard.name)
        setDashboardDescription(dashboard.description || '')

        // Apply default values to filters that don't have a current value
        const configWithDefaults: DashboardConfig = {
          ...dashboard.config,
          elements: dashboard.config.elements.map(el => {
            if (el.type === 'filter') {
              const filter = el as FilterElement
              // If filter has defaultValue but no currentValue, apply the default
              if (filter.defaultValue !== undefined && filter.currentValue === undefined) {
                return { ...filter, currentValue: filter.defaultValue }
              }
            }
            return el
          })
        }

        setDashboardConfig(configWithDefaults)
        setFolderId(dashboard.folderId)

        // Auto-execute visualizations after loading
        executeVisualizationsFromConfig(configWithDefaults)
      }
    } catch (err) {
      console.error('Error loading dashboard:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Execute visualizations from a given config (used for auto-load and manual execute)
  const executeVisualizationsFromConfig = async (config: DashboardConfig) => {
    const vizElements = config.elements.filter(
      el => el.type === 'visualization'
    ) as (VisualizationElement & { _runtimeData?: DashboardVizData })[]

    if (vizElements.length === 0) return

    setIsExecuting(true)

    try {
      // Execute all viz queries in parallel
      const results = await Promise.all(
        vizElements.map(async (vizElement) => {
          const vizConfig = vizElement.embeddedConfig
          if (!vizConfig) return null

          try {
            // Debug: Log vizConfig to see what's stored
            console.log('📊 executeVisualizationsFromConfig - vizConfig:', {
              orderBy: vizConfig.orderBy,
              rowLimit: vizConfig.rowLimit,
              runtimeChartSettings: vizConfig.runtimeChartSettings,
              seriesConfig: vizConfig.seriesConfig,
              tableSettings: vizConfig.tableSettings,
            })

            // Build query request from viz config
            // If comparison is enabled, convert to backend format
            const queryComparison = vizConfig.comparisonConfig?.enabled && vizConfig.comparisonConfig?.dateFieldId
              ? toQueryComparisonConfig(vizConfig.comparisonConfig)
              : undefined

            const queryRequest = {
              dataset_id: vizConfig.datasetId,
              attributes: vizConfig.selectedAttributes.map(a => a.fieldId),
              metrics: vizConfig.selectedMetrics.map(m => m.fieldId),
              filters: vizConfig.filters,
              order_by: vizConfig.orderBy?.map(o => ({ field: o.field, direction: o.direction })),
              limit: vizConfig.rowLimit || 100,
              comparison: queryComparison, // Backend handles PoP with CTEs
            }

            console.log('📊 executeVisualizationsFromConfig - queryRequest:', queryRequest, 'tenantId:', currentTenant?.id)

            // Execute query - backend handles comparison if enabled
            const response = await executeQuery(queryRequest, currentTenant?.id)

            if (response.success && response.data) {
              // Use saved seriesConfig or build from customColors as fallback
              let seriesConfig: Record<string, { label?: string; color?: string }> = {}
              if (vizConfig.seriesConfig) {
                seriesConfig = vizConfig.seriesConfig
              } else if (vizConfig.customColors && vizConfig.customColors.length > 0) {
                vizConfig.selectedMetrics.forEach((metric, idx) => {
                  if (vizConfig.customColors && vizConfig.customColors[idx]) {
                    seriesConfig[metric.fieldId] = { color: vizConfig.customColors[idx] }
                  }
                })
              }

              // Use runtimeChartSettings directly if available (new format)
              // Otherwise fall back to extracting from chartSettings (legacy format)
              let chartSettings: DashboardVizData['chartSettings']

              if (vizConfig.runtimeChartSettings) {
                // New format - use directly
                chartSettings = {
                  showDataLabels: vizConfig.runtimeChartSettings.showDataLabels,
                  showXGridLines: vizConfig.runtimeChartSettings.showXGridLines,
                  showYGridLines: vizConfig.runtimeChartSettings.showYGridLines,
                  pointStyle: vizConfig.runtimeChartSettings.pointStyle,
                  pieInnerRadius: vizConfig.runtimeChartSettings.pieInnerRadius,
                  yAxisFormatType: vizConfig.runtimeChartSettings.yAxisFormatType as YAxisFormatType | undefined,
                  areaFillType: vizConfig.runtimeChartSettings.areaFillType,
                  treatNullsAsZero: vizConfig.runtimeChartSettings.treatNullsAsZero,
                  referenceLineY: vizConfig.runtimeChartSettings.referenceLineY,
                  referenceLineX: vizConfig.runtimeChartSettings.referenceLineX,
                }
              } else {
                // Legacy format - extract from chartSettings
                const savedChartSettings = vizConfig.chartSettings
                const chartType = savedChartSettings?.type
                const chartSettingsData = savedChartSettings?.settings

                let showDataLabels = false
                let showXGridLines = true
                let showYGridLines = true
                let pointStyle: string | undefined
                let pieInnerRadius: number | undefined
                let yAxisFormatType: YAxisFormatType | undefined
                let areaFillType: 'solid' | 'gradient' | undefined
                let treatNullsAsZero = true

                if (chartType === 'line' && chartSettingsData) {
                  const lineSettings = chartSettingsData as { showGrid?: boolean; showDots?: boolean }
                  showXGridLines = lineSettings.showGrid ?? true
                  showYGridLines = lineSettings.showGrid ?? true
                  pointStyle = lineSettings.showDots ? 'filled' : 'none'
                } else if (chartType === 'column' && chartSettingsData) {
                  const colSettings = chartSettingsData as { showGrid?: boolean }
                  showXGridLines = colSettings.showGrid ?? true
                  showYGridLines = colSettings.showGrid ?? true
                } else if (chartType === 'area' && chartSettingsData) {
                  const areaSettings = chartSettingsData as { showGrid?: boolean; opacity?: number }
                  showXGridLines = areaSettings.showGrid ?? true
                  showYGridLines = areaSettings.showGrid ?? true
                  areaFillType = areaSettings.opacity && areaSettings.opacity < 0.5 ? 'gradient' : 'solid'
                } else if (chartType === 'pie' && chartSettingsData) {
                  const pieSettings = chartSettingsData as { donut?: boolean; innerRadius?: number; showLabels?: boolean }
                  pieInnerRadius = pieSettings.donut ? (pieSettings.innerRadius || 60) : 0
                  showDataLabels = pieSettings.showLabels ?? false
                }

                chartSettings = {
                  showDataLabels,
                  showXGridLines,
                  showYGridLines,
                  pointStyle,
                  pieInnerRadius,
                  yAxisFormatType,
                  areaFillType,
                  treatNullsAsZero,
                }
              }

              // Use singleValueSettings directly if available (new format)
              // Otherwise fall back to extracting from chartSettings (legacy format)
              let singleValueSettings: DashboardVizData['singleValueSettings']

              if (vizConfig.singleValueSettings) {
                singleValueSettings = vizConfig.singleValueSettings
              } else if (vizConfig.chartSettings?.type === 'single' && vizConfig.chartSettings?.settings) {
                const singleSettings = vizConfig.chartSettings.settings as {
                  label?: string
                  labelPosition?: 'above' | 'below'
                  color?: string
                  labelBold?: boolean
                  format?: 'auto' | 'number' | 'compact' | 'percent' | 'currency'
                  decimalSeparator?: 'dot' | 'comma'
                  decimalPlaces?: number
                }
                singleValueSettings = {
                  label: singleSettings.label || '',
                  labelPosition: singleSettings.labelPosition || 'below',
                  color: singleSettings.color || '#3B82F6',
                  labelBold: singleSettings.labelBold ?? false,
                  format: singleSettings.format || 'auto',
                  decimalSeparator: singleSettings.decimalSeparator || 'dot',
                  decimalPlaces: singleSettings.decimalPlaces ?? 0
                }
              }

              // Build the runtime data structure
              const vizData: DashboardVizData = {
                datasetId: vizConfig.datasetId,
                datasetLabel: vizElement.title || 'Visualizacion',
                vizType: vizConfig.vizType,
                chartData: response.data,
                selectedMetrics: vizConfig.selectedMetrics.map(m => ({
                  fieldId: m.fieldId,
                  label: m.label || m.fieldId,
                  entityId: m.entityId
                })),
                selectedAttributes: vizConfig.selectedAttributes.map(a => ({
                  fieldId: a.fieldId,
                  label: a.label || a.fieldId,
                  entityId: a.entityId
                })),
                seriesConfig,
                chartSettings,
                filters: vizConfig.filters,
                orderBy: vizConfig.orderBy,
                rowLimit: vizConfig.rowLimit,
                chartRowLimit: vizConfig.chartRowLimit,
                xAxisFormat: vizConfig.xAxisFormat ? {
                  type: vizConfig.xAxisFormat.type,
                  dateFormat: vizConfig.xAxisFormat.dateFormat,
                  labelRotation: vizConfig.xAxisFormat.labelRotation,
                } : undefined,
                singleValueSettings,
                // Include table settings for table visualizations
                tableSettings: vizConfig.tableSettings,
                columnTotals: vizConfig.columnTotals,
                vizTitle: vizElement.title
              }

              return { elementId: vizElement.id, vizData }
            }
          } catch (err) {
            console.error(`Error executing viz ${vizElement.id}:`, err)
          }
          return null
        })
      )

      // Update all elements at once with their runtime data
      setDashboardConfig(prev => ({
        ...prev,
        elements: prev.elements.map(el => {
          const result = results.find(r => r?.elementId === el.id)
          if (result) {
            return { ...el, _runtimeData: result.vizData }
          }
          return el
        })
      }))
    } finally {
      setIsExecuting(false)
    }
  }

  const loadFolders = async () => {
    if (!currentTenant?.id) return
    try {
      const folderList = await listDashboardFolders(currentTenant.id)
      setFolders(folderList)
    } catch (err) {
      console.error('Error loading folders:', err)
    }
  }

  // Calculate folder path when folderId or folders change
  useEffect(() => {
    if (!folderId || folders.length === 0) {
      setFolderPath([])
      return
    }

    // Build path from folderId to root
    const path: { id: string; name: string }[] = []
    let currentFolderId: string | null = folderId

    while (currentFolderId) {
      const folder = folders.find(f => f.id === currentFolderId)
      if (folder) {
        path.unshift({ id: folder.id, name: folder.name })
        currentFolderId = folder.parentId || null
      } else {
        break
      }
    }

    setFolderPath(path)
  }, [folderId, folders])

  // Execute all visualizations in the dashboard (manual trigger)
  const handleExecuteAllViz = () => {
    executeVisualizationsFromConfig(dashboardConfig)
  }

  // Open save modal with current values
  const openSaveModal = async () => {
    setSaveName(dashboardName)
    setSaveDescription(dashboardDescription)
    setSaveFolderId(folderId)
    setSaveError(null)
    setShowSaveModal(true)
    // Reload folders when opening modal
    await loadFolders()
  }

  const handleSave = async () => {
    if (!currentTenant?.id || !currentUser?.uid) return
    setIsSaving(true)

    try {
      // Clean up runtime data before saving
      const configToSave: DashboardConfig = {
        ...dashboardConfig,
        elements: dashboardConfig.elements.map(element => {
          if (element.type === 'visualization') {
            // Remove _runtimeData from visualization elements
            const { _runtimeData, ...cleanElement } = element as VisualizationElement & { _runtimeData?: DashboardVizData }
            return cleanElement
          }
          return element
        })
      }

      // Use modal values
      const nameToSave = saveName.trim() || 'Nuevo Dashboard'
      const descriptionToSave = saveDescription.trim()

      if (dashboardId) {
        // Update existing
        await updateDashboard(currentTenant.id, dashboardId, currentUser.uid, {
          name: nameToSave,
          description: descriptionToSave,
          config: configToSave,
          folderId: saveFolderId,
        })
      } else {
        // Create new
        const newId = await createDashboard(currentTenant.id, currentUser.uid, {
          name: nameToSave,
          description: descriptionToSave,
          folderId: saveFolderId,
          config: configToSave,
        })
        setDashboardId(newId)
        // Update URL without reload
        window.history.replaceState({}, '', `/dashboard-editor?id=${newId}`)
      }

      // Update local state with saved values
      setDashboardName(nameToSave)
      setDashboardDescription(descriptionToSave)
      setFolderId(saveFolderId)

      setShowSaveModal(false)
      setSaveError(null)
    } catch (err) {
      console.error('Error saving dashboard:', err)
      setSaveError(`Error al guardar: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Quick save - saves without opening the modal (only for existing dashboards or uses current name)
  const handleQuickSave = async () => {
    console.log('📊 handleQuickSave called', { currentTenant: currentTenant?.id, currentUser: currentUser?.uid })

    // Clear previous states
    setSaveError(null)
    setSaveSuccess(false)

    if (!currentTenant?.id || !currentUser?.uid) {
      console.error('❌ handleQuickSave: Missing tenant or user')
      setSaveError('Error: Usuario no autenticado')
      return
    }
    setIsSaving(true)

    try {
      // Clean up runtime data before saving
      const configToSave: DashboardConfig = {
        ...dashboardConfig,
        elements: dashboardConfig.elements.map(element => {
          if (element.type === 'visualization') {
            const { _runtimeData, ...cleanElement } = element as VisualizationElement & { _runtimeData?: DashboardVizData }
            return cleanElement
          }
          return element
        })
      }

      // Debug: Log what we're saving
      console.log('📊 handleQuickSave - configToSave:', configToSave)
      const vizElements = configToSave.elements.filter(el => el.type === 'visualization') as VisualizationElement[]
      vizElements.forEach((viz, idx) => {
        console.log(`📊 Viz ${idx} embeddedConfig:`, {
          orderBy: viz.embeddedConfig?.orderBy,
          rowLimit: viz.embeddedConfig?.rowLimit,
          runtimeChartSettings: viz.embeddedConfig?.runtimeChartSettings,
        })
      })

      const nameToSave = dashboardName.trim() || 'Nuevo Dashboard'

      if (dashboardId) {
        // Update existing
        console.log('📊 Updating existing dashboard:', dashboardId)
        await updateDashboard(currentTenant.id, dashboardId, currentUser.uid, {
          name: nameToSave,
          description: dashboardDescription,
          config: configToSave,
          folderId: folderId,
        })
        console.log('✅ Dashboard updated successfully')
      } else {
        // Create new
        console.log('📊 Creating new dashboard')
        const newId = await createDashboard(currentTenant.id, currentUser.uid, {
          name: nameToSave,
          description: dashboardDescription,
          folderId: folderId,
          config: configToSave,
        })
        console.log('✅ Dashboard created:', newId)
        setDashboardId(newId)
        window.history.replaceState({}, '', `/dashboard-editor?id=${newId}`)
      }

      // Show success notification
      setSaveSuccess(true)
      // Auto-hide after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000)

      // Disable edit mode after successful save
      setIsEditMode(false)
    } catch (err) {
      console.error('❌ Error saving dashboard:', err)
      setSaveError(`Error al guardar: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Listen for viz data from embedded DatasetsNew
  useEffect(() => {
    const handleVizReady = (event: CustomEvent<DashboardVizData>) => {
      setCurrentVizData(event.detail)
    }

    window.addEventListener('dashboard-viz-ready', handleVizReady as EventListener)
    return () => {
      window.removeEventListener('dashboard-viz-ready', handleVizReady as EventListener)
    }
  }, [])

  // Load datasets when modal opens
  useEffect(() => {
    if (showVizModal && datasets.length === 0) {
      loadDatasets()
    }
  }, [showVizModal])

  // Reset current viz data when modal closes or dataset changes
  useEffect(() => {
    if (!showVizModal) {
      setCurrentVizData(null)
    }
  }, [showVizModal])

  useEffect(() => {
    setCurrentVizData(null)
  }, [selectedDataset])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (createDropdownRef.current && !createDropdownRef.current.contains(event.target as Node)) {
        setShowCreateDropdown(false)
      }
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(event.target as Node)) {
        setShowSettingsDropdown(false)
      }
      if (datasetDropdownRef.current && !datasetDropdownRef.current.contains(event.target as Node)) {
        setShowDatasetDropdown(false)
      }
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        setOpenOptionsMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadDatasets = async () => {
    if (!currentTenant?.id) return
    setLoadingDatasets(true)
    try {
      const treeResponse = await getModelsTree()
      const datasetFiles: { path: string; name: string }[] = []

      const findDatasetFiles = (nodes: FileTreeNode[]) => {
        for (const node of nodes) {
          if (node.type === 'file' && node.path.includes('datasets')) {
            datasetFiles.push({ path: node.path, name: node.name })
          }
          if (node.children) {
            findDatasetFiles(node.children)
          }
        }
      }
      findDatasetFiles(treeResponse.tree)

      const loadedDatasets: DatasetOption[] = []
      for (const file of datasetFiles) {
        try {
          const content = await getFileContent(file.path)
          const dataset = content.content as SemanticDataset & { group?: string; subgroup?: string }
          if (dataset.type === 'dataset') {
            // Extract group/subgroup from path or dataset properties
            // Path format: semantic/datasets/{group}/{subgroup}/file.yaml
            const pathParts = file.path.split('/')
            const datasetsIndex = pathParts.indexOf('datasets')
            let group = 'General'
            let subgroup = 'General'
            if (datasetsIndex >= 0) {
              // Check if there are subdirectories after 'datasets'
              if (pathParts.length > datasetsIndex + 2) {
                group = pathParts[datasetsIndex + 1]
                if (pathParts.length > datasetsIndex + 3) {
                  subgroup = pathParts[datasetsIndex + 2]
                }
              }
            }
            // Prefer dataset properties over path-derived values
            loadedDatasets.push({
              id: dataset.id,
              label: dataset.label,
              path: file.path,
              group: dataset.group || group,
              subgroup: dataset.subgroup || subgroup,
            })
          }
        } catch (err) {
          console.warn(`Error loading dataset ${file.path}:`, err)
        }
      }
      setDatasets(loadedDatasets)
    } catch (err) {
      console.error('Error loading datasets:', err)
    } finally {
      setLoadingDatasets(false)
    }
  }

  const handleCreateVisualization = () => {
    setShowCreateDropdown(false)
    // Reset editing state for new visualization
    setEditingElementId(null)
    setEditingVizConfig(undefined)
    setSelectedDataset('')
    setCurrentVizData(null)
    setVizTitle('')
    setShowVizModal(true)
  }

  // Helper to add element to config
  const addElement = (element: DashboardElement) => {
    setDashboardConfig(prev => ({
      ...prev,
      elements: [...prev.elements, element]
    }))
  }

  // Helper to remove element from config
  const removeElement = (elementId: string) => {
    setDashboardConfig(prev => ({
      ...prev,
      elements: prev.elements.filter(el => el.id !== elementId)
    }))
    setOpenOptionsMenu(null)
  }

  // Helper to duplicate element in config
  const duplicateElement = (elementId: string) => {
    const element = dashboardConfig.elements.find(el => el.id === elementId)
    if (!element) return

    // Create a deep copy with new ID and offset position
    const newElement = {
      ...JSON.parse(JSON.stringify(element)),
      id: `${element.type}_${Date.now()}`,
      position: {
        ...element.position,
        x: Math.min(element.position.x + GRID_SIZE * 2, CANVAS_WIDTH - element.position.width),
        y: element.position.y + GRID_SIZE * 2
      }
    }

    setDashboardConfig(prev => ({
      ...prev,
      elements: [...prev.elements, newElement]
    }))
    setOpenOptionsMenu(null)
  }

  // Helper to update element in config
  const updateElement = (elementId: string, updates: Partial<DashboardElement>) => {
    setDashboardConfig(prev => ({
      ...prev,
      elements: prev.elements.map(el =>
        el.id === elementId ? { ...el, ...updates } as DashboardElement : el
      )
    }))
  }

  // Get unique datasets used in the dashboard
  const getDashboardDatasets = useCallback(() => {
    const vizElements = dashboardConfig.elements.filter(
      el => el.type === 'visualization'
    ) as (VisualizationElement & { _runtimeData?: DashboardVizData })[]

    const datasetsMap = new Map<string, {
      id: string
      label: string
    }>()

    for (const viz of vizElements) {
      if (viz._runtimeData) {
        const { datasetId, datasetLabel } = viz._runtimeData
        if (!datasetsMap.has(datasetId)) {
          datasetsMap.set(datasetId, {
            id: datasetId,
            label: datasetLabel
          })
        }
      } else if (viz.embeddedConfig) {
        const { datasetId } = viz.embeddedConfig
        if (!datasetsMap.has(datasetId)) {
          datasetsMap.set(datasetId, {
            id: datasetId,
            label: datasetId
          })
        }
      }
    }

    return Array.from(datasetsMap.values())
  }, [dashboardConfig.elements])

  // Load attributes for a dataset from the semantic layer
  const loadDatasetAttributesFromApi = async (datasetId: string): Promise<{ fieldId: string; label: string; type: string }[]> => {
    try {
      // First get the models tree to find entity files
      const treeResponse = await getModelsTree()

      // Find dataset files
      const datasetFiles: { path: string; name: string }[] = []
      const entityFiles: { path: string; name: string }[] = []

      const findFiles = (nodes: FileTreeNode[]) => {
        for (const node of nodes) {
          if (node.type === 'file') {
            if (node.path.includes('datasets')) {
              datasetFiles.push({ path: node.path, name: node.name })
            } else if (node.path.includes('entities')) {
              entityFiles.push({ path: node.path, name: node.name })
            }
          }
          if (node.children) {
            findFiles(node.children)
          }
        }
      }
      findFiles(treeResponse.tree)

      // Find the dataset file
      let dataset: SemanticDataset | null = null
      for (const file of datasetFiles) {
        try {
          const content = await getFileContent(file.path)
          const d = content.content as SemanticDataset
          if (d.type === 'dataset' && d.id === datasetId) {
            dataset = d
            break
          }
        } catch (err) {
          console.warn(`Error loading dataset ${file.path}:`, err)
        }
      }

      if (!dataset) return []

      // Get entity IDs needed
      const neededEntities = [
        dataset.base_entity,
        ...(dataset.relationships?.map(r => r.entity) || [])
      ]

      // Load entities and get their attributes
      const attributes: { fieldId: string; label: string; type: string }[] = []

      for (const file of entityFiles) {
        try {
          const content = await getFileContent(file.path)
          const entity = content.content as SemanticEntity
          if (entity.type === 'entity' && neededEntities.includes(entity.id)) {
            // Add attributes from this entity
            for (const attr of entity.attributes || []) {
              const baseAttr = {
                fieldId: attr.id,
                label: attr.label || attr.id,
                type: attr.type || 'string'
              }
              attributes.push(baseAttr)

              // For date fields, add all transformation variants as independent attributes
              if (attr.type === 'date') {
                for (const transform of DATE_TRANSFORM_OPTIONS) {
                  attributes.push({
                    fieldId: `${attr.id}_${transform.id}`,
                    label: `${attr.label || attr.id} (${transform.label})`,
                    type: 'date_transform'
                  })
                }
              }
            }
          }
        } catch (err) {
          console.warn(`Error loading entity ${file.path}:`, err)
        }
      }

      return attributes
    } catch (error) {
      console.error('Error loading dataset attributes:', error)
      return []
    }
  }

  // Load/populate attributes for a dataset
  const loadDatasetAttributes = async (datasetId: string) => {
    if (filterDatasetAttributes.has(datasetId)) return

    const attributes = await loadDatasetAttributesFromApi(datasetId)
    if (attributes.length > 0) {
      setFilterDatasetAttributes(prev => {
        const next = new Map(prev)
        next.set(datasetId, attributes)
        return next
      })
    }
  }

  // Get filters from dashboard config
  const dashboardFilters = dashboardConfig.elements.filter(
    el => el.type === 'filter'
  ) as FilterElement[]

  // Get all visualizations in the dashboard
  const getAllVisualizations = useCallback(() => {
    return dashboardConfig.elements.filter(el => el.type === 'visualization') as (VisualizationElement & { _runtimeData?: DashboardVizData })[]
  }, [dashboardConfig.elements])

  // Get the dataset ID for a visualization
  const getVizDatasetId = useCallback((viz: VisualizationElement & { _runtimeData?: DashboardVizData }) => {
    if (viz._runtimeData) return viz._runtimeData.datasetId
    if (viz.embeddedConfig) return viz.embeddedConfig.datasetId
    return null
  }, [])

  // Open filter modal (for new filter)
  const openFilterModal = async () => {
    setEditingFilterId(null) // Not editing, creating new
    setFilterSelectedDataset('')
    setFilterSelectedField('')
    setFilterSelectedDatasetLabel('')
    setFilterSelectedFieldLabel('')
    setFilterLabel('')
    setFilterType('select')
    setFilterDisplayType('dropdown')
    setFilterDefaultValue(null)
    setFilterVizFieldMapping(new Map())
    setFilterModalTab('config')
    setShowFilterDropdown(false)
    setExpandedFilterDatasets(new Set())
    setExpandedDateAttributes(new Set())
    setFilterSelectedTimeframe(null)
    setShowFilterModal(true)
    setLoadingFilterAttributes(true)

    // Load attributes for all datasets
    const dashboardDatasets = getDashboardDatasets()
    try {
      await Promise.all(dashboardDatasets.map(d => loadDatasetAttributes(d.id)))
    } finally {
      setLoadingFilterAttributes(false)
    }
  }

  // Open filter modal for editing existing filter
  const openFilterModalForEdit = async (filter: FilterElement) => {
    setEditingFilterId(filter.id)
    setFilterSelectedDataset(filter.datasetId)
    setFilterSelectedField(filter.fieldId)
    setFilterSelectedDatasetLabel('') // Will be filled from attributes
    setFilterSelectedFieldLabel(filter.fieldLabel || filter.fieldId)
    setFilterLabel(filter.label)
    setFilterType(filter.filterType)
    setFilterDisplayType(filter.displayType || 'dropdown')
    setFilterDefaultValue(filter.defaultValue ?? null)
    setFilterSelectedTimeframe(filter.timeframe || null)
    setFilterModalTab('config')
    setShowFilterDropdown(false)
    setExpandedFilterDatasets(new Set([filter.datasetId])) // Expand the filter's dataset
    setExpandedDateAttributes(new Set())
    setOpenFilterOptionsMenu(null) // Close options menu
    setShowFilterModal(true)
    setLoadingFilterAttributes(true)

    // Load attributes for all datasets
    const dashboardDatasets = getDashboardDatasets()
    try {
      await Promise.all(dashboardDatasets.map(d => loadDatasetAttributes(d.id)))

      // Set dataset label from loaded attributes
      const dataset = dashboardDatasets.find(d => d.id === filter.datasetId)
      if (dataset) {
        setFilterSelectedDatasetLabel(dataset.label || dataset.id)
      }
    } finally {
      setLoadingFilterAttributes(false)
    }

    // Build viz field mapping from affectsElements
    if (filter.affectsElements && filter.affectsElements.length > 0) {
      const mapping = new Map<string, string>()
      const allVizs = getAllVisualizations()
      for (const viz of allVizs) {
        if (filter.affectsElements.includes(viz.id)) {
          // If affected, map to the filter's field
          mapping.set(viz.id, filter.fieldId)
        } else {
          // Explicitly not affected
          mapping.set(viz.id, '')
        }
      }
      setFilterVizFieldMapping(mapping)
    } else {
      setFilterVizFieldMapping(new Map())
    }
  }

  // Select field for filter
  const selectFilterField = (datasetId: string, datasetLabel: string, fieldId: string, fieldLabel: string, fieldType?: string) => {
    setFilterSelectedDataset(datasetId)
    setFilterSelectedDatasetLabel(datasetLabel)
    setFilterSelectedField(fieldId)
    setFilterSelectedFieldLabel(fieldLabel)
    setFilterLabel(fieldLabel) // Default label to field label
    setFilterSelectedTimeframe(null) // Reset timeframe
    // Set filter type based on field type
    if (fieldType === 'date') {
      setFilterType('daterange')
    } else {
      setFilterType('select')
    }
    setShowFilterDropdown(false)
  }

  // Select a timeframe option for a date field
  const selectDateTransform = (datasetId: string, datasetLabel: string, fieldId: string, fieldLabel: string, transform: DateTransformOption) => {
    setFilterSelectedDataset(datasetId)
    setFilterSelectedDatasetLabel(datasetLabel)
    // Store the field ID with transform suffix (e.g., "fecha_date", "fecha_month")
    setFilterSelectedField(`${fieldId}_${transform.id}`)
    setFilterSelectedFieldLabel(`${fieldLabel} (${transform.label})`)
    setFilterLabel(`${fieldLabel} (${transform.label})`) // Use field + transform as filter label
    setFilterSelectedTimeframe(transform.id)
    setFilterType('daterange')
    setShowFilterDropdown(false)
  }

  // Add filter to dashboard
  const addFilter = () => {
    if (!filterSelectedDataset || !filterSelectedField) return

    // Get affected elements - include both explicitly mapped and auto-selected viz
    const allVizs = getAllVisualizations()
    const affectedVizIds: string[] = []

    for (const viz of allVizs) {
      const vizDatasetId = getVizDatasetId(viz)
      const attributes = vizDatasetId ? filterDatasetAttributes.get(vizDatasetId) || [] : []
      const currentMapping = filterVizFieldMapping.get(viz.id)

      // Check if explicitly mapped
      if (currentMapping !== undefined) {
        // User explicitly set a value - only include if not empty
        if (currentMapping) {
          affectedVizIds.push(viz.id)
        }
      } else {
        // Check for auto-selection (same dataset and field exists)
        const isSameDataset = vizDatasetId === filterSelectedDataset
        const hasMatchingField = isSameDataset && attributes.some(a => a.fieldId === filterSelectedField)
        if (hasMatchingField) {
          affectedVizIds.push(viz.id)
        }
      }
    }

    const newFilter: FilterElement = {
      type: 'filter',
      id: nanoid(10),
      position: { x: 0, y: 0, width: 200, height: 40 },
      label: filterLabel || filterSelectedFieldLabel || filterSelectedField,
      datasetId: filterSelectedDataset,
      fieldId: filterSelectedField,
      fieldLabel: filterSelectedFieldLabel,
      filterType: filterType,
      displayType: filterDisplayType,
      defaultValue: filterDefaultValue ?? undefined,
      currentValue: filterDefaultValue ?? undefined, // Initialize with default value
      affectsElements: affectedVizIds.length > 0 ? affectedVizIds : undefined,
      // Add timeframe info for date filters (maps to DateFilterOperator)
      timeframe: filterSelectedTimeframe || undefined,
    }

    addElement(newFilter)
    setShowFilterModal(false)
  }

  // Update existing filter
  const updateFilter = () => {
    if (!editingFilterId || !filterSelectedDataset || !filterSelectedField) return

    // Get affected elements - include both explicitly mapped and auto-selected viz
    const allVizs = getAllVisualizations()
    const affectedVizIds: string[] = []

    for (const viz of allVizs) {
      const vizDatasetId = getVizDatasetId(viz)
      const attributes = vizDatasetId ? filterDatasetAttributes.get(vizDatasetId) || [] : []
      const currentMapping = filterVizFieldMapping.get(viz.id)

      if (currentMapping !== undefined) {
        if (currentMapping) {
          affectedVizIds.push(viz.id)
        }
      } else {
        const isSameDataset = vizDatasetId === filterSelectedDataset
        const hasMatchingField = isSameDataset && attributes.some(a => a.fieldId === filterSelectedField)
        if (hasMatchingField) {
          affectedVizIds.push(viz.id)
        }
      }
    }

    // Update the filter element
    updateElement(editingFilterId, {
      label: filterLabel || filterSelectedFieldLabel || filterSelectedField,
      datasetId: filterSelectedDataset,
      fieldId: filterSelectedField,
      fieldLabel: filterSelectedFieldLabel,
      filterType: filterType,
      displayType: filterDisplayType,
      defaultValue: filterDefaultValue ?? undefined,
      affectsElements: affectedVizIds.length > 0 ? affectedVizIds : undefined,
      timeframe: filterSelectedTimeframe || undefined,
    })

    // Clear cached filter values since field may have changed
    setFilterValues(prev => {
      const next = new Map(prev)
      next.delete(editingFilterId)
      return next
    })

    setShowFilterModal(false)
    setEditingFilterId(null)
  }

  // Remove filter
  const removeFilter = (filterId: string) => {
    removeElement(filterId)
    setOpenFilterOptionsMenu(null)
  }

  // Load distinct values for a filter when dropdown is opened
  const loadFilterValues = async (filter: FilterElement) => {
    // Skip if already loaded or loading
    if (filterValues.has(filter.id) || loadingFilterValues.has(filter.id)) {
      return
    }

    setLoadingFilterValues(prev => new Set(prev).add(filter.id))

    try {
      const values = await getDistinctValues(filter.datasetId, filter.fieldId, currentTenant?.id)
      setFilterValues(prev => {
        const next = new Map(prev)
        next.set(filter.id, values)
        return next
      })
    } catch (error) {
      console.error('Error loading filter values:', error)
      // Set empty array on error so we don't retry indefinitely
      setFilterValues(prev => {
        const next = new Map(prev)
        next.set(filter.id, [])
        return next
      })
    } finally {
      setLoadingFilterValues(prev => {
        const next = new Set(prev)
        next.delete(filter.id)
        return next
      })
    }
  }

  // Handle dashboard filter dropdown toggle
  const handleFilterDropdownToggle = (filter: FilterElement) => {
    if (openDashboardFilter === filter.id) {
      setOpenDashboardFilter(null)
      setCustomDateMode(null)
    } else {
      setOpenDashboardFilter(filter.id)
      setCustomDateMode(null)
      loadFilterValues(filter)
    }
  }

  // Close filter dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false)
      }
    }
    if (showFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showFilterDropdown])

  // Close dashboard filter dropdown on outside click
  useEffect(() => {
    if (!openDashboardFilter) return

    function handleClickOutside(event: MouseEvent) {
      // Check if click is inside any filter dropdown
      const target = event.target as HTMLElement
      if (!target.closest('[data-filter-dropdown]')) {
        setOpenDashboardFilter(null)
        setCustomDateMode(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openDashboardFilter])

  // Close filter options menu on outside click
  useEffect(() => {
    if (!openFilterOptionsMenu) return

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (!target.closest('[data-filter-options-menu]')) {
        setOpenFilterOptionsMenu(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openFilterOptionsMenu])

  // Handle edit visualization
  const handleEditVisualization = (elementId: string) => {
    const element = dashboardConfig.elements.find(el => el.id === elementId)
    if (element?.type === 'visualization') {
      const vizElement = element as VisualizationElement & { _runtimeData?: DashboardVizData }
      // Set the editing element
      setEditingElementId(elementId)

      // Set the viz title from the element
      setVizTitle(vizElement.title || '')

      // Set the viz config for editing - this will restore the full state in DatasetsNew
      if (vizElement.embeddedConfig) {
        setEditingVizConfig(vizElement.embeddedConfig)
        setSelectedDataset(vizElement.embeddedConfig.datasetId)
        // Show loading indicator while VizBuilder loads the data
        setLoadingVizBuilder(true)
      }

      // If there's runtime data, use it for the preview
      if (vizElement._runtimeData) {
        setCurrentVizData(vizElement._runtimeData)
      }

      setShowVizModal(true)
    }
    setOpenOptionsMenu(null)
  }

  const addWidget = (type: WidgetType) => {
    // Calculate position aligned to grid (50px cells)
    const elementCount = dashboardConfig.elements.length
    const baseX = GRID_SIZE * 2 + (elementCount % 3) * (GRID_SIZE * 9) // 450px spacing
    const baseY = GRID_SIZE * 2 + Math.floor(elementCount / 3) * (GRID_SIZE * 7) // 350px spacing

    let newElement: DashboardElement

    switch (type) {
      case 'text':
        newElement = {
          type: 'text',
          id: nanoid(10),
          position: { x: baseX, y: baseY, width: GRID_SIZE * 6, height: GRID_SIZE * 2 }, // 300x100
          content: 'Texto de ejemplo',
          style: {
            fontSize: 14,
            fontWeight: 'normal',
            textAlign: 'left',
          }
        } as TextElement
        break
      case 'image':
        newElement = {
          type: 'image',
          id: nanoid(10),
          position: { x: baseX, y: baseY, width: GRID_SIZE * 4, height: GRID_SIZE * 4 }, // 200x200
          src: '',
          fit: 'contain',
        } as ImageElement
        break
      case 'menu':
        newElement = {
          type: 'menu',
          id: nanoid(10),
          position: { x: baseX, y: baseY, width: GRID_SIZE * 4, height: GRID_SIZE * 2 }, // 200x100
          items: [{ label: 'Item 1' }, { label: 'Item 2' }],
          orientation: 'horizontal',
        } as MenuElement
        break
      case 'button':
        newElement = {
          type: 'button',
          id: nanoid(10),
          position: { x: baseX, y: baseY, width: GRID_SIZE * 4, height: GRID_SIZE * 2 }, // 200x100
          label: 'Boton',
          action: { type: 'link' },
          style: { variant: 'solid' },
        } as ButtonElement
        break
      case 'filter':
        // Open filter modal instead of adding directly
        setShowCreateDropdown(false)
        openFilterModal()
        return
      default:
        return
    }

    addElement(newElement)
    setShowCreateDropdown(false)
  }

  const addVisualizationWidget = () => {
    if (!currentVizData) return

    // Build chart-specific settings based on vizType
    const buildChartSettings = (): import('@/types/viz').ChartSettings => {
      const { vizType, chartSettings, singleValueSettings } = currentVizData
      const showGrid = chartSettings.showXGridLines && chartSettings.showYGridLines

      switch (vizType) {
        case 'line':
          return {
            type: 'line',
            settings: {
              showGrid,
              showDots: chartSettings.pointStyle !== 'none',
              curved: true,
              fillArea: false,
            }
          }
        case 'column':
          return {
            type: 'column',
            settings: {
              showGrid,
              orientation: 'vertical',
              stacked: false,
            }
          }
        case 'area':
          return {
            type: 'area',
            settings: {
              showGrid,
              curved: true,
              stacked: false,
              opacity: chartSettings.areaFillType === 'gradient' ? 0.3 : 0.6,
            }
          }
        case 'pie':
          return {
            type: 'pie',
            settings: {
              showLabels: chartSettings.showDataLabels,
              showLegend: true,
              donut: (chartSettings.pieInnerRadius || 0) > 0,
              innerRadius: chartSettings.pieInnerRadius || 0,
            }
          }
        case 'single':
          return {
            type: 'single',
            settings: {
              label: singleValueSettings?.label || '',
              labelPosition: singleValueSettings?.labelPosition || 'above',
              color: singleValueSettings?.color || '#000000',
              labelBold: singleValueSettings?.labelBold || false,
              format: singleValueSettings?.format || 'auto',
              decimalSeparator: singleValueSettings?.decimalSeparator || 'dot',
              decimalPlaces: singleValueSettings?.decimalPlaces || 0,
              useThresholds: false,
              thresholds: [],
            }
          }
        case 'progress':
          return {
            type: 'progress',
            settings: {
              fontSize: 14,
              showValues: true,
              useThresholds: false,
              thresholds: [],
            }
          }
        default:
          return {
            type: 'line',
            settings: {
              showGrid: true,
              showDots: true,
              curved: true,
              fillArea: false,
            }
          }
      }
    }

    // Debug: Log currentVizData to see what's being received
    console.log('📊 addVisualizationWidget - currentVizData:', {
      orderBy: currentVizData.orderBy,
      rowLimit: currentVizData.rowLimit,
      chartSettings: currentVizData.chartSettings,
      seriesConfig: currentVizData.seriesConfig,
      tableSettings: currentVizData.tableSettings,
    })

    // Build embedded config from viz data - preserve entityId for restoration
    const embeddedConfig: import('@/types/viz').VizConfig = {
      datasetId: currentVizData.datasetId,
      selectedAttributes: currentVizData.selectedAttributes.map(a => ({
        fieldId: a.fieldId,
        entityId: a.entityId,
        label: a.label
      })),
      selectedMetrics: currentVizData.selectedMetrics.map(m => ({
        fieldId: m.fieldId,
        entityId: m.entityId,
        label: m.label
      })),
      filters: currentVizData.filters || [],
      orderBy: currentVizData.orderBy || [],
      rowLimit: currentVizData.rowLimit || 500,
      vizType: currentVizData.vizType,
      chartSettings: buildChartSettings(),
      colorScheme: 'default',
      chartRowLimit: currentVizData.chartRowLimit,
      seriesConfig: currentVizData.seriesConfig,
      xAxisFormat: currentVizData.xAxisFormat ? {
        type: currentVizData.xAxisFormat.type as 'auto' | 'date' | 'time' | 'datetime' | 'number' | 'text',
        dateFormat: currentVizData.xAxisFormat.dateFormat,
        labelRotation: currentVizData.xAxisFormat.labelRotation,
      } : undefined,
      // Store runtime chart settings directly - this preserves all settings without conversion
      runtimeChartSettings: {
        showDataLabels: currentVizData.chartSettings.showDataLabels,
        showXGridLines: currentVizData.chartSettings.showXGridLines,
        showYGridLines: currentVizData.chartSettings.showYGridLines,
        pointStyle: currentVizData.chartSettings.pointStyle,
        pieInnerRadius: currentVizData.chartSettings.pieInnerRadius,
        yAxisFormatType: currentVizData.chartSettings.yAxisFormatType,
        areaFillType: currentVizData.chartSettings.areaFillType,
        treatNullsAsZero: currentVizData.chartSettings.treatNullsAsZero,
        referenceLineY: currentVizData.chartSettings.referenceLineY,
        referenceLineX: currentVizData.chartSettings.referenceLineX,
      },
      // Store single value settings for 'single' viz type
      singleValueSettings: currentVizData.singleValueSettings,
      // Store table settings for 'table' viz type
      tableSettings: currentVizData.tableSettings,
      // Store column totals for table visualization
      columnTotals: currentVizData.columnTotals,
    }

    // Use vizTitle if set (from modal input), then from vizData, otherwise fall back to dataset label
    const elementTitle = vizTitle.trim() || currentVizData.vizTitle || currentVizData.datasetLabel

    // If editing existing element, update it
    if (editingElementId) {
      const existingElement = dashboardConfig.elements.find(el => el.id === editingElementId)
      if (existingElement) {
        const updatedElement = {
          ...existingElement,
          title: elementTitle,
          embeddedConfig,
          _runtimeData: currentVizData,
        }
        updateElement(editingElementId, updatedElement)
      }
    } else {
      // Create new element - aligned to grid (25px cells)
      const elementCount = dashboardConfig.elements.length
      const baseX = GRID_SIZE * 2 + (elementCount % 2) * (GRID_SIZE * 28) // 700px spacing
      const baseY = GRID_SIZE * 2 + Math.floor(elementCount / 2) * (GRID_SIZE * 18) // 450px spacing

      const vizElement: VisualizationElement = {
        type: 'visualization',
        id: nanoid(10),
        position: { x: baseX, y: baseY, width: GRID_SIZE * 25, height: GRID_SIZE * 16 }, // 625x400
        title: elementTitle,
        showTitle: true,
        embeddedConfig,
      }

      // Store the runtime chart data for rendering
      ;(vizElement as VisualizationElement & { _runtimeData?: DashboardVizData })._runtimeData = currentVizData

      addElement(vizElement)
    }

    // Reset state
    setShowVizModal(false)
    setSelectedDataset('')
    setEditingElementId(null)
    setEditingVizConfig(undefined)
    setCurrentVizData(null)
    setVizTitle('')
    setSelectedElement(null) // Don't auto-select the new element
  }

  const getWidgetIcon = (type: WidgetType) => {
    switch (type) {
      case 'text':
        return DocumentTextIcon
      case 'image':
        return PhotoIcon
      case 'menu':
        return Bars3Icon
      case 'button':
        return CursorArrowRaysIcon
      case 'visualization':
        return ChartBarIcon
      case 'filter':
        return FunnelIcon
    }
  }

  const getWidgetLabel = (type: WidgetType) => {
    switch (type) {
      case 'text':
        return 'Texto'
      case 'image':
        return 'Imagen'
      case 'menu':
        return 'Menu'
      case 'button':
        return 'Boton'
      case 'visualization':
        return 'Visualizacion'
      case 'filter':
        return 'Filtro'
    }
  }

  const selectedDatasetLabel = datasets.find(d => d.id === selectedDataset)?.label

  // Render chart based on viz data - matches DatasetsNew styling
  // Memoized to prevent unnecessary re-renders when modal states change
  const renderChart = useCallback((vizData: DashboardVizData) => {
    const { vizType, chartData, selectedMetrics, selectedAttributes, seriesConfig, chartSettings } = vizData

    if (!chartData || chartData.length === 0 || !vizType) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          Sin datos
        </div>
      )
    }

    const xKey = selectedAttributes[0]?.fieldId || ''

    // Get series colors - matching DatasetsNew defaults
    const defaultColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1']
    const getSeriesColor = (metricId: string, index: number) => {
      return seriesConfig[metricId]?.color || defaultColors[index % defaultColors.length]
    }

    // Get series label
    const getSeriesLabel = (metric: { fieldId: string; label: string }) => {
      return seriesConfig[metric.fieldId]?.label || metric.label
    }

    // Common tooltip style matching DatasetsNew
    const tooltipStyle = {
      backgroundColor: '#1f2937',
      border: 'none',
      borderRadius: '8px',
      fontSize: '12px',
    }

    // Common axis style
    const axisTickStyle = { fontSize: 11, fill: '#6b7280' }
    const axisLineStyle = { stroke: '#d1d5db' }

    // Point style configuration
    const getPointConfig = (color: string) => {
      if (chartSettings.pointStyle === 'filled') {
        return { r: 3, fill: color, stroke: color }
      } else if (chartSettings.pointStyle === 'outline') {
        return { r: 3, fill: '#fff', stroke: color, strokeWidth: 2 }
      }
      return false
    }

    // Y-axis format type
    const yAxisFormat = chartSettings.yAxisFormatType || 'auto'

    // X-axis format settings
    const xAxisFormat = vizData.xAxisFormat
    const xAxisFormatType = (xAxisFormat?.type || 'auto') as XAxisFormatType
    const xAxisDatePattern = xAxisFormat?.dateFormat || 'dd/MM/yyyy'

    // X-axis tick formatter
    const xAxisTickFormatter = xAxisFormatType !== 'auto'
      ? (value: unknown) => formatXAxisValue(value, xAxisFormatType, xAxisDatePattern)
      : undefined

    switch (vizType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={chartSettings.showXGridLines} horizontal={chartSettings.showYGridLines} />
              <XAxis
                dataKey={xKey}
                tick={axisTickStyle}
                tickLine={axisLineStyle}
                axisLine={axisLineStyle}
                tickFormatter={xAxisTickFormatter}
              />
              <YAxis
                tick={axisTickStyle}
                tickLine={axisLineStyle}
                axisLine={axisLineStyle}
                tickFormatter={(value) => formatYAxisValue(value, yAxisFormat)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: '#9ca3af' }}
                itemStyle={{ color: '#f3f4f6' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                iconType="line"
                formatter={(value) => <span style={{ color: '#374151' }}>{value}</span>}
              />
              {/* Reference Line Y (horizontal) */}
              {chartSettings.referenceLineY?.enabled && (
                <ReferenceLine
                  y={chartSettings.referenceLineY.value}
                  stroke={chartSettings.referenceLineY.color}
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              )}
              {/* Reference Line X (vertical) */}
              {chartSettings.referenceLineX?.enabled && (
                <ReferenceLine
                  x={chartSettings.referenceLineX.value}
                  stroke={chartSettings.referenceLineX.color}
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              )}
              {selectedMetrics.map((metric, idx) => {
                const color = getSeriesColor(metric.fieldId, idx)
                return (
                  <Line
                    key={metric.fieldId}
                    type="monotone"
                    dataKey={metric.fieldId}
                    name={getSeriesLabel(metric)}
                    stroke={color}
                    strokeWidth={2}
                    dot={getPointConfig(color)}
                    activeDot={chartSettings.pointStyle !== 'none' ? { r: 5, fill: color } : false}
                    connectNulls={false}
                  >
                    {chartSettings.showDataLabels && (
                      <LabelList dataKey={metric.fieldId} position="top" fill="#6b7280" fontSize={10} />
                    )}
                  </Line>
                )
              })}
            </LineChart>
          </ResponsiveContainer>
        )

      case 'column':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={chartSettings.showXGridLines} horizontal={chartSettings.showYGridLines} />
              <XAxis
                dataKey={xKey}
                tick={axisTickStyle}
                tickLine={axisLineStyle}
                axisLine={axisLineStyle}
                tickFormatter={xAxisTickFormatter}
              />
              <YAxis
                tick={axisTickStyle}
                tickLine={axisLineStyle}
                axisLine={axisLineStyle}
                tickFormatter={(value) => formatYAxisValue(value, yAxisFormat)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: '#9ca3af' }}
                itemStyle={{ color: '#f3f4f6' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                iconType="square"
                formatter={(value) => <span style={{ color: '#374151' }}>{value}</span>}
              />
              {/* Reference Line Y (horizontal) */}
              {chartSettings.referenceLineY?.enabled && (
                <ReferenceLine
                  y={chartSettings.referenceLineY.value}
                  stroke={chartSettings.referenceLineY.color}
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              )}
              {/* Reference Line X (vertical) */}
              {chartSettings.referenceLineX?.enabled && (
                <ReferenceLine
                  x={chartSettings.referenceLineX.value}
                  stroke={chartSettings.referenceLineX.color}
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              )}
              {selectedMetrics.map((metric, idx) => (
                <Bar
                  key={metric.fieldId}
                  dataKey={metric.fieldId}
                  name={getSeriesLabel(metric)}
                  fill={getSeriesColor(metric.fieldId, idx)}
                  radius={[4, 4, 0, 0]}
                >
                  {chartSettings.showDataLabels && (
                    <LabelList dataKey={metric.fieldId} position="top" fill="#6b7280" fontSize={10} />
                  )}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        )

      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={chartSettings.showXGridLines} horizontal={chartSettings.showYGridLines} />
              <XAxis
                dataKey={xKey}
                tick={axisTickStyle}
                tickLine={axisLineStyle}
                axisLine={axisLineStyle}
                tickFormatter={xAxisTickFormatter}
              />
              <YAxis
                tick={axisTickStyle}
                tickLine={axisLineStyle}
                axisLine={axisLineStyle}
                tickFormatter={(value) => formatYAxisValue(value, yAxisFormat)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: '#9ca3af' }}
                itemStyle={{ color: '#f3f4f6' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                iconType="rect"
                formatter={(value) => <span style={{ color: '#374151' }}>{value}</span>}
              />
              {/* Reference Line Y (horizontal) */}
              {chartSettings.referenceLineY?.enabled && (
                <ReferenceLine
                  y={chartSettings.referenceLineY.value}
                  stroke={chartSettings.referenceLineY.color}
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              )}
              {/* Reference Line X (vertical) */}
              {chartSettings.referenceLineX?.enabled && (
                <ReferenceLine
                  x={chartSettings.referenceLineX.value}
                  stroke={chartSettings.referenceLineX.color}
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              )}
              {selectedMetrics.map((metric, idx) => {
                const color = getSeriesColor(metric.fieldId, idx)
                return (
                  <Area
                    key={metric.fieldId}
                    type="monotone"
                    dataKey={metric.fieldId}
                    name={getSeriesLabel(metric)}
                    stroke={color}
                    fill={color}
                    fillOpacity={0.3}
                    dot={getPointConfig(color)}
                    activeDot={chartSettings.pointStyle !== 'none' ? { r: 5, fill: color } : false}
                  >
                    {chartSettings.showDataLabels && (
                      <LabelList dataKey={metric.fieldId} position="top" fill="#6b7280" fontSize={10} />
                    )}
                  </Area>
                )
              })}
            </AreaChart>
          </ResponsiveContainer>
        )

      case 'pie':
        const pieData = chartData.map((row, index) => ({
          name: String(row[xKey] || `Item ${index + 1}`),
          value: Number(row[selectedMetrics[0]?.fieldId] || 0),
          fill: defaultColors[index % defaultColors.length]
        }))
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={chartSettings.pieInnerRadius || 0}
                outerRadius="70%"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: '#9ca3af' }}
                itemStyle={{ color: '#f3f4f6' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                formatter={(value) => <span style={{ color: '#374151' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )

      case 'single':
        const singleValue = chartData[0]?.[selectedMetrics[0]?.fieldId]
        const settings = vizData.singleValueSettings
        const defaultLabel = selectedMetrics[0]?.label || 'Valor'
        const displayLabel = settings?.label || defaultLabel
        const displayColor = settings?.color || '#3B82F6'
        const labelBold = settings?.labelBold ?? false
        const labelPosition = settings?.labelPosition ?? 'below'
        const format = settings?.format ?? 'auto'
        const decimalPlaces = settings?.decimalPlaces ?? 0
        const useDot = settings?.decimalSeparator === 'dot'

        // Format the value
        const formatSingleValue = (val: number): string => {
          const displayVal = format === 'percent' ? val * 100 : val
          let result: string

          switch (format) {
            case 'compact':
              if (Math.abs(displayVal) >= 1000000000) result = `${(displayVal / 1000000000).toFixed(1)}B`
              else if (Math.abs(displayVal) >= 1000000) result = `${(displayVal / 1000000).toFixed(1)}M`
              else if (Math.abs(displayVal) >= 1000) result = `${(displayVal / 1000).toFixed(1)}K`
              else result = displayVal.toFixed(decimalPlaces)
              break
            case 'percent':
              result = `${displayVal.toFixed(decimalPlaces)}%`
              break
            case 'currency':
              result = `$${displayVal.toFixed(decimalPlaces)}`
              break
            case 'number':
              result = displayVal.toFixed(decimalPlaces)
              break
            default: // auto
              result = displayVal.toLocaleString(useDot ? 'en-US' : 'es-ES', {
                minimumFractionDigits: decimalPlaces,
                maximumFractionDigits: decimalPlaces
              })
          }

          // Apply decimal separator
          if (!useDot && format !== 'auto') {
            result = result.replace('.', ',')
          }
          return result
        }

        const formattedSingleValue = typeof singleValue === 'number'
          ? formatSingleValue(singleValue)
          : String(singleValue ?? '-')

        const labelElement = (
          <div className={`text-sm text-gray-500 ${labelBold ? 'font-bold' : 'font-medium'}`}>
            {displayLabel}
          </div>
        )

        const valueElement = (
          <div
            className="text-5xl font-thin"
            style={{ color: displayColor }}
          >
            {formattedSingleValue}
          </div>
        )

        return (
          <div className="flex justify-center items-center h-full">
            <div className="text-center">
              {labelPosition === 'above' ? (
                <>
                  {labelElement}
                  <div className="mt-1">{valueElement}</div>
                </>
              ) : (
                <>
                  {valueElement}
                  <div className="mt-1">{labelElement}</div>
                </>
              )}
            </div>
          </div>
        )

      case 'progress':
        const progressValue = Number(chartData[0]?.[selectedMetrics[0]?.fieldId] || 0)
        const maxValue = Math.max(...chartData.map(r => Number(r[selectedMetrics[0]?.fieldId] || 0)))
        const progressPercent = maxValue > 0 ? (progressValue / maxValue) * 100 : 0
        const progressColor = defaultColors[0]
        return (
          <div className="flex items-center justify-center h-full p-4">
            <div className="w-full">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">{selectedMetrics[0]?.label}</span>
                <span className="font-semibold text-gray-800">{progressValue.toLocaleString('es-ES')}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="h-4 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(progressPercent, 100)}%`, backgroundColor: progressColor }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1 text-right">
                {progressPercent.toFixed(1)}%
              </div>
            </div>
          </div>
        )

      case 'table': {
        // Get table settings from vizData
        const tableSettings = vizData.tableSettings || {
          fontSize: 'sm' as const,
          headerBg: 'gray' as const,
          headerAlign: 'left' as const,
          showHeader: true,
          showRowNumbers: false,
          striped: true,
          showTotals: false,
          columnWidths: {},
        }
        const columnTotals = vizData.columnTotals || {}

        // Build columns from attributes and metrics
        const tableColumns: { id: string; label: string; type: 'attribute' | 'metric' }[] = [
          ...selectedAttributes.map(attr => ({
            id: attr.fieldId,
            label: seriesConfig[attr.fieldId]?.label || attr.label || attr.fieldId,
            type: 'attribute' as const
          })),
          ...selectedMetrics.map(metric => ({
            id: metric.fieldId,
            label: seriesConfig[metric.fieldId]?.label || metric.label || metric.fieldId,
            type: 'metric' as const
          }))
        ]

        // Font size class
        const fontSizeClass = tableSettings.fontSize === 'xs' ? 'text-xs' :
          tableSettings.fontSize === 'sm' ? 'text-sm' :
          tableSettings.fontSize === 'base' ? 'text-base' : 'text-lg'

        // Header background class
        const headerBgClass = tableSettings.headerBg === 'white' ? 'bg-white text-gray-600' :
          tableSettings.headerBg === 'gray' ? 'bg-gray-50 text-gray-600' :
          'bg-gray-800 text-white'

        // Header align class
        const headerAlignClass = tableSettings.headerAlign === 'center' ? 'text-center' :
          tableSettings.headerAlign === 'right' ? 'text-right' : 'text-left'

        // Format value based on series config
        const formatValue = (colId: string, value: unknown, isMetric: boolean) => {
          if (!isMetric || typeof value !== 'number') return String(value ?? '-')

          const colConfig = seriesConfig[colId] || {}
          const format = colConfig.format || 'number'

          switch (format) {
            case 'currency':
              return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            case 'percent':
              return `${(value * 100).toFixed(1)}%`
            case 'compact':
              if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`
              if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
              if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
              return value.toLocaleString()
            case 'decimal':
              return value.toFixed(2)
            default:
              return value.toLocaleString('es-ES')
          }
        }

        // Get cell alignment and font size from series config
        const getCellClasses = (colId: string, isMetric: boolean) => {
          const colConfig = seriesConfig[colId] || {}
          const cellAlign = colConfig.align || (isMetric ? 'right' : 'left')
          const alignClass = cellAlign === 'center' ? 'text-center' : cellAlign === 'right' ? 'text-right' : 'text-left'
          const cellFontSize = colConfig.fontSize
          const fontClass = cellFontSize
            ? (cellFontSize === 'xs' ? 'text-xs' : cellFontSize === 'sm' ? 'text-sm' : cellFontSize === 'base' ? 'text-base' : 'text-lg')
            : ''
          return `${alignClass} ${fontClass}`
        }

        // Get threshold color for a value
        const getThresholdColor = (colId: string, value: unknown) => {
          if (typeof value !== 'number') return undefined
          const colConfig = seriesConfig[colId] || {}
          const thresholds = colConfig.thresholds || []
          for (const threshold of thresholds) {
            const minOk = threshold.min === null || value >= threshold.min
            const maxOk = threshold.max === null || value <= threshold.max
            if (minOk && maxOk) return threshold.color
          }
          return undefined
        }

        return (
          <div className="h-full w-full overflow-auto p-2">
            <table className={`w-full border-collapse ${fontSizeClass}`}>
              {tableSettings.showHeader && (
                <thead className="sticky top-0 z-10">
                  <tr className={`border-b-2 ${tableSettings.headerBg === 'black' ? 'border-gray-700' : 'border-gray-200'}`}>
                    {tableSettings.showRowNumbers && (
                      <th className={`px-3 py-2 font-semibold w-12 ${headerAlignClass} ${headerBgClass}`}>#</th>
                    )}
                    {tableColumns.map((col) => (
                      <th
                        key={col.id}
                        className={`px-3 py-2 font-semibold whitespace-nowrap ${headerAlignClass} ${headerBgClass}`}
                        style={{ width: tableSettings.columnWidths[col.id] || 'auto', minWidth: 60 }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {chartData.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${tableSettings.striped && rowIdx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}
                  >
                    {tableSettings.showRowNumbers && (
                      <td className="px-3 py-2 text-gray-400 font-mono">{rowIdx + 1}</td>
                    )}
                    {tableColumns.map((col) => {
                      const isMetric = col.type === 'metric'
                      const value = row[col.id]
                      const thresholdColor = getThresholdColor(col.id, value)

                      return (
                        <td
                          key={col.id}
                          className={`px-3 py-2 ${getCellClasses(col.id, isMetric)} ${isMetric ? 'font-mono' : ''}`}
                          style={{
                            width: tableSettings.columnWidths[col.id] || 'auto',
                            minWidth: 60,
                            color: thresholdColor || '#374151',
                            fontWeight: thresholdColor ? 600 : undefined,
                          }}
                        >
                          {formatValue(col.id, value, isMetric)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
              {/* Totals Footer */}
              {tableSettings.showTotals && chartData.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                    {tableSettings.showRowNumbers && (
                      <td className="px-3 py-2 text-gray-500">Total</td>
                    )}
                    {tableColumns.map((col, colIdx) => {
                      const isMetric = col.type === 'metric'
                      const total = columnTotals[col.id]

                      return (
                        <td
                          key={col.id}
                          className={`px-3 py-2 ${getCellClasses(col.id, isMetric)} ${isMetric ? 'font-mono' : ''} text-gray-700`}
                          style={{
                            width: tableSettings.columnWidths[col.id] || 'auto',
                            minWidth: 60,
                          }}
                        >
                          {isMetric && total !== undefined
                            ? formatValue(col.id, total, true)
                            : (!tableSettings.showRowNumbers && colIdx === 0 ? 'Total' : '')}
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )
      }

      case 'scatter': {
        // For scatter, we need X and Y metrics
        const xMetricId = selectedMetrics[0]?.fieldId
        const yMetricId = selectedMetrics[1]?.fieldId
        const categoryKey = selectedAttributes[0]?.fieldId

        if (!xMetricId || !yMetricId) {
          return (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              El scatter plot requiere al menos 2 métricas (X e Y)
            </div>
          )
        }

        const xLabel = seriesConfig[xMetricId]?.label || selectedMetrics[0]?.label || xMetricId
        const yLabel = seriesConfig[yMetricId]?.label || selectedMetrics[1]?.label || yMetricId

        // Use default colors for scatter points
        const scatterColors = defaultColors

        // If we have a category attribute, group data by category
        const hasCategories = categoryKey && chartData.some(d => d[categoryKey] !== undefined)

        if (hasCategories) {
          const categories = [...new Set(chartData.map(d => String(d[categoryKey])))]
          return (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={chartSettings?.showYGridLines}
                  vertical={chartSettings?.showXGridLines}
                />
                <XAxis
                  type="number"
                  dataKey={xMetricId}
                  name={xLabel}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey={yMetricId}
                  name={yLabel}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                />
                <ZAxis range={[60, 400]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  formatter={(value: number) => value.toLocaleString('es-ES')}
                />
                <Legend
                  formatter={(value) => <span style={{ color: '#374151' }}>{value}</span>}
                />
                {categories.map((category, index) => (
                  <Scatter
                    key={category}
                    name={category}
                    data={chartData.filter(d => String(d[categoryKey]) === category)}
                    fill={scatterColors[index % scatterColors.length]}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          )
        }

        // No categories - single scatter series
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={chartSettings?.showYGridLines}
                vertical={chartSettings?.showXGridLines}
              />
              <XAxis
                type="number"
                dataKey={xMetricId}
                name={xLabel}
                tick={{ fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey={yMetricId}
                name={yLabel}
                tick={{ fontSize: 11 }}
                tickLine={false}
              />
              <ZAxis range={[60, 400]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value: number) => value.toLocaleString('es-ES')}
              />
              <Scatter
                name="Datos"
                data={chartData}
                fill={scatterColors[0]}
              />
            </ScatterChart>
          </ResponsiveContainer>
        )
      }

      default:
        return null
    }
  }, []) // Empty deps - vizData is passed as parameter, no external deps needed

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Save notifications */}
      {saveSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Dashboard guardado exitosamente
        </div>
      )}
      {saveError && (
        <div className="fixed top-4 right-4 z-50 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          {saveError}
          <button
            onClick={() => setSaveError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Top Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        {/* Left side - Title */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex flex-col min-w-0 flex-1">
            {/* Folder breadcrumb - always show */}
            <div className="flex items-center gap-1 text-[10px] text-gray-400 px-2 -ml-2 mb-0.5">
              <button
                onClick={() => navigate('/visualizations')}
                className="hover:text-blue-600 hover:underline"
              >
                Dashboards
              </button>
              {folderPath.map((folder) => (
                <span key={folder.id} className="flex items-center gap-1">
                  <span>/</span>
                  <button
                    onClick={() => navigate(`/visualizations?folder=${folder.id}`)}
                    className="hover:text-blue-600 hover:underline"
                  >
                    {folder.name}
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={dashboardName}
              onChange={(e) => setDashboardName(e.target.value)}
              disabled={!isEditMode}
              className="text-lg font-medium text-gray-800 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-0.5 -ml-2 w-full disabled:opacity-75"
              placeholder="Nombre del dashboard"
            />
            <input
              type="text"
              value={dashboardDescription}
              onChange={(e) => setDashboardDescription(e.target.value)}
              disabled={!isEditMode}
              className="text-xs text-gray-500 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-0.5 -ml-2 w-full disabled:opacity-75"
              placeholder="Agregar descripcion..."
            />
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Create dropdown - only visible in edit mode */}
          {isEditMode && (
            <div className="relative" ref={createDropdownRef}>
              <button
                onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                Agregar
                <ChevronDownIcon className="h-4 w-4" />
              </button>
              {showCreateDropdown && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                  <div className="py-1">
                    <button
                      onClick={() => addWidget('text')}
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <DocumentTextIcon className="h-4 w-4 mr-3 text-gray-400" />
                      Texto
                    </button>
                    <button
                      onClick={() => addWidget('image')}
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <PhotoIcon className="h-4 w-4 mr-3 text-gray-400" />
                      Imagen
                    </button>
                    <button
                      onClick={() => addWidget('menu')}
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Bars3Icon className="h-4 w-4 mr-3 text-gray-400" />
                      Menu
                    </button>
                    <button
                      onClick={() => addWidget('button')}
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <CursorArrowRaysIcon className="h-4 w-4 mr-3 text-gray-400" />
                      Boton
                    </button>
                    <button
                      onClick={handleCreateVisualization}
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <ChartBarIcon className="h-4 w-4 mr-3 text-gray-400" />
                      Visualizacion
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={() => addWidget('filter')}
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <FunnelIcon className="h-4 w-4 mr-3 text-gray-400" />
                      Filtro
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Save button - only visible in edit mode */}
          {isEditMode && (
            <button
              onClick={handleQuickSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <div className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowDownTrayIcon className="h-4 w-4" />
              )}
              Guardar
            </button>
          )}

          {/* Cancel button - only visible in edit mode */}
          {isEditMode && (
            <button
              onClick={() => setIsEditMode(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <XMarkIcon className="h-4 w-4" />
              Cancelar
            </button>
          )}

          <button
            onClick={handleExecuteAllViz}
            disabled={isExecuting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-blue rounded-lg hover:bg-primary-blue/90 transition-colors disabled:opacity-50"
          >
            {isExecuting ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <PlayIcon className="h-4 w-4" />
            )}
            Actualizar
          </button>

          {/* Settings dropdown */}
          <div className="relative" ref={settingsDropdownRef}>
            <button
              onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
              className={`p-2 rounded-lg transition-colors ${
                isEditMode
                  ? 'text-primary-blue bg-blue-50 hover:bg-blue-100'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              title="Configuracion"
            >
              <Cog6ToothIcon className="h-5 w-5" />
            </button>
            {showSettingsDropdown && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowSettingsDropdown(false)
                      openSaveModal()
                    }}
                    className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <InformationCircleIcon className="h-4 w-4 mr-3 text-gray-400" />
                    Propiedades
                  </button>
                  {!canEdit && !isEditMode ? (
                    <div
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-400 cursor-not-allowed"
                      title={isCoreDashboard ? "Solo SysOwner puede editar Core Dashboards" : "Edición deshabilitada en modo demo"}
                    >
                      <LockClosedIcon className="h-4 w-4 mr-3 text-gray-300" />
                      Solo lectura
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setShowSettingsDropdown(false)
                        setIsEditMode(!isEditMode)
                      }}
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <PencilIcon className="h-4 w-4 mr-3 text-gray-400" />
                      {isEditMode ? 'Salir de edicion' : 'Editar'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowSettingsDropdown(false)
                      // TODO: Implement download functionality
                    }}
                    className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <DocumentArrowDownIcon className="h-4 w-4 mr-3 text-gray-400" />
                    Descargar
                  </button>
                  <button
                    onClick={() => {
                      setShowSettingsDropdown(false)
                      // TODO: Implement access control
                    }}
                    className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <UserGroupIcon className="h-4 w-4 mr-3 text-gray-400" />
                    Accesos
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar - only show if there are filters */}
      {dashboardFilters.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-4 flex-wrap">
            {dashboardFilters.map((filter) => (
              <div
                key={filter.id}
                className="flex flex-col"
              >
                {/* Filter title and options button row */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500">{filter.label}</span>
                  {isEditMode && (
                    <div className="relative ml-2" data-filter-options-menu>
                      <button
                        onClick={() => setOpenFilterOptionsMenu(openFilterOptionsMenu === filter.id ? null : filter.id)}
                        className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Opciones del filtro"
                      >
                        <EllipsisVerticalIcon className="h-3.5 w-3.5" />
                      </button>
                      {/* Options dropdown menu */}
                      {openFilterOptionsMenu === filter.id && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                          <button
                            onClick={() => openFilterModalForEdit(filter)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <Cog6ToothIcon className="h-4 w-4 text-gray-400" />
                            Opciones
                          </button>
                          <button
                            onClick={() => removeFilter(filter.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <TrashIcon className="h-4 w-4" />
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* Filter control based on displayType */}
                {(() => {
                  const values = filterValues.get(filter.id) || []
                  const isLoading = loadingFilterValues.has(filter.id)
                  const isOpen = openDashboardFilter === filter.id

                  if (filter.displayType === 'button') {
                    return (
                      <div className="flex gap-1 flex-wrap">
                        <button
                          onClick={() => updateElement(filter.id, { currentValue: '' })}
                          className={`px-2 py-1 text-xs rounded ${
                            !filter.currentValue
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Todos
                        </button>
                        {values.slice(0, 4).map((value, idx) => (
                          <button
                            key={idx}
                            onClick={() => updateElement(filter.id, { currentValue: value })}
                            className={`px-2 py-1 text-xs rounded ${
                              filter.currentValue === value
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {value}
                          </button>
                        ))}
                        {values.length === 0 && !isLoading && (
                          <button
                            onClick={() => loadFilterValues(filter)}
                            className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-500 hover:bg-gray-200"
                          >
                            Cargar valores...
                          </button>
                        )}
                      </div>
                    )
                  }

                  if (filter.displayType === 'option') {
                    return (
                      <div className="flex gap-2 flex-wrap">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`filter-${filter.id}`}
                            checked={!filter.currentValue}
                            onChange={() => updateElement(filter.id, { currentValue: '' })}
                            className="h-3.5 w-3.5 text-blue-600"
                          />
                          <span className="text-xs text-gray-600">Todos</span>
                        </label>
                        {values.slice(0, 4).map((value, idx) => (
                          <label key={idx} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`filter-${filter.id}`}
                              checked={filter.currentValue === value}
                              onChange={() => updateElement(filter.id, { currentValue: value })}
                              className="h-3.5 w-3.5 text-blue-600"
                            />
                            <span className="text-xs text-gray-600">{value}</span>
                          </label>
                        ))}
                        {values.length === 0 && !isLoading && (
                          <button
                            onClick={() => loadFilterValues(filter)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Cargar valores...
                          </button>
                        )}
                      </div>
                    )
                  }

                  // Check if this is a date filter
                  const isDateFilter = filter.filterType === 'date' || filter.filterType === 'daterange'

                  // Date filter options (same as VizBuilder)
                  const dateFilterOptions = [
                    { group: 'Relativos', options: [
                      { value: 'today', label: 'Hoy' },
                      { value: 'yesterday', label: 'Ayer' },
                      { value: 'last_7_days', label: 'Últimos 7 días' },
                      { value: 'last_14_days', label: 'Últimos 14 días' },
                      { value: 'last_30_days', label: 'Últimos 30 días' },
                      { value: 'last_60_days', label: 'Últimos 60 días' },
                      { value: 'last_90_days', label: 'Últimos 90 días' },
                    ]},
                    { group: 'Período actual', options: [
                      { value: 'this_week', label: 'Esta semana' },
                      { value: 'this_month', label: 'Este mes' },
                      { value: 'this_quarter', label: 'Este trimestre' },
                      { value: 'this_year', label: 'Este año' },
                    ]},
                    { group: 'Período anterior', options: [
                      { value: 'last_week', label: 'Semana pasada' },
                      { value: 'last_month', label: 'Mes pasado' },
                      { value: 'last_quarter', label: 'Trimestre pasado' },
                      { value: 'last_year', label: 'Año pasado' },
                    ]},
                  ]

                  // Get display label for current value
                  const getDateFilterLabel = (val: unknown) => {
                    if (!val) return 'Todos'
                    // Check if it's a range object
                    if (typeof val === 'object' && val !== null && 'start' in (val as Record<string, unknown>)) {
                      const range = val as { start: string; end: string }
                      if (range.start && range.end) {
                        return `${range.start} - ${range.end}`
                      }
                      return range.start || 'Rango...'
                    }
                    // Check if it's a specific date (YYYY-MM-DD format)
                    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
                      return val
                    }
                    // Check in predefined options
                    for (const group of dateFilterOptions) {
                      const found = group.options.find(opt => opt.value === val)
                      if (found) return found.label
                    }
                    return String(val)
                  }

                  // Default: dropdown
                  return (
                    <div className="relative" data-filter-dropdown>
                      <button
                        onClick={() => handleFilterDropdownToggle(filter)}
                        className="flex items-center justify-between gap-2 bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px] hover:border-gray-400 transition-colors"
                      >
                        <span className="truncate text-gray-700">
                          {isDateFilter ? getDateFilterLabel(filter.currentValue) : (filter.currentValue ? String(filter.currentValue) : 'Todos')}
                        </span>
                        <ChevronDownIcon className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isOpen && (
                        <div className={`absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden ${customDateMode ? 'flex' : ''}`} style={{ minWidth: customDateMode ? 480 : 200 }}>
                          {isDateFilter ? (
                            // Date filter: show relative date options with optional calendar column
                            <div className="flex">
                              {/* Left column: predefined options */}
                              <div className={`max-h-80 overflow-y-auto py-1 ${customDateMode ? 'w-[200px] border-r border-gray-200' : 'w-full'}`}>
                                {/* Todos option */}
                                <button
                                  onClick={() => {
                                    updateElement(filter.id, { currentValue: '' })
                                    setOpenDashboardFilter(null)
                                    setCustomDateMode(null)
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                                    !filter.currentValue
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  <span>Todos</span>
                                  {!filter.currentValue && (
                                    <span className="text-blue-500">✓</span>
                                  )}
                                </button>

                                {dateFilterOptions.map((group, groupIdx) => (
                                  <div key={groupIdx}>
                                    <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-t border-gray-100">
                                      {group.group}
                                    </div>
                                    {group.options.map((opt) => {
                                      const isSelected = filter.currentValue === opt.value
                                      return (
                                        <button
                                          key={opt.value}
                                          onClick={() => {
                                            updateElement(filter.id, { currentValue: opt.value })
                                            setOpenDashboardFilter(null)
                                            setCustomDateMode(null)
                                          }}
                                          className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                                            isSelected
                                              ? 'bg-blue-50 text-blue-700'
                                              : 'text-gray-600 hover:bg-gray-50'
                                          }`}
                                        >
                                          <span>{opt.label}</span>
                                          {isSelected && (
                                            <span className="text-blue-500 flex-shrink-0">✓</span>
                                          )}
                                        </button>
                                      )
                                    })}
                                  </div>
                                ))}

                                {/* Custom date selection options */}
                                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-t border-gray-100">
                                  Personalizado
                                </div>

                                {/* En el día option */}
                                <button
                                  onClick={() => setCustomDateMode('day')}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                                    customDateMode === 'day' || (typeof filter.currentValue === 'string' && filter.currentValue.match(/^\d{4}-\d{2}-\d{2}$/))
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  <span>En el día</span>
                                  <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                                </button>

                                {/* Rango option */}
                                <button
                                  onClick={() => setCustomDateMode('range')}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                                    customDateMode === 'range' || (typeof filter.currentValue === 'object' && filter.currentValue && 'start' in (filter.currentValue as Record<string, unknown>))
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  <span>Rango de fechas</span>
                                  <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                                </button>
                              </div>

                              {/* Right column: calendar (only shows when custom mode is selected) */}
                              {customDateMode && (
                                <div className="p-4 w-[280px]">
                                  <DateRangePicker
                                    startDate={
                                      customDateMode === 'day'
                                        ? (typeof filter.currentValue === 'string' && filter.currentValue.match(/^\d{4}-\d{2}-\d{2}$/) ? filter.currentValue : null)
                                        : (typeof filter.currentValue === 'object' && filter.currentValue && 'start' in (filter.currentValue as Record<string, unknown>)
                                            ? String((filter.currentValue as Record<string, unknown>).start || '')
                                            : null)
                                    }
                                    endDate={
                                      customDateMode === 'range' && typeof filter.currentValue === 'object' && filter.currentValue && 'end' in (filter.currentValue as Record<string, unknown>)
                                        ? String((filter.currentValue as Record<string, unknown>).end || '')
                                        : null
                                    }
                                    onChange={(start, end) => {
                                      if (customDateMode === 'day') {
                                        updateElement(filter.id, { currentValue: start })
                                        setOpenDashboardFilter(null)
                                        setCustomDateMode(null)
                                      } else {
                                        if (start && end) {
                                          updateElement(filter.id, { currentValue: { start, end, type: 'range' } })
                                          setOpenDashboardFilter(null)
                                          setCustomDateMode(null)
                                        } else if (start) {
                                          updateElement(filter.id, { currentValue: { start, end: '', type: 'range' } })
                                        }
                                      }
                                    }}
                                    isRange={customDateMode === 'range'}
                                    inline={true}
                                  />
                                </div>
                              )}
                            </div>
                          ) : isLoading ? (
                            <div className="px-3 py-4 text-center">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto"></div>
                              <p className="text-xs text-gray-500 mt-2">Cargando valores...</p>
                            </div>
                          ) : (
                            <div className="max-h-60 overflow-y-auto">
                              {/* Todos option */}
                              <button
                                onClick={() => {
                                  updateElement(filter.id, { currentValue: '' })
                                  setOpenDashboardFilter(null)
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                                  !filter.currentValue
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                <span>Todos</span>
                                {!filter.currentValue && (
                                  <span className="text-blue-500">✓</span>
                                )}
                              </button>

                              {values.map((value, idx) => {
                                const isSelected = filter.currentValue === value
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      updateElement(filter.id, { currentValue: value })
                                      setOpenDashboardFilter(null)
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                                      isSelected
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                  >
                                    <span className="truncate">{value}</span>
                                    {isSelected && (
                                      <span className="text-blue-500 flex-shrink-0">✓</span>
                                    )}
                                  </button>
                                )
                              })}

                              {values.length === 0 && (
                                <p className="px-3 py-2 text-sm text-gray-400 italic">
                                  Sin valores disponibles
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            ))}
            {isEditMode && (
              <button
                onClick={openFilterModal}
                className="flex items-center gap-1 px-2 py-1 text-sm text-primary-blue hover:bg-blue-50 rounded transition-colors self-end"
              >
                <PlusIcon className="h-4 w-4" />
                Agregar filtro
              </button>
            )}
          </div>
        </div>
      )}

      {/* Canvas Area with Grid */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-auto relative"
        onClick={handleCanvasClick}
        style={{ cursor: draggingElement ? 'grabbing' : 'default' }}
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        ) : dashboardConfig.elements.filter(el => el.type !== 'filter').length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <ChartBarIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Dashboard vacio</p>
              <p className="text-sm mt-1">Usa el boton "Agregar" para agregar elementos</p>
            </div>
          </div>
        ) : (
          <>
            {/* Canvas container with absolute positioning */}
            <div
              className={`relative ${isEditMode ? 'border-2 border-dashed border-gray-300 bg-white shadow-sm' : ''}`}
              style={{ width: `${CANVAS_WIDTH}px`, minHeight: '1500px' }}
            >
              {dashboardConfig.elements.filter(el => el.type !== 'filter').map((element) => {
                const isSelected = selectedElement === element.id

                // Options menu component
                const OptionsMenu = ({ elementId, canEdit = false, showTitleToggle = false }: { elementId: string; canEdit?: boolean; showTitleToggle?: boolean }) => {
                  // Find the element to check its current showTitle state
                  const menuElement = dashboardConfig.elements.find(el => el.id === elementId)
                  const isVizElement = menuElement?.type === 'visualization'
                  const vizElement = isVizElement ? menuElement as VisualizationElement : null
                  const showTitle = vizElement?.showTitle ?? false
                  const currentAlign = vizElement?.titleAlign || 'left'

                  return (
                    <div className="absolute top-2 right-2 z-30" ref={openOptionsMenu === elementId ? optionsMenuRef : undefined}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          setOpenOptionsMenu(openOptionsMenu === elementId ? null : elementId)
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="p-1.5 bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-700 rounded shadow-sm border border-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <EllipsisVerticalIcon className="h-4 w-4" />
                      </button>
                      {openOptionsMenu === elementId && (
                        <div className="absolute right-0 mt-1 w-48 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 py-1 z-50">
                          {canEdit && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditVisualization(elementId)
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <PencilIcon className="h-4 w-4 mr-2 text-gray-400" />
                              Editar visualizacion
                            </button>
                          )}
                          {showTitleToggle && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleElementTitle(elementId)
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                {showTitle ? (
                                  <>
                                    <EyeSlashIcon className="h-4 w-4 mr-2 text-gray-400" />
                                    Ocultar titulo
                                  </>
                                ) : (
                                  <>
                                    <EyeIcon className="h-4 w-4 mr-2 text-gray-400" />
                                    Mostrar titulo
                                  </>
                                )}
                              </button>
                              {/* Title alignment options */}
                              {showTitle && (
                                <div className="px-3 py-2 border-t border-gray-100">
                                  <span className="text-xs text-gray-500 block mb-1.5">Alinear titulo</span>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setTitleAlign(elementId, 'left')
                                      }}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      className={`flex-1 p-1.5 rounded text-xs ${currentAlign === 'left' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
                                      title="Izquierda"
                                    >
                                      <Bars3BottomLeftIcon className="h-4 w-4 mx-auto" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setTitleAlign(elementId, 'center')
                                      }}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      className={`flex-1 p-1.5 rounded text-xs ${currentAlign === 'center' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
                                      title="Centrado"
                                    >
                                      <Bars3Icon className="h-4 w-4 mx-auto" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setTitleAlign(elementId, 'right')
                                      }}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      className={`flex-1 p-1.5 rounded text-xs ${currentAlign === 'right' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
                                      title="Derecha"
                                    >
                                      <Bars3BottomRightIcon className="h-4 w-4 mx-auto" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              duplicateElement(elementId)
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <DocumentDuplicateIcon className="h-4 w-4 mr-2 text-gray-400" />
                            Duplicar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              removeElement(elementId)
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <TrashIcon className="h-4 w-4 mr-2" />
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  )
                }

                // Border resize zones (invisible but interactive)
                const ResizeBorders = ({ elementId }: { elementId: string }) => {
                  const borderSize = 8 // px - zona de resize en los bordes
                  return (
                    <>
                      {/* Top border */}
                      <div
                        data-resize="true"
                        className="absolute top-0 left-2 right-2 cursor-n-resize z-10"
                        style={{ height: borderSize }}
                        onMouseDown={(e) => handleResizeStart(e, elementId, 'n')}
                      />
                      {/* Bottom border */}
                      <div
                        data-resize="true"
                        className="absolute bottom-0 left-2 right-2 cursor-s-resize z-10"
                        style={{ height: borderSize }}
                        onMouseDown={(e) => handleResizeStart(e, elementId, 's')}
                      />
                      {/* Left border */}
                      <div
                        data-resize="true"
                        className="absolute left-0 top-2 bottom-2 cursor-w-resize z-10"
                        style={{ width: borderSize }}
                        onMouseDown={(e) => handleResizeStart(e, elementId, 'w')}
                      />
                      {/* Right border */}
                      <div
                        data-resize="true"
                        className="absolute right-0 top-2 bottom-2 cursor-e-resize z-10"
                        style={{ width: borderSize }}
                        onMouseDown={(e) => handleResizeStart(e, elementId, 'e')}
                      />
                      {/* Corners */}
                      <div
                        data-resize="true"
                        className="absolute top-0 left-0 cursor-nw-resize z-10"
                        style={{ width: borderSize * 2, height: borderSize * 2 }}
                        onMouseDown={(e) => handleResizeStart(e, elementId, 'nw')}
                      />
                      <div
                        data-resize="true"
                        className="absolute top-0 right-0 cursor-ne-resize z-10"
                        style={{ width: borderSize * 2, height: borderSize * 2 }}
                        onMouseDown={(e) => handleResizeStart(e, elementId, 'ne')}
                      />
                      <div
                        data-resize="true"
                        className="absolute bottom-0 left-0 cursor-sw-resize z-10"
                        style={{ width: borderSize * 2, height: borderSize * 2 }}
                        onMouseDown={(e) => handleResizeStart(e, elementId, 'sw')}
                      />
                      <div
                        data-resize="true"
                        className="absolute bottom-0 right-0 cursor-se-resize z-10"
                        style={{ width: borderSize * 2, height: borderSize * 2 }}
                        onMouseDown={(e) => handleResizeStart(e, elementId, 'se')}
                      />
                    </>
                  )
                }

                // Common element wrapper
                const isBeingDragged = draggingElement === element.id
                const ElementWrapper = ({ children, canEdit = false, showTitleToggle = false }: { children: React.ReactNode; canEdit?: boolean; showTitleToggle?: boolean }) => (
                  <div
                    className={`absolute group ${isBeingDragged ? 'pointer-events-none' : ''}`}
                    style={{
                      left: element.position.x,
                      top: element.position.y,
                      width: element.position.width,
                      height: element.position.height,
                      zIndex: isBeingDragged ? 1000 : 1,
                    }}
                    onClick={(e) => {
                      if (!isEditMode) return // Disable selection in view mode
                      e.stopPropagation()
                      setSelectedElement(element.id)
                    }}
                  >
                    {children}
                    {/* Only show edit controls in edit mode and not while dragging */}
                    {isEditMode && !draggingElement && (
                      <>
                        {/* Drag handle - top left corner */}
                        <div
                          className="absolute -top-3 -left-3 z-40 w-6 h-6 bg-white border border-gray-300 rounded shadow-sm flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50 hover:border-gray-400"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            handleDragStart(e, element.id)
                          }}
                          title="Arrastrar"
                        >
                          <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="5" cy="5" r="2" />
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="19" cy="5" r="2" />
                            <circle cx="5" cy="12" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="19" cy="12" r="2" />
                            <circle cx="5" cy="19" r="2" />
                            <circle cx="12" cy="19" r="2" />
                            <circle cx="19" cy="19" r="2" />
                          </svg>
                        </div>
                        <OptionsMenu elementId={element.id} canEdit={canEdit} showTitleToggle={showTitleToggle} />
                        <ResizeBorders elementId={element.id} />
                        {/* Size indicator when selected */}
                        {isSelected && (
                          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-500 bg-white px-2 py-0.5 rounded shadow-sm border whitespace-nowrap z-30">
                            {element.position.width} × {element.position.height}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )

                // Visualization element with runtime data
                if (element.type === 'visualization') {
                  const vizElement = element as VisualizationElement & { _runtimeData?: DashboardVizData }
                  const vizData = vizElement._runtimeData
                  const isEditingTitle = editingTitleId === element.id
                  const displayTitle = vizElement.title || vizData?.datasetLabel || 'Visualizacion'
                  const titleAlign = vizElement.titleAlign || 'left'
                  const titleAlignClass = titleAlign === 'center' ? 'justify-center' : titleAlign === 'right' ? 'justify-end' : 'justify-start'

                  return (
                    <ElementWrapper key={element.id} canEdit={true} showTitleToggle={true}>
                      <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden h-full flex flex-col">
                        {/* Card header */}
                        {vizElement.showTitle && (
                          <div className={`px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center ${titleAlignClass}`}>
                            {isEditingTitle ? (
                              <input
                                type="text"
                                value={editingTitleValue}
                                onChange={(e) => setEditingTitleValue(e.target.value)}
                                onBlur={() => saveTitle(element.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveTitle(element.id)
                                  if (e.key === 'Escape') cancelTitleEdit()
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="text-sm font-medium text-gray-700 bg-white border border-blue-500 rounded px-2 py-0.5 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                              />
                            ) : (
                              <h3
                                className={`text-sm font-medium text-gray-700 truncate px-1 py-0.5 rounded ${isEditMode ? 'cursor-text hover:bg-gray-100' : ''}`}
                                onClick={(e) => {
                                  if (!isEditMode) return
                                  e.stopPropagation()
                                  startEditingTitle(element.id, displayTitle)
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                {displayTitle}
                              </h3>
                            )}
                          </div>
                        )}
                        {/* Chart area - always centered */}
                        {(() => {
                          const isSingleOrProgress = vizData?.vizType === 'single' || vizData?.vizType === 'progress'
                          const paddingClass = isSingleOrProgress
                            ? 'p-4' // Symmetric padding for single/progress
                            : `pl-2 pr-10 pb-4 ${vizElement.showTitle ? 'pt-2' : 'pt-8'}` // Asymmetric for charts
                          return (
                            <div className={`font-montserrat flex-1 min-h-0 ${paddingClass}`}>
                              <div className="w-full h-full flex items-center justify-center">
                                {vizData ? renderChart(vizData) : (
                                  <div className="flex items-center justify-center text-gray-400 text-sm">
                                    <ChartBarIcon className="h-8 w-8 opacity-50" />
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    </ElementWrapper>
                  )
                }

                // Text element
                if (element.type === 'text') {
                  const textElement = element as TextElement
                  return (
                    <ElementWrapper key={element.id}>
                      <div
                        className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full overflow-auto"
                        style={{
                          fontSize: textElement.style?.fontSize,
                          fontWeight: textElement.style?.fontWeight,
                          textAlign: textElement.style?.textAlign,
                          color: textElement.style?.color,
                          backgroundColor: textElement.style?.backgroundColor || 'white',
                        }}
                      >
                        {textElement.content}
                      </div>
                    </ElementWrapper>
                  )
                }

                // Other element types (placeholder)
                const Icon = getWidgetIcon(element.type as WidgetType)
                return (
                  <ElementWrapper key={element.id}>
                    <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-center h-full">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Icon className="h-5 w-5" />
                        <span className="text-sm font-medium">{getWidgetLabel(element.type as WidgetType)}</span>
                      </div>
                    </div>
                  </ElementWrapper>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Save Dashboard Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowSaveModal(false)}
            />

            {/* Modal */}
            <div className="relative inline-block w-full max-w-md p-6 my-8 text-left align-middle bg-white rounded-lg shadow-xl transform transition-all">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BookmarkIcon className="h-5 w-5 text-primary-blue" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    {dashboardId ? 'Guardar Dashboard' : 'Crear Dashboard'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Error message */}
              {saveError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  {saveError}
                </div>
              )}

              {/* Form */}
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Ej: Dashboard de Ventas"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-blue focus:border-primary-blue text-sm bg-white"
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripcion
                  </label>
                  <textarea
                    value={saveDescription}
                    onChange={(e) => setSaveDescription(e.target.value)}
                    placeholder="Descripcion opcional..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-blue focus:border-primary-blue text-sm bg-white"
                  />
                </div>

                {/* Folder Explorer */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Ubicacion
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
                      onClick={() => !showNewFolderInput && setSaveFolderId(null)}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                        saveFolderId === null && !showNewFolderInput
                          ? 'bg-blue-50 text-blue-700'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <FolderIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">/ (Raiz)</span>
                    </div>

                    {/* New folder input at root level */}
                    {showNewFolderInput && saveFolderId === null && (
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
                                setSaveError('Error: No hay tenant o usuario activo')
                                return
                              }
                              try {
                                const folderId = await createDashboardFolder(currentTenant.id, currentUser.uid, {
                                  name: newFolderName.trim(),
                                  parentId: null
                                })
                                const updatedFolders = await listDashboardFolders(currentTenant.id)
                                setFolders(updatedFolders)
                                setSaveFolderId(folderId)
                                setExpandedFolders(prev => new Set(prev))
                                setNewFolderName('')
                                setShowNewFolderInput(false)
                              } catch (err) {
                                console.error('Error creating folder:', err)
                                setSaveError(`Error al crear carpeta: ${err instanceof Error ? err.message : 'Error desconocido'}`)
                              }
                            } else if (e.key === 'Escape') {
                              setNewFolderName('')
                              setShowNewFolderInput(false)
                            }
                          }}
                          onBlur={async () => {
                            if (newFolderName.trim() && currentTenant?.id && currentUser?.uid) {
                              try {
                                const folderId = await createDashboardFolder(currentTenant.id, currentUser.uid, {
                                  name: newFolderName.trim(),
                                  parentId: null
                                })
                                const updatedFolders = await listDashboardFolders(currentTenant.id)
                                setFolders(updatedFolders)
                                setSaveFolderId(folderId)
                              } catch (err) {
                                console.error('Error creating folder:', err)
                                setSaveError(`Error al crear carpeta: ${err instanceof Error ? err.message : 'Error desconocido'}`)
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
                                onClick={() => !showNewFolderInput && setSaveFolderId(folder.id)}
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
                                  saveFolderId === folder.id && !showNewFolderInput
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                {hasChildren ? (
                                  <ChevronRightIcon className={`h-3 w-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                ) : (
                                  <span className="w-3" />
                                )}
                                <FolderIcon className={`h-4 w-4 ${saveFolderId === folder.id ? 'text-blue-500' : 'text-yellow-500'}`} />
                                <span className="text-sm">{folder.name}</span>
                              </div>

                              {/* New folder input inside this folder */}
                              {showNewFolderInput && saveFolderId === folder.id && (
                                <div className="flex items-center gap-2 pl-10 pr-3 py-1.5 bg-blue-50">
                                  <FolderIcon className="h-4 w-4 text-blue-500" />
                                  <input
                                    type="text"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    onKeyDown={async (e) => {
                                      if (e.key === 'Enter' && newFolderName.trim()) {
                                        e.preventDefault()
                                        if (!currentTenant?.id || !currentUser?.uid) {
                                          setSaveError('Error: No hay tenant o usuario activo')
                                          return
                                        }
                                        try {
                                          const newFolderId = await createDashboardFolder(currentTenant.id, currentUser.uid, {
                                            name: newFolderName.trim(),
                                            parentId: folder.id
                                          })
                                          const updatedFolders = await listDashboardFolders(currentTenant.id)
                                          setFolders(updatedFolders)
                                          setSaveFolderId(newFolderId)
                                          setExpandedFolders(prev => new Set([...prev, folder.id]))
                                          setNewFolderName('')
                                          setShowNewFolderInput(false)
                                        } catch (err) {
                                          console.error('Error creating folder:', err)
                                          setSaveError(`Error al crear carpeta: ${err instanceof Error ? err.message : 'Error desconocido'}`)
                                        }
                                      } else if (e.key === 'Escape') {
                                        setNewFolderName('')
                                        setShowNewFolderInput(false)
                                      }
                                    }}
                                    onBlur={async () => {
                                      if (newFolderName.trim() && currentTenant?.id && currentUser?.uid) {
                                        try {
                                          const newFolderId = await createDashboardFolder(currentTenant.id, currentUser.uid, {
                                            name: newFolderName.trim(),
                                            parentId: folder.id
                                          })
                                          const updatedFolders = await listDashboardFolders(currentTenant.id)
                                          setFolders(updatedFolders)
                                          setSaveFolderId(newFolderId)
                                          setExpandedFolders(prev => new Set([...prev, folder.id]))
                                        } catch (err) {
                                          console.error('Error creating folder:', err)
                                          setSaveError(`Error al crear carpeta: ${err instanceof Error ? err.message : 'Error desconocido'}`)
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

                              {/* Render children if expanded */}
                              {isExpanded && hasChildren && (
                                <div className="pl-4">
                                  {folders
                                    .filter(f => f.parentId === folder.id)
                                    .map((childFolder) => (
                                      <div
                                        key={childFolder.id}
                                        onClick={() => !showNewFolderInput && setSaveFolderId(childFolder.id)}
                                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                                          saveFolderId === childFolder.id && !showNewFolderInput
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'hover:bg-gray-50 text-gray-700'
                                        }`}
                                      >
                                        <span className="w-3" />
                                        <FolderIcon className={`h-4 w-4 ${saveFolderId === childFolder.id ? 'text-blue-500' : 'text-yellow-500'}`} />
                                        <span className="text-sm">{childFolder.name}</span>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          )
                        })
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowSaveModal(false)
                    setSaveError(null)
                  }}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !saveName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-blue rounded-md hover:bg-primary-blue/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      {dashboardId ? 'Actualizar' : 'Crear'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visualization Modal - Full screen with DatasetsNew embedded */}
      {showVizModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col overflow-hidden">
            {/* Modal Header with Dataset Selector */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
              <div className="flex items-center gap-4">
                {/* Edit indicator */}
                {editingElementId && (
                  <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                    Editando visualizacion
                  </span>
                )}
                {/* Dataset Selector */}
                <div className="relative" ref={datasetDropdownRef}>
                  <button
                    onClick={() => setShowDatasetDropdown(!showDatasetDropdown)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors min-w-[220px]"
                  >
                    <TableCellsIcon className="h-4 w-4 text-gray-400" />
                    <span className="flex-1 text-left truncate">
                      {selectedDatasetLabel || 'Seleccionar dataset'}
                    </span>
                    <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                  </button>
                  {showDatasetDropdown && (
                    <div className="absolute left-0 mt-2 w-72 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-[60] max-h-80 overflow-y-auto">
                      <div className="py-1">
                        {loadingDatasets ? (
                          <div className="px-4 py-3 text-sm text-gray-500">Cargando datasets...</div>
                        ) : datasets.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500">No hay datasets disponibles</div>
                        ) : (
                          // Group datasets by group
                          (() => {
                            const grouped = datasets.reduce((acc, dataset) => {
                              const group = dataset.group || 'General'
                              if (!acc[group]) acc[group] = []
                              acc[group].push(dataset)
                              return acc
                            }, {} as Record<string, DatasetOption[]>)

                            return Object.entries(grouped).map(([groupName, groupDatasets]) => (
                              <div key={groupName}>
                                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                                  {groupName}
                                </div>
                                {groupDatasets.map((dataset) => (
                                  <button
                                    key={dataset.id}
                                    onClick={() => {
                                      if (selectedDataset !== dataset.id) {
                                        setLoadingVizBuilder(true)
                                        setCurrentVizData(null)
                                      }
                                      setSelectedDataset(dataset.id)
                                      setShowDatasetDropdown(false)
                                    }}
                                    className={`w-full flex items-center px-4 py-2.5 text-sm hover:bg-gray-100 ${
                                      selectedDataset === dataset.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                                    }`}
                                  >
                                    <TableCellsIcon className="h-4 w-4 mr-3 text-gray-400 flex-shrink-0" />
                                    <span className="truncate">{dataset.label}</span>
                                  </button>
                                ))}
                              </div>
                            ))
                          })()
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Show current viz info */}
                {currentVizData && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
                    <ChartBarIcon className="h-4 w-4" />
                    <span>Visualizacion lista</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowVizModal(false)
                    setSelectedDataset('')
                    setCurrentVizData(null)
                    setEditingElementId(null)
                    setEditingVizConfig(undefined)
                  }}
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={addVisualizationWidget}
                  disabled={!currentVizData}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-blue rounded-lg hover:bg-primary-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingElementId ? 'Actualizar' : 'Agregar al dashboard'}
                </button>
                <button
                  onClick={() => {
                    setShowVizModal(false)
                    setSelectedDataset('')
                    setCurrentVizData(null)
                    setEditingElementId(null)
                    setEditingVizConfig(undefined)
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors ml-2"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - DatasetsNew embedded */}
            <div className="flex-1 overflow-hidden relative">
              {!selectedDataset ? (
                <div className="flex items-center justify-center h-full text-gray-400 bg-gray-50">
                  <div className="text-center">
                    <TableCellsIcon className="h-20 w-20 mx-auto mb-4 opacity-50" />
                    <p className="text-xl font-medium">Selecciona un dataset</p>
                    <p className="text-sm mt-2">Elige un dataset del desplegable superior para comenzar a crear tu visualizacion</p>
                  </div>
                </div>
              ) : (
                <>
                  {loadingVizBuilder && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-50">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue mx-auto mb-4"></div>
                        <p className="text-gray-500">Cargando dataset...</p>
                      </div>
                    </div>
                  )}
                  <DatasetsNew
                    embedded={true}
                    initialDatasetId={selectedDataset}
                    initialVizConfig={editingVizConfig}
                    onAddToDashboard={setCurrentVizData}
                    vizTitle={vizTitle}
                    onVizTitleChange={setVizTitle}
                    onReady={() => setLoadingVizBuilder(false)}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowFilterModal(false)}
            />

            {/* Modal */}
            <div className="relative inline-block w-full max-w-2xl p-6 my-8 text-left align-middle bg-white rounded-lg shadow-xl transform transition-all">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FunnelIcon className="h-5 w-5 text-primary-blue" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingFilterId ? 'Editar Filtro' : 'Agregar Filtro'}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowFilterModal(false)
                    setEditingFilterId(null)
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Dataset & Field Selection Dropdown */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar campo
                </label>
                {getDashboardDatasets().length === 0 ? (
                  <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg text-center">
                    No hay visualizaciones con datos en el dashboard.
                    <br />
                    Agrega visualizaciones primero.
                  </div>
                ) : (
                  <div className="relative" ref={filterDropdownRef}>
                    {/* Dropdown trigger */}
                    <button
                      onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                      className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {filterSelectedField ? (
                        <div className="flex items-center gap-2 text-left">
                          <TableCellsIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          <div className="truncate">
                            <span className="text-sm text-gray-500">{filterSelectedDatasetLabel}</span>
                            <span className="text-gray-400 mx-1">/</span>
                            <span className="text-sm font-medium text-gray-700">{filterSelectedFieldLabel}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Seleccionar dataset y campo...</span>
                      )}
                      <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown content */}
                    {showFilterDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {loadingFilterAttributes ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                            <span className="ml-2 text-sm text-gray-500">Cargando campos...</span>
                          </div>
                        ) : (
                          getDashboardDatasets().map((dataset) => {
                            const isExpanded = expandedFilterDatasets.has(dataset.id)
                            const attributes = filterDatasetAttributes.get(dataset.id) || []
                            return (
                              <div key={dataset.id} className="border-b border-gray-200 last:border-b-0">
                                {/* Dataset header */}
                                <button
                                  onClick={() => {
                                    setExpandedFilterDatasets(prev => {
                                      const next = new Set(prev)
                                      if (next.has(dataset.id)) {
                                        next.delete(dataset.id)
                                      } else {
                                        next.add(dataset.id)
                                      }
                                      return next
                                    })
                                  }}
                                  className="w-full flex items-center px-3 py-2 text-left hover:bg-gray-50"
                                >
                                  {isExpanded ? (
                                    <ChevronDownIcon className="h-4 w-4 text-gray-400 mr-2" />
                                  ) : (
                                    <ChevronRightIcon className="h-4 w-4 text-gray-400 mr-2" />
                                  )}
                                  <TableCellsIcon className="h-4 w-4 text-blue-500 mr-2" />
                                  <span className="text-sm font-medium text-gray-700">{dataset.label}</span>
                                  <span className="ml-auto text-xs text-gray-400">{attributes.length} campos</span>
                                </button>

                                {/* Attributes */}
                                {isExpanded && (
                                  <div className="bg-gray-50 py-1">
                                    {attributes.length === 0 ? (
                                      <div className="px-6 py-2 text-sm text-gray-400">Sin campos disponibles</div>
                                    ) : (
                                      attributes.map((attr) => {
                                        const isSelected = filterSelectedDataset === dataset.id && filterSelectedField === attr.fieldId && !filterSelectedTimeframe
                                        const isDateField = attr.type === 'date'
                                        const dateAttrKey = `${dataset.id}:${attr.fieldId}`
                                        const isDateExpanded = expandedDateAttributes.has(dateAttrKey)

                                        // For date fields, show expandable with timeframe options
                                        if (isDateField) {
                                          return (
                                            <div key={attr.fieldId}>
                                              {/* Date field header - expandable */}
                                              <button
                                                onClick={() => {
                                                  setExpandedDateAttributes(prev => {
                                                    const next = new Set(prev)
                                                    if (next.has(dateAttrKey)) {
                                                      next.delete(dateAttrKey)
                                                    } else {
                                                      next.add(dateAttrKey)
                                                    }
                                                    return next
                                                  })
                                                }}
                                                className={`w-full flex items-center px-6 py-1.5 text-left text-sm ${
                                                  isSelected || (filterSelectedDataset === dataset.id && filterSelectedField === attr.fieldId)
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'text-gray-600 hover:bg-gray-100'
                                                }`}
                                              >
                                                {isDateExpanded ? (
                                                  <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400 mr-1.5 flex-shrink-0" />
                                                ) : (
                                                  <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400 mr-1.5 flex-shrink-0" />
                                                )}
                                                <CalendarDaysIcon className="h-3.5 w-3.5 text-orange-500 mr-1.5 flex-shrink-0" />
                                                <span className="truncate">{attr.label}</span>
                                                <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0">
                                                  {DATE_TRANSFORM_OPTIONS.length}
                                                </span>
                                              </button>

                                              {/* Date transformation options */}
                                              {isDateExpanded && (
                                                <div className="bg-white border-l-2 border-orange-200 ml-6">
                                                  {DATE_TRANSFORM_OPTIONS.map((tf) => {
                                                    const transformFieldId = `${attr.fieldId}_${tf.id}`
                                                    const isTfSelected = filterSelectedDataset === dataset.id &&
                                                                        filterSelectedField === transformFieldId
                                                    return (
                                                      <button
                                                        key={tf.id}
                                                        onClick={() => selectDateTransform(dataset.id, dataset.label, attr.fieldId, attr.label, tf)}
                                                        className={`w-full flex items-center px-4 py-1.5 text-left text-sm ${
                                                          isTfSelected
                                                            ? 'bg-orange-100 text-orange-700'
                                                            : 'text-gray-600 hover:bg-orange-50'
                                                        }`}
                                                      >
                                                        <ChevronRightIcon className="h-3 w-3 text-gray-300 mr-1 flex-shrink-0" />
                                                        <span className="truncate">{tf.label}</span>
                                                        {isTfSelected && (
                                                          <span className="ml-auto text-orange-500">✓</span>
                                                        )}
                                                      </button>
                                                    )
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          )
                                        }

                                        // Non-date fields - regular selection
                                        return (
                                          <button
                                            key={attr.fieldId}
                                            onClick={() => selectFilterField(dataset.id, dataset.label, attr.fieldId, attr.label, attr.type)}
                                            className={`w-full flex items-center px-6 py-1.5 text-left text-sm ${
                                              isSelected
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                          >
                                            <span className="truncate">{attr.label}</span>
                                            {isSelected && (
                                              <span className="ml-auto text-blue-500">✓</span>
                                            )}
                                          </button>
                                        )
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tabs - Only show after selecting a field */}
              {filterSelectedField && (
                <>
                  <div className="border-b border-gray-200 mb-4">
                    <div className="flex gap-6">
                      <button
                        onClick={() => setFilterModalTab('config')}
                        className={`pb-3 text-sm font-light transition-colors relative ${
                          filterModalTab === 'config'
                            ? 'text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Configuración
                        {filterModalTab === 'config' && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                        )}
                      </button>
                      <button
                        onClick={() => setFilterModalTab('apply')}
                        className={`pb-3 text-sm font-light transition-colors relative ${
                          filterModalTab === 'apply'
                            ? 'text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Aplicar a
                        {filterModalTab === 'apply' && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Tab Content */}
                  <div className="min-h-[200px]">
                    {/* Configuración Tab */}
                    {filterModalTab === 'config' && (
                  <div className="space-y-4">
                    {/* Filter Title */}
                    <div>
                      <label className="block text-xs font-light text-gray-500 mb-1">
                        Título
                      </label>
                      <input
                        type="text"
                        value={filterLabel}
                        onChange={(e) => setFilterLabel(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nombre que se mostrará en el filtro"
                      />
                    </div>

                    {/* Filter Display Type */}
                    <div>
                      <label className="block text-xs font-light text-gray-500 mb-2">
                        Tipo
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setFilterDisplayType('dropdown')}
                          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                            filterDisplayType === 'dropdown'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <ChevronDownIcon className="h-4 w-4" />
                          Desplegable
                        </button>
                        <button
                          onClick={() => setFilterDisplayType('button')}
                          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                            filterDisplayType === 'button'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <CursorArrowRaysIcon className="h-4 w-4" />
                          Botón
                        </button>
                        <button
                          onClick={() => setFilterDisplayType('option')}
                          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                            filterDisplayType === 'option'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <Bars3Icon className="h-4 w-4" />
                          Opciones
                        </button>
                      </div>
                    </div>

                    {/* Default Value */}
                    <div>
                      <label className="block text-xs font-light text-gray-500 mb-2">
                        Valor por defecto
                      </label>
                      <p className="text-[11px] text-gray-400 mb-2">
                        Este valor se aplicará automáticamente al cargar el dashboard
                      </p>
                      {filterType === 'date' || filterSelectedTimeframe ? (
                        // Date filter - show date options like the dashboard filter dropdown
                        <div className="relative">
                          <select
                            value={typeof filterDefaultValue === 'string' ? filterDefaultValue : ''}
                            onChange={(e) => setFilterDefaultValue(e.target.value || null)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="">Sin valor por defecto</option>
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
                          </select>
                        </div>
                      ) : (
                        // Non-date filter - show text input for default value
                        <input
                          type="text"
                          value={filterDefaultValue ? String(filterDefaultValue) : ''}
                          onChange={(e) => setFilterDefaultValue(e.target.value || null)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Dejar vacío para sin valor por defecto"
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Aplicar a Tab - Two columns layout */}
                {filterModalTab === 'apply' && (
                  <div>
                    {getAllVisualizations().length === 0 ? (
                      <p className="text-sm text-gray-400 italic text-center py-8">
                        No hay visualizaciones en el dashboard
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {/* Header row */}
                        <div className="flex items-center gap-4 px-2 py-2">
                          <div className="flex-1 text-[11px] font-medium text-gray-500 uppercase">Visualización</div>
                          <div className="w-64 text-[11px] font-medium text-gray-500 uppercase">Campo</div>
                        </div>
                        {/* Visualization rows */}
                        <div className="space-y-2">
                          {getAllVisualizations().map((viz) => {
                            const vizTitle = viz.title || viz._runtimeData?.datasetLabel || 'Visualización sin título'
                            const vizDatasetId = getVizDatasetId(viz)
                            const vizDatasetLabel = viz._runtimeData?.datasetLabel || vizDatasetId || 'Dataset'
                            const attributes = vizDatasetId ? filterDatasetAttributes.get(vizDatasetId) || [] : []

                            // Get current selection, or auto-select if same dataset as filter
                            const currentMapping = filterVizFieldMapping.get(viz.id)
                            const isSameDataset = vizDatasetId === filterSelectedDataset
                            const hasMatchingField = isSameDataset && attributes.some(a => a.fieldId === filterSelectedField)

                            // Auto-select: if same dataset and field exists, use filterSelectedField as default
                            const selectedFieldForViz = currentMapping !== undefined
                              ? currentMapping
                              : (hasMatchingField ? filterSelectedField : '')

                            const selectedFieldLabel = attributes.find(a => a.fieldId === selectedFieldForViz)?.label || ''
                            const isDropdownOpen = openVizFieldDropdown === viz.id

                            return (
                              <div key={viz.id} className="flex items-center gap-4 px-2">
                                {/* Left column - Visualization name */}
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <ChartBarIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                  <span className="text-xs text-gray-700 truncate">{vizTitle}</span>
                                </div>

                                {/* Right column - Field dropdown */}
                                <div className="w-64 relative">
                                  <button
                                    onClick={() => setOpenVizFieldDropdown(isDropdownOpen ? null : viz.id)}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors text-left"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <TableCellsIcon className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                                      <span className="text-xs text-gray-700 truncate">
                                        {selectedFieldLabel || 'No aplicar'}
                                      </span>
                                    </div>
                                    <ChevronDownIcon className={`h-3.5 w-3.5 text-gray-400 flex-shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                  </button>

                                  {/* Dropdown menu */}
                                  {isDropdownOpen && (
                                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                                      {/* Dataset header */}
                                      <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 border-b border-gray-100">
                                        <div className="flex items-center gap-1.5">
                                          <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400" />
                                          <TableCellsIcon className="h-3.5 w-3.5 text-blue-500" />
                                          <span className="text-xs font-medium text-gray-700 truncate">{vizDatasetLabel}</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 flex-shrink-0">{attributes.length} campos</span>
                                      </div>

                                      {/* Attributes list */}
                                      <div className="max-h-48 overflow-y-auto">
                                        {/* No aplicar option */}
                                        <button
                                          onClick={() => {
                                            setFilterVizFieldMapping(prev => {
                                              const next = new Map(prev)
                                              next.set(viz.id, '') // Explicitly set to empty string
                                              return next
                                            })
                                            setOpenVizFieldDropdown(null)
                                          }}
                                          className={`w-full flex items-center justify-between px-5 py-1.5 text-left text-xs transition-colors ${
                                            !selectedFieldForViz
                                              ? 'bg-blue-50 text-blue-700'
                                              : 'text-gray-600 hover:bg-gray-50'
                                          }`}
                                        >
                                          <span>No aplicar</span>
                                          {!selectedFieldForViz && (
                                            <span className="text-blue-500 text-xs">✓</span>
                                          )}
                                        </button>

                                        {attributes.map((attr) => {
                                          const isSelected = selectedFieldForViz === attr.fieldId
                                          return (
                                            <button
                                              key={attr.fieldId}
                                              onClick={() => {
                                                setFilterVizFieldMapping(prev => {
                                                  const next = new Map(prev)
                                                  next.set(viz.id, attr.fieldId)
                                                  return next
                                                })
                                                setOpenVizFieldDropdown(null)
                                              }}
                                              className={`w-full flex items-center justify-between px-5 py-1.5 text-left text-xs transition-colors ${
                                                isSelected
                                                  ? 'bg-blue-50 text-blue-700'
                                                  : 'text-gray-600 hover:bg-gray-50'
                                              }`}
                                            >
                                              <span>{attr.label}</span>
                                              {isSelected && (
                                                <span className="text-blue-500 text-xs">✓</span>
                                              )}
                                            </button>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                  </div>
                </>
              )}

              {/* Footer */}
              <div className={`mt-6 flex gap-3 ${editingFilterId ? 'justify-between' : 'justify-end'}`}>
                {editingFilterId ? (
                  <>
                    {/* Delete button on the left when editing */}
                    <button
                      onClick={() => {
                        removeFilter(editingFilterId)
                        setShowFilterModal(false)
                        setEditingFilterId(null)
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                    >
                      Eliminar
                    </button>
                    {/* Save button on the right when editing */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowFilterModal(false)
                          setEditingFilterId(null)
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={updateFilter}
                        disabled={!filterSelectedField}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary-blue rounded-lg hover:bg-primary-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Guardar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowFilterModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={addFilter}
                      disabled={!filterSelectedField}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary-blue rounded-lg hover:bg-primary-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Agregar Filtro
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

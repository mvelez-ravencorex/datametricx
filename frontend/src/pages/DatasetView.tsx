/**
 * Página de visualización de datasets
 */

import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import DatasetFieldsSidebar from '@/components/datasets/DatasetFieldsSidebar'
import { DataColumn, DataFilter, DataRow } from '@/types/dataset'
import { XMarkIcon, ChevronDownIcon, ChevronRightIcon, CodeBracketIcon, ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/contexts/AuthContext'
import { getDataset } from '@/datasets'
import { getAllFields } from '@/types/datasetSchema'
import { auth } from '@/config/firebase'

// URL base del backend - usa rutas relativas para proxy de Firebase Hosting/Vite
const API_BASE_URL = ''

export default function DatasetView() {
  const { datasetName } = useParams<{ datasetName: string }>()
  const { currentUser } = useAuth()
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [activeFilters, setActiveFilters] = useState<DataFilter[]>([])
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['filtros', 'datos', 'visualizacion'])
  )
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [resizingColumn, setResizingColumn] = useState<{ id: string; startX: number; startWidth: number } | null>(null)
  const [draggingColumn, setDraggingColumn] = useState<number | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [dataRows, setDataRows] = useState<DataRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [datosHeight, setDatosHeight] = useState(400) // altura de la sección Datos
  const [resizingDatos, setResizingDatos] = useState(false)
  const [showSqlModal, setShowSqlModal] = useState(false)
  const [sqlCopied, setSqlCopied] = useState(false)
  const [queriedColumns, setQueriedColumns] = useState<string[]>([]) // Columnas que se consultaron
  const [rowLimit, setRowLimit] = useState(500) // Límite de filas actual
  const [rowLimitInput, setRowLimitInput] = useState('500') // Input del límite
  const [showTotals, setShowTotals] = useState(false) // Mostrar fila de totales
  const [sortConfig, setSortConfig] = useState<Array<{ columnId: string; direction: 'asc' | 'desc' }>>([]) // Multi-level sorting

  // Limpiar estado cuando cambia el dataset
  useEffect(() => {
    setSelectedColumns([])
    setActiveFilters([])
    setDataRows([])
    setError(null)
    setQueriedColumns([])
    setSortConfig([])
    setShowTotals(false)
    setRowLimit(500)
    setRowLimitInput('500')
  }, [datasetName])

  // Cargar dataset schema desde JSON
  const datasetSchema = datasetName ? getDataset(datasetName) : undefined

  // Convertir dataset schema fields a DataColumns
  const columns: DataColumn[] = datasetSchema ? getAllFields(datasetSchema).map(field => {
    // Mapear field types a DataType
    let dataType: DataColumn['dataType'] = 'string'
    if (field.type === 'number' || field.field_type === 'measure') {
      dataType = 'number'
    } else if (field.type === 'yesno') {
      dataType = 'boolean'
    } else if (field.field_type === 'dimension_group') {
      // Date fields are dimension_groups
      dataType = 'date'
    }

    return {
      id: field.name,
      name: field.name,
      displayName: field.label,
      dataType,
      description: field.description,
      isMetric: field.field_type === 'measure',
      isDimension: field.field_type === 'dimension' || field.field_type === 'dimension_group',
      isCalculated: field.field_type === 'calculation',
      format: field.value_format,
      // Timeframe info for date fields
      timeframe: field.timeframe,
      sourceDatatype: field.source_datatype,
      baseFieldName: field.base_field_name
    }
  }) : []

  // Nombres para display
  const datasetLabel = datasetSchema?.label || datasetName
  const datasetDescription = datasetSchema?.description

  // Función para generar transformación SQL para campos de fecha según timeframe
  const getDateTransformSQL = (fieldName: string, timeframe?: string, _sourceDatatype?: string): string => {
    // Si no hay timeframe, devolver el campo tal cual
    if (!timeframe) return fieldName

    // El campo base en BigQuery (sin el sufijo de timeframe)
    const baseField = fieldName.replace(/_(?:raw|time|datetime|date|week|month|quarter|year|day_of_week|day_of_month|week_of_year|month_name)$/, '')

    switch (timeframe) {
      case 'raw':
        // Sin transformación - devolver timestamp original
        return baseField
      case 'time':
        // Solo hora en formato HH:MM AM/PM
        return `FORMAT_TIMESTAMP('%I:%M %p', ${baseField})`
      case 'datetime':
        // Fecha y hora completa
        return `FORMAT_TIMESTAMP('%Y-%m-%d %I:%M %p', ${baseField})`
      case 'date':
        // Extraer solo la fecha
        return `DATE(${baseField})`
      case 'week':
        // Inicio de la semana (lunes por defecto en BigQuery)
        return `DATE_TRUNC(DATE(${baseField}), WEEK(MONDAY))`
      case 'month':
        // Formato yyyy-mm
        return `FORMAT_DATE('%Y-%m', DATE(${baseField}))`
      case 'quarter':
        // Formato Q1, Q2, Q3, Q4
        return `CONCAT('Q', CAST(EXTRACT(QUARTER FROM ${baseField}) AS STRING))`
      case 'year':
        // Extraer el año
        return `EXTRACT(YEAR FROM ${baseField})`
      case 'day_of_week':
        // Día de la semana (nombre)
        return `FORMAT_DATE('%A', DATE(${baseField}))`
      case 'day_of_month':
        // Día del mes (1-31)
        return `EXTRACT(DAY FROM ${baseField})`
      case 'week_of_year':
        // Semana del año (1-53)
        return `EXTRACT(WEEK FROM ${baseField})`
      case 'month_name':
        // Nombre del mes
        return `FORMAT_DATE('%B', DATE(${baseField}))`
      default:
        return fieldName
    }
  }

  // Generar SQL basado en las columnas seleccionadas
  const generateSQL = (): string => {
    if (!datasetSchema || selectedColumns.length === 0) {
      return '-- Selecciona columnas para generar la consulta SQL'
    }

    const tableName = `\`${datasetSchema.source.project}.${datasetSchema.source.dataset}.${datasetSchema.source.table}\``

    // Separar dimensiones y métricas de las columnas seleccionadas
    const selectedDimensions = selectedColumns
      .map(id => columns.find(c => c.id === id))
      .filter((col): col is DataColumn => col !== undefined && col.isDimension === true)

    const selectedMetrics = selectedColumns
      .map(id => columns.find(c => c.id === id))
      .filter((col): col is DataColumn => col !== undefined && (col.isMetric === true || col.isCalculated === true))

    // Construir SELECT
    const selectParts: string[] = []

    // Función para convertir label a alias SQL válido
    const toSqlAlias = (label: string) => label
      .replace(/[^a-zA-Z0-9_]/g, '_')  // Reemplazar caracteres no válidos con _
      .replace(/_+/g, '_')              // Reemplazar múltiples _ con uno solo
      .replace(/^_|_$/g, '')            // Eliminar _ al inicio y al final
      .toLowerCase()

    // Agregar dimensiones con alias y transformaciones de fecha
    selectedDimensions.forEach(dim => {
      // Usar el nombre del campo como alias (ya es único y SQL-safe)
      const alias = dim.name.replace(/[^a-zA-Z0-9_]/g, '_')

      // Si es un campo de fecha (tiene timeframe), aplicar transformación
      if (dim.timeframe) {
        const sqlExpression = getDateTransformSQL(dim.name, dim.timeframe, dim.sourceDatatype)
        selectParts.push(`  ${sqlExpression} AS ${alias}`)
      } else {
        selectParts.push(`  ${dim.name} AS ${alias}`)
      }
    })

    // Agregar métricas con agregaciones y alias
    selectedMetrics.forEach(metric => {
      const alias = toSqlAlias(metric.displayName)
      // Buscar el campo original en el schema para obtener la agregación
      const schemaField = datasetSchema.measures?.find(m => m.name === metric.name)
        || datasetSchema.calculations?.find(c => c.name === metric.name)

      if (schemaField) {
        // Extraer el nombre de columna real del SQL (ej: "${TABLE}.daily_budget" -> "daily_budget")
        const getColumnFromSql = (sql: string) => {
          const match = sql.match(/\$\{TABLE\}\.(\w+)/)
          return match ? match[1] : metric.name
        }

        if ('type' in schemaField && schemaField.type === 'sum') {
          const columnName = 'sql' in schemaField ? getColumnFromSql(schemaField.sql) : metric.name
          selectParts.push(`  SUM(${columnName}) AS ${alias}`)
        } else if ('type' in schemaField && schemaField.type === 'count') {
          selectParts.push(`  COUNT(*) AS ${alias}`)
        } else if ('type' in schemaField && schemaField.type === 'average') {
          const columnName = 'sql' in schemaField ? getColumnFromSql(schemaField.sql) : metric.name
          selectParts.push(`  AVG(${columnName}) AS ${alias}`)
        } else if ('type' in schemaField && schemaField.type === 'min') {
          const columnName = 'sql' in schemaField ? getColumnFromSql(schemaField.sql) : metric.name
          selectParts.push(`  MIN(${columnName}) AS ${alias}`)
        } else if ('type' in schemaField && schemaField.type === 'max') {
          const columnName = 'sql' in schemaField ? getColumnFromSql(schemaField.sql) : metric.name
          selectParts.push(`  MAX(${columnName}) AS ${alias}`)
        } else if ('type' in schemaField && schemaField.type === 'count_distinct') {
          const columnName = 'sql' in schemaField ? getColumnFromSql(schemaField.sql) : metric.name
          selectParts.push(`  COUNT(DISTINCT ${columnName}) AS ${alias}`)
        } else if ('sql' in schemaField && schemaField.sql) {
          // Para calculations, usar la fórmula SQL
          const sqlFormula = schemaField.sql
            .replace(/\$\{TABLE\}/g, tableName.replace(/`/g, ''))
            .replace(/\$\{(\w+)\}/g, (_, fieldName) => {
              const refField = datasetSchema.measures?.find(m => m.name === fieldName)
              if (refField && refField.type === 'sum') {
                const refColumnName = 'sql' in refField ? getColumnFromSql(refField.sql) : fieldName
                return `SUM(${refColumnName})`
              }
              return fieldName
            })
          selectParts.push(`  ${sqlFormula} AS ${alias}`)
        } else {
          selectParts.push(`  SUM(${metric.name}) AS ${alias}`)
        }
      } else {
        selectParts.push(`  SUM(${metric.name}) AS ${alias}`)
      }
    })

    // Construir WHERE para filtros
    const whereParts: string[] = []

    activeFilters.forEach(filter => {
      const col = columns.find(c => c.id === filter.columnId)
      if (!col) return

      if (col.dataType === 'date' && filter.operator === 'is_in_the_last') {
        const days = parseInt(filter.value as string) || 7
        whereParts.push(`${col.name} >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)`)
      } else if (filter.operator === 'equals') {
        whereParts.push(`${col.name} = '${filter.value}'`)
      } else if (filter.operator === 'contains') {
        whereParts.push(`${col.name} LIKE '%${filter.value}%'`)
      } else if (filter.operator === 'greater_than') {
        whereParts.push(`${col.name} > ${filter.value}`)
      } else if (filter.operator === 'less_than') {
        whereParts.push(`${col.name} < ${filter.value}`)
      }
    })

    // Construir GROUP BY (solo dimensiones, con transformaciones de fecha)
    const groupByParts = selectedDimensions.map(dim => {
      if (dim.timeframe) {
        return getDateTransformSQL(dim.name, dim.timeframe, dim.sourceDatatype)
      }
      return dim.name
    })

    // Construir la query final
    let sql = `SELECT\n${selectParts.join(',\n')}\nFROM ${tableName}`

    if (whereParts.length > 0) {
      sql += `\nWHERE\n  ${whereParts.join('\n  AND ')}`
    }

    // GROUP BY siempre que haya dimensiones seleccionadas (para mostrar valores únicos/agrupados)
    if (groupByParts.length > 0) {
      sql += `\nGROUP BY\n  ${groupByParts.join(',\n  ')}`
    }

    // ORDER BY - usar el nombre del campo como alias
    const firstDimAlias = selectedDimensions[0] ? selectedDimensions[0].name.replace(/[^a-zA-Z0-9_]/g, '_') : null
    const firstMetricAlias = selectedMetrics[0] ? toSqlAlias(selectedMetrics[0].displayName) : null
    sql += `\nORDER BY\n  ${firstDimAlias || firstMetricAlias || '1'}`
    sql += `\nLIMIT 1000`

    return sql
  }

  // Copiar SQL al portapapeles
  const handleCopySQL = async () => {
    const sql = generateSQL()
    try {
      await navigator.clipboard.writeText(sql)
      setSqlCopied(true)
      setTimeout(() => setSqlCopied(false), 2000)
    } catch (err) {
      console.error('Error al copiar SQL:', err)
    }
  }

  // Handlers
  const handleFieldClick = (column: DataColumn) => {
    // Agregar columna en el orden de clic (no toggle)
    setSelectedColumns(prev => {
      if (prev.includes(column.id)) {
        // Si ya existe, la removemos
        return prev.filter(id => id !== column.id)
      } else {
        // Agregar al final para mantener el orden de clic
        return [...prev, column.id]
      }
    })
  }

  const handleAddToFilters = (column: DataColumn) => {
    // Agregar filtro solo si no existe ya
    const exists = activeFilters.some(f => f.columnId === column.id)
    if (!exists) {
      // Usar operador diferente según el tipo de campo
      const defaultOperator = column.dataType === 'date' ? 'is_in_the_last' : 'equals'
      const defaultTimeUnit = column.dataType === 'date' ? 'days' : undefined

      setActiveFilters(prev => [...prev, {
        columnId: column.id,
        operator: defaultOperator as any,
        value: column.dataType === 'date' ? '7' : '',
        timeUnit: defaultTimeUnit as any
      }])
    }
  }

  const handleRemoveFilter = (columnId: string) => {
    setActiveFilters(prev => prev.filter(f => f.columnId !== columnId))
  }

  const handleRemoveColumn = (columnId: string) => {
    setSelectedColumns(prev => prev.filter(id => id !== columnId))
  }

  // Seleccionar campos visibles
  const handleSelectAll = (columnIds: string[]) => {
    setSelectedColumns(prev => {
      const newSet = new Set(prev)
      columnIds.forEach(id => newSet.add(id))
      return Array.from(newSet)
    })
  }

  // Quitar campos visibles
  const handleDeselectAll = (columnIds: string[]) => {
    setSelectedColumns(prev => prev.filter(id => !columnIds.includes(id)))
  }

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

  // Sort handler - cycles through: none -> asc -> desc -> none
  const handleSort = (columnId: string) => {
    setSortConfig(prev => {
      const existingIndex = prev.findIndex(s => s.columnId === columnId)

      if (existingIndex === -1) {
        // Not in sort config - add as ascending
        return [...prev, { columnId, direction: 'asc' }]
      }

      const existing = prev[existingIndex]
      if (existing.direction === 'asc') {
        // Change to descending
        const newConfig = [...prev]
        newConfig[existingIndex] = { columnId, direction: 'desc' }
        return newConfig
      } else {
        // Remove from sort config
        return prev.filter(s => s.columnId !== columnId)
      }
    })
  }

  // Get sort info for a column
  const getSortInfo = (columnId: string) => {
    const index = sortConfig.findIndex(s => s.columnId === columnId)
    if (index === -1) return null
    return { order: index + 1, direction: sortConfig[index].direction }
  }

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, columnId: string) => {
    e.preventDefault()
    e.stopPropagation()

    const currentWidth = columnWidths[columnId] || 150 // Default width
    setResizingColumn({
      id: columnId,
      startX: e.clientX,
      startWidth: currentWidth
    })
  }

  // Mouse move and up handlers via useEffect
  useEffect(() => {
    if (!resizingColumn) return

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizingColumn.startX
      const newWidth = Math.max(80, resizingColumn.startWidth + diff) // Minimum width of 80px

      setColumnWidths(prev => ({
        ...prev,
        [resizingColumn.id]: newWidth
      }))
    }

    const handleMouseUp = () => {
      setResizingColumn(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingColumn])

  // Resize handler para sección de Datos
  useEffect(() => {
    if (!resizingDatos) return

    const handleMouseMove = (e: MouseEvent) => {
      const newHeight = Math.max(200, Math.min(800, e.clientY - 200)) // Min 200px, Max 800px
      setDatosHeight(newHeight)
    }

    const handleMouseUp = () => {
      setResizingDatos(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingDatos])

  // Handler para ejecutar la consulta y cargar datos desde BigQuery via backend
  const handleRun = async () => {
    if (!currentUser || !datasetName || !datasetSchema) return

    setIsLoading(true)
    setError(null)

    // Parsear el límite de filas del input
    const parsedLimit = Math.min(Math.max(parseInt(rowLimitInput) || 500, 1), 10000)
    setRowLimit(parsedLimit)
    setRowLimitInput(parsedLimit.toString())

    // Guardar las columnas que se van a consultar
    const columnsToQuery = [...selectedColumns]

    try {
      // Obtener token de Firebase
      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        setError('No se pudo obtener el token de autenticación')
        return
      }

      // Debug: verificar claims del token
      const tokenResult = await auth.currentUser?.getIdTokenResult()
      console.log('🔑 Token claims:', tokenResult?.claims)
      console.log('🏢 Tenant ID:', tokenResult?.claims?.tenant_id || tokenResult?.claims?.tenantId || 'No encontrado')
      console.log('📋 Columns to query:', columnsToQuery)
      console.log('📊 Row limit:', parsedLimit)

      // Mapear dataset a endpoint del backend-api
      const endpointMapping: Record<string, string> = {
        // Entity tables
        'meta_campaigns': '/api/analytics/campaigns',
        'meta_adsets': '/api/analytics/adsets',
        'meta_ads': '/api/analytics/ads',
        'meta_creatives': '/api/analytics/top-creatives',
        // Performance tables
        'meta_performance_campaign_daily': '/api/analytics/campaign-performance',
        'meta_performance_adset_daily': '/api/analytics/adset-performance',
        'meta_performance_ad_daily': '/api/analytics/ad-performance',
        'meta_performance_campaign_age_gender': '/api/analytics/performance-by-demographics',
        'meta_performance_campaign_country': '/api/analytics/performance-by-country',
        'meta_performance_campaign_publisher_platform': '/api/analytics/performance-by-platform',
        'meta_performance_campaign_impression_device': '/api/analytics/performance-by-impression-device',
        'meta_performance_campaign_platform_device': '/api/analytics/performance-by-platform-device',
        'meta_top_creatives_performance': '/api/analytics/top-creatives-performance'
      }

      const endpoint = endpointMapping[datasetName]
      if (!endpoint) {
        setError(`Dataset "${datasetName}" no tiene endpoint configurado`)
        return
      }

      // Construir URL con parámetros de fecha y límite
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const endDate = new Date().toISOString().split('T')[0]
      const url = `${API_BASE_URL}${endpoint}?startDate=${startDate}&endDate=${endDate}&limit=${parsedLimit}`

      // Hacer la petición al backend
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Backend error:', errorData)
        throw new Error(errorData.detail || errorData.error || errorData.message || `Error ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('📊 Backend response:', result)

      // Convertir los datos del backend a formato DataRow
      let rows: DataRow[] = []

      // Obtener todas las columnas seleccionadas con sus detalles (definir fuera del if)
      const selectedColumnsWithDetails = columnsToQuery
        .map(id => columns.find(c => c.id === id))
        .filter((col): col is DataColumn => col !== undefined)

      if (result.success && result.data) {
        const data = Array.isArray(result.data) ? result.data : [result.data]
        console.log('📊 Data rows:', data)

        // Mapeo de campos del backend a campos del frontend
        // El backend puede devolver nombres diferentes (ej: campaign_name vs name)
        const fieldMapping: Record<string, string> = {
          'campaign_name': 'name',  // backend devuelve campaign_name, frontend usa name
          'adset_name': 'name',
          'ad_name': 'name'
        }

        // Debug: mostrar campos disponibles del backend
        if (data.length > 0) {
          console.log('📋 Campos disponibles del backend:', Object.keys(data[0]))
          console.log('📋 Columnas seleccionadas:', columnsToQuery)
          console.log('📋 Ejemplo de datos:', data[0])
        }

        // Función para transformar fecha según timeframe
        const transformDateValue = (value: any, timeframe: string): string => {
          if (!value) return '-'
          const date = new Date(value)
          if (isNaN(date.getTime())) return String(value)

          switch (timeframe) {
            case 'raw':
              return date.toISOString()
            case 'time':
              // Solo hora en formato HH:MM AM/PM
              return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
            case 'datetime':
              // Fecha y hora completa
              return date.toLocaleString('en-US', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: true
              })
            case 'date':
              return date.toISOString().split('T')[0]
            case 'week': {
              // Inicio de la semana (lunes)
              const dateCopy = new Date(date)
              const dayOfWeek = dateCopy.getDay()
              const diff = dateCopy.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
              dateCopy.setDate(diff)
              return dateCopy.toISOString().split('T')[0]
            }
            case 'month':
              // Formato yyyy-mm
              return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            case 'quarter': {
              // Formato Q1, Q2, Q3, Q4
              const quarter = Math.floor(date.getMonth() / 3) + 1
              return `Q${quarter}`
            }
            case 'year':
              return String(date.getFullYear())
            case 'day_of_week':
              return date.toLocaleDateString('en-US', { weekday: 'long' })
            case 'day_of_month':
              return String(date.getDate())
            case 'week_of_year': {
              const startOfYear = new Date(date.getFullYear(), 0, 1)
              const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
              return String(Math.ceil((days + startOfYear.getDay() + 1) / 7))
            }
            case 'month_name':
              return date.toLocaleDateString('en-US', { month: 'long' })
            default:
              return String(value)
          }
        }

        rows = data.map((item: any, index: number) => {
          // Crear objeto de datos mapeado
          const mappedData: Record<string, any> = {}

          // Primero copiar todos los campos originales del backend
          Object.keys(item).forEach(key => {
            mappedData[key] = item[key]
          })

          // Aplicar mapeos de nombres (backend -> frontend)
          Object.entries(fieldMapping).forEach(([backendKey, frontendKey]) => {
            if (item[backendKey] !== undefined) {
              mappedData[frontendKey] = item[backendKey]
            }
          })

          // Mapear TODAS las columnas seleccionadas
          selectedColumnsWithDetails.forEach(col => {
            // Si es un campo de fecha con timeframe
            if (col.timeframe && col.baseFieldName) {
              const rawValue = item[col.baseFieldName]
              if (rawValue !== undefined) {
                mappedData[col.id] = transformDateValue(rawValue, col.timeframe)
              }
            }
            // Si el campo ya existe en mappedData con su ID, no hacer nada
            else if (mappedData[col.id] !== undefined) {
              // Ya está mapeado
            }
            // Si el campo existe en el item con su nombre
            else if (item[col.name] !== undefined) {
              mappedData[col.id] = item[col.name]
            }
            // Buscar por nombre alternativo (sin prefijos como created_time -> created)
            else {
              // Intentar encontrar el campo en el item por coincidencia parcial
              const possibleKeys = Object.keys(item).filter(key =>
                key.toLowerCase().includes(col.name.toLowerCase()) ||
                col.name.toLowerCase().includes(key.toLowerCase())
              )
              if (possibleKeys.length === 1) {
                mappedData[col.id] = item[possibleKeys[0]]
              }
            }
          })

          // Debug: mostrar campos mapeados vs esperados
          if (index === 0) {
            console.log('📋 Primer registro mapeado:', mappedData)
            selectedColumnsWithDetails.forEach(col => {
              console.log(`  - ${col.id}: ${mappedData[col.id] !== undefined ? 'OK' : 'MISSING'}`,
                col.timeframe ? `(timeframe: ${col.timeframe}, base: ${col.baseFieldName})` : '')
            })
          }

          return {
            id: item.id || item.campaign_id || item.adset_id || item.ad_id || `row-${index}`,
            data: mappedData
          }
        })
      }

      // Verificar si hay dimensiones y métricas seleccionadas
      const selectedDims = selectedColumnsWithDetails.filter(col => col.isDimension)
      const selectedMets = selectedColumnsWithDetails.filter(col => col.isMetric || col.isCalculated)

      // Función helper para agregar métricas
      const aggregateMetrics = (rowsToAggregate: DataRow[], metrics: DataColumn[]): Record<string, any> => {
        const aggregatedData: Record<string, any> = {}

        metrics.forEach(metric => {
          const schemaField = datasetSchema?.measures?.find(m => m.name === metric.name)
            || datasetSchema?.calculations?.find(c => c.name === metric.name)

          const aggregationType = schemaField && 'type' in schemaField ? schemaField.type : 'sum'

          // Para COUNT, simplemente contar las filas (no necesita valores del backend)
          if (aggregationType === 'count') {
            aggregatedData[metric.id] = rowsToAggregate.length
            return
          }

          const values = rowsToAggregate
            .map(row => row.data[metric.id] ?? row.data[metric.name])
            .filter(v => v !== undefined && v !== null && !isNaN(Number(v)))
            .map(v => Number(v))

          if (values.length > 0) {
            switch (aggregationType) {
              case 'sum':
                aggregatedData[metric.id] = values.reduce((a, b) => a + b, 0)
                break
              case 'count_distinct':
                aggregatedData[metric.id] = new Set(values).size
                break
              case 'average':
                aggregatedData[metric.id] = values.reduce((a, b) => a + b, 0) / values.length
                break
              case 'min':
                aggregatedData[metric.id] = Math.min(...values)
                break
              case 'max':
                aggregatedData[metric.id] = Math.max(...values)
                break
              default:
                aggregatedData[metric.id] = values.reduce((a, b) => a + b, 0)
            }
          } else {
            // Si no hay valores válidos, poner 0 para sum y null para otros
            aggregatedData[metric.id] = aggregationType === 'sum' ? 0 : null
          }
        })

        return aggregatedData
      }

      // SIEMPRE agregar/agrupar datos
      if (rows.length > 0) {
        if (selectedMets.length > 0 && selectedDims.length === 0) {
          // Solo métricas (sin dimensiones): agregar todo en una sola fila
          console.log('📊 Agregando métricas (sin dimensiones)...')
          const aggregatedData = aggregateMetrics(rows, selectedMets)
          rows = [{
            id: 'aggregated-row',
            data: aggregatedData
          }]
          console.log('📊 Resultado agregado:', aggregatedData)
        } else if (selectedDims.length > 0) {
          // Con dimensiones: agrupar por valores únicos de dimensiones
          console.log('📊 Agrupando por dimensiones:', selectedDims.map(d => d.id))

          // Crear clave única para cada combinación de valores de dimensiones
          const groupedData: Record<string, DataRow[]> = {}

          rows.forEach(row => {
            // Construir clave de grupo basada en valores de dimensiones
            const groupKey = selectedDims
              .map(dim => {
                const value = row.data[dim.id] ?? row.data[dim.name] ?? ''
                return String(value).trim().toLowerCase() // Normalizar valores
              })
              .join('|||')

            if (!groupedData[groupKey]) {
              groupedData[groupKey] = []
            }
            groupedData[groupKey].push(row)
          })

          console.log('📊 Grupos únicos encontrados:', Object.keys(groupedData).length)

          // Crear filas agrupadas
          rows = Object.entries(groupedData).map(([_groupKey, groupRows], index) => {
            // Tomar los valores de dimensiones del primer registro del grupo
            const firstRow = groupRows[0]
            const aggregatedData: Record<string, any> = {}

            // Copiar valores de dimensiones
            selectedDims.forEach(dim => {
              aggregatedData[dim.id] = firstRow.data[dim.id] ?? firstRow.data[dim.name]
            })

            // Si hay métricas, agregarlas
            if (selectedMets.length > 0) {
              const metricAggregations = aggregateMetrics(groupRows, selectedMets)
              Object.assign(aggregatedData, metricAggregations)
            }

            return {
              id: `group-${index}`,
              data: aggregatedData
            }
          })

          console.log('📊 Filas después de agrupar:', rows.length)
        }
      }

      setDataRows(rows)
      setQueriedColumns(columnsToQuery) // Guardar las columnas que se consultaron

      if (rows.length === 0) {
        setError('No se encontraron datos para el rango de fechas seleccionado')
      }
    } catch (err: any) {
      console.error('Error al cargar datos:', err)
      setError(err.message || 'Error al cargar datos')
    } finally {
      setIsLoading(false)
    }
  }

  // Obtener columnas seleccionadas con sus detalles
  const selectedColumnsDetails = columns.filter(col => selectedColumns.includes(col.id))

  // Sort data based on sortConfig
  const sortedDataRows = [...dataRows].sort((a, b) => {
    for (const { columnId, direction } of sortConfig) {
      const aVal = a.data[columnId]
      const bVal = b.data[columnId]

      // Handle null/undefined
      if (aVal === null || aVal === undefined) return direction === 'asc' ? 1 : -1
      if (bVal === null || bVal === undefined) return direction === 'asc' ? -1 : 1

      // Compare values
      let comparison = 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }

      if (comparison !== 0) {
        return direction === 'asc' ? comparison : -comparison
      }
    }
    return 0
  })

  // Verificar si una columna tiene datos (fue consultada)
  const columnHasData = (columnId: string) => queriedColumns.includes(columnId)

  // Helper para formatear valores
  const formatValue = (value: any, column: DataColumn): string => {
    if (value === null || value === undefined) return '-'

    switch (column.dataType) {
      case 'currency':
        return typeof value === 'number' ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(value)
      case 'percentage':
        return typeof value === 'number' ? `${value.toFixed(2)}%` : String(value)
      case 'number':
        return typeof value === 'number' ? value.toLocaleString('en-US') : String(value)
      case 'date':
        if (value instanceof Date) {
          return value.toISOString().split('T')[0]
        }
        return String(value)
      default:
        return String(value)
    }
  }

  return (
    <div className="flex h-full">
      {/* Barra lateral de campos */}
      <DatasetFieldsSidebar
        title={datasetLabel || 'Dataset'}
        columns={columns}
        selectedColumns={selectedColumns}
        onFieldClick={handleFieldClick}
        onAddToFilters={handleAddToFilters}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
      />

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {/* Header */}
        <div className="px-6 py-3 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center text-xs text-gray-500 mb-1">
                <span>{datasetSchema?.category || 'Dataset'}</span>
                <span className="mx-2">›</span>
                <span>{datasetName}</span>
              </div>
              <h1 className="text-lg font-semibold text-gray-900">
                {datasetLabel}
              </h1>
              {datasetDescription && (
                <p className="text-sm text-gray-600 mt-1">{datasetDescription}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSqlModal(true)}
                disabled={selectedColumns.length === 0}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed rounded transition-colors flex items-center gap-1.5"
                title="Ver SQL"
              >
                <CodeBracketIcon className="h-4 w-4" />
                SQL
              </button>
              <button
                onClick={handleRun}
                disabled={isLoading || selectedColumns.length === 0}
                className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded transition-colors"
              >
                {isLoading ? 'Loading...' : 'Run'}
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-red-800">Error al cargar datos</h3>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="ml-3 flex-shrink-0 text-red-400 hover:text-red-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Sections */}
        <div className="flex-1 overflow-y-auto">
          {/* Sección Filtros */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleSection('filtros')}
              className="w-full px-6 py-3 flex items-center justify-between bg-blue-50 hover:bg-blue-100 transition-colors border-l-4 border-blue-500"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-blue-900">Filtros</span>
                {activeFilters.length > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-200 text-blue-800 rounded-full">
                    {activeFilters.length}
                  </span>
                )}
              </div>
              {expandedSections.has('filtros') ? (
                <ChevronDownIcon className="h-5 w-5 text-blue-700" />
              ) : (
                <ChevronRightIcon className="h-5 w-5 text-blue-700" />
              )}
            </button>

            {expandedSections.has('filtros') && (
              <div className="px-6 py-4 bg-white border-t border-gray-100">
                {activeFilters.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-gray-600">Filtros activos</span>
                      <button
                        onClick={() => setActiveFilters([])}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Limpiar todos
                      </button>
                    </div>
                    <div className="space-y-2">
                      {activeFilters.map((filter) => {
                        const column = columns.find(col => col.id === filter.columnId)
                        const isDateField = column?.dataType === 'date'

                        return (
                          <div
                            key={filter.columnId}
                            className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-300 rounded"
                          >
                            <span className="text-xs font-medium text-gray-700 min-w-[120px]">
                              {column?.displayName}
                            </span>

                            {isDateField ? (
                              <>
                                {/* Date Operator Dropdown */}
                                <select
                                  value={filter.operator}
                                  onChange={(e) => {
                                    setActiveFilters(prev => prev.map(f =>
                                      f.columnId === filter.columnId
                                        ? { ...f, operator: e.target.value as any }
                                        : f
                                    ))
                                  }}
                                  className="px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value="is_in_the_last">is in the last</option>
                                  <option value="is_on_the_day">is on the day</option>
                                  <option value="is_in_range">is in range</option>
                                  <option value="is_before">is before</option>
                                  <option value="is_on_or_after">is on or after</option>
                                  <option value="is_in_the_year">is in the year</option>
                                  <option value="is_in_the_month">is in the month</option>
                                  <option value="is_this">is this</option>
                                  <option value="is_next">is next</option>
                                  <option value="is_previous">is previous</option>
                                  <option value="is">is</option>
                                  <option value="is_null">is null</option>
                                  <option value="is_any_time">is any time</option>
                                  <option value="is_not_null">is not null</option>
                                </select>

                                {/* Value Input (only for operators that need it) */}
                                {!['is_null', 'is_any_time', 'is_not_null'].includes(filter.operator) && (
                                  <input
                                    type="number"
                                    placeholder="7"
                                    className="w-16 px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    value={filter.value as string || ''}
                                    onChange={(e) => {
                                      setActiveFilters(prev => prev.map(f =>
                                        f.columnId === filter.columnId
                                          ? { ...f, value: e.target.value }
                                          : f
                                      ))
                                    }}
                                  />
                                )}

                                {/* Time Unit Dropdown */}
                                {['is_in_the_last', 'is_this', 'is_next', 'is_previous'].includes(filter.operator) && (
                                  <select
                                    value={filter.timeUnit || 'days'}
                                    onChange={(e) => {
                                      setActiveFilters(prev => prev.map(f =>
                                        f.columnId === filter.columnId
                                          ? { ...f, timeUnit: e.target.value as any }
                                          : f
                                      ))
                                    }}
                                    className="px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                  >
                                    <option value="seconds">seconds</option>
                                    <option value="minutes">minutes</option>
                                    <option value="hours">hours</option>
                                    <option value="days">days</option>
                                    <option value="weeks">weeks</option>
                                    <option value="months">months</option>
                                    <option value="quarters">quarters</option>
                                    <option value="years">years</option>
                                  </select>
                                )}
                              </>
                            ) : (
                              <>
                                {/* Regular filter for non-date fields */}
                                <select
                                  value={filter.operator}
                                  onChange={(e) => {
                                    setActiveFilters(prev => prev.map(f =>
                                      f.columnId === filter.columnId
                                        ? { ...f, operator: e.target.value as any }
                                        : f
                                    ))
                                  }}
                                  className="px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value="equals">equals</option>
                                  <option value="not_equals">not equals</option>
                                  <option value="contains">contains</option>
                                  <option value="greater_than">greater than</option>
                                  <option value="less_than">less than</option>
                                </select>
                                <input
                                  type="text"
                                  placeholder="value..."
                                  className="w-24 px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                  value={filter.value as string || ''}
                                  onChange={(e) => {
                                    setActiveFilters(prev => prev.map(f =>
                                      f.columnId === filter.columnId
                                        ? { ...f, value: e.target.value }
                                        : f
                                    ))
                                  }}
                                />
                              </>
                            )}

                            <button
                              onClick={() => handleRemoveFilter(filter.columnId)}
                              className="ml-auto text-gray-400 hover:text-gray-600"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    Haz clic en el ícono de filtro junto a un campo para agregar filtros
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Sección Datos */}
          <div className="border-b border-gray-200 relative">
            <button
              onClick={() => toggleSection('datos')}
              className="w-full px-6 py-3 flex items-center justify-between bg-green-50 hover:bg-green-100 transition-colors border-l-4 border-green-500"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-green-900">Datos</span>
                {selectedColumns.length > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-green-200 text-green-800 rounded-full">
                    {selectedColumns.length}
                  </span>
                )}
              </div>
              {expandedSections.has('datos') ? (
                <ChevronDownIcon className="h-5 w-5 text-green-700" />
              ) : (
                <ChevronRightIcon className="h-5 w-5 text-green-700" />
              )}
            </button>

            {expandedSections.has('datos') && (
              <div
                className="px-6 py-4 bg-white border-t border-gray-100 relative"
                style={{ height: `${datosHeight}px`, overflow: 'auto' }}
              >
                {/* Row Limit Control */}
                {selectedColumns.length > 0 && (
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span>Mostrando</span>
                      <span className="font-medium text-gray-900">{dataRows.length}</span>
                      <span>de</span>
                      <span className="font-medium text-gray-900">{rowLimit}</span>
                      <span>filas máx.</span>
                      {queriedColumns.length > 0 && queriedColumns.length !== selectedColumns.length && (
                        <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                          {selectedColumns.length - queriedColumns.length} columna(s) sin datos - ejecutar de nuevo
                        </span>
                      )}
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
                          onChange={(e) => setRowLimitInput(e.target.value)}
                          min="1"
                          max="10000"
                          className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                          placeholder="500"
                        />
                        <span className="text-xs text-gray-400">(máx 10,000)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Table */}
                {selectedColumns.length > 0 ? (
                  <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden flex flex-col" style={{ maxHeight: `${datosHeight - 80}px` }}>
                    <div className="overflow-auto flex-1">
                      <table className="min-w-full border-collapse">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-gray-700">
                            {selectedColumnsDetails.map((column, index) => (
                              <th
                                key={column.id}
                                draggable={!resizingColumn}
                                onDragStart={(e) => {
                                  if (resizingColumn) {
                                    e.preventDefault()
                                    return
                                  }
                                  setDraggingColumn(index)
                                  e.dataTransfer.effectAllowed = 'move'
                                  e.dataTransfer.setData('text/plain', index.toString())
                                  // Set drag image
                                  const dragImage = e.currentTarget.cloneNode(true) as HTMLElement
                                  dragImage.style.opacity = '0.5'
                                  document.body.appendChild(dragImage)
                                  e.dataTransfer.setDragImage(dragImage, 0, 0)
                                  setTimeout(() => document.body.removeChild(dragImage), 0)
                                }}
                                onDragEnd={() => {
                                  setDraggingColumn(null)
                                  setDragOverColumn(null)
                                }}
                                onDragEnter={(e) => {
                                  e.preventDefault()
                                  if (draggingColumn !== null && draggingColumn !== index) {
                                    setDragOverColumn(index)
                                  }
                                }}
                                onDragLeave={(e) => {
                                  e.preventDefault()
                                  if (e.currentTarget === e.target) {
                                    setDragOverColumn(null)
                                  }
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault()
                                  e.dataTransfer.dropEffect = 'move'
                                }}
                                onDrop={(e) => {
                                  e.preventDefault()
                                  const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'))
                                  if (draggedIndex !== index && !isNaN(draggedIndex)) {
                                    const newColumns = [...selectedColumns]
                                    const [draggedColumn] = newColumns.splice(draggedIndex, 1)
                                    newColumns.splice(index, 0, draggedColumn)
                                    setSelectedColumns(newColumns)
                                  }
                                  setDraggingColumn(null)
                                  setDragOverColumn(null)
                                }}
                                style={{ width: columnWidths[column.id] ? `${columnWidths[column.id]}px` : '150px' }}
                                className={`relative px-4 py-2 text-left text-xs font-semibold border-r border-gray-600 last:border-r-0 ${
                                  resizingColumn ? 'cursor-default' : 'cursor-move'
                                } select-none ${
                                  draggingColumn === index ? 'opacity-30 bg-blue-400' : ''
                                } ${
                                  dragOverColumn === index && draggingColumn !== index ? 'bg-gray-600 border-l-4 border-l-blue-500' : ''
                                } ${
                                  column.isMetric
                                    ? 'text-green-300'
                                    : 'text-gray-100'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div
                                    className="flex items-center gap-1 cursor-pointer hover:text-white"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleSort(column.id)
                                    }}
                                  >
                                    <span>{column.displayName}</span>
                                    {/* Sort badge */}
                                    {(() => {
                                      const sortInfo = getSortInfo(column.id)
                                      if (!sortInfo) return null
                                      return (
                                        <span className="flex items-center gap-0.5 ml-1">
                                          <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-gray-200 text-gray-700 rounded-full">
                                            {sortInfo.order}
                                          </span>
                                          <span className="text-gray-300 text-[10px]">
                                            {sortInfo.direction === 'asc' ? '↑' : '↓'}
                                          </span>
                                        </span>
                                      )
                                    })()}
                                    {!columnHasData(column.id) && dataRows.length > 0 && (
                                      <span className="text-yellow-400 text-xs" title="Ejecutar para cargar datos">*</span>
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleRemoveColumn(column.id)
                                    }}
                                    className="opacity-0 hover:opacity-100 transition-opacity"
                                  >
                                    <XMarkIcon className="h-3 w-3 text-gray-300 hover:text-white" />
                                  </button>
                                </div>
                                {/* Resize handle */}
                                <div
                                  onMouseDown={(e) => handleResizeStart(e, column.id)}
                                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 opacity-0 hover:opacity-100 z-10"
                                />
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {isLoading ? (
                            <tr>
                              <td
                                colSpan={selectedColumns.length}
                                className="px-6 py-12 text-center"
                              >
                                <div className="flex flex-col items-center justify-center">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
                                  <p className="text-sm text-gray-500">Cargando datos...</p>
                                </div>
                              </td>
                            </tr>
                          ) : sortedDataRows.length > 0 ? (
                            sortedDataRows.map((row, rowIndex) => (
                              <tr
                                key={row.id}
                                className={`${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                              >
                                {selectedColumnsDetails.map((column) => (
                                  <td
                                    key={column.id}
                                    style={{
                                      width: columnWidths[column.id] ? `${columnWidths[column.id]}px` : '150px',
                                      maxWidth: columnWidths[column.id] ? `${columnWidths[column.id]}px` : '150px'
                                    }}
                                    className={`px-4 py-2 text-xs border-r border-gray-200 last:border-r-0 ${
                                      columnHasData(column.id) ? 'text-gray-700' : 'text-gray-300 bg-gray-50'
                                    }`}
                                  >
                                    <div className="overflow-hidden whitespace-nowrap text-ellipsis">
                                      {columnHasData(column.id)
                                        ? formatValue(row.data[column.id], column)
                                        : <span className="italic">sin datos</span>
                                      }
                                    </div>
                                  </td>
                                ))}
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={selectedColumns.length}
                                className="px-6 py-12 text-center"
                              >
                                <div className="text-gray-400">
                                  <p className="text-sm text-gray-500">
                                    No hay datos disponibles
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    Haz clic en "Run" para ejecutar la consulta
                                  </p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                        {/* Totals Row */}
                        {showTotals && dataRows.length > 0 && (
                          <tfoot className="sticky bottom-0 z-10">
                            <tr className="bg-gray-100 font-semibold">
                              {selectedColumnsDetails.map((column, index) => {
                                // Para métricas, calcular el total
                                if (column.isMetric || column.isCalculated) {
                                  // Buscar el tipo de agregación del schema
                                  const schemaField = datasetSchema?.measures?.find(m => m.name === column.name)
                                    || datasetSchema?.calculations?.find(c => c.name === column.name)
                                  const aggregationType = schemaField && 'type' in schemaField ? schemaField.type : 'sum'

                                  // Obtener todos los valores de esta métrica
                                  const values = dataRows
                                    .map(row => row.data[column.id] ?? row.data[column.name])
                                    .filter(v => v !== undefined && v !== null && !isNaN(Number(v)))
                                    .map(v => Number(v))

                                  let total: number | string = '-'
                                  if (values.length > 0) {
                                    switch (aggregationType) {
                                      case 'sum':
                                        total = values.reduce((a, b) => a + b, 0)
                                        break
                                      case 'count':
                                        total = values.length
                                        break
                                      case 'count_distinct':
                                        total = new Set(values).size
                                        break
                                      case 'average':
                                        total = values.reduce((a, b) => a + b, 0) / values.length
                                        break
                                      case 'min':
                                        total = Math.min(...values)
                                        break
                                      case 'max':
                                        total = Math.max(...values)
                                        break
                                      default:
                                        total = values.reduce((a, b) => a + b, 0)
                                    }
                                  }

                                  return (
                                    <td
                                      key={column.id}
                                      style={{
                                        width: columnWidths[column.id] ? `${columnWidths[column.id]}px` : '150px',
                                        maxWidth: columnWidths[column.id] ? `${columnWidths[column.id]}px` : '150px'
                                      }}
                                      className="px-4 py-2 text-xs text-green-700 border-r border-gray-200 last:border-r-0"
                                    >
                                      {typeof total === 'number' ? formatValue(total, column) : total}
                                    </td>
                                  )
                                }

                                // Para la primera columna de dimensión, mostrar "Totales"
                                if (index === 0) {
                                  return (
                                    <td
                                      key={column.id}
                                      style={{
                                        width: columnWidths[column.id] ? `${columnWidths[column.id]}px` : '150px',
                                        maxWidth: columnWidths[column.id] ? `${columnWidths[column.id]}px` : '150px'
                                      }}
                                      className="px-4 py-2 text-xs text-gray-700 font-semibold border-r border-gray-200 last:border-r-0"
                                    >
                                      Totales
                                    </td>
                                  )
                                }

                                // Para otras dimensiones, celda vacía
                                return (
                                  <td
                                    key={column.id}
                                    style={{
                                      width: columnWidths[column.id] ? `${columnWidths[column.id]}px` : '150px',
                                      maxWidth: columnWidths[column.id] ? `${columnWidths[column.id]}px` : '150px'
                                    }}
                                    className="px-4 py-2 text-xs text-gray-500 border-r border-gray-200 last:border-r-0"
                                  >
                                    -
                                  </td>
                                )
                              })}
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                    <p className="text-sm text-gray-500">
                      Selecciona columnas para ver los datos
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Resize Handle para Datos */}
            {expandedSections.has('datos') && (
              <div
                onMouseDown={() => setResizingDatos(true)}
                className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-green-400 bg-green-300 transition-colors z-10 flex items-center justify-center"
              >
                <div className="w-12 h-1 bg-green-600 rounded-full"></div>
              </div>
            )}
          </div>

          {/* Sección Visualización */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleSection('visualizacion')}
              className="w-full px-6 py-3 flex items-center justify-between bg-purple-50 hover:bg-purple-100 transition-colors border-l-4 border-purple-500"
            >
              <span className="text-sm font-semibold text-purple-900">Visualización</span>
              {expandedSections.has('visualizacion') ? (
                <ChevronDownIcon className="h-5 w-5 text-purple-700" />
              ) : (
                <ChevronRightIcon className="h-5 w-5 text-purple-700" />
              )}
            </button>

            {expandedSections.has('visualizacion') && (
              <div className="px-6 py-4 bg-white border-t border-gray-100">
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                  <p className="text-sm text-gray-500 mb-1">
                    Visualizaciones próximamente
                  </p>
                  <p className="text-xs text-gray-400">
                    Gráficos y dashboards estarán disponibles pronto
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal SQL */}
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
                  {generateSQL()}
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
    </div>
  )
}

/**
 * Widget de tabla configurable con ordenamiento y búsqueda
 */

import { useState, useMemo } from 'react'
import { TableWidgetConfig } from '@/types/widgets'
import { MagnifyingGlassIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline'

interface TableWidgetProps {
  config: TableWidgetConfig
  data: Record<string, unknown>[]
}

export default function TableWidget({ config, data }: TableWidgetProps) {
  const { settings } = config
  const [searchTerm, setSearchTerm] = useState('')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)

  // Filtrar datos por búsqueda
  const filteredData = useMemo(() => {
    if (!settings.searchable || !searchTerm) return data

    return data.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }, [data, searchTerm, settings.searchable])

  // Ordenar datos
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortColumn] as string | number
      const bValue = b[sortColumn] as string | number

      if (aValue === bValue) return 0

      const comparison = aValue < bValue ? -1 : 1
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredData, sortColumn, sortDirection])

  // Paginar datos
  const pageSize = settings.pageSize || 10
  const totalPages = Math.ceil(sortedData.length / pageSize)
  const paginatedData = settings.pagination
    ? sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedData

  // Manejar ordenamiento
  const handleSort = (columnKey: string) => {
    const column = settings.columns.find((col) => col.key === columnKey)
    if (!column?.sortable) return

    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(columnKey)
      setSortDirection('asc')
    }
  }

  // Formatear valor según el tipo
  const formatValue = (value: unknown, format?: string): string => {
    if (value === null || value === undefined) return '-'

    switch (format) {
      case 'number':
        return Number(value).toLocaleString()
      case 'currency':
        return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      case 'percentage':
        return `${Number(value).toFixed(1)}%`
      case 'date':
        return new Date(value as string).toLocaleDateString()
      default:
        return String(value)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Búsqueda */}
      {settings.searchable && (
        <div className="mb-3">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        <table className={`min-w-full divide-y divide-gray-200 ${settings.compact ? 'text-sm' : ''}`}>
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {settings.columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  style={{ width: column.width, textAlign: column.align }}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.label}</span>
                    {column.sortable && sortColumn === column.key && (
                      sortDirection === 'asc' ? (
                        <ArrowUpIcon className="h-3 w-3" />
                      ) : (
                        <ArrowDownIcon className="h-3 w-3" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            className={`bg-white divide-y divide-gray-200 ${
              settings.striped ? 'divide-y-0' : ''
            }`}
          >
            {paginatedData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`${
                  settings.hoverable ? 'hover:bg-gray-50' : ''
                } ${
                  settings.striped && rowIndex % 2 === 1 ? 'bg-gray-50' : ''
                }`}
              >
                {settings.columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 ${settings.compact ? 'py-2' : 'py-3'} whitespace-nowrap`}
                    style={{ textAlign: column.align }}
                  >
                    {formatValue(row[column.key], column.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {settings.pagination && totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3">
          <div className="text-sm text-gray-500">
            Mostrando {(currentPage - 1) * pageSize + 1} a{' '}
            {Math.min(currentPage * pageSize, sortedData.length)} de{' '}
            {sortedData.length} resultados
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Contenedor base para todos los widgets
 * Maneja título, descripción, acciones y configuración común
 */

import { ReactNode, useState } from 'react'
import { Cog6ToothIcon, ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline'
import { WidgetConfig } from '@/types/widgets'

interface WidgetContainerProps {
  config: WidgetConfig
  children: ReactNode
  onRefresh?: () => void
  onConfigure?: () => void
  onDelete?: () => void
  isLoading?: boolean
  error?: string
  isEditMode?: boolean
}

export default function WidgetContainer({
  config,
  children,
  onRefresh,
  onConfigure,
  onDelete,
  isLoading = false,
  error,
  isEditMode = false
}: WidgetContainerProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className="relative h-full bg-white rounded-lg shadow border border-gray-200 overflow-hidden flex flex-col"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {config.title}
            </h3>
            {config.description && (
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {config.description}
              </p>
            )}
          </div>

          {/* Actions - always visible in edit mode, visible on hover otherwise */}
          {(isEditMode || isHovered) && (
            <div className="flex items-center space-x-1 ml-2">
              {onRefresh && !isEditMode && (
                <button
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                  title="Actualizar"
                >
                  <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              )}

              {onConfigure && (
                <button
                  onClick={onConfigure}
                  className={`p-1.5 rounded transition-colors ${
                    isEditMode
                      ? 'bg-primary-blue text-white hover:bg-secondary-blue shadow-md'
                      : 'text-gray-500 hover:text-primary-blue hover:bg-blue-50'
                  }`}
                  title="Configurar Widget"
                >
                  <Cog6ToothIcon className="h-4 w-4" />
                </button>
              )}

              {onDelete && isEditMode && (
                <button
                  onClick={onDelete}
                  className="p-1.5 text-white bg-red-500 hover:bg-red-600 rounded transition-colors shadow-md"
                  title="Eliminar Widget"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-red-500 text-sm font-medium mb-1">
                Error al cargar datos
              </div>
              <p className="text-xs text-gray-500">{error}</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue mx-auto mb-2"></div>
              <p className="text-xs text-gray-500">Cargando...</p>
            </div>
          </div>
        ) : (
          children
        )}
      </div>

      {/* Footer with last update */}
      {!error && !isLoading && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500">
            Actualizado: {new Date(config.updatedAt).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  )
}

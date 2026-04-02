import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FolderIcon,
  ChartBarIcon,
  ChartPieIcon,
  PresentationChartLineIcon,
  PresentationChartBarIcon,
  CubeIcon,
  TrashIcon,
  PencilIcon,
  EllipsisVerticalIcon,
  Squares2X2Icon,
  ListBulletIcon,
  LockClosedIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '@/contexts/AuthContext'
import { getVizTreeWithCore, deleteViz, deleteFolder, updateFolder, createFolder, MAIN_DASHBOARDS_FOLDER_ID } from '@/services/vizService'
import { deleteDashboard } from '@/services/dashboardService'
import { copyDashboardToCore, deleteCoreDashboard } from '@/services/coreDashboardAdminService'
import { getUserProfile } from '@/services/userService'
import type { VizTreeNode, VizType } from '@/types/viz'

// Helper to get icon for viz type
const getVizIcon = (vizType?: VizType) => {
  switch (vizType) {
    case 'line':
      return PresentationChartLineIcon
    case 'column':
      return ChartBarIcon
    case 'area':
      return PresentationChartBarIcon
    case 'pie':
      return ChartPieIcon
    case 'single':
    case 'progress':
      return CubeIcon
    default:
      return ChartBarIcon
  }
}

// Helper to get viz type label
const getVizTypeLabel = (vizType?: VizType) => {
  switch (vizType) {
    case 'line':
      return 'Lineas'
    case 'column':
      return 'Barras'
    case 'area':
      return 'Area'
    case 'pie':
      return 'Circular'
    case 'single':
      return 'Valor unico'
    case 'progress':
      return 'Progreso'
    default:
      return 'Grafico'
  }
}

interface FolderCardProps {
  node: VizTreeNode
  onOpen: (folderId: string) => void
  onDeleteFolder: (folderId: string, name: string) => void
  onRenameFolder: (folderId: string, currentName: string) => void
  canEditCore: boolean
}

function FolderCard({ node, onOpen, onDeleteFolder, onRenameFolder, canEditCore }: FolderCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const childCount = node.children?.length || 0
  const vizCount = node.children?.filter(c => c.type === 'viz').length || 0
  const dashboardCount = node.children?.filter(c => c.type === 'dashboard').length || 0
  const subfolderCount = node.children?.filter(c => c.type === 'folder').length || 0

  // Main Dashboards is a virtual folder - cannot be edited/deleted
  const isVirtualFolder = node.id === MAIN_DASHBOARDS_FOLDER_ID

  // Can edit this folder?
  // Virtual folders cannot be edited even by SysOwner
  const canEdit = !isVirtualFolder && (!node.isCore || canEditCore)

  return (
    <div
      className={`relative p-4 rounded-xl border bg-white cursor-pointer transition-all duration-200 hover:shadow-lg ${
        node.isCore
          ? 'border-amber-200 bg-amber-50/50 hover:border-amber-300'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={() => onOpen(node.id)}
    >
      {/* Menu Button - only show if can edit */}
      {canEdit && (
        <div className="absolute top-2 right-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <EllipsisVerticalIcon className="h-5 w-5 text-gray-400" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                }}
              />
              <div className="absolute right-0 top-8 z-20 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[140px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(false)
                    onRenameFolder(node.id, node.name)
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Renombrar
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(false)
                    onDeleteFolder(node.id, node.name)
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Core badge - show if core and can't edit */}
      {node.isCore && !canEditCore && (
        <div className="absolute top-2 right-2">
          <LockClosedIcon className="h-4 w-4 text-amber-500" title="Core - Solo lectura" />
        </div>
      )}

      {/* Content Row: Icon + Text */}
      <div className="flex items-start space-x-3 pr-6">
        {/* Folder Icon */}
        <FolderIcon className={`h-6 w-6 flex-shrink-0 mt-0.5 ${node.isCore ? 'text-amber-600' : 'text-gray-700'}`} />

        {/* Text Content */}
        <div className="min-w-0 flex-1">
          {/* Folder Name */}
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-800 truncate">{node.name}</h3>
            {node.isCore && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                Core
              </span>
            )}
          </div>

          {/* Stats */}
          <p className="text-xs text-gray-500 mt-0.5">
            {dashboardCount > 0 && `${dashboardCount} dashboard${dashboardCount > 1 ? 's' : ''}`}
            {dashboardCount > 0 && vizCount > 0 && ' · '}
            {vizCount > 0 && `${vizCount} viz`}
            {(dashboardCount > 0 || vizCount > 0) && subfolderCount > 0 && ' · '}
            {subfolderCount > 0 && `${subfolderCount} carpetas`}
            {childCount === 0 && 'Vacia'}
          </p>
        </div>
      </div>
    </div>
  )
}

interface VizCardProps {
  node: VizTreeNode
  onSelect: (vizId: string) => void
  onDelete: (vizId: string, name: string) => void
  canEditCore: boolean
}

function VizCard({ node, onSelect, onDelete, canEditCore }: VizCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const Icon = getVizIcon(node.vizType)

  // Can edit this viz?
  const canEdit = !node.isCore || canEditCore

  return (
    <div
      className={`
        relative p-4 rounded-xl border-2 bg-white cursor-pointer transition-all duration-200
        transform hover:scale-105 ${
          node.isCore
            ? 'border-amber-200 bg-amber-50/50 hover:border-amber-400 hover:shadow-lg'
            : 'border-gray-200 hover:border-purple-400 hover:shadow-lg'
        }
      `}
      onClick={() => onSelect(node.id)}
    >
      {/* Menu Button - only show if can edit */}
      {canEdit && (
        <div className="absolute top-2 right-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <EllipsisVerticalIcon className="h-5 w-5 text-gray-400" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                }}
              />
              <div className="absolute right-0 top-8 z-20 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[140px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(false)
                    onDelete(node.id, node.name)
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Core badge - show if core and can't edit */}
      {node.isCore && !canEditCore && (
        <div className="absolute top-2 right-2">
          <LockClosedIcon className="h-4 w-4 text-amber-500" title="Core - Solo lectura" />
        </div>
      )}

      {/* Viz Icon */}
      <div className="mb-3">
        <Icon className={`h-10 w-10 ${node.isCore ? 'text-amber-500' : 'text-purple-500'}`} />
      </div>

      {/* Viz Name */}
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-medium text-gray-800 truncate">{node.name}</h3>
        {node.isCore && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
            Core
          </span>
        )}
      </div>

      {/* Type Badge */}
      <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
        node.isCore
          ? 'bg-amber-100 text-amber-700'
          : 'bg-purple-100 text-purple-700'
      }`}>
        {getVizTypeLabel(node.vizType)}
      </span>
    </div>
  )
}

interface DashboardCardProps {
  node: VizTreeNode
  onSelect: (dashboardId: string, isCore?: boolean) => void
  onDelete: (dashboardId: string, name: string) => void
  onPublishToCore?: (dashboardId: string, name: string) => void
  onRemoveFromCore?: (dashboardId: string, name: string) => void
  canEditCore: boolean
}

function DashboardCard({ node, onSelect, onDelete, onPublishToCore, onRemoveFromCore, canEditCore }: DashboardCardProps) {
  const [showMenu, setShowMenu] = useState(false)

  // Can edit this dashboard?
  const canEdit = !node.isCore || canEditCore

  return (
    <div
      className={`
        relative p-4 rounded-xl border-2 bg-white cursor-pointer transition-all duration-200
        transform hover:scale-105 ${
          node.isCore
            ? 'border-amber-200 bg-amber-50/50 hover:border-amber-400 hover:shadow-lg'
            : 'border-gray-200 hover:border-blue-400 hover:shadow-lg'
        }
      `}
      onClick={() => onSelect(node.id, node.isCore)}
    >
      {/* Menu Button - only show if can edit */}
      {canEdit && (
        <div className="absolute top-2 right-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <EllipsisVerticalIcon className="h-5 w-5 text-gray-400" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                }}
              />
              <div className="absolute right-0 top-8 z-20 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px]">
                {/* Publish to Core - only for non-core dashboards when user is SysOwner */}
                {!node.isCore && canEditCore && onPublishToCore && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMenu(false)
                      onPublishToCore(node.id, node.name)
                    }}
                    className="w-full flex items-center px-3 py-2 text-sm text-amber-700 hover:bg-amber-50"
                  >
                    <GlobeAltIcon className="h-4 w-4 mr-2" />
                    Publicar como Core
                  </button>
                )}
                {/* Remove from Core - only for core dashboards when user is SysOwner */}
                {node.isCore && canEditCore && onRemoveFromCore && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMenu(false)
                      onRemoveFromCore(node.id, node.name)
                    }}
                    className="w-full flex items-center px-3 py-2 text-sm text-orange-600 hover:bg-orange-50"
                  >
                    <GlobeAltIcon className="h-4 w-4 mr-2" />
                    Quitar de Core
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(false)
                    onDelete(node.id, node.name)
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Core badge - show if core and can't edit */}
      {node.isCore && !canEditCore && (
        <div className="absolute top-2 right-2">
          <LockClosedIcon className="h-4 w-4 text-amber-500" title="Core - Solo lectura" />
        </div>
      )}

      {/* Dashboard Icon */}
      <div className="mb-3">
        <Squares2X2Icon className={`h-10 w-10 ${node.isCore ? 'text-amber-500' : 'text-blue-500'}`} />
      </div>

      {/* Dashboard Name */}
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-medium text-gray-800 truncate">{node.name}</h3>
        {node.isCore && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
            Core
          </span>
        )}
      </div>

      {/* Type Badge */}
      <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
        node.isCore
          ? 'bg-amber-100 text-amber-700'
          : 'bg-blue-100 text-blue-700'
      }`}>
        Dashboard
      </span>
    </div>
  )
}

// ============================================================================
// LIST VIEW COMPONENTS
// ============================================================================

interface FolderListItemProps {
  node: VizTreeNode
  onOpen: (folderId: string) => void
  onDeleteFolder: (folderId: string, name: string) => void
  onRenameFolder: (folderId: string, currentName: string) => void
  canEditCore: boolean
}

function FolderListItem({ node, onOpen, onDeleteFolder, onRenameFolder, canEditCore }: FolderListItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const childCount = node.children?.length || 0
  const vizCount = node.children?.filter(c => c.type === 'viz').length || 0
  const dashboardCount = node.children?.filter(c => c.type === 'dashboard').length || 0
  const subfolderCount = node.children?.filter(c => c.type === 'folder').length || 0

  // Main Dashboards is a virtual folder - cannot be edited/deleted
  const isVirtualFolder = node.id === MAIN_DASHBOARDS_FOLDER_ID

  // Can edit this folder?
  // Virtual folders cannot be edited even by SysOwner
  const canEdit = !isVirtualFolder && (!node.isCore || canEditCore)

  return (
    <div
      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
        node.isCore
          ? 'bg-amber-50/50 border-amber-200 hover:bg-amber-50 hover:border-amber-300'
          : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
      }`}
      onClick={() => onOpen(node.id)}
    >
      {/* Icon and Name */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <FolderIcon className={`h-5 w-5 flex-shrink-0 ${node.isCore ? 'text-amber-500' : 'text-gray-500'}`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-800 truncate">{node.name}</h3>
            {node.isCore && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                Core
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {dashboardCount > 0 && `${dashboardCount} dashboard${dashboardCount > 1 ? 's' : ''}`}
            {dashboardCount > 0 && vizCount > 0 && ', '}
            {vizCount > 0 && `${vizCount} viz`}
            {(vizCount > 0 || dashboardCount > 0) && subfolderCount > 0 && ', '}
            {subfolderCount > 0 && `${subfolderCount} carpeta${subfolderCount > 1 ? 's' : ''}`}
            {childCount === 0 && 'Vacia'}
          </p>
        </div>
      </div>

      {/* Owner column - empty for folders */}
      <div className="w-32 text-sm text-gray-400 text-center hidden md:block">
        -
      </div>

      {/* Updated date column - empty for folders */}
      <div className="w-36 text-sm text-gray-400 text-center hidden md:block">
        -
      </div>

      {/* Menu - only show if can edit */}
      {canEdit ? (
        <div className="relative ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <EllipsisVerticalIcon className="h-5 w-5 text-gray-400" />
          </button>
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                }}
              />
              <div className="absolute right-0 top-8 z-20 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[140px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(false)
                    onRenameFolder(node.id, node.name)
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Renombrar
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(false)
                    onDeleteFolder(node.id, node.name)
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="ml-2 p-1.5">
          <LockClosedIcon className="h-5 w-5 text-amber-500" title="Core - Solo lectura" />
        </div>
      )}
    </div>
  )
}

interface VizListItemProps {
  node: VizTreeNode
  onSelect: (vizId: string) => void
  onDelete: (vizId: string, name: string) => void
  userNames: Record<string, string>
  canEditCore: boolean
}

function VizListItem({ node, onSelect, onDelete, userNames, canEditCore }: VizListItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const Icon = getVizIcon(node.vizType)

  // Can edit this viz?
  const canEdit = !node.isCore || canEditCore

  // Format date
  const formatDate = (date?: Date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  // Format owner (get name from map or fallback)
  const formatOwner = (userId?: string) => {
    if (!userId) return '-'
    return userNames[userId] || userId.slice(0, 8) + '...'
  }

  return (
    <div
      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
        node.isCore
          ? 'bg-amber-50/50 border-amber-200 hover:bg-amber-50 hover:border-amber-300'
          : 'bg-white border-gray-200 hover:bg-purple-50 hover:border-purple-300'
      }`}
      onClick={() => onSelect(node.id)}
    >
      {/* Icon and Name */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Icon className={`h-5 w-5 flex-shrink-0 ${node.isCore ? 'text-amber-500' : 'text-purple-500'}`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-800 truncate">{node.name}</h3>
            {node.isCore && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                Core
              </span>
            )}
          </div>
          <span className={`text-xs ${node.isCore ? 'text-amber-600' : 'text-purple-600'}`}>{getVizTypeLabel(node.vizType)}</span>
        </div>
      </div>

      {/* Owner column */}
      <div className="w-32 text-sm text-gray-600 text-center hidden md:block truncate" title={node.updatedBy}>
        {formatOwner(node.updatedBy)}
      </div>

      {/* Updated date column */}
      <div className="w-36 text-sm text-gray-600 text-center hidden md:block">
        {formatDate(node.updatedAt)}
      </div>

      {/* Menu - only show if can edit */}
      {canEdit ? (
        <div className="relative ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <EllipsisVerticalIcon className="h-5 w-5 text-gray-400" />
          </button>
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                }}
              />
              <div className="absolute right-0 top-8 z-20 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[140px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(false)
                    onDelete(node.id, node.name)
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="ml-2 p-1.5">
          <LockClosedIcon className="h-5 w-5 text-amber-500" title="Core - Solo lectura" />
        </div>
      )}
    </div>
  )
}

interface DashboardListItemProps {
  node: VizTreeNode
  onSelect: (dashboardId: string, isCore?: boolean) => void
  onDelete: (dashboardId: string, name: string) => void
  onPublishToCore?: (dashboardId: string, name: string) => void
  onRemoveFromCore?: (dashboardId: string, name: string) => void
  userNames: Record<string, string>
  canEditCore: boolean
}

function DashboardListItem({ node, onSelect, onDelete, onPublishToCore, onRemoveFromCore, userNames, canEditCore }: DashboardListItemProps) {
  const [showMenu, setShowMenu] = useState(false)

  // Can edit this dashboard?
  const canEdit = !node.isCore || canEditCore

  // Format date
  const formatDate = (date?: Date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  // Format owner (get name from map or fallback)
  const formatOwner = (userId?: string) => {
    if (!userId) return '-'
    return userNames[userId] || userId.slice(0, 8) + '...'
  }

  return (
    <div
      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
        node.isCore
          ? 'bg-amber-50/50 border-amber-200 hover:bg-amber-50 hover:border-amber-300'
          : 'bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-300'
      }`}
      onClick={() => onSelect(node.id, node.isCore)}
    >
      {/* Icon and Name */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Squares2X2Icon className={`h-5 w-5 flex-shrink-0 ${node.isCore ? 'text-amber-500' : 'text-blue-500'}`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-800 truncate">{node.name}</h3>
            {node.isCore && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                Core
              </span>
            )}
          </div>
          <span className={`text-xs ${node.isCore ? 'text-amber-600' : 'text-blue-600'}`}>Dashboard</span>
        </div>
      </div>

      {/* Owner column */}
      <div className="w-32 text-sm text-gray-600 text-center hidden md:block truncate" title={node.updatedBy}>
        {formatOwner(node.updatedBy)}
      </div>

      {/* Updated date column */}
      <div className="w-36 text-sm text-gray-600 text-center hidden md:block">
        {formatDate(node.updatedAt)}
      </div>

      {/* Menu - only show if can edit */}
      {canEdit ? (
        <div className="relative ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <EllipsisVerticalIcon className="h-5 w-5 text-gray-400" />
          </button>
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                }}
              />
              <div className="absolute right-0 top-8 z-20 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px]">
                {/* Publish to Core - only for non-core dashboards when user is SysOwner */}
                {!node.isCore && canEditCore && onPublishToCore && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMenu(false)
                      onPublishToCore(node.id, node.name)
                    }}
                    className="w-full flex items-center px-3 py-2 text-sm text-amber-700 hover:bg-amber-50"
                  >
                    <GlobeAltIcon className="h-4 w-4 mr-2" />
                    Publicar como Core
                  </button>
                )}
                {/* Remove from Core - only for core dashboards when user is SysOwner */}
                {node.isCore && canEditCore && onRemoveFromCore && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMenu(false)
                      onRemoveFromCore(node.id, node.name)
                    }}
                    className="w-full flex items-center px-3 py-2 text-sm text-orange-600 hover:bg-orange-50"
                  >
                    <GlobeAltIcon className="h-4 w-4 mr-2" />
                    Quitar de Core
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(false)
                    onDelete(node.id, node.name)
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="ml-2 p-1.5">
          <LockClosedIcon className="h-5 w-5 text-amber-500" title="Core - Solo lectura" />
        </div>
      )}
    </div>
  )
}

export default function Visualizations() {
  const navigate = useNavigate()
  const { currentTenant, currentUser, isSysOwner } = useAuth()

  const [tree, setTree] = useState<VizTreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check if user can edit core items (SysOwner has edit permission)
  const canEditCore = isSysOwner

  // Map of user IDs to display names
  const [userNames, setUserNames] = useState<Record<string, string>>({})

  // Navigation state - current folder path
  const [currentPath, setCurrentPath] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'Raiz' }
  ])

  // Delete confirmation modal
  const [deleteModal, setDeleteModal] = useState<{
    type: 'viz' | 'folder' | 'dashboard'
    id: string
    name: string
  } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Rename modal
  const [renameModal, setRenameModal] = useState<{
    folderId: string
    currentName: string
  } | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [renaming, setRenaming] = useState(false)


  // Create folder modal
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false)
  const [createFolderName, setCreateFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)

  // Core dashboard modal (publish/remove)
  const [coreModal, setCoreModal] = useState<{
    action: 'publish' | 'remove'
    dashboardId: string
    name: string
  } | null>(null)
  const [processingCore, setProcessingCore] = useState(false)

  // View mode: 'cards' or 'list'
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('list')

  // Load tree
  useEffect(() => {
    if (!currentTenant?.id) return

    const loadTree = async () => {
      setLoading(true)
      setError(null)
      try {
        const treeData = await getVizTreeWithCore(currentTenant.id)
        setTree(treeData)

        // Extract unique user IDs from tree
        const userIds = new Set<string>()
        const extractUserIds = (nodes: VizTreeNode[]) => {
          for (const node of nodes) {
            if (node.updatedBy) {
              userIds.add(node.updatedBy)
            }
            if (node.children) {
              extractUserIds(node.children)
            }
          }
        }
        extractUserIds(treeData)

        // Load user names
        const names: Record<string, string> = {}
        await Promise.all(
          Array.from(userIds).map(async (uid) => {
            try {
              const profile = await getUserProfile(uid)
              if (profile) {
                names[uid] = profile.displayName || profile.email || uid
              }
            } catch {
              // Ignore errors, will show fallback
            }
          })
        )
        setUserNames(names)
      } catch (err) {
        console.error('Error loading viz tree:', err)
        setError('Error al cargar visualizaciones')
      } finally {
        setLoading(false)
      }
    }

    loadTree()
  }, [currentTenant?.id])


  // Get current folder's contents
  const getCurrentContents = (): VizTreeNode[] => {
    const currentFolderId = currentPath[currentPath.length - 1].id

    if (currentFolderId === null) {
      return tree
    }

    // Find the folder in the tree
    const findFolder = (nodes: VizTreeNode[], targetId: string): VizTreeNode | null => {
      for (const node of nodes) {
        if (node.id === targetId) return node
        if (node.children) {
          const found = findFolder(node.children, targetId)
          if (found) return found
        }
      }
      return null
    }

    const folder = findFolder(tree, currentFolderId)
    return folder?.children || []
  }

  const handleOpenFolder = (folderId: string) => {
    const contents = getCurrentContents()
    const folder = contents.find(n => n.id === folderId && n.type === 'folder')
    if (folder) {
      setCurrentPath([...currentPath, { id: folder.id, name: folder.name }])
    }
  }

  const handleNavigateToPath = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1))
  }

  const handleSelectViz = (vizId: string) => {
    navigate(`/datasets-new?viz=${vizId}`)
  }

  const handleDeleteViz = (vizId: string, name: string) => {
    setDeleteModal({ type: 'viz', id: vizId, name })
  }

  const handleDeleteFolder = (folderId: string, name: string) => {
    setDeleteModal({ type: 'folder', id: folderId, name })
  }

  const handleSelectDashboard = (dashboardId: string, isCore?: boolean) => {
    if (isCore) {
      navigate(`/dashboard-editor?id=${dashboardId}&isCore=true`)
    } else {
      navigate(`/dashboard-editor?id=${dashboardId}`)
    }
  }

  const handleDeleteDashboard = (dashboardId: string, name: string) => {
    setDeleteModal({ type: 'dashboard', id: dashboardId, name })
  }

  // Core dashboard handlers (SysOwner only)
  const handlePublishToCore = (dashboardId: string, name: string) => {
    setCoreModal({ action: 'publish', dashboardId, name })
  }

  const handleRemoveFromCore = (dashboardId: string, name: string) => {
    setCoreModal({ action: 'remove', dashboardId, name })
  }

  const confirmCoreAction = async () => {
    if (!coreModal || !currentTenant?.id) return

    setProcessingCore(true)
    try {
      if (coreModal.action === 'publish') {
        await copyDashboardToCore(currentTenant.id, coreModal.dashboardId)
      } else {
        await deleteCoreDashboard(coreModal.dashboardId)
      }

      // Reload tree
      const treeData = await getVizTreeWithCore(currentTenant.id)
      setTree(treeData)
      setCoreModal(null)
    } catch (err) {
      console.error('Error processing core action:', err)
      setError(
        coreModal.action === 'publish'
          ? 'Error al publicar dashboard como Core'
          : 'Error al quitar dashboard de Core'
      )
    } finally {
      setProcessingCore(false)
    }
  }

  const handleRenameFolder = (folderId: string, currentName: string) => {
    setRenameModal({ folderId, currentName })
    setNewFolderName(currentName)
  }

  const confirmDelete = async () => {
    if (!deleteModal || !currentTenant?.id) return

    setDeleting(true)
    try {
      if (deleteModal.type === 'viz') {
        await deleteViz(currentTenant.id, deleteModal.id)
      } else if (deleteModal.type === 'dashboard') {
        await deleteDashboard(currentTenant.id, deleteModal.id)
      } else {
        const result = await deleteFolder(currentTenant.id, deleteModal.id)
        if (!result.success) {
          setError(result.error || 'Error al eliminar carpeta')
          setDeleting(false)
          setDeleteModal(null)
          return
        }
      }

      // Reload tree
      const treeData = await getVizTreeWithCore(currentTenant.id)
      setTree(treeData)
      setDeleteModal(null)
    } catch (err) {
      console.error('Error deleting:', err)
      setError('Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  const confirmRename = async () => {
    if (!renameModal || !currentTenant?.id || !newFolderName.trim()) return

    setRenaming(true)
    try {
      await updateFolder(currentTenant.id, renameModal.folderId, newFolderName.trim())

      // Reload tree
      const treeData = await getVizTreeWithCore(currentTenant.id)
      setTree(treeData)
      setRenameModal(null)
      setNewFolderName('')
    } catch (err) {
      console.error('Error renaming folder:', err)
      setError('Error al renombrar carpeta')
    } finally {
      setRenaming(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!currentTenant?.id || !currentUser?.uid || !createFolderName.trim()) return

    setCreatingFolder(true)
    try {
      // Get current folder id (null if at root)
      const parentFolderId = currentPath.length > 1 ? currentPath[currentPath.length - 1].id : null

      await createFolder(currentTenant.id, currentUser.uid, {
        name: createFolderName.trim(),
        parentId: parentFolderId
      })

      // Reload tree
      const treeData = await getVizTreeWithCore(currentTenant.id)
      setTree(treeData)
      setShowCreateFolderModal(false)
      setCreateFolderName('')
    } catch (err) {
      console.error('Error creating folder:', err)
      setError('Error al crear carpeta')
    } finally {
      setCreatingFolder(false)
    }
  }

  const currentContents = getCurrentContents()
  const folders = currentContents.filter(n => n.type === 'folder')
  const vizs = currentContents.filter(n => n.type === 'viz')
  const dashboards = currentContents.filter(n => n.type === 'dashboard')

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div>
        {/* Title */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-800">Todas las carpetas</h1>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Vista de tarjetas"
              >
                <Squares2X2Icon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Vista de lista"
              >
                <ListBulletIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Nueva Carpeta Button */}
            <button
              onClick={() => setShowCreateFolderModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FolderIcon className="h-4 w-4" />
              Nueva carpeta
            </button>
          </div>
        </div>

        {/* Breadcrumb Navigation */}
        {currentPath.length > 1 && (
          <div className="flex items-center space-x-2 mb-6 text-sm">
            {currentPath.map((item, index) => (
              <div key={index} className="flex items-center">
                {index > 0 && <span className="text-gray-400 mx-2">/</span>}
                <button
                  onClick={() => handleNavigateToPath(index)}
                  className={`hover:text-blue-600 transition-colors ${
                    index === currentPath.length - 1
                      ? 'text-gray-800 font-medium'
                      : 'text-gray-500'
                  }`}
                >
                  {item.name}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline hover:no-underline"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : currentContents.length === 0 ? (
          <div className="text-center py-20">
            <FolderIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {currentPath.length === 1
                ? 'No hay carpetas ni visualizaciones'
                : 'Esta carpeta esta vacia'}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Crea visualizaciones desde la pagina de Datasets
            </p>
          </div>
        ) : viewMode === 'cards' ? (
          /* CARDS VIEW */
          <div className="space-y-8">
            {/* Folders Grid */}
            {folders.length > 0 && (
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {folders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      node={folder}
                      onOpen={handleOpenFolder}
                      onDeleteFolder={handleDeleteFolder}
                      onRenameFolder={handleRenameFolder}
                      canEditCore={canEditCore}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Dashboards Grid */}
            {dashboards.length > 0 && (
              <div>
                {(folders.length > 0 || vizs.length > 0) && (
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
                    Dashboards
                  </h2>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {dashboards.map((dashboard) => (
                    <DashboardCard
                      key={dashboard.id}
                      node={dashboard}
                      onSelect={handleSelectDashboard}
                      onDelete={handleDeleteDashboard}
                      onPublishToCore={canEditCore ? handlePublishToCore : undefined}
                      onRemoveFromCore={canEditCore ? handleRemoveFromCore : undefined}
                      canEditCore={canEditCore}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Visualizations Grid */}
            {vizs.length > 0 && (
              <div>
                {(folders.length > 0 || dashboards.length > 0) && (
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
                    Visualizaciones
                  </h2>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {vizs.map((viz) => (
                    <VizCard
                      key={viz.id}
                      node={viz}
                      onSelect={handleSelectViz}
                      onDelete={handleDeleteViz}
                      canEditCore={canEditCore}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="space-y-4">
            {/* List Header */}
            <div className="flex items-center p-3 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200">
              <div className="flex-1">Nombre</div>
              <div className="w-32 text-center hidden md:block">Propietario</div>
              <div className="w-36 text-center hidden md:block">Actualizado</div>
              <div className="w-10"></div>
            </div>

            {/* Folders List */}
            {folders.length > 0 && (
              <div>
                <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 px-1">
                  Carpetas
                </h2>
                <div className="space-y-2">
                  {folders.map((folder) => (
                    <FolderListItem
                      key={folder.id}
                      node={folder}
                      onOpen={handleOpenFolder}
                      onDeleteFolder={handleDeleteFolder}
                      onRenameFolder={handleRenameFolder}
                      canEditCore={canEditCore}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Dashboards List */}
            {dashboards.length > 0 && (
              <div>
                <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 px-1">
                  Dashboards
                </h2>
                <div className="space-y-2">
                  {dashboards.map((dashboard) => (
                    <DashboardListItem
                      key={dashboard.id}
                      node={dashboard}
                      onSelect={handleSelectDashboard}
                      onDelete={handleDeleteDashboard}
                      onPublishToCore={canEditCore ? handlePublishToCore : undefined}
                      onRemoveFromCore={canEditCore ? handleRemoveFromCore : undefined}
                      userNames={userNames}
                      canEditCore={canEditCore}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Visualizations List */}
            {vizs.length > 0 && (
              <div>
                <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 px-1">
                  Visualizaciones
                </h2>
                <div className="space-y-2">
                  {vizs.map((viz) => (
                    <VizListItem
                      key={viz.id}
                      node={viz}
                      onSelect={handleSelectViz}
                      onDelete={handleDeleteViz}
                      userNames={userNames}
                      canEditCore={canEditCore}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Confirmar eliminacion
            </h3>
            <p className="text-gray-600 mb-4">
              {deleteModal.type === 'viz'
                ? `¿Estas seguro de eliminar la visualizacion "${deleteModal.name}"?`
                : deleteModal.type === 'dashboard'
                ? `¿Estas seguro de eliminar el dashboard "${deleteModal.name}"?`
                : `¿Estas seguro de eliminar la carpeta "${deleteModal.name}"? Solo se puede eliminar si esta vacia.`
              }
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteModal(null)}
                disabled={deleting}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Renombrar carpeta
            </h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nombre de la carpeta"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFolderName.trim()) {
                  confirmRename()
                } else if (e.key === 'Escape') {
                  setRenameModal(null)
                }
              }}
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setRenameModal(null)
                  setNewFolderName('')
                }}
                disabled={renaming}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRename}
                disabled={renaming || !newFolderName.trim()}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {renaming ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Crear nueva carpeta
            </h3>
            <input
              type="text"
              value={createFolderName}
              onChange={(e) => setCreateFolderName(e.target.value)}
              placeholder="Nombre de la carpeta"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && createFolderName.trim()) {
                  handleCreateFolder()
                } else if (e.key === 'Escape') {
                  setShowCreateFolderModal(false)
                  setCreateFolderName('')
                }
              }}
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateFolderModal(false)
                  setCreateFolderName('')
                }}
                disabled={creatingFolder}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={creatingFolder || !createFolderName.trim()}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {creatingFolder ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Core Dashboard Modal (Publish/Remove) */}
      {coreModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {coreModal.action === 'publish' ? 'Publicar como Core' : 'Quitar de Core'}
            </h3>
            <p className="text-gray-600 mb-4">
              {coreModal.action === 'publish'
                ? `¿Publicar "${coreModal.name}" como dashboard Core? Sera visible para todos los usuarios de la plataforma.`
                : `¿Quitar "${coreModal.name}" de los dashboards Core? Los usuarios ya no podran verlo como plantilla.`
              }
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setCoreModal(null)}
                disabled={processingCore}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmCoreAction}
                disabled={processingCore}
                className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                  coreModal.action === 'publish'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {processingCore
                  ? (coreModal.action === 'publish' ? 'Publicando...' : 'Quitando...')
                  : (coreModal.action === 'publish' ? 'Publicar' : 'Quitar')
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

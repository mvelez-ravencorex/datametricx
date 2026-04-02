import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, ChevronUpIcon, ArrowLeftIcon, MagnifyingGlassIcon, FolderIcon, FolderOpenIcon, PlusIcon } from '@heroicons/react/24/outline'
import {
  ChartBarIcon,
  ShoppingCartIcon,
  MegaphoneIcon,
  CogIcon,
  Squares2X2Icon,
  LinkIcon,
  TableCellsIcon,
  CodeBracketIcon,
  CubeIcon,
} from '@heroicons/react/24/outline'
import type { SemanticDataset, FileTreeNode } from '@/types/semantic'
import { getModelsTree, getFileContent } from '@/services/semanticService'

// Types para datasets mode
interface DatasetWithMeta extends SemanticDataset {
  group: string
  subgroup: string
  path: string
}

interface GroupedDatasets {
  [group: string]: {
    [subgroup: string]: DatasetWithMeta[]
  }
}

interface NavigationItem {
  name: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  children?: NavigationItem[]
}

const baseNavigation: NavigationItem[] = [
  { name: 'Overview', href: '/dashboard', icon: Squares2X2Icon },
  { name: 'Carpetas', href: '/visualizations', icon: FolderIcon },
  { name: 'Sales', href: '/sales', icon: ShoppingCartIcon },
  { name: 'Marketing', href: '/marketing', icon: MegaphoneIcon },
  { name: 'Operations', href: '/operations', icon: ChartBarIcon },
  {
    name: 'Tools',
    icon: CogIcon,
    children: [
      { name: 'Explorar', href: '/explore', icon: TableCellsIcon },
      { name: 'Integraciones', href: '/connections', icon: LinkIcon },
      { name: 'Development', href: '/development', icon: CodeBracketIcon },
    ]
  },
  { name: 'Settings', href: '/settings', icon: CogIcon },
]

interface SidebarProps {
  open: boolean
  collapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}

export default function Sidebar({ open, collapsed, onClose, onToggleCollapse }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const navigation = baseNavigation
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['Tools']))

  // Create dropdown state
  const [showCreateDropdown, setShowCreateDropdown] = useState(false)
  const createDropdownRef = useRef<HTMLDivElement>(null)

  // Datasets mode state
  const isDatasetsMode = location.pathname === '/explore'
  const [datasetsLoading, setDatasetsLoading] = useState(false)
  const [datasetsError, setDatasetsError] = useState<string | null>(null)
  const [groupedDatasets, setGroupedDatasets] = useState<GroupedDatasets>({})
  const [datasetsSearch, setDatasetsSearch] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedSubgroups, setExpandedSubgroups] = useState<Set<string>>(new Set())
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null)

  // Auto-expand Tools section when on datasets-new, connections, or development
  useEffect(() => {
    const path = location.pathname
    if (path === '/explore' || path === '/connections' || path === '/development') {
      setExpandedItems(prev => {
        const next = new Set(prev)
        next.add('Tools')
        return next
      })
    }
  }, [location.pathname])

  // Close create dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (createDropdownRef.current && !createDropdownRef.current.contains(event.target as Node)) {
        setShowCreateDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle create actions
  const handleCreateViz = () => {
    setShowCreateDropdown(false)
    navigate('/datasets-new?mode=viz')
  }

  const handleCreateDashboard = () => {
    setShowCreateDropdown(false)
    navigate('/dashboard-editor')
  }

  // Load datasets when in datasets mode
  useEffect(() => {
    if (!isDatasetsMode) return

    const loadDatasets = async () => {
      setDatasetsLoading(true)
      setDatasetsError(null)
      try {
        // 1. Get file tree
        const treeResponse = await getModelsTree()

        // 2. Find all dataset files
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

        // 3. Load content of each dataset
        const loadedDatasets: DatasetWithMeta[] = []
        for (const file of datasetFiles) {
          try {
            const content = await getFileContent(file.path)
            const dataset = content.content as SemanticDataset & { group?: string; subgroup?: string }
            if (dataset.type === 'dataset') {
              loadedDatasets.push({
                ...dataset,
                group: dataset.group || 'Sin grupo',
                subgroup: dataset.subgroup || 'General',
                path: file.path,
              })
            }
          } catch (err) {
            console.warn(`Error loading dataset ${file.path}:`, err)
          }
        }

        // 4. Group by group > subgroup
        const grouped: GroupedDatasets = {}
        for (const dataset of loadedDatasets) {
          const { group, subgroup } = dataset
          if (!grouped[group]) grouped[group] = {}
          if (!grouped[group][subgroup]) grouped[group][subgroup] = []
          grouped[group][subgroup].push(dataset)
        }
        setGroupedDatasets(grouped)

        // 5. Expand first group by default
        if (Object.keys(grouped).length > 0) {
          const firstGroup = Object.keys(grouped)[0]
          setExpandedGroups(new Set([firstGroup]))
          if (Object.keys(grouped[firstGroup]).length > 0) {
            const firstSubgroup = Object.keys(grouped[firstGroup])[0]
            setExpandedSubgroups(new Set([`${firstGroup}-${firstSubgroup}`]))
          }
        }
      } catch (err) {
        console.error('Error loading datasets:', err)
        setDatasetsError(err instanceof Error ? err.message : 'Error al cargar datasets')
      } finally {
        setDatasetsLoading(false)
      }
    }

    loadDatasets()
  }, [isDatasetsMode])

  // Filter datasets by search
  const filteredGrouped = (): GroupedDatasets => {
    if (!datasetsSearch.trim()) return groupedDatasets

    const query = datasetsSearch.toLowerCase()
    const filtered: GroupedDatasets = {}

    for (const [group, subgroups] of Object.entries(groupedDatasets)) {
      for (const [subgroup, dsList] of Object.entries(subgroups)) {
        const matchingDatasets = dsList.filter(
          ds =>
            ds.label.toLowerCase().includes(query) ||
            ds.id.toLowerCase().includes(query) ||
            ds.description?.toLowerCase().includes(query)
        )
        if (matchingDatasets.length > 0) {
          if (!filtered[group]) filtered[group] = {}
          filtered[group][subgroup] = matchingDatasets
        }
      }
    }

    return filtered
  }

  const handleToggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(group)) {
        next.delete(group)
      } else {
        next.add(group)
      }
      return next
    })
  }

  const handleToggleSubgroup = (key: string) => {
    setExpandedSubgroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleSelectDataset = (dataset: DatasetWithMeta) => {
    setSelectedDatasetId(dataset.id)
    // Dispatch custom event to notify DatasetsNew page
    window.dispatchEvent(new CustomEvent('dataset-selected', { detail: dataset }))
  }

  const handleBackToMenu = () => {
    navigate('/dashboard')
  }

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemName)) {
        next.delete(itemName)
      } else {
        next.add(itemName)
      }
      return next
    })
  }

  return (
    <>
      {/* Overlay para mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 bg-white shadow-lg transform transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } ${
          collapsed ? 'w-20' : 'w-56'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Datasets Mode Sidebar - Collapsed */}
          {isDatasetsMode && collapsed ? (
            <div className="flex flex-col h-full">
              {/* Collapsed Header */}
              <div className="flex items-center justify-center h-16 border-b border-gray-200">
                <CubeIcon className="h-6 w-6 text-blue-600" />
              </div>

              {/* Expand button at bottom */}
              <div className="flex-1" />
              <div className="border-t border-gray-200 p-2">
                <button
                  onClick={onToggleCollapse}
                  className="w-full flex items-center justify-center p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                  title="Expandir sidebar"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : isDatasetsMode && !collapsed ? (
            <>
              {/* Header - Datasets title */}
              <div className="px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Explorar</h2>
                <p className="text-xs text-gray-500 mt-1">Capa Semántica</p>
              </div>

              {/* Search */}
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar datasets..."
                    value={datasetsSearch}
                    onChange={(e) => setDatasetsSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Back Button */}
              <div className="px-4 py-2 border-b border-gray-200">
                <button
                  onClick={handleBackToMenu}
                  className="flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Volver al menú
                </button>
              </div>

              {/* Datasets List */}
              <div className="flex-1 overflow-y-auto px-3 py-3">
                {datasetsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : datasetsError ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-red-600">{datasetsError}</p>
                  </div>
                ) : (
                  (() => {
                    const displayedGroups = filteredGrouped()
                    if (Object.keys(displayedGroups).length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-500">
                          <CubeIcon className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                          <p className="text-xs">No se encontraron datasets</p>
                        </div>
                      )
                    }

                    return Object.entries(displayedGroups).map(([groupName, subgroups]) => {
                      const isGroupExpanded = expandedGroups.has(groupName)
                      const totalDatasets = Object.values(subgroups).reduce((acc, arr) => acc + arr.length, 0)

                      return (
                        <div key={groupName} className="mb-2">
                          {/* Group Header */}
                          <button
                            onClick={() => handleToggleGroup(groupName)}
                            className="w-full flex items-center px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            {isGroupExpanded ? (
                              <ChevronDownIcon className="h-3 w-3 text-gray-500 mr-1.5" />
                            ) : (
                              <ChevronRightIcon className="h-3 w-3 text-gray-500 mr-1.5" />
                            )}
                            {isGroupExpanded ? (
                              <FolderOpenIcon className="h-4 w-4 text-blue-500 mr-2" />
                            ) : (
                              <FolderIcon className="h-4 w-4 text-blue-500 mr-2" />
                            )}
                            <span className="text-sm font-medium text-gray-900 truncate">{groupName}</span>
                            <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {totalDatasets}
                            </span>
                          </button>

                          {/* Subgroups */}
                          {isGroupExpanded && (
                            <div className="ml-4 mt-1">
                              {Object.entries(subgroups).map(([subgroupName, datasets]) => {
                                const subgroupKey = `${groupName}-${subgroupName}`
                                const isSubgroupExpanded = expandedSubgroups.has(subgroupKey)

                                return (
                                  <div key={subgroupKey} className="mb-1">
                                    {/* Subgroup Header */}
                                    <button
                                      onClick={() => handleToggleSubgroup(subgroupKey)}
                                      className="w-full flex items-center px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                      {isSubgroupExpanded ? (
                                        <ChevronDownIcon className="h-2.5 w-2.5 text-gray-400 mr-1.5" />
                                      ) : (
                                        <ChevronRightIcon className="h-2.5 w-2.5 text-gray-400 mr-1.5" />
                                      )}
                                      {isSubgroupExpanded ? (
                                        <FolderOpenIcon className="h-3.5 w-3.5 text-purple-500 mr-1.5" />
                                      ) : (
                                        <FolderIcon className="h-3.5 w-3.5 text-purple-500 mr-1.5" />
                                      )}
                                      <span className="text-xs text-gray-700 truncate">{subgroupName}</span>
                                      <span className="ml-auto text-xs text-gray-400">{datasets.length}</span>
                                    </button>

                                    {/* Datasets */}
                                    {isSubgroupExpanded && (
                                      <div className="ml-5 mt-1">
                                        {datasets.map((dataset) => {
                                          const isSelected = selectedDatasetId === dataset.id

                                          return (
                                            <button
                                              key={dataset.id}
                                              onClick={() => handleSelectDataset(dataset)}
                                              title={dataset.description || dataset.label}
                                              className={`w-full flex items-center px-2 py-1.5 rounded-lg transition-colors text-left ${
                                                isSelected
                                                  ? 'bg-blue-100 text-blue-900'
                                                  : 'hover:bg-gray-50 text-gray-700'
                                              }`}
                                            >
                                              <CubeIcon className={`h-3.5 w-3.5 mr-1.5 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-purple-500'}`} />
                                              <span className="text-xs truncate">{dataset.label}</span>
                                            </button>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })
                  })()
                )}
              </div>

              {/* Footer con botón colapsar */}
              <div className="border-t border-gray-200 p-2">
                <button
                  onClick={onToggleCollapse}
                  className="w-full flex items-center justify-center p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                  title="Colapsar sidebar"
                >
                  <ChevronLeftIcon className="h-5 w-5 mr-2" />
                  <span className="text-sm">Colapsar</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Header del Sidebar */}
              <div className="flex items-center justify-end h-16 px-4 border-b border-gray-200">
                {!collapsed && (
                  <button
                    onClick={onClose}
                    className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                )}
              </div>

              {/* Create Button */}
              <div className="px-4 py-4" ref={createDropdownRef}>
                <div className="relative">
                  <button
                    onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                    className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-center gap-2'} px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm`}
                    title={collapsed ? 'Crear' : undefined}
                  >
                    <PlusIcon className="h-5 w-5" />
                    {!collapsed && <span className="font-medium">Crear</span>}
                    {!collapsed && <ChevronDownIcon className="h-4 w-4 ml-auto" />}
                  </button>

                  {/* Dropdown */}
                  {showCreateDropdown && (
                    <div className={`absolute ${collapsed ? 'left-full ml-2' : 'left-0 right-0'} top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50`}>
                      <button
                        onClick={handleCreateViz}
                        className="w-full flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <ChartBarIcon className="h-4 w-4 mr-3 text-purple-500" />
                        Visualizacion
                      </button>
                      <button
                        onClick={handleCreateDashboard}
                        className="w-full flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Squares2X2Icon className="h-4 w-4 mr-3 text-blue-500" />
                        Dashboard
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const hasChildren = item.children && item.children.length > 0
              const isExpanded = expandedItems.has(item.name)

              // Si tiene children, es un item expandible
              if (hasChildren) {
                // Check if any child route is active
                const hasActiveChild = item.children?.some(child =>
                  child.children?.some(grandchild => location.pathname === grandchild.href) ||
                  location.pathname === child.href
                ) || false

                return (
                  <div key={item.name} className="space-y-1">
                    {/* Parent Item */}
                    <button
                      onClick={() => toggleExpanded(item.name)}
                      className={`group relative w-full flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-150 ${
                        hasActiveChild
                          ? 'bg-blue-50 text-primary-blue'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      title={collapsed ? item.name : undefined}
                    >
                      <div className={`flex items-center ${collapsed ? 'justify-center' : ''}`}>
                        <item.icon className={`h-5 w-5 ${collapsed ? '' : 'mr-3'} flex-shrink-0`} />
                        {!collapsed && item.name}
                      </div>

                      {!collapsed && (
                        isExpanded ? (
                          <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                        )
                      )}

                      {/* Tooltip cuando está colapsado */}
                      {collapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                          {item.name}
                        </div>
                      )}
                    </button>

                    {/* Children Items */}
                    {!collapsed && isExpanded && (
                      <div className="ml-4 space-y-1">
                        {item.children!.map((child) => {
                          const hasGrandChildren = child.children && child.children.length > 0
                          const isChildExpanded = expandedItems.has(`${item.name}-${child.name}`)

                          if (hasGrandChildren) {
                            // Check if any table in this platform is active
                            const hasActiveTable = child.children?.some(table =>
                              location.pathname === table.href
                            ) || false

                            return (
                              <div key={child.name} className="space-y-1">
                                {/* Platform Header */}
                                <button
                                  onClick={() => toggleExpanded(`${item.name}-${child.name}`)}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg ${
                                    hasActiveTable
                                      ? 'bg-blue-50 text-primary-blue'
                                      : 'text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center">
                                    <child.icon className="h-4 w-4 mr-2 flex-shrink-0" />
                                    {child.name}
                                  </div>
                                  {isChildExpanded ? (
                                    <ChevronUpIcon className="h-3 w-3" />
                                  ) : (
                                    <ChevronDownIcon className="h-3 w-3" />
                                  )}
                                </button>

                                {/* Tables */}
                                {isChildExpanded && (
                                  <div className="ml-6 space-y-1">
                                    {child.children!.map((table) => {
                                      const isTableActive = location.pathname === table.href
                                      return (
                                        <Link
                                          key={table.name}
                                          to={table.href!}
                                          onClick={() => {
                                            if (window.innerWidth < 1024) {
                                              onClose()
                                            }
                                          }}
                                          className={`flex items-center px-3 py-2 text-xs rounded-lg transition-colors ${
                                            isTableActive
                                              ? 'bg-blue-50 text-primary-blue font-medium'
                                              : 'text-gray-600 hover:bg-gray-50'
                                          }`}
                                        >
                                          {table.name}
                                        </Link>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          }

                          // Child sin grandchildren
                          const isChildActive = location.pathname === child.href
                          return (
                            <Link
                              key={child.name}
                              to={child.href!}
                              onClick={() => {
                                if (window.innerWidth < 1024) {
                                  onClose()
                                }
                              }}
                              className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                                isChildActive
                                  ? 'bg-primary-blue text-white'
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <child.icon className="h-4 w-4 mr-2 flex-shrink-0" />
                              {child.name}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              // Item simple sin children
              const isActive = location.pathname === item.href ||
                              (item.href === '/dashboard' && location.pathname === '/')
              return (
                <Link
                  key={item.name}
                  to={item.href!}
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      onClose()
                    }
                  }}
                  className={`group relative flex items-center ${collapsed ? 'justify-center' : ''} px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-150 ${
                    isActive
                      ? 'bg-primary-blue text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon className={`h-5 w-5 ${collapsed ? '' : 'mr-3'} flex-shrink-0`} aria-hidden="true" />
                  {!collapsed && item.name}

                  {/* Tooltip cuando está colapsado */}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                      {item.name}
                    </div>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Footer del Sidebar */}
          <div className="border-t border-gray-200">
            {/* Toggle Collapse Button - Solo en desktop */}
            <div className="hidden lg:block p-2 border-b border-gray-200">
              <button
                onClick={onToggleCollapse}
                className="w-full flex items-center justify-center p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
              >
                {collapsed ? (
                  <ChevronRightIcon className="h-5 w-5" />
                ) : (
                  <>
                    <ChevronLeftIcon className="h-5 w-5 mr-2" />
                    <span className="text-sm">Colapsar</span>
                  </>
                )}
              </button>
            </div>

            {/* User Info */}
            {!collapsed ? (
              <div className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-700">JD</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">John Doe</p>
                    <p className="text-xs text-gray-500 truncate">john@example.com</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 flex justify-center">
                <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700">JD</span>
                </div>
              </div>
            )}
          </div>
          </>
          )}
        </div>
      </div>
    </>
  )
}

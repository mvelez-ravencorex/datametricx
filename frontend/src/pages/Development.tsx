/**
 * Development - IDE para explorar la Capa Semántica
 *
 * Layout:
 * - Columna izquierda: FileTree con estructura de carpetas/archivos
 * - Columna derecha: Visor de código JSON con syntax highlighting
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import Editor, { Monaco } from '@monaco-editor/react'
import {
  FolderIcon,
  FolderOpenIcon,
  DocumentTextIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CodeBracketIcon,
  TableCellsIcon,
  CubeIcon,
  SunIcon,
  MoonIcon,
  ArrowPathIcon,
  PencilIcon,
  XMarkIcon,
  CheckIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'
import type { FileTreeNode, SemanticEntity, SemanticDataset } from '@/types/semantic'
import {
  getModelsTree,
  getFileContent,
  saveFileContent,
} from '@/services/semanticService'
import { useAuth } from '@/contexts/AuthContext'

// ============================================================================
// Monaco DSL Language Configuration
// ============================================================================

const configureDslLanguage = (monaco: Monaco) => {
  // Register a new language
  monaco.languages.register({ id: 'semantic-dsl' })

  // Register a tokens provider for the language
  monaco.languages.setMonarchTokensProvider('semantic-dsl', {
    tokenizer: {
      root: [
        // Headers - Entity, Dataset
        [/^(Entity|Dataset)\s+/, 'keyword.header'],
        // Semantic items - attribute, metric, join
        [/^\s*(attribute|metric|join)\s+/, 'keyword.item'],
        // Keys (word followed by colon)
        [/(\w+)(?=:)/, 'key'],
        // Colon separator
        [/:/, 'delimiter'],
        // SQL values (ending with semicolon)
        [/[^;]+;/, 'sql'],
        // Strings with double quotes
        [/"[^"]*"/, 'string'],
        // Booleans
        [/\b(true|false)\b/, 'boolean'],
        // Null
        [/\bnull\b/, 'null'],
        // Numbers
        [/-?\d+(\.\d+)?/, 'number'],
        // Brackets
        [/[{}[\]]/, 'bracket'],
        // Type keywords (entity, dataset, string, number, date, etc.)
        [/\b(entity|dataset|string|number|date|boolean|currency|percent|time)\b/, 'type'],
        // SQL aggregation keywords
        [/\b(SUM|AVG|COUNT|MIN|MAX|CUSTOM)\b/, 'sql-agg'],
        // Identifiers (for entity/attribute ids after keywords)
        [/\w+/, 'identifier'],
      ],
    },
  })

  // Define a theme for the DSL (light)
  monaco.editor.defineTheme('semantic-dsl-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword.header', foreground: 'CA8A04', fontStyle: 'bold' }, // yellow-600
      { token: 'keyword.item', foreground: '0891B2', fontStyle: 'bold' }, // cyan-600
      { token: 'key', foreground: '9333EA' }, // purple-600
      { token: 'string', foreground: '16A34A' }, // green-600
      { token: 'number', foreground: 'EA580C' }, // orange-600
      { token: 'boolean', foreground: '2563EB' }, // blue-600
      { token: 'null', foreground: '6B7280' }, // gray-500
      { token: 'bracket', foreground: '6B7280' }, // gray-500
      { token: 'delimiter', foreground: '6B7280' }, // gray-500
      { token: 'identifier', foreground: '16A34A' }, // green-600
      { token: 'sql', foreground: 'DC2626' }, // red-600
      { token: 'type', foreground: '0891B2' }, // cyan-600
      { token: 'sql-agg', foreground: '7C3AED' }, // violet-600
    ],
    colors: {
      'editor.background': '#F9FAFB', // gray-50
    },
  })

  // Define a theme for the DSL (dark)
  monaco.editor.defineTheme('semantic-dsl-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword.header', foreground: 'FACC15', fontStyle: 'bold' }, // yellow-400
      { token: 'keyword.item', foreground: '22D3EE', fontStyle: 'bold' }, // cyan-400
      { token: 'key', foreground: 'C084FC' }, // purple-400
      { token: 'string', foreground: '4ADE80' }, // green-400
      { token: 'number', foreground: 'FB923C' }, // orange-400
      { token: 'boolean', foreground: '60A5FA' }, // blue-400
      { token: 'null', foreground: '9CA3AF' }, // gray-400
      { token: 'bracket', foreground: '9CA3AF' }, // gray-400
      { token: 'delimiter', foreground: '9CA3AF' }, // gray-400
      { token: 'identifier', foreground: '4ADE80' }, // green-400
      { token: 'sql', foreground: 'F87171' }, // red-400
      { token: 'type', foreground: '22D3EE' }, // cyan-400
      { token: 'sql-agg', foreground: 'A78BFA' }, // violet-400
    ],
    colors: {
      'editor.background': '#111827', // gray-900
    },
  })
}

// ============================================================================
// FileTree Component
// ============================================================================

interface FileTreeItemProps {
  node: FileTreeNode
  level: number
  selectedPath: string | null
  expandedFolders: Set<string>
  onSelect: (node: FileTreeNode) => void
  onToggleFolder: (path: string) => void
}

function FileTreeItem({
  node,
  level,
  selectedPath,
  expandedFolders,
  onSelect,
  onToggleFolder,
}: FileTreeItemProps) {
  const isFolder = node.type === 'folder'
  const isExpanded = expandedFolders.has(node.path)
  const isSelected = selectedPath === node.path
  const hasChildren = node.children && node.children.length > 0

  const handleClick = () => {
    if (isFolder) {
      onToggleFolder(node.path)
    } else {
      onSelect(node)
    }
  }

  // Icono según tipo
  const getIcon = () => {
    if (isFolder) {
      return isExpanded ? (
        <FolderOpenIcon className="h-4 w-4 text-yellow-500" />
      ) : (
        <FolderIcon className="h-4 w-4 text-yellow-500" />
      )
    }

    // Icono según tipo de entidad
    if (node.entityType === 'dataset') {
      return <CubeIcon className="h-4 w-4 text-purple-500" />
    }
    return <TableCellsIcon className="h-4 w-4 text-blue-500" />
  }

  return (
    <div>
      <div
        onClick={handleClick}
        className={`flex items-center px-2 py-1.5 cursor-pointer rounded-md transition-colors ${
          isSelected
            ? 'bg-blue-100 text-blue-900'
            : 'hover:bg-gray-100 text-gray-700'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {/* Chevron para folders */}
        {isFolder && hasChildren ? (
          isExpanded ? (
            <ChevronDownIcon className="h-3 w-3 mr-1 text-gray-500" />
          ) : (
            <ChevronRightIcon className="h-3 w-3 mr-1 text-gray-500" />
          )
        ) : (
          <span className="w-4" />
        )}

        {/* Icono */}
        <span className="mr-2">{getIcon()}</span>

        {/* Nombre */}
        <span className="text-sm truncate">{node.name}</span>
      </div>

      {/* Children */}
      {isFolder && isExpanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              expandedFolders={expandedFolders}
              onSelect={onSelect}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// JSON Viewer Component
// ============================================================================

interface JsonViewerProps {
  content: SemanticEntity | SemanticDataset | null
  contentToDsl: string
  selectedFile: FileTreeNode | null
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onRefresh: () => void
  isRefreshing?: boolean
  error?: string | null
  // Edit mode props
  isEditing: boolean
  editContent: string
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: () => void
  onEditContentChange: (content: string) => void
  isSaving?: boolean
  editError?: string | null
  // Demo mode - read only
  isDemoMode?: boolean
}

function JsonViewer({
  content,
  contentToDsl,
  selectedFile,
  theme,
  onToggleTheme,
  onRefresh,
  isRefreshing,
  error,
  isEditing,
  editContent,
  onStartEdit,
  onCancelEdit,
  onSave,
  onEditContentChange,
  isSaving,
  editError,
  isDemoMode = false
}: JsonViewerProps) {
  const isDark = theme === 'dark'

  if (!selectedFile) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <DocumentTextIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">Selecciona un archivo</p>
          <p className="text-sm mt-1">El contenido se mostrará aquí</p>
        </div>
      </div>
    )
  }

  if (selectedFile.type === 'folder') {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <FolderOpenIcon className="h-16 w-16 mx-auto mb-4 text-yellow-400" />
          <p className="text-lg font-medium">{selectedFile.name}</p>
          <p className="text-sm mt-1">
            {selectedFile.children?.length || 0} elementos
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-gray-900 mb-2">Error al cargar archivo</p>
          <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg font-mono break-all">{error}</p>
          <button
            onClick={onRefresh}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header con info del archivo */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2">
          {selectedFile.entityType === 'dataset' ? (
            <CubeIcon className="h-5 w-5 text-purple-500" />
          ) : (
            <TableCellsIcon className="h-5 w-5 text-blue-500" />
          )}
          <span className="font-medium text-gray-900">{selectedFile.name}</span>
          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
            {selectedFile.entityType === 'dataset' ? 'Dataset' : 'Entity'}
          </span>
        </div>
        <div className="flex items-center space-x-4">
          {isEditing ? (
            <>
              {/* Cancel Button */}
              <button
                onClick={onCancelEdit}
                disabled={isSaving}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50"
                title="Cancelar edición"
              >
                <XMarkIcon className="h-4 w-4 text-gray-600" />
                <span className="text-xs text-gray-600">Cancelar</span>
              </button>
              {/* Save Button */}
              <button
                onClick={onSave}
                disabled={isSaving}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
                title="Guardar cambios"
              >
                {isSaving ? (
                  <ArrowPathIcon className="h-4 w-4 text-white animate-spin" />
                ) : (
                  <CheckIcon className="h-4 w-4 text-white" />
                )}
                <span className="text-xs text-white">{isSaving ? 'Guardando...' : 'Guardar'}</span>
              </button>
            </>
          ) : (
            <>
              {/* Edit Button - disabled in demo mode */}
              {isDemoMode ? (
                <div
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-md bg-gray-300 cursor-not-allowed"
                  title="Edición deshabilitada en modo demo"
                >
                  <LockClosedIcon className="h-4 w-4 text-gray-500" />
                  <span className="text-xs text-gray-500">Solo lectura</span>
                </div>
              ) : (
                <button
                  onClick={onStartEdit}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 transition-colors"
                  title="Editar contenido"
                >
                  <PencilIcon className="h-4 w-4 text-white" />
                  <span className="text-xs text-white">Editar</span>
                </button>
              )}
              {/* Refresh Button */}
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center space-x-1 px-2 py-1 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                title="Actualizar contenido"
              >
                <ArrowPathIcon className={`h-4 w-4 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="text-xs text-gray-600">Actualizar</span>
              </button>
              {/* Theme Toggle */}
              <button
                onClick={onToggleTheme}
                className="flex items-center space-x-1 px-2 py-1 rounded-md hover:bg-gray-200 transition-colors"
                title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                {isDark ? (
                  <SunIcon className="h-4 w-4 text-gray-600" />
                ) : (
                  <MoonIcon className="h-4 w-4 text-gray-600" />
                )}
                <span className="text-xs text-gray-600">{isDark ? 'Light' : 'Dark'}</span>
              </button>
            </>
          )}
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <CodeBracketIcon className="h-4 w-4" />
            <span>Semantic</span>
          </div>
        </div>
      </div>

      {/* Metadata cards */}
      {'label' in content && (
        <div className="px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex flex-wrap gap-4">
            <div>
              <span className="text-xs text-gray-500">Label</span>
              <p className="text-sm font-medium">{content.label}</p>
            </div>
            {'category' in content && content.category && (
              <div>
                <span className="text-xs text-gray-500">Category</span>
                <p className="text-sm font-medium">{content.category}</p>
              </div>
            )}
            {'subcategory' in content && content.subcategory && (
              <div>
                <span className="text-xs text-gray-500">Subcategory</span>
                <p className="text-sm font-medium">{content.subcategory}</p>
              </div>
            )}
            {'attributes' in content && (
              <div>
                <span className="text-xs text-gray-500">Attributes</span>
                <p className="text-sm font-medium">{content.attributes.length}</p>
              </div>
            )}
            {'metrics' in content && (
              <div>
                <span className="text-xs text-gray-500">Metrics</span>
                <p className="text-sm font-medium">{content.metrics.length}</p>
              </div>
            )}
            {'relationships' in content && (
              <div>
                <span className="text-xs text-gray-500">Relationships</span>
                <p className="text-sm font-medium">{content.relationships.length}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Code Editor - Monaco for both view and edit */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {editError && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200">
            <p className="text-sm text-red-600">{editError}</p>
          </div>
        )}
        <div className="flex-1">
          <Editor
            height="100%"
            language="semantic-dsl"
            theme={isDark ? 'semantic-dsl-dark' : 'semantic-dsl-light'}
            value={isEditing ? editContent : contentToDsl}
            onChange={isEditing ? (value) => onEditContentChange(value || '') : undefined}
            beforeMount={configureDslLanguage}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              readOnly: !isEditing,
              domReadOnly: !isEditing,
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// JSON to DSL Conversion
// ============================================================================

const jsonToDsl = (content: SemanticEntity | SemanticDataset): string => {
  const formatValue = (value: unknown, indent: number): string => {
    const spaces = '  '.repeat(indent)

    if (value === null) return 'null'
    if (typeof value === 'boolean') return String(value)
    if (typeof value === 'number') return String(value)
    if (typeof value === 'string') return `"${value}"`

    if (Array.isArray(value)) {
      if (value.length === 0) return '[]'
      const items = value.map(item => `${spaces}  ${formatValue(item, indent + 1)}`).join('\n')
      return `[\n${items}\n${spaces}]`
    }

    if (typeof value === 'object') {
      return formatObject(value as Record<string, unknown>, indent)
    }

    return String(value)
  }

  // Fields that don't use quotes
  const noQuoteFields = ['type', 'sql_agg', 'sort', 'enabled', 'default', 'join_type', 'strategy', 'trigger']
  // Fields that don't use quotes and end with semicolon
  const sqlFields = ['sql', 'sql_table', 'sql_on']

  const formatFieldValue = (key: string, value: unknown, indent: number): string => {
    if (typeof value === 'string') {
      if (sqlFields.includes(key)) {
        return `${value};`
      }
      if (noQuoteFields.includes(key)) {
        return value
      }
      return `"${value}"`
    }
    return formatValue(value, indent)
  }

  const formatObject = (obj: Record<string, unknown>, indent: number): string => {
    const spaces = '  '.repeat(indent)
    const entries = Object.entries(obj)

    if (entries.length === 0) return '{}'

    const lines = entries.map(([key, value]) => {
      return `${spaces}  ${key}: ${formatFieldValue(key, value, indent + 1)}`
    }).join('\n')

    return `{\n${lines}\n${spaces}}`
  }

  const formatSemanticItem = (item: Record<string, unknown>, itemType: string, indent: number): string => {
    const spaces = '  '.repeat(indent)
    const { id: itemId, ...itemWithoutId } = item
    const itemBody = formatObject(itemWithoutId, indent)
    return `${spaces}${itemType} ${itemId} ${itemBody}`
  }

  const formatJoinItem = (item: Record<string, unknown>, indent: number): string => {
    const spaces = '  '.repeat(indent)
    const { entity: entityName, ...itemWithoutEntity } = item
    const itemBody = formatObject(itemWithoutEntity, indent)
    return `${spaces}join ${entityName} ${itemBody}`
  }

  const formatEntityContent = (obj: Record<string, unknown>, indent: number): string => {
    const spaces = '  '.repeat(indent)
    const lines: string[] = []

    // Normal fields first (not attributes, metrics, relationships)
    const normalEntries = Object.entries(obj).filter(([key]) =>
      key !== 'attributes' && key !== 'metrics' && key !== 'relationships'
    )
    normalEntries.forEach(([key, value]) => {
      lines.push(`${spaces}  ${key}: ${formatFieldValue(key, value, indent + 1)}`)
    })

    // Then relationships (joins)
    if ('relationships' in obj && Array.isArray(obj.relationships) && obj.relationships.length > 0) {
      lines.push('')
      obj.relationships.forEach((rel) => {
        if (typeof rel === 'object' && rel !== null && 'entity' in rel) {
          lines.push(formatJoinItem(rel as Record<string, unknown>, indent + 1))
        }
      })
    }

    // Then attributes
    if ('attributes' in obj && Array.isArray(obj.attributes) && obj.attributes.length > 0) {
      lines.push('')
      obj.attributes.forEach((attr) => {
        if (typeof attr === 'object' && attr !== null && 'id' in attr) {
          lines.push(formatSemanticItem(attr as Record<string, unknown>, 'attribute', indent + 1))
        }
      })
    }

    // Then metrics
    if ('metrics' in obj && Array.isArray(obj.metrics) && obj.metrics.length > 0) {
      lines.push('')
      obj.metrics.forEach((metric) => {
        if (typeof metric === 'object' && metric !== null && 'id' in metric) {
          lines.push(formatSemanticItem(metric as Record<string, unknown>, 'metric', indent + 1))
        }
      })
    }

    return `{\n${lines.join('\n')}\n${spaces}}`
  }

  // Create copy without id (and without type for datasets)
  const { id, type, ...contentWithoutIdAndType } = content
  const entityType = type === 'dataset' ? 'Dataset' : 'Entity'

  // For entities include type; for datasets don't
  const contentToRender = type === 'dataset'
    ? contentWithoutIdAndType
    : { type, ...contentWithoutIdAndType }

  const header = `${entityType} ${id} `
  const body = formatEntityContent(contentToRender as Record<string, unknown>, 0)

  return header + body
}

// ============================================================================
// Main Development Page
// ============================================================================

export default function Development() {
  const { isDemoMode } = useAuth()

  const [tree, setTree] = useState<FileTreeNode[]>([])
  const [selectedFile, setSelectedFile] = useState<FileTreeNode | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/core', '/core/entities', '/core/entities/meta']))
  const [fileContent, setFileContent] = useState<SemanticEntity | SemanticDataset | null>(null)
  const [loading, setLoading] = useState(true)
  const [editorTheme, setEditorTheme] = useState<'dark' | 'light'>('light')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isRefreshingTree, setIsRefreshingTree] = useState(false)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [contentError, setContentError] = useState<string | null>(null)

  // Edit mode state - disabled in demo mode
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(288) // 288px = w-72
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Handle sidebar resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const newWidth = e.clientX
    // Min 200px, max 600px
    if (newWidth >= 200 && newWidth <= 600) {
      setSidebarWidth(newWidth)
    }
  }, [isResizing])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  // Attach mouse events for resize
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  const toggleEditorTheme = () => {
    setEditorTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  // Compute DSL content for visualization (memoized)
  const contentToDsl = fileContent ? jsonToDsl(fileContent) : ''

  // Start editing - convert content to DSL string
  const handleStartEdit = () => {
    if (fileContent) {
      setEditContent(jsonToDsl(fileContent))
      setEditError(null)
      setIsEditing(true)
    }
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditContent('')
    setEditError(null)
  }

  // Parse DSL format back to JSON
  const dslToJson = (dsl: string): SemanticEntity | SemanticDataset => {
    const lines = dsl.split('\n')
    let currentIndex = 0

    const skipWhitespace = () => {
      while (currentIndex < lines.length && lines[currentIndex].trim() === '') {
        currentIndex++
      }
    }

    const parseValue = (valueStr: string): unknown => {
      valueStr = valueStr.trim()
      if (valueStr === 'null') return null
      if (valueStr === 'true') return true
      if (valueStr === 'false') return false
      if (valueStr === '[]') return []
      if (valueStr === '{}') return {}
      if (/^-?\d+(\.\d+)?$/.test(valueStr)) return Number(valueStr)
      // Strip quotes from strings
      if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
        return valueStr.slice(1, -1)
      }
      // Strip trailing semicolon (for sql fields)
      if (valueStr.endsWith(';')) {
        return valueStr.slice(0, -1)
      }
      return valueStr
    }

    const parseObject = (endIndent: number): Record<string, unknown> => {
      const obj: Record<string, unknown> = {}

      while (currentIndex < lines.length) {
        skipWhitespace()
        if (currentIndex >= lines.length) break

        const line = lines[currentIndex]
        const trimmed = line.trim()

        if (trimmed === '}') {
          currentIndex++
          break
        }

        if (trimmed === '{' || trimmed === '') {
          currentIndex++
          continue
        }

        const indent = line.search(/\S/)
        if (indent <= endIndent && trimmed !== '') {
          break
        }

        // Parse key: value (with colon separator)
        const match = trimmed.match(/^(\w+):\s*(.*)$/)
        if (match) {
          const [, key, rest] = match

          if (rest === '{') {
            currentIndex++
            obj[key] = parseObject(indent)
          } else if (rest === '[') {
            currentIndex++
            obj[key] = parseArray(indent)
          } else {
            obj[key] = parseValue(rest)
            currentIndex++
          }
        } else {
          currentIndex++
        }
      }

      return obj
    }

    const parseArray = (endIndent: number): unknown[] => {
      const arr: unknown[] = []

      while (currentIndex < lines.length) {
        skipWhitespace()
        if (currentIndex >= lines.length) break

        const line = lines[currentIndex]
        const trimmed = line.trim()

        if (trimmed === ']') {
          currentIndex++
          break
        }

        const indent = line.search(/\S/)
        if (indent <= endIndent && trimmed !== '' && trimmed !== ']') {
          break
        }

        if (trimmed === '{') {
          currentIndex++
          arr.push(parseObject(indent))
        } else if (trimmed !== '') {
          arr.push(parseValue(trimmed))
          currentIndex++
        } else {
          currentIndex++
        }
      }

      return arr
    }

    const parseSemanticItem = (itemType: 'attribute' | 'metric' | 'join'): Record<string, unknown> => {
      const line = lines[currentIndex].trim()
      const regex = itemType === 'join'
        ? /^join\s+(\S+)\s+\{$/
        : new RegExp(`^${itemType}\\s+(\\S+)\\s+\\{$`)

      const match = line.match(regex)
      if (!match) {
        currentIndex++
        return {}
      }

      const itemId = match[1]
      const indent = lines[currentIndex].search(/\S/)
      currentIndex++

      const obj = parseObject(indent)

      if (itemType === 'join') {
        return { entity: itemId, ...obj }
      }
      return { id: itemId, ...obj }
    }

    // Parse main entity/dataset
    const firstLine = lines[0].trim()
    const headerMatch = firstLine.match(/^(Entity|Dataset)\s+(\S+)\s+\{$/)

    if (!headerMatch) {
      throw new Error('Invalid DSL format: must start with Entity or Dataset')
    }

    const [, entityType, entityId] = headerMatch
    currentIndex = 1

    const result: Record<string, unknown> = {
      id: entityId,
      type: entityType.toLowerCase() === 'dataset' ? 'dataset' : 'entity'
    }

    const attributes: Record<string, unknown>[] = []
    const metrics: Record<string, unknown>[] = []
    const relationships: Record<string, unknown>[] = []

    while (currentIndex < lines.length) {
      skipWhitespace()
      if (currentIndex >= lines.length) break

      const line = lines[currentIndex]
      const trimmed = line.trim()

      if (trimmed === '}') {
        currentIndex++
        break
      }

      if (trimmed.startsWith('attribute ')) {
        attributes.push(parseSemanticItem('attribute'))
      } else if (trimmed.startsWith('metric ')) {
        metrics.push(parseSemanticItem('metric'))
      } else if (trimmed.startsWith('join ')) {
        relationships.push(parseSemanticItem('join'))
      } else {
        // Regular property (key: value format)
        const match = trimmed.match(/^(\w+):\s*(.*)$/)
        if (match) {
          const [, key, rest] = match
          const indent = line.search(/\S/)

          if (rest === '{') {
            currentIndex++
            result[key] = parseObject(indent)
          } else if (rest === '[') {
            currentIndex++
            result[key] = parseArray(indent)
          } else {
            result[key] = parseValue(rest)
            currentIndex++
          }
        } else {
          currentIndex++
        }
      }
    }

    if (attributes.length > 0) result.attributes = attributes
    if (metrics.length > 0) result.metrics = metrics
    if (relationships.length > 0) result.relationships = relationships

    return result as unknown as SemanticEntity | SemanticDataset
  }

  // Save changes
  const handleSave = async () => {
    if (!selectedFile) return

    setEditError(null)

    // Validate and parse DSL
    let parsedContent: SemanticEntity | SemanticDataset
    try {
      parsedContent = dslToJson(editContent)
    } catch (e) {
      console.error('Parse error:', e)
      setEditError(`Formato inválido: ${e instanceof Error ? e.message : 'Error de sintaxis'}`)
      return
    }

    setIsSaving(true)
    try {
      // Call the API to save the file
      await saveFileContent(selectedFile.path, parsedContent)

      // Update the local state with the saved content
      setFileContent(parsedContent)
      setIsEditing(false)
      setEditContent('')

      console.log('✅ Archivo guardado:', selectedFile.path)
    } catch (error) {
      console.error('❌ Error al guardar:', error)
      setEditError(error instanceof Error ? error.message : 'Error al guardar')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle edit content change
  const handleEditContentChange = (content: string) => {
    setEditContent(content)
    setEditError(null)
  }

  const refreshContent = async () => {
    if (!selectedFile || selectedFile.type === 'folder') return

    setIsRefreshing(true)
    setContentError(null)
    try {
      const response = await getFileContent(selectedFile.path)
      setFileContent(response.content)
    } catch (error) {
      console.error('Error loading file content:', error)
      setContentError(error instanceof Error ? error.message : 'Error al cargar el archivo')
      setFileContent(null)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Función para cargar el árbol de archivos
  const loadTree = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshingTree(true)
    }
    setTreeError(null)
    try {
      const response = await getModelsTree()
      setTree(response.tree)
    } catch (error) {
      console.error('Error loading models tree:', error)
      setTreeError(error instanceof Error ? error.message : 'Error al cargar el árbol de modelos')
    } finally {
      setLoading(false)
      setIsRefreshingTree(false)
    }
  }, [])

  // Cargar árbol de archivos al montar
  useEffect(() => {
    loadTree(false)
  }, [loadTree])

  // Refresh del árbol
  const handleRefreshTree = useCallback(() => {
    loadTree(true)
  }, [loadTree])

  // Cargar contenido del archivo seleccionado
  useEffect(() => {
    if (!selectedFile || selectedFile.type === 'folder') {
      setFileContent(null)
      setContentError(null)
      return
    }

    const loadContent = async () => {
      setContentError(null)
      try {
        const response = await getFileContent(selectedFile.path)
        setFileContent(response.content)
      } catch (error) {
        console.error('Error loading file content:', error)
        setContentError(error instanceof Error ? error.message : 'Error al cargar el archivo')
        setFileContent(null)
      }
    }

    loadContent()
  }, [selectedFile])

  const handleSelectFile = (node: FileTreeNode) => {
    // Reset edit mode when changing files
    if (isEditing) {
      setIsEditing(false)
      setEditContent('')
      setEditError(null)
    }
    setSelectedFile(node)
  }

  const handleToggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Development</h1>
          <p className="text-sm text-gray-500 mt-1">
            Explora la Capa Semántica - Entities y Datasets
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
            Core Models
          </span>
          {isEditing ? (
            <span className="px-3 py-1 text-xs font-medium text-orange-700 bg-orange-100 rounded-full">
              Editing
            </span>
          ) : (
            <span className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
              Read Only
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - File Tree */}
        <div
          ref={sidebarRef}
          className="border-r border-gray-200 bg-white flex flex-col relative"
          style={{ width: sidebarWidth, minWidth: 200, maxWidth: 600 }}
        >
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Explorer</h2>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">
                  {tree[0]?.children?.reduce(
                    (acc, child) =>
                      acc + (child.children?.reduce(
                        (a, c) => a + (c.children?.length || 0),
                        0
                      ) || 0),
                    0
                  ) || 0}{' '}
                  files
                </span>
                <button
                  onClick={handleRefreshTree}
                  disabled={isRefreshingTree}
                  className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                  title="Recargar árbol"
                >
                  <ArrowPathIcon className={`h-4 w-4 ${isRefreshingTree ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {treeError ? (
              <div className="px-4 py-8 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900 mb-2">Error al cargar</p>
                <p className="text-xs text-red-600 bg-red-50 p-2 rounded font-mono break-all">{treeError}</p>
              </div>
            ) : tree.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <p className="text-sm">No hay modelos disponibles</p>
              </div>
            ) : (
              tree.map((node) => (
                <FileTreeItem
                  key={node.path}
                  node={node}
                  level={0}
                  selectedPath={selectedFile?.path || null}
                  expandedFolders={expandedFolders}
                  onSelect={handleSelectFile}
                  onToggleFolder={handleToggleFolder}
                />
              ))
            )}
          </div>
          {/* Resize handle */}
          <div
            onMouseDown={handleMouseDown}
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors ${
              isResizing ? 'bg-blue-500' : 'bg-transparent'
            }`}
          />
        </div>

        {/* Right Panel - Code Viewer */}
        <div className="flex-1 bg-gray-50 overflow-hidden">
          <JsonViewer
            content={fileContent}
            contentToDsl={contentToDsl}
            selectedFile={selectedFile}
            theme={editorTheme}
            onToggleTheme={toggleEditorTheme}
            onRefresh={refreshContent}
            isRefreshing={isRefreshing}
            error={contentError}
            isEditing={isEditing}
            editContent={editContent}
            onStartEdit={handleStartEdit}
            onCancelEdit={handleCancelEdit}
            onSave={handleSave}
            onEditContentChange={handleEditContentChange}
            isSaving={isSaving}
            editError={editError}
            isDemoMode={isDemoMode}
          />
        </div>
      </div>
    </div>
  )
}

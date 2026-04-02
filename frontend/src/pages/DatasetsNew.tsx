/**
 * DatasetsNew - Vista de Navegación de Datos
 *
 * Wrapper component that handles dataset/entity loading and delegates
 * visualization building to the VizBuilder component.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CubeIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import type { SemanticDataset, SemanticEntity, FileTreeNode } from '@/types/semantic'
import type { VizConfig } from '@/types/viz'
import { getModelsTree, getFileContent } from '@/services/semanticService'
import { getViz } from '@/services/vizService'
import { useAuth } from '@/contexts/AuthContext'
import VizBuilder, { DatasetWithMeta, DashboardVizData, YAxisFormatType } from '@/components/viz/VizBuilder'

// Re-export types for backwards compatibility
export type { DatasetWithMeta, DashboardVizData, YAxisFormatType }

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full bg-gray-50">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <CubeIcon className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Selecciona un Dataset
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Elige un dataset del panel izquierdo para explorar sus campos y crear visualizaciones.
        </p>
        <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <ChartBarIcon className="w-4 h-4" />
            <span>Visualiza datos</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Props Interface
// ============================================================================

interface DatasetsNewProps {
  // Embedded mode props
  embedded?: boolean
  initialDatasetId?: string
  initialVizConfig?: VizConfig  // Initial viz config to load (for editing from dashboard)
  onAddToDashboard?: (vizData: DashboardVizData) => void
  // Viz title for dashboard integration
  vizTitle?: string
  onVizTitleChange?: (title: string) => void
  // Called when the VizBuilder is ready (dataset and entities loaded)
  onReady?: () => void
}

// ============================================================================
// Main Component
// ============================================================================

export default function DatasetsNew({
  embedded = false,
  initialDatasetId,
  initialVizConfig,
  onAddToDashboard,
  vizTitle,
  onVizTitleChange,
  onReady,
}: DatasetsNewProps) {
  const { currentTenant } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // State
  const [selectedDataset, setSelectedDataset] = useState<DatasetWithMeta | null>(null)
  const [entities, setEntities] = useState<Map<string, SemanticEntity>>(new Map())
  const [loading, setLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadingViz, setLoadingViz] = useState(false)
  const [loadedVizId, setLoadedVizId] = useState<string | null>(null)
  const [pendingVizConfig, setPendingVizConfig] = useState<VizConfig | undefined>(undefined)

  // Ref to track if onReady was called (to prevent infinite loops)
  const onReadyCalledRef = useRef(false)

  // Reset onReady ref when dataset changes (so loading works again for new datasets)
  useEffect(() => {
    onReadyCalledRef.current = false
  }, [initialDatasetId])

  // Load initial dataset when in embedded mode
  useEffect(() => {
    if (!embedded || !initialDatasetId || !currentTenant?.id) return

    const loadInitialDataset = async () => {
      setLoading(true)
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

        for (const file of datasetFiles) {
          try {
            const content = await getFileContent(file.path)
            const dataset = content.content as SemanticDataset & { group?: string; subgroup?: string }
            if (dataset.type === 'dataset' && dataset.id === initialDatasetId) {
              setSelectedDataset({
                ...dataset,
                group: dataset.group || 'Sin grupo',
                subgroup: dataset.subgroup || 'General',
                path: file.path,
              })

              // If we have an initial viz config, store it for later application
              if (initialVizConfig) {
                setPendingVizConfig(initialVizConfig)
              }

              break
            }
          } catch (err) {
            console.warn(`Error loading dataset ${file.path}:`, err)
          }
        }
      } catch (err) {
        console.error('Error loading initial dataset:', err)
      } finally {
        setLoading(false)
      }
    }

    loadInitialDataset()
  }, [embedded, initialDatasetId, initialVizConfig, currentTenant?.id])

  // Update pendingVizConfig when initialVizConfig changes (for editing existing viz)
  useEffect(() => {
    if (embedded && initialVizConfig && selectedDataset) {
      setPendingVizConfig(initialVizConfig)
    }
  }, [embedded, initialVizConfig, selectedDataset])

  // Load viz from URL parameter
  useEffect(() => {
    const vizId = searchParams.get('viz')
    if (!vizId || !currentTenant?.id || loadedVizId === vizId) return

    const loadVizFromUrl = async () => {
      setLoadingViz(true)
      try {
        const vizDoc = await getViz(currentTenant.id, vizId)
        if (!vizDoc) {
          console.error('Viz not found:', vizId)
          setSearchParams({})
          return
        }

        const config = vizDoc.config

        // First, load the dataset
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

        // Find the dataset by ID
        let foundDataset: DatasetWithMeta | null = null
        for (const file of datasetFiles) {
          try {
            const content = await getFileContent(file.path)
            const dataset = content.content as SemanticDataset & { group?: string; subgroup?: string }
            if (dataset.type === 'dataset' && dataset.id === config.datasetId) {
              foundDataset = {
                ...dataset,
                group: dataset.group || 'Sin grupo',
                subgroup: dataset.subgroup || 'General',
                path: file.path,
              }
              break
            }
          } catch (err) {
            console.warn(`Error loading dataset ${file.path}:`, err)
          }
        }

        if (!foundDataset) {
          console.error('Dataset not found:', config.datasetId)
          setSearchParams({})
          return
        }

        // Set the dataset
        setSelectedDataset(foundDataset)
        setLoadedVizId(vizId)

        // Store the config to apply after entities load
        setPendingVizConfig(config)

      } catch (err) {
        console.error('Error loading viz:', err)
        setSearchParams({})
      } finally {
        setLoadingViz(false)
      }
    }

    loadVizFromUrl()
  }, [searchParams, currentTenant?.id, loadedVizId, setSearchParams])

  // Listen for dataset selection from sidebar
  useEffect(() => {
    const handleDatasetSelected = (event: CustomEvent<DatasetWithMeta>) => {
      setSelectedDataset(event.detail)
      setPendingVizConfig(undefined) // Clear pending config on new dataset
    }

    window.addEventListener('dataset-selected', handleDatasetSelected as EventListener)

    return () => {
      window.removeEventListener('dataset-selected', handleDatasetSelected as EventListener)
    }
  }, [])

  // Load entities function (extracted for reuse)
  const loadEntities = useCallback(async (dataset: DatasetWithMeta, isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true)
    } else {
      setLoading(true)
    }
    try {
      const treeResponse = await getModelsTree()

      const entityFiles: { path: string; name: string }[] = []
      const findEntityFiles = (nodes: FileTreeNode[]) => {
        for (const node of nodes) {
          if (node.type === 'file' && node.path.includes('entities')) {
            entityFiles.push({ path: node.path, name: node.name })
          }
          if (node.children) {
            findEntityFiles(node.children)
          }
        }
      }
      findEntityFiles(treeResponse.tree)

      // Load entities needed for this dataset
      const neededEntities = [
        dataset.base_entity,
        ...(dataset.relationships?.map(r => r.entity) || [])
      ]

      const entityMap = new Map<string, SemanticEntity>()

      for (const file of entityFiles) {
        try {
          const content = await getFileContent(file.path)
          const entity = content.content as SemanticEntity
          if (entity.type === 'entity' && neededEntities.includes(entity.id)) {
            entityMap.set(entity.id, entity)
          }
        } catch (err) {
          console.warn(`Error loading entity ${file.path}:`, err)
        }
      }

      setEntities(entityMap)
    } catch (err) {
      console.error('Error loading entities:', err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Load entities when dataset is selected
  useEffect(() => {
    if (!selectedDataset) return
    loadEntities(selectedDataset, false)
  }, [selectedDataset, loadEntities])

  // Refresh handler for VizBuilder
  const handleRefresh = useCallback(() => {
    if (selectedDataset) {
      loadEntities(selectedDataset, true)
    }
  }, [selectedDataset, loadEntities])

  // Notify parent when ready (entities loaded)
  useEffect(() => {
    if (!loading && selectedDataset && entities.size > 0 && onReady && !onReadyCalledRef.current) {
      onReadyCalledRef.current = true
      onReady()
    }
  }, [loading, selectedDataset, entities.size]) // eslint-disable-line react-hooks/exhaustive-deps

  const containerHeight = embedded ? 'h-full' : 'h-[calc(100vh-64px)]'

  // Empty state
  if (!selectedDataset) {
    return (
      <div className={containerHeight}>
        <EmptyState />
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className={`${containerHeight} flex items-center justify-center bg-gray-50`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Cargando campos...</p>
        </div>
      </div>
    )
  }

  // Loading viz overlay
  if (loadingViz) {
    return (
      <div className={`${containerHeight} flex items-center justify-center bg-gray-50`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando visualización...</p>
        </div>
      </div>
    )
  }

  // Render VizBuilder
  return (
    <VizBuilder
      dataset={selectedDataset}
      entities={entities}
      tenantId={currentTenant?.id || ''}
      initialConfig={pendingVizConfig}
      embedded={embedded}
      onVizDataChange={onAddToDashboard}
      showSaveControls={!embedded}
      heightClass={containerHeight}
      vizTitle={vizTitle}
      onVizTitleChange={onVizTitleChange}
      hideDatasetInfo={!embedded}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
    />
  )
}

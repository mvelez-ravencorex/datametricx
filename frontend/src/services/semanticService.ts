/**
 * Servicio para la Capa Semántica de DataMetricX
 * Consume la API del backend para gestionar Entities y Datasets
 */

import { auth } from '@/config/firebase'
import type {
  SemanticEntity,
  SemanticDataset,
  FileTreeNode,
  FileTreeResponse,
  ProvidersResponse,
  EntitiesListResponse,
  EntitySchemaResponse,
  QueryRequest,
  QueryResponse,
  FileContentResponse,
} from '@/types/semantic'

// URL base del backend
// En producción usa rutas relativas (proxy de Firebase Hosting)
// En desarrollo usa el proxy de Vite configurado en vite.config.ts
const API_BASE_URL = ''

/**
 * Obtiene el token de autenticación de Firebase
 */
async function getAuthToken(): Promise<string> {
  const user = auth.currentUser
  if (!user) {
    throw new Error('Usuario no autenticado')
  }
  return await user.getIdToken()
}

/**
 * Realiza una petición HTTP al backend
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken()

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    let errorData = null
    const responseText = await response.text()

    try {
      errorData = JSON.parse(responseText)
    } catch {
      console.error('Semantic API response (not JSON):', responseText)
    }

    const errorMessage = errorData?.error || errorData?.message || responseText || response.statusText
    throw new Error(`Semantic API Error (${response.status}): ${errorMessage}`)
  }

  return await response.json()
}

// ============================================================================
// PROVIDERS
// ============================================================================

/**
 * Lista los proveedores disponibles (meta, google, shopify, etc)
 */
export async function getProviders(): Promise<string[]> {
  const response = await apiRequest<ProvidersResponse>('/api/semantic/providers')
  return response.providers
}

// ============================================================================
// ENTITIES
// ============================================================================

/**
 * Lista todas las entities de un proveedor
 */
export async function getEntitiesByProvider(provider: string): Promise<EntitiesListResponse> {
  return await apiRequest<EntitiesListResponse>(`/api/semantic/entities?provider=${provider}`)
}

/**
 * Obtiene el schema de una entity (para Query Builder)
 */
export async function getEntitySchema(entityId: string, provider: string): Promise<EntitySchemaResponse> {
  return await apiRequest<EntitySchemaResponse>(
    `/api/semantic/entities/${entityId}/schema?provider=${provider}`
  )
}

/**
 * Obtiene una entity completa (JSON raw)
 */
export async function getEntity(entityId: string, provider: string): Promise<SemanticEntity> {
  return await apiRequest<SemanticEntity>(
    `/api/semantic/entities/${entityId}?provider=${provider}`
  )
}

// ============================================================================
// DATASETS
// ============================================================================

/**
 * Lista todos los datasets de un proveedor
 */
export async function getDatasetsByProvider(provider: string): Promise<SemanticDataset[]> {
  return await apiRequest<SemanticDataset[]>(`/api/semantic/datasets?provider=${provider}`)
}

/**
 * Obtiene un dataset completo
 */
export async function getDataset(datasetId: string, provider: string): Promise<SemanticDataset> {
  return await apiRequest<SemanticDataset>(
    `/api/semantic/datasets/${datasetId}?provider=${provider}`
  )
}

// ============================================================================
// QUERY EXECUTION
// ============================================================================

/**
 * Ejecuta una consulta semántica
 * @param request La solicitud de consulta
 * @param tenantId El ID del tenant para filtrar los datos (requerido para seguridad multi-tenant)
 */
export async function executeQuery(request: QueryRequest, tenantId?: string): Promise<QueryResponse> {
  // Clone the request to avoid mutating the original
  const requestWithTenant = { ...request }

  // Add tenant_id filter if provided
  if (tenantId) {
    const tenantFilter = {
      field: 'tenant_id',
      operator: '=' as const,
      value: tenantId
    }

    // Merge with existing filters
    requestWithTenant.filters = [
      tenantFilter,
      ...(request.filters || [])
    ]
  }

  return await apiRequest<QueryResponse>('/api/semantic/query', {
    method: 'POST',
    body: JSON.stringify(requestWithTenant),
  })
}

/**
 * Previsualiza el SQL generado sin ejecutar
 */
export async function dryRunQuery(request: QueryRequest): Promise<{ sql: string; estimated_bytes: number }> {
  return await apiRequest<{ sql: string; estimated_bytes: number }>('/api/semantic/dry-run', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/**
 * Obtiene valores distintos de un atributo para filtros
 * @param datasetId ID del dataset
 * @param attributeId ID del atributo (formato: entityId.attributeId)
 * @param tenantId ID del tenant para filtrar datos (requerido para seguridad multi-tenant)
 * @param limit Máximo de valores a retornar (default: 100)
 */
export async function getDistinctValues(
  datasetId: string,
  attributeId: string,
  tenantId?: string,
  limit: number = 100
): Promise<string[]> {
  const request: QueryRequest = {
    dataset_id: datasetId,
    attributes: [attributeId],
    metrics: [],
    filters: [],
    order_by: [{ field: attributeId, direction: 'ASC' }],
    limit,
  }

  const response = await executeQuery(request, tenantId)

  // Extraer valores únicos de la respuesta
  const values: string[] = []
  if (response.data && response.data.length > 0) {
    // Los datos vienen en response.data como array de objetos
    for (const row of response.data) {
      // El valor está en la primera (y única) columna
      const value = Object.values(row)[0]
      if (value !== null && value !== undefined && value !== '') {
        values.push(String(value))
      }
    }
  }

  // Eliminar duplicados y retornar
  return [...new Set(values)]
}

// ============================================================================
// FILE TREE (Para Development IDE)
// ============================================================================

/**
 * Respuesta del backend para el árbol de modelos
 */
interface ModelsTreeApiResponse {
  success: boolean
  data: FileTreeNode[]
  meta: {
    bucket: string
    layer: string
    file_count: number
  }
}

/**
 * Añade entityType a los nodos del árbol basándose en el path
 */
function addEntityTypeToTree(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.map(node => {
    if (node.type === 'folder' && node.children) {
      return {
        ...node,
        children: addEntityTypeToTree(node.children)
      }
    }
    if (node.type === 'file') {
      // Inferir entityType del path
      const isDataset = node.path.includes('/datasets/')
      return {
        ...node,
        entityType: isDataset ? 'dataset' : 'entity'
      }
    }
    return node
  })
}

/**
 * Obtiene el árbol de archivos de modelos (entities + datasets)
 */
export async function getModelsTree(): Promise<FileTreeResponse> {
  const response = await apiRequest<ModelsTreeApiResponse>('/api/semantic/models/tree')
  return {
    tree: addEntityTypeToTree(response.data),
    providers: ['meta'] // Por ahora hardcoded, el backend podría retornarlo en meta
  }
}

/**
 * Respuesta del backend para el contenido de archivo
 */
interface FileContentApiResponse {
  success: boolean
  path: string
  data: SemanticEntity | SemanticDataset
}

/**
 * Obtiene el contenido de un archivo específico
 */
export async function getFileContent(path: string): Promise<FileContentResponse> {
  const response = await apiRequest<FileContentApiResponse>(
    `/api/semantic/models/file?path=${encodeURIComponent(path)}`
  )
  return {
    path: response.path,
    content: response.data,
    raw: JSON.stringify(response.data, null, 2)
  }
}

/**
 * Respuesta del backend para guardar archivo
 */
interface SaveFileApiResponse {
  success: boolean
  message: string
  path: string
}

/**
 * Guarda el contenido de un archivo (Solo SysOwner)
 * PUT /api/semantic/models/file
 */
export async function saveFileContent(
  path: string,
  content: SemanticEntity | SemanticDataset
): Promise<SaveFileApiResponse> {
  return await apiRequest<SaveFileApiResponse>('/api/semantic/models/file', {
    method: 'PUT',
    body: JSON.stringify({ path, content }),
  })
}

/**
 * Elimina un archivo (Solo SysOwner)
 * DELETE /api/semantic/models/file?path=...
 */
export async function deleteFile(path: string): Promise<{ success: boolean; message: string }> {
  return await apiRequest<{ success: boolean; message: string }>(
    `/api/semantic/models/file?path=${encodeURIComponent(path)}`,
    { method: 'DELETE' }
  )
}

// ============================================================================
// MOCK DATA (Para desarrollo sin backend)
// ============================================================================

/**
 * Genera datos mock para desarrollo del frontend
 * Usar cuando el backend no está disponible
 */
export function getMockModelsTree(): FileTreeResponse {
  return {
    providers: ['meta'],
    tree: [
      {
        name: 'core',
        path: '/core',
        type: 'folder',
        children: [
          {
            name: 'entities',
            path: '/core/entities',
            type: 'folder',
            children: [
              {
                name: 'meta',
                path: '/core/entities/meta',
                type: 'folder',
                children: [
                  { name: 'meta_accounts.json', path: '/core/entities/meta/meta_accounts.json', type: 'file', entityType: 'entity' },
                  { name: 'meta_campaigns.json', path: '/core/entities/meta/meta_campaigns.json', type: 'file', entityType: 'entity' },
                  { name: 'meta_adsets.json', path: '/core/entities/meta/meta_adsets.json', type: 'file', entityType: 'entity' },
                  { name: 'meta_ads.json', path: '/core/entities/meta/meta_ads.json', type: 'file', entityType: 'entity' },
                  { name: 'meta_creatives.json', path: '/core/entities/meta/meta_creatives.json', type: 'file', entityType: 'entity' },
                  { name: 'fact_meta_performance_campaign.json', path: '/core/entities/meta/fact_meta_performance_campaign.json', type: 'file', entityType: 'entity' },
                  { name: 'fact_meta_performance_adset.json', path: '/core/entities/meta/fact_meta_performance_adset.json', type: 'file', entityType: 'entity' },
                  { name: 'fact_meta_performance_ad.json', path: '/core/entities/meta/fact_meta_performance_ad.json', type: 'file', entityType: 'entity' },
                  { name: 'fact_meta_breakdown_age_gender.json', path: '/core/entities/meta/fact_meta_breakdown_age_gender.json', type: 'file', entityType: 'entity' },
                  { name: 'fact_meta_breakdown_country.json', path: '/core/entities/meta/fact_meta_breakdown_country.json', type: 'file', entityType: 'entity' },
                  { name: 'fact_meta_breakdown_device.json', path: '/core/entities/meta/fact_meta_breakdown_device.json', type: 'file', entityType: 'entity' },
                  { name: 'fact_meta_breakdown_platform.json', path: '/core/entities/meta/fact_meta_breakdown_platform.json', type: 'file', entityType: 'entity' },
                  { name: 'fact_meta_top_creatives.json', path: '/core/entities/meta/fact_meta_top_creatives.json', type: 'file', entityType: 'entity' },
                ],
              },
            ],
          },
          {
            name: 'datasets',
            path: '/core/datasets',
            type: 'folder',
            children: [
              {
                name: 'meta',
                path: '/core/datasets/meta',
                type: 'folder',
                children: [
                  { name: 'meta_ads_insights.json', path: '/core/datasets/meta/meta_ads_insights.json', type: 'file', entityType: 'dataset' },
                  { name: 'meta_adset_insights.json', path: '/core/datasets/meta/meta_adset_insights.json', type: 'file', entityType: 'dataset' },
                  { name: 'meta_ad_insights.json', path: '/core/datasets/meta/meta_ad_insights.json', type: 'file', entityType: 'dataset' },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
}

/**
 * Genera contenido mock de una entity
 */
export function getMockEntityContent(entityId: string): SemanticEntity {
  return {
    id: entityId,
    type: 'entity',
    label: 'Performance Campañas Meta',
    description: 'Métricas de rendimiento diario de campañas',
    category: 'Marketing',
    subcategory: 'Meta Ads',
    source: {
      type: 'table',
      sql_table: '`datametricx-prod.reporting.meta_performance_campaign_daily`',
    },
    attributes: [
      {
        id: 'date',
        label: 'Fecha',
        type: 'date',
        sql: '{TABLE}.date',
        group: 'Fechas',
        primary_key: true,
      },
      {
        id: 'campaign_id',
        label: 'ID Campaña',
        type: 'string',
        sql: '{TABLE}.campaign_id',
        group: 'Identificadores',
        hidden: true,
      },
      {
        id: 'campaign_name',
        label: 'Campaña',
        type: 'string',
        sql: '{TABLE}.campaign_name',
        group: 'Campaña',
      },
      {
        id: 'campaign_status',
        label: 'Estado',
        type: 'string',
        sql: '{TABLE}.campaign_status',
        group: 'Estado',
      },
      {
        id: 'tenant_id',
        type: 'string',
        sql: '{TABLE}.tenant_id',
        group: 'Identificadores',
        hidden: true,
      },
    ],
    metrics: [
      {
        id: 'impressions',
        label: 'Impresiones',
        type: 'number',
        sql: '{TABLE}.impressions',
        sql_agg: 'SUM',
        format: '0,0',
        group: 'Alcance',
      },
      {
        id: 'reach',
        label: 'Alcance',
        type: 'number',
        sql: '{TABLE}.reach',
        sql_agg: 'SUM',
        format: '0,0',
        group: 'Alcance',
      },
      {
        id: 'spend',
        label: 'Inversión',
        type: 'currency',
        sql: '{TABLE}.spend',
        sql_agg: 'SUM',
        format: '$0,0.00',
        group: 'Inversión',
      },
      {
        id: 'clicks',
        label: 'Clics',
        type: 'number',
        sql: '{TABLE}.clicks',
        sql_agg: 'SUM',
        format: '0,0',
        group: 'Engagement',
      },
      {
        id: 'ctr',
        label: 'CTR',
        type: 'percent',
        sql: 'SAFE_DIVIDE(SUM({TABLE}.clicks), SUM({TABLE}.impressions)) * 100',
        sql_agg: 'CUSTOM',
        format: '0.00%',
        group: 'Engagement',
      },
      {
        id: 'roas',
        label: 'ROAS',
        type: 'number',
        sql: 'SAFE_DIVIDE(SUM({TABLE}.purchase_value), SUM({TABLE}.spend))',
        sql_agg: 'CUSTOM',
        format: '0.00x',
        group: 'Conversiones',
      },
    ],
  }
}

/**
 * Genera contenido mock de un dataset
 */
export function getMockDatasetContent(datasetId: string): SemanticDataset {
  return {
    id: datasetId,
    type: 'dataset',
    label: 'Meta Ads Campaign Insights',
    description: 'Dataset para análisis de rendimiento de campañas Meta',
    base_entity: 'fact_meta_performance_campaign',
    relationships: [
      {
        entity: 'meta_campaigns',
        join_type: 'left',
        sql_on: '{fact_meta_performance_campaign.campaign_id} = {meta_campaigns.id}',
      },
      {
        entity: 'meta_accounts',
        join_type: 'left',
        sql_on: '{fact_meta_performance_campaign.account_id} = {meta_accounts.id}',
      },
    ],
    governance: {
      default_filter: 'last_30_days',
      partition_field: 'fact_meta_performance_campaign.date',
      max_rows: 50000,
    },
  }
}

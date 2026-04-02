/**
 * Tipos para integraciones a plataformas externas
 */

export type ConnectionPlatform =
  | 'meta_ads'
  | 'google_analytics_4'
  | 'shopify'
  | 'tiendanube'
  | 'mercadolibre'
  | 'amazon'
  | 'tiktok_ads'
  | 'google_ads'
  | 'instagram'

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'pending'

export type SyncFrequency =
  | 'every-2-hours'
  | 'every-4-hours'
  | 'daily'
  | 'weekly'
  | 'monthly'

export type SyncStatus =
  | 'ok'
  | 'error'
  | 'no-data'
  | 'pending'
  | 'never-run'

export interface SyncResult {
  status: SyncStatus
  timestamp: Date
  recordsProcessed?: number
  errorMessage?: string
}

// Historial de sincronizaciones
export interface SyncHistoryEntry {
  id: string
  jobId?: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  type: 'manual' | 'scheduled' // Manual (Sync Now) o programada (cron)
  startedAt: Date
  completedAt?: Date
  duration?: number // en segundos
  recordsProcessed?: number
  errorMessage?: string
  errorDetails?: string
  triggeredBy?: string // UID del usuario que ejecutó (si es manual)
}

export interface SyncHistory {
  entries: SyncHistoryEntry[]
  lastSync?: SyncHistoryEntry
  totalSyncs: number
  successfulSyncs: number
  failedSyncs: number
}

export interface BaseConnection {
  id: string
  tenantId: string // ID del tenant al que pertenece esta integración
  name: string // Nombre descriptivo de la integración (ej: "Meta Ads - Cuenta Principal")
  platform: ConnectionPlatform

  // 🔐 Credenciales (Secret Manager)
  secret_id: string // ID del secret en Google Secret Manager

  // 🟢 Estado (coincide con especificación del backend)
  connected: boolean // true si está activo
  status: 'ok' | 'error' | 'no-data' | 'pending' | 'never-run' // Estado del pipeline

  // ⚙️ Configuración de sincronización (nombres según especificación)
  frequency: SyncFrequency // daily / weekly / monthly
  time_utc: string // Hora en UTC formato HH:mm (ej: "03:00")

  // 📊 Backfill (en días hacia atrás)
  backfill_days: number // 30 / 90 / 180 / 365

  // 📈 Resultados de sincronización
  lastSyncResult?: SyncResult
  lastSyncAt?: Date

  // 🔄 Tracking de jobs
  currentJobId?: string // ID del job en ejecución
  lastJobId?: string

  // 📊 Historial de sincronizaciones
  syncHistory?: SyncHistoryEntry[] // Últimas 20 sincronizaciones

  // Legacy fields (para compatibilidad temporal)
  userId?: string
  syncFrequency?: SyncFrequency // @deprecated - usar frequency
  syncTime?: string // @deprecated - usar time_utc
  syncStatus?: SyncStatus // @deprecated - usar status

  createdAt: Date
  updatedAt: Date
}

// ==================== CREDENCIALES PARA OAUTH ====================
// Estas interfaces se usan durante el flujo OAuth, antes de guardar en Secret Manager

export interface MetaAdsCredentials {
  accessToken: string
  adAccountId: string
  appId?: string
  appSecret?: string
}

export interface GA4Credentials {
  propertyId: string
  clientId?: string
  clientSecret?: string
  refreshToken?: string
}

export interface ShopifyCredentials {
  shopDomain: string
  accessToken: string
  apiKey?: string
  apiSecret?: string
}

export interface TiendaNubeCredentials {
  storeId: string
  accessToken: string
}

export interface MercadoLibreCredentials {
  userId: string
  accessToken: string
  refreshToken: string
}

export interface TikTokCredentials {
  advertiserId: string
  accessToken: string
}

// ==================== CONEXIONES (solo guardan secret_id) ====================

// Meta Ads (Facebook Ads)
export interface MetaAdsConnection extends BaseConnection {
  platform: 'meta_ads'
  // Metadata adicional (NO credenciales)
  adAccountId?: string // Para mostrar en UI
  config: {
    syncInterval?: number // minutos
    syncTime?: string // Hora de ejecución en formato HH:mm
    enableAutoSync?: boolean
  }
}

// Google Analytics 4
export interface GA4Connection extends BaseConnection {
  platform: 'google_analytics_4'
  // Metadata adicional
  propertyId?: string
  config: {
    syncInterval?: number
    syncTime?: string
    enableAutoSync?: boolean
    dimensions?: string[]
    metrics?: string[]
  }
}

// Shopify
export interface ShopifyConnection extends BaseConnection {
  platform: 'shopify'
  // Metadata adicional
  shopDomain?: string
  config: {
    syncInterval?: number
    syncTime?: string
    enableAutoSync?: boolean
    syncOrders?: boolean
    syncProducts?: boolean
    syncCustomers?: boolean
  }
}

// TiendaNube
export interface TiendaNubeConnection extends BaseConnection {
  platform: 'tiendanube'
  // Metadata adicional
  storeId?: string
  config: {
    syncInterval?: number
    syncTime?: string
    enableAutoSync?: boolean
  }
}

// MercadoLibre
export interface MercadoLibreConnection extends BaseConnection {
  platform: 'mercadolibre'
  // Metadata adicional
  userId?: string
  config: {
    syncInterval?: number
    syncTime?: string
    enableAutoSync?: boolean
  }
}

// TikTok Ads
export interface TikTokConnection extends BaseConnection {
  platform: 'tiktok_ads'
  // Metadata adicional
  advertiserId?: string
  config: {
    syncInterval?: number
    syncTime?: string
    enableAutoSync?: boolean
  }
}

// Union type de todas las conexiones
export type Connection =
  | MetaAdsConnection
  | GA4Connection
  | ShopifyConnection
  | TiendaNubeConnection
  | MercadoLibreConnection
  | TikTokConnection

// Información de la plataforma para UI
export interface PlatformInfo {
  id: ConnectionPlatform
  name: string
  description: string
  icon: string
  color: string
  category: 'advertising' | 'analytics' | 'ecommerce'
  docUrl?: string
  setupSteps?: string[]
}

// Template para crear nueva conexión
export interface ConnectionTemplate {
  platform: ConnectionPlatform
  name: string
  description: string
  requiredFields: {
    name: string
    label: string
    type: 'text' | 'password' | 'url'
    placeholder?: string
    helpText?: string
    required: boolean
  }[]
}

// Agrupación de integraciones por plataforma
export interface PlatformIntegrations {
  platform: ConnectionPlatform
  platformInfo: PlatformInfo
  integrations: Connection[]
  canAddMore: boolean // Basado en el plan de suscripción
  maxIntegrations: number
}

// Opciones de frecuencia por plataforma
export const PLATFORM_SYNC_FREQUENCIES: Record<ConnectionPlatform, SyncFrequency[]> = {
  'meta_ads': ['daily', 'weekly', 'monthly'],
  'tiktok_ads': ['daily', 'weekly', 'monthly'],
  'shopify': ['every-2-hours', 'daily'],
  'google_analytics_4': ['every-4-hours', 'daily'],
  'tiendanube': ['every-2-hours', 'daily'],
  'mercadolibre': ['every-2-hours', 'daily'],
  'amazon': ['every-2-hours', 'daily'],
  'google_ads': ['daily', 'weekly', 'monthly'],
  'instagram': ['daily', 'weekly', 'monthly']
}

// Labels de frecuencia para UI
export const SYNC_FREQUENCY_LABELS: Record<SyncFrequency, string> = {
  'every-2-hours': 'Cada 2 horas',
  'every-4-hours': 'Cada 4 horas',
  'daily': 'Diario',
  'weekly': 'Semanal',
  'monthly': 'Mensual'
}

// Labels de estado de sincronización
export const SYNC_STATUS_LABELS: Record<SyncStatus, { label: string; color: string }> = {
  'ok': { label: 'OK', color: 'green' },
  'error': { label: 'Error', color: 'red' },
  'no-data': { label: 'Sin datos', color: 'yellow' },
  'pending': { label: 'Pendiente', color: 'blue' },
  'never-run': { label: 'No ejecutado', color: 'gray' }
}

// ==================== META ADS ONBOARDING (Nueva estructura) ====================

/**
 * Estados del datasource Meta Ads
 */
export type MetaDatasourceStatus =
  | 'pending_initial_sync'  // Esperando primera extracción
  | 'syncing'               // Extracción en progreso
  | 'active'                // Funcionando normalmente
  | 'error'                 // Error en última extracción
  | 'paused'                // Usuario pausó la sincronización

/**
 * Configuración del datasource Meta Ads (nueva estructura)
 */
export interface MetaDatasourceConfig {
  // Campos del onboarding
  start_date: string              // YYYY-MM-DD - Fecha desde la cual importar
  frequency: 'daily' | 'weekly' | 'monthly'

  // Campos de conexión
  connected: boolean
  ad_account_id: string
  access_token_secret_id: string

  // Campos de estado (backend actualiza)
  status: MetaDatasourceStatus
  initial_backfill_done: boolean
  last_extraction: Date | null
  last_extraction_records: number | null
  last_error: string | null
  next_scheduled_run?: Date | null
}

/**
 * Errores comunes de Meta
 */
export type MetaErrorCode =
  | 'TOKEN_EXPIRED'
  | 'RATE_LIMITED'
  | 'ACCOUNT_NOT_FOUND'
  | 'NO_DATA'
  | 'PERMISSION_DENIED'
  | 'UNKNOWN'

export const META_ERROR_MESSAGES: Record<MetaErrorCode, { message: string; action: string }> = {
  'TOKEN_EXPIRED': {
    message: 'Tu conexión con Meta ha expirado.',
    action: 'Reconectar'
  },
  'RATE_LIMITED': {
    message: 'Meta está limitando las solicitudes. Reintentando automáticamente.',
    action: 'Esperar'
  },
  'ACCOUNT_NOT_FOUND': {
    message: 'No se encontró la cuenta de anuncios. Verifica los permisos.',
    action: 'Verificar permisos'
  },
  'NO_DATA': {
    message: 'No hay datos de anuncios en el período seleccionado.',
    action: 'Cambiar fecha'
  },
  'PERMISSION_DENIED': {
    message: 'No tienes permisos para acceder a esta cuenta.',
    action: 'Verificar permisos'
  },
  'UNKNOWN': {
    message: 'Error desconocido. Por favor, intenta de nuevo.',
    action: 'Reintentar'
  }
}

/**
 * Labels de frecuencia con descripción para Meta Ads
 */
export const META_FREQUENCY_OPTIONS = [
  {
    value: 'daily' as const,
    label: 'Diaria',
    description: 'Actualiza todos los días a las 6:00 AM',
    recommendation: 'Recomendado para campañas activas',
    syncWindow: 'Últimos 7 días'
  },
  {
    value: 'weekly' as const,
    label: 'Semanal',
    description: 'Actualiza cada lunes a las 6:00 AM',
    recommendation: 'Para reportes semanales',
    syncWindow: 'Últimos 14 días'
  },
  {
    value: 'monthly' as const,
    label: 'Mensual',
    description: 'Actualiza el día 1 de cada mes a las 6:00 AM',
    recommendation: 'Para análisis histórico',
    syncWindow: 'Últimos 45 días'
  }
]

/**
 * Labels de estado del datasource Meta Ads
 */
export const META_STATUS_LABELS: Record<MetaDatasourceStatus, { label: string; color: string; icon: string }> = {
  'pending_initial_sync': { label: 'Sincronizando datos históricos...', color: 'blue', icon: 'spinner' },
  'syncing': { label: 'Sincronizando...', color: 'blue', icon: 'spinner' },
  'active': { label: 'Conectado', color: 'green', icon: 'check' },
  'error': { label: 'Error', color: 'red', icon: 'error' },
  'paused': { label: 'Pausado', color: 'yellow', icon: 'pause' }
}

/**
 * Constantes de validación para start_date
 */
export const META_DATE_LIMITS = {
  MIN_DAYS_AGO: 7,      // Mínimo 7 días atrás
  MAX_DAYS_AGO: 730,    // Máximo 2 años (límite de Meta API)
  DEFAULT_DAYS_AGO: 180 // Por defecto 6 meses
}

// ==================== PIPELINE RUNS (Subcolección) ====================

/**
 * Estado de una corrida de pipeline
 */
export type PipelineRunStatus = 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * Tipo de corrida
 */
export type PipelineRunType = 'manual' | 'scheduled' | 'backfill'

/**
 * Documento de corrida de pipeline
 * Ubicación: /tenants/{tenantId}/datasources/{datasourceId}/pipeline_runs/{runId}
 */
export interface PipelineRun {
  id: string                    // ID único de la corrida (generado)
  jobId: string                 // ID del job en Cloud Run

  // Estado
  status: PipelineRunStatus
  type: PipelineRunType

  // Tiempos
  startedAt: Date
  completedAt?: Date
  duration?: number             // Segundos

  // Resultados
  recordsProcessed?: number
  recordsInserted?: number
  recordsUpdated?: number

  // Errores
  errorMessage?: string
  errorCode?: string
  errorDetails?: string

  // Metadatos
  triggeredBy?: string          // UID del usuario (si manual)
  dateRange?: {                 // Rango de fechas procesado
    start: string               // YYYY-MM-DD
    end: string                 // YYYY-MM-DD
  }

  // Logs (opcional, para debugging)
  logs?: PipelineRunLog[]
}

/**
 * Entrada de log dentro de una corrida
 */
export interface PipelineRunLog {
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  data?: Record<string, any>
}

/**
 * Resumen de corridas para mostrar en UI
 */
export interface PipelineRunsSummary {
  totalRuns: number
  successfulRuns: number
  failedRuns: number
  lastRun?: PipelineRun
  lastSuccessfulRun?: PipelineRun
}

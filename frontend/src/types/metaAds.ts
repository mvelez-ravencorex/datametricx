/**
 * Tipos de datos para Meta Ads (Facebook & Instagram Ads)
 */

// ===== ENUMS =====

export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'
export type CampaignObjective =
  | 'OUTCOME_AWARENESS'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_SALES'
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_APP_PROMOTION'

export type AdSetStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'
export type AdStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'

// ===== CAMPAIGNS =====

export interface MetaCampaign {
  id: string // Meta Campaign ID
  userId: string
  connectionId: string // Referencia a la conexión
  accountId: string // Ad Account ID

  // Información básica
  name: string
  status: CampaignStatus
  objective: CampaignObjective

  // Presupuesto
  dailyBudget?: number
  lifetimeBudget?: number
  budgetRemaining?: number

  // Fechas
  startTime: Date
  stopTime?: Date
  createdTime: Date
  updatedTime: Date

  // Metadata
  createdAt: Date
  updatedAt: Date
  lastSyncAt: Date
}

// ===== AD SETS =====

export interface MetaAdSet {
  id: string // Meta Ad Set ID
  userId: string
  connectionId: string
  accountId: string
  campaignId: string // Relación con Campaign

  // Información básica
  name: string
  status: AdSetStatus

  // Presupuesto
  dailyBudget?: number
  lifetimeBudget?: number
  budgetRemaining?: number

  // Targeting (simplificado)
  targeting?: {
    ageMin?: number
    ageMax?: number
    genders?: number[] // 1=male, 2=female
    geoLocations?: {
      countries?: string[]
      regions?: string[]
      cities?: string[]
    }
  }

  // Fechas
  startTime: Date
  endTime?: Date
  createdTime: Date
  updatedTime: Date

  // Metadata
  createdAt: Date
  updatedAt: Date
  lastSyncAt: Date
}

// ===== ADS =====

export interface MetaAd {
  id: string // Meta Ad ID
  userId: string
  connectionId: string
  accountId: string
  campaignId: string
  adSetId: string // Relación con Ad Set

  // Información básica
  name: string
  status: AdStatus

  // Creative (simplificado)
  creative?: {
    id: string
    title?: string
    body?: string
    imageUrl?: string
    videoId?: string
    callToAction?: string
  }

  // Fechas
  createdTime: Date
  updatedTime: Date

  // Metadata
  createdAt: Date
  updatedAt: Date
  lastSyncAt: Date
}

// ===== INSIGHTS / METRICS =====

export interface MetaInsights {
  id: string // Generado: {entityType}_{entityId}_{date}
  userId: string
  connectionId: string
  accountId: string

  // Identificación
  entityType: 'campaign' | 'adset' | 'ad' // Tipo de entidad
  entityId: string // ID de la campaña/adset/ad
  campaignId?: string
  adSetId?: string
  adId?: string

  // Período
  date: string // YYYY-MM-DD
  dateStart: Date
  dateStop: Date

  // ===== MÉTRICAS DE PERFORMANCE BÁSICA =====

  // Alcance y frecuencia
  impressions: number
  reach: number
  frequency: number

  // Engagement
  clicks: number
  linkClicks: number
  uniqueClicks: number
  ctr: number // Click-through rate (%)
  uniqueCtr: number

  // ===== MÉTRICAS DE COSTOS =====

  spend: number // Gasto en la moneda de la cuenta
  cpc: number // Costo por clic
  cpm: number // Costo por mil impresiones
  cpp: number // Costo por persona alcanzada

  // ===== MÉTRICAS DE CONVERSIONES Y ROI =====

  // Conversiones
  conversions?: number
  costPerConversion?: number
  conversionRate?: number

  // Compras y valor
  purchases?: number
  purchaseValue?: number
  costPerPurchase?: number
  purchaseRoas?: number // Return on ad spend

  // Leads
  leads?: number
  costPerLead?: number

  // ===== ACCIONES ADICIONALES =====

  // Engagement en posts
  postEngagements?: number
  postReactions?: number
  postComments?: number
  postShares?: number
  postSaves?: number

  // Video (si aplica)
  videoViews?: number
  videoAvgTimeWatched?: number
  videoP25Watched?: number // % que vio 25%
  videoP50Watched?: number // % que vio 50%
  videoP75Watched?: number // % que vio 75%
  videoP100Watched?: number // % que vio 100%

  // Metadata
  createdAt: Date
  updatedAt: Date
}

// ===== INSIGHTS AGREGADOS (RESUMEN) =====

export interface MetaInsightsSummary {
  id: string
  userId: string
  connectionId: string
  accountId: string

  entityType: 'campaign' | 'adset' | 'ad' | 'account'
  entityId: string

  // Período del resumen
  periodType: 'lifetime' | 'last_7d' | 'last_30d' | 'last_90d' | 'custom'
  dateStart: Date
  dateStop: Date

  // Todas las métricas agregadas (suma total del período)
  totalImpressions: number
  totalReach: number
  avgFrequency: number
  totalClicks: number
  totalLinkClicks: number
  avgCtr: number
  totalSpend: number
  avgCpc: number
  avgCpm: number
  avgCpp: number
  totalConversions?: number
  avgCostPerConversion?: number
  avgConversionRate?: number
  totalPurchases?: number
  totalPurchaseValue?: number
  avgPurchaseRoas?: number

  // Metadata
  createdAt: Date
  updatedAt: Date
  lastSyncAt: Date
}

// ===== DEMOGRAPHIC BREAKDOWN (OPCIONAL) =====

export interface MetaDemographicInsights {
  id: string
  userId: string
  connectionId: string
  insightId: string // Referencia al insight principal

  // Breakdown dimension
  breakdownType: 'age' | 'gender' | 'country' | 'region' | 'platform' | 'device'
  breakdownValue: string // Ej: "25-34", "male", "US", "facebook", etc.

  // Métricas para este segmento
  impressions: number
  reach: number
  clicks: number
  spend: number
  conversions?: number

  createdAt: Date
  updatedAt: Date
}

// ===== SYNC STATUS =====

export interface MetaSyncJob {
  id: string
  userId: string
  connectionId: string

  // Estado del trabajo
  status: 'pending' | 'running' | 'completed' | 'failed'
  jobType: 'initial_sync' | 'incremental_sync' | 'full_refresh'

  // Progreso
  totalEntities?: number
  processedEntities?: number
  failedEntities?: number

  // Rango de fechas
  dateStart: Date
  dateStop: Date

  // Resultados
  error?: string
  stats?: {
    campaignsSync: number
    adSetsSync: number
    adsSync: number
    insightsSync: number
  }

  // Timestamps
  startedAt: Date
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

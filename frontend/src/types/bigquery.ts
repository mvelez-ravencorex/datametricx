/**
 * Tipos para datos de BigQuery
 */

// ==================== META ADS ====================

export interface MetaCampaign {
  campaign_id: string
  campaign_name: string
  status: string
  objective: string
  daily_budget?: number
  lifetime_budget?: number
  created_time: string
  updated_time: string
}

export interface MetaCampaignPerformance {
  date: string
  campaign_id: string
  campaign_name: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  revenue: number
  cpc: number
  cpm: number
  ctr: number
  roas: number
}

export interface MetaKPIs {
  total_impressions: number
  total_clicks: number
  total_spend: number
  total_conversions: number
  total_revenue: number
  avg_cpc: number
  avg_cpm: number
  avg_ctr: number
  avg_roas: number
}

export interface MetaPlatformPerformance {
  publisher_platform: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  cpc: number
  ctr: number
}

export interface MetaDemographics {
  age: string
  gender: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  cpc: number
  ctr: number
}

export interface MetaCreative {
  creative_id: string
  creative_name: string
  thumbnail_url?: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  ctr: number
  conversion_rate: number
}

// ==================== FILTROS Y PARÁMETROS ====================

export interface DateRange {
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
}

export interface ReportFilters extends DateRange {
  tenantId: string
  campaignIds?: string[]
  platforms?: string[]
  status?: string[]
}

// ==================== RESPUESTAS DE API ====================

export interface BigQueryResponse<T> {
  rows: T[]
  totalRows: number
  schema: Array<{
    name: string
    type: string
  }>
  jobId?: string
}

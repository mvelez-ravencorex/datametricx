/**
 * Servicio para interactuar con Meta Ads API
 */

import {
  MetaCampaign,
  MetaAdSet,
  MetaAd,
  MetaInsights,
  CampaignStatus,
  CampaignObjective,
  AdSetStatus,
  AdStatus
} from '@/types/metaAds'
import { Dataset, DataColumn, DataRow } from '@/types/dataset'

// ===== CONSTANTS =====

const META_API_VERSION = 'v19.0'
const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

// ===== TYPES =====

interface MetaApiConfig {
  accessToken: string
  adAccountId: string
}

interface DateRange {
  since: string // YYYY-MM-DD
  until: string // YYYY-MM-DD
}

// ===== API CLIENT =====

export class MetaAdsApiClient {
  private config: MetaApiConfig

  constructor(config: MetaApiConfig) {
    this.config = config
  }

  /**
   * Obtener lista de campañas
   */
  async getCampaigns(params?: {
    status?: CampaignStatus[]
    limit?: number
  }): Promise<MetaCampaign[]> {
    const fields = [
      'id',
      'name',
      'status',
      'objective',
      'daily_budget',
      'lifetime_budget',
      'budget_remaining',
      'start_time',
      'stop_time',
      'created_time',
      'updated_time'
    ].join(',')

    const filtering = params?.status
      ? `&filtering=[{"field":"status","operator":"IN","value":["${params.status.join('","')}"]}]`
      : ''

    const url = `${META_API_BASE_URL}/${this.config.adAccountId}/campaigns?fields=${fields}${filtering}&limit=${params?.limit || 100}&access_token=${this.config.accessToken}`

    const response = await fetch(url)

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      const errorMessage = errorData?.error?.message || response.statusText
      const errorCode = errorData?.error?.code || response.status
      throw new Error(`Meta API error (${errorCode}): ${errorMessage}`)
    }

    const data = await response.json()

    return data.data.map((campaign: any) => this.mapCampaign(campaign))
  }

  /**
   * Obtener Ad Sets de una campaña
   */
  async getAdSets(campaignId: string): Promise<MetaAdSet[]> {
    const fields = [
      'id',
      'name',
      'status',
      'campaign_id',
      'daily_budget',
      'lifetime_budget',
      'budget_remaining',
      'targeting',
      'start_time',
      'end_time',
      'created_time',
      'updated_time'
    ].join(',')

    const url = `${META_API_BASE_URL}/${campaignId}/adsets?fields=${fields}&access_token=${this.config.accessToken}`

    const response = await fetch(url)

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      const errorMessage = errorData?.error?.message || response.statusText
      const errorCode = errorData?.error?.code || response.status
      throw new Error(`Meta API error (${errorCode}): ${errorMessage}`)
    }

    const data = await response.json()

    return data.data.map((adset: any) => this.mapAdSet(adset))
  }

  /**
   * Obtener Ads de un Ad Set
   */
  async getAds(adSetId: string): Promise<MetaAd[]> {
    const fields = [
      'id',
      'name',
      'status',
      'campaign_id',
      'adset_id',
      'creative{id,title,body,image_url,video_id,call_to_action_type}',
      'created_time',
      'updated_time'
    ].join(',')

    const url = `${META_API_BASE_URL}/${adSetId}/ads?fields=${fields}&access_token=${this.config.accessToken}`

    const response = await fetch(url)

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      const errorMessage = errorData?.error?.message || response.statusText
      const errorCode = errorData?.error?.code || response.status
      throw new Error(`Meta API error (${errorCode}): ${errorMessage}`)
    }

    const data = await response.json()

    return data.data.map((ad: any) => this.mapAd(ad))
  }

  /**
   * Obtener Insights (métricas) de una entidad
   */
  async getInsights(
    entityId: string,
    entityType: 'campaign' | 'adset' | 'ad',
    dateRange: DateRange
  ): Promise<MetaInsights[]> {
    const fields = [
      'impressions',
      'reach',
      'frequency',
      'clicks',
      'unique_clicks',
      'ctr',
      'unique_ctr',
      'spend',
      'cpc',
      'cpm',
      'cpp',
      'actions',
      'action_values',
      'cost_per_action_type',
      'conversions',
      'cost_per_conversion',
      'conversion_rate_ranking',
      'purchase_roas'
    ].join(',')

    const timeRange = `&time_range={"since":"${dateRange.since}","until":"${dateRange.until}"}`
    const timeIncrement = '&time_increment=1' // 1 día

    const url = `${META_API_BASE_URL}/${entityId}/insights?fields=${fields}${timeRange}${timeIncrement}&access_token=${this.config.accessToken}`

    const response = await fetch(url)

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      const errorMessage = errorData?.error?.message || response.statusText
      const errorCode = errorData?.error?.code || response.status
      throw new Error(`Meta API error (${errorCode}): ${errorMessage}`)
    }

    const data = await response.json()

    return data.data.map((insight: any) => this.mapInsight(insight, entityId, entityType))
  }

  /**
   * Obtener resumen de insights (agregado)
   */
  async getInsightsSummary(
    entityId: string,
    entityType: 'campaign' | 'adset' | 'ad',
    dateRange: DateRange
  ): Promise<MetaInsights> {
    const fields = [
      'impressions',
      'reach',
      'frequency',
      'clicks',
      'unique_clicks',
      'ctr',
      'unique_ctr',
      'spend',
      'cpc',
      'cpm',
      'cpp',
      'actions',
      'action_values',
      'cost_per_action_type',
      'conversions',
      'cost_per_conversion',
      'purchase_roas'
    ].join(',')

    const timeRange = `&time_range={"since":"${dateRange.since}","until":"${dateRange.until}"}`

    const url = `${META_API_BASE_URL}/${entityId}/insights?fields=${fields}${timeRange}&access_token=${this.config.accessToken}`

    const response = await fetch(url)

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      const errorMessage = errorData?.error?.message || response.statusText
      const errorCode = errorData?.error?.code || response.status
      throw new Error(`Meta API error (${errorCode}): ${errorMessage}`)
    }

    const data = await response.json()

    if (!data.data || data.data.length === 0) {
      throw new Error('No insights data available')
    }

    return this.mapInsight(data.data[0], entityId, entityType)
  }

  // ===== MAPPERS =====

  private mapCampaign(data: any): MetaCampaign {
    return {
      id: data.id,
      userId: '', // Se llenará desde el frontend
      connectionId: '', // Se llenará desde el frontend
      accountId: this.config.adAccountId,
      name: data.name,
      status: data.status as CampaignStatus,
      objective: data.objective as CampaignObjective,
      dailyBudget: data.daily_budget ? parseFloat(data.daily_budget) / 100 : undefined,
      lifetimeBudget: data.lifetime_budget ? parseFloat(data.lifetime_budget) / 100 : undefined,
      budgetRemaining: data.budget_remaining ? parseFloat(data.budget_remaining) / 100 : undefined,
      startTime: new Date(data.start_time),
      stopTime: data.stop_time ? new Date(data.stop_time) : undefined,
      createdTime: new Date(data.created_time),
      updatedTime: new Date(data.updated_time),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncAt: new Date()
    }
  }

  private mapAdSet(data: any): MetaAdSet {
    return {
      id: data.id,
      userId: '',
      connectionId: '',
      accountId: this.config.adAccountId,
      campaignId: data.campaign_id,
      name: data.name,
      status: data.status as AdSetStatus,
      dailyBudget: data.daily_budget ? parseFloat(data.daily_budget) / 100 : undefined,
      lifetimeBudget: data.lifetime_budget ? parseFloat(data.lifetime_budget) / 100 : undefined,
      budgetRemaining: data.budget_remaining ? parseFloat(data.budget_remaining) / 100 : undefined,
      targeting: data.targeting ? {
        ageMin: data.targeting.age_min,
        ageMax: data.targeting.age_max,
        genders: data.targeting.genders,
        geoLocations: data.targeting.geo_locations
      } : undefined,
      startTime: new Date(data.start_time),
      endTime: data.end_time ? new Date(data.end_time) : undefined,
      createdTime: new Date(data.created_time),
      updatedTime: new Date(data.updated_time),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncAt: new Date()
    }
  }

  private mapAd(data: any): MetaAd {
    return {
      id: data.id,
      userId: '',
      connectionId: '',
      accountId: this.config.adAccountId,
      campaignId: data.campaign_id,
      adSetId: data.adset_id,
      name: data.name,
      status: data.status as AdStatus,
      creative: data.creative ? {
        id: data.creative.id,
        title: data.creative.title,
        body: data.creative.body,
        imageUrl: data.creative.image_url,
        videoId: data.creative.video_id,
        callToAction: data.creative.call_to_action_type
      } : undefined,
      createdTime: new Date(data.created_time),
      updatedTime: new Date(data.updated_time),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncAt: new Date()
    }
  }

  private mapInsight(data: any, entityId: string, entityType: 'campaign' | 'adset' | 'ad'): MetaInsights {
    // Extraer conversiones y compras de actions
    const purchases = this.extractActionValue(data.actions, 'purchase') || 0
    const purchaseValue = this.extractActionValue(data.action_values, 'purchase') || 0
    const conversions = this.extractActionValue(data.actions, 'offsite_conversion') || purchases
    const leads = this.extractActionValue(data.actions, 'lead') || 0

    return {
      id: `${entityType}_${entityId}_${data.date_start}`,
      userId: '',
      connectionId: '',
      accountId: this.config.adAccountId,
      entityType,
      entityId,
      date: data.date_start,
      dateStart: new Date(data.date_start),
      dateStop: new Date(data.date_stop),
      impressions: parseInt(data.impressions || '0'),
      reach: parseInt(data.reach || '0'),
      frequency: parseFloat(data.frequency || '0'),
      clicks: parseInt(data.clicks || '0'),
      linkClicks: this.extractActionValue(data.actions, 'link_click') || 0,
      uniqueClicks: parseInt(data.unique_clicks || '0'),
      ctr: parseFloat(data.ctr || '0'),
      uniqueCtr: parseFloat(data.unique_ctr || '0'),
      spend: parseFloat(data.spend || '0'),
      cpc: parseFloat(data.cpc || '0'),
      cpm: parseFloat(data.cpm || '0'),
      cpp: parseFloat(data.cpp || '0'),
      conversions,
      costPerConversion: conversions > 0 ? parseFloat(data.spend) / conversions : undefined,
      conversionRate: parseInt(data.clicks) > 0 ? (conversions / parseInt(data.clicks)) * 100 : undefined,
      purchases,
      purchaseValue,
      costPerPurchase: purchases > 0 ? parseFloat(data.spend) / purchases : undefined,
      purchaseRoas: parseFloat(data.purchase_roas?.[0]?.value || '0'),
      leads,
      costPerLead: leads > 0 ? parseFloat(data.spend) / leads : undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  private extractActionValue(actions: any[] | undefined, actionType: string): number {
    if (!actions) return 0
    const action = actions.find(a => a.action_type === actionType)
    return action ? parseFloat(action.value) : 0
  }
}

// ===== DATASET TRANSFORMERS =====

/**
 * Transforma campaigns de Meta Ads a Dataset
 */
export function transformCampaignsToDataset(
  campaigns: MetaCampaign[],
  insights: Record<string, MetaInsights>,
  connectionId: string,
  userId: string
): Dataset {
  const columns: DataColumn[] = [
    { id: 'campaign_id', name: 'campaign_id', displayName: 'Campaign ID', dataType: 'string', isDimension: true },
    { id: 'campaign_name', name: 'campaign_name', displayName: 'Campaign', dataType: 'string', isDimension: true },
    { id: 'status', name: 'status', displayName: 'Status', dataType: 'string', isDimension: true },
    { id: 'objective', name: 'objective', displayName: 'Objective', dataType: 'string', isDimension: true },
    { id: 'budget', name: 'budget', displayName: 'Budget', dataType: 'currency', format: '$0,0.00' },
    { id: 'impressions', name: 'impressions', displayName: 'Impressions', dataType: 'number', isMetric: true, aggregation: 'sum', format: '0,0' },
    { id: 'reach', name: 'reach', displayName: 'Reach', dataType: 'number', isMetric: true, aggregation: 'sum', format: '0,0' },
    { id: 'clicks', name: 'clicks', displayName: 'Clicks', dataType: 'number', isMetric: true, aggregation: 'sum', format: '0,0' },
    { id: 'ctr', name: 'ctr', displayName: 'CTR', dataType: 'percentage', isMetric: true, aggregation: 'avg', format: '0.00%' },
    { id: 'spend', name: 'spend', displayName: 'Spend', dataType: 'currency', isMetric: true, aggregation: 'sum', format: '$0,0.00' },
    { id: 'cpc', name: 'cpc', displayName: 'CPC', dataType: 'currency', isMetric: true, aggregation: 'avg', format: '$0.00' },
    { id: 'cpm', name: 'cpm', displayName: 'CPM', dataType: 'currency', isMetric: true, aggregation: 'avg', format: '$0.00' },
    { id: 'conversions', name: 'conversions', displayName: 'Conversions', dataType: 'number', isMetric: true, aggregation: 'sum', format: '0,0' },
    { id: 'cost_per_conversion', name: 'cost_per_conversion', displayName: 'Cost/Conv', dataType: 'currency', isMetric: true, aggregation: 'avg', format: '$0.00' },
    { id: 'roas', name: 'roas', displayName: 'ROAS', dataType: 'number', isMetric: true, aggregation: 'avg', format: '0.00x' }
  ]

  const rows: DataRow[] = campaigns.map(campaign => {
    const insight = insights[campaign.id]

    return {
      id: campaign.id,
      data: {
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        budget: campaign.dailyBudget || campaign.lifetimeBudget || 0,
        impressions: insight?.impressions || 0,
        reach: insight?.reach || 0,
        clicks: insight?.clicks || 0,
        ctr: insight?.ctr || 0,
        spend: insight?.spend || 0,
        cpc: insight?.cpc || 0,
        cpm: insight?.cpm || 0,
        conversions: insight?.conversions || 0,
        cost_per_conversion: insight?.costPerConversion || 0,
        roas: insight?.purchaseRoas || 0
      },
      metadata: {
        source: 'meta-ads',
        entityId: campaign.id,
        entityType: 'campaign'
      }
    }
  })

  return {
    id: `meta_campaigns_${Date.now()}`,
    userId,
    name: 'Meta Ads Campaigns',
    description: 'Overview of all Meta Ads campaigns with performance metrics',
    source: {
      type: 'meta-ads',
      connectionId,
      config: {}
    },
    columns,
    rows,
    metadata: {
      totalRows: rows.length,
      totalColumns: columns.length,
      lastRefresh: new Date(),
      refreshStatus: 'success'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

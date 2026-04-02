/**
 * Definiciones de columnas para diferentes tablas de datasets
 */

import { DataColumn } from '@/types/dataset'

// ===== META ADS =====

export const metaCampaignsColumns: DataColumn[] = [
  // Dimensiones
  {
    id: 'campaign_id',
    name: 'campaign_id',
    displayName: 'Campaign ID',
    dataType: 'string',
    isDimension: true,
    description: 'Identificador único de la campaña'
  },
  {
    id: 'campaign_name',
    name: 'campaign_name',
    displayName: 'Campaign Name',
    dataType: 'string',
    isDimension: true,
    description: 'Nombre de la campaña'
  },
  {
    id: 'status',
    name: 'status',
    displayName: 'Status',
    dataType: 'string',
    isDimension: true,
    description: 'Estado de la campaña'
  },
  {
    id: 'objective',
    name: 'objective',
    displayName: 'Objective',
    dataType: 'string',
    isDimension: true,
    description: 'Objetivo de la campaña'
  },
  {
    id: 'start_time',
    name: 'start_time',
    displayName: 'Start Date',
    dataType: 'date',
    isDimension: true,
    format: 'YYYY-MM-DD',
    description: 'Fecha de inicio'
  },

  // Métricas
  {
    id: 'impressions',
    name: 'impressions',
    displayName: 'Impressions',
    dataType: 'number',
    isMetric: true,
    aggregation: 'sum',
    format: '0,0',
    description: 'Número total de impresiones'
  },
  {
    id: 'reach',
    name: 'reach',
    displayName: 'Reach',
    dataType: 'number',
    isMetric: true,
    aggregation: 'sum',
    format: '0,0',
    description: 'Alcance único'
  },
  {
    id: 'clicks',
    name: 'clicks',
    displayName: 'Clicks',
    dataType: 'number',
    isMetric: true,
    aggregation: 'sum',
    format: '0,0',
    description: 'Número total de clics'
  },
  {
    id: 'ctr',
    name: 'ctr',
    displayName: 'CTR',
    dataType: 'percentage',
    isMetric: true,
    aggregation: 'avg',
    format: '0.00%',
    description: 'Click-through rate'
  },
  {
    id: 'spend',
    name: 'spend',
    displayName: 'Spend',
    dataType: 'currency',
    isMetric: true,
    aggregation: 'sum',
    format: '$0,0.00',
    description: 'Gasto total'
  },
  {
    id: 'cpc',
    name: 'cpc',
    displayName: 'CPC',
    dataType: 'currency',
    isMetric: true,
    aggregation: 'avg',
    format: '$0.00',
    description: 'Costo por clic'
  },
  {
    id: 'cpm',
    name: 'cpm',
    displayName: 'CPM',
    dataType: 'currency',
    isMetric: true,
    aggregation: 'avg',
    format: '$0.00',
    description: 'Costo por mil impresiones'
  },
  {
    id: 'conversions',
    name: 'conversions',
    displayName: 'Conversions',
    dataType: 'number',
    isMetric: true,
    aggregation: 'sum',
    format: '0,0',
    description: 'Número total de conversiones'
  },
  {
    id: 'cost_per_conversion',
    name: 'cost_per_conversion',
    displayName: 'Cost per Conversion',
    dataType: 'currency',
    isMetric: true,
    aggregation: 'avg',
    format: '$0.00',
    description: 'Costo por conversión'
  },
  {
    id: 'roas',
    name: 'roas',
    displayName: 'ROAS',
    dataType: 'number',
    isMetric: true,
    aggregation: 'avg',
    format: '0.00x',
    description: 'Return on ad spend'
  }
]

export const metaAdSetsColumns: DataColumn[] = [
  // Dimensiones
  {
    id: 'adset_id',
    name: 'adset_id',
    displayName: 'Ad Set ID',
    dataType: 'string',
    isDimension: true
  },
  {
    id: 'adset_name',
    name: 'adset_name',
    displayName: 'Ad Set Name',
    dataType: 'string',
    isDimension: true
  },
  {
    id: 'campaign_name',
    name: 'campaign_name',
    displayName: 'Campaign',
    dataType: 'string',
    isDimension: true
  },
  {
    id: 'status',
    name: 'status',
    displayName: 'Status',
    dataType: 'string',
    isDimension: true
  },

  // Métricas (similares a campaigns)
  {
    id: 'impressions',
    name: 'impressions',
    displayName: 'Impressions',
    dataType: 'number',
    isMetric: true,
    aggregation: 'sum',
    format: '0,0'
  },
  {
    id: 'clicks',
    name: 'clicks',
    displayName: 'Clicks',
    dataType: 'number',
    isMetric: true,
    aggregation: 'sum',
    format: '0,0'
  },
  {
    id: 'spend',
    name: 'spend',
    displayName: 'Spend',
    dataType: 'currency',
    isMetric: true,
    aggregation: 'sum',
    format: '$0,0.00'
  },
  {
    id: 'ctr',
    name: 'ctr',
    displayName: 'CTR',
    dataType: 'percentage',
    isMetric: true,
    aggregation: 'avg',
    format: '0.00%'
  },
  {
    id: 'cpc',
    name: 'cpc',
    displayName: 'CPC',
    dataType: 'currency',
    isMetric: true,
    aggregation: 'avg',
    format: '$0.00'
  }
]

export const metaAdsColumns: DataColumn[] = [
  // Dimensiones
  {
    id: 'ad_id',
    name: 'ad_id',
    displayName: 'Ad ID',
    dataType: 'string',
    isDimension: true
  },
  {
    id: 'ad_name',
    name: 'ad_name',
    displayName: 'Ad Name',
    dataType: 'string',
    isDimension: true
  },
  {
    id: 'adset_name',
    name: 'adset_name',
    displayName: 'Ad Set',
    dataType: 'string',
    isDimension: true
  },
  {
    id: 'campaign_name',
    name: 'campaign_name',
    displayName: 'Campaign',
    dataType: 'string',
    isDimension: true
  },
  {
    id: 'status',
    name: 'status',
    displayName: 'Status',
    dataType: 'string',
    isDimension: true
  },

  // Métricas
  {
    id: 'impressions',
    name: 'impressions',
    displayName: 'Impressions',
    dataType: 'number',
    isMetric: true,
    aggregation: 'sum',
    format: '0,0'
  },
  {
    id: 'clicks',
    name: 'clicks',
    displayName: 'Clicks',
    dataType: 'number',
    isMetric: true,
    aggregation: 'sum',
    format: '0,0'
  },
  {
    id: 'spend',
    name: 'spend',
    displayName: 'Spend',
    dataType: 'currency',
    isMetric: true,
    aggregation: 'sum',
    format: '$0,0.00'
  }
]

export const metaInsightsColumns: DataColumn[] = [
  // Dimensiones
  {
    id: 'date',
    name: 'date',
    displayName: 'Date',
    dataType: 'date',
    isDimension: true,
    format: 'YYYY-MM-DD'
  },
  {
    id: 'entity_name',
    name: 'entity_name',
    displayName: 'Entity',
    dataType: 'string',
    isDimension: true
  },
  {
    id: 'entity_type',
    name: 'entity_type',
    displayName: 'Type',
    dataType: 'string',
    isDimension: true
  },

  // Métricas
  {
    id: 'impressions',
    name: 'impressions',
    displayName: 'Impressions',
    dataType: 'number',
    isMetric: true,
    aggregation: 'sum',
    format: '0,0'
  },
  {
    id: 'reach',
    name: 'reach',
    displayName: 'Reach',
    dataType: 'number',
    isMetric: true,
    aggregation: 'sum',
    format: '0,0'
  },
  {
    id: 'clicks',
    name: 'clicks',
    displayName: 'Clicks',
    dataType: 'number',
    isMetric: true,
    aggregation: 'sum',
    format: '0,0'
  },
  {
    id: 'spend',
    name: 'spend',
    displayName: 'Spend',
    dataType: 'currency',
    isMetric: true,
    aggregation: 'sum',
    format: '$0,0.00'
  },
  {
    id: 'conversions',
    name: 'conversions',
    displayName: 'Conversions',
    dataType: 'number',
    isMetric: true,
    aggregation: 'sum',
    format: '0,0'
  }
]

// ===== HELPER FUNCTION =====

/**
 * Obtiene las columnas para una tabla específica
 */
export function getColumnsForTable(platform: string, table: string): DataColumn[] {
  const key = `${platform}-${table}`

  const columnMap: Record<string, DataColumn[]> = {
    'meta-ads-campaigns': metaCampaignsColumns,
    'meta-ads-ad-sets': metaAdSetsColumns,
    'meta-ads-ads': metaAdsColumns,
    'meta-ads-insights': metaInsightsColumns,
  }

  return columnMap[key] || []
}

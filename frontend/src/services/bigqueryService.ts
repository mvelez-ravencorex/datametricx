/**
 * Servicio para consultas a BigQuery
 * Usa Cloud Functions desplegadas en Firebase
 */

import { auth } from '@/config/firebase'
import type {
  MetaKPIs,
  MetaCampaignPerformance,
  MetaPlatformPerformance,
  MetaDemographics,
  MetaCreative
} from '@/types/bigquery'

const BIGQUERY_API_URL = import.meta.env.VITE_BIGQUERY_API_URL || 'https://us-central1-datametricx-prod.cloudfunctions.net'

interface BigQueryResponse<T = any> {
  rows: T[]
  totalRows?: number
  error?: string
}

/**
 * Función helper para hacer requests autenticados a Cloud Functions
 */
async function cloudFunctionRequest<T>(
  functionName: string,
  params?: Record<string, any>
): Promise<T> {
  const user = auth.currentUser
  if (!user) {
    throw new Error('Usuario no autenticado')
  }

  const token = await user.getIdToken()

  // Construir URL con query parameters
  const url = new URL(`${BIGQUERY_API_URL}/${functionName}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value))
      }
    })
  }

  console.log('📊 Llamando Cloud Function:', functionName, params)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error)
  }

  return data
}

/**
 * Ejecuta una consulta SQL personalizada en BigQuery
 */
export async function executeCustomQuery<T = any>(
  query: string
): Promise<BigQueryResponse<T>> {
  console.log('📊 Ejecutando query personalizada:', query.substring(0, 100) + '...')

  const response = await fetch(`${BIGQUERY_API_URL}/executeCustomQuery`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response.json()
}

/**
 * Obtiene las campañas de Meta Ads
 */
export async function getMetaCampaigns() {
  return await cloudFunctionRequest('getMetaCampaigns')
}

/**
 * Obtiene métricas de performance diaria por campaña
 */
export async function getMetaCampaignPerformance(
  startDate: string,
  endDate: string
): Promise<BigQueryResponse<MetaCampaignPerformance>> {
  return await cloudFunctionRequest<BigQueryResponse<MetaCampaignPerformance>>('getMetaCampaignPerformance', {
    startDate,
    endDate
  })
}

/**
 * Obtiene KPIs agregados para un rango de fechas
 */
export async function getMetaKPIs(
  startDate: string,
  endDate: string
): Promise<BigQueryResponse<MetaKPIs>> {
  return await cloudFunctionRequest<BigQueryResponse<MetaKPIs>>('getMetaKPIs', {
    startDate,
    endDate
  })
}

/**
 * Obtiene performance por plataforma (Facebook, Instagram, etc)
 */
export async function getMetaPerformanceByPlatform(
  startDate: string,
  endDate: string
): Promise<BigQueryResponse<MetaPlatformPerformance>> {
  return await cloudFunctionRequest<BigQueryResponse<MetaPlatformPerformance>>('getMetaPerformanceByPlatform', {
    startDate,
    endDate
  })
}

/**
 * Obtiene performance por edad y género
 */
export async function getMetaPerformanceByDemographics(
  startDate: string,
  endDate: string
): Promise<BigQueryResponse<MetaDemographics>> {
  return await cloudFunctionRequest<BigQueryResponse<MetaDemographics>>('getMetaPerformanceByDemographics', {
    startDate,
    endDate
  })
}

/**
 * Obtiene performance por país
 */
export async function getMetaPerformanceByCountry(
  startDate: string,
  endDate: string
) {
  return await cloudFunctionRequest('getMetaPerformanceByCountry', {
    startDate,
    endDate
  })
}

/**
 * Obtiene los mejores creativos por performance
 */
export async function getTopCreatives(
  startDate: string,
  endDate: string,
  limit: number = 10
): Promise<BigQueryResponse<MetaCreative>> {
  return await cloudFunctionRequest<BigQueryResponse<MetaCreative>>('getTopCreatives', {
    startDate,
    endDate,
    limit
  })
}

/**
 * Obtiene los adsets de Meta Ads
 */
export async function getMetaAdsets(
  startDate?: string,
  endDate?: string
) {
  return await cloudFunctionRequest('getMetaAdsets', {
    startDate,
    endDate
  })
}

/**
 * Obtiene los anuncios (ads) de Meta Ads
 */
export async function getMetaAds(
  startDate?: string,
  endDate?: string
) {
  return await cloudFunctionRequest('getMetaAds', {
    startDate,
    endDate
  })
}

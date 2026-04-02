import { useState, useEffect } from 'react'
import {
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  CursorArrowRaysIcon,
  CurrencyDollarIcon,
  CheckBadgeIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'
import {
  getMetaKPIs,
  getMetaCampaignPerformance,
  getMetaPerformanceByPlatform,
  getMetaPerformanceByDemographics,
  getTopCreatives
} from '@/services/bigqueryService'
import type {
  MetaKPIs,
  MetaCampaignPerformance,
  MetaPlatformPerformance,
  MetaDemographics,
  MetaCreative
} from '@/types/bigquery'

export default function MetaReporting() {
  // Date range - últimos 30 días por defecto
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // Data states
  const [kpis, setKpis] = useState<MetaKPIs | null>(null)
  const [campaignPerformance, setCampaignPerformance] = useState<MetaCampaignPerformance[]>([])
  const [platformPerformance, setPlatformPerformance] = useState<MetaPlatformPerformance[]>([])
  const [demographics, setDemographics] = useState<MetaDemographics[]>([])
  const [topCreatives, setTopCreatives] = useState<MetaCreative[]>([])

  // Loading state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cargar datos
  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('📊 Cargando datos de BigQuery...', { startDate, endDate })

      // Cargar todos los datos en paralelo
      const [kpisData, campaignsData, platformsData, demographicsData, creativesData] = await Promise.all([
        getMetaKPIs(startDate, endDate),
        getMetaCampaignPerformance(startDate, endDate),
        getMetaPerformanceByPlatform(startDate, endDate),
        getMetaPerformanceByDemographics(startDate, endDate),
        getTopCreatives(startDate, endDate, 10)
      ])

      console.log('✅ Datos cargados:', {
        kpis: kpisData,
        campaigns: campaignsData.rows?.length || 0,
        platforms: platformsData.rows?.length || 0,
        demographics: demographicsData.rows?.length || 0,
        creatives: creativesData.rows?.length || 0
      })

      setKpis(kpisData.rows?.[0] || null)
      setCampaignPerformance(campaignsData.rows || [])
      setPlatformPerformance(platformsData.rows || [])
      setDemographics(demographicsData.rows || [])
      setTopCreatives(creativesData.rows || [])

    } catch (err: any) {
      console.error('❌ Error cargando datos:', err)
      setError(err.message || 'Error cargando datos de BigQuery')
    } finally {
      setLoading(false)
    }
  }

  // Cargar datos al montar y cuando cambie el rango de fechas
  useEffect(() => {
    loadData()
  }, [])

  // Formatear número como moneda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  // Formatear número con separadores
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-ES').format(value)
  }

  // Formatear porcentaje
  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meta Ads Reporting</h1>
          <p className="text-gray-600 mt-1">
            Análisis completo de performance de campañas
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-primary-blue text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowPathIcon className={`mr-2 h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Filtro de fechas */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Rango de Fechas</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicio
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Fin
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent"
            />
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-6 py-2 bg-primary-blue text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Aplicar Filtro
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">❌ {error}</p>
        </div>
      )}

      {/* KPIs principales */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Spend */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Total Spend</h3>
              <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(kpis.total_spend)}</div>
            <p className="text-xs text-gray-500 mt-1">
              CPM: {formatCurrency(kpis.avg_cpm)}
            </p>
          </div>

          {/* Impresiones */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Impresiones</h3>
              <ArrowTrendingUpIcon className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatNumber(kpis.total_impressions)}</div>
            <p className="text-xs text-gray-500 mt-1">
              CTR: {formatPercent(kpis.avg_ctr)}
            </p>
          </div>

          {/* Clicks */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Clicks</h3>
              <CursorArrowRaysIcon className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatNumber(kpis.total_clicks)}</div>
            <p className="text-xs text-gray-500 mt-1">
              CPC: {formatCurrency(kpis.avg_cpc)}
            </p>
          </div>

          {/* Conversiones */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Conversiones</h3>
              <CheckBadgeIcon className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatNumber(kpis.total_conversions)}</div>
            <p className="text-xs text-gray-500 mt-1">
              ROAS: {kpis.avg_roas.toFixed(2)}x
            </p>
          </div>
        </div>
      )}

      {/* Performance por Plataforma */}
      {platformPerformance.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Performance por Plataforma</h3>
            <p className="text-sm text-gray-600 mt-1">Desglose de resultados por plataforma de publicación</p>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Plataforma</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Impresiones</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Clicks</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Spend</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Conversiones</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">CTR</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">CPC</th>
                  </tr>
                </thead>
                <tbody>
                  {platformPerformance.map((platform, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{platform.publisher_platform}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatNumber(platform.impressions)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatNumber(platform.clicks)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatCurrency(platform.spend)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatNumber(platform.conversions)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatPercent(platform.ctr)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatCurrency(platform.cpc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Performance por Campaña */}
      {campaignPerformance.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Performance por Campaña</h3>
            <p className="text-sm text-gray-600 mt-1">Top campañas por performance</p>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Fecha</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Campaña</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Impresiones</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Clicks</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Spend</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Conversiones</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Revenue</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">ROAS</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignPerformance.slice(0, 20).map((campaign, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">{campaign.date}</td>
                      <td className="py-3 px-4 font-medium text-gray-900">{campaign.campaign_name}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatNumber(campaign.impressions)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatNumber(campaign.clicks)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatCurrency(campaign.spend)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatNumber(campaign.conversions)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatCurrency(campaign.revenue)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{campaign.roas.toFixed(2)}x</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatPercent(campaign.ctr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Performance por Demografía */}
      {demographics.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Performance por Demografía</h3>
            <p className="text-sm text-gray-600 mt-1">Desglose por edad y género</p>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Edad</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Género</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Impresiones</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Clicks</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Spend</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Conversiones</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">CTR</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">CPC</th>
                  </tr>
                </thead>
                <tbody>
                  {demographics.map((demo, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">{demo.age}</td>
                      <td className="py-3 px-4 text-gray-900">{demo.gender}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatNumber(demo.impressions)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatNumber(demo.clicks)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatCurrency(demo.spend)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatNumber(demo.conversions)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatPercent(demo.ctr)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatCurrency(demo.cpc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Top Creativos */}
      {topCreatives.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Top Creativos</h3>
            <p className="text-sm text-gray-600 mt-1">Los 10 creativos con mejor performance</p>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Nombre</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Impresiones</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Clicks</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Spend</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Conversiones</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">CTR</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Conv. Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {topCreatives.map((creative, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-xs text-gray-500">{creative.creative_id}</td>
                      <td className="py-3 px-4 font-medium text-gray-900">{creative.creative_name}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatNumber(creative.impressions)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatNumber(creative.clicks)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatCurrency(creative.spend)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatNumber(creative.conversions)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatPercent(creative.ctr)}</td>
                      <td className="text-right py-3 px-4 text-gray-900">{formatPercent(creative.conversion_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Estado de carga */}
      {loading && !kpis && (
        <div className="bg-white rounded-lg shadow p-12">
          <div className="flex flex-col items-center justify-center">
            <ArrowPathIcon className="h-12 w-12 animate-spin text-primary-blue mb-4" />
            <span className="text-gray-600">Cargando datos...</span>
          </div>
        </div>
      )}

      {/* Sin datos */}
      {!loading && !error && !kpis && (
        <div className="bg-white rounded-lg shadow p-12">
          <div className="flex flex-col items-center justify-center text-gray-500">
            <ChartBarIcon className="h-16 w-16 mb-4" />
            <p>No hay datos disponibles para el rango de fechas seleccionado</p>
          </div>
        </div>
      )}
    </div>
  )
}

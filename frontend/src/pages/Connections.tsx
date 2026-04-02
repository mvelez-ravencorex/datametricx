/**
 * Página de Integraciones - Gestión de datasources con plataformas externas
 * Implementa FRONT 1, FRONT 2 y FRONT 3
 */

import { useState, useEffect } from 'react'
import { PlatformInfo, ConnectionPlatform, Connection, MetaDatasourceConfig } from '@/types/connections'
import { CheckCircleIcon, XCircleIcon, TrashIcon, XMarkIcon, ClockIcon, PlayIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import MetaAdsConnectionModal, { DatasourceSetup } from '@/components/connections/MetaAdsConnectionModal'
import SyncConfigModal from '@/components/connections/SyncConfigModal'
import { MetaAdsOnboarding } from '@/components/connections/meta'
import { useAuth } from '@/contexts/AuthContext'
import { PLATFORM_SYNC_FREQUENCIES, SyncFrequency } from '@/types/connections'
import {
  getTenantDatasources,
  createDatasource,
  updateDatasource,
  deleteDatasource,
  updateSyncStatus,
  addSyncHistoryEntry,
  DatasourceConfig,
  saveMetaDatasourceConfig,
  getMetaDatasourceConfig
} from '@/services/datasourceService'
import { runSyncNow, SyncNowResponse, deleteSecret } from '@/services/apiService'
import { diagnoseDatasource, diagnoseUserDocument } from '@/utils/diagnostics'
import { debugCurrentUser } from '@/utils/authDebug'
import { auth, db } from '@/config/firebase'
import { collection, onSnapshot } from 'firebase/firestore'
import { fixDatasourcePlatform } from '@/utils/fixDatasource'

// Información de plataformas disponibles
// IMPORTANTE: Los IDs deben coincidir con el campo 'platform' en Firestore (con underscores)
const PLATFORMS: PlatformInfo[] = [
  {
    id: 'meta_ads',  // Cambiado de 'meta-ads' a 'meta_ads' para coincidir con Firestore
    name: 'Meta Ads',
    description: 'Conecta tu cuenta de Facebook Ads para obtener métricas de campañas',
    icon: '📘',
    color: '#1877F2',
    category: 'advertising',
  },
  {
    id: 'google_analytics_4',  // Cambiado de 'google-analytics-4' a 'google_analytics_4'
    name: 'Google Analytics 4',
    description: 'Analiza el tráfico web y comportamiento de usuarios',
    icon: '📊',
    color: '#F9AB00',
    category: 'analytics',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Sincroniza productos, pedidos y clientes de tu tienda',
    icon: '🛍️',
    color: '#96BF48',
    category: 'ecommerce',
  },
  {
    id: 'tiendanube',
    name: 'TiendaNube',
    description: 'Importa datos de ventas y productos de TiendaNube',
    icon: '🏪',
    color: '#4B52E6',
    category: 'ecommerce',
  },
  {
    id: 'mercadolibre',
    name: 'MercadoLibre',
    description: 'Conecta tu cuenta de vendedor de MercadoLibre',
    icon: '💛',
    color: '#FFE600',
    category: 'ecommerce',
  },
  {
    id: 'amazon',
    name: 'Amazon Seller',
    description: 'Sincroniza ventas y productos de Amazon',
    icon: '📦',
    color: '#FF9900',
    category: 'ecommerce',
  },
  {
    id: 'tiktok_ads',  // Cambiado de 'tiktok' a 'tiktok_ads' para coincidir con backend
    name: 'TikTok Ads',
    description: 'Obtén métricas de tus campañas publicitarias en TikTok',
    icon: '🎵',
    color: '#000000',
    category: 'advertising',
  },
]

export default function Connections() {
  const { currentTenant } = useAuth()
  const [datasources, setDatasources] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState<ConnectionPlatform | null>(null)

  // Modales
  const [activeModal, setActiveModal] = useState<ConnectionPlatform | null>(null)
  const [editingDatasource, setEditingDatasource] = useState<Connection | null>(null)
  const [syncModalPlatform, setSyncModalPlatform] = useState<ConnectionPlatform | null>(null)

  // Nuevo: Meta Ads Onboarding
  const [showMetaOnboarding, setShowMetaOnboarding] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_metaConfig, setMetaConfig] = useState<MetaDatasourceConfig | null>(null)

  // Notificaciones
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null)

  // Sync Now tracking
  const [syncingDatasources, setSyncingDatasources] = useState<Set<string>>(new Set())

  // ==================== CARGAR DATASOURCES ====================

  useEffect(() => {
    loadDatasources()
  }, [currentTenant])

  async function loadDatasources() {
    console.log('🔄 loadDatasources() llamado', { currentTenant: currentTenant?.id })

    if (!currentTenant) {
      console.log('⚠️ No hay currentTenant, abortando carga')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log('🔍 Llamando a getTenantDatasources...')
      const tenantDatasources = await getTenantDatasources(currentTenant.id)
      console.log('✅ Datasources recibidos:', tenantDatasources.length)
      setDatasources(tenantDatasources)
    } catch (error) {
      console.error('❌ Error al cargar datasources:', error)
      setNotification({
        type: 'error',
        message: 'Error al cargar las integraciones. Por favor, recarga la página.'
      })
    } finally {
      setLoading(false)
    }
  }

  // ==================== CARGAR META CONFIG ====================

  useEffect(() => {
    loadMetaConfig()
  }, [currentTenant])

  async function loadMetaConfig() {
    if (!currentTenant) return

    try {
      const config = await getMetaDatasourceConfig(currentTenant.id)
      setMetaConfig(config)
    } catch (error) {
      console.error('Error al cargar Meta config:', error)
    }
  }

  // Handler para cuando se completa el onboarding de Meta
  const handleMetaOnboardingComplete = async (config: MetaDatasourceConfig) => {
    if (!currentTenant) return

    try {
      await saveMetaDatasourceConfig(currentTenant.id, config)

      // Recargar datos
      await loadDatasources()
      await loadMetaConfig()

      setShowMetaOnboarding(false)

      setNotification({
        type: 'success',
        message: 'Meta Ads conectado exitosamente. La sincronización inicial comenzará en breve.'
      })
    } catch (error) {
      console.error('Error al guardar Meta config:', error)
      throw error
    }
  }

  // ==================== LISTENER DE FIRESTORE ====================
  // Escucha cambios en tiempo real para actualizar el estado cuando el backend actualiza Firestore

  useEffect(() => {
    if (!currentTenant) return

    console.log('👂 Configurando listener de Firestore para datasources del tenant:', currentTenant.id)

    const datasourcesRef = collection(db, 'tenants', currentTenant.id, 'datasources')

    const unsubscribe = onSnapshot(
      datasourcesRef,
      { includeMetadataChanges: false },
      (snapshot) => {
        // Solo recargar si hay cambios reales (no en la carga inicial)
        const changes = snapshot.docChanges()
        if (changes.length > 0 && changes.some(change => change.type === 'modified')) {
          console.log('📡 Cambios detectados en Firestore, recargando...')
          loadDatasources()
        }
      },
      (error) => {
        console.error('❌ Error en listener de Firestore:', error)
      }
    )

    // Cleanup: Desuscribirse cuando el componente se desmonta o cambia el tenant
    return () => {
      console.log('🔌 Desconectando listener de Firestore')
      unsubscribe()
    }
  }, [currentTenant]) // Solo depende de currentTenant, NO de datasources

  // Limpiar notificaciones después de 5 segundos
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // ==================== HELPERS ====================

  const filteredPlatforms = PLATFORMS

  // Seleccionar el primer tab al cargar
  useEffect(() => {
    if (PLATFORMS.length > 0 && !selectedTab) {
      setSelectedTab(PLATFORMS[0].id)
    }
  }, [])

  const isConnected = (platformId: ConnectionPlatform) => {
    return datasources.some(ds => ds.platform === platformId)
  }

  const getDatasourcesForPlatform = (platformId: ConnectionPlatform): Connection[] => {
    return datasources.filter(ds => ds.platform === platformId)
  }

  // ==================== FRONT 1 + FRONT 2: GUARDAR DATASOURCE ====================

  const handleSaveMetaAds = async (setup: DatasourceSetup) => {
    if (!currentTenant) return

    console.log('💾 handleSaveMetaAds recibido:', {
      backfill_days: setup.backfill_days,
      backfill_days_type: typeof setup.backfill_days,
      frequency: setup.frequency,
      name: setup.name
    })

    try {
      const datasourceId = editingDatasource?.id || `meta-${Date.now()}`

      const config: DatasourceConfig = {
        name: setup.name,
        platform: 'meta_ads',
        secret_id: setup.secret_id,
        connected: setup.connected,
        status: setup.status,
        frequency: setup.frequency,
        time_utc: setup.time_utc,
        backfill_days: setup.backfill_days,
        metadata: {
          adAccountId: setup.adAccountId
        }
      }

      console.log('📋 Config creado para guardar:', {
        backfill_days: config.backfill_days,
        backfill_days_type: typeof config.backfill_days
      })

      if (editingDatasource) {
        // Actualizar existente
        await updateDatasource(currentTenant.id, datasourceId, config)
        setNotification({
          type: 'success',
          message: 'Integración Meta Ads actualizada exitosamente'
        })
      } else {
        // Crear nueva
        await createDatasource(currentTenant.id, datasourceId, config)
        setNotification({
          type: 'success',
          message: 'Integración Meta Ads creada exitosamente'
        })
      }

      // Recargar datasources
      await loadDatasources()
      setEditingDatasource(null)
    } catch (error) {
      console.error('❌ Error al guardar datasource Meta Ads:', error)
      throw error // El modal mostrará el error
    }
  }

  // ==================== CONFIGURAR ====================

  const handleConnect = (platformId: ConnectionPlatform) => {
    // Usar el nuevo onboarding para Meta Ads
    if (platformId === 'meta_ads') {
      setShowMetaOnboarding(true)
      return
    }

    setEditingDatasource(null)
    setActiveModal(platformId)
  }

  const handleEdit = (datasource: Connection) => {
    setEditingDatasource(datasource)
    setActiveModal(datasource.platform)
  }

  // ==================== SYNC CONFIG ====================

  const handleSaveSyncConfig = async (frequency: SyncFrequency, time: string) => {
    if (!currentTenant || !syncModalPlatform) return

    const datasource = getDatasourcesForPlatform(syncModalPlatform)[0]
    if (!datasource) return

    try {
      await updateDatasource(currentTenant.id, datasource.id, {
        frequency: frequency,
        time_utc: time
      })

      await loadDatasources()

      setNotification({
        type: 'success',
        message: 'Configuración de sincronización actualizada'
      })
    } catch (error) {
      console.error('❌ Error al actualizar configuración:', error)
      throw error
    }
  }

  // ==================== FRONT 3: SYNC NOW ====================

  const handleSyncNow = async (datasource: Connection) => {
    if (!currentTenant) return

    try {
      setSyncingDatasources(prev => new Set(prev).add(datasource.id))

      // Validar que el datasource tenga secret_id
      if (!datasource.secret_id) {
        throw new Error('Este datasource no tiene credenciales configuradas. Por favor, reconecta la integración.')
      }

      console.log('🔄 Iniciando sync para:', {
        tenantId: currentTenant.id,
        datasourceId: datasource.id,
        platform: datasource.platform,
        secret_id: datasource.secret_id ? '✅ Existe' : '❌ No existe',
        connected: datasource.connected,
        status: datasource.status,
        frequency: datasource.frequency,
        backfill_days: datasource.backfill_days
      })

      // Ejecutar diagnóstico detallado antes de sync
      console.log('🔍 Ejecutando diagnóstico...')
      const diagnosis = await diagnoseDatasource(currentTenant.id, datasource.id)

      if (!diagnosis.success) {
        throw new Error(`Diagnóstico falló: ${diagnosis.error}`)
      }

      console.log('✅ Diagnóstico completado, iniciando sync...')

      // Debug: Verificar usuario y token
      console.log('🔐 Verificando autenticación...')
      const authInfo = await debugCurrentUser()
      console.log('🔐 Auth info:', authInfo)

      // Verificar documento del usuario en Firestore
      if (auth.currentUser) {
        console.log('📄 Verificando documento del usuario en Firestore...')
        const userDocInfo = await diagnoseUserDocument(auth.currentUser.uid)
        console.log('📄 User document info:', userDocInfo)

        if (userDocInfo.exists && userDocInfo.hasTenantId) {
          console.log('✅ Usuario tiene tenantId en Firestore:', userDocInfo.tenantId)
          console.log('⚠️ Pero el token JWT NO tiene este claim')
          console.log('💡 Solución: Necesitas refrescar el token o agregar el custom claim')
        }
      }

      // Mapear el nombre de la plataforma al formato que espera el backend
      const platformMapping: Record<string, string> = {
        'meta_ads': 'meta',
        'tiktok_ads': 'tiktok',
        'shopify': 'shopify',
        'google_analytics_4': 'ga4',
        'tiendanube': 'tiendanube',
        'mercadolibre': 'mercadolibre',
        'amazon': 'amazon'
      }

      const backendDatasourceName = platformMapping[datasource.platform] || datasource.platform

      console.log('🔄 Mapeando plataforma:', {
        frontend: datasource.platform,
        backend: backendDatasourceName
      })

      // Fix temporal: Si el platform en Firestore tiene guión, actualizarlo a underscore
      if (datasource.platform.includes('-')) {
        console.log('🔧 Detectado platform con guión, actualizando a underscore...')
        const fixedPlatform = datasource.platform.replace(/-/g, '_')
        await fixDatasourcePlatform(
          currentTenant.id,
          datasource.id,
          datasource.platform,
          fixedPlatform
        )
        // Actualizar el objeto local
        datasource.platform = fixedPlatform as any
        console.log('✅ Platform actualizado, reintentando sync...')
      }

      const result: SyncNowResponse = await runSyncNow({
        tenantId: currentTenant.id,
        datasourceId: datasource.id,
        datasource: backendDatasourceName
      })

      console.log('✅ Sync iniciado exitosamente:', result)

      // Agregar entrada al historial de sincronizaciones
      await addSyncHistoryEntry(
        currentTenant.id,
        datasource.id,
        {
          jobId: result.job_id,
          type: 'manual', // Sync Now es siempre manual
          triggeredBy: auth.currentUser?.uid
        }
      )

      console.log('✅ Sync history entry creada')

      // Actualizar estado del datasource a "pending" en Firestore
      await updateSyncStatus(
        currentTenant.id,
        datasource.id,
        {
          status: 'pending',
          timestamp: new Date(),
          recordsProcessed: 0
        },
        result.job_id
      )

      console.log('✅ Estado actualizado a "pending" en Firestore')

      setNotification({
        type: 'info',
        message: `Sincronización iniciada para ${datasource.name}. El estado se actualizará automáticamente cuando termine.`
      })

      // Recargar datasources para mostrar el estado actualizado
      await loadDatasources()

      // Remover del set de syncing (el estado visual lo mostrará el badge)
      setSyncingDatasources(prev => {
        const next = new Set(prev)
        next.delete(datasource.id)
        return next
      })

      // El listener de Firestore se encargará de actualizar el estado cuando termine el job
      // El backend actualizará Firestore cuando el job complete
    } catch (error) {
      console.error('❌ Error al ejecutar Sync Now:', error)
      setSyncingDatasources(prev => {
        const next = new Set(prev)
        next.delete(datasource.id)
        return next
      })
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Error al iniciar sincronización'
      })
    }
  }

  // ==================== ELIMINAR ====================

  const handleDeleteDatasource = async (datasource: Connection) => {
    if (!currentTenant) return

    // Mensaje de confirmación detallado
    const confirmMessage = datasource.secret_id
      ? `¿Estás seguro de que deseas eliminar "${datasource.name}"?\n\n` +
        `Esto eliminará:\n` +
        `• La conexión de la plataforma\n` +
        `• Las credenciales de Google Cloud Secret Manager\n` +
        `• La configuración de sincronización\n\n` +
        `⚠️ Esta acción NO se puede deshacer.`
      : `¿Estás seguro de que deseas eliminar "${datasource.name}"?\n\n` +
        `⚠️ Esta acción NO se puede deshacer.`

    if (!confirm(confirmMessage)) return

    try {
      console.log('🗑️ Iniciando eliminación de datasource:', {
        id: datasource.id,
        name: datasource.name,
        platform: datasource.platform,
        hasSecret: !!datasource.secret_id
      })

      // 1. Primero eliminar el secret de Google Cloud Secret Manager
      if (datasource.secret_id) {
        console.log('🔐 Eliminando secret de Google Cloud:', datasource.secret_id)

        try {
          await deleteSecret({
            tenantId: currentTenant.id,
            secretId: datasource.secret_id,
            platform: datasource.platform
          })
          console.log('✅ Secret eliminado exitosamente')
        } catch (secretError) {
          console.error('❌ Error al eliminar secret:', secretError)

          // Preguntar si desea continuar aunque falle la eliminación del secret
          const continueAnyway = confirm(
            `Error al eliminar las credenciales de Google Cloud:\n${secretError instanceof Error ? secretError.message : 'Error desconocido'}\n\n` +
            `¿Deseas continuar y eliminar solo la conexión de Firestore?`
          )

          if (!continueAnyway) {
            throw new Error('Eliminación cancelada por el usuario')
          }
        }
      }

      // 2. Luego eliminar el datasource de Firestore
      console.log('📄 Eliminando datasource de Firestore...')
      await deleteDatasource(currentTenant.id, datasource.id)
      console.log('✅ Datasource eliminado de Firestore')

      // 3. Recargar lista de datasources
      await loadDatasources()

      setNotification({
        type: 'success',
        message: datasource.secret_id
          ? 'Integración y credenciales eliminadas exitosamente'
          : 'Integración eliminada exitosamente'
      })
    } catch (error) {
      console.error('❌ Error al eliminar datasource:', error)
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Error al eliminar integración'
      })
    }
  }

  // ==================== RENDER ====================

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold text-gray-900">
              Integraciones
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Conecta tus plataformas favoritas para centralizar todos tus datos
            </p>
          </div>
          <button
            onClick={() => loadDatasources()}
            disabled={loading}
            className="px-4 py-2 rounded-lg font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Refrescar estado"
          >
            <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refrescar
          </button>
        </div>
      </div>

      {/* Notificación */}
      {notification && (
        <div className={`mb-6 rounded-lg p-4 ${
          notification.type === 'success'
            ? 'bg-green-50 border border-green-200'
            : notification.type === 'error'
            ? 'bg-red-50 border border-red-200'
            : 'bg-blue-50 border border-blue-200'
        }`}>
          <div className="flex items-center">
            {notification.type === 'success' ? (
              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-3" />
            ) : notification.type === 'error' ? (
              <XCircleIcon className="h-5 w-5 text-red-500 mr-3" />
            ) : (
              <CheckCircleIcon className="h-5 w-5 text-blue-500 mr-3" />
            )}
            <p className={`text-sm font-medium ${
              notification.type === 'success' ? 'text-green-800'
              : notification.type === 'error' ? 'text-red-800'
              : 'text-blue-800'
            }`}>
              {notification.message}
            </p>
            <button
              onClick={() => setNotification(null)}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}


      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue"></div>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Sidebar con plataformas */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-3 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Plataformas
                </h3>
              </div>
              <nav className="p-2 space-y-1">
                {filteredPlatforms.map((platform) => {
                  const connected = isConnected(platform.id)
                  const platformDatasources = getDatasourcesForPlatform(platform.id)
                  const datasource = platformDatasources[0]

                  return (
                    <button
                      key={platform.id}
                      onClick={() => setSelectedTab(platform.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        selectedTab === platform.id
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xl flex-shrink-0">{platform.icon}</span>
                      <span className="flex-1 text-left truncate">{platform.name}</span>
                      {connected && datasource && (
                        <span className={`flex-shrink-0 w-2 h-2 rounded-full ${
                          datasource.status === 'ok' ? 'bg-green-500' :
                          datasource.status === 'error' ? 'bg-red-500' :
                          datasource.status === 'pending' ? 'bg-blue-500' :
                          datasource.status === 'no-data' ? 'bg-yellow-500' :
                          'bg-gray-400'
                        }`} />
                      )}
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Contenido principal */}
          <div className="flex-1 min-w-0">
            {/* Tab Content */}
            {selectedTab && (() => {
        const platform = filteredPlatforms.find(p => p.id === selectedTab)
        if (!platform) return null

        const connected = isConnected(platform.id)
        const platformDatasources = getDatasourcesForPlatform(platform.id)
        const datasource = platformDatasources[0]

        return (
          <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            {/* Header con color de la plataforma */}
            <div
              className="h-2"
              style={{ backgroundColor: platform.color }}
            />

            <div className="p-8">
              {/* Icono, nombre y descripción */}
              <div className="flex items-start gap-4 mb-6">
                <div className="text-5xl">{platform.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-semibold text-gray-900">
                      {platform.name}
                    </h2>
                    {connected && (
                      <CheckCircleIcon className="h-6 w-6 text-green-500" />
                    )}
                    {connected && datasource && (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        datasource.status === 'ok' ? 'bg-green-100 text-green-800' :
                        datasource.status === 'error' ? 'bg-red-100 text-red-800' :
                        datasource.status === 'pending' ? 'bg-blue-100 text-blue-800' :
                        datasource.status === 'no-data' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {datasource.status === 'ok' && '✅ OK'}
                        {datasource.status === 'error' && '❌ Error'}
                        {datasource.status === 'pending' && '⏳ Pendiente'}
                        {datasource.status === 'never-run' && '⚪ Nunca ejecutado'}
                        {datasource.status === 'no-data' && '⚠️ Sin datos'}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mt-2">
                    {platform.description}
                  </p>
                </div>
              </div>

              {/* Badge de sincronización en progreso */}
              {connected && datasource && datasource.syncStatus === 'pending' && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                  <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <span className="text-sm font-medium text-blue-700">
                    🔄 Sincronización en progreso...
                  </span>
                </div>
              )}

              {/* Información del datasource si está conectado */}
              {connected && datasource && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">{datasource.name}</h3>
                    <span className="text-sm text-gray-500">
                      {datasource.status === 'ok' && '✅ Última sincronización exitosa'}
                      {datasource.status === 'error' && '❌ Error en última sincronización'}
                      {datasource.status === 'pending' && '⏳ Sincronización pendiente'}
                      {datasource.status === 'never-run' && '⚪ Sin sincronizar'}
                    </span>
                  </div>

                  {/* Información de sincronización */}
                  <div className="space-y-2">
                    {/* Mensaje de error si existe */}
                    {datasource.status === 'error' && datasource.lastSyncResult?.errorMessage && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                        <span className="font-medium">Error:</span> {datasource.lastSyncResult.errorMessage}
                      </div>
                    )}

                    {/* Última sincronización */}
                    {datasource.lastSyncAt && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="font-medium">Última sincronización:</span>
                        <span>{new Date(datasource.lastSyncAt).toLocaleString('es', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</span>
                      </div>
                    )}

                    {/* Registros procesados */}
                    {datasource.lastSyncResult?.recordsProcessed !== undefined && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="font-medium">Registros procesados:</span>
                        <span>{datasource.lastSyncResult.recordsProcessed.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="space-y-3">
                {!connected ? (
                  <button
                    onClick={() => handleConnect(platform.id)}
                    className="w-full px-6 py-3 rounded-lg font-medium transition-colors bg-primary-blue text-white hover:bg-secondary-blue text-lg"
                  >
                    Conectar {platform.name}
                  </button>
                ) : datasource && (
                  <div className="flex flex-wrap gap-3">
                    {/* Sync Now */}
                    <button
                      onClick={() => handleSyncNow(datasource)}
                      disabled={syncingDatasources.has(datasource.id)}
                      className="flex-1 min-w-[200px] px-6 py-3 rounded-lg font-medium transition-colors bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {syncingDatasources.has(datasource.id) ? (
                        <>
                          <div className="animate-spin h-5 w-5 border-2 border-green-600 border-t-transparent rounded-full"></div>
                          <span>Sincronizando...</span>
                        </>
                      ) : (
                        <>
                          <PlayIcon className="h-5 w-5" />
                          <span>Sincronizar Ahora</span>
                        </>
                      )}
                    </button>

                    {/* Configurar */}
                    <button
                      onClick={() => handleEdit(datasource)}
                      className="px-6 py-3 rounded-lg font-medium transition-colors bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <Cog6ToothIcon className="h-5 w-5" />
                      <span>Configurar</span>
                    </button>

                    {/* Configurar actualización */}
                    <button
                      onClick={() => setSyncModalPlatform(platform.id)}
                      className="px-6 py-3 rounded-lg font-medium transition-colors bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center gap-2"
                    >
                      <ClockIcon className="h-5 w-5" />
                      <span>Horario de Sincronización</span>
                    </button>

                    {/* Eliminar */}
                    <button
                      onClick={() => handleDeleteDatasource(datasource)}
                      className="px-6 py-3 rounded-lg font-medium transition-colors bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-2"
                    >
                      <TrashIcon className="h-5 w-5" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

            {/* Empty state si no hay resultados */}
            {filteredPlatforms.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No hay plataformas en esta categoría</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modales de conexión */}
      <MetaAdsConnectionModal
        isOpen={activeModal === 'meta_ads'}
        onClose={() => {
          setActiveModal(null)
          setEditingDatasource(null)
        }}
        onSave={handleSaveMetaAds}
        tenantId={currentTenant?.id || ''}
        isEditing={!!editingDatasource}
        existingConfig={editingDatasource && editingDatasource.platform === 'meta_ads' ? {
          name: editingDatasource.name,
          secret_id: editingDatasource.secret_id,
          adAccountId: (editingDatasource as any).adAccountId,
          connected: editingDatasource.connected,
          status: editingDatasource.status,
          frequency: editingDatasource.frequency,
          time_utc: editingDatasource.time_utc,
          backfill_days: editingDatasource.backfill_days
        } : undefined}
      />

      {/* Modal de configuración de sincronización */}
      {syncModalPlatform && (
        <SyncConfigModal
          isOpen={syncModalPlatform !== null}
          onClose={() => setSyncModalPlatform(null)}
          onSave={handleSaveSyncConfig}
          platformName={PLATFORMS.find(p => p.id === syncModalPlatform)?.name || ''}
          availableFrequencies={PLATFORM_SYNC_FREQUENCIES[syncModalPlatform]}
          initialFrequency={getDatasourcesForPlatform(syncModalPlatform)[0]?.frequency || 'daily'}
          initialTime={getDatasourcesForPlatform(syncModalPlatform)[0]?.time_utc || '03:00'}
        />
      )}

      {/* Modal de Meta Ads Onboarding (nuevo flujo) */}
      {showMetaOnboarding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-50 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <MetaAdsOnboarding
              tenantId={currentTenant?.id || ''}
              onComplete={handleMetaOnboardingComplete}
              onCancel={() => setShowMetaOnboarding(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

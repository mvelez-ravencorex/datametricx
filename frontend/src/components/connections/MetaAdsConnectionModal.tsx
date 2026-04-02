/**
 * Modal para configurar integración con Meta Ads (Facebook Ads)
 * Implementa FRONT 1 y FRONT 2
 */

import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { SyncFrequency, PLATFORM_SYNC_FREQUENCIES, SYNC_FREQUENCY_LABELS } from '@/types/connections'
import { connectMetaAds, connectMetaAdsManual } from '@/services/oauthService'
import { MetaAdsCredentials } from '@/types/connections'

interface MetaAdsConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (config: DatasourceSetup) => Promise<void>
  tenantId: string
  isEditing?: boolean
  existingConfig?: Partial<DatasourceSetup>
}

export interface DatasourceSetup {
  name: string
  secret_id: string

  // Metadata
  adAccountId?: string

  // 🟢 Estado
  connected: boolean
  status: 'ok' | 'error' | 'no-data' | 'pending' | 'never-run'

  // ⚙️ Sync config (nombres según backend)
  frequency: SyncFrequency
  time_utc: string

  // 📊 Backfill (días hacia atrás: 30, 90, 180, 365)
  backfill_days: number
}

type ConnectionMode = 'oauth' | 'manual'

export default function MetaAdsConnectionModal({
  isOpen,
  onClose,
  onSave,
  tenantId,
  isEditing = false,
  existingConfig
}: MetaAdsConnectionModalProps) {
  const [mode, setMode] = useState<ConnectionMode>('oauth')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Paso 1: Conectar (OAuth o Manual) → Obtener secret_id
  const [isConnected, setIsConnected] = useState(false)
  const [secretId, setSecretId] = useState<string>('')
  const [adAccountId, setAdAccountId] = useState<string>('')

  // Paso 2: Configurar
  const [config, setConfig] = useState({
    name: '',
    frequency: 'daily' as SyncFrequency,
    time_utc: '03:00',
    backfill_days: 30  // Por defecto 30 días
  })

  // Modo manual: credenciales temporales
  const [manualCreds, setManualCreds] = useState<MetaAdsCredentials>({
    accessToken: '',
    adAccountId: '',
    appId: '',
    appSecret: ''
  })

  // Cargar configuración existente si está editando
  useEffect(() => {
    if (isOpen && existingConfig) {
      setIsConnected(true)
      setSecretId(existingConfig.secret_id || '')
      setAdAccountId(existingConfig.adAccountId || '')
      setConfig({
        name: existingConfig.name || '',
        frequency: existingConfig.frequency || 'daily',
        time_utc: existingConfig.time_utc || '03:00',
        backfill_days: existingConfig.backfill_days || 30
      })
    } else if (isOpen && !existingConfig) {
      // Resetear estado para nueva conexión
      setIsConnected(false)
      setSecretId('')
      setAdAccountId('')
      setConfig({
        name: '',
        frequency: 'daily',
        time_utc: '03:00',
        backfill_days: 30
      })
      setManualCreds({
        accessToken: '',
        adAccountId: '',
        appId: '',
        appSecret: ''
      })
      setError(null)
    }
  }, [isOpen, existingConfig])

  if (!isOpen) return null

  // ========== FRONT 2: Conectar con OAuth ==========
  const handleOAuthConnect = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await connectMetaAds(tenantId)

      setSecretId(result.secret_id)
      setAdAccountId(result.metadata?.adAccountId || '')
      setIsConnected(true)

      console.log('✅ OAuth exitoso, secret_id:', result.secret_id)
    } catch (err) {
      console.error('❌ Error en OAuth:', err)
      setError(err instanceof Error ? err.message : 'Error al conectar con Meta')
    } finally {
      setLoading(false)
    }
  }

  // ========== FRONT 2: Conectar Manual ==========
  const handleManualConnect = async () => {
    setLoading(true)
    setError(null)

    try {
      // Validaciones
      if (!manualCreds.appId || !manualCreds.appSecret || !manualCreds.accessToken || !manualCreds.adAccountId) {
        throw new Error('Todos los campos son requeridos: App ID, App Secret, Access Token y Ad Account ID')
      }

      if (!manualCreds.adAccountId.startsWith('act_')) {
        throw new Error('El Ad Account ID debe comenzar con "act_"')
      }

      const result = await connectMetaAdsManual(tenantId, manualCreds)

      setSecretId(result.secret_id)
      setAdAccountId(result.metadata?.adAccountId || manualCreds.adAccountId)
      setIsConnected(true)

      console.log('✅ Credenciales guardadas, secret_id:', result.secret_id)
    } catch (err) {
      console.error('❌ Error al guardar credenciales:', err)
      setError(err instanceof Error ? err.message : 'Error al guardar credenciales')
    } finally {
      setLoading(false)
    }
  }

  // ========== FRONT 1: Guardar Configuración ==========
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    console.log('🔵 Meta Ads Modal - Valores del form:', {
      name: config.name,
      frequency: config.frequency,
      time_utc: config.time_utc,
      backfill_days: config.backfill_days,
      backfill_days_type: typeof config.backfill_days
    })

    try {
      // Validar configuración
      if (!config.name) {
        throw new Error('El nombre de la integración es requerido')
      }

      // Preparar configuración completa
      const datasourceSetup: DatasourceSetup = {
        name: config.name,
        secret_id: secretId,
        adAccountId,
        connected: true,
        status: 'never-run',
        frequency: config.frequency,
        time_utc: config.time_utc,
        backfill_days: config.backfill_days
      }

      console.log('📤 Meta Ads Modal - Enviando setup:', {
        backfill_days: datasourceSetup.backfill_days,
        backfill_days_type: typeof datasourceSetup.backfill_days
      })

      await onSave(datasourceSetup)
      onClose()
    } catch (err) {
      console.error('❌ Error al guardar configuración:', err)
      setError(err instanceof Error ? err.message : 'Error al guardar configuración')
    } finally {
      setLoading(false)
    }
  }

  const availableFrequencies = PLATFORM_SYNC_FREQUENCIES['meta_ads']

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-lg shadow-2xl max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="text-3xl">📘</div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {isEditing ? 'Editar' : 'Conectar'} Meta Ads
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Facebook & Instagram Advertising
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 180px)' }}>
            {/* Error */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* PASO 1: Conectar (solo si no está editando) */}
            {!isEditing && !isConnected && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">
                    Paso 1: Conectar con Meta
                  </h3>
                  <p className="text-sm text-blue-800">
                    Elige cómo deseas conectar tu cuenta de Meta Ads
                  </p>
                </div>

                {/* Selector de modo */}
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('oauth')
                      setError(null)
                    }}
                    className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                      mode === 'oauth'
                        ? 'border-blue-600 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`text-lg font-semibold mb-1 ${mode === 'oauth' ? 'text-blue-700' : 'text-gray-700'}`}>
                      OAuth (Recomendado)
                    </div>
                    <div className="text-sm text-gray-600">Conexión segura automática</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('manual')
                      setError(null)
                    }}
                    className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                      mode === 'manual'
                        ? 'border-blue-600 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`text-lg font-semibold mb-1 ${mode === 'manual' ? 'text-blue-700' : 'text-gray-700'}`}>
                      Manual
                    </div>
                    <div className="text-sm text-gray-600">Ingresa credenciales</div>
                  </button>
                </div>

                {/* Modo OAuth */}
                {mode === 'oauth' && (
                  <div className="space-y-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
                        <li>Haz clic en "Conectar con Meta"</li>
                        <li>Inicia sesión en tu cuenta de Facebook</li>
                        <li>Autoriza el acceso a tus cuentas publicitarias</li>
                        <li>Selecciona la cuenta que deseas conectar</li>
                      </ol>
                    </div>
                    <button
                      type="button"
                      onClick={handleOAuthConnect}
                      disabled={loading}
                      className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {loading ? 'Conectando...' : '🔐 Conectar con Meta'}
                    </button>
                  </div>
                )}

                {/* Modo Manual */}
                {mode === 'manual' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-yellow-700 font-medium mb-2">
                            Cómo obtener tus credenciales:
                          </p>
                          <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
                            <li>Ve a <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="underline font-medium">Facebook Developers</a> y crea o selecciona tu app</li>
                            <li>Obtén el <strong>App ID</strong> y <strong>App Secret</strong> desde la configuración básica</li>
                            <li>En <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Meta Business Suite</a>, crea un <strong>token de acceso</strong></li>
                            <li>Otorga permisos: <code className="bg-yellow-100 px-1 rounded">ads_read</code>, <code className="bg-yellow-100 px-1 rounded">ads_management</code></li>
                            <li>Copia el <strong>Access Token</strong> y el <strong>Ad Account ID</strong> (empieza con "act_")</li>
                          </ol>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border-2 border-blue-200 rounded-lg p-4 space-y-4">
                      <div className="text-sm font-medium text-blue-900 mb-3">
                        📝 Ingresa tus credenciales de Meta Ads:
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          App ID <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={manualCreds.appId}
                          onChange={(e) => setManualCreds({ ...manualCreds, appId: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          placeholder="123456789012345"
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          ID de tu aplicación de Meta (App ID)
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          App Secret <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          value={manualCreds.appSecret}
                          onChange={(e) => setManualCreds({ ...manualCreds, appSecret: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          placeholder="a1b2c3d4e5f6g7h8i9j0..."
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Secret de tu aplicación de Meta (se guardará de forma segura)
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Access Token <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          value={manualCreds.accessToken}
                          onChange={(e) => setManualCreds({ ...manualCreds, accessToken: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          placeholder="EAABsbCS1iHgBAO..."
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Tu token de acceso de Meta (se guardará de forma segura)
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Ad Account ID <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={manualCreds.adAccountId}
                          onChange={(e) => setManualCreds({ ...manualCreds, adAccountId: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          placeholder="act_123456789"
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Debe comenzar con "act_" (ejemplo: act_123456789)
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleManualConnect}
                      disabled={loading || !manualCreds.appId || !manualCreds.appSecret || !manualCreds.accessToken || !manualCreds.adAccountId}
                      className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                          Guardando credenciales...
                        </span>
                      ) : (
                        '💾 Guardar Credenciales'
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* PASO 2: Configurar (después de conectar o si está editando) */}
            {(isConnected || isEditing) && (
              <div className="space-y-6">
                {isConnected && !isEditing && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800 font-medium">
                      ✅ Conexión exitosa con Meta Ads
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Ad Account: {adAccountId}
                    </p>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">
                    {isEditing ? 'Configuración' : 'Paso 2: Configurar Sincronización'}
                  </h3>
                  <p className="text-sm text-blue-800">
                    Define cómo y cuándo se sincronizarán los datos
                  </p>
                </div>

                {/* Nombre */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la integración <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ej: Meta Ads - Cuenta Principal"
                    required
                  />
                </div>

                {/* Sincronización */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frecuencia <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={config.frequency}
                      onChange={(e) => setConfig({ ...config, frequency: e.target.value as SyncFrequency })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {availableFrequencies.map((freq) => (
                        <option key={freq} value={freq}>
                          {SYNC_FREQUENCY_LABELS[freq]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hora (UTC) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={config.time_utc}
                      onChange={(e) => setConfig({ ...config, time_utc: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* Backfill */}
                <div className="pt-4 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Importar datos históricos (Backfill)
                  </label>
                  <select
                    value={config.backfill_days}
                    onChange={(e) => setConfig({ ...config, backfill_days: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={30}>Últimos 30 días</option>
                    <option value={90}>Últimos 90 días</option>
                    <option value={180}>Últimos 180 días (6 meses)</option>
                    <option value={365}>Últimos 365 días (1 año)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Se importarán datos desde los últimos {config.backfill_days} días
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
            <a
              href="https://developers.facebook.com/docs/marketing-api/get-started"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Ver documentación →
            </a>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              {(isConnected || isEditing) && (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Guardar y Conectar'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

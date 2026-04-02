/**
 * Paso 1 del onboarding de Meta Ads: Conexión OAuth
 * Permite conectar con Meta via OAuth o manualmente
 */

import { useState } from 'react'
import { ExclamationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { connectMetaAds, connectMetaAdsManual } from '@/services/oauthService'
import { MetaAdsCredentials } from '@/types/connections'

interface MetaOAuthStepProps {
  tenantId: string
  onSuccess: (data: { secretId: string; adAccountId: string }) => void
  onError?: (error: string) => void
}

type ConnectionMode = 'oauth' | 'manual'

export default function MetaOAuthStep({
  tenantId,
  onSuccess,
  onError
}: MetaOAuthStepProps) {
  const [mode, setMode] = useState<ConnectionMode>('oauth')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Credenciales para modo manual
  const [manualCreds, setManualCreds] = useState<MetaAdsCredentials>({
    accessToken: '',
    adAccountId: '',
    appId: '',
    appSecret: ''
  })

  // Conectar con OAuth
  const handleOAuthConnect = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await connectMetaAds(tenantId)

      onSuccess({
        secretId: result.secret_id,
        adAccountId: result.metadata?.adAccountId || ''
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al conectar con Meta'
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Conectar manualmente
  const handleManualConnect = async () => {
    setLoading(true)
    setError(null)

    try {
      // Validaciones
      if (!manualCreds.appId || !manualCreds.appSecret || !manualCreds.accessToken || !manualCreds.adAccountId) {
        throw new Error('Todos los campos son requeridos')
      }

      if (!manualCreds.adAccountId.startsWith('act_')) {
        throw new Error('El Ad Account ID debe comenzar con "act_"')
      }

      const result = await connectMetaAdsManual(tenantId, manualCreds)

      onSuccess({
        secretId: result.secret_id,
        adAccountId: result.metadata?.adAccountId || manualCreds.adAccountId
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al conectar con Meta'
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <span className="text-3xl">📘</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Conectar Meta Ads
        </h2>
        <p className="text-sm text-gray-600">
          Conecta tu cuenta de Facebook Ads para importar tus datos de campañas
        </p>
      </div>

      {/* Toggle de modo */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
        <button
          type="button"
          onClick={() => setMode('oauth')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            mode === 'oauth'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Conectar con Facebook
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            mode === 'manual'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Conexión manual
        </button>
      </div>

      {/* Contenido según modo */}
      {mode === 'oauth' ? (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <CheckCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Conexión segura</p>
                <p>Serás redirigido a Facebook para autorizar el acceso. No almacenamos tu contraseña.</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOAuthConnect}
            disabled={loading}
            className="w-full py-3 px-4 bg-[#1877F2] text-white font-medium rounded-lg hover:bg-[#166FE5] focus:outline-none focus:ring-2 focus:ring-[#1877F2] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Conectando...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Continuar con Facebook
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-3">
              <ExclamationCircleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Conexión avanzada</p>
                <p>Necesitarás crear una app en Meta for Developers y obtener los tokens manualmente.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                App ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={manualCreds.appId}
                onChange={(e) => setManualCreds({ ...manualCreds, appId: e.target.value })}
                placeholder="123456789012345"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                App Secret <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={manualCreds.appSecret}
                onChange={(e) => setManualCreds({ ...manualCreds, appSecret: e.target.value })}
                placeholder="••••••••••••••••••••••••••••••••"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Token <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={manualCreds.accessToken}
                onChange={(e) => setManualCreds({ ...manualCreds, accessToken: e.target.value })}
                placeholder="EAAxxxxxxx..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Usa un Long-Lived Token para mejor estabilidad
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ad Account ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={manualCreds.adAccountId}
                onChange={(e) => setManualCreds({ ...manualCreds, adAccountId: e.target.value })}
                placeholder="act_123456789"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Debe comenzar con "act_"
              </p>
            </div>

            <button
              type="button"
              onClick={handleManualConnect}
              disabled={loading || !manualCreds.appId || !manualCreds.appSecret || !manualCreds.accessToken || !manualCreds.adAccountId}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Conectando...' : 'Conectar'}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex gap-3">
            <ExclamationCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}

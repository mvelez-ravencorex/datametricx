/**
 * Modal para configurar conexión con Google Analytics 4
 */

import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface GA4ConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (credentials: GA4Credentials) => Promise<void>
}

export interface GA4Credentials {
  propertyId: string
  clientId?: string
  clientSecret?: string
  refreshToken?: string
}

export default function GA4ConnectionModal({
  isOpen,
  onClose,
  onSave
}: GA4ConnectionModalProps) {
  const [credentials, setCredentials] = useState<GA4Credentials>({
    propertyId: '',
    clientId: '',
    clientSecret: '',
    refreshToken: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Validaciones básicas
      if (!credentials.propertyId) {
        throw new Error('Por favor ingresa el Property ID')
      }

      // TODO: Validar credenciales con Google Analytics API
      // await validateGA4Credentials(credentials)

      // Esperar a que se guarde la conexión
      await onSave(credentials)

      // Si llegamos aquí, se guardó exitosamente
      onClose()

      // Limpiar el formulario
      setCredentials({
        propertyId: '',
        clientId: '',
        clientSecret: '',
        refreshToken: ''
      })
    } catch (err) {
      console.error('Error en modal GA4:', err)
      setError(err instanceof Error ? err.message : 'Error al conectar con Google Analytics 4')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthConnect = () => {
    // TODO: Implementar flujo OAuth de Google
    console.log('Iniciar OAuth con Google')
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-lg shadow-2xl max-h-[90vh] overflow-hidden">
        <form onSubmit={handleSubmit} className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-yellow-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="text-3xl">📊</div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Conectar Google Analytics 4
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Analítica web y comportamiento de usuarios
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
          <div className="flex-1 overflow-y-auto p-6">
            {/* OAuth Button */}
            <div className="mb-6">
              <button
                type="button"
                onClick={handleOAuthConnect}
                className="w-full flex items-center justify-center space-x-3 px-4 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-sm font-medium text-gray-700">
                  Conectar con Google (Recomendado)
                </span>
              </button>
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">O ingresa manualmente</span>
              </div>
            </div>

            {/* Instrucciones */}
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-yellow-900 mb-2">
                Para encontrar tu Property ID:
              </h3>
              <ol className="text-sm text-yellow-800 space-y-1 list-decimal list-inside">
                <li>Ve a Google Analytics 4</li>
                <li>Haz clic en "Admin" (esquina inferior izquierda)</li>
                <li>En la columna "Propiedad", busca "Property ID"</li>
                <li>Copia el número (ej: 123456789)</li>
              </ol>
            </div>

            {/* Formulario */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={credentials.propertyId}
                  onChange={(e) => setCredentials({ ...credentials, propertyId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="123456789"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  ID de la propiedad de Google Analytics 4
                </p>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-600 mb-3">
                  <strong>Opcional:</strong> Para acceso avanzado via API
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Client ID
                    </label>
                    <input
                      type="text"
                      value={credentials.clientId}
                      onChange={(e) => setCredentials({ ...credentials, clientId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      placeholder="123456789-abc.apps.googleusercontent.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Client Secret
                    </label>
                    <input
                      type="password"
                      value={credentials.clientSecret}
                      onChange={(e) => setCredentials({ ...credentials, clientSecret: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      placeholder="••••••••••••••••"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Refresh Token
                    </label>
                    <input
                      type="password"
                      value={credentials.refreshToken}
                      onChange={(e) => setCredentials({ ...credentials, refreshToken: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      placeholder="••••••••••••••••"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
            <a
              href="https://developers.google.com/analytics/devguides/reporting/data/v1"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-yellow-600 hover:text-yellow-700"
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
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Conectando...' : 'Conectar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

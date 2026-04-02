/**
 * Orquestador del onboarding de Meta Ads
 * Maneja el flujo completo: OAuth -> Configuración -> Confirmación
 */

import { useState } from 'react'
import { CheckIcon } from '@heroicons/react/24/solid'
import MetaOAuthStep from './MetaOAuthStep'
import MetaConfigStep from './MetaConfigStep'
import { MetaDatasourceConfig } from '@/types/connections'

type OnboardingStep = 'oauth' | 'config' | 'success'

interface MetaAdsOnboardingProps {
  tenantId: string
  onComplete: (config: MetaDatasourceConfig) => Promise<void>
  onCancel?: () => void
}

interface OAuthData {
  secretId: string
  adAccountId: string
}

export default function MetaAdsOnboarding({
  tenantId,
  onComplete,
  onCancel
}: MetaAdsOnboardingProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('oauth')
  const [oauthData, setOAuthData] = useState<OAuthData | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pasos del wizard
  const steps = [
    { id: 'oauth', name: 'Conexión', description: 'Conecta tu cuenta de Meta' },
    { id: 'config', name: 'Configuración', description: 'Define fechas y frecuencia' },
    { id: 'success', name: 'Listo', description: 'Sincronización iniciada' }
  ]

  const currentStepIndex = steps.findIndex(s => s.id === currentStep)

  // Manejar éxito de OAuth
  const handleOAuthSuccess = (data: OAuthData) => {
    setOAuthData(data)
    setCurrentStep('config')
    setError(null)
  }

  // Manejar error de OAuth
  const handleOAuthError = (errorMessage: string) => {
    setError(errorMessage)
  }

  // Manejar configuración completa
  const handleConfigComplete = async (config: { startDate: string; frequency: 'daily' | 'weekly' | 'monthly' }) => {
    if (!oauthData) {
      setError('Error: No se encontraron datos de autenticación')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Construir configuración completa
      const fullConfig: MetaDatasourceConfig = {
        start_date: config.startDate,
        frequency: config.frequency,
        connected: true,
        ad_account_id: oauthData.adAccountId,
        access_token_secret_id: oauthData.secretId,
        status: 'pending_initial_sync',
        initial_backfill_done: false,
        last_extraction: null,
        last_extraction_records: null,
        last_error: null
      }

      // Llamar callback para guardar
      await onComplete(fullConfig)

      // Ir al paso de éxito
      setCurrentStep('success')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar la configuración'
      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  // Volver al paso anterior
  const handleBack = () => {
    if (currentStep === 'config') {
      setCurrentStep('oauth')
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress Steps */}
      <nav aria-label="Progress" className="mb-8">
        <ol className="flex items-center">
          {steps.map((step, stepIdx) => {
            const isCompleted = stepIdx < currentStepIndex
            const isCurrent = step.id === currentStep

            return (
              <li
                key={step.id}
                className={`relative ${stepIdx !== steps.length - 1 ? 'flex-1 pr-8' : ''}`}
              >
                {stepIdx !== steps.length - 1 && (
                  <div
                    className={`absolute top-4 left-7 -right-1 h-0.5 ${
                      isCompleted ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
                <div className="relative flex items-center">
                  <span
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium ${
                      isCompleted
                        ? 'bg-blue-600 text-white'
                        : isCurrent
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckIcon className="w-5 h-5" />
                    ) : (
                      stepIdx + 1
                    )}
                  </span>
                  <span className="ml-3 min-w-0">
                    <span
                      className={`text-sm font-medium ${
                        isCurrent ? 'text-blue-600' : isCompleted ? 'text-gray-900' : 'text-gray-500'
                      }`}
                    >
                      {step.name}
                    </span>
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Contenido del paso actual */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {currentStep === 'oauth' && (
          <MetaOAuthStep
            tenantId={tenantId}
            onSuccess={handleOAuthSuccess}
            onError={handleOAuthError}
          />
        )}

        {currentStep === 'config' && (
          <MetaConfigStep
            onComplete={handleConfigComplete}
            onBack={handleBack}
            loading={saving}
          />
        )}

        {currentStep === 'success' && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckIcon className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              ¡Conexión exitosa!
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Tu cuenta de Meta Ads está conectada. La sincronización inicial comenzará en breve.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left mb-6">
              <h3 className="text-sm font-medium text-blue-900 mb-2">¿Qué sigue?</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Importaremos todos tus datos históricos (puede tomar varios minutos)</li>
                <li>• Recibirás una notificación cuando la primera sincronización termine</li>
                <li>• Los datos se actualizarán automáticamente según la frecuencia seleccionada</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={onCancel}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Entendido
            </button>
          </div>
        )}
      </div>

      {/* Error global */}
      {error && currentStep !== 'oauth' && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Botón cancelar */}
      {onCancel && currentStep !== 'success' && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

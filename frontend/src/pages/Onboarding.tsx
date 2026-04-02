/**
 * Página de Onboarding - Crear Organización
 * Se muestra cuando un usuario nuevo no tiene ningún tenant
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { createTenant } from '@/services/tenantService'
import { PlanType } from '@/types/tenant'

export default function Onboarding() {
  const { currentUser, reloadUserData, needsOnboarding } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    companyName: '',
    plan: 'trial' as PlanType,
    timezone: 'America/Argentina/Buenos_Aires',
    businessType: ''
  })

  // Redirigir automáticamente cuando ya no necesite onboarding
  useEffect(() => {
    if (!needsOnboarding && currentUser) {
      console.log('✅ Onboarding completado, redirigiendo al dashboard...')
      navigate('/dashboard', { replace: true })
    }
  }, [needsOnboarding, currentUser, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUser || !currentUser.email) {
      setError('Usuario no autenticado')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Validar nombre
      if (formData.companyName.trim().length < 2) {
        throw new Error('El nombre de la organización debe tener al menos 2 caracteres')
      }

      // Crear tenant
      const tenantId = await createTenant(
        formData.companyName,
        currentUser.uid,
        currentUser.email,
        formData.plan
      )

      console.log('✅ Organización creada:', tenantId)

      // Recargar datos del usuario para actualizar tenants y needsOnboarding
      // El useEffect se encargará de redirigir cuando needsOnboarding cambie a false
      await reloadUserData()
    } catch (err) {
      console.error('❌ Error al crear organización:', err)
      setError(err instanceof Error ? err.message : 'Error al crear la organización')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Bienvenido a DataMetricX
          </h1>
          <p className="text-lg text-gray-600">
            Crea tu organización para comenzar a centralizar tus datos
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nombre de la organización */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de tu organización <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="ej: Shoppineando, Mi Empresa, etc."
                required
                autoFocus
              />
              <p className="mt-1 text-xs text-gray-500">
                Este nombre identificará tu cuenta en DataMetricX
              </p>
            </div>

            {/* Tipo de negocio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de negocio (opcional)
              </label>
              <select
                value={formData.businessType}
                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleccionar...</option>
                <option value="ecommerce">E-commerce</option>
                <option value="saas">SaaS</option>
                <option value="agency">Agencia de Marketing</option>
                <option value="retail">Retail</option>
                <option value="services">Servicios</option>
                <option value="other">Otro</option>
              </select>
            </div>

            {/* Zona horaria */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zona horaria
              </label>
              <select
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="America/Argentina/Buenos_Aires">Argentina (GMT-3)</option>
                <option value="America/Mexico_City">México (GMT-6)</option>
                <option value="America/Bogota">Colombia (GMT-5)</option>
                <option value="America/Santiago">Chile (GMT-3)</option>
                <option value="America/Lima">Perú (GMT-5)</option>
                <option value="America/Caracas">Venezuela (GMT-4)</option>
                <option value="America/Sao_Paulo">Brasil (GMT-3)</option>
                <option value="Europe/Madrid">España (GMT+1)</option>
                <option value="America/New_York">Estados Unidos - Este (GMT-5)</option>
                <option value="America/Los_Angeles">Estados Unidos - Oeste (GMT-8)</option>
              </select>
            </div>

            {/* Plan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Plan inicial
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Trial */}
                <div
                  onClick={() => setFormData({ ...formData, plan: 'trial' })}
                  className={`relative cursor-pointer rounded-lg border-2 p-4 ${
                    formData.plan === 'trial'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">Trial</h3>
                    {formData.plan === 'trial' && (
                      <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                          <path d="M10 3L4.5 8.5 2 6" stroke="currentColor" strokeWidth="2" fill="none" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Gratis por 14 días</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Hasta 3 usuarios</li>
                    <li>• 5 dashboards</li>
                    <li>• Sincronización diaria</li>
                  </ul>
                </div>

                {/* Pro */}
                <div
                  onClick={() => setFormData({ ...formData, plan: 'pro' })}
                  className={`relative cursor-pointer rounded-lg border-2 p-4 ${
                    formData.plan === 'pro'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">Pro</h3>
                    {formData.plan === 'pro' && (
                      <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                          <path d="M10 3L4.5 8.5 2 6" stroke="currentColor" strokeWidth="2" fill="none" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">$99/mes</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Hasta 15 usuarios</li>
                    <li>• 50 dashboards</li>
                    <li>• Sincronización por hora</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !formData.companyName.trim()}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creando organización...' : 'Crear organización'}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              Al crear tu organización, aceptas nuestros{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700">
                términos de servicio
              </a>{' '}
              y{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700">
                política de privacidad
              </a>
            </p>
          </div>
        </div>

        {/* Help */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            ¿Necesitas ayuda?{' '}
            <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
              Contacta a soporte
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

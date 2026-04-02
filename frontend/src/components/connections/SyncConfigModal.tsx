/**
 * Modal para configurar sincronización de una integración
 */

import { useState, useEffect } from 'react'
import { XMarkIcon, ClockIcon } from '@heroicons/react/24/outline'
import { SyncFrequency, SYNC_FREQUENCY_LABELS } from '@/types/connections'

interface SyncConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (frequency: SyncFrequency, time: string) => Promise<void>
  platformName: string
  availableFrequencies: SyncFrequency[]
  initialFrequency?: SyncFrequency
  initialTime?: string
}

export default function SyncConfigModal({
  isOpen,
  onClose,
  onSave,
  platformName,
  availableFrequencies,
  initialFrequency,
  initialTime
}: SyncConfigModalProps) {
  const [frequency, setFrequency] = useState<SyncFrequency>(initialFrequency || availableFrequencies[0])
  const [time, setTime] = useState(initialTime || '03:00')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setFrequency(initialFrequency || availableFrequencies[0])
      setTime(initialTime || '03:00')
      setError(null)
    }
  }, [isOpen, initialFrequency, initialTime, availableFrequencies])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await onSave(frequency, time)
      onClose()
    } catch (err) {
      console.error('Error al guardar configuración:', err)
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-lg shadow-2xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <ClockIcon className="h-6 w-6 text-blue-600" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Configurar Actualización
                  </h2>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {platformName}
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
          <div className="p-6 space-y-4">
            {/* Frecuencia */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frecuencia de actualización
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as SyncFrequency)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {availableFrequencies.map((freq) => (
                  <option key={freq} value={freq}>
                    {SYNC_FREQUENCY_LABELS[freq]}
                  </option>
                ))}
              </select>
            </div>

            {/* Hora de ejecución */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hora de ejecución (UTC)
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Hora en formato UTC (Tiempo Universal Coordinado)
              </p>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Resumen:</strong> Los datos se actualizarán {SYNC_FREQUENCY_LABELS[frequency].toLowerCase()} a las {time}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

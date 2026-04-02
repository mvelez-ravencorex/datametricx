/**
 * Card de estado de conexión Meta Ads
 * Muestra el estado actual, última sincronización y acciones disponibles
 */

import { useState } from 'react'
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  PauseCircleIcon,
  Cog6ToothIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import {
  MetaDatasourceConfig,
  META_STATUS_LABELS,
  SYNC_FREQUENCY_LABELS
} from '@/types/connections'

interface MetaStatusCardProps {
  config: MetaDatasourceConfig
  accountName?: string
  onSyncNow?: () => Promise<void>
  onEditConfig?: () => void
  onDisconnect?: () => void
  onPause?: () => void
  onResume?: () => void
}

export default function MetaStatusCard({
  config,
  accountName,
  onSyncNow,
  onEditConfig,
  onDisconnect,
  onPause,
  onResume
}: MetaStatusCardProps) {
  const [syncing, setSyncing] = useState(false)

  const statusInfo = META_STATUS_LABELS[config.status]

  // Formatear fecha para mostrar
  const formatDate = (date: Date | string | null) => {
    if (!date) return '-'
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return '-'
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Manejar sincronización
  const handleSyncNow = async () => {
    if (!onSyncNow) return
    setSyncing(true)
    try {
      await onSyncNow()
    } finally {
      setSyncing(false)
    }
  }

  // Icono de estado
  const StatusIcon = () => {
    switch (config.status) {
      case 'active':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />
      case 'error':
        return <ExclamationCircleIcon className="h-6 w-6 text-red-500" />
      case 'pending_initial_sync':
      case 'syncing':
        return <ArrowPathIcon className="h-6 w-6 text-blue-500 animate-spin" />
      case 'paused':
        return <PauseCircleIcon className="h-6 w-6 text-yellow-500" />
      default:
        return <ClockIcon className="h-6 w-6 text-gray-400" />
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header con estado */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <span className="text-xl">📘</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Meta Ads</h3>
            {accountName && (
              <p className="text-sm text-gray-500">{accountName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusIcon />
          <span className={`text-sm font-medium ${
            statusInfo.color === 'green' ? 'text-green-700' :
            statusInfo.color === 'red' ? 'text-red-700' :
            statusInfo.color === 'blue' ? 'text-blue-700' :
            statusInfo.color === 'yellow' ? 'text-yellow-700' :
            'text-gray-700'
          }`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Info de configuración */}
      <div className="px-6 py-4 space-y-4">
        {/* Cuenta */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Ad Account ID</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{config.ad_account_id}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Frecuencia</p>
            <p className="text-sm font-medium text-gray-900 mt-1">
              {config.frequency ? (SYNC_FREQUENCY_LABELS[config.frequency] || config.frequency) : '-'}
            </p>
          </div>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Datos desde</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{formatDate(config.start_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Última sincronización</p>
            <p className="text-sm font-medium text-gray-900 mt-1">
              {formatDateTime(config.last_extraction)}
            </p>
          </div>
        </div>

        {/* Estadísticas de última sincronización */}
        {config.last_extraction_records !== null && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Registros actualizados</span>
              <span className="text-sm font-semibold text-gray-900">
                {config.last_extraction_records.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Próxima sincronización */}
        {config.next_scheduled_run && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <ClockIcon className="h-4 w-4" />
            <span>Próxima sincronización: {formatDateTime(config.next_scheduled_run)}</span>
          </div>
        )}

        {/* Error */}
        {config.status === 'error' && config.last_error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex gap-2">
              <ExclamationCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Error en última sincronización</p>
                <p className="text-sm text-red-700 mt-1">{config.last_error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Backfill en progreso */}
        {config.status === 'pending_initial_sync' && !config.initial_backfill_done && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex gap-2">
              <ArrowPathIcon className="h-5 w-5 text-blue-600 flex-shrink-0 animate-spin" />
              <div>
                <p className="text-sm font-medium text-blue-800">Sincronizando datos históricos</p>
                <p className="text-sm text-blue-700 mt-1">
                  Este proceso puede tomar varios minutos dependiendo del rango de fechas seleccionado.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
        {/* Sincronizar ahora */}
        {onSyncNow && config.status !== 'syncing' && config.status !== 'pending_initial_sync' && (
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
        )}

        {/* Pausar/Reanudar */}
        {config.status === 'active' && onPause && (
          <button
            onClick={onPause}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors"
          >
            <PauseCircleIcon className="h-4 w-4" />
            Pausar
          </button>
        )}

        {config.status === 'paused' && onResume && (
          <button
            onClick={onResume}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Reanudar
          </button>
        )}

        {/* Editar configuración */}
        {onEditConfig && (
          <button
            onClick={onEditConfig}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            <Cog6ToothIcon className="h-4 w-4" />
            Configuración
          </button>
        )}

        {/* Desconectar */}
        {onDisconnect && (
          <button
            onClick={onDisconnect}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors ml-auto"
          >
            <TrashIcon className="h-4 w-4" />
            Desconectar
          </button>
        )}
      </div>
    </div>
  )
}

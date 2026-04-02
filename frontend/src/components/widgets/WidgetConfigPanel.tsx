/**
 * Panel de configuración de widgets
 * Permite editar las propiedades de cada widget
 */

import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { WidgetConfig, ChartColorScheme, COLOR_SCHEMES, XAxisFormatConfig } from '@/types/widgets'
import {
  X_AXIS_FORMAT_OPTIONS,
  DATE_FORMAT_OPTIONS,
  TIME_FORMAT_OPTIONS,
  getDefaultXAxisFormat
} from '@/utils/chartFormatters'

interface WidgetConfigPanelProps {
  widget: WidgetConfig | null
  isOpen: boolean
  onClose: () => void
  onSave: (config: WidgetConfig) => void
}

export default function WidgetConfigPanel({
  widget,
  isOpen,
  onClose,
  onSave
}: WidgetConfigPanelProps) {
  const [config, setConfig] = useState<WidgetConfig | null>(widget)

  useEffect(() => {
    setConfig(widget)
  }, [widget])

  if (!isOpen || !config) return null

  const handleSave = () => {
    if (config) {
      onSave(config)
      onClose()
    }
  }

  const updateSettings = (key: string, value: unknown) => {
    setConfig((prev) => {
      if (!prev) return null
      return {
        ...prev,
        settings: {
          ...prev.settings,
          [key]: value
        }
      } as WidgetConfig
    })
  }

  const renderGeneralSettings = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Título del Widget
        </label>
        <input
          type="text"
          value={config.title}
          onChange={(e) => setConfig({ ...config, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripción (opcional)
        </label>
        <textarea
          value={config.description || ''}
          onChange={(e) => setConfig({ ...config, description: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue"
        />
      </div>
    </div>
  )

  const renderKPISettings = () => {
    if (config.type !== 'kpi') return null

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Formato
          </label>
          <select
            value={config.settings.format}
            onChange={(e) => updateSettings('format', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue"
          >
            <option value="number">Número</option>
            <option value="currency">Moneda</option>
            <option value="percentage">Porcentaje</option>
            <option value="multiplier">Multiplicador</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Decimales
          </label>
          <input
            type="number"
            value={config.settings.decimals || 0}
            onChange={(e) => updateSettings('decimals', parseInt(e.target.value))}
            min="0"
            max="4"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="showTrend"
            checked={config.settings.showTrend}
            onChange={(e) => updateSettings('showTrend', e.target.checked)}
            className="h-4 w-4 text-primary-blue focus:ring-primary-blue border-gray-300 rounded"
          />
          <label htmlFor="showTrend" className="text-sm font-medium text-gray-700">
            Mostrar tendencia
          </label>
        </div>

        {config.settings.showTrend && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de tendencia
            </label>
            <select
              value={config.settings.trendType}
              onChange={(e) => updateSettings('trendType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue"
            >
              <option value="up-good">↑ Hacia arriba es bueno</option>
              <option value="down-good">↓ Hacia abajo es bueno</option>
            </select>
          </div>
        )}
      </div>
    )
  }

  const renderChartSettings = () => {
    if (!['line-chart', 'bar-chart', 'area-chart'].includes(config.type)) return null

    const settings = config.settings as { height?: number; showGrid?: boolean; showLegend?: boolean; showTooltip?: boolean }

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Altura del gráfico (px)
          </label>
          <input
            type="number"
            value={settings.height || 300}
            onChange={(e) => updateSettings('height', parseInt(e.target.value))}
            min="200"
            max="800"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="showGrid"
            checked={settings.showGrid}
            onChange={(e) => updateSettings('showGrid', e.target.checked)}
            className="h-4 w-4 text-primary-blue focus:ring-primary-blue border-gray-300 rounded"
          />
          <label htmlFor="showGrid" className="text-sm font-medium text-gray-700">
            Mostrar cuadrícula
          </label>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="showLegend"
            checked={settings.showLegend}
            onChange={(e) => updateSettings('showLegend', e.target.checked)}
            className="h-4 w-4 text-primary-blue focus:ring-primary-blue border-gray-300 rounded"
          />
          <label htmlFor="showLegend" className="text-sm font-medium text-gray-700">
            Mostrar leyenda
          </label>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="showTooltip"
            checked={settings.showTooltip}
            onChange={(e) => updateSettings('showTooltip', e.target.checked)}
            className="h-4 w-4 text-primary-blue focus:ring-primary-blue border-gray-300 rounded"
          />
          <label htmlFor="showTooltip" className="text-sm font-medium text-gray-700">
            Mostrar tooltip
          </label>
        </div>
      </div>
    )
  }

  const renderColorSchemeSelector = () => {
    const settings = config.settings as { colorScheme?: ChartColorScheme }
    if (!('colorScheme' in config.settings)) return null

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Esquema de colores
        </label>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(COLOR_SCHEMES).map(([scheme, colors]) => (
            <button
              key={scheme}
              onClick={() => updateSettings('colorScheme', scheme)}
              className={`p-2 border-2 rounded-lg transition-all ${
                settings.colorScheme === scheme
                  ? 'border-primary-blue'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex space-x-1 h-8">
                {colors.slice(0, 4).map((color, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="text-xs text-gray-600 mt-1 capitalize">{scheme}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const renderXAxisFormatSettings = () => {
    if (!['line-chart', 'bar-chart', 'area-chart'].includes(config.type)) return null

    const settings = config.settings as { xAxisFormat?: XAxisFormatConfig }
    const xAxisFormat = settings.xAxisFormat || { type: 'auto' as const }

    const updateXAxisFormat = (updates: Partial<XAxisFormatConfig>) => {
      const newFormat = { ...xAxisFormat, ...updates }
      updateSettings('xAxisFormat', newFormat)
    }

    const handleTypeChange = (newType: XAxisFormatConfig['type']) => {
      const newFormat = getDefaultXAxisFormat(newType)
      updateSettings('xAxisFormat', newFormat)
    }

    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700">Formato del Eje X</h4>

        {/* Tipo de formato */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Tipo de formato
          </label>
          <select
            value={xAxisFormat.type}
            onChange={(e) => handleTypeChange(e.target.value as XAxisFormatConfig['type'])}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-sm"
          >
            {X_AXIS_FORMAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Opciones para Fecha */}
        {(xAxisFormat.type === 'date' || xAxisFormat.type === 'datetime') && (
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Formato de fecha
            </label>
            <select
              value={xAxisFormat.datePattern || 'dd/MM/yyyy'}
              onChange={(e) => updateXAxisFormat({ datePattern: e.target.value as XAxisFormatConfig['datePattern'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-sm"
            >
              {DATE_FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} {option.example && `(${option.example})`}
                </option>
              ))}
            </select>
            {xAxisFormat.datePattern === 'custom' && (
              <input
                type="text"
                placeholder="yyyy-MM-dd HH:mm"
                value={xAxisFormat.customDatePattern || ''}
                onChange={(e) => updateXAxisFormat({ customDatePattern: e.target.value })}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-sm"
              />
            )}
          </div>
        )}

        {/* Opciones para Hora */}
        {(xAxisFormat.type === 'time' || xAxisFormat.type === 'datetime') && (
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Formato de hora
            </label>
            <select
              value={xAxisFormat.timePattern || 'HH:mm'}
              onChange={(e) => updateXAxisFormat({ timePattern: e.target.value as XAxisFormatConfig['timePattern'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-sm"
            >
              {TIME_FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} {option.example && `(${option.example})`}
                </option>
              ))}
            </select>
            {xAxisFormat.timePattern === 'custom' && (
              <input
                type="text"
                placeholder="HH:mm:ss"
                value={xAxisFormat.customTimePattern || ''}
                onChange={(e) => updateXAxisFormat({ customTimePattern: e.target.value })}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-sm"
              />
            )}
          </div>
        )}

        {/* Opciones para Número */}
        {(xAxisFormat.type === 'number' || xAxisFormat.type === 'currency' || xAxisFormat.type === 'percentage') && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Decimales
              </label>
              <input
                type="number"
                min="0"
                max="6"
                value={xAxisFormat.decimals ?? 0}
                onChange={(e) => updateXAxisFormat({ decimals: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-sm"
              />
            </div>
            {xAxisFormat.type === 'currency' && (
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Símbolo
                </label>
                <input
                  type="text"
                  value={xAxisFormat.currencySymbol || '$'}
                  onChange={(e) => updateXAxisFormat({ currencySymbol: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-sm"
                  maxLength={3}
                />
              </div>
            )}
          </div>
        )}

        {/* Separador de miles (para número y moneda) */}
        {(xAxisFormat.type === 'number' || xAxisFormat.type === 'currency') && (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="thousandsSeparator"
              checked={xAxisFormat.thousandsSeparator ?? true}
              onChange={(e) => updateXAxisFormat({ thousandsSeparator: e.target.checked })}
              className="h-4 w-4 text-primary-blue focus:ring-primary-blue border-gray-300 rounded"
            />
            <label htmlFor="thousandsSeparator" className="text-sm text-gray-600">
              Separador de miles
            </label>
          </div>
        )}

        {/* Prefijo y Sufijo (para todos excepto auto) */}
        {xAxisFormat.type !== 'auto' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Prefijo
              </label>
              <input
                type="text"
                placeholder="Ej: $ o Q"
                value={xAxisFormat.prefix || ''}
                onChange={(e) => updateXAxisFormat({ prefix: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-sm"
                maxLength={10}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Sufijo
              </label>
              <input
                type="text"
                placeholder="Ej: kg o %"
                value={xAxisFormat.suffix || ''}
                onChange={(e) => updateXAxisFormat({ suffix: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-sm"
                maxLength={10}
              />
            </div>
          </div>
        )}

        {/* Rotación de etiquetas */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Rotación de etiquetas: {xAxisFormat.labelRotation ?? 0}°
          </label>
          <input
            type="range"
            min="-90"
            max="90"
            step="15"
            value={xAxisFormat.labelRotation ?? 0}
            onChange={(e) => updateXAxisFormat({ labelRotation: parseInt(e.target.value) })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>-90°</span>
            <span>0°</span>
            <span>90°</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Configurar Widget
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Tipo: <span className="font-medium capitalize">{config.type}</span>
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* General Settings */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Configuración General
              </h3>
              {renderGeneralSettings()}
            </div>

            {/* Type-specific Settings */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Opciones del Widget
              </h3>
              {renderKPISettings()}
              {renderChartSettings()}
              {renderColorSchemeSelector()}
            </div>

            {/* X-Axis Format Settings (solo para gráficos con eje X) */}
            {['line-chart', 'bar-chart', 'area-chart'].includes(config.type) && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Formato de Ejes
                </h3>
                {renderXAxisFormatSettings()}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-primary-blue text-white rounded-lg hover:bg-secondary-blue transition-colors"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

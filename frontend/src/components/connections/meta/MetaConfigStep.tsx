/**
 * Paso 2 del onboarding de Meta Ads: Configuración
 * Permite seleccionar fecha de inicio y frecuencia de sincronización
 */

import { useState, useRef, useEffect } from 'react'
import { CalendarIcon, CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { META_FREQUENCY_OPTIONS, META_DATE_LIMITS } from '@/types/connections'
import { format, parse, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval, addMonths, subMonths, getDay } from 'date-fns'
import { es } from 'date-fns/locale'

interface MetaConfigStepProps {
  onComplete: (config: { startDate: string; frequency: 'daily' | 'weekly' | 'monthly' }) => void
  onBack?: () => void
  loading?: boolean
}

export default function MetaConfigStep({
  onComplete,
  onBack,
  loading = false
}: MetaConfigStepProps) {
  // Calcular fechas límite
  const today = new Date()
  const minDate = new Date(today)
  minDate.setDate(today.getDate() - META_DATE_LIMITS.MAX_DAYS_AGO) // 730 días atrás

  const maxDate = new Date(today)
  maxDate.setDate(today.getDate() - META_DATE_LIMITS.MIN_DAYS_AGO) // 7 días atrás

  const defaultDate = new Date(today)
  defaultDate.setDate(today.getDate() - META_DATE_LIMITS.DEFAULT_DAYS_AGO) // 180 días atrás

  // Formatear fecha a YYYY-MM-DD (para almacenamiento)
  const formatDateISO = (date: Date) => format(date, 'yyyy-MM-dd')

  // Formatear fecha a dd/mm/yyyy (para display)
  const formatDateDisplay = (dateStr: string) => {
    const date = parse(dateStr, 'yyyy-MM-dd', new Date())
    return format(date, 'dd/MM/yyyy')
  }

  const [startDate, setStartDate] = useState(formatDateISO(defaultDate))
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [showCalendar, setShowCalendar] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(parse(formatDateISO(defaultDate), 'yyyy-MM-dd', new Date()))
  const calendarRef = useRef<HTMLDivElement>(null)

  // Cerrar calendario al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedDate = parse(startDate, 'yyyy-MM-dd', new Date())

  // Calcular días de datos
  const calculateDaysOfData = () => {
    const selected = new Date(startDate)
    const diffTime = Math.abs(today.getTime() - selected.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const daysOfData = calculateDaysOfData()

  const handleSubmit = () => {
    onComplete({ startDate, frequency })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <CalendarIcon className="h-8 w-8 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Configura tu sincronización
        </h2>
        <p className="text-sm text-gray-600">
          Define desde cuándo quieres importar datos y con qué frecuencia actualizarlos
        </p>
      </div>

      {/* Fecha de inicio */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          ¿Desde qué fecha quieres importar datos?
        </label>

        <div className="relative" ref={calendarRef}>
          {/* Input que muestra la fecha en dd/mm/yyyy */}
          <button
            type="button"
            onClick={() => setShowCalendar(!showCalendar)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white flex items-center justify-between"
          >
            <span className="text-gray-900">{formatDateDisplay(startDate)}</span>
            <CalendarIcon className="h-5 w-5 text-gray-400" />
          </button>

          {/* Calendario personalizado */}
          {showCalendar && (
            <div className="absolute z-50 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-[340px]">
              {/* Header del mes */}
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
                </button>
                <span className="text-base font-semibold text-gray-900 capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: es })}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRightIcon className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {/* Días de la semana */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Días del mes */}
              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const monthStart = startOfMonth(currentMonth)
                  const monthEnd = endOfMonth(currentMonth)
                  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

                  // Agregar días vacíos al inicio (lunes = 0, domingo = 6)
                  const startDay = getDay(monthStart)
                  const emptyDays = startDay === 0 ? 6 : startDay - 1

                  const allDays = [
                    ...Array(emptyDays).fill(null),
                    ...days
                  ]

                  return allDays.map((day, idx) => {
                    if (!day) {
                      return <div key={`empty-${idx}`} className="h-10" />
                    }

                    const isSelected = isSameDay(day, selectedDate)
                    const isInRange = isWithinInterval(day, { start: minDate, end: maxDate })
                    const isCurrentMonth = isSameMonth(day, currentMonth)

                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        disabled={!isInRange}
                        onClick={() => {
                          if (isInRange) {
                            setStartDate(formatDateISO(day))
                            setShowCalendar(false)
                          }
                        }}
                        className={`
                          h-10 w-10 rounded-lg text-sm font-medium transition-colors
                          ${isSelected
                            ? 'bg-blue-600 text-white'
                            : isInRange
                              ? 'hover:bg-blue-50 text-gray-900'
                              : 'text-gray-300 cursor-not-allowed'
                          }
                          ${!isCurrentMonth ? 'text-gray-300' : ''}
                        `}
                      >
                        {format(day, 'd')}
                      </button>
                    )
                  })
                })()}
              </div>

              {/* Fecha seleccionada */}
              <div className="mt-4 pt-3 border-t border-gray-100 text-center text-sm text-gray-600">
                Seleccionada: <span className="font-medium text-gray-900">{formatDateDisplay(startDate)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex gap-2">
            <CheckCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">
                {daysOfData} días de datos históricos
              </p>
              <p className="text-blue-700 text-xs mt-0.5">
                Recomendamos al menos 6 meses (180 días) para análisis efectivo.
                Máximo permitido: 2 años.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Frecuencia */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          ¿Con qué frecuencia quieres actualizar tus datos?
        </label>

        <div className="space-y-2">
          {META_FREQUENCY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                frequency === option.value
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="frequency"
                value={option.value}
                checked={frequency === option.value}
                onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')}
                className="sr-only"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${
                    frequency === option.value ? 'text-blue-900' : 'text-gray-900'
                  }`}>
                    {option.label}
                  </span>
                  {option.value === 'daily' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      Recomendado
                    </span>
                  )}
                </div>
                <p className={`text-sm mt-1 ${
                  frequency === option.value ? 'text-blue-700' : 'text-gray-500'
                }`}>
                  {option.description}
                </p>
                <p className={`text-xs mt-1 ${
                  frequency === option.value ? 'text-blue-600' : 'text-gray-400'
                }`}>
                  Ventana de datos: {option.syncWindow}
                </p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                frequency === option.value
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-gray-300'
              }`}>
                {frequency === option.value && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Info adicional */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">¿Cómo funciona la sincronización?</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• La primera sincronización importará todos los datos desde la fecha seleccionada</li>
          <li>• Las siguientes sincronizaciones actualizarán los datos más recientes</li>
          <li>• Meta puede ajustar métricas hasta 48h después, por eso siempre re-extraemos varios días</li>
          <li>• Puedes cambiar la frecuencia en cualquier momento</li>
        </ul>
      </div>

      {/* Botones */}
      <div className="flex gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Volver
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Guardando...
            </span>
          ) : (
            'Continuar'
          )}
        </button>
      </div>
    </div>
  )
}

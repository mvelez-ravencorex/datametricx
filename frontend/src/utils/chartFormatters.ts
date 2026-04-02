/**
 * Utilidades para formatear valores de ejes en gráficos
 */

import type { XAxisFormatConfig, DateFormatPattern, TimeFormatPattern } from '@/types/widgets'

/**
 * Formatea un valor según la configuración del eje X
 */
export function formatXAxisValue(
  value: unknown,
  config?: XAxisFormatConfig
): string {
  if (value === null || value === undefined) {
    return ''
  }

  // Si no hay configuración o es auto, detectar tipo
  if (!config || config.type === 'auto') {
    return autoFormat(value)
  }

  let formatted: string

  switch (config.type) {
    case 'text':
      formatted = String(value)
      break

    case 'number':
      formatted = formatNumber(value, config)
      break

    case 'currency':
      formatted = formatCurrency(value, config)
      break

    case 'percentage':
      formatted = formatPercentage(value, config)
      break

    case 'date':
      formatted = formatDate(value, config.datePattern, config.customDatePattern)
      break

    case 'time':
      formatted = formatTime(value, config.timePattern, config.customTimePattern)
      break

    case 'datetime':
      formatted = formatDateTime(value, config)
      break

    default:
      formatted = String(value)
  }

  // Aplicar prefijo y sufijo si existen
  if (config.prefix) {
    formatted = config.prefix + formatted
  }
  if (config.suffix) {
    formatted = formatted + config.suffix
  }

  return formatted
}

/**
 * Formato automático basado en el tipo de valor
 */
function autoFormat(value: unknown): string {
  if (typeof value === 'number') {
    return value.toLocaleString()
  }

  if (value instanceof Date) {
    return value.toLocaleDateString()
  }

  // Intentar detectar si es una fecha string
  if (typeof value === 'string') {
    const dateValue = tryParseDate(value)
    if (dateValue) {
      return dateValue.toLocaleDateString()
    }
  }

  return String(value)
}

/**
 * Formatea un número
 */
function formatNumber(value: unknown, config: XAxisFormatConfig): string {
  const num = toNumber(value)
  if (num === null) return String(value)

  const decimals = config.decimals ?? 0
  const useThousands = config.thousandsSeparator ?? true

  if (useThousands) {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })
  }

  return num.toFixed(decimals)
}

/**
 * Formatea un valor como moneda
 */
function formatCurrency(value: unknown, config: XAxisFormatConfig): string {
  const num = toNumber(value)
  if (num === null) return String(value)

  const decimals = config.decimals ?? 2
  const symbol = config.currencySymbol ?? '$'

  const formatted = num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })

  return `${symbol}${formatted}`
}

/**
 * Formatea un valor como porcentaje
 */
function formatPercentage(value: unknown, config: XAxisFormatConfig): string {
  const num = toNumber(value)
  if (num === null) return String(value)

  const decimals = config.decimals ?? 1
  return `${num.toFixed(decimals)}%`
}

/**
 * Formatea una fecha según el patrón
 */
function formatDate(
  value: unknown,
  pattern?: DateFormatPattern,
  customPattern?: string
): string {
  const date = toDate(value)
  if (!date) return String(value)

  const actualPattern = pattern === 'custom' && customPattern ? customPattern : pattern

  switch (actualPattern) {
    case 'dd/MM/yyyy':
      return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`

    case 'MM/dd/yyyy':
      return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`

    case 'yyyy-MM-dd':
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

    case 'dd MMM yyyy':
      return `${pad(date.getDate())} ${getMonthShort(date)} ${date.getFullYear()}`

    case 'MMM dd, yyyy':
      return `${getMonthShort(date)} ${pad(date.getDate())}, ${date.getFullYear()}`

    case 'dd MMM':
      return `${pad(date.getDate())} ${getMonthShort(date)}`

    case 'MMM yyyy':
      return `${getMonthShort(date)} ${date.getFullYear()}`

    case 'yyyy':
      return `${date.getFullYear()}`

    case 'MMM':
      return getMonthShort(date)

    default:
      // Patrón personalizado o por defecto
      if (customPattern) {
        return applyCustomPattern(date, customPattern)
      }
      return date.toLocaleDateString()
  }
}

/**
 * Formatea una hora según el patrón
 */
function formatTime(
  value: unknown,
  pattern?: TimeFormatPattern,
  customPattern?: string
): string {
  const date = toDate(value)
  if (!date) return String(value)

  const actualPattern = pattern === 'custom' && customPattern ? customPattern : pattern

  const hours24 = date.getHours()
  const hours12 = hours24 % 12 || 12
  const minutes = date.getMinutes()
  const seconds = date.getSeconds()
  const ampm = hours24 >= 12 ? 'PM' : 'AM'

  switch (actualPattern) {
    case 'HH:mm':
      return `${pad(hours24)}:${pad(minutes)}`

    case 'HH:mm:ss':
      return `${pad(hours24)}:${pad(minutes)}:${pad(seconds)}`

    case 'hh:mm a':
      return `${pad(hours12)}:${pad(minutes)} ${ampm}`

    case 'hh:mm:ss a':
      return `${pad(hours12)}:${pad(minutes)}:${pad(seconds)} ${ampm}`

    default:
      if (customPattern) {
        return applyCustomPattern(date, customPattern)
      }
      return `${pad(hours24)}:${pad(minutes)}`
  }
}

/**
 * Formatea fecha y hora combinados
 */
function formatDateTime(value: unknown, config: XAxisFormatConfig): string {
  const date = toDate(value)
  if (!date) return String(value)

  const dateStr = formatDate(date, config.datePattern, config.customDatePattern)
  const timeStr = formatTime(date, config.timePattern, config.customTimePattern)

  return `${dateStr} ${timeStr}`
}

/**
 * Aplica un patrón personalizado a una fecha
 * Soporta: yyyy, MM, dd, HH, mm, ss, MMM, a
 */
function applyCustomPattern(date: Date, pattern: string): string {
  const hours24 = date.getHours()
  const hours12 = hours24 % 12 || 12
  const ampm = hours24 >= 12 ? 'PM' : 'AM'

  return pattern
    .replace('yyyy', String(date.getFullYear()))
    .replace('MM', pad(date.getMonth() + 1))
    .replace('dd', pad(date.getDate()))
    .replace('HH', pad(hours24))
    .replace('hh', pad(hours12))
    .replace('mm', pad(date.getMinutes()))
    .replace('ss', pad(date.getSeconds()))
    .replace('MMM', getMonthShort(date))
    .replace('a', ampm)
}

// ===== UTILIDADES AUXILIARES =====

/**
 * Convierte un valor a número o null
 */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return isNaN(value) ? null : value
  }
  if (typeof value === 'string') {
    const num = parseFloat(value)
    return isNaN(num) ? null : num
  }
  return null
}

/**
 * Convierte un valor a Date o null
 */
function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = tryParseDate(value)
    return date
  }

  return null
}

/**
 * Intenta parsear una fecha desde string o número
 */
function tryParseDate(value: string | number): Date | null {
  if (typeof value === 'number') {
    // Asumir timestamp en milisegundos o segundos
    const timestamp = value > 1e12 ? value : value * 1000
    const date = new Date(timestamp)
    return isNaN(date.getTime()) ? null : date
  }

  // Intentar parsear string
  const date = new Date(value)
  if (!isNaN(date.getTime())) {
    return date
  }

  // Intentar formatos comunes
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,           // yyyy-MM-dd
    /^(\d{2})\/(\d{2})\/(\d{4})$/,         // dd/MM/yyyy o MM/dd/yyyy
    /^(\d{4})\/(\d{2})\/(\d{2})$/,         // yyyy/MM/dd
  ]

  for (const format of formats) {
    const match = value.match(format)
    if (match) {
      const parsed = new Date(value)
      if (!isNaN(parsed.getTime())) {
        return parsed
      }
    }
  }

  return null
}

/**
 * Añade cero a la izquierda si es necesario
 */
function pad(num: number): string {
  return num < 10 ? `0${num}` : String(num)
}

/**
 * Obtiene el nombre corto del mes
 */
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getMonthShort(date: Date): string {
  return MONTHS_SHORT[date.getMonth()]
}

// ===== CONSTANTES PARA UI =====

export const X_AXIS_FORMAT_OPTIONS: Array<{ value: XAxisFormatConfig['type']; label: string }> = [
  { value: 'auto', label: 'Automático' },
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'currency', label: 'Moneda' },
  { value: 'percentage', label: 'Porcentaje' },
  { value: 'date', label: 'Fecha' },
  { value: 'time', label: 'Hora' },
  { value: 'datetime', label: 'Fecha y Hora' },
]

export const DATE_FORMAT_OPTIONS: Array<{ value: DateFormatPattern; label: string; example: string }> = [
  { value: 'dd/MM/yyyy', label: 'dd/MM/yyyy', example: '31/12/2024' },
  { value: 'MM/dd/yyyy', label: 'MM/dd/yyyy', example: '12/31/2024' },
  { value: 'yyyy-MM-dd', label: 'yyyy-MM-dd', example: '2024-12-31' },
  { value: 'dd MMM yyyy', label: 'dd MMM yyyy', example: '31 Dec 2024' },
  { value: 'MMM dd, yyyy', label: 'MMM dd, yyyy', example: 'Dec 31, 2024' },
  { value: 'dd MMM', label: 'dd MMM', example: '31 Dec' },
  { value: 'MMM yyyy', label: 'MMM yyyy', example: 'Dec 2024' },
  { value: 'yyyy', label: 'yyyy', example: '2024' },
  { value: 'MMM', label: 'MMM', example: 'Dec' },
  { value: 'custom', label: 'Personalizado', example: '' },
]

export const TIME_FORMAT_OPTIONS: Array<{ value: TimeFormatPattern; label: string; example: string }> = [
  { value: 'HH:mm', label: 'HH:mm (24h)', example: '14:30' },
  { value: 'HH:mm:ss', label: 'HH:mm:ss (24h)', example: '14:30:45' },
  { value: 'hh:mm a', label: 'hh:mm a (12h)', example: '02:30 PM' },
  { value: 'hh:mm:ss a', label: 'hh:mm:ss a (12h)', example: '02:30:45 PM' },
  { value: 'custom', label: 'Personalizado', example: '' },
]

/**
 * Obtiene la configuración por defecto para un tipo de formato
 */
export function getDefaultXAxisFormat(type: XAxisFormatConfig['type']): XAxisFormatConfig {
  const base: XAxisFormatConfig = { type }

  switch (type) {
    case 'date':
      return { ...base, datePattern: 'dd/MM/yyyy' }
    case 'time':
      return { ...base, timePattern: 'HH:mm' }
    case 'datetime':
      return { ...base, datePattern: 'dd/MM/yyyy', timePattern: 'HH:mm' }
    case 'number':
      return { ...base, decimals: 0, thousandsSeparator: true }
    case 'currency':
      return { ...base, decimals: 2, currencySymbol: '$', thousandsSeparator: true }
    case 'percentage':
      return { ...base, decimals: 1 }
    default:
      return base
  }
}

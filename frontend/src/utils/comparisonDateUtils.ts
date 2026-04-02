/**
 * Date Utilities for Period over Period UI
 *
 * NOTE: The actual PoP comparison calculation is now done by the backend.
 * This file contains utility functions for the UI to display date information.
 */

import type { DateFilterOperator } from '@/types/semantic'

// ============================================================================
// DATE FILTER OPERATORS
// ============================================================================

/**
 * Operadores que indican un filtro de fecha relativo
 */
export const DATE_FILTER_OPERATORS: string[] = [
  'today', 'yesterday',
  'last_7_days', 'last_14_days', 'last_30_days', 'last_60_days', 'last_90_days',
  'this_week', 'this_month', 'this_quarter', 'this_year',
  'last_week', 'last_month', 'last_quarter', 'last_year'
]

/**
 * Verifica si un operador es un operador de fecha relativo
 */
export function isDateFilterOperator(operator: string): boolean {
  return DATE_FILTER_OPERATORS.includes(operator)
}

// ============================================================================
// DATE HELPERS (for UI display)
// ============================================================================

/**
 * Formatea una fecha a string YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Obtiene el inicio de la semana (Lunes)
 */
function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Lunes como inicio
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Obtiene el inicio del mes
 */
function startOfMonth(date: Date): Date {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Obtiene el inicio del trimestre
 */
function startOfQuarter(date: Date): Date {
  const d = new Date(date)
  const quarter = Math.floor(d.getMonth() / 3)
  d.setMonth(quarter * 3)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Obtiene el inicio del año
 */
function startOfYear(date: Date): Date {
  const d = new Date(date)
  d.setMonth(0)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

// ============================================================================
// DATE RANGE FROM OPERATOR (for UI display)
// ============================================================================

/**
 * Convierte un DateFilterOperator a un rango de fechas concreto
 * Used by the UI to display the current date range
 * @param operator El operador de filtro de fecha
 * @returns Objeto con start y end dates
 */
export function getDateRangeFromOperator(
  operator: DateFilterOperator | string
): { start: Date; end: Date } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const endOfToday = new Date(today)
  endOfToday.setHours(23, 59, 59, 999)

  switch (operator) {
    // Dias especificos
    case 'today':
      return { start: today, end: endOfToday }

    case 'yesterday': {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const endYesterday = new Date(yesterday)
      endYesterday.setHours(23, 59, 59, 999)
      return { start: yesterday, end: endYesterday }
    }

    // Ultimos X dias
    case 'last_7_days': {
      const start = new Date(today)
      start.setDate(start.getDate() - 6)
      return { start, end: endOfToday }
    }

    case 'last_14_days': {
      const start = new Date(today)
      start.setDate(start.getDate() - 13)
      return { start, end: endOfToday }
    }

    case 'last_30_days': {
      const start = new Date(today)
      start.setDate(start.getDate() - 29)
      return { start, end: endOfToday }
    }

    case 'last_60_days': {
      const start = new Date(today)
      start.setDate(start.getDate() - 59)
      return { start, end: endOfToday }
    }

    case 'last_90_days': {
      const start = new Date(today)
      start.setDate(start.getDate() - 89)
      return { start, end: endOfToday }
    }

    // Este periodo
    case 'this_week': {
      const start = startOfWeek(today)
      return { start, end: endOfToday }
    }

    case 'this_month': {
      const start = startOfMonth(today)
      return { start, end: endOfToday }
    }

    case 'this_quarter': {
      const start = startOfQuarter(today)
      return { start, end: endOfToday }
    }

    case 'this_year': {
      const start = startOfYear(today)
      return { start, end: endOfToday }
    }

    // Periodo anterior completo
    case 'last_week': {
      const thisWeekStart = startOfWeek(today)
      const lastWeekStart = new Date(thisWeekStart)
      lastWeekStart.setDate(lastWeekStart.getDate() - 7)
      const lastWeekEnd = new Date(thisWeekStart)
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 1)
      lastWeekEnd.setHours(23, 59, 59, 999)
      return { start: lastWeekStart, end: lastWeekEnd }
    }

    case 'last_month': {
      const thisMonthStart = startOfMonth(today)
      const lastMonthStart = new Date(thisMonthStart)
      lastMonthStart.setMonth(lastMonthStart.getMonth() - 1)
      const lastMonthEnd = new Date(thisMonthStart)
      lastMonthEnd.setDate(lastMonthEnd.getDate() - 1)
      lastMonthEnd.setHours(23, 59, 59, 999)
      return { start: lastMonthStart, end: lastMonthEnd }
    }

    case 'last_quarter': {
      const thisQuarterStart = startOfQuarter(today)
      const lastQuarterStart = new Date(thisQuarterStart)
      lastQuarterStart.setMonth(lastQuarterStart.getMonth() - 3)
      const lastQuarterEnd = new Date(thisQuarterStart)
      lastQuarterEnd.setDate(lastQuarterEnd.getDate() - 1)
      lastQuarterEnd.setHours(23, 59, 59, 999)
      return { start: lastQuarterStart, end: lastQuarterEnd }
    }

    case 'last_year': {
      const thisYearStart = startOfYear(today)
      const lastYearStart = new Date(thisYearStart)
      lastYearStart.setFullYear(lastYearStart.getFullYear() - 1)
      const lastYearEnd = new Date(thisYearStart)
      lastYearEnd.setDate(lastYearEnd.getDate() - 1)
      lastYearEnd.setHours(23, 59, 59, 999)
      return { start: lastYearStart, end: lastYearEnd }
    }

    default:
      // Default to today if unknown operator
      return { start: today, end: endOfToday }
  }
}

/**
 * Parsea un valor de filtro 'between' a rango de fechas
 * @param value Array [startDate, endDate] o string "start,end"
 */
export function parseBetweenValue(value: unknown): { start: Date; end: Date } | null {
  if (Array.isArray(value) && value.length >= 2) {
    const start = new Date(value[0] as string)
    const end = new Date(value[1] as string)
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
  }
  if (typeof value === 'string' && value.includes(',')) {
    const [startStr, endStr] = value.split(',')
    const start = new Date(startStr.trim())
    const end = new Date(endStr.trim())
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
  }
  return null
}

// ============================================================================
// LABEL HELPERS
// ============================================================================

/**
 * Genera un label legible para un rango de fechas
 */
export function getDateRangeLabel(startDate: string, endDate: string): string {
  const format = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
  }

  return `${format(startDate)} - ${format(endDate)}`
}

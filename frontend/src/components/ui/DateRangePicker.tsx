/**
 * DateRangePicker - Looker-style date range picker
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '@heroicons/react/24/outline'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  isBefore,
  isAfter,
  parseISO
} from 'date-fns'
import { es } from 'date-fns/locale'

interface DateRangePickerProps {
  startDate: string | null
  endDate: string | null
  onChange: (start: string, end: string) => void
  isRange?: boolean
  placeholder?: string
  inline?: boolean  // Show calendar inline without trigger button
}

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  isRange = true,
  placeholder = 'Seleccionar fecha',
  inline = false
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [hoverDate, setHoverDate] = useState<Date | null>(null)
  const [selectingStart, setSelectingStart] = useState(true)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Parse dates
  const parsedStart = useMemo(() => startDate ? parseISO(startDate) : null, [startDate])
  const parsedEnd = useMemo(() => endDate ? parseISO(endDate) : null, [endDate])

  // Calculate dropdown position
  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left
      })
    }
  }, [])

  // Update position when opening
  useEffect(() => {
    if (isOpen) {
      updatePosition()
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
      return () => {
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
      }
    }
  }, [isOpen, updatePosition])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const days: Date[] = []
    let day = calendarStart
    while (day <= calendarEnd) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [currentMonth])

  // Handle day click
  const handleDayClick = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd')

    if (!isRange) {
      onChange(dateStr, dateStr)
      if (!inline) setIsOpen(false)
      return
    }

    if (selectingStart) {
      onChange(dateStr, '')
      setSelectingStart(false)
    } else {
      if (parsedStart && isBefore(day, parsedStart)) {
        onChange(dateStr, '')
        setSelectingStart(false)
      } else {
        onChange(startDate || dateStr, dateStr)
        setSelectingStart(true)
        if (!inline) setIsOpen(false)
      }
    }
  }

  // Check if day is in range
  const isDayInRange = (day: Date) => {
    if (!parsedStart) return false

    const end = parsedEnd || (hoverDate && !selectingStart ? hoverDate : null)
    if (!end) return false

    const rangeStart = isBefore(parsedStart, end) ? parsedStart : end
    const rangeEnd = isAfter(end, parsedStart) ? end : parsedStart

    return isWithinInterval(day, { start: rangeStart, end: rangeEnd })
  }

  // Check if day is start or end
  const isDayStart = (day: Date) => parsedStart && isSameDay(day, parsedStart)
  const isDayEnd = (day: Date) => parsedEnd && isSameDay(day, parsedEnd)

  // Format display value
  const displayValue = useMemo(() => {
    if (!startDate) return placeholder
    if (!isRange || !endDate) return format(parseISO(startDate), 'd MMM yyyy', { locale: es })
    return `${format(parseISO(startDate), 'd MMM', { locale: es })} - ${format(parseISO(endDate), 'd MMM yyyy', { locale: es })}`
  }, [startDate, endDate, isRange, placeholder])

  const weekDays = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

  const dropdownContent = (
    <div
      ref={dropdownRef}
      className="bg-white border border-gray-200 rounded-lg shadow-xl p-4"
      style={{
        position: 'fixed',
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        zIndex: 99999,
        minWidth: 280
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <span className="text-sm font-medium text-gray-900 capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </span>
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ChevronRightIcon className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isStart = isDayStart(day)
          const isEnd = isDayEnd(day)
          const isInRange = isDayInRange(day)
          const isToday = isSameDay(day, new Date())

          return (
            <button
              key={index}
              type="button"
              onClick={() => isCurrentMonth && handleDayClick(day)}
              onMouseEnter={() => setHoverDate(day)}
              onMouseLeave={() => setHoverDate(null)}
              className={`
                relative h-8 w-8 text-xs rounded-md transition-all flex items-center justify-center
                ${!isCurrentMonth ? 'text-gray-300 cursor-default' : 'hover:bg-blue-50 cursor-pointer'}
                ${isToday && !isStart && !isEnd ? 'font-bold text-blue-600' : ''}
                ${isInRange && !isStart && !isEnd ? 'bg-blue-100' : ''}
                ${isStart || isEnd ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}
                ${isCurrentMonth && !isStart && !isEnd && !isInRange ? 'text-gray-700' : ''}
              `}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>

      {/* Range indicator */}
      {isRange && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${selectingStart ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
              <span>{selectingStart ? 'Selecciona inicio' : 'Selecciona fin'}</span>
            </div>
            {startDate && (
              <button
                type="button"
                onClick={() => {
                  onChange('', '')
                  setSelectingStart(true)
                }}
                className="text-blue-500 hover:text-blue-700 font-medium"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick presets */}
      {isRange && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-1">
            {[
              { label: 'Hoy', getValue: () => {
                const today = format(new Date(), 'yyyy-MM-dd')
                return [today, today]
              }},
              { label: 'Ayer', getValue: () => {
                const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd')
                return [yesterday, yesterday]
              }},
              { label: 'Últimos 7 días', getValue: () => {
                const end = format(new Date(), 'yyyy-MM-dd')
                const start = format(addDays(new Date(), -6), 'yyyy-MM-dd')
                return [start, end]
              }},
              { label: 'Últimos 30 días', getValue: () => {
                const end = format(new Date(), 'yyyy-MM-dd')
                const start = format(addDays(new Date(), -29), 'yyyy-MM-dd')
                return [start, end]
              }},
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  const [start, end] = preset.getValue()
                  onChange(start, end)
                  setIsOpen(false)
                }}
                className="text-xs py-1.5 px-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors text-left"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // Inline calendar content (without portal wrapper)
  const inlineCalendarContent = (
    <div className="bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <span className="text-sm font-medium text-gray-900 capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </span>
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ChevronRightIcon className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isStart = isDayStart(day)
          const isEnd = isDayEnd(day)
          const isInRange = isDayInRange(day)
          const isToday = isSameDay(day, new Date())

          return (
            <button
              key={index}
              type="button"
              onClick={() => isCurrentMonth && handleDayClick(day)}
              onMouseEnter={() => setHoverDate(day)}
              onMouseLeave={() => setHoverDate(null)}
              className={`
                relative h-8 w-8 text-xs rounded-md transition-all flex items-center justify-center
                ${!isCurrentMonth ? 'text-gray-300 cursor-default' : 'hover:bg-blue-50 cursor-pointer'}
                ${isToday && !isStart && !isEnd ? 'font-bold text-blue-600' : ''}
                ${isInRange && !isStart && !isEnd ? 'bg-blue-100' : ''}
                ${isStart || isEnd ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}
                ${isCurrentMonth && !isStart && !isEnd && !isInRange ? 'text-gray-700' : ''}
              `}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>

      {/* Range indicator */}
      {isRange && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${selectingStart ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
              <span>{selectingStart ? 'Selecciona inicio' : 'Selecciona fin'}</span>
            </div>
            {startDate && (
              <button
                type="button"
                onClick={() => {
                  onChange('', '')
                  setSelectingStart(true)
                }}
                className="text-blue-500 hover:text-blue-700 font-medium"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )

  // If inline mode, just render the calendar directly
  if (inline) {
    return inlineCalendarContent
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 h-8 px-3 text-xs border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 min-w-[140px]"
      >
        <CalendarIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className={`truncate ${startDate ? 'text-gray-900' : 'text-gray-400'}`}>{displayValue}</span>
      </button>

      {/* Portal for dropdown */}
      {isOpen && createPortal(dropdownContent, document.body)}
    </>
  )
}

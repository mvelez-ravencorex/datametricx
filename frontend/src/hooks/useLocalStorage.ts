/**
 * Hook para gestionar localStorage con TypeScript
 */

import { useState, useEffect, useCallback } from 'react'
import logger from '@/utils/logger'

/**
 * Hook para usar localStorage con sincronización
 *
 * @example
 * const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('theme', 'light')
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  // Estado para almacenar el valor
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initialValue
    } catch (error) {
      logger.warn(`Error reading localStorage key "${key}"`, { error })
      return initialValue
    }
  })

  // Función para establecer valor
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // Permitir que value sea una función para tener la misma API que useState
        const valueToStore = value instanceof Function ? value(storedValue) : value

        setStoredValue(valueToStore)
        window.localStorage.setItem(key, JSON.stringify(valueToStore))

        // Disparar evento personalizado para sincronizar entre tabs
        window.dispatchEvent(
          new CustomEvent('local-storage-change', {
            detail: { key, value: valueToStore }
          })
        )
      } catch (error) {
        logger.error(`Error setting localStorage key "${key}"`, error as Error, {})
      }
    },
    [key, storedValue]
  )

  // Función para remover valor
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key)
      setStoredValue(initialValue)
    } catch (error) {
      logger.error(`Error removing localStorage key "${key}"`, error as Error, {})
    }
  }, [key, initialValue])

  // Escuchar cambios en otras tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setStoredValue(JSON.parse(e.newValue) as T)
        } catch (error) {
          logger.warn('Error parsing storage change', { error })
        }
      }
    }

    const handleCustomEvent = (e: CustomEvent) => {
      if (e.detail.key === key) {
        setStoredValue(e.detail.value as T)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('local-storage-change', handleCustomEvent as EventListener)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('local-storage-change', handleCustomEvent as EventListener)
    }
  }, [key])

  return [storedValue, setValue, removeValue]
}

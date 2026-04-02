/**
 * Utilidades de performance
 * Proporciona funciones para optimización de rendimiento
 */

/**
 * Debounce - Retrasa la ejecución hasta que pasen X milisegundos sin llamadas
 * Útil para: búsquedas, auto-guardado, resize events
 *
 * @example
 * const debouncedSearch = debounce((query: string) => {
 *   searchAPI(query)
 * }, 300)
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn.apply(this, args), delay)
  }
}

/**
 * Throttle - Limita la ejecución a una vez cada X milisegundos
 * Útil para: scroll events, mouse move, window resize
 *
 * @example
 * const throttledScroll = throttle(() => {
 *   updateScrollPosition()
 * }, 100)
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (!inThrottle) {
      fn.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * Memoiza el resultado de una función basado en sus argumentos
 * Útil para: cálculos costosos, transformaciones de datos
 *
 * @example
 * const expensiveCalculation = memoize((a: number, b: number) => {
 *   // Cálculo pesado
 *   return a ** b
 * })
 */
export function memoize<T extends (...args: string[]) => unknown>(
  fn: T
): T {
  const cache = new Map<string, ReturnType<T>>()

  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args)

    if (cache.has(key)) {
      return cache.get(key)
    }

    const result = fn(...args) as ReturnType<T>
    cache.set(key, result)
    return result
  }) as T
}

/**
 * Cache con TTL (Time To Live)
 * Útil para: cachear responses de API, datos temporales
 */
export class CacheWithTTL<T> {
  private cache = new Map<string, { data: T; expiry: number; etag?: string }>()

  /**
   * Guarda un valor en el caché con TTL
   * @param key - Clave única
   * @param data - Datos a cachear
   * @param ttl - Tiempo de vida en milisegundos (default: 5 minutos)
   */
  set(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
      etag: this.generateETag(data),
    })
  }

  /**
   * Obtiene un valor del caché (null si expiró)
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) return null

    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  /**
   * Verifica si una key existe y es válida
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Invalida una entrada específica
   */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Invalida todas las entradas que coincidan con un patrón
   */
  invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Limpia todo el caché
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Obtiene estadísticas del caché
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }

  /**
   * Genera un ETag simple para validación de caché
   */
  private generateETag(data: T): string {
    try {
      return btoa(JSON.stringify(data)).slice(0, 16)
    } catch {
      return Date.now().toString(36)
    }
  }
}

/**
 * Rate Limiter - Limita el número de llamadas en una ventana de tiempo
 * Útil para: proteger APIs, limitar requests del usuario
 *
 * @example
 * const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 })
 *
 * if (limiter.check('user123')) {
 *   // Proceder con la operación
 * } else {
 *   throw new Error('Rate limit exceeded')
 * }
 */
export class RateLimiter {
  private requests = new Map<string, number[]>()
  private maxRequests: number
  private windowMs: number

  constructor(config: { maxRequests: number; windowMs: number }) {
    this.maxRequests = config.maxRequests
    this.windowMs = config.windowMs
  }

  /**
   * Verifica si una key puede hacer otra request
   * @returns true si está dentro del límite, false si excedió
   */
  check(key: string): boolean {
    const now = Date.now()
    const windowStart = now - this.windowMs

    // Obtener requests del key
    let keyRequests = this.requests.get(key) || []

    // Remover requests antiguos fuera de la ventana
    keyRequests = keyRequests.filter((time) => time > windowStart)

    // Verificar límite
    if (keyRequests.length >= this.maxRequests) {
      // Actualizar sin agregar nueva request
      this.requests.set(key, keyRequests)
      return false
    }

    // Agregar request actual
    keyRequests.push(now)
    this.requests.set(key, keyRequests)

    return true
  }

  /**
   * Obtiene el número de requests restantes
   */
  getRemaining(key: string): number {
    const now = Date.now()
    const windowStart = now - this.windowMs

    let keyRequests = this.requests.get(key) || []
    keyRequests = keyRequests.filter((time) => time > windowStart)

    return Math.max(0, this.maxRequests - keyRequests.length)
  }

  /**
   * Resetea el contador para una key
   */
  reset(key: string): void {
    this.requests.delete(key)
  }

  /**
   * Limpia todos los contadores
   */
  clear(): void {
    this.requests.clear()
  }
}

/**
 * Batch Processor - Agrupa operaciones para procesamiento en lotes
 * Útil para: escrituras a DB, llamadas a API
 *
 * @example
 * const processor = new BatchProcessor<Metric>({
 *   maxSize: 100,
 *   maxWaitMs: 1000,
 *   processor: async (batch) => {
 *     await saveMetricsBatch(batch)
 *   }
 * })
 *
 * processor.add(metric)
 */
export class BatchProcessor<T> {
  private batch: T[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private maxSize: number
  private maxWaitMs: number
  private processor: (batch: T[]) => Promise<void>

  constructor(config: {
    maxSize: number
    maxWaitMs: number
    processor: (batch: T[]) => Promise<void>
  }) {
    this.maxSize = config.maxSize
    this.maxWaitMs = config.maxWaitMs
    this.processor = config.processor
  }

  /**
   * Agrega un item al batch
   */
  add(item: T): void {
    this.batch.push(item)

    // Procesar inmediatamente si alcanzó el tamaño máximo
    if (this.batch.length >= this.maxSize) {
      this.flush()
      return
    }

    // Si no hay timer, iniciar uno
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.maxWaitMs)
    }
  }

  /**
   * Procesa el batch actual inmediatamente
   */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    if (this.batch.length === 0) return

    const batchToProcess = [...this.batch]
    this.batch = []

    try {
      await this.processor(batchToProcess)
    } catch (error) {
      console.error('Error processing batch:', error)
      // Re-agregar items fallidos (opcional)
      // this.batch.unshift(...batchToProcess)
    }
  }

  /**
   * Obtiene el tamaño actual del batch
   */
  size(): number {
    return this.batch.length
  }
}

/**
 * Lazy Loader - Carga recursos solo cuando se necesitan
 * Útil para: code splitting, dynamic imports
 *
 * @example
 * const lazyChart = lazyLoad(() => import('./Chart'))
 */
export function lazyLoad<T>(
  importFn: () => Promise<{ default: T }>
): () => Promise<T> {
  let cached: T | null = null

  return async () => {
    if (cached) return cached

    const module = await importFn()
    cached = module.default
    return cached
  }
}

/**
 * Performance Monitor - Mide tiempos de ejecución
 * Útil para: debugging, optimización
 *
 * @example
 * const monitor = new PerformanceMonitor('API Call')
 * await fetchData()
 * monitor.end() // Logs: "API Call took 234ms"
 */
export class PerformanceMonitor {
  private startTime: number
  private label: string

  constructor(label: string) {
    this.label = label
    this.startTime = performance.now()
  }

  /**
   * Termina la medición y retorna la duración
   */
  end(): number {
    const duration = performance.now() - this.startTime
    console.log(`⏱️ ${this.label} took ${duration.toFixed(2)}ms`)
    return duration
  }

  /**
   * Termina la medición sin logging
   */
  getDuration(): number {
    return performance.now() - this.startTime
  }
}

/**
 * Wrapper para funciones async con retry automático
 * Útil para: llamadas a API, operaciones de red
 *
 * @example
 * const fetchWithRetry = withRetry(
 *   () => fetch('/api/data'),
 *   { maxRetries: 3, delay: 1000 }
 * )
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    delay?: number
    backoff?: boolean
  } = {}
): Promise<T> {
  const { maxRetries = 3, delay = 1000, backoff = true } = options

  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt < maxRetries) {
        const waitTime = backoff ? delay * Math.pow(2, attempt) : delay
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }
  }

  throw lastError!
}

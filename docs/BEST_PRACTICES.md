# DataMetricX - Mejores Prácticas de Seguridad y Escalabilidad

## 🎯 Objetivo

Este documento establece las mejores prácticas para garantizar que DataMetricX sea:
- **Seguro** - Proteger datos de usuarios y evitar vulnerabilidades
- **Escalable** - Soportar crecimiento de 10 a 10,000+ usuarios
- **Mantenible** - Código limpio y fácil de mantener
- **Performante** - Respuesta rápida bajo carga

---

## 🔒 SEGURIDAD

### 1. Autenticación y Autorización

#### ✅ Implementar siempre

```typescript
// ❌ MAL - No verificar usuario
async function getMetrics() {
  return await db.collection('metrics').get()
}

// ✅ BIEN - Verificar usuario y permisos
async function getMetrics(userId: string) {
  if (!userId) throw new UnauthorizedError()

  return await db
    .collection('metrics')
    .where('userId', '==', userId)
    .get()
}
```

#### ✅ Validar siempre en backend

```typescript
// ❌ MAL - Confiar en datos del cliente
export const updateMetric = functions.https.onCall(async (data) => {
  await db.collection('metrics').doc(data.id).update(data)
})

// ✅ BIEN - Validar todo
export const updateMetric = functions.https.onCall(async (data, context) => {
  // 1. Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
  }

  // 2. Validar entrada
  const schema = z.object({
    id: z.string().uuid(),
    value: z.number().positive(),
  })

  const validated = schema.parse(data)

  // 3. Verificar permisos
  const metric = await db.collection('metrics').doc(validated.id).get()
  if (metric.data()?.userId !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized')
  }

  // 4. Actualizar
  await metric.ref.update({
    value: validated.value,
    updatedAt: FieldValue.serverTimestamp()
  })
})
```

### 2. Reglas de Firestore

#### ✅ Nunca permitir acceso público

```javascript
// ❌ MAL
match /{document=**} {
  allow read, write: if true;
}

// ✅ BIEN
match /tenants/{tenantId} {
  // Solo usuarios autenticados del mismo tenant
  allow read: if request.auth != null &&
              request.auth.token.tenantId == tenantId;

  // Solo admin del tenant puede escribir
  allow write: if request.auth != null &&
               get(/databases/$(database)/documents/tenants/$(tenantId)/users/$(request.auth.uid)).data.role == 'admin';
}
```

### 3. Validación de Entrada (Zod)

#### ✅ Validar TODO input del usuario

```typescript
// src/utils/validation.ts
import { z } from 'zod'

// Schemas de validación
export const schemas = {
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
  displayName: z.string().min(2).max(50),

  metric: z.object({
    name: z.string().min(1).max(100),
    value: z.number().finite(),
    userId: z.string().uuid(),
  }),

  dataSource: z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['facebook', 'google', 'shopify', 'tiktok', 'other']),
    credentials: z.record(z.unknown()).optional(),
  })
}

// Uso
export function validateMetric(data: unknown) {
  return schemas.metric.parse(data)
}
```

### 4. Sanitización

```typescript
// src/utils/sanitize.ts
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Prevenir XSS
    .slice(0, 1000) // Limitar longitud
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj }

  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeString(sanitized[key] as string) as T[typeof key]
    }
  }

  return sanitized
}
```

### 5. Rate Limiting

```typescript
// src/utils/rateLimiter.ts
interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

export class RateLimiter {
  private requests = new Map<string, number[]>()

  constructor(private config: RateLimitConfig) {}

  check(userId: string): boolean {
    const now = Date.now()
    const windowStart = now - this.config.windowMs

    // Obtener requests del usuario
    let userRequests = this.requests.get(userId) || []

    // Remover requests antiguos
    userRequests = userRequests.filter(time => time > windowStart)

    // Verificar límite
    if (userRequests.length >= this.config.maxRequests) {
      return false // Rate limit excedido
    }

    // Agregar request actual
    userRequests.push(now)
    this.requests.set(userId, userRequests)

    return true
  }
}

// Uso
const limiter = new RateLimiter({ maxRequests: 100, windowMs: 60000 })

export async function apiCall(userId: string) {
  if (!limiter.check(userId)) {
    throw new Error('Rate limit exceeded')
  }

  // Proceder con la llamada
}
```

### 6. Secrets Management

```typescript
// ❌ MAL - Nunca hardcodear secrets
const API_KEY = 'sk_live_123456789'

// ✅ BIEN - Usar variables de entorno
const API_KEY = import.meta.env.VITE_API_KEY

// ✅ MEJOR - En backend, usar Secret Manager
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

const client = new SecretManagerServiceClient()

async function getSecret(name: string): Promise<string> {
  const [version] = await client.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/${name}/versions/latest`
  })

  return version.payload?.data?.toString() || ''
}
```

---

## 📈 ESCALABILIDAD

### 1. Paginación

```typescript
// src/services/firestore.ts
export async function getPaginatedData<T>(
  collectionName: string,
  pageSize: number,
  lastVisible?: DocumentSnapshot
): Promise<PaginatedResult<T>> {
  let q = query(
    collection(db, collectionName),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  )

  if (lastVisible) {
    q = query(q, startAfter(lastVisible))
  }

  const snapshot = await getDocs(q)
  const data = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as T[]

  const newLastVisible = snapshot.docs[snapshot.docs.length - 1]
  const hasMore = snapshot.docs.length === pageSize

  return { data, lastVisible: newLastVisible, hasMore }
}
```

### 2. Caché Inteligente

```typescript
// src/lib/cache.ts
interface CacheEntry<T> {
  data: T
  expiry: number
  etag?: string
}

export class SmartCache {
  private cache = new Map<string, CacheEntry<unknown>>()

  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
      etag: this.generateETag(data)
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  private generateETag(data: unknown): string {
    return btoa(JSON.stringify(data)).slice(0, 16)
  }

  invalidate(pattern: string) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }
}

// Uso
const cache = new SmartCache()

export async function getMetrics(userId: string) {
  const cacheKey = `metrics:${userId}`

  // Intentar obtener del caché
  let metrics = cache.get<Metric[]>(cacheKey)

  if (!metrics) {
    // Si no está en caché, consultar DB
    metrics = await metricService.getByUserId(userId)
    cache.set(cacheKey, metrics, 5 * 60 * 1000) // 5 minutos
  }

  return metrics
}
```

### 3. Lazy Loading de Componentes

```typescript
// src/App.tsx
import { lazy, Suspense } from 'react'

// Lazy load de páginas pesadas
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Sales = lazy(() => import('@/pages/Sales'))
const Marketing = lazy(() => import('@/pages/Marketing'))

function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/marketing" element={<Marketing />} />
      </Routes>
    </Suspense>
  )
}
```

### 4. Optimistic Updates

```typescript
// src/hooks/useOptimisticUpdate.ts
export function useOptimisticUpdate<T>() {
  const [data, setData] = useState<T[]>([])
  const [originalData, setOriginalData] = useState<T[]>([])

  const optimisticUpdate = async (
    id: string,
    updates: Partial<T>,
    updateFn: (id: string, updates: Partial<T>) => Promise<void>
  ) => {
    // Guardar estado original
    setOriginalData([...data])

    // Actualizar UI inmediatamente
    setData(prevData =>
      prevData.map(item =>
        (item as T & { id: string }).id === id ? { ...item, ...updates } : item
      )
    )

    try {
      // Actualizar en backend
      await updateFn(id, updates)
    } catch (error) {
      // Revertir en caso de error
      setData(originalData)
      throw error
    }
  }

  return { data, optimisticUpdate }
}
```

### 5. Virtual Scrolling

```typescript
// src/components/VirtualTable.tsx
import { useVirtualizer } from '@tanstack/react-virtual'

export function VirtualTable<T>({ data }: { data: T[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Altura estimada por fila
    overscan: 5 // Renderizar 5 items extra fuera de vista
  })

  return (
    <div ref={parentRef} className="h-screen overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`
            }}
          >
            {/* Renderizar fila */}
            <TableRow data={data[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 6. Índices de Firestore

```javascript
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "metrics",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "salesData",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" },
        { "fieldPath": "revenue", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 🎨 MANTENIBILIDAD

### 1. Estructura de Carpetas

```
src/
├── components/
│   ├── common/          # Componentes reutilizables
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── Modal.tsx
│   ├── dashboard/       # Específicos de dashboard
│   └── charts/          # Gráficos
├── hooks/               # Custom hooks
├── services/            # Servicios externos
├── utils/               # Utilidades puras
├── types/               # TypeScript types
└── lib/                 # Librerías internas
```

### 2. Naming Conventions

```typescript
// Components: PascalCase
export function UserProfile() {}

// Hooks: camelCase con prefijo 'use'
export function useAuth() {}

// Utils: camelCase
export function formatCurrency() {}

// Constants: UPPER_SNAKE_CASE
export const MAX_RETRIES = 3

// Types/Interfaces: PascalCase
export interface UserProfile {}
export type MetricType = 'revenue' | 'orders'
```

### 3. JSDoc para Funciones Públicas

```typescript
/**
 * Obtiene métricas paginadas para un usuario
 *
 * @param userId - ID del usuario
 * @param pageSize - Número de resultados por página
 * @param lastDoc - Último documento de la página anterior (opcional)
 * @returns Datos paginados con cursor para siguiente página
 * @throws {UnauthorizedError} Si el usuario no está autenticado
 * @throws {ValidationError} Si los parámetros son inválidos
 *
 * @example
 * ```typescript
 * const result = await getPaginatedMetrics('user123', 20)
 * console.log(result.data) // Array de métricas
 * ```
 */
export async function getPaginatedMetrics(
  userId: string,
  pageSize: number,
  lastDoc?: DocumentSnapshot
): Promise<PaginatedResult<Metric>> {
  // Implementation
}
```

### 4. Error Handling Centralizado

```typescript
// src/lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404)
  }
}

// Error Handler Global
export function handleError(error: unknown) {
  if (error instanceof AppError) {
    Logger.error(error.message, error)

    // Mostrar al usuario
    toast.error(error.message)
  } else if (error instanceof Error) {
    Logger.error('Unexpected error', error)
    toast.error('Ha ocurrido un error inesperado')
  }
}
```

### 5. Logging System

```typescript
// src/utils/logger.ts
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  meta?: Record<string, unknown>
}

export class Logger {
  private static logToConsole(entry: LogEntry) {
    const { timestamp, level, message, meta } = entry
    console[level](`[${timestamp}] ${level.toUpperCase()}: ${message}`, meta || '')
  }

  private static logToService(entry: LogEntry) {
    // En producción, enviar a servicio de logging
    if (import.meta.env.PROD && entry.level === LogLevel.ERROR) {
      // Enviar a Sentry, LogRocket, etc.
    }
  }

  static log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta
    }

    this.logToConsole(entry)
    this.logToService(entry)
  }

  static debug(message: string, meta?: Record<string, unknown>) {
    if (import.meta.env.DEV) {
      this.log(LogLevel.DEBUG, message, meta)
    }
  }

  static info(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, meta)
  }

  static warn(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, meta)
  }

  static error(message: string, error: Error, meta?: Record<string, unknown>) {
    this.log(LogLevel.ERROR, message, {
      error: error.message,
      stack: error.stack,
      ...meta
    })
  }
}
```

---

## ⚡ PERFORMANCE

### 1. Memoization

```typescript
import { memo, useMemo, useCallback } from 'react'

// Component memoization
export const ExpensiveComponent = memo(function ExpensiveComponent({ data }) {
  // Solo re-renderiza si 'data' cambia
  return <div>{/* render */}</div>
})

// Value memoization
function Dashboard({ metrics }) {
  const totalRevenue = useMemo(() => {
    return metrics.reduce((sum, m) => sum + m.value, 0)
  }, [metrics]) // Solo recalcular si metrics cambia

  return <div>{totalRevenue}</div>
}

// Function memoization
function Parent() {
  const handleClick = useCallback(() => {
    console.log('clicked')
  }, []) // Función estable, no se recrea

  return <Child onClick={handleClick} />
}
```

### 2. Debouncing & Throttling

```typescript
// src/utils/performance.ts
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>

  return function(...args: Parameters<T>) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return function(...args: Parameters<T>) {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// Uso
const handleSearch = debounce((query: string) => {
  searchMetrics(query)
}, 300)

const handleScroll = throttle(() => {
  updateScrollPosition()
}, 100)
```

### 3. Image Optimization

```typescript
// src/components/OptimizedImage.tsx
interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
}

export function OptimizedImage({ src, alt, width, height }: OptimizedImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy" // Lazy loading nativo
      decoding="async" // Decodificación asíncrona
      // Usar WebP si está disponible
      srcSet={`${src}?format=webp 1x, ${src}?format=webp&quality=80 2x`}
    />
  )
}
```

---

## 🧪 TESTING

### Estructura de Tests

```typescript
// src/services/__tests__/firestore.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FirestoreService } from '../firestore'

describe('FirestoreService', () => {
  let service: FirestoreService<Metric>

  beforeEach(() => {
    service = new FirestoreService('metrics')
  })

  afterEach(async () => {
    // Cleanup
  })

  describe('getById', () => {
    it('should return metric when it exists', async () => {
      const metric = await service.getById('metric123')
      expect(metric).toBeDefined()
      expect(metric?.id).toBe('metric123')
    })

    it('should return null when metric does not exist', async () => {
      const metric = await service.getById('nonexistent')
      expect(metric).toBeNull()
    })
  })

  describe('create', () => {
    it('should create metric with valid data', async () => {
      const data = { name: 'Revenue', value: 1000, userId: 'user123' }
      const id = await service.create(data)

      expect(id).toBeDefined()
      expect(typeof id).toBe('string')
    })

    it('should throw error with invalid data', async () => {
      const data = { name: '', value: -1, userId: '' }

      await expect(service.create(data)).rejects.toThrow()
    })
  })
})
```

---

## 📝 COMMITS & GIT

### Conventional Commits

```bash
# Formato: <type>(<scope>): <subject>

# Types:
feat: Nueva funcionalidad
fix: Corrección de bug
docs: Documentación
style: Formato (no afecta código)
refactor: Refactorización
test: Tests
chore: Mantenimiento

# Ejemplos:
git commit -m "feat(dashboard): add revenue chart"
git commit -m "fix(auth): resolve login redirect issue"
git commit -m "docs(readme): update setup instructions"
git commit -m "refactor(services): simplify firestore service"
git commit -m "test(metrics): add unit tests for metric service"
```

---

## ✅ CHECKLIST ANTES DE COMMIT

- [ ] Código compila sin errores
- [ ] Tests pasan
- [ ] Lint sin warnings
- [ ] TypeScript strict mode sin errores
- [ ] No hay console.log() en código de producción
- [ ] No hay TODOs sin JIRA/issue asociado
- [ ] Código documentado (JSDoc)
- [ ] Variables de entorno documentadas en .env.example

---

## 📦 BUNDLE SIZE

### Analizar Bundle

```bash
# Instalar analizador
npm install -D vite-bundle-visualizer

# Agregar a vite.config.ts
import { visualizer } from 'vite-bundle-visualizer'

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true })
  ]
})

# Build y analizar
npm run build
```

### Reducir Bundle Size

```typescript
// ❌ MAL - Importar toda la librería
import _ from 'lodash'

// ✅ BIEN - Importar solo lo necesario
import debounce from 'lodash/debounce'

// ❌ MAL - Importar iconos no usados
import * as Icons from '@heroicons/react/24/outline'

// ✅ BIEN - Importar específicos
import { UserIcon, HomeIcon } from '@heroicons/react/24/outline'
```

---

## 🚀 DEPLOYMENT

### Pre-deploy Checklist

- [ ] Variables de entorno configuradas
- [ ] Reglas de Firestore actualizadas
- [ ] Índices de Firestore creados
- [ ] Tests E2E pasando
- [ ] Performance auditada (Lighthouse)
- [ ] Security headers configurados
- [ ] Analytics configurado
- [ ] Error tracking configurado (Sentry)

---

## 📊 MONITORING

### Métricas Clave

1. **Performance**
   - Tiempo de carga inicial (< 3s)
   - Time to Interactive (< 5s)
   - Core Web Vitals (LCP, FID, CLS)

2. **Errores**
   - Tasa de error (< 1%)
   - Errores críticos por día
   - Tiempo de resolución

3. **Uso**
   - Usuarios activos diarios/mensuales
   - Sesiones por usuario
   - Retención (Day 1, Day 7, Day 30)

---

## 🎓 RECURSOS

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [React Performance](https://react.dev/learn/render-and-commit#optimizing-performance)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

---

**Última actualización**: 2025-11-21
**Versión**: 1.0

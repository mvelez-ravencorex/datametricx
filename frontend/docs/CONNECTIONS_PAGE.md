# Página de Integraciones (Connections)

## Resumen

La página de Integraciones permite a los usuarios conectar plataformas externas (Meta Ads, Google Analytics, Shopify, etc.) para importar datos a DataMetricX.

---

## Estructura de Archivos

```
src/
├── pages/
│   └── Connections.tsx              # Página principal
├── components/
│   └── connections/
│       ├── meta/                    # Componentes de Meta Ads (nuevo flujo)
│       │   ├── index.ts             # Exports centralizados
│       │   ├── MetaOAuthStep.tsx    # Paso 1: Conexión OAuth
│       │   ├── MetaConfigStep.tsx   # Paso 2: Configuración
│       │   ├── MetaStatusCard.tsx   # Card de estado
│       │   └── MetaAdsOnboarding.tsx # Orquestador del flujo
│       ├── MetaAdsConnectionModal.tsx # Modal antiguo (legacy)
│       └── SyncConfigModal.tsx      # Modal de config de sync
├── services/
│   └── datasourceService.ts         # CRUD de datasources en Firestore
└── types/
    └── connections.ts               # Tipos e interfaces
```

---

## Layout de la Página

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: "Integraciones"                        [Refrescar]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌─────────────────────────────────────────┐  │
│  │  SIDEBAR     │  │  CONTENIDO PRINCIPAL                    │  │
│  │  (w-64)      │  │  (flex-1)                               │  │
│  │              │  │                                         │  │
│  │  Plataformas │  │  Detalle de la plataforma seleccionada  │  │
│  │  ──────────  │  │                                         │  │
│  │  📘 Meta Ads │  │  - Nombre y descripción                 │  │
│  │  📊 GA4      │  │  - Estado de conexión                   │  │
│  │  🛍️ Shopify  │  │  - Información de última sync           │  │
│  │  🏪 Tienda.. │  │  - Botones de acción                    │  │
│  │  💛 ML       │  │                                         │  │
│  │  📦 Amazon   │  │                                         │  │
│  │  🎵 TikTok   │  │                                         │  │
│  │              │  │                                         │  │
│  └──────────────┘  └─────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flujo de Conexión de Meta Ads (Nuevo)

### Paso 1: OAuth (`MetaOAuthStep.tsx`)
- Dos modos: OAuth automático o manual
- OAuth: Redirige a Facebook para autorizar
- Manual: Usuario ingresa App ID, App Secret, Access Token, Ad Account ID
- **Output**: `{ secretId, adAccountId }`

### Paso 2: Configuración (`MetaConfigStep.tsx`)
- **start_date**: Fecha desde la cual importar datos (YYYY-MM-DD)
  - Mínimo: 7 días atrás
  - Máximo: 730 días (2 años, límite de Meta API)
  - Default: 180 días
- **frequency**: Frecuencia de sincronización
  - `daily`: Todos los días a las 6 AM, ventana de 7 días
  - `weekly`: Lunes a las 6 AM, ventana de 14 días
  - `monthly`: Día 1 a las 6 AM, ventana de 45 días

### Paso 3: Confirmación
- Muestra mensaje de éxito
- Explica qué pasará después (backfill inicial)

---

## Estructura en Firestore

### Ubicación
```
/tenants/{tenant_id}/datasources/meta_ads
```

### Documento (Nueva estructura con start_date)
```javascript
{
  // Identificación
  id: "meta_ads",
  tenantId: "xxx",
  platform: "meta_ads",
  name: "Meta Ads",

  // Campos del onboarding
  start_date: "2024-06-01",           // YYYY-MM-DD
  frequency: "daily",                  // daily | weekly | monthly

  // Campos de conexión
  connected: true,
  ad_account_id: "act_123456789",
  access_token_secret_id: "meta-credentials-xxx",
  secret_id: "meta-credentials-xxx",   // Alias para compatibilidad

  // Campos de estado (backend actualiza)
  status: "pending_initial_sync",      // Ver estados abajo
  initial_backfill_done: false,
  last_extraction: null,               // Timestamp
  last_extraction_records: null,       // Número
  last_error: null,                    // String

  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Estados posibles (`status`)
| Estado | Descripción |
|--------|-------------|
| `pending_initial_sync` | Esperando primera extracción |
| `syncing` | Extracción en progreso |
| `active` | Funcionando normalmente |
| `error` | Error en última extracción |
| `paused` | Usuario pausó la sincronización |

---

## Listener de Firestore

### Implementación
```typescript
useEffect(() => {
  if (!currentTenant) return

  const datasourcesRef = collection(db, 'tenants', currentTenant.id, 'datasources')

  const unsubscribe = onSnapshot(
    datasourcesRef,
    { includeMetadataChanges: false },
    (snapshot) => {
      // Solo recargar si hay cambios reales (no en la carga inicial)
      const changes = snapshot.docChanges()
      if (changes.length > 0 && changes.some(change => change.type === 'modified')) {
        loadDatasources()
      }
    }
  )

  return () => unsubscribe()
}, [currentTenant]) // ⚠️ NO incluir datasources aquí - causa loop infinito
```

### Importante
- **NO incluir `datasources` en el array de dependencias** - causa un loop infinito
- El listener solo debe depender de `currentTenant`
- Solo recargar cuando hay cambios de tipo `modified`, no en la carga inicial

---

## Tipos Principales

### MetaDatasourceConfig
```typescript
interface MetaDatasourceConfig {
  start_date: string              // YYYY-MM-DD
  frequency: 'daily' | 'weekly' | 'monthly'
  connected: boolean
  ad_account_id: string
  access_token_secret_id: string
  status: MetaDatasourceStatus
  initial_backfill_done: boolean
  last_extraction: Date | null
  last_extraction_records: number | null
  last_error: string | null
  next_scheduled_run?: Date | null
}
```

### MetaDatasourceStatus
```typescript
type MetaDatasourceStatus =
  | 'pending_initial_sync'
  | 'syncing'
  | 'active'
  | 'error'
  | 'paused'
```

---

## Constantes

### META_DATE_LIMITS
```typescript
const META_DATE_LIMITS = {
  MIN_DAYS_AGO: 7,      // Mínimo 7 días atrás
  MAX_DAYS_AGO: 730,    // Máximo 2 años
  DEFAULT_DAYS_AGO: 180 // Default 6 meses
}
```

### META_FREQUENCY_OPTIONS
```typescript
const META_FREQUENCY_OPTIONS = [
  {
    value: 'daily',
    label: 'Diaria',
    description: 'Actualiza todos los días a las 6:00 AM',
    syncWindow: 'Últimos 7 días'
  },
  {
    value: 'weekly',
    label: 'Semanal',
    description: 'Actualiza cada lunes a las 6:00 AM',
    syncWindow: 'Últimos 14 días'
  },
  {
    value: 'monthly',
    label: 'Mensual',
    description: 'Actualiza el día 1 de cada mes a las 6:00 AM',
    syncWindow: 'Últimos 45 días'
  }
]
```

---

## Servicios

### datasourceService.ts

#### Funciones para Meta Ads (nueva estructura)
```typescript
// Guardar configuración completa
saveMetaDatasourceConfig(tenantId: string, config: MetaDatasourceConfig): Promise<void>

// Obtener configuración
getMetaDatasourceConfig(tenantId: string): Promise<MetaDatasourceConfig | null>

// Actualizar configuración parcial
updateMetaDatasourceConfig(tenantId: string, updates: Partial<MetaDatasourceConfig>): Promise<void>
```

#### Funciones genéricas (legacy)
```typescript
createDatasource(tenantId, datasourceId, config)
updateDatasource(tenantId, datasourceId, updates)
deleteDatasource(tenantId, datasourceId)
getTenantDatasources(tenantId)
```

---

## Migración de backfill_days a start_date

### Antes (legacy)
```javascript
{
  backfill_days: 180  // Número de días hacia atrás
}
```

### Después (nuevo)
```javascript
{
  start_date: "2024-06-01"  // Fecha explícita YYYY-MM-DD
}
```

### Razón del cambio
- `start_date` es más explícito y fácil de entender para el usuario
- Permite al usuario ver exactamente desde cuándo se importarán datos
- El backend calcula los días automáticamente

---

## Pipeline Runs (Subcolección)

Los logs de cada corrida de pipeline se guardan en una **subcolección** en lugar de un array dentro del documento del datasource. Esto permite:
- Sin límite de historial (documentos de Firestore tienen límite de 1MB)
- Queries más eficientes (no cargar todos los logs al leer el datasource)
- Mejor paginación

### Ubicación
```
/tenants/{tenantId}/datasources/{datasourceId}/pipeline_runs/{runId}
```

### Documento PipelineRun
```javascript
{
  id: "auto-generated",           // ID del documento
  jobId: "job-123456",            // ID del job en Cloud Run

  // Estado
  status: "completed",            // running | completed | failed | cancelled
  type: "scheduled",              // manual | scheduled | backfill

  // Tiempos
  startedAt: Timestamp,
  completedAt: Timestamp,
  duration: 45,                   // Segundos

  // Resultados
  recordsProcessed: 1500,
  recordsInserted: 1200,
  recordsUpdated: 300,

  // Errores (si aplica)
  errorMessage: null,
  errorCode: null,
  errorDetails: null,

  // Metadatos
  triggeredBy: "user-uid",        // Solo si type = manual
  dateRange: {                    // Rango procesado
    start: "2024-01-01",
    end: "2024-06-01"
  },

  // Logs (opcional, max 100)
  logs: [
    { timestamp: Timestamp, level: "info", message: "Starting..." },
    { timestamp: Timestamp, level: "info", message: "Fetching data..." }
  ]
}
```

### Tipos TypeScript
```typescript
type PipelineRunStatus = 'running' | 'completed' | 'failed' | 'cancelled'
type PipelineRunType = 'manual' | 'scheduled' | 'backfill'

interface PipelineRun {
  id: string
  jobId: string
  status: PipelineRunStatus
  type: PipelineRunType
  startedAt: Date
  completedAt?: Date
  duration?: number
  recordsProcessed?: number
  recordsInserted?: number
  recordsUpdated?: number
  errorMessage?: string
  errorCode?: string
  errorDetails?: string
  triggeredBy?: string
  dateRange?: { start: string; end: string }
  logs?: PipelineRunLog[]
}

interface PipelineRunsSummary {
  totalRuns: number
  successfulRuns: number
  failedRuns: number
  lastRun?: PipelineRun
  lastSuccessfulRun?: PipelineRun
}
```

### Funciones del Servicio
```typescript
// Crear nueva corrida
createPipelineRun(tenantId, datasourceId, {
  jobId: string,
  type: 'manual' | 'scheduled' | 'backfill',
  triggeredBy?: string,
  dateRange?: { start: string, end: string }
}): Promise<string>

// Actualizar corrida al completar/fallar
updatePipelineRun(tenantId, datasourceId, jobId, {
  status: 'completed' | 'failed' | 'cancelled',
  recordsProcessed?: number,
  recordsInserted?: number,
  recordsUpdated?: number,
  errorMessage?: string,
  errorCode?: string,
  errorDetails?: string
}): Promise<void>

// Obtener corridas (ordenadas por fecha, más recientes primero)
getPipelineRuns(tenantId, datasourceId, maxResults = 20): Promise<PipelineRun[]>

// Obtener una corrida específica
getPipelineRun(tenantId, datasourceId, runId): Promise<PipelineRun | null>

// Obtener resumen para UI
getPipelineRunsSummary(tenantId, datasourceId): Promise<PipelineRunsSummary>

// Agregar log a corrida en ejecución
addPipelineRunLog(tenantId, datasourceId, jobId, {
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  data?: Record<string, any>
}): Promise<void>
```

### Migración desde syncHistory (Legacy)

Las funciones antiguas siguen funcionando pero están **deprecated**:
- `addSyncHistoryEntry` → usar `createPipelineRun`
- `updateSyncHistoryEntry` → usar `updatePipelineRun`
- `getSyncHistory` → usar `getPipelineRuns`

---

## Notas Importantes

1. **Ventana de 48h de Meta**: Meta puede ajustar métricas hasta 48 horas después. Por eso siempre re-extraemos los últimos 7 días (daily).

2. **Deduplicación**: El backend maneja la deduplicación. Si hay datos duplicados, se conserva el más reciente.

3. **Límite de 2 años**: La API de Meta solo permite extraer datos de los últimos 730 días.

4. **Primera sincronización**: Puede tomar varios minutos dependiendo del rango de fechas.

5. **Cambio de start_date**: Si el usuario cambia la fecha hacia atrás, se debe hacer un nuevo backfill.

6. **Pipeline Runs**: Los logs se guardan en subcolección `/pipeline_runs` para no sobrecargar el documento principal.

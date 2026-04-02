# API Reference - DataMetricX

Referencia rápida de todos los endpoints y servicios del frontend.

## Backend API

**Base URL**: `https://backend-api-jrzfm3jccq-uc.a.run.app`

### Autenticación

Todos los endpoints requieren el header:
```
Authorization: Bearer {firebase_id_token}
```

### Endpoints

#### Auth

| Método | Endpoint | Descripción | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/api/auth/set-claims` | Configura custom claims (tenant_id) | `{ tenantId: string }` | `{ success, message, tenant_id, user_uid }` |

#### Secrets (Credenciales)

| Método | Endpoint | Descripción | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/api/secrets/meta` | Guarda credenciales Meta Ads | `{ credentials: {...} }` | `{ success, secret_id, message }` |
| POST | `/api/secrets/ga4` | Guarda credenciales GA4 | `{ credentials: {...} }` | `{ success, secret_id, message }` |
| POST | `/api/secrets/shopify` | Guarda credenciales Shopify | `{ credentials: {...} }` | `{ success, secret_id, message }` |
| POST | `/api/secrets/tiendanube` | Guarda credenciales Tiendanube | `{ credentials: {...} }` | `{ success, secret_id, message }` |
| POST | `/api/secrets/mercadolibre` | Guarda credenciales MercadoLibre | `{ credentials: {...} }` | `{ success, secret_id, message }` |
| POST | `/api/secrets/tiktok` | Guarda credenciales TikTok Ads | `{ credentials: {...} }` | `{ success, secret_id, message }` |
| DELETE | `/api/secrets/{datasource}/{tenant_id}` | Elimina credenciales | - | `{ success, message }` |

#### Ingest (Sincronización)

| Método | Endpoint | Descripción | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/api/ingest/run-now` | Ejecuta sincronización manual | `{ tenantId, datasourceId, datasource }` | `{ job_id, status, message }` |
| POST | `/api/ingest/backfill` | Ejecuta backfill de datos históricos | `{ tenantId, datasourceId, platform, startDate, endDate }` | `{ job_id, status, dateRange, estimatedDays }` |
| GET | `/api/ingest/status/{job_id}` | Obtiene estado de sincronización | - | `{ job_id, status, progress, recordsProcessed, error }` |

#### Semantic Layer (Capa Semántica)

| Método | Endpoint | Descripción | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/semantic/providers` | Lista proveedores disponibles | - | `{ providers: string[] }` |
| GET | `/api/semantic/entities?provider=X` | Lista entities de un proveedor | - | `{ entities: Entity[] }` |
| GET | `/api/semantic/entities/{id}/schema?provider=X` | Schema de una entity | - | `{ entity, attributes, metrics }` |
| GET | `/api/semantic/datasets?provider=X` | Lista datasets de un proveedor | - | `Dataset[]` |
| POST | `/api/semantic/query` | Ejecuta consulta semántica | `QueryRequest` | `{ columns, rows, sql, metadata }` |
| POST | `/api/semantic/dry-run` | Preview SQL sin ejecutar | `QueryRequest` | `{ sql, estimated_bytes }` |
| GET | `/api/semantic/models/tree` | Árbol de archivos (IDE) | - | `{ success, data: FileTreeNode[], meta }` |
| GET | `/api/semantic/models/file?path=X` | Contenido de archivo | - | `{ success, path, data }` |
| PUT | `/api/semantic/models/file` | Guarda archivo **(SysOwner)** | `{ path, content }` | `{ success, message, path }` |
| DELETE | `/api/semantic/models/file?path=X` | Elimina archivo **(SysOwner)** | - | `{ success, message }` |

---

## Frontend Services

### apiService.ts

Ubicación: `/src/services/apiService.ts`

```typescript
// Autenticación
setUserClaims(request: { tenantId: string }): Promise<SetUserClaimsResponse>

// Credenciales
saveCredentials(request: SaveCredentialsRequest): Promise<SaveCredentialsResponse>
renewCredentials(tenantId, platform, secretId, newCredentials): Promise<SaveCredentialsResponse>
validateCredentials(request: ValidateCredentialsRequest): Promise<ValidateCredentialsResponse>
deleteSecret(request: DeleteSecretRequest): Promise<DeleteSecretResponse>

// Sincronización
runSyncNow(request: SyncNowRequest): Promise<SyncNowResponse>
getSyncStatus(jobId: string): Promise<SyncStatusResponse>
runBackfill(request: BackfillRequest): Promise<BackfillResponse>

// OAuth
exchangeMetaAuthCode(request: MetaOAuthRequest): Promise<MetaOAuthResponse>
```

### tenantService.ts

Ubicación: `/src/services/tenantService.ts`

```typescript
// CRUD Tenant
createTenant(name, ownerUid, ownerEmail, plan?): Promise<string>
getTenant(tenantId: string): Promise<Tenant | null>
getUserTenants(uid: string): Promise<Tenant[]>
updateTenant(tenantId, updates): Promise<void>

// Members
getTenantMembers(tenantId: string): Promise<TenantMember[]>
getTenantMember(tenantId, uid): Promise<TenantMember | null>
addTenantMember(tenantId, member): Promise<void>

// Datasources
getTenantDataSources(tenantId: string): Promise<DataSource[]>
getTenantDataSource(tenantId, datasourceId): Promise<DataSource | null>
upsertTenantDataSource(tenantId, datasourceId, datasource): Promise<void>

// Dashboards
getTenantDashboards(tenantId: string): Promise<Dashboard[]>

// Settings
getTenantSettings(tenantId: string): Promise<TenantSettings | null>
updateTenantSettings(tenantId, settings): Promise<void>
```

### datasourceService.ts

Ubicación: `/src/services/datasourceService.ts`

```typescript
// Pipeline Runs (subcollection)
createPipelineRun(tenantId, datasourceId, run): Promise<string>
updatePipelineRun(tenantId, datasourceId, runId, updates): Promise<void>
getPipelineRuns(tenantId, datasourceId, options?): Promise<{ runs, lastDoc }>
getPipelineRunsSummary(tenantId, datasourceId): Promise<PipelineRunsSummary>
```

### semanticService.ts

Ubicación: `/src/services/semanticService.ts`

```typescript
// Providers
getProviders(): Promise<string[]>

// Entities
getEntitiesByProvider(provider: string): Promise<EntitiesListResponse>
getEntitySchema(entityId, provider): Promise<EntitySchemaResponse>
getEntity(entityId, provider): Promise<SemanticEntity>

// Datasets
getDatasetsByProvider(provider: string): Promise<SemanticDataset[]>
getDataset(datasetId, provider): Promise<SemanticDataset>

// Query Execution
executeQuery(request: QueryRequest): Promise<QueryResponse>
dryRunQuery(request: QueryRequest): Promise<{ sql, estimated_bytes }>

// File Management (Development IDE)
getModelsTree(): Promise<FileTreeResponse>
getFileContent(path: string): Promise<FileContentResponse>
saveFileContent(path, content): Promise<{ success, message, path }>  // SysOwner only
deleteFile(path: string): Promise<{ success, message }>              // SysOwner only
```

---

## Tipos Principales

### Request/Response Types

```typescript
// Auth
interface SetUserClaimsRequest {
  tenantId: string
}

interface SetUserClaimsResponse {
  success: boolean
  message: string
}

// Credentials
interface SaveCredentialsRequest {
  tenantId: string
  platform: string
  credentials: Record<string, any>
}

interface SaveCredentialsResponse {
  success: boolean
  secret_id: string
  message: string
}

// Sync
interface SyncNowRequest {
  tenantId: string
  datasourceId: string
  datasource: string  // meta, tiktok, shopify, ga4, etc.
}

interface SyncNowResponse {
  job_id: string
  status: 'started' | 'queued'
  message: string
}

interface SyncStatusResponse {
  job_id: string
  status: 'running' | 'completed' | 'failed' | 'queued'
  progress?: number
  recordsProcessed?: number
  error?: string
  startedAt?: string
  completedAt?: string
}
```

### Firestore Types

```typescript
interface Tenant {
  id: string
  name: string
  slug: string
  owner_uid: string
  plan: PlanType
  billing_status: 'active' | 'past_due' | 'cancelled'
  features: PlanFeatures
  datasource_status: Record<string, 'connected' | 'disconnected' | 'error'>
  createdAt: Date
  updatedAt: Date
}

interface TenantMember {
  uid: string
  email: string
  role: 'owner' | 'admin' | 'user'
  status: 'active' | 'invited' | 'inactive'
  joinedAt: Date
}

interface DataSource {
  id: string
  platform: string
  connected: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  start_date?: string
  secret_id?: string
  access_token_secret_id?: string
  status: 'active' | 'paused' | 'error'
  last_sync_at?: Date
  createdAt: Date
  updatedAt: Date
}

interface PipelineRun {
  id: string
  jobId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  type: 'manual' | 'scheduled' | 'backfill'
  startedAt: Date
  completedAt?: Date
  duration?: number
  recordsProcessed?: number
  error?: string
  metadata?: Record<string, any>
}
```

---

## Mapeo de Plataformas

### Frontend → Backend

```typescript
const PLATFORM_ENDPOINTS = {
  'meta_ads': 'meta',
  'google_analytics_4': 'ga4',
  'shopify': 'shopify',
  'tiendanube': 'tiendanube',
  'mercadolibre': 'mercadolibre',
  'tiktok_ads': 'tiktok'
}

const PLATFORM_TO_DATASOURCE = {
  'meta-ads': 'meta',
  'tiktok': 'tiktok',
  'shopify': 'shopify',
  'google-analytics-4': 'ga4',
  'tiendanube': 'tiendanube',
  'mercadolibre': 'mercadolibre',
  'amazon': 'amazon',
  'google-ads': 'google-ads'
}
```

---

## Estructura Firestore

```
/users/{uid}
  - tenantId
  - activeTenant
  - email
  - displayName

/tenants/{tenantId}
  - name, slug, owner_uid
  - plan, billing_status, features
  - datasource_status

  /members/{uid}
    - email, role, status, joinedAt

  /datasources/{datasourceId}
    - platform, connected, frequency
    - start_date, secret_id
    - status, last_sync_at

    /pipeline_runs/{runId}
      - jobId, status, type
      - startedAt, completedAt
      - recordsProcessed, error

  /dashboards/{dashboardId}
    - name, widgets, layout

  /settings/general
    - timezone, currency, language
```

---

## Variables de Entorno

```bash
# Backend API
VITE_API_BASE_URL=https://backend-api-jrzfm3jccq-uc.a.run.app

# Firebase
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=datametricx-prod.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=datametricx-prod
VITE_FIREBASE_STORAGE_BUCKET=datametricx-prod.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

---

## Códigos de Error Comunes

| Código | Mensaje | Causa | Solución |
|--------|---------|-------|----------|
| 401 | Unauthorized | Token inválido o expirado | Refrescar token con `getIdToken(true)` |
| 403 | Forbidden | Sin permiso para el recurso | Verificar membership del tenant |
| 404 | Not Found | Recurso no existe | Verificar IDs de tenant/datasource |
| 400 | Bad Request | Payload inválido | Verificar campos requeridos |
| 500 | Internal Server Error | Error del backend | Revisar logs del backend |

---

**Última actualización**: 2025-12-03

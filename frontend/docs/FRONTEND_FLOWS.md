# Frontend Flows - DataMetricX

Este documento describe los 3 flujos principales que implementa el frontend para la gestión de datasources e integraciones con plataformas externas.

## 📋 Resumen de Flujos

| Flujo | Nombre | Cuándo Ocurre | Tecnologías |
|-------|--------|---------------|-------------|
| FRONT 1 | Configurar Datasource | Al ajustar config (frecuencia, horario, backfill) | Firestore |
| FRONT 2 | Guardar Credenciales | Al conectar datasource o renovar token | OAuth + Backend API + Secret Manager |
| FRONT 3 | Sync Now | Cuando usuario presiona "Ejecutar ahora" | Backend API + Cloud Run Jobs |

---

## 🔵 FRONT 1 - Configurar Datasource en Firestore

### ¿Qué hace?
Guarda o actualiza la configuración de un datasource en Firestore **sin incluir credenciales sensibles**.

### ¿Cuándo ocurre?
- Al crear un nuevo datasource
- Al editar configuración existente (frecuencia, horario, backfill)
- Después de completar FRONT 2 (guardar credenciales)

### Flujo de Datos

```
Usuario → MetaAdsConnectionModal → handleSaveMetaAds() → datasourceService
                                                              ↓
                                                    /tenants/{tenantId}/
                                                     datasources/{sourceId}
```

### Estructura en Firestore

```typescript
/tenants/{tenantId}/datasources/{sourceId}
{
  id: string
  name: string
  platform: 'meta-ads' | 'shopify' | ...
  
  // 🔐 NO guarda credenciales directas
  secret_id: string  // Referencia a Secret Manager
  
  // ⚙️ Configuración de sincronización
  syncFrequency: 'daily' | 'weekly' | 'monthly' | ...
  syncTime: string  // "03:00" (UTC)
  syncStatus: 'ok' | 'error' | 'pending' | 'never-run'
  
  // 📊 Backfill
  backfillEnabled: boolean
  backfillStartDate?: string  // "2024-01-01"
  backfillEndDate?: string
  
  // Metadata (NO sensible)
  adAccountId?: string  // Para mostrar en UI
  
  // Timestamps
  createdAt: Timestamp
  updatedAt: Timestamp
  lastSyncAt?: Timestamp
}
```

### Archivos Involucrados

| Archivo | Función |
|---------|---------|
| `services/datasourceService.ts` | CRUD operations en Firestore |
| `components/connections/MetaAdsConnectionModal.tsx` | UI para configurar |
| `pages/Connections.tsx` | Orquesta el flujo completo |
| `types/connections.ts` | Tipos de datasources |

### Ejemplo de Código

```typescript
// En Connections.tsx
const handleSaveMetaAds = async (setup: DatasourceSetup) => {
  const config: DatasourceConfig = {
    name: setup.name,
    platform: 'meta-ads',
    secret_id: setup.secret_id,  // Ya viene de FRONT 2
    syncFrequency: setup.syncFrequency,
    syncTime: setup.syncTime,
    backfillEnabled: setup.backfillEnabled
  }
  
  await createDatasource(currentTenant.id, datasourceId, config)
}
```

---

## 🔵 FRONT 2 - Guardar Credenciales (OAuth)

### ¿Qué hace?
1. Usuario hace login OAuth con la plataforma (Meta, Google, etc.)
2. Frontend recibe código de autorización
3. Frontend llama al backend
4. Backend intercambia el código por access token
5. Backend guarda el token en Secret Manager
6. Backend devuelve `secret_id`
7. Frontend guarda `secret_id` en Firestore (vía FRONT 1)

### ¿Cuándo ocurre?
- Al conectar un datasource por primera vez
- Al renovar credenciales expiradas

### Flujo de Datos

```
Usuario → Clic "Conectar con Meta"
   ↓
oauthService.connectMetaAds(tenantId)
   ↓
Abre popup → OAuth de Meta → Código de autorización
   ↓
apiService.exchangeMetaAuthCode({ tenantId, code })
   ↓
Backend API: POST /api/oauth/meta/exchange
   ↓
Backend → Meta API (intercambia código por token)
   ↓
Backend → Secret Manager (guarda token)
   ↓
Backend → Frontend: { secret_id: "projects/.../secrets/..." }
   ↓
Frontend guarda secret_id en Firestore (FRONT 1)
```

### Dos Modos de Conexión

#### Modo OAuth (Recomendado)
```typescript
// En MetaAdsConnectionModal.tsx
const handleOAuthConnect = async () => {
  const result = await connectMetaAds(tenantId)
  // result.secret_id → Guardar en Firestore
  setSecretId(result.secret_id)
  setIsConnected(true)
}
```

#### Modo Manual (Alternativo)
```typescript
// Usuario ingresa access token manualmente
const handleManualConnect = async () => {
  const result = await connectMetaAdsManual(tenantId, {
    accessToken: '...',
    adAccountId: 'act_123'
  })
  setSecretId(result.secret_id)
}
```

### Archivos Involucrados

| Archivo | Función |
|---------|---------|
| `services/oauthService.ts` | Maneja popup OAuth y callbacks |
| `services/apiService.ts` | Llama endpoints del backend |
| `pages/OAuthCallback.tsx` | Página de callback (recibe código) |
| `components/connections/MetaAdsConnectionModal.tsx` | UI del flujo |

### Endpoints del Backend Requeridos

```typescript
POST /api/credentials/save
{
  tenantId: string
  platform: string
  credentials: Record<string, any>
}
→ Response: { secret_id: string }

POST /api/oauth/meta/exchange
{
  tenantId: string
  code: string
  redirectUri: string
}
→ Response: { secret_id: string, adAccountId: string }
```

### Seguridad

✅ **NUNCA se guardan credenciales en Firestore**
✅ Solo se guarda `secret_id` (referencia a Secret Manager)
✅ Backend valida permisos antes de guardar
✅ Tokens se encriptan en Secret Manager

---

## 🔵 FRONT 3 - Sync Now (Ejecución Manual)

### ¿Qué hace?
Ejecuta una sincronización manual inmediata de un datasource específico.

### ¿Cuándo ocurre?
- Usuario presiona botón "Sync Now" (ícono ▶️)
- Útil para probar una nueva integración
- O forzar actualización de datos

### Flujo de Datos

```
Usuario → Clic botón Sync Now
   ↓
handleSyncNow(datasource)
   ↓
apiService.runSyncNow({
  tenantId,
  datasourceId,
  platform
})
   ↓
Backend API: POST /api/ingest/run-now
   ↓
Backend dispara Cloud Run Job
   ↓
Job ejecuta ingesta de datos
   ↓
Backend actualiza sync status en Firestore
   ↓
Frontend muestra notificación con job_id
```

### UI del Botón

```tsx
{/* En Connections.tsx */}
<button
  onClick={() => handleSyncNow(datasource)}
  disabled={syncingDatasources.has(datasource.id)}
  className="bg-green-50 text-green-600"
>
  {syncingDatasources.has(datasource.id) ? (
    <div className="animate-spin ...">Loading</div>
  ) : (
    <PlayIcon className="h-5 w-5" />
  )}
</button>
```

### Implementación

```typescript
// En Connections.tsx
const handleSyncNow = async (datasource: Connection) => {
  setSyncingDatasources(prev => new Set(prev).add(datasource.id))
  
  const result = await runSyncNow({
    tenantId: currentTenant.id,
    datasourceId: datasource.id,
    platform: datasource.platform
  })
  
  // Mostrar notificación con job_id
  setNotification({
    type: 'info',
    message: `Sincronización iniciada. Job ID: ${result.job_id}`
  })
  
  // TODO: Implementar polling para actualizar estado
}
```

### Endpoint del Backend Requerido

```typescript
POST /api/ingest/run-now
{
  tenantId: string
  datasourceId: string
  platform: string
}
→ Response: {
  job_id: string
  status: 'started' | 'queued'
  message: string
}
```

### Tracking de Estado

El frontend puede hacer polling al endpoint:
```typescript
GET /api/ingest/status/{job_id}
→ Response: {
  job_id: string
  status: 'running' | 'completed' | 'failed'
  progress?: number
  recordsProcessed?: number
}
```

---

## 🔄 Integración Entre Flujos

### Flujo Completo al Conectar un Datasource

1. **Usuario abre modal** → `MetaAdsConnectionModal`

2. **FRONT 2: Conectar**
   - Usuario hace OAuth o ingresa credenciales
   - Frontend llama backend
   - Backend guarda en Secret Manager
   - Frontend recibe `secret_id`

3. **Usuario configura** (en el mismo modal)
   - Nombre de la integración
   - Frecuencia de sincronización
   - Hora de ejecución
   - Backfill (opcional)

4. **FRONT 1: Guardar Configuración**
   - Frontend guarda todo en Firestore
   - Incluyendo el `secret_id` de FRONT 2

5. **Usuario puede ejecutar FRONT 3** (opcional)
   - Hacer clic en "Sync Now"
   - Probar que la integración funciona

### Diagrama de Flujo

```
┌─────────────────────────────────────────────┐
│  Usuario: "Conectar Meta Ads"              │
└──────────────────┬──────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │   FRONT 2         │
         │  OAuth + Backend  │
         │                   │
         │  → secret_id      │
         └─────────┬─────────┘
                   │
         ┌─────────▼──────────┐
         │  Usuario configura │
         │  - Frecuencia      │
         │  - Horario         │
         │  - Backfill        │
         └─────────┬──────────┘
                   │
         ┌─────────▼─────────┐
         │   FRONT 1         │
         │  Guardar en       │
         │  Firestore        │
         └─────────┬─────────┘
                   │
                   ▼
         ┌─────────────────┐
         │ Datasource listo│
         │ para sincronizar│
         └────────┬─────────┘
                  │
      (Opcional)  │
         ┌────────▼────────┐
         │   FRONT 3       │
         │  Sync Now       │
         │  (Test manual)  │
         └─────────────────┘
```

---

## 📁 Estructura de Archivos

```
frontend/src/
├── services/
│   ├── apiService.ts          # FRONT 2, FRONT 3: Llamadas al backend
│   ├── oauthService.ts         # FRONT 2: Flujo OAuth
│   └── datasourceService.ts    # FRONT 1: CRUD en Firestore
│
├── components/connections/
│   ├── MetaAdsConnectionModal.tsx   # FRONT 1 + FRONT 2: UI completa
│   └── SyncConfigModal.tsx          # FRONT 1: Editar frecuencia/hora
│
├── pages/
│   ├── Connections.tsx         # Orquesta FRONT 1, 2, 3
│   └── OAuthCallback.tsx       # FRONT 2: Recibe código OAuth
│
└── types/
    └── connections.ts          # Tipos para todos los flujos
```

---

## 🔧 Variables de Entorno Necesarias

```bash
# Backend
VITE_API_BASE_URL=http://localhost:8080

# OAuth Meta
VITE_META_APP_ID=your_app_id
VITE_META_REDIRECT_URI=http://localhost:5173/oauth/meta/callback

# OAuth Google
VITE_GA4_CLIENT_ID=your_client_id.apps.googleusercontent.com

# OAuth Shopify
VITE_SHOPIFY_API_KEY=your_api_key
```

Ver `.env.example` para lista completa.

---

## ✅ Testing

### FRONT 1
```typescript
// Test: Crear datasource
await createDatasource(tenantId, 'meta-123', {
  name: 'Test Meta',
  platform: 'meta-ads',
  secret_id: 'projects/.../secrets/meta-test',
  syncFrequency: 'daily',
  syncTime: '03:00'
})

// Verificar en Firestore:
// /tenants/{tenantId}/datasources/meta-123
```

### FRONT 2
```typescript
// Test: OAuth manual (para desarrollo)
const result = await connectMetaAdsManual(tenantId, {
  accessToken: 'EAA...',
  adAccountId: 'act_123'
})
console.log(result.secret_id)  // Debe devolver secret_id
```

### FRONT 3
```typescript
// Test: Sync Now
const result = await runSyncNow({
  tenantId,
  datasourceId: 'meta-123',
  platform: 'meta-ads'
})
console.log(result.job_id)  // Debe devolver job_id
```

---

## 🚨 Errores Comunes

### FRONT 1
- ❌ **Error**: No se guarda en Firestore
  - ✅ **Solución**: Verificar reglas de Firestore (isTenantMember)

### FRONT 2
- ❌ **Error**: "OAuth cancelado por el usuario"
  - ✅ **Solución**: Usuario cerró el popup antes de completar
- ❌ **Error**: "META_APP_ID no configurado"
  - ✅ **Solución**: Agregar variable en `.env`

### FRONT 3
- ❌ **Error**: "Backend no responde"
  - ✅ **Solución**: Verificar que backend esté corriendo
  - ✅ **Solución**: Verificar VITE_API_BASE_URL

---

## 📚 Referencias

- [Meta Marketing API](https://developers.facebook.com/docs/marketing-api)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Firebase Firestore](https://firebase.google.com/docs/firestore)
- [Google Secret Manager](https://cloud.google.com/secret-manager/docs)

# Meta Ads Onboarding - Especificación Frontend

## Resumen

Este documento describe los campos que el frontend debe capturar durante el onboarding de Meta Ads y cómo el backend procesa esta información.

---

## ⚠️ IMPORTANTE: Campos que NO se necesitan

Los siguientes campos **NO deben guardarse** en Firestore porque el backend los calcula/maneja automáticamente:

| Campo | Por qué NO es necesario |
|-------|------------------------|
| `time_utc` | Los Cloud Schedulers ya están configurados (6:00 AM UTC). No es configurable por tenant. |
| `backfill_days` | Se **calcula automáticamente** basado en `start_date` e `initial_backfill_done` |

**El backend calcula `backfill_days` así:**
- Primera extracción: `días desde start_date hasta hoy` (máximo 730)
- Extracciones posteriores: ventana fija según `frequency` (daily=7, weekly=14, monthly=45)

---

## Credenciales en Secret Manager (REQUERIDO)

El access token de Meta **DEBE** guardarse en Google Secret Manager, NO directamente en Firestore.

### Nombre del Secret
```
meta-credentials-{tenant_id}
```

**Ejemplo:** `meta-credentials-hKK8VBrVMGWK1RN8d8w8`

### Contenido del Secret (JSON)
```json
{
  "access_token": "EAAxxxxxxxxx...",
  "token_type": "bearer",
  "expires_at": "2025-12-29T00:00:00Z"
}
```

### Pasos para crear el Secret

#### Opción 1: Usando Cloud Function (Recomendado)

Crear una Cloud Function que el frontend llame después del OAuth:

```typescript
// Frontend: después de obtener el token de Meta OAuth
const response = await fetch('/api/datasources/meta/store-credentials', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tenant_id: tenantId,
    access_token: metaAccessToken,
    expires_at: tokenExpiresAt
  })
});

// La Cloud Function crea el secret y retorna success
const { success, secret_id } = await response.json();
```

#### Opción 2: Usando Firebase Admin SDK (Backend)

```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

async function storeMetaCredentials(tenantId: string, accessToken: string) {
  const client = new SecretManagerServiceClient();
  const projectId = 'datametricx-prod';
  const secretId = `meta-credentials-${tenantId}`;

  const secretData = JSON.stringify({
    access_token: accessToken,
    token_type: 'bearer',
    created_at: new Date().toISOString()
  });

  // Crear el secret
  try {
    await client.createSecret({
      parent: `projects/${projectId}`,
      secretId: secretId,
      secret: {
        replication: { automatic: {} }
      }
    });
  } catch (e) {
    // Secret ya existe, continuar
  }

  // Agregar versión con el token
  await client.addSecretVersion({
    parent: `projects/${projectId}/secrets/${secretId}`,
    payload: {
      data: Buffer.from(secretData)
    }
  });

  return secretId;
}
```

#### Opción 3: Usando gcloud CLI (Solo para testing)

```bash
# Crear el secret
echo '{"access_token":"EAAxxxx..."}' | \
  gcloud secrets create meta-credentials-{tenant_id} \
    --data-file=- \
    --project=datametricx-prod

# O actualizar versión existente
echo '{"access_token":"EAAxxxx..."}' | \
  gcloud secrets versions add meta-credentials-{tenant_id} \
    --data-file=- \
    --project=datametricx-prod
```

### Permisos Requeridos

La Service Account del worker (`worker-sa@datametricx-prod.iam.gserviceaccount.com`) ya tiene permisos para leer secrets.

Para que el frontend/Cloud Function pueda **crear** secrets, necesita:
- `roles/secretmanager.admin` o
- `secretmanager.secrets.create` + `secretmanager.versions.add`

---

## Campos a Capturar en Onboarding

### 1. Fecha de Inicio de Datos (`start_date`)

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `start_date` | `DATE` (YYYY-MM-DD) | Sí | Fecha desde la cual el usuario quiere importar datos históricos |

**UI Sugerida:**
```
📅 ¿Desde qué fecha quieres importar tus datos de Meta Ads?

[Selector de fecha]

💡 Recomendamos al menos 6 meses de historial para análisis efectivo.
   Máximo permitido: 2 años hacia atrás.
```

**Validaciones:**
- Mínimo: 7 días atrás
- Máximo: 730 días atrás (2 años - límite de Meta API)
- Default sugerido: 180 días atrás

---

### 2. Frecuencia de Actualización (`frequency`)

| Campo | Tipo | Requerido | Opciones |
|-------|------|-----------|----------|
| `frequency` | `STRING` | Sí | `daily`, `weekly`, `monthly` |

**UI Sugerida:**
```
🔄 ¿Con qué frecuencia quieres actualizar tus datos?

○ Diaria (recomendado para campañas activas)
   Actualiza todos los días a las 6:00 AM

○ Semanal
   Actualiza cada lunes a las 6:00 AM

○ Mensual
   Actualiza el día 1 de cada mes a las 6:00 AM
```

**Comportamiento por frecuencia:**

| Frecuencia | Scheduler | Ventana de datos | Uso recomendado |
|------------|-----------|------------------|-----------------|
| `daily` | Todos los días 6 AM | Últimos 7 días | Campañas activas, optimización diaria |
| `weekly` | Lunes 6 AM | Últimos 14 días | Reportes semanales, campañas estables |
| `monthly` | Día 1, 6 AM | Últimos 45 días | Reportes mensuales, análisis histórico |

---

## Estructura en Firestore

### Ubicación
```
/tenants/{tenant_id}/datasources/meta-{accountId}
```

**Nota:** El documento se nombra `meta-{accountId}` (ej: `meta-741094088319935`), NO `meta_ads`.

### Documento a crear/actualizar

```javascript
{
  // ═══════════════════════════════════════════════════════════════
  // CAMPOS REQUERIDOS - Frontend DEBE escribir estos
  // ═══════════════════════════════════════════════════════════════

  "connected": true,                     // REQUERIDO: Marca datasource como activo
  "ad_account_id": "act_123456789",      // REQUERIDO: ID de cuenta de anuncios
  "start_date": "2024-06-01",            // REQUERIDO: Fecha inicio datos históricos
  "frequency": "daily",                  // REQUERIDO: daily | weekly | monthly

  // Credenciales (REQUERIDO - usar Secret Manager):
  "access_token_secret_id": "meta-credentials-{tenant_id}",  // Referencia al secret creado

  // ═══════════════════════════════════════════════════════════════
  // CAMPOS INICIALES - Frontend escribe una vez al crear
  // ═══════════════════════════════════════════════════════════════

  "initial_backfill_done": false,        // Siempre false al crear
  "status": "pending_initial_sync",      // Siempre este valor al crear

  // ═══════════════════════════════════════════════════════════════
  // CAMPOS AUTOMÁTICOS - Backend actualiza, frontend NO escribe
  // ═══════════════════════════════════════════════════════════════

  // "last_extraction": Timestamp,       // Backend actualiza
  // "last_extraction_records": 1250,    // Backend actualiza
  // "last_run_at": Timestamp,           // Backend actualiza
  // "last_error": null,                 // Backend actualiza
  // "last_execution_time_seconds": 45   // Backend actualiza

  // ═══════════════════════════════════════════════════════════════
  // CAMPOS QUE NO EXISTEN - NO agregar
  // ═══════════════════════════════════════════════════════════════

  // "time_utc": ❌ NO EXISTE - Scheduler fijo a 6:00 AM UTC
  // "backfill_days": ❌ NO EXISTE - Se calcula automáticamente
}
```

### Estados posibles (`status`)

| Estado | Descripción | Acción UI |
|--------|-------------|-----------|
| `pending_initial_sync` | Esperando primera extracción | Mostrar "Sincronizando datos históricos..." |
| `syncing` | Extracción en progreso | Mostrar spinner/progress |
| `active` | Funcionando normalmente | Mostrar "Conectado ✓" |
| `error` | Error en última extracción | Mostrar error + botón retry |
| `paused` | Usuario pausó la sincronización | Mostrar "Pausado" + botón reactivar |

---

## Flujo de Onboarding

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND                                     │
├─────────────────────────────────────────────────────────────────┤
│  1. Usuario crea tenant en Firestore                            │
│     └─> Crear documento en /tenants/{tenant_id}                 │
│     └─> Agregar usuario como member con role "owner"            │
│                                                                 │
│  2. CONFIGURAR JWT CUSTOM CLAIMS (CRÍTICO - NUEVO)              │
│     └─> POST /api/auth/set-claims                               │
│     └─> Body: { "tenantId": "{tenant_id}", "role": "owner" }    │
│     └─> Después: await user.getIdToken(true) // refrescar token │
│                                                                 │
│  3. Usuario conecta Meta (OAuth/Manual)                         │
│     └─> Obtener access_token de Meta                            │
│                                                                 │
│  4. CREAR SECRET EN SECRET MANAGER (CRÍTICO)                    │
│     └─> POST /api/secrets/meta                                  │
│     └─> Body: { "credentials": { "access_token": "EAAxxxx" } }  │
│     └─> Backend crea: meta-credentials-{tenant_id}              │
│                                                                 │
│  5. Usuario selecciona Ad Account                               │
│     └─> Guardar ad_account_id en Firestore                      │
│                                                                 │
│  6. Usuario ingresa start_date y frequency                      │
│     └─> Guardar en Firestore con access_token_secret_id         │
│     └─> Cambiar status a "pending_initial_sync"                 │
│                                                                 │
│  7. Llamar endpoint para trigger inicial (opcional)             │
│     POST /api/ingest/run-now                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND                                      │
├─────────────────────────────────────────────────────────────────┤
│  8. Dispatcher detecta nuevo tenant con status pending          │
│     └─> O recibe trigger del frontend                           │
│                                                                 │
│  9. Worker ejecuta extracción inicial                           │
│     └─> Lee credenciales de Secret Manager                      │
│     └─> Calcula días desde start_date hasta hoy                 │
│     └─> Extrae todos los datos                                  │
│     └─> Carga en RAW y transforma a REPORTING                   │
│                                                                 │
│  10. Actualiza Firestore                                        │
│     └─> initial_backfill_done = true                            │
│     └─> status = "active"                                       │
│     └─> last_extraction = timestamp                             │
│                                                                 │
│  11. Scheduler ejecuta según frequency                          │
│     └─> Daily: últimos 7 días                                   │
│     └─> Weekly: últimos 14 días                                 │
│     └─> Monthly: últimos 45 días                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints Requeridos

**Base URL:** `https://backend-api-737169614020.us-central1.run.app`

### 0. Configurar JWT Custom Claims (CRÍTICO - llamar primero)

```http
POST /api/auth/set-claims
Authorization: Bearer {firebase_jwt_token}
Content-Type: application/json

Request:
{
  "tenantId": "hKK8VBrVMGWK1RN8d8w8",
  "role": "owner"  // opcional: "owner" | "admin" | "member"
}

Response:
{
  "success": true,
  "message": "Custom claims set successfully. Please refresh your token.",
  "tenant_id": "hKK8VBrVMGWK1RN8d8w8",
  "user_uid": "abc123..."
}
```

**IMPORTANTE:** Después de este endpoint, el frontend DEBE refrescar el token:
```typescript
await user.getIdToken(true); // force refresh para obtener nuevo JWT con tenant_id
```

---

### 0.5. Guardar credenciales de Meta

```http
POST /api/secrets/meta
Authorization: Bearer {firebase_jwt_token}
Content-Type: application/json

Request:
{
  "credentials": {
    "access_token": "EAABsbCS1iHgBO...",
    "token_type": "bearer",
    "expires_in": 5183944
  }
}

Response:
{
  "success": true,
  "secret_id": "meta-credentials-hKK8VBrVMGWK1RN8d8w8",
  "message": "Credentials for meta saved successfully"
}
```

**Nota:** Este endpoint lee `tenant_id` del JWT, por eso es crítico llamar a `/api/auth/set-claims` primero.

---

### 1. Trigger sincronización manual

```http
POST /api/datasources/meta/sync
Authorization: Bearer {user_token}

Request:
{
  "tenant_id": "xxx",
  "force_full_sync": false  // true para re-hacer backfill completo
}

Response:
{
  "success": true,
  "job_id": "extract-meta-xxx-123",
  "message": "Sincronización iniciada"
}
```

### 2. Obtener estado de sincronización

```http
GET /api/datasources/meta/status
Authorization: Bearer {user_token}

Response:
{
  "connected": true,
  "status": "active",
  "start_date": "2024-06-01",
  "frequency": "daily",
  "last_extraction": "2025-11-29T06:00:00Z",
  "last_extraction_records": 1250,
  "next_scheduled_run": "2025-11-30T06:00:00Z",
  "initial_backfill_done": true
}
```

### 3. Actualizar configuración

```http
PATCH /api/datasources/meta/config
Authorization: Bearer {user_token}

Request:
{
  "frequency": "weekly",        // Cambiar frecuencia
  "start_date": "2024-01-01"    // Cambiar fecha (triggerea nuevo backfill)
}

Response:
{
  "success": true,
  "message": "Configuración actualizada",
  "requires_resync": true       // Si cambió start_date
}
```

---

## Pantalla de Estado Sugerida

```
┌─────────────────────────────────────────────────────────────────┐
│  Meta Ads                                            [Conectado]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 Cuenta: Mi Empresa (act_123456789)                          │
│                                                                 │
│  📅 Datos desde: 1 de Junio, 2024                               │
│  🔄 Frecuencia: Diaria                                          │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Última sincronización: Hoy, 6:00 AM                            │
│  Registros actualizados: 1,250                                  │
│  Próxima sincronización: Mañana, 6:00 AM                        │
│                                                                 │
│  [Sincronizar ahora]  [Editar configuración]  [Desconectar]     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mensajes de Error Comunes

| Código | Mensaje Usuario | Acción |
|--------|-----------------|--------|
| `TOKEN_EXPIRED` | "Tu conexión con Meta ha expirado. Por favor reconecta." | Mostrar botón "Reconectar" |
| `RATE_LIMITED` | "Meta está limitando las solicitudes. Reintentando automáticamente." | Mostrar spinner |
| `ACCOUNT_NOT_FOUND` | "No se encontró la cuenta de anuncios. Verifica los permisos." | Mostrar botón "Verificar permisos" |
| `NO_DATA` | "No hay datos de anuncios en el período seleccionado." | Sugerir cambiar fecha |

---

## Notas Importantes

1. **Ventana de 48h de Meta**: Meta puede ajustar métricas hasta 48 horas después. Por eso siempre re-extraemos los últimos 7 días (daily), incluyendo días ya extraídos.

2. **Deduplicación automática**: El backend maneja la deduplicación. Si hay datos duplicados de la misma fecha, se conserva el más reciente.

3. **Límite de 2 años**: La API de Meta solo permite extraer datos de los últimos 2 años (730 días).

4. **Primera sincronización**: Puede tomar varios minutos dependiendo del rango de fechas. Mostrar indicador de progreso.

5. **Cambio de start_date**: Si el usuario cambia la fecha hacia atrás, se debe hacer un nuevo backfill para el período adicional.

---

## Checklist de Implementación Frontend

### Al crear un nuevo tenant:

```
✅ PASO 0: Crear tenant en Firestore
   - Crear /tenants/{tenant_id}
   - Agregar usuario como member: /tenants/{tenant_id}/members/{user_uid}
     con role: "owner"

✅ PASO 1: Configurar JWT Custom Claims (CRÍTICO)
   - POST /api/auth/set-claims
   - Body: { "tenantId": "{tenant_id}", "role": "owner" }
   - Luego: await user.getIdToken(true) // refrescar token
```

### Al conectar Meta Ads:

```
✅ PASO 2: Guardar credenciales en Secret Manager
   - POST /api/secrets/meta
   - Body: { "credentials": { "access_token": "EAAxxxx..." } }
   - El backend crea: meta-credentials-{tenant_id}

✅ PASO 3: Guardar configuración en Firestore:
   - connected: true
   - ad_account_id: "act_xxx"
   - start_date: "YYYY-MM-DD" (elegida por usuario)
   - frequency: "daily" | "weekly" | "monthly"
   - access_token_secret_id: "meta-credentials-{tenant_id}"
   - initial_backfill_done: false
   - status: "pending_initial_sync"

❌ NO guardar:
   - time_utc (no existe)
   - backfill_days (se calcula automáticamente)
   - access_token (usar Secret Manager, no Firestore)
```

### Ruta del documento:

```
/tenants/{tenant_id}/datasources/meta-{accountId}

Ejemplo:
/tenants/abc123/datasources/meta-741094088319935
```

### Ejemplo de código completo:

```typescript
import { doc, setDoc } from 'firebase/firestore';
import { auth } from './firebase'; // Tu instancia de Firebase Auth

const API_BASE_URL = 'https://backend-api-737169614020.us-central1.run.app';

/**
 * Paso 1: Configurar JWT custom claims después de crear tenant
 */
async function setUserClaims(tenantId: string, role: string = 'owner') {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  const token = await user.getIdToken();

  const response = await fetch(`${API_BASE_URL}/api/auth/set-claims`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tenantId, role })
  });

  if (!response.ok) {
    throw new Error(`Failed to set claims: ${response.statusText}`);
  }

  // CRÍTICO: Refrescar token para obtener nuevos claims
  await user.getIdToken(true);

  return await response.json();
}

/**
 * Paso 2: Guardar credenciales de Meta en Secret Manager
 */
async function saveMetaCredentials(accessToken: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  const token = await user.getIdToken();

  const response = await fetch(`${API_BASE_URL}/api/secrets/meta`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      credentials: {
        access_token: accessToken,
        token_type: 'bearer',
        created_at: new Date().toISOString()
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to save credentials: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Flujo completo de onboarding
 */
async function onboardMetaAds(
  tenantId: string,
  accountId: string,
  accessToken: string,
  startDate: string,
  frequency: 'daily' | 'weekly' | 'monthly'
) {
  // PASO 1: Configurar JWT claims (si es tenant nuevo)
  await setUserClaims(tenantId, 'owner');
  console.log('✅ JWT claims configured');

  // PASO 2: Guardar token en Secret Manager via API
  const { secret_id } = await saveMetaCredentials(accessToken);
  console.log('✅ Credentials saved to Secret Manager:', secret_id);

  // PASO 3: Guardar configuración en Firestore
  await setDoc(
    doc(db, `tenants/${tenantId}/datasources/meta-${accountId}`),
    {
      connected: true,
      ad_account_id: `act_${accountId}`,
      start_date: startDate,                           // "2024-06-01"
      frequency: frequency,                            // "daily"
      access_token_secret_id: secret_id,               // Referencia al secret
      initial_backfill_done: false,
      status: "pending_initial_sync"
    }
  );
  console.log('✅ Firestore configuration saved');

  console.log(`🎉 Meta Ads onboarding complete for tenant ${tenantId}`);
}
```

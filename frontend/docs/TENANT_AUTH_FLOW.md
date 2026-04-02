# Flujo de Autenticación y Tenant

Este documento describe el flujo completo de autenticación, creación de tenant y configuración de custom claims en Firebase Auth.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────────────┐   │
│  │ AuthContext  │───►│ tenantService   │───►│ apiService               │   │
│  │              │    │                 │    │                          │   │
│  │ - user       │    │ - createTenant  │    │ - setUserClaims()        │   │
│  │ - tenant     │    │ - getTenant     │    │ - saveCredentials()      │   │
│  │ - loading    │    │ - getUserTenants│    │ - runSyncNow()           │   │
│  └──────────────┘    └─────────────────┘    └──────────────────────────┘   │
│         │                    │                         │                    │
└─────────┼────────────────────┼─────────────────────────┼────────────────────┘
          │                    │                         │
          ▼                    ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FIREBASE                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌─────────────────┐                                    │
│  │ Firebase     │    │ Firestore       │                                    │
│  │ Auth         │    │                 │                                    │
│  │              │    │ /users/{uid}    │                                    │
│  │ - JWT Token  │    │ /tenants/{id}   │                                    │
│  │ - Claims     │    │   /members      │                                    │
│  └──────────────┘    │   /datasources  │                                    │
│                      └─────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────────┘
          │                                              │
          ▼                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND API (Cloud Run)                              │
│                  https://backend-api-jrzfm3jccq-uc.a.run.app                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐    │
│  │ /api/auth          │  │ /api/secrets       │  │ /api/ingest        │    │
│  │   /set-claims      │  │   /{datasource}    │  │   /run-now         │    │
│  │                    │  │                    │  │   /backfill        │    │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘    │
│           │                       │                       │                 │
│           ▼                       ▼                       ▼                 │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                    Google Cloud Services                            │    │
│  │  - Firebase Admin SDK (setCustomUserClaims)                        │    │
│  │  - Secret Manager (credenciales)                                   │    │
│  │  - BigQuery (datos)                                                │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Custom Claims en Firebase Auth

### ¿Qué son los Custom Claims?

Los Custom Claims son datos adicionales que se incluyen en el JWT (token) de Firebase Auth. Permiten que el backend identifique a qué tenant pertenece un usuario sin necesidad de consultar Firestore.

### ¿Por qué son necesarios?

1. **Seguridad**: El backend puede verificar el `tenant_id` directamente del JWT firmado
2. **Performance**: No requiere consultas adicionales a Firestore
3. **Consistencia**: El `tenant_id` viaja en cada request automáticamente

### Estructura del JWT con Claims

```json
{
  "user_id": "abc123...",
  "email": "user@example.com",
  "email_verified": true,
  "tenant_id": "hKK8VBrVMGWK1RN8d8w8",  // ← Custom Claim
  "iat": 1701234567,
  "exp": 1701238167
}
```

### Limitaciones

- Solo pueden ser configurados desde el **backend** usando Firebase Admin SDK
- Máximo 1000 bytes en total para todos los claims
- Se requiere refrescar el token (`getIdToken(true)`) para obtener los nuevos claims

## Flujo Completo: Creación de Tenant

### Diagrama de Secuencia

```
Usuario          Frontend              Backend               Firebase
   │                 │                    │                     │
   │  Crea Org       │                    │                     │
   ├────────────────►│                    │                     │
   │                 │                    │                     │
   │                 │  1. Crear Tenant   │                     │
   │                 │  en Firestore      │                     │
   │                 ├───────────────────────────────────────────►
   │                 │                    │                     │
   │                 │  2. POST /api/auth/set-claims            │
   │                 ├───────────────────►│                     │
   │                 │                    │                     │
   │                 │                    │  3. setCustomUserClaims
   │                 │                    ├────────────────────►│
   │                 │                    │                     │
   │                 │                    │  4. OK              │
   │                 │                    │◄────────────────────┤
   │                 │                    │                     │
   │                 │  5. { success }    │                     │
   │                 │◄───────────────────┤                     │
   │                 │                    │                     │
   │                 │  6. getIdToken(true)                     │
   │                 ├───────────────────────────────────────────►
   │                 │                    │                     │
   │                 │  7. JWT con tenant_id                    │
   │                 │◄───────────────────────────────────────────┤
   │                 │                    │                     │
   │  Tenant creado  │                    │                     │
   │◄────────────────┤                    │                     │
```

### Código Frontend

#### 1. tenantService.ts - createTenant()

```typescript
// /src/services/tenantService.ts

export async function createTenant(
  name: string,
  ownerUid: string,
  ownerEmail: string,
  plan: PlanType = 'trial'
): Promise<string> {
  try {
    const batch = writeBatch(db)

    // 1. Crear tenant en Firestore
    const tenantRef = doc(collection(db, TENANTS_COLLECTION))
    const tenantId = tenantRef.id

    const tenantData = {
      id: tenantId,
      name,
      slug: generateSlug(name),
      owner_uid: ownerUid,
      plan,
      billing_status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      features: PLAN_FEATURES[plan],
    }

    batch.set(tenantRef, tenantData)

    // 2. Crear member (owner)
    const memberRef = doc(db, TENANTS_COLLECTION, tenantId, 'members', ownerUid)
    batch.set(memberRef, {
      uid: ownerUid,
      email: ownerEmail,
      role: 'owner',
      status: 'active',
      joinedAt: serverTimestamp()
    })

    // 3. Actualizar user con tenantId
    const userRef = doc(db, 'users', ownerUid)
    batch.update(userRef, {
      tenantId: tenantId,
      activeTenant: tenantId,
      updatedAt: serverTimestamp()
    })

    await batch.commit()

    // 4. IMPORTANTE: Configurar custom claims en Firebase Auth
    try {
      console.log('🔑 Configurando custom claims...')
      await setUserClaims({ tenantId })
      console.log('✅ Custom claims configurados')

      // 5. Refrescar el token para obtener los nuevos claims
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true)
        console.log('✅ Token refrescado con nuevos claims')
      }
    } catch (claimsError) {
      console.warn('⚠️ No se pudieron configurar los custom claims:', claimsError)
    }

    return tenantId
  } catch (error) {
    console.error('❌ Error al crear tenant:', error)
    throw error
  }
}
```

#### 2. apiService.ts - setUserClaims()

```typescript
// /src/services/apiService.ts

export interface SetUserClaimsRequest {
  tenantId: string
}

export interface SetUserClaimsResponse {
  success: boolean
  message: string
}

/**
 * Configura los custom claims del usuario en Firebase Auth
 * IMPORTANTE: Después de llamar esto, el usuario debe refrescar su token
 */
export async function setUserClaims(
  request: SetUserClaimsRequest
): Promise<SetUserClaimsResponse> {
  return await apiRequest<SetUserClaimsResponse>(
    '/api/auth/set-claims',
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  )
}
```

### API Backend

#### POST /api/auth/set-claims

**Request:**
```http
POST https://backend-api-jrzfm3jccq-uc.a.run.app/api/auth/set-claims
Authorization: Bearer {firebase_id_token}
Content-Type: application/json

{
  "tenantId": "hKK8VBrVMGWK1RN8d8w8"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Custom claims set successfully. Token refresh required.",
  "tenant_id": "hKK8VBrVMGWK1RN8d8w8",
  "user_uid": "abc123..."
}
```

**Lógica del Backend:**
```python
# Pseudocódigo del backend
def set_claims(request):
    # 1. Verificar JWT y extraer uid
    uid = verify_firebase_token(request.headers['Authorization'])

    # 2. Obtener tenantId del body
    tenant_id = request.body['tenantId']

    # 3. Verificar que el usuario es miembro del tenant
    member = firestore.get(f'tenants/{tenant_id}/members/{uid}')
    if not member:
        raise Forbidden("User is not a member of this tenant")

    # 4. Configurar custom claims
    admin.auth().set_custom_user_claims(uid, {'tenant_id': tenant_id})

    return {'success': True, 'message': 'Claims set successfully'}
```

## Flujo Completo: Conectar Datasource (Meta Ads)

Una vez que el usuario tiene `tenant_id` en sus claims, puede conectar datasources:

```
Usuario          Frontend              Backend               Secret Manager
   │                 │                    │                     │
   │  Conecta Meta   │                    │                     │
   ├────────────────►│                    │                     │
   │                 │                    │                     │
   │                 │  POST /api/secrets/meta                  │
   │                 │  Authorization: Bearer {JWT con tenant_id}
   │                 ├───────────────────►│                     │
   │                 │                    │                     │
   │                 │                    │  1. Extraer tenant_id del JWT
   │                 │                    │  2. Validar credenciales con Meta API
   │                 │                    │                     │
   │                 │                    │  3. Crear secret    │
   │                 │                    ├────────────────────►│
   │                 │                    │  {tenant_id}_meta_access_token
   │                 │                    │                     │
   │                 │  { secret_id }     │                     │
   │                 │◄───────────────────┤                     │
   │                 │                    │                     │
   │                 │  4. Guardar datasource en Firestore      │
   │                 ├───────────────────────────────────────────►
   │                 │  /tenants/{id}/datasources/meta_ads      │
   │                 │                    │                     │
   │  Conectado!     │                    │                     │
   │◄────────────────┤                    │                     │
```

### Código Frontend - saveCredentials()

```typescript
// /src/services/apiService.ts

export async function saveCredentials(
  request: SaveCredentialsRequest
): Promise<SaveCredentialsResponse> {
  const platformEndpoints: Record<string, string> = {
    'meta_ads': 'meta',
    'google_analytics_4': 'ga4',
    'shopify': 'shopify',
    'tiendanube': 'tiendanube',
    'mercadolibre': 'mercadolibre',
    'tiktok_ads': 'tiktok'
  }

  const endpoint = platformEndpoints[request.platform] || request.platform

  // El backend extrae tenantId del JWT (custom claims)
  return await apiRequest<SaveCredentialsResponse>(
    `/api/secrets/${endpoint}`,
    {
      method: 'POST',
      body: JSON.stringify({
        credentials: request.credentials
      }),
    }
  )
}
```

## Estructura de Datos en Firestore

### /users/{uid}

```json
{
  "uid": "abc123...",
  "email": "user@example.com",
  "displayName": "John Doe",
  "tenantId": "hKK8VBrVMGWK1RN8d8w8",
  "activeTenant": "hKK8VBrVMGWK1RN8d8w8",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

### /tenants/{tenantId}

```json
{
  "id": "hKK8VBrVMGWK1RN8d8w8",
  "name": "Mi Empresa",
  "slug": "mi-empresa",
  "owner_uid": "abc123...",
  "plan": "trial",
  "billing_status": "active",
  "features": {
    "maxDatasources": 3,
    "maxUsers": 2,
    "customDashboards": false
  },
  "datasource_status": {
    "meta_ads": "connected"
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

### /tenants/{tenantId}/members/{uid}

```json
{
  "uid": "abc123...",
  "email": "user@example.com",
  "role": "owner",
  "status": "active",
  "joinedAt": "2024-01-15T10:30:00Z"
}
```

### /tenants/{tenantId}/datasources/{datasourceId}

```json
{
  "platform": "meta_ads",
  "connected": true,
  "frequency": "daily",
  "start_date": "2024-07-15",
  "ad_account_id": "act_123456789",
  "access_token_secret_id": "hKK8VBrVMGWK1RN8d8w8_meta_access_token",
  "status": "active",
  "last_sync_at": "2024-01-15T10:35:00Z",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

## Configuración de Ambiente

### Variables de Entorno (.env.local)

```bash
# Backend API URL - Production (Cloud Run)
VITE_API_BASE_URL=https://backend-api-jrzfm3jccq-uc.a.run.app

# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyBYYYOxVJf2dRkvMkFO7k3or6UjQCeWyR4
VITE_FIREBASE_AUTH_DOMAIN=datametricx-prod.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=datametricx-prod
```

## Troubleshooting

### Error: "Missing tenant_id in JWT"

**Causa:** El usuario no tiene custom claims configurados.

**Solución:**
1. Verificar que se llamó a `setUserClaims()` después de crear el tenant
2. Verificar que se refrescó el token con `getIdToken(true)`
3. El usuario puede cerrar sesión y volver a entrar para forzar el refresh

### Error: "User is not a member of this tenant"

**Causa:** El usuario intenta configurar claims para un tenant del que no es miembro.

**Solución:**
1. Verificar que existe el documento `/tenants/{tenantId}/members/{uid}`
2. El usuario debe ser owner o admin del tenant

### Error: "API Error (401): Unauthorized"

**Causa:** El token de Firebase no es válido o expiró.

**Solución:**
1. Verificar que `auth.currentUser` existe
2. Llamar a `getIdToken()` para obtener un token fresco
3. Verificar la configuración de Firebase en el frontend

## Endpoints del Backend

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/set-claims` | Configura custom claims (tenant_id) |
| POST | `/api/secrets/{datasource}` | Guarda credenciales en Secret Manager |
| DELETE | `/api/secrets/{datasource}/{tenant_id}` | Elimina credenciales |
| POST | `/api/ingest/run-now` | Ejecuta sincronización manual |
| POST | `/api/ingest/backfill` | Ejecuta backfill de datos históricos |
| GET | `/api/ingest/status/{job_id}` | Obtiene estado de sincronización |

## Referencias

- [Firebase Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Google Cloud Secret Manager](https://cloud.google.com/secret-manager/docs)

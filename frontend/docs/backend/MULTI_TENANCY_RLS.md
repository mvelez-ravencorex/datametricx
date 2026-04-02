# DataMetricX - Multi-Tenancy y Row Level Security

## Arquitectura de Seguridad Multi-Tenant

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  - Firebase Auth (JWT con custom claims)                        │
│  - Token contiene: tenant_id, role                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND API                                 │
│  - Valida JWT de Firebase                                       │
│  - Extrae tenant_id del token                                   │
│  - Inyecta filtro WHERE tenant_id = X en queries                │
│  - SysOwner bypass: no aplica filtro                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BIGQUERY (RLS)                              │
│  - Row Access Policies en todas las tablas                      │
│  - Filtra por tenant_users.email → tenant_id                    │
│  - SysOwner (tenant_id = '*') ve todo                           │
│  - Service Account tiene acceso total                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Firebase Auth - Custom Claims

### Estructura de Claims
```json
{
  "uid": "LyCBbtgicPXqK5hQ9GJvNUhdyTI3",
  "email": "usuario@email.com",
  "tenant_id": "demo_tenant_123",
  "role": "admin"
}
```

### Roles Disponibles
| Role | tenant_id | Descripción |
|------|-----------|-------------|
| `SysOwner` | `*` | Acceso total a todos los tenants |
| `admin` | `tenant_xxx` | Administrador del tenant |
| `member` | `tenant_xxx` | Miembro del tenant |

### Configurar Claims de Usuario
```python
from firebase_admin import auth, initialize_app

initialize_app(options={'projectId': 'datametricx-prod'})

# Usuario normal
auth.set_custom_user_claims('USER_UID', {
    'tenant_id': 'tenant_id_aqui',
    'role': 'admin'
})

# SysOwner (acceso total)
auth.set_custom_user_claims('USER_UID', {
    'tenant_id': '*',
    'role': 'SysOwner'
})
```

---

## 2. BigQuery - Row Level Security (RLS)

### Tabla de Mapeo: `raw.tenant_users`
```sql
CREATE TABLE `datametricx-prod.raw.tenant_users` (
  email STRING NOT NULL,
  tenant_id STRING NOT NULL,  -- '*' para SysOwner
  role STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);
```

### Agregar Usuario a Tenant
```sql
-- Usuario normal (acceso a un tenant)
INSERT INTO `datametricx-prod.raw.tenant_users` (email, tenant_id, role)
VALUES ('usuario@email.com', 'tenant_123', 'admin');

-- SysOwner (acceso a todos)
INSERT INTO `datametricx-prod.raw.tenant_users` (email, tenant_id, role)
VALUES ('admin@email.com', '*', 'SysOwner');
```

### Row Access Policy (aplicada a cada tabla)
```sql
CREATE OR REPLACE ROW ACCESS POLICY tenant_rls_policy
ON `datametricx-prod.raw.meta_campaigns`
GRANT TO (
  'user:martin.velez@ravencorex.com',
  'serviceAccount:sa-backend-api@datametricx-prod.iam.gserviceaccount.com'
)
FILTER USING (
  -- Service Account: acceso total (API maneja filtro)
  SESSION_USER() = 'sa-backend-api@datametricx-prod.iam.gserviceaccount.com'
  OR
  -- Usuario normal: solo sus tenants
  tenant_id IN (
    SELECT tu.tenant_id FROM `datametricx-prod.raw.tenant_users` tu
    WHERE tu.email = SESSION_USER()
  )
  OR
  -- SysOwner: acceso total (tiene '*' en tenant_users)
  '*' IN (
    SELECT tu.tenant_id FROM `datametricx-prod.raw.tenant_users` tu
    WHERE tu.email = SESSION_USER()
  )
);
```

### Tablas con RLS Configurado
**Dataset `raw`:**
- meta_accounts
- meta_ads
- meta_adsets
- meta_campaigns
- meta_creatives
- meta_performance_ad_daily
- meta_performance_adset_daily
- meta_performance_campaign_age_gender
- meta_performance_campaign_country
- meta_performance_campaign_daily
- meta_performance_campaign_impression_device
- meta_performance_campaign_platform_device
- meta_performance_campaign_publisher_platform
- meta_top_creatives_performance

**Dataset `reporting`:** (mismas tablas)

---

## 3. Backend API - Filtrado por Tenant

### Ubicación: `backend_code/api/main.py`

### Lógica de SysOwner
```python
# Línea ~1625
is_sys_owner = user_info.get("role") == "SysOwner"

# Si es SysOwner, no requiere tenant_id
if not tenant_id and not is_sys_owner:
    raise HTTPException(status_code=403, detail="Missing tenant_id in JWT")
```

### Construcción de Query SQL
```python
# Línea ~1550-1555
where_parts = []

# SysOwner bypasses tenant filter
if not is_sys_owner:
    where_parts.append(f"t.tenant_id = '{tenant_id}'")
```

---

## 4. Instrucciones Frontend

### Detectar SysOwner
```javascript
const idTokenResult = await user.getIdTokenResult();
const claims = idTokenResult.claims;

const isSysOwner = claims.role === 'SysOwner';
const tenantId = claims.tenant_id;
```

### Lógica de UI
```javascript
if (isSysOwner) {
  // Mostrar selector de todos los tenants
  // Mostrar panel de administración global
  // Permitir ver datos sin filtro de tenant
} else {
  // Usuario normal - solo ve su tenant
}
```

### Queries Semánticas
```javascript
// El tenant_id se inyecta automáticamente desde JWT
// NO enviar tenant_id en el body

POST /api/semantic/query
{
  "dataset_id": "ds_meta_performance_campaign",
  "attributes": ["date_date", "campaign_name"],
  "metrics": ["impressions", "spend"],
  "filters": [
    {"field": "date", "operator": ">=", "value": "2024-01-01"}
  ],
  "limit": 100
}

// SysOwner puede agregar tenant_id como atributo para ver de todos
// o filtrar por tenant específico si quiere
```

### Cambiar de Tenant
```javascript
async function switchTenant(newTenantId) {
  // 1. Llamar API para actualizar claims
  await fetch('/api/auth/set-claims', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ tenantId: newTenantId })
  });

  // 2. Refrescar token
  const newToken = await firebase.auth().currentUser.getIdToken(true);

  // 3. Recargar datos
  await refreshDashboardData();
}
```

---

## 5. Comandos Útiles

### Ver usuarios y sus tenants
```sql
SELECT * FROM `datametricx-prod.raw.tenant_users`;
```

### Agregar nuevo usuario a tenant
```sql
INSERT INTO `datametricx-prod.raw.tenant_users` (email, tenant_id, role)
VALUES ('nuevo@email.com', 'tenant_id', 'member');
```

### Promover a SysOwner
```sql
DELETE FROM `datametricx-prod.raw.tenant_users` WHERE email = 'admin@email.com';
INSERT INTO `datametricx-prod.raw.tenant_users` (email, tenant_id, role)
VALUES ('admin@email.com', '*', 'SysOwner');
```

### Verificar RLS está funcionando
```sql
-- Esto mostrará solo los tenants del usuario actual
SELECT tenant_id, COUNT(*)
FROM `datametricx-prod.raw.meta_campaigns`
GROUP BY tenant_id;
```

### Configurar claims en Firebase (Python)
```python
from firebase_admin import auth, initialize_app
initialize_app(options={'projectId': 'datametricx-prod'})

# Ver claims actuales
user = auth.get_user('USER_UID')
print(user.custom_claims)

# Actualizar claims
auth.set_custom_user_claims('USER_UID', {
    'tenant_id': 'nuevo_tenant',
    'role': 'admin'
})
```

---

## 6. Flujo de Onboarding de Usuario

```
1. Usuario se registra en Firebase Auth
   └── No tiene custom claims aún

2. Usuario crea/se une a un tenant
   └── Frontend llama POST /api/auth/set-claims
       └── Backend verifica membresía en Firestore
           └── Backend actualiza custom claims en Firebase
               └── Backend inserta en tenant_users (BigQuery)

3. Usuario hace logout/login
   └── Nuevo token tiene tenant_id y role

4. Usuario hace queries
   └── API extrae tenant_id del JWT
       └── SQL se genera con WHERE tenant_id = X
           └── BigQuery RLS valida acceso adicional
```

---

## 7. Datos de Prueba (Synthetic Data)

### Tenant de Demo
- **tenant_id:** `demo_tenant_datametricx`
- **Período:** 2024-01-01 a 2024-12-31
- **Datos:**
  - 1 cuenta
  - 12 campañas
  - 48 adsets
  - 145 ads
  - 3,627 registros de performance diario
  - 65,286 registros de breakdown edad/género
  - 29,016 registros de breakdown país
  - 10,881 registros de breakdown dispositivo
  - 14,508 registros de breakdown plataforma

### Generar nuevos datos sintéticos
```bash
python3 /tmp/generate_meta_data.py
```

---

## 8. API Endpoints - Semantic Layer

### Versión actual: v1.3.0

### Endpoints disponibles

| Método | Endpoint | Acceso | Descripción |
|--------|----------|--------|-------------|
| GET | `/api/semantic/models/tree` | Autenticado | Listar árbol de archivos |
| GET | `/api/semantic/models/file?path=...` | Autenticado | Leer un archivo |
| PUT | `/api/semantic/models/file` | **SysOwner** | Guardar/actualizar archivo |
| DELETE | `/api/semantic/models/file?path=...` | **SysOwner** | Eliminar archivo |
| POST | `/api/semantic/query` | Autenticado | Ejecutar query semántica |

### Guardar archivo (SysOwner)
```javascript
// PUT /api/semantic/models/file
const response = await fetch('/api/semantic/models/file', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    path: "core/entities/meta/meta_campaigns.json",
    content: {
      id: "meta_campaigns",
      type: "entity",
      label: "Campañas Meta",
      description: "Entidad de campañas",
      group: "Meta",
      source: {
        type: "table",
        sql_table: "`datametricx-prod.reporting.meta_campaigns`"
      },
      attributes: [...],
      metrics: [...]
    }
  })
});

// Respuesta
{
  "success": true,
  "path": "core/entities/meta/meta_campaigns.json",
  "message": "File saved successfully"
}
```

### Eliminar archivo (SysOwner)
```javascript
// DELETE /api/semantic/models/file?path=core/entities/meta/old_entity.json
const response = await fetch(
  '/api/semantic/models/file?path=core/entities/meta/old_entity.json',
  {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
```

### Validaciones del backend
- Solo SysOwner puede modificar/eliminar
- Solo archivos dentro de `core/`
- Solo archivos `.json`
- El contenido debe tener campos `id` y `type`
- No se permite path traversal (`..`)

### Errores comunes
```javascript
// 403 - No es SysOwner
{ "detail": "Only SysOwner can modify semantic models" }

// 400 - Falta campo requerido
{ "detail": "Content must have an 'id' field" }
{ "detail": "Content must have a 'type' field (entity or dataset)" }

// 404 - Archivo no existe (solo DELETE)
{ "detail": "File not found: core/..." }
```

---

## 9. Configuración de Acceso API (CORS + IAM)

### Problema
Cloud Run tiene IAM habilitado por seguridad, lo que causa errores CORS:
```
Preflight response is not successful. Status code: 403
```

El browser envía una solicitud OPTIONS (preflight) sin token, y Cloud Run IAM la rechaza antes de que llegue a FastAPI.

### Solución: Firebase Hosting Proxy

Firebase Hosting actúa como proxy autenticado hacia Cloud Run, eliminando problemas de CORS.

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Browser   │ ──► │ Firebase Hosting │ ──► │  Cloud Run  │
│             │     │   (mismo origen) │     │ (IAM check) │
└─────────────┘     └──────────────────┘     └─────────────┘
                           │
                    No hay CORS porque
                    es el mismo dominio
```

### Configuración: firebase.json

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "datametricx-backend-api",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### Configuración del Cliente HTTP

El frontend debe usar rutas relativas (sin dominio):

```typescript
// ❌ INCORRECTO - causa CORS
const API_URL = 'https://datametricx-backend-api-jrzfm3jccq-uc.a.run.app';
fetch(`${API_URL}/api/semantic/models/tree`);

// ✅ CORRECTO - usa Firebase Hosting proxy
fetch('/api/semantic/models/tree', {
  headers: {
    'Authorization': `Bearer ${firebaseIdToken}`,
    'Content-Type': 'application/json'
  }
});
```

### Desarrollo Local

#### Opción 1: Firebase Emulators (Recomendado)

```bash
# Iniciar emulador de hosting
firebase emulators:start --only hosting

# El frontend estará en http://localhost:5000
# Las llamadas a /api/** se redirigen a Cloud Run
```

#### Opción 2: Vite Proxy

Configurar `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://datametricx-backend-api-jrzfm3jccq-uc.a.run.app',
        changeOrigin: true,
        secure: true,
        configure: (proxy, options) => {
          // El token se agrega en el cliente, no aquí
        }
      }
    }
  }
});
```

**Nota importante para Vite Proxy:** El proxy de Vite no puede agregar el token de Firebase automáticamente porque el token cambia por usuario. El cliente debe seguir enviando el header `Authorization`.

Para que funcione con IAM de Cloud Run, necesitas una de estas opciones:

1. **Usar service account** (solo desarrollo):
```typescript
// vite.config.ts - SOLO PARA DESARROLLO
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://datametricx-backend-api-jrzfm3jccq-uc.a.run.app',
        changeOrigin: true,
        headers: {
          // Token de identidad de gcloud (expira en 1 hora)
          'Authorization': `Bearer ${process.env.GCLOUD_ID_TOKEN}`
        }
      }
    }
  }
});

// Obtener token: gcloud auth print-identity-token
```

2. **Usar Firebase Emulators** (recomendado - ver Opción 1)

### Despliegue

```bash
# Construir el frontend
npm run build

# Desplegar a Firebase Hosting
firebase deploy --only hosting
```

### Verificar configuración

```bash
# Ver configuración actual de Firebase Hosting
firebase hosting:channel:list

# Ver logs de Cloud Run
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=datametricx-backend-api" --limit=50
```

### Arquitectura de Seguridad Final

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SEGURIDAD EN CAPAS                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. FIREBASE HOSTING                                                │
│     └── Proxy autenticado hacia Cloud Run                          │
│     └── Elimina problemas de CORS                                  │
│                                                                     │
│  2. CLOUD RUN IAM                                                   │
│     └── Solo Firebase Hosting puede invocar el servicio            │
│     └── Bloquea acceso directo desde internet                      │
│                                                                     │
│  3. FASTAPI JWT VALIDATION                                          │
│     └── Valida token de Firebase en cada request                   │
│     └── Extrae tenant_id y role del token                          │
│     └── Rechaza requests sin token válido (401)                    │
│                                                                     │
│  4. BIGQUERY RLS                                                    │
│     └── Row Access Policies filtran por tenant                     │
│     └── Incluso si alguien obtiene un token, solo ve sus datos     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. Troubleshooting

### Error: "Missing tenant_id in JWT"
- Usuario no tiene tenant asignado
- Solución: Asignar tenant via `/api/auth/set-claims`

### Error: "Access denied" en BigQuery
- Usuario no está en `tenant_users`
- Solución: Insertar registro en `tenant_users`

### Usuario no ve datos después de cambiar tenant
- Token JWT no se refrescó
- Solución: `await user.getIdToken(true)` o logout/login

### RLS no filtra correctamente
- Verificar que `SESSION_USER()` retorna el email correcto
- Verificar entrada en `tenant_users` con ese email

---

*Documentación creada: 2024-12-02*
*Última actualización: 2024-12-04*
*Versión API: v1.3.0*

# Desarrollo del Editor Semantic Layer - Progreso

**Fecha inicio:** 2025-12-07
**Branch:** `feat/datametricx-bigquery-functions`
**Estado:** En progreso - Solucionando autenticación

---

## Objetivo

Testear la funcionalidad del editor de entities y datasets del Semantic Layer desde el frontend.

---

## Problema Inicial

Al intentar cargar entities en el editor, el frontend mostraba errores:

```
Error: Semantic API Error (401):
<html>...<h1>Error: Unauthorized</h1>
<h2>Your client does not have permission to the requested URL /api/semantic/models/tree</h2>
```

El error **HTML 401** indicaba que el rechazo venía de **Cloud Run** (no del código Python), porque el servicio requería autenticación IAM.

---

## Diagnóstico

### 1. Verificación del Cloud Run Service

```bash
gcloud run services get-iam-policy datametricx-backend-api \
  --project=datametricx-prod \
  --region=us-central1
```

**Resultado inicial:**
```yaml
bindings:
- members:
  - serviceAccount:datametricx-prod@appspot.gserviceaccount.com
  role: roles/run.invoker
```

**Problema:** Solo la service account tenía permisos. El frontend (navegador) no podía invocar directamente.

### 2. Arquitectura de Autenticación

El flujo requiere **dos capas** de autenticación:

```
Frontend → Vite Proxy → Cloud Run → Backend Python
              ↓            ↓            ↓
         Agrega IAM    Valida IAM   Valida Firebase
           token         token         token
```

- **Cloud Run:** Requiere IAM token (gcloud identity token)
- **Backend Python:** Requiere Firebase token (del usuario logueado)

---

## Soluciones Aplicadas

### Paso 1: Agregar usuario como invoker de Cloud Run

```bash
gcloud run services add-iam-policy-binding datametricx-backend-api \
  --project=datametricx-prod \
  --region=us-central1 \
  --member="user:martin.velez@ravencorex.com" \
  --role="roles/run.invoker"
```

**Estado:** Completado

**Resultado:**
```yaml
bindings:
- members:
  - serviceAccount:datametricx-prod@appspot.gserviceaccount.com
  - user:martin.velez@ravencorex.com
  role: roles/run.invoker
```

### Paso 2: Configurar Vite Proxy

El proxy de Vite debe enviar **DOS tokens**:
1. `Authorization: Bearer <IAM_TOKEN>` → para Cloud Run
2. `X-Firebase-Auth: <FIREBASE_TOKEN>` → para el backend Python

**Archivo:** `vite.config.ts` (en el proyecto frontend)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'child_process'

// Cloud Run service URL
const CLOUD_RUN_URL = 'https://datametricx-backend-api-jrzfm3jccq-uc.a.run.app'

// Get IAM token for Cloud Run authentication (SIN --audiences para cuentas de usuario)
function getGcloudToken(): string {
  try {
    const token = execSync('gcloud auth print-identity-token', { encoding: 'utf-8' }).trim()
    console.log('✅ IAM token obtained:', token.substring(0, 50) + '...')
    return token
  } catch (error) {
    console.error('❌ gcloud token failed:', error)
    return ''
  }
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: CLOUD_RUN_URL,
        changeOrigin: true,
        secure: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('🔄 Proxy request:', req.url)

            const iamToken = getGcloudToken()
            const firebaseToken = req.headers['authorization']

            console.log('📋 Firebase token present:', !!firebaseToken)
            console.log('🔑 IAM token present:', !!iamToken)

            // IAM token for Cloud Run layer
            if (iamToken) {
              proxyReq.setHeader('Authorization', `Bearer ${iamToken}`)
              console.log('✅ Set Authorization header with IAM token')
            } else {
              console.error('❌ No IAM token available!')
            }

            // Firebase token in separate header for backend auth
            if (firebaseToken) {
              const token = Array.isArray(firebaseToken) ? firebaseToken[0] : firebaseToken
              proxyReq.setHeader('X-Firebase-Auth', token.replace('Bearer ', ''))
              console.log('✅ Set X-Firebase-Auth header')
            }
          })
        }
      }
    }
  },
})
```

**Estado:** Completado - Pendiente de verificar

### Paso 3: Verificar con curl (Testing manual)

```bash
# Obtener token IAM
TOKEN=$(gcloud auth print-identity-token)

# Probar endpoint
curl -H "Authorization: Bearer $TOKEN" "https://datametricx-backend-api-jrzfm3jccq-uc.a.run.app/api/semantic/models/tree"
```

**Resultado:** `{"detail":"Invalid ID token"}`

Esto es **esperado** porque:
- Cloud Run acepta el request (ya no es HTML 401)
- Backend Python rechaza porque espera Firebase token, no IAM token
- El flujo completo requiere ambos tokens (IAM + Firebase)

---

## Errores Conocidos y Soluciones

### Error: `--audiences` solo funciona con Service Accounts

```
ERROR: (gcloud.auth.print-identity-token) Invalid account Type for `--audiences`. Requires valid service account.
```

**Solución:** Usar `gcloud auth print-identity-token` SIN el flag `--audiences` cuando se usa una cuenta de usuario.

### Error: HTML 401 de Cloud Run

```html
<h1>Error: Unauthorized</h1>
<h2>Your client does not have permission to the requested URL</h2>
```

**Solución:** Agregar el usuario/service account como invoker:
```bash
gcloud run services add-iam-policy-binding datametricx-backend-api \
  --member="user:EMAIL" \
  --role="roles/run.invoker"
```

### Error: JSON `{"detail":"Invalid ID token"}`

Esto viene del backend Python, no de Cloud Run. Significa que:
- Cloud Run aceptó el request
- El backend espera un Firebase token válido

**Solución:** Asegurarse de que el frontend envía el Firebase token en `X-Firebase-Auth` header.

---

## Próximos Pasos

1. [x] Reiniciar Vite con la configuración corregida (sin `--audiences`) - **COMPLETADO**
2. [x] Verificar en la consola de Vite que ambos tokens se están enviando - **COMPLETADO**
3. [x] Verificar en logs de Cloud Run que el request llega con ambos headers - **COMPLETADO**
4. [ ] **Deploy del backend** con fix de SysOwner
5. [ ] Probar guardar entities/datasets en el editor

---

## Fix Aplicado: Verificación SysOwner (2025-12-07)

### Problema
El endpoint PUT `/api/semantic/models/file` solo verificaba `role == "SysOwner"`, pero el token de Firebase tenía `sys_owner: true` (flag booleano).

### Solución
Modificado `main.py` para verificar ambos:

```python
# Antes (incorrecta):
user_role = user_info.get("role")
if user_role != "SysOwner":

# Después (correcta):
is_sys_owner = user_info.get("sys_owner", False) or user_info.get("role") == "SysOwner"
if not is_sys_owner:
```

### Archivos modificados
- `projects/datametricx-prod/backend_code/api/main.py`
  - Línea ~1545: endpoint PUT save
  - Línea ~1669: endpoint DELETE

### Deploy pendiente
```bash
# Opción 1: Deploy desde source
cd projects/datametricx-prod/backend_code/api
gcloud run deploy datametricx-backend-api \
  --source . \
  --project=datametricx-prod \
  --region=us-central1

# Opción 2: Si hay CI/CD configurado
git add .
git commit -m "fix(api): check sys_owner flag in addition to role for SysOwner"
git push
```

---

## Archivos Relevantes

### Backend (este repo)
- `projects/datametricx-prod/backend_code/api/main.py` - Endpoints del API
- `projects/datametricx-prod/backend_code/api/auth.py` - Autenticación Firebase
- `projects/datametricx-prod/semantic_layer_storage.tf` - GCS bucket para modelos

### Frontend (otro repo)
- `vite.config.ts` - Configuración del proxy
- `src/services/semanticService.ts` - Llamadas al API

---

## URLs Importantes

- **Cloud Run Service:** `https://datametricx-backend-api-jrzfm3jccq-uc.a.run.app`
- **Endpoint Tree:** `/api/semantic/models/tree`
- **Endpoint File:** `/api/semantic/models/file?path=...`
- **GCS Bucket:** `gs://datametricx-semantic-models`

---

## Comandos Útiles

```bash
# Ver IAM policy del servicio
gcloud run services get-iam-policy datametricx-backend-api \
  --project=datametricx-prod --region=us-central1

# Agregar invoker
gcloud run services add-iam-policy-binding datametricx-backend-api \
  --project=datametricx-prod --region=us-central1 \
  --member="user:EMAIL" --role="roles/run.invoker"

# Ver logs de Cloud Run
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=datametricx-backend-api" \
  --project=datametricx-prod --limit=50

# Probar endpoint con curl
TOKEN=$(gcloud auth print-identity-token)
curl -H "Authorization: Bearer $TOKEN" "https://datametricx-backend-api-jrzfm3jccq-uc.a.run.app/"
```

---

---

## Cold Start de Cloud Run

### Problema
Cloud Run apaga las instancias cuando no hay tráfico (~15 min de inactividad). El primer request después de esto sufre **cold start** (10-20 segundos) y puede causar timeout en el frontend.

### Síntomas
- Error `ECONNRESET` en el proxy de Vite
- Error 500 "Internal Server Error" con body vacío
- Los requests de archivos funcionan pero las queries fallan

### Solución para Desarrollo: "Calentar" el servicio

**Antes de empezar a trabajar**, ejecutar en terminal:

```bash
curl "https://datametricx-backend-api-jrzfm3jccq-uc.a.run.app/"
```

Esperar hasta que responda (10-20 segundos):
```json
{"service": "datametricx-backend-api", "version": "1.3.0", "status": "healthy", ...}
```

Ahora el servicio estará "caliente" por ~15 minutos de inactividad.

### Alternativas

| Opción | Descripción | Costo |
|--------|-------------|-------|
| Calentar manual | Ejecutar curl antes de trabajar | $0 |
| Timeout en Vite | `timeout: 60000` en proxy config | $0 |
| min-instances=1 | Mantener instancia siempre activa | ~$15-30/mes |

---

## Consideraciones para Producción

### Cloud Run - Evitar Cold Start

Para producción, configurar **min-instances** para evitar latencia en usuarios reales:

```bash
gcloud run services update datametricx-backend-api \
  --project=datametricx-prod \
  --region=us-central1 \
  --min-instances=1
```

O en Terraform:
```hcl
resource "google_cloud_run_service" "backend_api" {
  # ...
  template {
    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = "1"
        "autoscaling.knative.dev/maxScale" = "20"
      }
    }
  }
}
```

### Autenticación en Producción

En producción **NO usar el patrón de Vite Proxy**. Opciones:

1. **Firebase Hosting Rewrites** (Recomendado)
   ```json
   // firebase.json
   {
     "hosting": {
       "rewrites": [{
         "source": "/api/**",
         "run": {
           "serviceId": "datametricx-backend-api",
           "region": "us-central1"
         }
       }]
     }
   }
   ```

2. **Cloud Run con acceso público** + validación Firebase en código
   - Agregar `allUsers` como invoker
   - El backend valida Firebase token internamente

3. **Load Balancer + IAP** (Enterprise)
   - Más complejo pero más seguro
   - Requiere configuración adicional

### Checklist Pre-Producción

- [ ] Configurar `min-instances=1` en Cloud Run
- [ ] Configurar dominio personalizado
- [ ] Configurar Firebase Hosting rewrites (o alternativa)
- [ ] Remover usuario individual de IAM invoker
- [ ] Configurar alertas de monitoreo
- [ ] Revisar costos estimados

---

---

## Sesion 2025-12-08: Funnel E-commerce y Sistema Viz

### Cambios Realizados

#### 1. Funnel E-commerce Completado en Semantic Layer

Se agregaron las metricas faltantes del funnel a las 3 entities de performance:

**Nuevas metricas agregadas:**

| Metrica | Label | Tipo | Descripcion |
|---------|-------|------|-------------|
| `view_content_value` | Valor View Content | currency | Valor monetario de views |
| `add_to_cart_value` | Valor Add to Cart | currency | Valor del carrito |
| `initiate_checkout_value` | Valor Checkout | currency | Valor en checkout |
| `atc_rate` | Add to Cart Rate | percent | add_to_cart / view_content |
| `checkout_rate` | Checkout Rate | percent | checkout / add_to_cart |
| `purchase_rate` | Purchase Rate | percent | purchase / checkout |
| `overall_conversion_rate` | Conversion Rate Total | percent | purchase / view_content |

**Entities actualizadas:**
- `fact_meta_performance_campaign.json`
- `fact_meta_performance_adset.json`
- `fact_meta_performance_ad.json`

**Subidas a GCS:**
```bash
gsutil cp semantic_layer/core/entities/meta/fact_meta_performance_campaign.json gs://datametricx-semantic-models/core/entities/meta/
gsutil cp semantic_layer/core/entities/meta/fact_meta_performance_adset.json gs://datametricx-semantic-models/core/entities/meta/
gsutil cp semantic_layer/core/entities/meta/fact_meta_performance_ad.json gs://datametricx-semantic-models/core/entities/meta/
```

#### 2. Fix SysOwner en Backend

Corregido el check de SysOwner en endpoints de save/delete:

```python
# Antes (solo verificaba role):
if user_role != "SysOwner":

# Despues (verifica ambos):
is_sys_owner = user_info.get("sys_owner", False) or user_info.get("role") == "SysOwner"
if not is_sys_owner:
```

**Archivos modificados:**
- `backend_code/api/main.py` - endpoints PUT y DELETE de semantic models

**Deploy realizado:**
```bash
gcloud run deploy datametricx-backend-api --source . --project=datametricx-prod --region=us-central1
```

#### 3. Permisos GCS para Backend

Agregado permiso de escritura al service account del backend:

```bash
gcloud storage buckets add-iam-policy-binding gs://datametricx-semantic-models \
  --member="serviceAccount:sa-backend-api@datametricx-prod.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

#### 4. Diseno Sistema Viz y Dashboards

Se diseno la arquitectura completa para guardar visualizaciones:

**Documentacion creada:**
- `docs/VIZ_DASHBOARDS_SPEC.md` - Especificacion completa del sistema

**Decisiones clave:**
- Almacenamiento: Firestore (no GCS)
- URLs compartibles con tokens publicos
- Jerarquia de carpetas por tenant
- Security Rules por rol

**Estructura Firestore:**
```
tenants/{tenantId}/
  ├── folders/{folderId}
  ├── vizs/{vizId}
  └── dashboards/{dashId}
```

### Documentacion Creada/Actualizada

| Archivo | Descripcion |
|---------|-------------|
| `docs/DESARROLLO_SEMANTIC_EDITOR.md` | Este archivo - progreso desarrollo |
| `docs/DICCIONARIO_DATOS_META_ADS.md` | Diccionario completo de datos Meta |
| `docs/VIZ_DASHBOARDS_SPEC.md` | Especificacion sistema Viz/Dashboards |

### Proximos Pasos

#### Backend
- [ ] Implementar endpoints de Viz (duplicate, share, search)
- [ ] Agregar endpoint `/api/dashboard/{dashId}/data` para carga batch
- [ ] Configurar Firestore indexes para queries

#### Frontend
- [ ] Implementar UI "Guardar como Viz"
- [ ] Navegador de carpetas
- [ ] Carga de Viz existentes
- [ ] Editor de Dashboards

#### Infraestructura
- [ ] Configurar min-instances=1 para produccion
- [ ] Configurar Firebase Hosting rewrites
- [ ] Implementar Firestore Security Rules

#### Automatizacion de Permisos (IMPORTANTE)
- [ ] **Automatizar permisos Cloud Run en onboarding de usuarios**
  - Actualmente se agrega manualmente: `gcloud run services add-iam-policy-binding`
  - Debe hacerse automaticamente al dar de alta un usuario
  - Opciones:
    1. Cloud Function trigger en Firestore (cuando se crea member)
    2. Backend endpoint que agregue el permiso
    3. Usar Firebase Hosting rewrites (elimina necesidad de IAM por usuario)
  - **Recomendacion**: Opcion 3 (Firebase Hosting rewrites) es la mas limpia para produccion

#### Permisos Manuales Actuales (Temporal - Solo Desarrollo)
```bash
# Agregar usuario como invoker de Cloud Run
gcloud run services add-iam-policy-binding datametricx-backend-api \
  --region=us-central1 \
  --member="user:{EMAIL}" \
  --role="roles/run.invoker" \
  --project=datametricx-prod
```
**NOTA**: Esto NO escala. En produccion usar Firebase Hosting rewrites o automatizar.

---

## Auditoria de Seguridad (2025-12-08)

### Hallazgos

Se realizo una auditoria de seguridad completa del backend. Documento completo en `docs/SECURITY_AUDIT.md`.

| Categoria | Estado |
|-----------|--------|
| Autenticacion | OK |
| Autorizacion | OK |
| **Inyeccion SQL** | **CORREGIDO** |
| Validacion de Inputs | OK |
| CORS | Revisar para produccion |
| Path Traversal | OK |
| Multi-tenancy | OK |

### Vulnerabilidad Corregida: SQL Injection

**Problema:** Los filtros del semantic query se concatenaban directamente en el SQL:

```python
# VULNERABLE
where_parts.append(f"{sql_field} {operator} '{value}'")
```

**Solucion implementada:**

1. **Queries parametrizadas** con `bigquery.ScalarQueryParameter`
2. **Whitelist de operadores** permitidos
3. **Validacion de nombres de campos** (solo alfanumericos y `_`)
4. **Validacion de ORDER BY**

```python
# SEGURO
param_placeholder = add_param(value, "STRING")
where_parts.append(f"{sql_field} {operator} {param_placeholder}")
```

**Archivo modificado:** `backend_code/api/main.py` - funcion `build_sql_from_semantic()`

**Deploy realizado:** Revision `datametricx-backend-api-00004-s7p`

---

## Filtros de Fecha Implementados (2025-12-08)

Se agregaron operadores de fecha para el semantic query.

### Operadores Simples (single condition)

| Operador | SQL Generado |
|----------|--------------|
| `today` | `= CURRENT_DATE()` |
| `yesterday` | `= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)` |
| `last_7_days` | `>= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)` |
| `last_14_days` | `>= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)` |
| `last_30_days` | `>= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)` |
| `last_60_days` | `>= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)` |
| `last_90_days` | `>= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)` |
| `this_week` | `>= DATE_TRUNC(CURRENT_DATE(), WEEK)` |
| `this_month` | `>= DATE_TRUNC(CURRENT_DATE(), MONTH)` |
| `this_quarter` | `>= DATE_TRUNC(CURRENT_DATE(), QUARTER)` |
| `this_year` | `>= DATE_TRUNC(CURRENT_DATE(), YEAR)` |

### Operadores Complejos (multiple conditions)

| Operador | SQL Generado |
|----------|--------------|
| `last_week` | `>= DATE_TRUNC(... -1 WEEK) AND < DATE_TRUNC(CURRENT_DATE(), WEEK)` |
| `last_month` | `>= DATE_TRUNC(... -1 MONTH) AND < DATE_TRUNC(CURRENT_DATE(), MONTH)` |
| `last_quarter` | `>= DATE_TRUNC(... -1 QUARTER) AND < DATE_TRUNC(CURRENT_DATE(), QUARTER)` |
| `last_year` | `>= DATE_TRUNC(... -1 YEAR) AND < DATE_TRUNC(CURRENT_DATE(), YEAR)` |

### Operador BETWEEN

```json
{
  "field": "date_date",
  "operator": "between",
  "value": ["2024-01-01", "2024-12-31"]
}
```

**Archivo modificado:** `backend_code/api/main.py` - funcion `build_sql_from_semantic()`

**Deploy realizado:** Revision `datametricx-backend-api-00005-mr8`

### Checklist de Seguridad Pre-Produccion

- [x] Parametrizar queries SQL
- [ ] Configurar FRONTEND_URLS para produccion
- [ ] Remover `sql` del response (o solo para SysOwner)
- [ ] Mover AUTHORIZED_SYS_OWNERS a variable de entorno
- [ ] Configurar Cloud Armor para DDoS
- [ ] Implementar rate limiting

---

## Resumen de Documentacion del Proyecto

| Documento | Ubicacion | Descripcion |
|-----------|-----------|-------------|
| Progreso Desarrollo | `docs/DESARROLLO_SEMANTIC_EDITOR.md` | Este archivo - historial completo |
| Diccionario de Datos | `docs/DICCIONARIO_DATOS_META_ADS.md` | 40+ metricas, 13 entities, funnel e-commerce |
| Spec Viz/Dashboards | `docs/VIZ_DASHBOARDS_SPEC.md` | Arquitectura sistema de visualizaciones |
| Auditoria Seguridad | `docs/SECURITY_AUDIT.md` | Analisis de vulnerabilidades y correcciones |

---

## Comandos Utiles para Desarrollo

### Calentar Cloud Run (antes de trabajar)
```bash
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "https://datametricx-backend-api-jrzfm3jccq-uc.a.run.app/"
```

### Re-autenticar gcloud
```bash
gcloud auth login
```

### Deploy del backend
```bash
cd projects/datametricx-prod/backend_code/api
gcloud run deploy datametricx-backend-api --source . --project=datametricx-prod --region=us-central1
```

### Verificar permisos de Cloud Run
```bash
gcloud run services get-iam-policy datametricx-backend-api \
  --project=datametricx-prod --region=us-central1
```

### Agregar usuario como invoker
```bash
gcloud run services add-iam-policy-binding datametricx-backend-api \
  --region=us-central1 \
  --member="user:{EMAIL}" \
  --role="roles/run.invoker" \
  --project=datametricx-prod
```

### Subir entities a GCS
```bash
gsutil cp semantic_layer/core/entities/meta/*.json \
  gs://datametricx-semantic-models/core/entities/meta/
```

### Ver logs de Cloud Run
```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="datametricx-backend-api"' \
  --project=datametricx-prod --limit=50
```

---

*Ultima actualizacion: 2025-12-08*

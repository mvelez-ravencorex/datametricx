# Auditoria de Seguridad - DataMetricX Backend

**Fecha:** 2025-12-08
**Version:** 1.0
**Auditor:** Claude (AI)
**Estado:** Revision inicial

---

## Resumen Ejecutivo

| Categoria | Estado | Riesgo |
|-----------|--------|--------|
| Autenticacion | OK | Bajo |
| Autorizacion | OK | Bajo |
| Inyeccion SQL | **CORREGIDO** | Bajo |
| Validacion de Inputs | OK | Bajo |
| CORS | REVISAR | Bajo |
| Path Traversal | OK | Bajo |
| Exposicion de Datos | OK | Bajo |
| Multi-tenancy | OK | Bajo |

---

## 1. Autenticacion

### Estado: OK

**Implementacion:**
- Firebase Auth con verificacion de tokens JWT
- Soporte para dos modos: directo (Authorization) y proxy (X-Firebase-Auth)
- Manejo correcto de tokens expirados, revocados e invalidos

**Puntos positivos:**
- `verify_firebase_token()` valida correctamente el token
- Maneja multiples casos de error (InvalidIdTokenError, ExpiredIdTokenError, RevokedIdTokenError)
- No expone detalles del error al cliente

**Recomendaciones:**
- Ninguna critica

---

## 2. Autorizacion

### Estado: OK

**Implementacion:**
- Verificacion de membership en tenant (`verify_tenant_membership`)
- Verificacion de roles (owner, admin, analyst, member)
- SysOwner tiene acceso total pero esta hardcodeado

**Puntos positivos:**
- `verify_tenant_membership()` valida que el usuario pertenece al tenant
- Roles verificados en endpoints sensibles (delete secrets, etc.)
- SysOwner verificado con `sys_owner` flag Y `role == "SysOwner"`

**Codigo seguro:**
```python
# Ejemplo: delete credentials requiere owner/admin
verify_tenant_membership(
    tenant_id=tenant_id,
    user_uid=user_uid,
    required_roles=["owner", "admin"]
)
```

**Vulnerabilidad potencial - Lista de SysOwners hardcodeada:**
```python
# Linea 362-365
AUTHORIZED_SYS_OWNERS = [
    "martin.velez@ravencorex.com",
]
```
**Riesgo:** Bajo - Solo permite auto-asignacion, no escalamiento
**Recomendacion:** Mover a variable de entorno o Firestore

---

## 3. Inyeccion SQL

### Estado: CORREGIDO (2025-12-08)

**Vulnerabilidad encontrada en `build_sql_from_semantic()` (lineas 1802-1955):**

```python
# Linea 1908 - tenant_id se inserta directamente
if not is_sys_owner:
    where_parts.append(f"t.tenant_id = '{tenant_id}'")

# Lineas 1922-1929 - Valores de filtros se insertan con f-string
if isinstance(value, str):
    where_parts.append(f"{sql_field} {operator} '{value}'")
```

**Problema:** Los valores se concatenan directamente en el SQL sin parametrizacion.

**Vector de ataque:**
Si un atacante puede manipular:
- `tenant_id` en el JWT (no posible si Firebase lo valida)
- Valores de `filters` en el request (posible)

**Ejemplo de payload malicioso:**
```json
{
  "filters": [
    {"field": "campaign_name", "operator": "=", "value": "'; DROP TABLE users; --"}
  ]
}
```

**Mitigacion actual:**
- `tenant_id` viene del JWT de Firebase (seguro)
- BigQuery tiene cierta proteccion contra inyeccion

**CORRECCION APLICADA (2025-12-08):**

Se implementaron las siguientes mejoras de seguridad:

1. **Queries parametrizadas:** Todos los valores ahora usan `bigquery.ScalarQueryParameter`
2. **Whitelist de operadores:** Solo se permiten operadores seguros (=, !=, <, >, LIKE, IN, etc.)
3. **Validacion de campos:** Los nombres de campos se validan para contener solo caracteres alfanumericos
4. **Validacion de ORDER BY:** Los campos de ordenamiento tambien se validan

```python
# ANTES (vulnerable):
where_parts.append(f"{sql_field} {operator} '{value}'")

# DESPUES (seguro):
param_placeholder = add_param(value, "STRING")
where_parts.append(f"{sql_field} {operator} {param_placeholder}")

# Donde add_param() crea:
query_params.append(bigquery.ScalarQueryParameter(param_name, param_type, value))
```

---

## 4. Validacion de Inputs

### Estado: OK

**Puntos positivos:**
- Pydantic models validan estructura de requests
- `backfill_days` tiene limites (ge=1, le=90)
- `limit` tiene maximo (le=10000)
- Datasources validados contra lista permitida

**Ejemplo:**
```python
valid_datasources = ["meta", "tiktok", "shopify", "ga4", "mercadolibre", "amazon"]
if datasource not in valid_datasources:
    raise HTTPException(status_code=400, ...)
```

---

## 5. CORS

### Estado: REVISAR

**Configuracion actual (lineas 51-73):**
```python
FRONTEND_URLS = os.environ.get("FRONTEND_URLS",
    "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000,http://localhost:8080")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[...],
)
```

**Problema potencial:**
- Default incluye solo localhost (OK para desarrollo)
- En produccion debe configurarse via variable de entorno
- `allow_credentials=True` con origenes especificos es correcto

**Recomendacion:**
- Verificar que `FRONTEND_URLS` este configurado en Cloud Run para produccion
- No usar `allow_origins=["*"]` con `allow_credentials=True`

---

## 6. Path Traversal

### Estado: OK

**Proteccion implementada (lineas 1447-1452, 1574-1579):**
```python
# Validacion de path traversal
if ".." in path:
    raise HTTPException(
        status_code=400,
        detail="Invalid path"
    )

# Solo permite archivos en core/
if not path.startswith("core/"):
    raise HTTPException(
        status_code=403,
        detail="Access denied. Only core models are accessible."
    )
```

**Puntos positivos:**
- Bloquea `..` en paths
- Restringe acceso a carpeta `core/` unicamente
- Valida extension `.json` para escritura

---

## 7. Exposicion de Datos Sensibles

### Estado: OK

**Puntos positivos:**
- Queries excluyen `tenant_id` del response: `SELECT * EXCEPT(tenant_id)`
- Logs no exponen tokens completos
- Errores no revelan estructura interna

**Punto de atencion:**
```python
# Linea 2110 - SQL se incluye en response (para debugging)
"sql": sql  # Include for debugging
```

**Recomendacion:**
- Remover `sql` del response en produccion
- O solo incluirlo para SysOwner

---

## 8. Multi-tenancy

### Estado: OK

**Implementacion:**
- Todas las queries filtran por `tenant_id`
- SysOwner puede ver todos los datos (diseño intencional)
- Verificacion de membership antes de operaciones

**Codigo seguro:**
```python
# Lineas 1907-1908
if not is_sys_owner:
    where_parts.append(f"t.tenant_id = '{tenant_id}'")
```

---

## 9. Secretos y Credenciales

### Estado: OK

**Implementacion:**
- Credenciales OAuth se guardan en Secret Manager (no en codigo)
- No hay API keys hardcodeadas
- Service accounts con permisos minimos

**Recomendacion:**
- Rotar credenciales periodicamente
- Implementar audit log para acceso a secrets

---

## 10. Cloud Run / Infraestructura

### Estado: REVISAR

**Configuracion actual:**
```yaml
ingress: all  # Permite trafico desde cualquier origen
```

**Recomendacion para produccion:**
- Cambiar a `ingress: internal-and-cloud-load-balancing` si se usa Load Balancer
- O mantener `all` si se usa Firebase Hosting rewrites

---

## Vulnerabilidades Criticas

### 1. SQL Injection en Semantic Query (MEDIO)

**Archivo:** `main.py`
**Lineas:** 1922-1929
**Impacto:** Un atacante podria inyectar SQL malicioso via filtros
**Probabilidad:** Baja (requiere autenticacion valida)
**Solucion:** Usar parametros de BigQuery

### Codigo vulnerable:
```python
if isinstance(value, str):
    where_parts.append(f"{sql_field} {operator} '{value}'")
```

### Codigo corregido:
```python
# Usar job_config con query_parameters
from google.cloud import bigquery

def build_sql_from_semantic(...) -> tuple[str, list]:
    params = []
    # ...
    if isinstance(value, str):
        param_name = f"param_{len(params)}"
        where_parts.append(f"{sql_field} {operator} @{param_name}")
        params.append(bigquery.ScalarQueryParameter(param_name, "STRING", value))
    # ...
    return sql, params
```

---

## Checklist de Seguridad Pre-Produccion

- [x] **Parametrizar queries SQL** en `build_sql_from_semantic` (COMPLETADO 2025-12-08)
- [ ] Configurar `FRONTEND_URLS` con dominios de produccion
- [ ] Remover `sql` del response de semantic query (o solo para SysOwner)
- [ ] Mover `AUTHORIZED_SYS_OWNERS` a variable de entorno
- [ ] Configurar Cloud Armor para DDoS protection
- [ ] Habilitar VPC Service Controls (opcional)
- [ ] Configurar alertas de seguridad en Cloud Monitoring
- [ ] Implementar rate limiting (Cloud Armor o codigo)
- [ ] Audit log para operaciones sensibles

---

## Proximos Pasos

1. **Prioridad ALTA:** Corregir SQL injection en semantic query
2. **Prioridad MEDIA:** Configurar CORS para produccion
3. **Prioridad BAJA:** Remover debug info del response

---

*Auditoria realizada: 2025-12-08*
*Proxima revision recomendada: Antes de ir a produccion*

# Agent Scope - Frontend/Firebase Agent

## ALCANCE DE ESTE AGENTE

### Permitido (SI puedo modificar):
- `datametricx/frontend/**` - Todo el código React/TypeScript del frontend
- `firebase.json` - Configuración de Firebase Hosting
- `firestore.rules` - Reglas de seguridad de Firestore
- `firestore.indexes.json` - Índices de Firestore
- Scripts de Firebase Admin SDK para gestión de usuarios/claims

### Prohibido (NUNCA modificar):

| Path | Razón |
|------|-------|
| `ravencorex-terraform/**` | Infraestructura manejada por Terraform |
| `**/backend_code/**` | Backend en Cloud Run - otro agente |
| Cualquier archivo `.py` en carpetas de GCP | Servicios de Google Cloud |
| Cualquier comando `gcloud run deploy` | Desincroniza Terraform |
| Cualquier recurso de Google Cloud Platform | Genera costos no contemplados |

## Si necesito cambios en el backend:

1. **NO** editar archivos directamente
2. **Documentar** qué cambio se necesita en este archivo o en conversación
3. **Informar** al usuario para coordinar con el agente de GCP/Terraform

## Cambios pendientes para el Backend Agent

### 1. Soporte para header X-Firebase-Auth (REQUERIDO para desarrollo local)

**Archivo:** `auth.py`

**Problema:** El frontend en desarrollo usa Vite proxy que necesita enviar dos tokens:
- IAM token en `Authorization` header (para Cloud Run)
- Firebase token en `X-Firebase-Auth` header (para autenticación de usuario)

**Cambio requerido en `verify_firebase_token()`:**
```python
async def verify_firebase_token(
    request: Request,
    authorization: str = Header(None),
    x_firebase_auth: Optional[str] = Header(None, alias="X-Firebase-Auth")  # AGREGAR
) -> dict:
    # Prioridad: X-Firebase-Auth > Authorization
    id_token = None

    if x_firebase_auth:
        id_token = x_firebase_auth
    elif authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            id_token = parts[1]

    # ... resto del código
```

### 2. Extraer role y sys_owner del token (REQUERIDO para SysOwner)

**Archivo:** `auth.py`

**Cambio requerido en `get_current_user()`:**
```python
async def get_current_user(token_data: dict = Depends(verify_firebase_token)) -> dict:
    return {
        "uid": token_data.get("uid"),
        "email": token_data.get("email"),
        "email_verified": token_data.get("email_verified", False),
        "name": token_data.get("name"),
        "picture": token_data.get("picture"),
        "tenant_id": token_data.get("tenant_id"),
        "role": token_data.get("role"),  # AGREGAR - para verificar SysOwner
        "sys_owner": token_data.get("sys_owner", False),  # AGREGAR - flag SysOwner
    }
```

---

**Última actualización:** 2025-12-07
**Motivo:** Separación de responsabilidades entre agentes

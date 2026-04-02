# DataMetricX - Documentación de Funcionalidades

## Tabla de Contenidos

1. [SysOwner (Super Admin)](#1-sysowner-super-admin)
2. [Sistema RBAC](#2-sistema-rbac)
3. [Filtrado de tenant_id por Rol](#3-filtrado-de-tenant_id-por-rol)
4. [Development Page - Editor de Capa Semántica](#4-development-page---editor-de-capa-semántica)

---

## 1. SysOwner (Super Admin)

### Descripción
SysOwner es el rol de super administrador del sistema con acceso total a todas las funcionalidades y datos.

### Implementación

#### Frontend (AuthContext.tsx)
```typescript
// Estado en AuthContext
const [isSysOwner, setIsSysOwner] = useState(false)
const [jwtClaims, setJwtClaims] = useState<Record<string, unknown> | null>(null)

// Detección desde JWT custom claims
const idTokenResult = await user.getIdTokenResult()
const sysOwnerDetected =
  idTokenResult.claims.sys_owner === true ||
  idTokenResult.claims.role === 'SysOwner'
setIsSysOwner(sysOwnerDetected)
```

#### Custom Claims requeridos en Firebase Auth
```json
{
  "sys_owner": true,
  "role": "SysOwner"
}
```

#### Script para configurar SysOwner
Ubicación: `/backend_code/api/scripts/set_sysowner.py`

```bash
# Ejecutar desde Cloud Shell o con credenciales de Firebase Admin
python set_sysowner.py <USER_UID>
```

### Permisos de SysOwner
- Acceso total a todas las funcionalidades
- Puede ver `tenant_id` en todas las entidades
- Bypass de todas las restricciones de permisos
- Acceso a todos los tenants

### Uso en componentes
```typescript
const { isSysOwner, jwtClaims } = useAuth()

// Verificar si es SysOwner
if (isSysOwner) {
  // Mostrar funcionalidad de admin
}
```

---

## 2. Sistema RBAC

### Arquitectura

```
Firestore Structure:
├── /system_permissions/{permissionId}  # Global - Solo lectura
├── /roles/{roleId}                      # Global - Sistema
└── /tenants/{tenantId}/
    ├── /permission_sets/{setId}         # Por tenant
    ├── /data_access_rules/{ruleId}      # Por tenant
    └── /members/{userId}                # Asignación de roles
```

### Colecciones

#### 1. system_permissions (Global)
Permisos atómicos del sistema. Solo lectura para usuarios.

```typescript
interface SystemPermission {
  id: string           // "dashboards.view"
  category: string     // "dashboards"
  name: string         // "View Dashboards"
  description: string
  requires?: string[]  // Dependencias
}
```

**Categorías de permisos:**
- `dashboards`: view, create, edit, delete, share
- `datasets`: view, save_looks, download, sql
- `entity`: showTenantID
- `datasources`: view, create, edit, delete
- `semantic`: view, edit, deploy
- `users`: view, invite, edit, remove
- `groups`: manage
- `roles`: manage
- `billing`: view, manage
- `settings`: view, edit
- `schedules`: view, create, manage_all
- `alerts`: view, create, manage_all

#### 2. roles (Global)
Roles predefinidos del sistema.

```typescript
interface Role {
  id: string
  name: string
  description: string
  permissionSets: string[]      // Referencias a permission_sets
  dataAccessRule: string        // Referencia a data_access_rule
  entity?: {
    showTenantID?: boolean      // Configuración de visibilidad
  }
  isSystem: boolean
  isDefault: boolean
}
```

**Roles del sistema:**
| Role | Descripción | showTenantID |
|------|-------------|--------------|
| sysadmin | Super admin con acceso total | ✅ true |
| owner | Dueño del tenant, incluye billing | ❌ false |
| admin | Administrador, sin billing | ❌ false |
| analyst | Crea dashboards, explora datos | ❌ false |
| developer | Desarrolla capa semántica | ❌ false |
| viewer | Solo ve dashboards publicados | ❌ false |

#### 3. permission_sets (Por Tenant)
Agrupaciones de permisos.

```typescript
interface PermissionSet {
  id: string
  name: string
  description: string
  permissions: string[]  // IDs de system_permissions
  isSystem: boolean
}
```

#### 4. data_access_rules (Por Tenant)
Reglas de acceso a datos (Row Level Security).

```typescript
interface DataAccessRule {
  id: string
  name: string
  description: string
  datasetAccess: {
    mode: 'all' | 'specific'
    datasets?: string[]
  }
  rowFilters: RowFilter[]
  fieldRestrictions: FieldRestriction[]
  isSystem: boolean
}
```

### Script de Inicialización

Ubicación: `/backend_code/api/scripts/init_rbac.py`

```bash
# Inicializar todo el sistema RBAC
python init_rbac.py

# Inicializar solo un tenant específico
python init_rbac.py <TENANT_ID>
```

### Firestore Rules

```javascript
// system_permissions - Solo lectura para autenticados
match /system_permissions/{permissionId} {
  allow read: if isAuthenticated();
  allow write: if false;
}

// roles - Solo lectura para autenticados
match /roles/{roleId} {
  allow read: if isAuthenticated();
  allow write: if false;
}
```

---

## 3. Filtrado de tenant_id por Rol

### Descripción
El campo `tenant_id` en las entidades/datasets se oculta o muestra según la configuración del rol del usuario.

### Implementación

#### AuthContext.tsx
```typescript
interface RoleSettings {
  id: string
  name: string
  entity?: {
    showTenantID?: boolean
  }
}

// Cargar configuración del rol
const loadRoleSettings = async (roleId: string) => {
  const roleRef = doc(db, 'roles', roleId)
  const roleSnap = await getDoc(roleRef)
  if (roleSnap.exists()) {
    const data = roleSnap.data()
    setRoleSettings({
      id: roleSnap.id,
      name: data.name,
      entity: data.entity
    })
  }
}

// Propiedad derivada
const canShowTenantId = isSysOwner || (roleSettings?.entity?.showTenantID === true)
```

#### DatasetsNew.tsx (Explore)
```typescript
const { canShowTenantId } = useAuth()

// Filtrar campos
const isFieldAllowed = (entityId: string, fieldId: string) => {
  // Ocultar tenant_id si el rol no tiene permiso
  if (fieldId === 'tenant_id' && !canShowTenantId) {
    return false
  }
  if (!allowedFields) return true
  return allowedFields.has(`${entityId}.${fieldId}`)
}
```

### Configuración en Firestore

Para que un rol pueda ver `tenant_id`:
```json
// /roles/sysadmin
{
  "id": "sysadmin",
  "name": "SysAdmin",
  "entity": {
    "showTenantID": true
  }
}
```

---

## 4. Development Page - Editor de Capa Semántica

### Descripción
IDE integrado para explorar y editar la Capa Semántica (Entities y Datasets).

### Componentes

#### Layout
- **Panel izquierdo**: FileTree con estructura de carpetas/archivos
- **Panel derecho**: Visor/Editor de código JSON

#### FileTree
```typescript
interface FileTreeNode {
  name: string
  path: string
  type: 'folder' | 'file'
  entityType?: 'entity' | 'dataset'
  children?: FileTreeNode[]
}
```

#### JsonViewer
Muestra el contenido con syntax highlighting personalizado para entidades semánticas.

### Modo Edición con Monaco Editor

#### Dependencias
```bash
pnpm add @monaco-editor/react
```

#### Implementación
```typescript
import Editor from '@monaco-editor/react'

// En el componente JsonViewer
{isEditing ? (
  <Editor
    height="100%"
    language="json"
    theme={isDark ? 'vs-dark' : 'light'}
    value={editContent}
    onChange={(value) => onEditContentChange(value || '')}
    options={{
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      formatOnPaste: true,
      formatOnType: true,
      tabSize: 2,
    }}
  />
) : (
  // Vista de solo lectura con SemanticHighlight
)}
```

### Características del Editor
- Syntax highlighting para JSON
- Números de línea
- Auto-formateo al pegar y escribir
- Soporte de temas (dark/light)
- Validación JSON antes de guardar

### Estados de Edición
```typescript
const [isEditing, setIsEditing] = useState(false)
const [editContent, setEditContent] = useState('')
const [isSaving, setIsSaving] = useState(false)
const [editError, setEditError] = useState<string | null>(null)
```

### Flujo de Edición
1. Usuario hace clic en "Editar"
2. Se carga el contenido JSON en el editor
3. Usuario modifica el código
4. Al guardar, se valida el JSON
5. Se envía al backend para persistir (pendiente)

### Backend API (v1.3.0+)

#### Guardar archivo
```
PUT /api/semantic/models/file
Authorization: Bearer <JWT con sys_owner=true>
Content-Type: application/json

Body:
{
  "path": "/core/entities/meta/meta_campaigns.json",
  "content": { ... entity/dataset JSON ... }
}

Response:
{
  "success": true,
  "message": "File saved successfully",
  "path": "/core/entities/meta/meta_campaigns.json"
}
```

#### Eliminar archivo
```
DELETE /api/semantic/models/file?path=/core/entities/meta/example.json
Authorization: Bearer <JWT con sys_owner=true>

Response:
{
  "success": true,
  "message": "File deleted successfully"
}
```

> **Nota**: Ambos endpoints requieren que el usuario tenga `sys_owner: true` en sus JWT custom claims.

### Frontend Service

```typescript
// semanticService.ts

// Guardar archivo (Solo SysOwner)
export async function saveFileContent(
  path: string,
  content: SemanticEntity | SemanticDataset
): Promise<{ success: boolean; message: string; path: string }>

// Eliminar archivo (Solo SysOwner)
export async function deleteFile(
  path: string
): Promise<{ success: boolean; message: string }>
```

### Flujo de Guardado

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│   Usuario   │────▶│ Monaco Editor│────▶│  Validación │────▶│   API PUT   │
│ clic Editar │     │  modifica    │     │    JSON     │     │   Backend   │
└─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
                                                                    │
                    ┌──────────────┐     ┌─────────────┐            │
                    │ Cierra editor│◀────│  Actualiza  │◀───────────┘
                    │ modo lectura │     │   estado    │      Success
                    └──────────────┘     └─────────────┘
```

---

## Archivos Modificados

### Frontend
| Archivo | Cambios |
|---------|---------|
| `src/contexts/AuthContext.tsx` | SysOwner, RoleSettings, canShowTenantId |
| `src/pages/DatasetsNew.tsx` | Filtrado de tenant_id |
| `src/pages/Development.tsx` | Editor con Monaco, integración con API de guardado |
| `src/services/semanticService.ts` | saveFileContent(), deleteFile() |

### Backend Scripts
| Archivo | Propósito |
|---------|-----------|
| `scripts/init_rbac.py` | Inicializar colecciones RBAC |
| `scripts/set_sysowner.py` | Configurar usuario como SysOwner |

### Firestore
| Colección | Tipo |
|-----------|------|
| `/system_permissions` | Global |
| `/roles` | Global |
| `/tenants/{id}/permission_sets` | Por tenant |
| `/tenants/{id}/data_access_rules` | Por tenant |

---

## Próximos Pasos

1. ~~**Backend**: Implementar endpoint para guardar archivos de capa semántica~~ ✅ Completado v1.3.0
2. **Groups**: Implementar grupos de usuarios
3. **Custom Roles**: Permitir crear roles personalizados por tenant
4. **Data Access Rules**: Implementar Row Level Security completo
5. **Audit Log**: Registrar cambios en la capa semántica
6. **Validación Semántica**: Validar estructura de entity/dataset antes de guardar
7. **Crear archivos**: UI para crear nuevas entities/datasets

---

*Última actualización: Diciembre 2024*

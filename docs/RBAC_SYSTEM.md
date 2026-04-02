# RBAC System - DataMetricX

## Overview

Role-Based Access Control system for DataMetricX, inspired by Looker's permission model.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RBAC Architecture                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐          │
│  │ Permissions │────▶│ Permission Sets  │────▶│     Roles       │          │
│  │  (atomic)   │     │ (agrupaciones)   │     │ (asignables)    │          │
│  └─────────────┘     └──────────────────┘     └────────┬────────┘          │
│                                                         │                    │
│                                                         ▼                    │
│  ┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐          │
│  │   Groups    │────▶│  Group Members   │────▶│     Users       │          │
│  │ (equipos)   │     │   (relación)     │     │  (tenant_members)│         │
│  └─────────────┘     └──────────────────┘     └─────────────────┘          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    Data Access Rules                             │       │
│  │  - Dataset restrictions (qué datasets puede ver)                 │       │
│  │  - Row filters (filtros adicionales por atributos)               │       │
│  │  - Field restrictions (campos ocultos)                           │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Firestore Collections Structure

```
Firestore
├── system_permissions/              # Global (read-only)
│   ├── dashboards.view
│   ├── dashboards.create
│   ├── datasets.view
│   ├── entity.showTenantID          # Control de visibilidad tenant_id
│   └── ...
│
├── roles/                           # Global - System Roles (read-only)
│   ├── sysadmin                     # Super admin con entity.showTenantID
│   ├── owner
│   ├── admin
│   ├── analyst
│   ├── developer
│   └── viewer
│
└── tenants/{tenantId}/
    ├── permission_sets/             # Permission groups (por tenant)
    │   ├── all_permissions (system)
    │   ├── viewer_set (system)
    │   ├── analyst_set (system)
    │   ├── admin_set (system)
    │   ├── developer_set (system)
    │   ├── sysadmin_set (system)
    │   └── custom_sets...
    │
    ├── data_access_rules/           # Data access rules (por tenant)
    │   ├── all_data (system)
    │   └── custom_rules...
    │
    ├── groups/                      # User groups
    │   └── {groupId}
    │
    └── members/                     # Asignación de rol
        └── {userId}
            ├── role: "analyst"      # Referencia a /roles/{roleId}
            └── groups: ["marketing_team"]
```

> **IMPORTANTE**: Los roles están a nivel raíz (`/roles`) porque son del sistema, no por tenant.
> Los permission_sets y data_access_rules sí son por tenant para permitir personalización.

## Data Models

### Permission (system_permissions)

```typescript
interface Permission {
  id: string                    // "dashboards.view"
  category: string              // "dashboards", "explore", "users", etc.
  name: string                  // "View Dashboards"
  description: string           // "Can view published dashboards"
  requires?: string[]           // Dependencies: ["dashboards.view"]
}
```

### Permission Set (tenants/{tenantId}/permission_sets)

```typescript
interface PermissionSet {
  id: string
  name: string                  // "Dashboard Viewer"
  description: string
  permissions: string[]         // ["dashboards.view", "explore.view"]
  isSystem: boolean             // true = not editable
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### Data Access Rule (tenants/{tenantId}/data_access_rules)

```typescript
interface DataAccessRule {
  id: string
  name: string                    // "Marketing Team Access"
  description: string

  datasetAccess: {
    mode: 'all' | 'whitelist' | 'blacklist'
    datasets?: string[]           // Dataset IDs
  }

  rowFilters?: {
    dataset: string               // "marketing_performance"
    sql_filter: string            // "country IN ('US', 'MX')"
  }[]

  fieldRestrictions?: {
    dataset: string
    hiddenFields: string[]        // ["cost", "revenue"]
  }[]

  isSystem: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### Role (/roles - Global)

```typescript
interface Role {
  id: string
  name: string                    // "Analyst"
  description: string

  permissionSets: string[]        // ["analyst_set"]
  dataAccessRule: string          // "all_data"

  // Configuración especial por entidad
  entity?: {
    showTenantID?: boolean        // Si true, muestra tenant_id en Datasets
  }

  isSystem: boolean               // System roles not editable
  isDefault: boolean              // Default role for new users

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

> **Nota**: Los roles están a nivel raíz porque son del sistema. La configuración `entity.showTenantID`
> controla si el usuario puede ver la dimensión `tenant_id` en Datasets/Explore.

### Group (tenants/{tenantId}/groups)

```typescript
interface Group {
  id: string
  name: string                    // "Marketing Team"
  description: string
  roles: string[]                 // Roles inherited by members
  members: string[]               // User UIDs
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### TenantMember (tenants/{tenantId}/members) - Updated

```typescript
interface TenantMember {
  userId: string
  email: string
  displayName: string

  // NEW: Direct user roles
  roles: string[]                 // ["analyst", "custom_role"]

  // NEW: Group memberships
  groups: string[]                // ["marketing_team"]

  // DEPRECATED: simple role (migrate to roles[])
  role?: 'owner' | 'admin' | 'analyst' | 'viewer'

  joinedAt: Timestamp
  invitedBy: string
}
```

## System Permissions

| ID | Category | Name | Description |
|----|----------|------|-------------|
| dashboards.view | dashboards | View Dashboards | Can view published dashboards |
| dashboards.create | dashboards | Create Dashboards | Can create new dashboards |
| dashboards.edit | dashboards | Edit Dashboards | Can edit existing dashboards |
| dashboards.delete | dashboards | Delete Dashboards | Can delete dashboards |
| dashboards.share | dashboards | Share Dashboards | Can share dashboards with others |
| explore.view | explore | Access Explore | Can access the Explore feature |
| explore.save_looks | explore | Save Looks | Can save explorations as Looks |
| explore.download | explore | Download Data | Can download query results |
| explore.sql | explore | Write SQL | Can write custom SQL queries |
| datasources.view | datasources | View Datasources | Can view datasource configurations |
| datasources.create | datasources | Create Datasources | Can create new datasources |
| datasources.edit | datasources | Edit Datasources | Can edit datasource settings |
| datasources.delete | datasources | Delete Datasources | Can delete datasources |
| semantic.view | semantic | View Semantic Layer | Can view entities and datasets |
| semantic.edit | semantic | Edit Semantic Layer | Can modify entities and datasets |
| semantic.deploy | semantic | Deploy Changes | Can deploy semantic layer changes |
| users.view | users | View Users | Can view user list |
| users.invite | users | Invite Users | Can invite new users |
| users.edit | users | Edit Users | Can modify user settings |
| users.remove | users | Remove Users | Can remove users from tenant |
| groups.manage | users | Manage Groups | Can create and manage groups |
| roles.manage | users | Manage Roles | Can create and manage roles |
| billing.view | billing | View Billing | Can view billing information |
| billing.manage | billing | Manage Billing | Can modify billing settings |
| settings.view | settings | View Settings | Can view tenant settings |
| settings.edit | settings | Edit Settings | Can modify tenant settings |
| schedules.view | schedules | View Schedules | Can view scheduled deliveries |
| schedules.create | schedules | Create Schedules | Can create scheduled deliveries |
| schedules.manage_all | schedules | Manage All Schedules | Can manage all users' schedules |
| alerts.view | alerts | View Alerts | Can view data alerts |
| alerts.create | alerts | Create Alerts | Can create data alerts |
| alerts.manage_all | alerts | Manage All Alerts | Can manage all users' alerts |

## System Roles

| Role | Permission Sets | Data Access | showTenantID | Default |
|------|-----------------|-------------|--------------|---------|
| sysadmin | sysadmin_set | all_data | ✅ true | No |
| owner | all_permissions | all_data | ❌ false | No |
| admin | admin_set, analyst_set | all_data | ❌ false | No |
| developer | developer_set, analyst_set | all_data | ❌ false | No |
| analyst | analyst_set | all_data | ❌ false | No |
| viewer | viewer_set | all_data | ❌ false | Yes |

> **sysadmin**: Único rol con `entity.showTenantID = true`, puede ver tenant_id en Datasets.

## Permission Resolution Algorithm

```python
def resolve_user_permissions(tenant_id: str, user_id: str) -> dict:
    member = get_tenant_member(tenant_id, user_id)

    # Collect all roles (direct + from groups)
    all_roles = set(member.roles)
    for group_id in member.groups:
        group = get_group(tenant_id, group_id)
        all_roles.update(group.roles)

    # Resolve permission sets from each role
    all_permissions = set()
    data_access_rules = []

    for role_id in all_roles:
        role = get_role(tenant_id, role_id)

        for perm_set_id in role.permission_sets:
            perm_set = get_permission_set(tenant_id, perm_set_id)
            all_permissions.update(perm_set.permissions)

        data_access_rules.append(role.data_access_rule)

    # Combine data access (most permissive wins)
    effective_data_access = combine_data_access(data_access_rules)

    return {
        "permissions": list(all_permissions),
        "data_access": effective_data_access,
        "roles": list(all_roles)
    }
```

## UI Structure

```
Settings > Access Control
├── Roles
│   ├── System Roles (read-only)
│   │   ├── Owner
│   │   ├── Admin
│   │   ├── Analyst
│   │   └── Viewer
│   └── Custom Roles
│       └── [+ Create Role]
│
├── Permission Sets
│   ├── System Sets (read-only)
│   └── Custom Sets
│       └── [+ Create Permission Set]
│
├── Data Access
│   ├── All Data (system)
│   └── Custom Rules
│       └── [+ Create Data Access Rule]
│
└── Groups
    └── [+ Create Group]
```

## Firestore Security Rules

```javascript
// system_permissions - Solo lectura para autenticados
match /system_permissions/{permissionId} {
  allow read: if isAuthenticated();
  allow write: if false;  // Solo Admin SDK
}

// roles - Solo lectura para autenticados (nivel raíz)
match /roles/{roleId} {
  allow read: if isAuthenticated();
  allow write: if false;  // Solo Admin SDK
}
```

## Script de Inicialización

Ubicación: `/backend_code/api/scripts/init_rbac.py`

```bash
# Inicializar todo (system_permissions, roles, y RBAC por cada tenant)
python init_rbac.py

# Inicializar solo un tenant específico (permission_sets, data_access_rules)
python init_rbac.py <TENANT_ID>
```

El script crea:
- 33 system_permissions (global)
- 6 roles del sistema (global)
- 6 permission_sets por tenant
- 1 data_access_rule por tenant (all_data)

## Frontend Implementation

### AuthContext - Role Settings

```typescript
// Cargar configuración del rol desde /roles/{roleId}
const loadRoleSettings = async (roleId: string) => {
  const roleRef = doc(db, 'roles', roleId)
  const roleSnap = await getDoc(roleRef)
  if (roleSnap.exists()) {
    setRoleSettings({
      id: roleSnap.id,
      name: data.name,
      entity: data.entity
    })
  }
}

// Derivar permiso para mostrar tenant_id
const canShowTenantId = isSysOwner || (roleSettings?.entity?.showTenantID === true)
```

### DatasetsNew - Filtrado de tenant_id

```typescript
const { canShowTenantId } = useAuth()

const isFieldAllowed = (entityId: string, fieldId: string) => {
  if (fieldId === 'tenant_id' && !canShowTenantId) {
    return false
  }
  return true
}
```

---

Last Updated: 2025-12-03

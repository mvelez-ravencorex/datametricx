# SysOwner (Super Admin) Implementation

## Overview

SysOwner is a special role that grants unrestricted access to all tenant data in DataMetricX. This role bypasses Row Level Security (RLS) filters, allowing the user to query data across all tenants.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  AuthContext.tsx                                         │    │
│  │  - Detects sys_owner claim from JWT                      │    │
│  │  - Sets isSysOwner state                                 │    │
│  │  - Grants all permissions when isSysOwner=true           │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Authorization: Bearer <JWT>
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Backend (Cloud Run)                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  main.py                                                 │    │
│  │  - Verifies JWT and extracts claims                      │    │
│  │  - Detects sys_owner or role=SysOwner                    │    │
│  │  - Skips tenant_id WHERE clause for SysOwner             │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BigQuery                                  │
│  - SysOwner queries: No tenant_id filter                        │
│  - Normal users: WHERE tenant_id = '<user_tenant>'              │
└─────────────────────────────────────────────────────────────────┘
```

## JWT Custom Claims Structure

```json
{
  "tenant_id": "*",
  "role": "SysOwner",
  "sys_owner": true,
  "access_all_tenants": true
}
```

### Claim Descriptions

| Claim | Type | Description |
|-------|------|-------------|
| `tenant_id` | string | Set to `"*"` for SysOwner (or can keep original tenant) |
| `role` | string | `"SysOwner"` for super admin |
| `sys_owner` | boolean | Primary flag for SysOwner detection |
| `access_all_tenants` | boolean | Indicates multi-tenant access |

## Backend Implementation

### File: `main.py`

#### 1. Query Builder Modification

```python
def build_sql_from_semantic(
    dataset: dict,
    entity: dict,
    attributes: List[str],
    metrics: List[str],
    filters: List[dict],
    order_by: List[dict],
    limit: int,
    tenant_id: str,
    is_sys_owner: bool = False  # New parameter
) -> str:
    # ...

    # WHERE clause - skip tenant filter for SysOwner
    where_parts = []
    if not is_sys_owner:
        where_parts.append(f"t.tenant_id = '{tenant_id}'")

    # Add other filters...
```

#### 2. Endpoint SysOwner Detection

```python
@app.post("/api/semantic/query")
async def semantic_query(request: QueryRequest, user_info: dict = Depends(verify_jwt)):
    tenant_id = user_info.get("tenant_id")

    # Detect SysOwner from JWT claims
    is_sys_owner = user_info.get("sys_owner", False) or user_info.get("role") == "SysOwner"

    # Allow SysOwner without tenant_id
    if not tenant_id and not is_sys_owner:
        raise HTTPException(status_code=403, detail="Missing tenant_id in JWT")

    # Pass is_sys_owner to query builder
    sql = build_sql_from_semantic(
        dataset, entity, attributes, metrics,
        filters, order_by, limit, tenant_id,
        is_sys_owner=is_sys_owner
    )
```

## Frontend Implementation

### File: `src/contexts/AuthContext.tsx`

#### 1. Interface Extension

```typescript
interface AuthContextType {
  // ... existing properties

  // SysOwner - Super Admin access
  isSysOwner: boolean
  jwtClaims: Record<string, unknown> | null

  // ... rest of interface
}
```

#### 2. State Variables

```typescript
// SysOwner - Super Admin state
const [isSysOwner, setIsSysOwner] = useState(false)
const [jwtClaims, setJwtClaims] = useState<Record<string, unknown> | null>(null)
```

#### 3. SysOwner Detection in onAuthStateChanged

```typescript
// Inside onAuthStateChanged callback
const idTokenResult = await user.getIdTokenResult()

// Save claims and detect SysOwner
setJwtClaims(idTokenResult.claims as Record<string, unknown>)
const sysOwnerDetected =
  idTokenResult.claims.sys_owner === true ||
  idTokenResult.claims.role === 'SysOwner'
setIsSysOwner(sysOwnerDetected)

if (sysOwnerDetected) {
  console.log('🔑 SysOwner detectado - acceso total habilitado')
}
```

#### 4. Permission Helper Override

```typescript
const hasPermission = (permission: keyof typeof PERMISSIONS_MAP['owner']): boolean => {
  // SysOwner has all permissions
  if (isSysOwner) return true

  if (!currentMember) return false
  const rolePermissions = PERMISSIONS_MAP[currentMember.role as MemberRole]
  return rolePermissions[permission]
}
```

#### 5. Cleanup on Sign Out

```typescript
const signOut = async () => {
  await firebaseSignOut(auth)
  setUserProfile(null)
  setCurrentTenant(null)
  setCurrentMember(null)
  setUserTenants([])
  setIsSysOwner(false)
  setJwtClaims(null)
}
```

## Configuration Script

### File: `scripts/set_sysowner.py`

```python
"""
Script para configurar un usuario como SysOwner (Super Admin)
"""
import firebase_admin
from firebase_admin import credentials, auth

if not firebase_admin._apps:
    firebase_admin.initialize_app()

def set_sysowner(user_uid: str) -> bool:
    try:
        user = auth.get_user(user_uid)
        current_claims = user.custom_claims or {}

        new_claims = {
            **current_claims,
            'role': 'SysOwner',
            'sys_owner': True,
            'access_all_tenants': True
        }

        auth.set_custom_user_claims(user_uid, new_claims)
        return True

    except auth.UserNotFoundError:
        return False

if __name__ == "__main__":
    USER_UID = "YOUR_USER_UID_HERE"
    set_sysowner(USER_UID)
```

### Running the Script

```bash
# Ensure you have Application Default Credentials configured
gcloud auth application-default login

# Run with Python 3.11 (homebrew)
/opt/homebrew/bin/python3.11 scripts/set_sysowner.py
```

## How to Configure a New SysOwner

1. **Get the user's Firebase UID** from Firebase Console or Firestore

2. **Edit the script** with the user's UID:
   ```python
   USER_UID = "LyCBbtgicPXqK5hQ9GJvNUhdyTI3"  # Replace with actual UID
   ```

3. **Run the script**:
   ```bash
   /opt/homebrew/bin/python3.11 /path/to/scripts/set_sysowner.py
   ```

4. **User must refresh their token**:
   - Sign out from the application
   - Sign back in
   - Or call `user.getIdToken(true)` programmatically

## Verification

### Check Claims in Firebase Console

1. Go to Firebase Console → Authentication → Users
2. Find the user
3. Click on the three dots → View user info
4. Check custom claims

### Check in Frontend Console

After logging in, you should see:
```
🔑 SysOwner detectado - acceso total habilitado
```

### Check in Backend Logs

When SysOwner makes a query:
```
🔐 SysOwner detected - bypassing tenant filter
```

## Security Considerations

1. **Minimal SysOwner Users**: Only grant SysOwner to essential personnel
2. **Audit Trail**: Consider logging all SysOwner queries
3. **Claim Expiration**: JWT tokens expire, requiring re-authentication
4. **Revocation**: To revoke SysOwner, update claims removing `sys_owner` flag

## Removing SysOwner Access

```python
def remove_sysowner(user_uid: str) -> bool:
    try:
        user = auth.get_user(user_uid)
        current_claims = user.custom_claims or {}

        # Remove SysOwner flags
        new_claims = {k: v for k, v in current_claims.items()
                      if k not in ['sys_owner', 'access_all_tenants']}
        new_claims['role'] = 'owner'  # Downgrade to regular owner

        auth.set_custom_user_claims(user_uid, new_claims)
        return True
    except:
        return False
```

## Integration with RBAC System

### canShowTenantId

SysOwner always has permission to see `tenant_id` in Datasets/Explore:

```typescript
// In AuthContext.tsx
const canShowTenantId = isSysOwner || (roleSettings?.entity?.showTenantID === true)
```

This means:
- **SysOwner**: Always sees `tenant_id` dimension (isSysOwner = true)
- **sysadmin role**: Also sees `tenant_id` (entity.showTenantID = true)
- **Other roles**: Do not see `tenant_id` unless configured in role

### Permission Override

SysOwner bypasses all permission checks:

```typescript
const hasPermission = (permission) => {
  if (isSysOwner) return true  // SysOwner has ALL permissions
  // ... normal permission check
}
```

### Relationship with Roles

| User Type | JWT Claim | Firestore Role | Can see tenant_id |
|-----------|-----------|----------------|-------------------|
| SysOwner | sys_owner: true | N/A | ✅ Yes |
| sysadmin | N/A | sysadmin | ✅ Yes |
| owner | N/A | owner | ❌ No |
| admin | N/A | admin | ❌ No |
| viewer | N/A | viewer | ❌ No |

> **Note**: SysOwner is detected from JWT custom claims. The `sysadmin` role is assigned via Firestore and has `entity.showTenantID = true`.

## Current SysOwner Users

| Email | UID | Configured Date |
|-------|-----|-----------------|
| martin.velez@ravencorex.com | LyCBbtgicPXqK5hQ9GJvNUhdyTI3 | 2025-12-02 |

---

Last Updated: 2025-12-03

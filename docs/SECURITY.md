# DataMetricX - Guía de Seguridad

## 🔒 REGLA #1: LA SEGURIDAD ES LA PRIORIDAD MÁXIMA

Esta plataforma maneja datos sensibles de nuestros clientes. **NUNCA** se deben subestimar los permisos o tomar atajos en seguridad.

---

## Principios de Seguridad

DataMetricX maneja datos sensibles de negocios (métricas de ventas, gastos de publicidad, información de clientes). La seguridad es crítica y se implementa en múltiples capas:

1. **Autenticación**: Firebase Auth con MFA (futuro)
2. **Autorización**: Reglas de Firestore + middleware en Functions
3. **Encriptación**: HTTPS everywhere, datos en tránsito y en reposo
4. **Secrets Management**: Google Secret Manager, nunca en código
5. **Multi-Tenant Isolation**: Separación estricta de datos por tenant
6. **Auditoría**: Logging completo de accesos y operaciones

---

## 🏢 Arquitectura Multi-Tenant y Core Dashboards

### Estructura Fundamental

```
┌─────────────────────────────────────────────────────────────────┐
│                    COLECCIONES RAÍZ (SISTEMA)                   │
├─────────────────────────────────────────────────────────────────┤
│  core_dashboards/        ← Plantillas de DataMetricX (READ ALL) │
│  core_dashboard_folders/ ← Carpetas de plantillas (READ ALL)    │
│  users/                  ← Perfiles de usuario                  │
│  roles/                  ← Definiciones de roles                │
│  system_permissions/     ← Permisos del sistema                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    DATOS POR TENANT (AISLADOS)                  │
├─────────────────────────────────────────────────────────────────┤
│  tenants/{tenantId}/                                            │
│  ├── members/           ← Usuarios del tenant                   │
│  ├── datasources/       ← Conexiones de datos                   │
│  ├── dashboards/        ← Dashboards PROPIOS del tenant         │
│  ├── dashboard_folders/ ← Carpetas de dashboards                │
│  ├── vizs/              ← Visualizaciones del tenant            │
│  ├── viz_folders/       ← Carpetas de visualizaciones           │
│  └── settings/          ← Configuración del tenant              │
└─────────────────────────────────────────────────────────────────┘
```

### Principio de Aislamiento

1. **Cada tenant es una isla** - Los datos de un tenant NUNCA son accesibles por otro tenant
2. **Membresía obligatoria** - Solo los miembros de un tenant pueden acceder a sus datos
3. **Sin excepciones** - NINGÚN tenant puede acceder a datos de otro tenant

### Core Dashboards vs Dashboards de Tenant

| Aspecto | Core Dashboards | Dashboards de Tenant |
|---------|-----------------|---------------------|
| **Ubicación** | `/core_dashboards/` (raíz) | `/tenants/{tenantId}/dashboards/` |
| **Propósito** | Plantillas expertas de DataMetricX | Dashboards personalizados del cliente |
| **Contenido** | Solo CONFIGURACIÓN (no datos) | Configuración + referencias a datos |
| **Quién lee** | Todos los usuarios autenticados | Solo miembros del tenant |
| **Quién escribe** | Solo SysOwner (via Admin SDK) | Miembros del tenant |
| **Datos mostrados** | Del tenant del usuario actual | Del tenant del usuario actual |

### Flujo de Datos Seguro

Cuando un usuario ve un Core Dashboard:

```
1. Usuario solicita ver "Executive Command Center"
2. Frontend carga CONFIGURACIÓN de /core_dashboards/...
3. Para cada visualización:
   a. Extraer la configuración (dataset, métricas, filtros)
   b. Ejecutar query contra backend CON EL TENANT DEL USUARIO
   c. Backend VALIDA que el usuario pertenece al tenant
   d. Backend ejecuta query SOLO con datos del tenant del usuario
4. Se renderiza dashboard con datos del TENANT DEL USUARIO
```

### ⚠️ NUNCA debe ocurrir:

- ❌ Leer datos de otro tenant
- ❌ Ejecutar queries sin validar membresía
- ❌ Almacenar datos sensibles en Core Dashboards
- ❌ Permitir escritura en Core Dashboards desde cliente
- ❌ Usar tenantId de parámetros sin validar

### Checklist de Seguridad Multi-Tenant

Antes de cada feature:
- [ ] ¿Esta feature puede exponer datos de un tenant a otro?
- [ ] ¿Se validan permisos en frontend Y backend?
- [ ] ¿Los queries están filtrados por tenantId?
- [ ] ¿Se usa el tenant del usuario autenticado?

Antes de cada merge:
- [ ] Revisar cambios en `firestore.rules`
- [ ] Revisar queries a Firestore - ¿usan el tenantId correcto?
- [ ] Revisar llamadas al backend - ¿incluyen validación de tenant?
- [ ] No hay hardcoded tenant IDs (excepto configuración)

🚩 **Red flags**:
- Funciones que reciben `tenantId` como parámetro sin validar
- Queries sin filtro de `tenantId`
- Reglas de Firestore con `allow read: if true`
- Acceso a datos "cross-tenant"

---

## 1. Autenticación

### Firebase Auth

**Métodos habilitados**:
- Email/Password (con requisitos de password fuerte)
- Google OAuth
- (Futuro) Magic Links, MFA

**Configuración de Password**:

En Firebase Console > Authentication > Settings:
- Mínimo 8 caracteres
- Requerir mayúsculas, minúsculas, números
- Habilitar email verification

**Implementación en Frontend**:

```typescript
// src/services/firebase.ts
import { getAuth, connectAuthEmulator } from 'firebase/auth';

export const auth = getAuth(app);

// Solo en desarrollo
if (process.env.NODE_ENV === 'development') {
  connectAuthEmulator(auth, 'http://localhost:9099');
}
```

**Password Validation**:

```typescript
// src/utils/validators.ts
import { z } from 'zod';

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[@$!%*?&#]/, 'Password must contain at least one special character');
```

**Session Management**:

```typescript
// src/context/AuthContext.tsx
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Verificar que el token sea válido
      const tokenResult = await user.getIdTokenResult();

      // Check if token is expired
      const expirationTime = new Date(tokenResult.expirationTime).getTime();
      if (Date.now() >= expirationTime) {
        await signOut(auth);
        return;
      }

      setUser(user);
    } else {
      setUser(null);
    }
  });

  return unsubscribe;
}, []);
```

---

## 2. Autorización

### Firestore Security Rules

**Ubicación**: `firestore.rules`

**Principios**:
- Default deny: todo bloqueado por defecto
- Principle of least privilege: solo permisos necesarios
- Multi-tenant isolation: usuarios solo acceden a su tenant
- Role-based access control: owner, admin, user

**Implementación completa**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ===== HELPER FUNCTIONS =====

    function isAuthenticated() {
      return request.auth != null;
    }

    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function getTenantId() {
      return getUserData().tenantId;
    }

    function isTenantMember(tenantId) {
      return isAuthenticated() && getTenantId() == tenantId;
    }

    function isOwnerOrAdmin(tenantId) {
      let userData = getUserData();
      return userData.tenantId == tenantId &&
             (userData.role == 'owner' || userData.role == 'admin');
    }

    function isOwner(tenantId) {
      let userData = getUserData();
      return userData.tenantId == tenantId && userData.role == 'owner';
    }

    // ===== ROOT COLLECTIONS =====

    // Users collection (user profile data)
    match /users/{userId} {
      allow read: if isAuthenticated() && request.auth.uid == userId;
      allow create: if isAuthenticated() && request.auth.uid == userId;
      allow update: if isAuthenticated() && request.auth.uid == userId
                    && request.resource.data.uid == userId
                    && request.resource.data.tenantId == resource.data.tenantId; // Can't change tenant
      allow delete: if false; // Users can't delete themselves (admin operation)
    }

    // Tenants collection
    match /tenants/{tenantId} {
      allow read: if isTenantMember(tenantId);
      allow create: if false; // Only created via Cloud Function on user signup
      allow update: if isOwnerOrAdmin(tenantId);
      allow delete: if isOwner(tenantId); // Only owner can delete tenant

      // ===== SUBCOLLECTIONS =====

      // Tenant users
      match /users/{userId} {
        allow read: if isTenantMember(tenantId);
        allow create: if isOwnerOrAdmin(tenantId);
        allow update: if isOwnerOrAdmin(tenantId);
        allow delete: if isOwnerOrAdmin(tenantId)
                      && userId != getUserData().uid; // Can't delete yourself
      }

      // Integrations
      match /integrations/{integrationId} {
        allow read: if isTenantMember(tenantId);
        allow create: if isOwnerOrAdmin(tenantId);
        allow update: if isOwnerOrAdmin(tenantId);
        allow delete: if isOwnerOrAdmin(tenantId);
      }

      // Metrics (read-only for users, write-only for Functions)
      match /metrics_daily/{date} {
        allow read: if isTenantMember(tenantId);
        allow write: if false; // Only Cloud Functions can write
      }

      // Products (read-only for users, write-only for Functions)
      match /products/{productId} {
        allow read: if isTenantMember(tenantId);
        allow write: if false; // Only Cloud Functions can write
      }

      // Campaigns (read-only for users, write-only for Functions)
      match /campaigns/{campaignId} {
        allow read: if isTenantMember(tenantId);
        allow write: if false; // Only Cloud Functions can write
      }

      // Alerts
      match /alerts/{alertId} {
        allow read: if isTenantMember(tenantId);
        allow create: if isTenantMember(tenantId);
        allow update: if isTenantMember(tenantId)
                      && resource.data.createdBy == request.auth.uid; // Only creator can update
        allow delete: if isOwnerOrAdmin(tenantId)
                      || resource.data.createdBy == request.auth.uid;
      }
    }

    // ===== DEFAULT DENY =====
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Cloud Functions Authorization

**Auth Middleware**:

```typescript
// functions/src/middleware/authMiddleware.ts
import { Request } from 'firebase-functions/v2/https';
import { auth, db } from '@/config/firebase';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  tenantId: string;
  role: 'owner' | 'admin' | 'user';
}

export async function authMiddleware(req: Request): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // Verify Firebase Auth token
    const decodedToken = await auth.verifyIdToken(token);

    // Get user data from Firestore
    const userDoc = await db.doc(`users/${decodedToken.uid}`).get();
    const userData = userDoc.data();

    if (!userData) {
      return null;
    }

    return {
      uid: decodedToken.uid,
      email: decodedToken.email || userData.email,
      tenantId: userData.tenantId,
      role: userData.role
    };

  } catch (error) {
    logger.error('Auth verification failed', error);
    return null;
  }
}
```

**Tenant Validation Middleware**:

```typescript
// functions/src/middleware/tenantMiddleware.ts
export function validateTenantAccess(
  user: AuthenticatedUser,
  requestedTenantId: string
): boolean {
  if (user.tenantId !== requestedTenantId) {
    logger.warn(`User ${user.uid} attempted to access tenant ${requestedTenantId}`);
    return false;
  }
  return true;
}
```

**Usage in Functions**:

```typescript
export const metaAdsSync = onRequest(async (req, res) => {
  // Authenticate
  const user = await authMiddleware(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate tenant access
  const { tenantId } = req.body;
  if (!validateTenantAccess(user, tenantId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Check role permissions (only owner/admin can sync)
  if (user.role !== 'owner' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // Proceed with sync...
});
```

---

## 3. Secrets Management

### Google Secret Manager

**Nunca almacenar secrets en**:
- Código fuente (Git)
- Variables de entorno del frontend
- Firestore (excepto referencias a Secret Manager)

**Estructura de Secrets**:

```
projects/datametricx-prod/secrets/
├── tenant_xyz789_meta_ads
├── tenant_xyz789_shopify
├── tenant_xyz789_google_ads
└── global_stripe_secret_key
```

**Crear Secret**:

```bash
# Via gcloud CLI
echo -n '{"accessToken":"abc123","accountId":"act_123"}' | \
  gcloud secrets create tenant_xyz789_meta_ads \
  --data-file=-

# Via Cloud Function
import { createSecret } from '@/services/secretManagerService';
await createSecret(
  'datametricx-prod',
  `tenant_${tenantId}_meta_ads`,
  JSON.stringify({ accessToken, accountId })
);
```

**Leer Secret (solo en Functions)**:

```typescript
import { getSecret } from '@/services/secretManagerService';

const secretPath = `projects/datametricx-prod/secrets/tenant_${tenantId}_meta_ads/versions/latest`;
const credentials = await getSecret(secretPath);
const { accessToken, accountId } = JSON.parse(credentials);
```

**Permisos**:

```bash
# Dar acceso a Cloud Functions service account
gcloud projects add-iam-policy-binding datametricx-prod \
  --member="serviceAccount:datametricx-prod@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 4. Encriptación

### En Tránsito

**HTTPS Everywhere**:
- Frontend en Hostinger: habilitar SSL/TLS (Let's Encrypt o Hostinger SSL)
- Cloud Functions: HTTPS por defecto
- Firestore SDK: conexión encriptada automáticamente

**CORS Configuration** (Cloud Functions):

```typescript
import { onRequest } from 'firebase-functions/v2/https';

export const myFunction = onRequest(
  {
    cors: ['https://datametricx.com', 'https://www.datametricx.com']
  },
  async (req, res) => {
    // Function logic
  }
);
```

### En Reposo

**Firestore**: encriptación automática con Google-managed keys

**Firebase Storage**: encriptación automática

**Opción futura**: Customer-managed encryption keys (CMEK) para compliance

---

## 5. Input Validation y Sanitization

### Frontend Validation (Zod)

```typescript
// src/utils/validators.ts
import { z } from 'zod';

export const integrationSchema = z.object({
  platform: z.enum(['meta_ads', 'shopify', 'google_ads', 'tiktok_ads']),
  displayName: z.string().min(1).max(100),
  credentials: z.object({
    accessToken: z.string().optional(),
    accountId: z.string().optional()
  })
});

// Usage in component
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(integrationSchema)
});
```

### Backend Validation (Cloud Functions)

```typescript
// functions/src/utils/validators.ts
import { z } from 'zod';

export const syncRequestSchema = z.object({
  tenantId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  integrationId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  dateRange: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  }).optional()
});

// Usage in function
export const metaAdsSync = onRequest(async (req, res) => {
  try {
    const validatedData = syncRequestSchema.parse(req.body);
    // Proceed with validated data
  } catch (error) {
    return res.status(400).json({ error: 'Invalid request data' });
  }
});
```

### XSS Prevention

**React**: automáticamente escapa JSX por defecto

**Evitar**:
```typescript
// ❌ NUNCA HACER ESTO
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

**Si es necesario HTML**:
```typescript
import DOMPurify from 'dompurify';

const cleanHTML = DOMPurify.sanitize(userInput);
<div dangerouslySetInnerHTML={{ __html: cleanHTML }} />
```

---

## 6. Rate Limiting

### Firestore Rate Limiting (para Cloud Functions)

```typescript
// functions/src/middleware/rateLimitMiddleware.ts
import { db } from '@/config/firebase';

export async function rateLimitMiddleware(
  userId: string,
  action: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const rateLimitRef = db.doc(`rate_limits/${userId}_${action}`);
  const doc = await rateLimitRef.get();

  const now = Date.now();
  const windowStart = now - windowMs;

  if (!doc.exists) {
    await rateLimitRef.set({
      requests: [now],
      expiresAt: now + windowMs
    });
    return true;
  }

  const data = doc.data()!;
  const recentRequests = data.requests.filter((timestamp: number) => timestamp > windowStart);

  if (recentRequests.length >= limit) {
    return false; // Rate limit exceeded
  }

  await rateLimitRef.update({
    requests: [...recentRequests, now],
    expiresAt: now + windowMs
  });

  return true;
}

// Usage
export const metaAdsSync = onRequest(async (req, res) => {
  const user = await authMiddleware(req);

  // Max 10 syncs per hour
  const allowed = await rateLimitMiddleware(user.uid, 'meta_ads_sync', 10, 60 * 60 * 1000);
  if (!allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  // Proceed...
});
```

---

## 7. Logging y Auditoría

### Structured Logging

```typescript
// functions/src/utils/logger.ts
import * as functions from 'firebase-functions';

export const logger = {
  info: (message: string, metadata?: any) => {
    functions.logger.info(message, {
      timestamp: new Date().toISOString(),
      ...metadata
    });
  },

  warn: (message: string, metadata?: any) => {
    functions.logger.warn(message, {
      timestamp: new Date().toISOString(),
      ...metadata
    });
  },

  error: (message: string, error?: any, metadata?: any) => {
    functions.logger.error(message, {
      timestamp: new Date().toISOString(),
      error: error?.message,
      stack: error?.stack,
      ...metadata
    });
  },

  audit: (action: string, user: AuthenticatedUser, metadata?: any) => {
    functions.logger.info('AUDIT', {
      timestamp: new Date().toISOString(),
      action,
      userId: user.uid,
      tenantId: user.tenantId,
      role: user.role,
      ...metadata
    });
  }
};
```

### Audit Trail (Firestore)

```typescript
// functions/src/services/auditService.ts
export async function logAuditEvent(
  tenantId: string,
  userId: string,
  action: string,
  metadata: any
): Promise<void> {
  await db.collection(`tenants/${tenantId}/audit_logs`).add({
    userId,
    action,
    metadata,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    ipAddress: metadata.ipAddress || null,
    userAgent: metadata.userAgent || null
  });
}

// Usage
await logAuditEvent(tenantId, user.uid, 'integration.connected', {
  platform: 'meta_ads',
  integrationId: 'integration_abc123'
});
```

---

## 8. Vulnerability Management

### Dependencias

**Auditoría regular**:

```bash
# Frontend
cd frontend
npm audit

# Functions
cd functions
npm audit
```

**Automatizar con GitHub Dependabot**:

`.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/functions"
    schedule:
      interval: "weekly"
```

### OWASP Top 10

**Prevenciones implementadas**:

1. **Injection**: validación con Zod, Firestore escapa queries automáticamente
2. **Broken Authentication**: Firebase Auth + tokens cortos
3. **Sensitive Data Exposure**: HTTPS everywhere, Secret Manager
4. **XML External Entities**: no usamos XML (JSON)
5. **Broken Access Control**: Firestore rules + middleware
6. **Security Misconfiguration**: reglas strict por defecto
7. **XSS**: React escapa JSX, DOMPurify para HTML
8. **Insecure Deserialization**: validación con Zod
9. **Using Components with Known Vulnerabilities**: npm audit
10. **Insufficient Logging**: structured logging + audit trail

---

## 9. Compliance (Futuro)

### GDPR (General Data Protection Regulation)

**Requisitos**:
- Consentimiento explícito para recolección de datos
- Derecho al olvido (delete user data)
- Portabilidad de datos (export user data)
- Notificación de brechas en 72 horas

**Implementación**:

```typescript
// Delete user data (GDPR right to be forgotten)
export const deleteUserData = onCall(async (data, context) => {
  const userId = context.auth?.uid;
  if (!userId) throw new Error('Unauthorized');

  // Delete user document
  await db.doc(`users/${userId}`).delete();

  // Delete from tenant users
  const userDoc = await db.doc(`users/${userId}`).get();
  const tenantId = userDoc.data()?.tenantId;
  if (tenantId) {
    await db.doc(`tenants/${tenantId}/users/${userId}`).delete();
  }

  // Delete Firebase Auth user
  await auth.deleteUser(userId);

  logger.audit('user.deleted', { userId });
});
```

### SOC 2 (Service Organization Control)

**Para certificación futura**:
- Logging completo
- Access control estricto
- Encriptación en tránsito y reposo
- Incident response plan
- Regular security audits

---

## 10. Security Checklist

### Pre-Production

- [ ] Firestore rules deployed y testeadas
- [ ] Firebase Auth configurado con password requirements
- [ ] Secret Manager configurado para todas las integraciones
- [ ] CORS configurado en Cloud Functions
- [ ] SSL/TLS habilitado en Hostinger
- [ ] Input validation implementada (frontend + backend)
- [ ] Rate limiting implementado
- [ ] Logging y auditoría funcionando
- [ ] npm audit sin vulnerabilidades críticas
- [ ] Penetration testing básico completado

### Post-Production

- [ ] Monitoring de errores activo
- [ ] Alertas configuradas para eventos sospechosos
- [ ] Backups automáticos funcionando
- [ ] Incident response plan documentado
- [ ] Security training para equipo
- [ ] Regular security audits (trimestral)

---

## Próximos Pasos

1. Implementar reglas de Firestore y desplegar
2. Configurar Secret Manager para todas las integraciones
3. Implementar auth middleware en todas las Functions
4. Configurar logging estructurado
5. Testing de seguridad (intentar bypass de reglas)
6. Configurar monitoring y alertas

---

**Documento creado**: 2025-11-18
**Última actualización**: 2025-11-18
**Versión**: 1.0

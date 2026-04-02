# DataMetricX - Esquema de Base de Datos (Firestore)

## Visión General

DataMetricX utiliza Cloud Firestore como base de datos NoSQL. El diseño es **multi-tenant**, donde cada empresa (tenant) tiene sus propios datos aislados en colecciones jerárquicas.

---

## Principios de Diseño

### 1. Multi-Tenancy
Cada tenant tiene sus datos separados bajo `tenants/{tenantId}/`. Esto permite:
- Aislamiento total de datos por seguridad
- Escalabilidad independiente por tenant
- Billing y métricas por tenant
- Reglas de seguridad simples basadas en tenantId

### 2. Denormalización Estratégica
Para optimizar lecturas (común en dashboards), duplicamos ciertos datos:
- Totales pre-calculados (revenue, orders, spend)
- Información de usuario en múltiples lugares
- Relaciones many-to-many con documentos de unión

### 3. Particionamiento por Fecha
Las métricas se dividen por fecha en `metrics_daily/{YYYY-MM-DD}` para:
- Queries rápidas por rango de fechas
- TTL automático (eliminar datos antiguos)
- Reduce tamaño de documentos individuales

### 4. Índices Compuestos
Firestore requiere índices explícitos para queries complejas. Ver `firestore.indexes.json`.

---

## Esquema Completo

### Colección Raíz: `users`

Almacena información básica de usuarios autenticados (multi-tenant).

```typescript
interface User {
  uid: string;                    // ID de Firebase Auth
  email: string;                  // Email del usuario
  displayName: string | null;     // Nombre completo
  photoURL: string | null;        // Avatar URL
  tenantId: string;               // ID del tenant al que pertenece
  role: 'owner' | 'admin' | 'user'; // Rol dentro del tenant
  createdAt: Timestamp;           // Fecha de creación
  updatedAt: Timestamp;           // Última actualización
  lastLoginAt: Timestamp;         // Último login
  isActive: boolean;              // Estado activo/inactivo
}
```

**Documento de ejemplo**:
```json
{
  "uid": "user_abc123",
  "email": "juan@example.com",
  "displayName": "Juan Pérez",
  "photoURL": "https://...",
  "tenantId": "tenant_xyz789",
  "role": "owner",
  "createdAt": "2025-11-01T10:00:00Z",
  "updatedAt": "2025-11-18T15:30:00Z",
  "lastLoginAt": "2025-11-18T15:30:00Z",
  "isActive": true
}
```

**Índices necesarios**:
- `tenantId` (ASC) + `role` (ASC)
- `tenantId` (ASC) + `createdAt` (DESC)

---

### Colección Raíz: `tenants`

Representa cada empresa/cliente de DataMetricX.

```typescript
interface Tenant {
  id: string;                     // Auto-generated ID
  name: string;                   // Nombre de la empresa
  subdomain: string;              // Subdominio único (ej: "acme")
  logo: string | null;            // URL del logo
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  settings: TenantSettings;       // Configuración general
  billing: {
    stripeCustomerId: string | null;
    subscriptionId: string | null;
    currentPeriodEnd: Timestamp | null;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  ownerId: string;                // uid del usuario owner
}

interface TenantSettings {
  timezone: string;               // Ej: "America/Argentina/Buenos_Aires"
  currency: string;               // Ej: "ARS", "USD"
  locale: string;                 // Ej: "es-AR", "en-US"
  fiscalYearStart: string;        // Ej: "01-01" (MM-DD)
}
```

**Documento de ejemplo**:
```json
{
  "id": "tenant_xyz789",
  "name": "Acme E-commerce",
  "subdomain": "acme",
  "logo": "https://storage.googleapis.com/.../acme-logo.png",
  "plan": "pro",
  "status": "active",
  "settings": {
    "timezone": "America/Argentina/Buenos_Aires",
    "currency": "ARS",
    "locale": "es-AR",
    "fiscalYearStart": "01-01"
  },
  "billing": {
    "stripeCustomerId": "cus_ABC123",
    "subscriptionId": "sub_XYZ789",
    "currentPeriodEnd": "2025-12-01T00:00:00Z"
  },
  "createdAt": "2025-11-01T10:00:00Z",
  "updatedAt": "2025-11-18T15:30:00Z",
  "ownerId": "user_abc123"
}
```

---

### Subcolección: `tenants/{tenantId}/users`

Duplica información de usuarios para queries rápidas dentro del tenant.

```typescript
interface TenantUser {
  uid: string;                    // Mismo que users/{uid}
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: 'owner' | 'admin' | 'user';
  permissions: string[];          // Ej: ["read:dashboards", "write:integrations"]
  invitedBy: string | null;       // uid del usuario que lo invitó
  invitedAt: Timestamp | null;
  joinedAt: Timestamp;
  lastActiveAt: Timestamp;
}
```

---

### Subcolección: `tenants/{tenantId}/integrations`

Almacena configuraciones de integraciones con plataformas externas.

```typescript
interface Integration {
  id: string;                     // Auto-generated ID
  platform: 'meta_ads' | 'tiktok_ads' | 'google_ads' | 'shopify' | 'tiendanube' | 'mercadolibre' | 'amazon';
  displayName: string;            // Ej: "Meta Ads - Cuenta Principal"
  status: 'active' | 'error' | 'pending' | 'disconnected';
  credentials: {
    accessToken?: string;         // NO almacenar aquí, usar Secret Manager
    refreshToken?: string;        // NO almacenar aquí, usar Secret Manager
    expiresAt?: Timestamp;
    scope?: string[];
    accountId?: string;           // ID de cuenta en la plataforma externa
    accountName?: string;         // Nombre de cuenta (ej: Ad Account Name)
  };
  secretPath: string;             // Path en Secret Manager (ej: "projects/.../secrets/tenant_xyz789_meta_ads")
  lastSync: {
    startedAt: Timestamp | null;
    completedAt: Timestamp | null;
    status: 'success' | 'error' | 'partial';
    recordsSynced: number;
    errors: string[];
  };
  syncSchedule: {
    enabled: boolean;
    frequency: 'hourly' | 'daily' | 'weekly';
    lastRun: Timestamp | null;
    nextRun: Timestamp | null;
  };
  config: Record<string, any>;    // Configuración específica de plataforma
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;              // uid del usuario
}
```

**Documento de ejemplo**:
```json
{
  "id": "integration_meta123",
  "platform": "meta_ads",
  "displayName": "Meta Ads - Cuenta Principal",
  "status": "active",
  "credentials": {
    "accountId": "act_123456789",
    "accountName": "Acme E-commerce Ads",
    "expiresAt": "2025-12-01T00:00:00Z"
  },
  "secretPath": "projects/datametricx-prod/secrets/tenant_xyz789_meta_ads",
  "lastSync": {
    "startedAt": "2025-11-18T06:00:00Z",
    "completedAt": "2025-11-18T06:05:32Z",
    "status": "success",
    "recordsSynced": 1523,
    "errors": []
  },
  "syncSchedule": {
    "enabled": true,
    "frequency": "daily",
    "lastRun": "2025-11-18T06:00:00Z",
    "nextRun": "2025-11-19T06:00:00Z"
  },
  "config": {
    "fields": ["campaign_name", "spend", "impressions", "clicks", "purchases"],
    "dateRange": "last_30_days"
  },
  "createdAt": "2025-11-01T10:00:00Z",
  "updatedAt": "2025-11-18T06:05:32Z",
  "createdBy": "user_abc123"
}
```

---

### Subcolección: `tenants/{tenantId}/metrics_daily`

Métricas agregadas por día. Cada documento es un día específico.

```typescript
interface MetricsDaily {
  date: string;                   // YYYY-MM-DD
  sources: MetricsSource[];       // Array de fuentes (meta_ads, shopify, etc.)
  totals: MetricsTotals;          // Totales del día
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface MetricsSource {
  platform: string;               // "meta_ads", "shopify", etc.
  integrationId: string;          // Referencia a integration

  // Métricas de marketing (Ads)
  spend?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;                   // Click-through rate
  cpc?: number;                   // Cost per click
  cpm?: number;                   // Cost per mille

  // Métricas de ventas (E-commerce)
  revenue?: number;
  orders?: number;
  units_sold?: number;
  avg_order_value?: number;

  // Métricas de conversión
  conversions?: number;
  conversion_rate?: number;
  cost_per_conversion?: number;

  // ROAS (Return on Ad Spend)
  roas?: number;

  // Tráfico
  sessions?: number;
  users?: number;
  page_views?: number;
  bounce_rate?: number;
}

interface MetricsTotals {
  revenue: number;
  orders: number;
  units_sold: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;                   // revenue / spend
  conversion_rate: number;        // conversions / sessions
}
```

**Documento de ejemplo**:
```json
{
  "date": "2025-11-18",
  "sources": [
    {
      "platform": "meta_ads",
      "integrationId": "integration_meta123",
      "spend": 1500.00,
      "impressions": 45000,
      "clicks": 890,
      "ctr": 1.98,
      "cpc": 1.69,
      "cpm": 33.33,
      "conversions": 23,
      "conversion_rate": 2.58,
      "cost_per_conversion": 65.22,
      "revenue": 4600.00,
      "roas": 3.07
    },
    {
      "platform": "shopify",
      "integrationId": "integration_shopify456",
      "revenue": 8200.00,
      "orders": 45,
      "units_sold": 78,
      "avg_order_value": 182.22,
      "sessions": 1250,
      "users": 980,
      "conversion_rate": 3.6
    }
  ],
  "totals": {
    "revenue": 12800.00,
    "orders": 45,
    "units_sold": 78,
    "spend": 1500.00,
    "impressions": 45000,
    "clicks": 890,
    "conversions": 45,
    "roas": 8.53,
    "conversion_rate": 3.6
  },
  "createdAt": "2025-11-18T06:05:32Z",
  "updatedAt": "2025-11-18T06:05:32Z"
}
```

**Índices necesarios**:
- `date` (DESC)

---

### Subcolección: `tenants/{tenantId}/products`

Catálogo de productos con métricas de performance.

```typescript
interface Product {
  id: string;                     // Auto-generated o SKU
  sku: string;                    // Código único de producto
  name: string;                   // Nombre del producto
  description: string | null;     // Descripción
  category: string;               // Categoría (Electronics, Clothing, etc.)
  subcategory: string | null;     // Subcategoría
  brand: string | null;           // Marca
  image: string | null;           // URL de imagen principal

  // Pricing
  price: number;                  // Precio actual
  cost: number | null;            // Costo (COGS)
  margin: number | null;          // Margen (%)
  currency: string;               // Moneda (ARS, USD, etc.)

  // Performance (últimos 30 días)
  metrics: {
    revenue: number;
    units_sold: number;
    orders: number;
    avg_price: number;
    profit: number;               // (price - cost) * units_sold
    views: number;
    conversion_rate: number;
  };

  // Metadata
  source: string;                 // shopify, tiendanube, etc.
  externalId: string;             // ID en la plataforma externa
  url: string | null;             // URL del producto
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Documento de ejemplo**:
```json
{
  "id": "prod_abc123",
  "sku": "TEE-BLK-M",
  "name": "Remera Negra Talle M",
  "description": "Remera 100% algodón",
  "category": "Clothing",
  "subcategory": "T-Shirts",
  "brand": "Acme Apparel",
  "image": "https://...",
  "price": 2500.00,
  "cost": 800.00,
  "margin": 68.0,
  "currency": "ARS",
  "metrics": {
    "revenue": 75000.00,
    "units_sold": 30,
    "orders": 28,
    "avg_price": 2500.00,
    "profit": 51000.00,
    "views": 850,
    "conversion_rate": 3.53
  },
  "source": "shopify",
  "externalId": "gid://shopify/Product/123456789",
  "url": "https://acme.com/products/remera-negra-m",
  "isActive": true,
  "createdAt": "2025-11-01T10:00:00Z",
  "updatedAt": "2025-11-18T06:05:32Z"
}
```

**Índices necesarios**:
- `category` (ASC) + `metrics.revenue` (DESC)
- `metrics.revenue` (DESC)
- `metrics.units_sold` (DESC)

---

### Subcolección: `tenants/{tenantId}/campaigns`

Campañas de marketing (Meta Ads, Google Ads, TikTok Ads).

```typescript
interface Campaign {
  id: string;                     // Auto-generated
  platform: 'meta_ads' | 'google_ads' | 'tiktok_ads';
  integrationId: string;          // Referencia a integration
  externalId: string;             // ID en la plataforma externa
  name: string;                   // Nombre de la campaña
  status: 'active' | 'paused' | 'completed' | 'deleted';
  objective: string;              // CONVERSIONS, TRAFFIC, BRAND_AWARENESS, etc.

  // Budget
  budget: {
    total: number | null;         // Budget total (lifetime)
    daily: number | null;         // Budget diario
    spent: number;                // Gastado hasta ahora
    currency: string;
  };

  // Performance (últimos 30 días)
  metrics: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm: number;
    conversions: number;
    conversion_rate: number;
    cost_per_conversion: number;
    revenue: number;              // Atribuido a esta campaña
    roas: number;
  };

  // Dates
  startDate: string | null;       // YYYY-MM-DD
  endDate: string | null;         // YYYY-MM-DD

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Documento de ejemplo**:
```json
{
  "id": "campaign_xyz789",
  "platform": "meta_ads",
  "integrationId": "integration_meta123",
  "externalId": "23850123456789",
  "name": "Black Friday 2025 - Remeras",
  "status": "active",
  "objective": "CONVERSIONS",
  "budget": {
    "total": 50000.00,
    "daily": 2000.00,
    "spent": 28000.00,
    "currency": "ARS"
  },
  "metrics": {
    "spend": 28000.00,
    "impressions": 890000,
    "clicks": 17800,
    "ctr": 2.0,
    "cpc": 1.57,
    "cpm": 31.46,
    "conversions": 456,
    "conversion_rate": 2.56,
    "cost_per_conversion": 61.40,
    "revenue": 114000.00,
    "roas": 4.07
  },
  "startDate": "2025-11-01",
  "endDate": "2025-11-30",
  "createdAt": "2025-11-01T10:00:00Z",
  "updatedAt": "2025-11-18T06:05:32Z"
}
```

**Índices necesarios**:
- `platform` (ASC) + `metrics.spend` (DESC)
- `status` (ASC) + `metrics.roas` (DESC)
- `metrics.roas` (DESC)

---

### Subcolección: `tenants/{tenantId}/alerts`

Alertas configuradas por el usuario (campañas underperforming, budget overspend, etc.).

```typescript
interface Alert {
  id: string;
  name: string;                   // Ej: "ROAS bajo en Meta Ads"
  type: 'roas' | 'budget' | 'conversion_rate' | 'revenue' | 'custom';
  status: 'active' | 'paused';

  // Condiciones
  conditions: {
    metric: string;               // "roas", "spend", "conversion_rate"
    operator: '<' | '>' | '==' | '<=' | '>=';
    threshold: number;
    platform?: string;            // Opcional: solo para esta plataforma
    campaignId?: string;          // Opcional: solo para esta campaña
  };

  // Notificaciones
  notifications: {
    email: boolean;
    inApp: boolean;
    recipients: string[];         // Emails de usuarios
  };

  // Historial
  lastTriggered: Timestamp | null;
  triggerCount: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;              // uid del usuario
}
```

**Documento de ejemplo**:
```json
{
  "id": "alert_abc123",
  "name": "ROAS bajo en Meta Ads",
  "type": "roas",
  "status": "active",
  "conditions": {
    "metric": "roas",
    "operator": "<",
    "threshold": 2.0,
    "platform": "meta_ads"
  },
  "notifications": {
    "email": true,
    "inApp": true,
    "recipients": ["juan@example.com", "marketing@example.com"]
  },
  "lastTriggered": "2025-11-17T14:30:00Z",
  "triggerCount": 3,
  "createdAt": "2025-11-01T10:00:00Z",
  "updatedAt": "2025-11-18T06:05:32Z",
  "createdBy": "user_abc123"
}
```

---

## Consideraciones de Performance

### 1. Límites de Firestore

- **Tamaño máximo de documento**: 1 MB
  - Solución: particionar datos grandes (ej: métricas por día)
- **Escrituras por segundo por documento**: 1 write/sec
  - Solución: usar documentos diferentes para métricas concurrentes
- **Queries con múltiples rangos**: requieren índices compuestos
  - Solución: crear índices en `firestore.indexes.json`

### 2. Estrategias de Lectura

**Escenario**: Dashboard que muestra métricas de últimos 30 días

```typescript
// Opción 1: Query por rango de fechas (RECOMENDADO)
const metricsRef = collection(db, `tenants/${tenantId}/metrics_daily`);
const q = query(
  metricsRef,
  where('date', '>=', '2025-10-19'),
  where('date', '<=', '2025-11-18'),
  orderBy('date', 'desc')
);

// Opción 2: Denormalizar totales en documento resumen
const summaryRef = doc(db, `tenants/${tenantId}/summaries/last_30_days`);
// Actualizado por Cloud Function cada hora
```

### 3. Estrategias de Escritura

**Escenario**: Sincronización de 1000 productos de Shopify

```typescript
// Opción 1: Batch writes (hasta 500 docs por batch)
const batch = writeBatch(db);
products.slice(0, 500).forEach(product => {
  const ref = doc(db, `tenants/${tenantId}/products/${product.id}`);
  batch.set(ref, product);
});
await batch.commit();

// Opción 2: Parallel writes (más rápido, pero menos transaccional)
await Promise.all(
  products.map(product =>
    setDoc(doc(db, `tenants/${tenantId}/products/${product.id}`), product)
  )
);
```

### 4. Agregaciones

**Escenario**: Calcular revenue total de últimos 30 días

```typescript
// Opción 1: Client-side aggregation (para MVP)
const snapshot = await getDocs(q);
const totalRevenue = snapshot.docs.reduce((sum, doc) =>
  sum + doc.data().totals.revenue, 0
);

// Opción 2: Server-side aggregation (Firebase Functions)
// Scheduled Function que pre-calcula y guarda en summaries/

// Opción 3: Firestore aggregation queries (beta)
const aggregateQuery = query(
  collection(db, `tenants/${tenantId}/metrics_daily`),
  where('date', '>=', '2025-10-19')
);
const snapshot = await getAggregateFromServer(aggregateQuery, {
  totalRevenue: sum('totals.revenue')
});
```

---

## Migraciones de Datos

### Agregar Campo Nuevo a Documentos Existentes

```typescript
// Cloud Function para migración
export const migrateAddField = functions.https.onRequest(async (req, res) => {
  const tenantsRef = collection(db, 'tenants');
  const snapshot = await getDocs(tenantsRef);

  const batch = writeBatch(db);
  let count = 0;

  snapshot.forEach(doc => {
    batch.update(doc.ref, {
      newField: 'defaultValue',
      updatedAt: Timestamp.now()
    });
    count++;

    // Firestore batch max 500 operations
    if (count % 500 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  });

  await batch.commit();
  res.send(`Migrated ${count} documents`);
});
```

---

## Backup y Recuperación

### Backup Automático (Firestore)

Firestore en modo producción tiene backups automáticos, pero podemos configurar exports programados:

```bash
# Usando gcloud
gcloud firestore export gs://BUCKET_NAME/backups/$(date +%Y-%m-%d)
```

### Restauración desde Backup

```bash
gcloud firestore import gs://BUCKET_NAME/backups/2025-11-18
```

---

## Anexo: Firestore Rules

Ver contenido completo en `../firestore.rules`. Resumen de reglas:

```javascript
// Solo miembros del tenant pueden leer sus datos
match /tenants/{tenantId}/{document=**} {
  allow read: if isTenantMember(tenantId);
}

// Solo owners/admins pueden modificar configuración
match /tenants/{tenantId} {
  allow write: if isOwnerOrAdmin(tenantId);
}

// Solo Functions pueden escribir métricas (prevenir manipulación)
match /tenants/{tenantId}/metrics_daily/{date} {
  allow write: if false; // Solo Functions
}
```

---

## Anexo: Firestore Indexes

Ver contenido completo en `../firestore.indexes.json`. Ejemplos:

```json
{
  "indexes": [
    {
      "collectionGroup": "metrics_daily",
      "fields": [
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "products",
      "fields": [
        { "fieldPath": "category", "order": "ASCENDING" },
        { "fieldPath": "metrics.revenue", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## Próximos Pasos

1. Implementar estructura inicial en Firestore (ver SETUP.md)
2. Crear reglas de seguridad y desplegar
3. Crear índices necesarios
4. Desarrollar servicios de lectura/escritura en Functions (ver BACKEND.md)
5. Conectar frontend con Firestore (ver FRONTEND.md)

---

**Documento creado**: 2025-11-18
**Última actualización**: 2025-11-18
**Versión**: 1.0

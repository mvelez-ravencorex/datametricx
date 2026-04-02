# DataMetricX - Especificación del Backend (Firebase Functions)

## Visión General

El backend de DataMetricX es 100% serverless, construido sobre Firebase Cloud Functions (Node.js 18+). Las funciones se dividen en tres categorías:

1. **HTTP Functions**: endpoints REST para integraciones y operaciones bajo demanda
2. **Scheduled Functions**: CRON jobs para sincronización automática
3. **Firestore Triggers**: funciones reactivas a eventos de base de datos

---

## Stack Tecnológico

- **Runtime**: Node.js 18+
- **Lenguaje**: TypeScript
- **Framework**: Firebase Functions SDK v4
- **Admin SDK**: firebase-admin (Firestore, Auth, Storage)
- **HTTP Client**: Axios
- **Secrets**: Google Secret Manager
- **Validation**: Zod
- **Logging**: Google Cloud Logging
- **Testing**: Jest + Firebase Emulators

---

## Estructura de Carpetas

```
functions/
├── src/
│   ├── index.ts                    # Entry point, export all functions
│   ├── config/
│   │   ├── firebase.ts             # Firebase Admin initialization
│   │   └── constants.ts            # Environment variables, regions, etc.
│   ├── integrations/
│   │   ├── metaAds/
│   │   │   ├── metaAdsService.ts   # Business logic
│   │   │   ├── metaAdsSync.ts      # HTTP function
│   │   │   └── metaAdsTypes.ts     # Type definitions
│   │   ├── shopify/
│   │   │   ├── shopifyService.ts
│   │   │   ├── shopifySync.ts
│   │   │   └── shopifyTypes.ts
│   │   ├── tiktokAds/
│   │   │   ├── tiktokAdsService.ts
│   │   │   ├── tiktokAdsSync.ts
│   │   │   └── tiktokAdsTypes.ts
│   │   ├── googleAds/
│   │   │   ├── googleAdsService.ts
│   │   │   ├── googleAdsSync.ts
│   │   │   └── googleAdsTypes.ts
│   │   ├── tiendanube/
│   │   │   ├── tiendanubeService.ts
│   │   │   ├── tiendanubeSync.ts
│   │   │   └── tiendanubeTypes.ts
│   │   ├── mercadolibre/
│   │   │   ├── mercadolibreService.ts
│   │   │   ├── mercadolibreSync.ts
│   │   │   └── mercadolibreTypes.ts
│   │   └── amazon/
│   │       ├── amazonService.ts
│   │       ├── amazonSync.ts
│   │       └── amazonTypes.ts
│   ├── scheduled/
│   │   ├── dailyMetricsSync.ts     # CRON: daily sync all integrations
│   │   ├── hourlyMetricsRefresh.ts # CRON: hourly refresh
│   │   └── weeklyCleanup.ts        # CRON: cleanup old data
│   ├── triggers/
│   │   ├── onUserCreated.ts        # Initialize tenant data
│   │   ├── onIntegrationUpdated.ts # Validate credentials
│   │   └── onMetricsUpdated.ts     # Recalculate aggregates
│   ├── services/
│   │   ├── firestoreService.ts     # CRUD helpers for Firestore
│   │   ├── secretManagerService.ts # Secret Manager operations
│   │   ├── metricsService.ts       # Metrics aggregation logic
│   │   └── authService.ts          # User/tenant auth helpers
│   ├── middleware/
│   │   ├── authMiddleware.ts       # Verify Firebase Auth tokens
│   │   ├── tenantMiddleware.ts     # Validate tenant access
│   │   ├── rateLimitMiddleware.ts  # Rate limiting (future)
│   │   └── errorHandler.ts         # Global error handling
│   ├── utils/
│   │   ├── logger.ts               # Structured logging
│   │   ├── validators.ts           # Zod schemas
│   │   ├── retry.ts                # Retry logic for external APIs
│   │   └── helpers.ts              # Utility functions
│   └── types/
│       └── index.ts                # Shared type definitions
├── package.json
├── tsconfig.json
├── .eslintrc.js
└── jest.config.js
```

---

## Configuración Inicial

### 1. Inicializar Firebase Functions

```bash
firebase init functions
# Seleccionar TypeScript, ESLint, instalar dependencias
```

### 2. Instalar Dependencias

```bash
cd functions
npm install firebase-admin axios @google-cloud/secret-manager zod date-fns lodash
npm install -D @types/lodash jest @types/jest ts-jest
```

### 3. Configurar TypeScript

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2017",
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "lib"]
}
```

---

## Inicialización de Firebase Admin

**Ubicación**: `src/config/firebase.ts`

```typescript
import * as admin from 'firebase-admin';

admin.initializeApp();

export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();

// Configure Firestore settings
db.settings({
  ignoreUndefinedProperties: true
});

export default admin;
```

---

## HTTP Functions

### 1. Meta Ads Sync Function

**Ubicación**: `src/integrations/metaAds/metaAdsSync.ts`

**Endpoint**: `POST /integrations/meta-ads/sync`

**Responsabilidad**:
- Recibir request con `tenantId` y `integrationId`
- Leer credentials de Secret Manager
- Llamar a Meta Marketing API
- Normalizar datos
- Guardar en Firestore (`metrics_daily`, `campaigns`)

**Código**:
```typescript
import { onRequest } from 'firebase-functions/v2/https';
import { getSecret } from '@/services/secretManagerService';
import { MetaAdsService } from './metaAdsService';
import { saveMetrics, saveCampaigns } from '@/services/firestoreService';
import { authMiddleware } from '@/middleware/authMiddleware';
import { logger } from '@/utils/logger';

export const metaAdsSync = onRequest(
  { region: 'us-central1', cors: true },
  async (req, res) => {
    try {
      // Validate auth
      const user = await authMiddleware(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Parse body
      const { tenantId, integrationId } = req.body;
      if (!tenantId || !integrationId) {
        return res.status(400).json({ error: 'Missing tenantId or integrationId' });
      }

      // Get credentials from Secret Manager
      const secretPath = `projects/${process.env.GCLOUD_PROJECT}/secrets/${tenantId}_meta_ads/versions/latest`;
      const credentials = await getSecret(secretPath);
      const { accessToken, accountId } = JSON.parse(credentials);

      // Initialize service
      const metaAdsService = new MetaAdsService(accessToken, accountId);

      // Fetch data from Meta Ads
      logger.info(`Starting Meta Ads sync for tenant ${tenantId}`);
      const { insights, campaigns } = await metaAdsService.fetchData({
        datePreset: 'last_30d'
      });

      // Normalize and save metrics
      const normalizedMetrics = metaAdsService.normalizeMetrics(insights);
      await saveMetrics(tenantId, integrationId, 'meta_ads', normalizedMetrics);

      // Save campaigns
      const normalizedCampaigns = metaAdsService.normalizeCampaigns(campaigns);
      await saveCampaigns(tenantId, integrationId, 'meta_ads', normalizedCampaigns);

      // Update integration lastSync
      await db.doc(`tenants/${tenantId}/integrations/${integrationId}`).update({
        'lastSync.completedAt': admin.firestore.FieldValue.serverTimestamp(),
        'lastSync.status': 'success',
        'lastSync.recordsSynced': normalizedMetrics.length + normalizedCampaigns.length
      });

      logger.info(`Meta Ads sync completed for tenant ${tenantId}`);
      return res.status(200).json({
        success: true,
        recordsSynced: normalizedMetrics.length + normalizedCampaigns.length
      });

    } catch (error) {
      logger.error('Meta Ads sync error', error);
      return res.status(500).json({ error: (error as Error).message });
    }
  }
);
```

---

### 2. Shopify Sync Function

**Ubicación**: `src/integrations/shopify/shopifySync.ts`

**Endpoint**: `POST /integrations/shopify/sync`

**Responsabilidad**:
- Sincronizar orders y products de Shopify
- Calcular métricas de ventas (revenue, orders, avg_order_value)
- Guardar productos con performance metrics

**Código (esqueleto)**:
```typescript
import { onRequest } from 'firebase-functions/v2/https';
import { ShopifyService } from './shopifyService';
import { authMiddleware } from '@/middleware/authMiddleware';

export const shopifySync = onRequest(
  { region: 'us-central1', cors: true },
  async (req, res) => {
    try {
      const user = await authMiddleware(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { tenantId, integrationId } = req.body;

      // Get credentials
      const credentials = await getSecret(/* ... */);
      const { accessToken, shopUrl } = JSON.parse(credentials);

      // Fetch orders and products
      const shopifyService = new ShopifyService(accessToken, shopUrl);
      const orders = await shopifyService.fetchOrders({ limit: 250 });
      const products = await shopifyService.fetchProducts({ limit: 250 });

      // Process and save
      // ...

      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  }
);
```

---

## Scheduled Functions

### 1. Daily Metrics Sync

**Ubicación**: `src/scheduled/dailyMetricsSync.ts`

**Schedule**: `0 6 * * *` (6 AM diario)

**Responsabilidad**:
- Iterar sobre todos los tenants
- Para cada tenant, iterar sobre integraciones activas
- Ejecutar sync de cada integración
- Manejar errores y logging

**Código**:
```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from '@/config/firebase';
import { logger } from '@/utils/logger';
import { MetaAdsService } from '@/integrations/metaAds/metaAdsService';
import { ShopifyService } from '@/integrations/shopify/shopifyService';

export const dailyMetricsSync = onSchedule(
  { schedule: '0 6 * * *', region: 'us-central1', timeZone: 'America/New_York' },
  async (event) => {
    logger.info('Starting daily metrics sync');

    try {
      // Get all active tenants
      const tenantsSnapshot = await db.collection('tenants')
        .where('status', '==', 'active')
        .get();

      for (const tenantDoc of tenantsSnapshot.docs) {
        const tenantId = tenantDoc.id;
        logger.info(`Processing tenant: ${tenantId}`);

        // Get active integrations for this tenant
        const integrationsSnapshot = await db.collection(`tenants/${tenantId}/integrations`)
          .where('status', '==', 'active')
          .where('syncSchedule.enabled', '==', true)
          .get();

        for (const integrationDoc of integrationsSnapshot.docs) {
          const integration = integrationDoc.data();
          const integrationId = integrationDoc.id;

          try {
            logger.info(`Syncing ${integration.platform} for tenant ${tenantId}`);

            // Route to appropriate service
            switch (integration.platform) {
              case 'meta_ads':
                await syncMetaAds(tenantId, integrationId);
                break;
              case 'shopify':
                await syncShopify(tenantId, integrationId);
                break;
              // ... other platforms
            }

            // Update lastSync
            await integrationDoc.ref.update({
              'syncSchedule.lastRun': admin.firestore.FieldValue.serverTimestamp()
            });

          } catch (error) {
            logger.error(`Error syncing ${integration.platform} for tenant ${tenantId}`, error);
            await integrationDoc.ref.update({
              'lastSync.status': 'error',
              'lastSync.errors': [(error as Error).message]
            });
          }
        }
      }

      logger.info('Daily metrics sync completed');
    } catch (error) {
      logger.error('Daily metrics sync failed', error);
      throw error;
    }
  }
);

async function syncMetaAds(tenantId: string, integrationId: string) {
  // Implementation (similar to HTTP function logic)
}

async function syncShopify(tenantId: string, integrationId: string) {
  // Implementation
}
```

---

## Firestore Triggers

### 1. On User Created

**Ubicación**: `src/triggers/onUserCreated.ts`

**Trigger**: `users/{userId}` onCreate

**Responsabilidad**:
- Cuando se crea un nuevo usuario (signup)
- Si es el primer usuario, crear nuevo tenant
- Agregar usuario a tenant con role 'owner'
- Inicializar estructuras de datos

**Código**:
```typescript
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db } from '@/config/firebase';
import { logger } from '@/utils/logger';

export const onUserCreated = onDocumentCreated(
  'users/{userId}',
  async (event) => {
    const userId = event.params.userId;
    const userData = event.data?.data();

    if (!userData) return;

    logger.info(`New user created: ${userId}`);

    try {
      // Check if user already has tenantId
      if (userData.tenantId) {
        logger.info(`User ${userId} already belongs to tenant ${userData.tenantId}`);
        return;
      }

      // Create new tenant for this user
      const tenantRef = db.collection('tenants').doc();
      const tenantId = tenantRef.id;

      await tenantRef.set({
        name: userData.email.split('@')[0] + "'s Company", // Default name
        subdomain: tenantId.substring(0, 8), // Generate unique subdomain
        logo: null,
        plan: 'free',
        status: 'active',
        settings: {
          timezone: 'America/New_York',
          currency: 'USD',
          locale: 'en-US',
          fiscalYearStart: '01-01'
        },
        billing: {
          stripeCustomerId: null,
          subscriptionId: null,
          currentPeriodEnd: null
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ownerId: userId
      });

      // Update user with tenantId and role
      await db.doc(`users/${userId}`).update({
        tenantId,
        role: 'owner'
      });

      // Add user to tenant's users subcollection
      await db.doc(`tenants/${tenantId}/users/${userId}`).set({
        uid: userId,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        role: 'owner',
        permissions: ['*'], // Full permissions for owner
        invitedBy: null,
        invitedAt: null,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info(`Created tenant ${tenantId} for user ${userId}`);
    } catch (error) {
      logger.error(`Error creating tenant for user ${userId}`, error);
      throw error;
    }
  }
);
```

---

## Services

### 1. Firestore Service

**Ubicación**: `src/services/firestoreService.ts`

**Responsabilidad**:
- Funciones reutilizables para CRUD en Firestore
- Batch operations
- Queries comunes

**Código**:
```typescript
import { db } from '@/config/firebase';
import { MetricsDaily, Campaign, Product } from '@/types';
import * as admin from 'firebase-admin';

export async function saveMetrics(
  tenantId: string,
  integrationId: string,
  platform: string,
  metrics: any[]
): Promise<void> {
  const batch = db.batch();

  // Group metrics by date
  const metricsByDate = groupBy(metrics, 'date');

  for (const [date, dailyMetrics] of Object.entries(metricsByDate)) {
    const docRef = db.doc(`tenants/${tenantId}/metrics_daily/${date}`);

    // Merge with existing data if any
    batch.set(docRef, {
      date,
      sources: admin.firestore.FieldValue.arrayUnion({
        platform,
        integrationId,
        ...aggregateMetrics(dailyMetrics)
      }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  await batch.commit();
}

export async function saveCampaigns(
  tenantId: string,
  integrationId: string,
  platform: string,
  campaigns: any[]
): Promise<void> {
  const batch = db.batch();
  let count = 0;

  for (const campaign of campaigns) {
    const docRef = db.doc(`tenants/${tenantId}/campaigns/${campaign.id}`);
    batch.set(docRef, {
      ...campaign,
      platform,
      integrationId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    count++;

    // Firestore batch max 500 operations
    if (count % 500 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  if (count % 500 !== 0) {
    await batch.commit();
  }
}

export async function saveProducts(
  tenantId: string,
  integrationId: string,
  platform: string,
  products: Product[]
): Promise<void> {
  // Similar to saveCampaigns
}

function aggregateMetrics(metrics: any[]) {
  return metrics.reduce((acc, m) => ({
    spend: (acc.spend || 0) + (m.spend || 0),
    revenue: (acc.revenue || 0) + (m.revenue || 0),
    impressions: (acc.impressions || 0) + (m.impressions || 0),
    clicks: (acc.clicks || 0) + (m.clicks || 0),
    conversions: (acc.conversions || 0) + (m.conversions || 0)
  }), {});
}

function groupBy(array: any[], key: string) {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) result[group] = [];
    result[group].push(item);
    return result;
  }, {});
}
```

---

### 2. Secret Manager Service

**Ubicación**: `src/services/secretManagerService.ts`

**Responsabilidad**:
- Leer secrets de Google Secret Manager
- Cachear secrets temporalmente
- Manejar errores de acceso

**Código**:
```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

// Simple in-memory cache (consider Redis for production)
const secretCache = new Map<string, { value: string; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getSecret(secretPath: string): Promise<string> {
  // Check cache
  const cached = secretCache.get(secretPath);
  if (cached && cached.expiry > Date.now()) {
    return cached.value;
  }

  // Fetch from Secret Manager
  const [version] = await client.accessSecretVersion({ name: secretPath });
  const payload = version.payload?.data?.toString() || '';

  // Cache
  secretCache.set(secretPath, {
    value: payload,
    expiry: Date.now() + CACHE_TTL
  });

  return payload;
}

export async function createSecret(
  projectId: string,
  secretId: string,
  payload: string
): Promise<void> {
  const parent = `projects/${projectId}`;

  // Create secret
  const [secret] = await client.createSecret({
    parent,
    secretId,
    secret: {
      replication: {
        automatic: {}
      }
    }
  });

  // Add version
  await client.addSecretVersion({
    parent: secret.name,
    payload: {
      data: Buffer.from(payload, 'utf8')
    }
  });
}
```

---

## Middleware

### 1. Auth Middleware

**Ubicación**: `src/middleware/authMiddleware.ts`

**Responsabilidad**:
- Verificar token de Firebase Auth en header
- Extraer usuario autenticado
- Validar permisos

**Código**:
```typescript
import { Request } from 'firebase-functions/v2/https';
import { auth } from '@/config/firebase';
import { logger } from '@/utils/logger';

export async function authMiddleware(req: Request): Promise<any> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Missing or invalid authorization header');
    return null;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(token);
    logger.info(`Authenticated user: ${decodedToken.uid}`);
    return decodedToken;
  } catch (error) {
    logger.error('Error verifying auth token', error);
    return null;
  }
}
```

---

## Utilities

### 1. Logger

**Ubicación**: `src/utils/logger.ts`

**Código**:
```typescript
import * as functions from 'firebase-functions';

export const logger = {
  info: (message: string, data?: any) => {
    functions.logger.info(message, data);
  },
  warn: (message: string, data?: any) => {
    functions.logger.warn(message, data);
  },
  error: (message: string, error?: any) => {
    functions.logger.error(message, { error: error?.message, stack: error?.stack });
  },
  debug: (message: string, data?: any) => {
    functions.logger.debug(message, data);
  }
};
```

### 2. Retry Logic

**Ubicación**: `src/utils/retry.ts`

**Código**:
```typescript
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: 'linear' | 'exponential';
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = 'exponential' } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      const waitTime = backoff === 'exponential'
        ? delay * Math.pow(2, attempt - 1)
        : delay * attempt;

      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw new Error('Retry failed');
}
```

---

## Entry Point

**Ubicación**: `src/index.ts`

**Responsabilidad**:
- Exportar todas las functions para Firebase

**Código**:
```typescript
// HTTP Functions
export { metaAdsSync } from './integrations/metaAds/metaAdsSync';
export { shopifySync } from './integrations/shopify/shopifySync';
export { tiktokAdsSync } from './integrations/tiktokAds/tiktokAdsSync';
export { googleAdsSync } from './integrations/googleAds/googleAdsSync';
export { tiendanubeSync } from './integrations/tiendanube/tiendanubeSync';
export { mercadolibreSync } from './integrations/mercadolibre/mercadolibreSync';
export { amazonSync } from './integrations/amazon/amazonSync';

// Scheduled Functions
export { dailyMetricsSync } from './scheduled/dailyMetricsSync';
export { hourlyMetricsRefresh } from './scheduled/hourlyMetricsRefresh';

// Firestore Triggers
export { onUserCreated } from './triggers/onUserCreated';
export { onIntegrationUpdated } from './triggers/onIntegrationUpdated';
```

---

## Testing

### Unit Tests

**Ubicación**: `functions/src/__tests__/metaAdsService.test.ts`

```typescript
import { MetaAdsService } from '../integrations/metaAds/metaAdsService';

describe('MetaAdsService', () => {
  it('should normalize metrics correctly', () => {
    const service = new MetaAdsService('fake_token', 'fake_account');
    const rawInsights = [
      { date_start: '2025-11-18', spend: '100', impressions: '5000' }
    ];

    const normalized = service.normalizeMetrics(rawInsights);

    expect(normalized).toEqual([
      { date: '2025-11-18', spend: 100, impressions: 5000 }
    ]);
  });
});
```

### Integration Tests with Emulators

```bash
# Iniciar emuladores
firebase emulators:start

# En otra terminal, correr tests
npm test
```

---

## Deploy

```bash
# Build
npm run build

# Deploy todas las functions
firebase deploy --only functions

# Deploy solo una function
firebase deploy --only functions:metaAdsSync

# Deploy con config de producción
firebase use production
firebase deploy --only functions
```

---

## Monitoring

### Logs

Ver logs en tiempo real:
```bash
firebase functions:log --only metaAdsSync
```

### Métricas

Google Cloud Console > Cloud Functions > [Function Name]
- Invocations
- Execution time
- Memory usage
- Errors

### Alertas

Configurar alertas en Google Cloud Monitoring:
- Error rate > 5%
- Latency p99 > 2s
- Memory usage > 80%

---

## Próximos Pasos

1. Implementar servicios base (Firestore, Secret Manager)
2. Crear function de Meta Ads sync (más crítica)
3. Implementar Shopify sync
4. Agregar scheduled function para sync diario
5. Crear triggers para user/tenant initialization
6. Testing con emuladores
7. Deploy a Firebase

---

**Documento creado**: 2025-11-18
**Última actualización**: 2025-11-18
**Versión**: 1.0

# Modelo de Datos - Meta Ads (Facebook & Instagram Ads)

## Resumen

Este documento describe la estructura de datos para almacenar información de Meta Ads (Facebook & Instagram Ads) en Firestore.

## Arquitectura de Datos

### Jerarquía de Entidades

```
Account (Ad Account)
  └── Campaigns (Campañas)
       └── Ad Sets (Conjuntos de anuncios)
            └── Ads (Anuncios individuales)
```

Cada nivel tiene sus propias métricas e insights.

## Colecciones en Firestore

### 1. `meta_campaigns`

Almacena información de las campañas publicitarias.

**Campos principales:**
- `id` - ID de Meta Ads
- `userId` - ID del usuario propietario
- `connectionId` - ID de la conexión
- `accountId` - ID de la cuenta publicitaria
- `name` - Nombre de la campaña
- `status` - Estado: ACTIVE, PAUSED, DELETED, ARCHIVED
- `objective` - Objetivo: AWARENESS, ENGAGEMENT, LEADS, SALES, TRAFFIC, APP_PROMOTION
- `dailyBudget` / `lifetimeBudget` - Presupuesto
- `startTime` / `stopTime` - Fechas de inicio/fin

**Ejemplo:**
```typescript
{
  id: "123456789",
  userId: "user_abc",
  connectionId: "conn_xyz",
  accountId: "act_123456",
  name: "Campaña Black Friday 2024",
  status: "ACTIVE",
  objective: "OUTCOME_SALES",
  dailyBudget: 50.00,
  startTime: "2024-11-01T00:00:00Z",
  createdAt: "2024-11-01T10:30:00Z"
}
```

### 2. `meta_adsets`

Almacena conjuntos de anuncios (Ad Sets) dentro de las campañas.

**Campos principales:**
- `id` - ID de Meta Ads
- `campaignId` - Relación con la campaña padre
- `name` - Nombre del ad set
- `status` - Estado
- `dailyBudget` / `lifetimeBudget` - Presupuesto
- `targeting` - Segmentación (edad, género, ubicación)

**Ejemplo:**
```typescript
{
  id: "987654321",
  campaignId: "123456789",
  name: "Ad Set - Mujeres 25-45",
  status: "ACTIVE",
  targeting: {
    ageMin: 25,
    ageMax: 45,
    genders: [2], // Female
    geoLocations: {
      countries: ["US", "CA"]
    }
  }
}
```

### 3. `meta_ads`

Almacena anuncios individuales.

**Campos principales:**
- `id` - ID de Meta Ads
- `campaignId` - Relación con campaña
- `adSetId` - Relación con ad set
- `name` - Nombre del anuncio
- `status` - Estado
- `creative` - Información del creativo (título, imagen, video, CTA)

**Ejemplo:**
```typescript
{
  id: "555666777",
  campaignId: "123456789",
  adSetId: "987654321",
  name: "Anuncio - Producto A",
  creative: {
    id: "creative_123",
    title: "¡Oferta especial!",
    body: "Aprovecha 50% de descuento",
    imageUrl: "https://...",
    callToAction: "SHOP_NOW"
  }
}
```

### 4. `meta_insights`

Almacena métricas diarias para cada entidad (campaign, adset, ad).

**Campos principales:**

#### Performance Básica:
- `impressions` - Impresiones totales
- `reach` - Alcance único
- `frequency` - Frecuencia promedio
- `clicks` - Clics totales
- `linkClicks` - Clics en enlaces
- `ctr` - Click-through rate (%)

#### Costos:
- `spend` - Gasto total
- `cpc` - Costo por clic
- `cpm` - Costo por mil impresiones
- `cpp` - Costo por persona alcanzada

#### Conversiones y ROI:
- `conversions` - Conversiones totales
- `costPerConversion` - Costo por conversión
- `conversionRate` - Tasa de conversión
- `purchases` - Compras
- `purchaseValue` - Valor de compras
- `purchaseRoas` - Return on ad spend

**Ejemplo:**
```typescript
{
  id: "campaign_123456789_2024-11-01",
  entityType: "campaign",
  entityId: "123456789",
  date: "2024-11-01",
  impressions: 15000,
  reach: 12000,
  frequency: 1.25,
  clicks: 450,
  linkClicks: 380,
  ctr: 3.0,
  spend: 45.50,
  cpc: 0.12,
  cpm: 3.03,
  conversions: 23,
  costPerConversion: 1.98,
  purchases: 18,
  purchaseValue: 1250.00,
  purchaseRoas: 27.47
}
```

### 5. `meta_insights_summary`

Almacena resúmenes agregados de métricas por períodos (últimos 7/30/90 días, lifetime).

**Campos principales:**
- `entityType` - Tipo: campaign, adset, ad, account
- `entityId` - ID de la entidad
- `periodType` - Período: lifetime, last_7d, last_30d, last_90d, custom
- `totalImpressions`, `totalReach`, `totalClicks`, `totalSpend`, etc.
- Todas las métricas agregadas (sumas y promedios)

**Ejemplo:**
```typescript
{
  id: "summary_campaign_123_last_30d",
  entityType: "campaign",
  entityId: "123456789",
  periodType: "last_30d",
  dateStart: "2024-10-01",
  dateStop: "2024-10-31",
  totalImpressions: 450000,
  totalReach: 180000,
  totalClicks: 13500,
  totalSpend: 1365.00,
  avgCtr: 3.0,
  avgCpc: 0.10,
  totalConversions: 690,
  avgCostPerConversion: 1.98,
  totalPurchaseValue: 37500.00,
  avgPurchaseRoas: 27.47
}
```

### 6. `meta_demographic_insights` (Opcional)

Almacena breakdown de métricas por segmentos demográficos.

**Campos principales:**
- `insightId` - Referencia al insight principal
- `breakdownType` - Tipo: age, gender, country, platform, device
- `breakdownValue` - Valor: "25-34", "male", "US", "facebook", etc.
- Métricas para ese segmento específico

**Ejemplo:**
```typescript
{
  id: "demo_insight_123_age_25-34",
  insightId: "campaign_123456789_2024-11-01",
  breakdownType: "age",
  breakdownValue: "25-34",
  impressions: 5000,
  reach: 4200,
  clicks: 180,
  spend: 15.50,
  conversions: 9
}
```

### 7. `meta_sync_jobs`

Rastrea trabajos de sincronización con Meta Ads API.

**Campos principales:**
- `status` - Estado: pending, running, completed, failed
- `jobType` - Tipo: initial_sync, incremental_sync, full_refresh
- `dateStart` / `dateStop` - Rango de fechas a sincronizar
- `processedEntities` - Progreso
- `stats` - Estadísticas de lo sincronizado

**Ejemplo:**
```typescript
{
  id: "job_20241101_143022",
  userId: "user_abc",
  connectionId: "conn_xyz",
  status: "completed",
  jobType: "initial_sync",
  dateStart: "2024-08-01",
  dateStop: "2024-10-31",
  totalEntities: 450,
  processedEntities: 450,
  stats: {
    campaignsSync: 15,
    adSetsSync: 45,
    adsSync: 120,
    insightsSync: 270
  },
  startedAt: "2024-11-01T14:30:22Z",
  completedAt: "2024-11-01T14:35:18Z"
}
```

## Flujo de Sincronización

### 1. Sincronización Inicial (Últimos 90 días)

```
1. Usuario conecta cuenta Meta Ads
2. Sistema crea MetaSyncJob con jobType="initial_sync"
3. Descarga estructura:
   - Campaigns → meta_campaigns
   - Ad Sets → meta_adsets
   - Ads → meta_ads
4. Para cada entidad, descarga insights de últimos 90 días:
   - Insights diarios → meta_insights
5. Genera resúmenes agregados → meta_insights_summary
6. Marca job como completed
```

### 2. Sincronización Incremental (Diaria/Periódica)

```
1. Sistema ejecuta job incremental (cron/schedule)
2. Descarga solo datos nuevos/actualizados desde última sincronización
3. Actualiza insights de días recientes (últimos 7 días)
4. Actualiza resúmenes agregados
```

## Queries Comunes

### Obtener todas las campañas activas de un usuario:

```typescript
const campaigns = await getDocs(
  query(
    collection(db, 'meta_campaigns'),
    where('userId', '==', userId),
    where('status', '==', 'ACTIVE')
  )
)
```

### Obtener insights de una campaña para un rango de fechas:

```typescript
const insights = await getDocs(
  query(
    collection(db, 'meta_insights'),
    where('userId', '==', userId),
    where('entityType', '==', 'campaign'),
    where('entityId', '==', campaignId),
    where('date', '>=', '2024-10-01'),
    where('date', '<=', '2024-10-31'),
    orderBy('date', 'asc')
  )
)
```

### Obtener resumen de últimos 30 días de una campaña:

```typescript
const summary = await getDoc(
  doc(db, 'meta_insights_summary', `summary_campaign_${campaignId}_last_30d`)
)
```

## Índices Compuestos Necesarios en Firestore

Para optimizar las queries, necesitarás crear estos índices:

```
meta_insights:
  - userId + entityType + entityId + date (ASC)
  - userId + date + entityType (ASC)

meta_campaigns:
  - userId + status + createdTime (DESC)
  - userId + accountId + status (ASC)

meta_adsets:
  - userId + campaignId + status (ASC)

meta_ads:
  - userId + adSetId + status (ASC)
  - userId + campaignId + status (ASC)
```

## Costos de Almacenamiento Estimados

Para una cuenta con:
- 10 campañas
- 30 ad sets
- 90 ads
- 90 días de historial

**Documentos totales:**
- Campaigns: 10
- Ad Sets: 30
- Ads: 90
- Insights diarios: ~11,700 (130 entidades × 90 días)
- Summaries: ~520 (130 entidades × 4 períodos)
- **Total: ~12,350 documentos**

**Costo estimado en Firestore:**
- Almacenamiento: ~$0.18/GB/mes → ~$0.02/mes
- Lecturas: Depende del uso, ~$0.36 por millón
- Escritas: ~$1.08 por millón

## Próximos Pasos

1. ✅ Definir estructura de datos (completado)
2. ✅ Crear tipos TypeScript (completado)
3. ✅ Actualizar reglas de Firestore (completado)
4. 🔄 Crear servicio de sincronización con Meta Ads API
5. 🔄 Implementar jobs de sincronización periódica
6. 🔄 Crear UI para visualizar métricas

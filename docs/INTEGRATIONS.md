# DataMetricX - Guía de Integraciones

## Visión General

DataMetricX se integra con 7 plataformas principales:

**Marketing / Ads**:
1. Meta Ads (Facebook/Instagram)
2. TikTok Ads
3. Google Ads

**E-commerce**:
4. Shopify
5. Tiendanube
6. MercadoLibre
7. Amazon Seller Central

Cada integración sigue el mismo patrón:
1. OAuth 2.0 para autenticación (cuando aplica)
2. Almacenamiento seguro de tokens en Secret Manager
3. Sincronización periódica via Cloud Functions
4. Normalización de datos a formato DataMetricX
5. Almacenamiento en Firestore

---

## Patrón General de Integración

### Flujo de Conexión

```
1. Usuario hace clic en "Connect" en UI
   ↓
2. Frontend redirige a OAuth provider (Meta, Shopify, etc.)
   ↓
3. Usuario autoriza app
   ↓
4. Provider redirige a callback URL con code
   ↓
5. Frontend envía code a Cloud Function
   ↓
6. Function intercambia code por access_token
   ↓
7. Function guarda token en Secret Manager
   ↓
8. Function crea documento en integrations/{id}
   ↓
9. Scheduled Function sincroniza datos periódicamente
```

### Estructura de Servicio

Cada integración tiene:
- **Service class**: lógica de negocio (fetchData, normalizeMetrics)
- **Sync function**: HTTP endpoint para sync manual
- **Types**: definiciones TypeScript
- **Constants**: URLs, scopes, API versions

---

## 1. Meta Ads (Facebook/Instagram)

### Configuración Inicial

1. Crear app en [Meta for Developers](https://developers.facebook.com/)
2. Configurar permisos:
   - `ads_read`
   - `ads_management`
   - `read_insights`
3. Agregar callback URL: `https://datametricx.com/integrations/meta-ads/callback`

### Autenticación (OAuth 2.0)

**Auth URL**:
```
https://www.facebook.com/v18.0/dialog/oauth?
  client_id={APP_ID}&
  redirect_uri={REDIRECT_URI}&
  scope=ads_read,ads_management,read_insights&
  state={TENANT_ID}
```

**Token Exchange**:
```typescript
import axios from 'axios';

async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
    params: {
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: process.env.META_REDIRECT_URI,
      code
    }
  });

  return response.data.access_token;
}
```

### API Endpoints

**Base URL**: `https://graph.facebook.com/v18.0`

**Obtener Ad Accounts**:
```typescript
GET /me/adaccounts?fields=id,name,currency,account_status
```

**Obtener Insights (Métricas)**:
```typescript
GET /act_{AD_ACCOUNT_ID}/insights?
  fields=campaign_name,spend,impressions,clicks,purchases,revenue&
  date_preset=last_30d&
  level=campaign
```

**Obtener Campañas**:
```typescript
GET /act_{AD_ACCOUNT_ID}/campaigns?
  fields=id,name,objective,status,daily_budget,lifetime_budget
```

### Implementación del Servicio

**Ubicación**: `functions/src/integrations/metaAds/metaAdsService.ts`

```typescript
import axios, { AxiosInstance } from 'axios';
import { retry } from '@/utils/retry';

export class MetaAdsService {
  private client: AxiosInstance;
  private accountId: string;

  constructor(accessToken: string, accountId: string) {
    this.accountId = accountId;
    this.client = axios.create({
      baseURL: 'https://graph.facebook.com/v18.0',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
  }

  async fetchData(options: { datePreset: string }) {
    const { datePreset } = options;

    // Fetch insights with retry logic
    const insights = await retry(() => this.fetchInsights(datePreset));
    const campaigns = await retry(() => this.fetchCampaigns());

    return { insights, campaigns };
  }

  private async fetchInsights(datePreset: string) {
    const response = await this.client.get(`/act_${this.accountId}/insights`, {
      params: {
        fields: 'campaign_name,spend,impressions,clicks,ctr,cpc,cpm,purchases,revenue,date_start,date_stop',
        date_preset: datePreset,
        level: 'campaign',
        limit: 500
      }
    });

    return response.data.data;
  }

  private async fetchCampaigns() {
    const response = await this.client.get(`/act_${this.accountId}/campaigns`, {
      params: {
        fields: 'id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time',
        limit: 500
      }
    });

    return response.data.data;
  }

  normalizeMetrics(rawInsights: any[]) {
    return rawInsights.map(insight => ({
      date: insight.date_start,
      campaignName: insight.campaign_name,
      spend: parseFloat(insight.spend || '0'),
      impressions: parseInt(insight.impressions || '0'),
      clicks: parseInt(insight.clicks || '0'),
      ctr: parseFloat(insight.ctr || '0'),
      cpc: parseFloat(insight.cpc || '0'),
      cpm: parseFloat(insight.cpm || '0'),
      conversions: parseInt(insight.purchases || '0'),
      revenue: parseFloat(insight.revenue || '0'),
      roas: insight.spend > 0 ? (parseFloat(insight.revenue || '0') / parseFloat(insight.spend)) : 0
    }));
  }

  normalizeCampaigns(rawCampaigns: any[]) {
    return rawCampaigns.map(campaign => ({
      id: `meta_${campaign.id}`,
      externalId: campaign.id,
      name: campaign.name,
      objective: campaign.objective,
      status: this.mapStatus(campaign.status),
      budget: {
        daily: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
        total: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : null,
        spent: 0, // Will be updated from insights
        currency: 'USD' // Detect from account
      },
      startDate: campaign.start_time?.split('T')[0] || null,
      endDate: campaign.stop_time?.split('T')[0] || null
    }));
  }

  private mapStatus(status: string): 'active' | 'paused' | 'completed' | 'deleted' {
    const statusMap: Record<string, any> = {
      'ACTIVE': 'active',
      'PAUSED': 'paused',
      'DELETED': 'deleted',
      'ARCHIVED': 'completed'
    };
    return statusMap[status] || 'paused';
  }
}
```

### Rate Limits

- **Marketing API**: 200 calls/hour/user (standard access)
- **Insights API**: 5 requests/second
- Implementar rate limiting en Cloud Functions con contador en Firestore

---

## 2. TikTok Ads

### Configuración Inicial

1. Registrarse en [TikTok for Business](https://business-api.tiktok.com/)
2. Crear app y obtener credentials
3. Configurar OAuth redirect URL

### Autenticación

**Auth URL**:
```
https://business-api.tiktok.com/open_api/v1.3/oauth2/authorize/?
  app_id={APP_ID}&
  redirect_uri={REDIRECT_URI}&
  state={TENANT_ID}
```

**Token Exchange**:
```typescript
POST https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/
Body: {
  app_id: APP_ID,
  secret: APP_SECRET,
  auth_code: CODE
}
```

### API Endpoints

**Base URL**: `https://business-api.tiktok.com/open_api/v1.3`

**Obtener Campaigns**:
```typescript
GET /campaign/get/?
  advertiser_id={ADVERTISER_ID}&
  filtering={"campaign_ids": [...]}&
  page=1&
  page_size=100
```

**Obtener Reports**:
```typescript
GET /report/integrated/get/?
  advertiser_id={ADVERTISER_ID}&
  report_type=BASIC&
  dimensions=["campaign_id"]&
  metrics=["spend","impressions","clicks","conversions","cost_per_conversion"]&
  start_date=2025-10-19&
  end_date=2025-11-18
```

### Implementación del Servicio

```typescript
export class TikTokAdsService {
  private client: AxiosInstance;
  private advertiserId: string;

  constructor(accessToken: string, advertiserId: string) {
    this.advertiserId = advertiserId;
    this.client = axios.create({
      baseURL: 'https://business-api.tiktok.com/open_api/v1.3',
      headers: {
        'Access-Token': accessToken
      }
    });
  }

  async fetchReports(startDate: string, endDate: string) {
    const response = await this.client.get('/report/integrated/get/', {
      params: {
        advertiser_id: this.advertiserId,
        report_type: 'BASIC',
        dimensions: JSON.stringify(['campaign_id', 'stat_time_day']),
        metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'conversions', 'cost_per_conversion']),
        start_date: startDate,
        end_date: endDate,
        page_size: 1000
      }
    });

    return response.data.data.list;
  }

  normalizeMetrics(rawReports: any[]) {
    return rawReports.map(report => ({
      date: report.dimensions.stat_time_day,
      campaignId: report.dimensions.campaign_id,
      spend: parseFloat(report.metrics.spend || '0'),
      impressions: parseInt(report.metrics.impressions || '0'),
      clicks: parseInt(report.metrics.clicks || '0'),
      conversions: parseInt(report.metrics.conversions || '0'),
      cpc: parseFloat(report.metrics.cpc || '0'),
      ctr: report.metrics.impressions > 0
        ? (report.metrics.clicks / report.metrics.impressions) * 100
        : 0
    }));
  }
}
```

### Rate Limits

- **Standard**: 10,000 requests/day
- **Rate**: 60 requests/minute

---

## 3. Google Ads

### Configuración Inicial

1. Crear proyecto en [Google Cloud Console](https://console.cloud.google.com/)
2. Habilitar Google Ads API
3. Obtener Developer Token (aplicar [aquí](https://ads.google.com/home/tools/manager-accounts/))
4. Configurar OAuth 2.0 credentials

### Autenticación

**OAuth Scopes**:
```
https://www.googleapis.com/auth/adwords
```

**Token Exchange**:
```typescript
POST https://oauth2.googleapis.com/token
Body: {
  code: CODE,
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  redirect_uri: REDIRECT_URI,
  grant_type: 'authorization_code'
}
```

### API Endpoints

**Base URL**: `https://googleads.googleapis.com/v15`

**Search Campaigns** (usando GAQL - Google Ads Query Language):
```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  metrics.cost_micros,
  metrics.impressions,
  metrics.clicks,
  metrics.conversions,
  metrics.conversions_value
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
```

**HTTP Request**:
```typescript
POST /customers/{CUSTOMER_ID}/googleAds:searchStream
Headers:
  developer-token: {DEVELOPER_TOKEN}
  Authorization: Bearer {ACCESS_TOKEN}
Body: {
  query: "SELECT campaign.id, campaign.name, metrics.cost_micros..."
}
```

### Implementación del Servicio

```typescript
export class GoogleAdsService {
  private client: AxiosInstance;
  private customerId: string;
  private developerToken: string;

  constructor(accessToken: string, customerId: string, developerToken: string) {
    this.customerId = customerId;
    this.developerToken = developerToken;
    this.client = axios.create({
      baseURL: `https://googleads.googleapis.com/v15/customers/${customerId}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken
      }
    });
  }

  async fetchCampaignMetrics(startDate: string, endDate: string) {
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        segments.date,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    `;

    const response = await this.client.post('/googleAds:searchStream', { query });
    return this.parseResults(response.data);
  }

  private parseResults(data: any) {
    const results: any[] = [];
    for (const batch of data) {
      for (const row of batch.results || []) {
        results.push({
          campaignId: row.campaign.id,
          campaignName: row.campaign.name,
          date: row.segments.date,
          spend: row.metrics.costMicros / 1000000, // Convert micros to currency
          impressions: parseInt(row.metrics.impressions || '0'),
          clicks: parseInt(row.metrics.clicks || '0'),
          conversions: parseFloat(row.metrics.conversions || '0'),
          revenue: parseFloat(row.metrics.conversionsValue || '0')
        });
      }
    }
    return results;
  }
}
```

### Rate Limits

- **Operations per day**: 15,000 (standard access)
- Solicitar aumento si es necesario

---

## 4. Shopify

### Configuración Inicial

1. Crear app en [Shopify Partners](https://partners.shopify.com/)
2. Configurar scopes:
   - `read_orders`
   - `read_products`
   - `read_customers`
   - `read_analytics`
3. Configurar redirect URL

### Autenticación

**Installation URL**:
```
https://{SHOP_DOMAIN}/admin/oauth/authorize?
  client_id={API_KEY}&
  scope=read_orders,read_products,read_customers&
  redirect_uri={REDIRECT_URI}&
  state={TENANT_ID}
```

**Token Exchange**:
```typescript
POST https://{SHOP_DOMAIN}/admin/oauth/access_token
Body: {
  client_id: API_KEY,
  client_secret: API_SECRET,
  code: CODE
}
```

### API Endpoints

**Base URL**: `https://{SHOP_DOMAIN}/admin/api/2024-01`

**Obtener Orders**:
```typescript
GET /orders.json?
  status=any&
  created_at_min=2025-10-19T00:00:00Z&
  limit=250
```

**Obtener Products**:
```typescript
GET /products.json?limit=250
```

**Obtener Analytics (Shopify Plus)**:
```typescript
GET /reports/sales_by_product.json?
  since=2025-10-19&
  until=2025-11-18
```

### Implementación del Servicio

```typescript
export class ShopifyService {
  private client: AxiosInstance;
  private shopDomain: string;

  constructor(accessToken: string, shopDomain: string) {
    this.shopDomain = shopDomain;
    this.client = axios.create({
      baseURL: `https://${shopDomain}/admin/api/2024-01`,
      headers: {
        'X-Shopify-Access-Token': accessToken
      }
    });
  }

  async fetchOrders(options: { since: string; limit?: number }) {
    const { since, limit = 250 } = options;
    let allOrders: any[] = [];
    let pageInfo: string | null = null;

    do {
      const params: any = {
        status: 'any',
        created_at_min: since,
        limit
      };

      if (pageInfo) {
        params.page_info = pageInfo;
      }

      const response = await this.client.get('/orders.json', { params });
      allOrders = allOrders.concat(response.data.orders);

      // Check for pagination
      const linkHeader = response.headers['link'];
      pageInfo = this.extractNextPageInfo(linkHeader);

    } while (pageInfo);

    return allOrders;
  }

  async fetchProducts(options: { limit?: number }) {
    const { limit = 250 } = options;
    const response = await this.client.get('/products.json', {
      params: { limit }
    });
    return response.data.products;
  }

  normalizeOrders(rawOrders: any[]) {
    // Group by date and calculate metrics
    const metricsByDate: Record<string, any> = {};

    for (const order of rawOrders) {
      const date = order.created_at.split('T')[0];

      if (!metricsByDate[date]) {
        metricsByDate[date] = {
          date,
          revenue: 0,
          orders: 0,
          units_sold: 0
        };
      }

      metricsByDate[date].revenue += parseFloat(order.total_price || '0');
      metricsByDate[date].orders += 1;
      metricsByDate[date].units_sold += order.line_items.reduce(
        (sum: number, item: any) => sum + item.quantity,
        0
      );
    }

    return Object.values(metricsByDate);
  }

  normalizeProducts(rawProducts: any[]) {
    return rawProducts.map(product => ({
      id: `shopify_${product.id}`,
      externalId: product.id,
      sku: product.variants[0]?.sku || product.id.toString(),
      name: product.title,
      description: product.body_html,
      category: product.product_type || 'Uncategorized',
      brand: product.vendor,
      image: product.images[0]?.src || null,
      price: parseFloat(product.variants[0]?.price || '0'),
      currency: 'USD', // Detectar de store settings
      url: `https://${this.shopDomain}/products/${product.handle}`,
      isActive: product.status === 'active'
    }));
  }

  private extractNextPageInfo(linkHeader: string | undefined): string | null {
    if (!linkHeader) return null;
    const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    if (!match) return null;
    const url = new URL(match[1]);
    return url.searchParams.get('page_info');
  }
}
```

### Rate Limits

- **REST Admin API**: 2 requests/second (40 per bucket of 20 seconds)
- Implementar rate limiting con leaky bucket algorithm

---

## 5. Tiendanube

### Configuración Inicial

1. Crear app en [Tiendanube Partners](https://www.tiendanube.com/partners)
2. Similar a Shopify (API compatible en gran parte)

### Autenticación

Similar a Shopify, OAuth 2.0.

### API Endpoints

**Base URL**: `https://api.tiendanube.com/v1/{STORE_ID}`

**Obtener Orders**:
```typescript
GET /orders?created_at_min=2025-10-19
```

**Obtener Products**:
```typescript
GET /products
```

### Implementación del Servicio

Similar a ShopifyService, con ajustes en endpoints y headers.

---

## 6. MercadoLibre

### Configuración Inicial

1. Crear app en [MercadoLibre Developers](https://developers.mercadolibre.com/)
2. Obtener App ID y Secret Key

### Autenticación

**Auth URL**:
```
https://auth.mercadolibre.com.ar/authorization?
  response_type=code&
  client_id={APP_ID}&
  redirect_uri={REDIRECT_URI}
```

**Token Exchange**:
```typescript
POST https://api.mercadolibre.com/oauth/token
Body: {
  grant_type: 'authorization_code',
  client_id: APP_ID,
  client_secret: SECRET,
  code: CODE,
  redirect_uri: REDIRECT_URI
}
```

### API Endpoints

**Base URL**: `https://api.mercadolibre.com`

**Obtener Orders**:
```typescript
GET /orders/search?seller={SELLER_ID}&order.date_created.from=2025-10-19
```

**Obtener Items (Products)**:
```typescript
GET /users/{SELLER_ID}/items/search
```

### Implementación del Servicio

```typescript
export class MercadoLibreService {
  private client: AxiosInstance;
  private sellerId: string;

  constructor(accessToken: string, sellerId: string) {
    this.sellerId = sellerId;
    this.client = axios.create({
      baseURL: 'https://api.mercadolibre.com',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
  }

  async fetchOrders(dateFrom: string) {
    const response = await this.client.get('/orders/search', {
      params: {
        seller: this.sellerId,
        'order.date_created.from': dateFrom,
        sort: 'date_desc',
        limit: 50
      }
    });

    return response.data.results;
  }

  normalizeOrders(rawOrders: any[]) {
    const metricsByDate: Record<string, any> = {};

    for (const order of rawOrders) {
      const date = order.date_created.split('T')[0];

      if (!metricsByDate[date]) {
        metricsByDate[date] = { date, revenue: 0, orders: 0, units_sold: 0 };
      }

      metricsByDate[date].revenue += order.total_amount;
      metricsByDate[date].orders += 1;
      metricsByDate[date].units_sold += order.order_items.reduce(
        (sum: number, item: any) => sum + item.quantity,
        0
      );
    }

    return Object.values(metricsByDate);
  }
}
```

### Rate Limits

- **Standard**: 10,000 requests/day
- **Rate**: 120 requests/minute (con burst)

---

## 7. Amazon Seller Central

### Configuración Inicial

1. Registrarse en [Amazon MWS](https://developer.amazonservices.com/)
2. Obtener credenciales (Access Key, Secret Key, Seller ID, Marketplace ID)
3. Autorizar app

### Autenticación

Amazon usa **AWS Signature Version 4** (no OAuth).

**Credenciales necesarias**:
- Access Key ID
- Secret Access Key
- Seller ID
- Marketplace ID

### API Endpoints

**Base URL**: Varía por región (ej: `https://mws.amazonservices.com`)

**Obtener Orders**:
```typescript
POST /?Action=ListOrders&
  CreatedAfter=2025-10-19T00:00:00Z&
  MarketplaceId.Id.1={MARKETPLACE_ID}&
  SellerId={SELLER_ID}&
  ...signature_params
```

**Obtener Products** (via Product Advertising API):
Similar con firma AWS.

### Implementación del Servicio

```typescript
import crypto from 'crypto';

export class AmazonService {
  private accessKey: string;
  private secretKey: string;
  private sellerId: string;
  private marketplaceId: string;

  constructor(credentials: {
    accessKey: string;
    secretKey: string;
    sellerId: string;
    marketplaceId: string;
  }) {
    Object.assign(this, credentials);
  }

  async fetchOrders(createdAfter: string) {
    const params = {
      Action: 'ListOrders',
      CreatedAfter: createdAfter,
      'MarketplaceId.Id.1': this.marketplaceId,
      SellerId: this.sellerId,
      Version: '2013-09-01',
      SignatureMethod: 'HmacSHA256',
      SignatureVersion: '2',
      Timestamp: new Date().toISOString()
    };

    const signature = this.generateSignature(params);
    const url = `https://mws.amazonservices.com/?${this.buildQueryString(params)}&Signature=${signature}`;

    const response = await axios.get(url);
    return this.parseXML(response.data); // Amazon returns XML
  }

  private generateSignature(params: Record<string, string>): string {
    const sortedParams = Object.keys(params).sort().map(key =>
      `${key}=${encodeURIComponent(params[key])}`
    ).join('&');

    const stringToSign = `GET\nmws.amazonservices.com\n/\n${sortedParams}`;
    const signature = crypto.createHmac('sha256', this.secretKey)
      .update(stringToSign)
      .digest('base64');

    return encodeURIComponent(signature);
  }

  private parseXML(xml: string) {
    // Use xml2js library to parse Amazon XML responses
    // Return JSON
  }
}
```

### Rate Limits

- **Varies by operation**: 5-60 requests/hour
- Implementar throttling según cada endpoint

---

## Manejo de Errores y Reintentos

### Estrategia General

```typescript
import { retry } from '@/utils/retry';

async function syncIntegration(platform: string, tenantId: string) {
  try {
    await retry(
      async () => {
        // Call API
        const data = await service.fetchData();
        await saveToFirestore(data);
      },
      {
        maxAttempts: 3,
        delay: 2000,
        backoff: 'exponential'
      }
    );
  } catch (error) {
    logger.error(`Sync failed for ${platform}`, error);

    // Update integration with error
    await db.doc(`tenants/${tenantId}/integrations/${integrationId}`).update({
      'lastSync.status': 'error',
      'lastSync.errors': [(error as Error).message]
    });

    // Send notification to user (optional)
    await sendErrorNotification(tenantId, platform, error);
  }
}
```

### Errores Comunes

1. **Token expirado**: Renovar usando refresh_token
2. **Rate limit**: Esperar y reintentar con backoff exponencial
3. **API temporalmente caída**: Reintentar hasta 3 veces
4. **Datos inválidos**: Loggear y continuar con siguiente registro

---

## Testing de Integraciones

### Usar Cuentas de Sandbox/Test

- **Meta Ads**: Test ad account
- **Google Ads**: Test account
- **Shopify**: Development store (gratis)
- **TikTok Ads**: Sandbox account
- **MercadoLibre**: Test user

### Mocks para Unit Tests

```typescript
import { MetaAdsService } from './metaAdsService';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MetaAdsService', () => {
  it('should fetch insights', async () => {
    mockedAxios.create.mockReturnValue({
      get: jest.fn().mockResolvedValue({
        data: {
          data: [{ spend: '100', impressions: '5000' }]
        }
      })
    } as any);

    const service = new MetaAdsService('fake_token', 'fake_account');
    const insights = await service.fetchInsights('last_7d');

    expect(insights).toHaveLength(1);
    expect(insights[0].spend).toBe('100');
  });
});
```

---

## Próximos Pasos

1. Implementar MetaAdsService completo
2. Implementar ShopifyService
3. Crear OAuth flows en frontend
4. Crear HTTP functions para cada integración
5. Testing con cuentas sandbox
6. Deploy y validar en producción con cliente piloto

---

**Documento creado**: 2025-11-18
**Última actualización**: 2025-11-18
**Versión**: 1.0

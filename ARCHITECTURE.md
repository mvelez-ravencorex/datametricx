# DataMetricX - Arquitectura del Sistema

## Visión General

DataMetricX es una plataforma SaaS de analítica para e-commerce y performance marketing que unifica datos de múltiples fuentes (Meta Ads, TikTok Ads, Google Ads, Shopify, Tiendanube, MercadoLibre, Amazon) en dashboards de alto rendimiento con capacidades de BI y recomendaciones inteligentes.

## Stack Tecnológico

### Frontend
- **Framework**: React 18+ (SPA)
- **Estilo**: Tailwind CSS 3.x
- **Gráficos**: Recharts / Chart.js
- **State Management**: React Context + Custom Hooks
- **Routing**: React Router v6
- **Build**: Vite (alternativa: Create React App)
- **Deployment**: Archivos estáticos en Hostinger

### Backend
- **Plataforma**: Firebase
  - **Auth**: Email/Password + Google OAuth
  - **Database**: Firestore (NoSQL, multi-tenant)
  - **Functions**: Cloud Functions (Node.js 18+)
  - **Storage**: Firebase Storage
  - **Hosting**: Firebase Hosting (opcional, para testing)
- **API Integrations**: Node.js en Cloud Functions

### Infraestructura
- **CDN/Hosting**: Hostinger (sitio estático)
- **Serverless**: Firebase Cloud Functions
- **Secret Management**: Google Secret Manager
- **Monitoring**: Firebase Console + Google Cloud Logging

---

## Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────┐
│                        HOSTINGER                             │
│                   (Static Frontend Build)                    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              React SPA                                │   │
│  │  - Components (KPIs, Charts, Tables)                 │   │
│  │  - Pages (Dashboard, Sales, Marketing, Settings)     │   │
│  │  - Context (Auth, Tenant, Data)                      │   │
│  │  - Services (Firebase SDK, API calls)                │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │ Firebase SDK (Auth + Firestore)
                            │ HTTPS Calls (Cloud Functions)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      FIREBASE PLATFORM                       │
│                                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Auth      │  │  Firestore   │  │     Storage      │   │
│  │             │  │              │  │                  │   │
│  │ - Users     │  │ - tenants    │  │ - logos          │   │
│  │ - Sessions  │  │ - users      │  │ - exports        │   │
│  │ - Tokens    │  │ - metrics    │  │ - uploads        │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          Cloud Functions (Node.js 18+)               │   │
│  │                                                       │   │
│  │  HTTP Functions:                                     │   │
│  │  - /integrations/meta-ads/sync                       │   │
│  │  - /integrations/shopify/sync                        │   │
│  │  - /integrations/tiktok-ads/sync                     │   │
│  │  - /integrations/google-ads/sync                     │   │
│  │  - /integrations/tiendanube/sync                     │   │
│  │  - /integrations/mercadolibre/sync                   │   │
│  │  - /integrations/amazon/sync                         │   │
│  │                                                       │   │
│  │  Scheduled Functions:                                │   │
│  │  - dailyMetricsSync (CRON: 0 6 * * *)               │   │
│  │  - hourlyMetricsRefresh (CRON: 0 * * * *)           │   │
│  │                                                       │   │
│  │  Firestore Triggers:                                 │   │
│  │  - onUserCreated → initializeTenantData             │   │
│  │  - onIntegrationUpdated → validateCredentials       │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │ External API Calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                         │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Meta Ads  │  │TikTok    │  │Google    │  │Shopify   │   │
│  │Marketing │  │Ads API   │  │Ads API   │  │Admin API │   │
│  │API       │  │          │  │          │  │          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │Tiendanube│  │MercadoLi │  │Amazon    │                  │
│  │API       │  │bre API   │  │Seller    │                  │
│  │          │  │          │  │Central   │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Módulos del Sistema

### 1. Frontend (React SPA)

**Ubicación**: `/frontend`

**Responsabilidades**:
- Autenticación de usuarios (login/signup)
- Navegación multi-página (Dashboard, Sales, Marketing, Operations, Settings)
- Visualización de KPIs (Revenue, ROAS, Conversion Rate)
- Gráficos interactivos (líneas, barras, donut)
- Gestión de integraciones (conectar/desconectar fuentes)
- Configuración de tenant (empresa) y usuarios
- Exportación de reportes

**Componentes clave**:
- `App.tsx`: Router principal
- `components/Layout`: Navbar, Sidebar, Footer
- `components/KPICard`: Tarjetas de métricas
- `components/Charts`: LineChart, BarChart, DonutChart
- `pages/Dashboard`: E-commerce Performance Dashboard
- `pages/Sales`: Sales Forecast, Product Performance
- `pages/Marketing`: Campaign Analytics, ROAS Analysis
- `pages/Settings`: Integrations, Users, Billing

**Tecnologías**:
- React 18 + TypeScript
- Tailwind CSS (diseño responsive)
- Recharts (gráficos)
- Firebase SDK (auth + firestore)
- Axios (llamadas HTTP a Functions)

### 2. Backend (Firebase Functions)

**Ubicación**: `/functions`

**Responsabilidades**:
- Sincronización de datos de APIs externas
- Transformación y normalización de métricas
- Almacenamiento en Firestore
- Validación de credenciales de integraciones
- Scheduled jobs (CRON) para refresh automático
- Seguridad: validación de tenant, rate limiting

**Servicios clave**:
- `metaAdsService.ts`: Integración con Meta Marketing API
- `shopifyService.ts`: Integración con Shopify Admin API
- `tiktokAdsService.ts`: Integración con TikTok Ads API
- `googleAdsService.ts`: Integración con Google Ads API
- `tiendanubeService.ts`: Integración con Tiendanube API
- `mercadolibreService.ts`: Integración con MercadoLibre API
- `amazonService.ts`: Integración con Amazon Seller Central API

**Functions**:
- **HTTP Functions**: endpoints para sincronización manual o webhooks
- **Scheduled Functions**: CRON jobs para actualización automática
- **Firestore Triggers**: eventos reactivos (onCreate, onUpdate)

### 3. Base de Datos (Firestore)

**Ubicación**: Firebase Firestore

**Modelo Multi-Tenant**:
Cada empresa (tenant) tiene sus propios datos separados lógicamente. La estructura es:

```
tenants/{tenantId}
  - name, plan, createdAt, settings

  users/{userId}
    - email, role, name, photoURL

  integrations/{integrationId}
    - platform (meta_ads, shopify, etc.)
    - credentials (encrypted)
    - status (active, error, pending)
    - lastSync

  metrics_daily/{date}
    - revenue, orders, sessions, conversions
    - spend, impressions, clicks, purchases
    - roas, ctr, cpc, cpm
    - source (meta_ads, shopify, etc.)

  products/{productId}
    - name, sku, category, price
    - sales, revenue, units_sold
    - margin, profit

  campaigns/{campaignId}
    - platform, name, budget
    - spend, impressions, clicks, purchases
    - roas, ctr, cpc
```

**Razones clave**:
1. **Escalabilidad**: cada tenant escala independientemente
2. **Seguridad**: las reglas Firestore aíslan datos por tenant
3. **Performance**: queries eficientes con índices por tenant
4. **Billing**: fácil trackear uso por tenant

### 4. Integraciones

**Ubicación**: `/functions/src/integrations`

**Estrategia general**:
1. Cada plataforma tiene su servicio dedicado
2. OAuth 2.0 para autenticación (cuando aplica)
3. Almacenamiento seguro de tokens en Secret Manager
4. Rate limiting respetando límites de cada API
5. Normalización de datos a formato estándar DataMetricX
6. Error handling y retry logic

**Flujo típico de integración**:
```
1. Usuario conecta cuenta → OAuth flow
2. Frontend recibe callback con code
3. Backend (Function) intercambia code por access_token
4. Token se guarda en Secret Manager
5. Se crea documento en integrations/{id}
6. Scheduled Function sincroniza datos periódicamente
7. Datos se almacenan en metrics_daily, products, campaigns
8. Frontend consulta Firestore y muestra dashboards
```

### 5. Seguridad

**Principios**:
- **Autenticación**: Firebase Auth con email/password + Google OAuth
- **Autorización**: Reglas de Firestore basadas en roles (owner, admin, user)
- **Secrets**: No hay API keys en código; se usan Secret Manager
- **CORS**: Configurado en Functions para dominio de Hostinger
- **HTTPS**: Todo tráfico encriptado
- **Multi-tenant isolation**: reglas Firestore previenen acceso cross-tenant

**Roles**:
- `owner`: creador del tenant, acceso total
- `admin`: gestión de usuarios e integraciones
- `user`: solo lectura de dashboards

---

## Flujos Principales

### Flujo de Autenticación

```
1. Usuario visita /login en Hostinger
2. Ingresa email/password o hace clic en "Sign in with Google"
3. Firebase Auth valida credenciales
4. Backend (Firestore Trigger) crea documento en tenants/{tenantId}/users/{userId}
5. Frontend guarda token en localStorage y redirige a /dashboard
6. Componentes usan AuthContext para acceso a usuario logueado
```

### Flujo de Sincronización de Datos

```
1. Usuario conecta integración en /settings/integrations
2. Frontend llama a Function /integrations/{platform}/connect
3. Function inicia OAuth flow → usuario autoriza app
4. Function guarda credentials en Secret Manager
5. Function crea documento en integrations/{id}
6. Scheduled Function (CRON) ejecuta sync diario:
   a. Lee credentials de Secret Manager
   b. Llama API de plataforma (Meta Ads, Shopify, etc.)
   c. Normaliza datos
   d. Guarda en metrics_daily, products, campaigns
7. Frontend consulta Firestore en tiempo real y actualiza dashboards
```

### Flujo de Visualización de Dashboard

```
1. Usuario navega a /dashboard
2. Componente Dashboard lee Firestore:
   - metrics_daily (últimos 30 días)
   - products (top 5)
   - campaigns (activas)
3. Componentes KPICard y Charts renderizan datos
4. Gráficos son interactivos (hover, zoom, filtros)
5. Usuario puede exportar reportes (PDF/CSV)
```

---

## Decisiones Arquitectónicas Clave

### 1. ¿Por qué React SPA en vez de Next.js SSR?

**Decisión**: React SPA buildeable a archivos estáticos.

**Razones**:
- Hostinger es hosting estático, no soporta Node.js server-side
- No necesitamos SEO (es app interna, no pública)
- Menor complejidad de deploy (solo HTML/JS/CSS)
- Mejor performance para dashboards interactivos (todo en cliente)

### 2. ¿Por qué Firebase en vez de backend custom (Express + PostgreSQL)?

**Decisión**: Firebase (Auth + Firestore + Functions + Storage).

**Razones**:
- **Serverless**: no gestionar infraestructura, escala automáticamente
- **Auth integrado**: login con email/Google out-of-the-box
- **Real-time**: Firestore actualiza dashboards sin polling
- **Costo**: pay-per-use, ideal para startup
- **Velocidad de desarrollo**: menos código boilerplate

### 3. ¿Por qué Firestore en vez de PostgreSQL?

**Decisión**: Firestore (NoSQL).

**Razones**:
- **Flexibilidad**: métricas de cada plataforma tienen schemas diferentes
- **Escalabilidad**: escala horizontal sin esfuerzo
- **Real-time**: listeners automáticos en frontend
- **Multi-tenant**: estructura de colecciones natural para aislar tenants
- **Nota**: Para queries analíticas complejas, podríamos agregar BigQuery en futuro

### 4. ¿Por qué no un data warehouse (BigQuery, Snowflake)?

**Decisión**: Firestore para MVP, BigQuery en roadmap futuro.

**Razones**:
- Para MVP, volúmenes de datos son manejables en Firestore
- Firestore es más simple y rápido de implementar
- BigQuery requiere ETL adicional (costo y complejidad)
- Podemos migrar a BigQuery cuando tengamos millones de registros

### 5. ¿Cómo manejamos multi-tenancy?

**Decisión**: Estructura de colecciones `tenants/{tenantId}/...`

**Razones**:
- **Seguridad**: reglas Firestore previenen acceso cross-tenant
- **Escalabilidad**: cada tenant escala independientemente
- **Billing**: fácil medir uso por tenant
- **Simplicidad**: no necesitamos múltiples databases

### 6. ¿Cómo manejamos secrets (API keys)?

**Decisión**: Google Secret Manager + Firebase Functions.

**Razones**:
- No exponer secrets en código frontend
- Rotación de secrets sin redeploy
- Auditoría de acceso a secrets
- Integración nativa con Cloud Functions

---

## Patrones de Diseño

### Frontend

1. **Compound Components**: para KPICards, Charts reutilizables
2. **Custom Hooks**: `useAuth`, `useFirestore`, `useMetrics`
3. **Context Providers**: `AuthContext`, `TenantContext`
4. **Atomic Design**: components/ dividido en atoms, molecules, organisms
5. **Error Boundaries**: para capturar errores de rendering

### Backend

1. **Service Layer**: cada integración es un servicio independiente
2. **Repository Pattern**: funciones reutilizables para Firestore (getMetrics, saveMetrics)
3. **Middleware**: validación de auth, tenant, rate limiting
4. **Factory Pattern**: crear instancias de servicios de integración
5. **Retry Pattern**: reintentos exponenciales para APIs externas

---

## Estructura de Carpetas

```
datametricx/
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   ├── favicon.ico
│   │   └── logo.png
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   │   ├── Navbar.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Footer.tsx
│   │   │   ├── KPICard/
│   │   │   │   └── KPICard.tsx
│   │   │   ├── Charts/
│   │   │   │   ├── LineChart.tsx
│   │   │   │   ├── BarChart.tsx
│   │   │   │   └── DonutChart.tsx
│   │   │   └── Tables/
│   │   │       └── DataTable.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Sales.tsx
│   │   │   ├── Marketing.tsx
│   │   │   ├── Operations.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── Login.tsx
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   └── TenantContext.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useFirestore.ts
│   │   │   └── useMetrics.ts
│   │   ├── services/
│   │   │   ├── firebase.ts
│   │   │   ├── api.ts
│   │   │   └── metrics.ts
│   │   ├── types/
│   │   │   ├── metrics.ts
│   │   │   ├── user.ts
│   │   │   └── integration.ts
│   │   ├── styles/
│   │   │   └── globals.css
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── functions/
│   ├── src/
│   │   ├── integrations/
│   │   │   ├── metaAds/
│   │   │   │   ├── metaAdsService.ts
│   │   │   │   └── metaAdsSync.ts
│   │   │   ├── shopify/
│   │   │   │   ├── shopifyService.ts
│   │   │   │   └── shopifySync.ts
│   │   │   ├── tiktokAds/
│   │   │   │   ├── tiktokAdsService.ts
│   │   │   │   └── tiktokAdsSync.ts
│   │   │   ├── googleAds/
│   │   │   │   ├── googleAdsService.ts
│   │   │   │   └── googleAdsSync.ts
│   │   │   ├── tiendanube/
│   │   │   │   ├── tiendanubeService.ts
│   │   │   │   └── tiendanubeSync.ts
│   │   │   ├── mercadolibre/
│   │   │   │   ├── mercadolibreService.ts
│   │   │   │   └── mercadolibreSync.ts
│   │   │   └── amazon/
│   │   │       ├── amazonService.ts
│   │   │       └── amazonSync.ts
│   │   ├── services/
│   │   │   ├── firestoreService.ts
│   │   │   ├── secretManagerService.ts
│   │   │   └── authService.ts
│   │   ├── utils/
│   │   │   ├── logger.ts
│   │   │   ├── validators.ts
│   │   │   └── helpers.ts
│   │   ├── middleware/
│   │   │   ├── authMiddleware.ts
│   │   │   └── rateLimitMiddleware.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── docs/
│   ├── SETUP.md
│   ├── FRONTEND.md
│   ├── BACKEND.md
│   ├── DATABASE_SCHEMA.md
│   ├── INTEGRATIONS.md
│   ├── SECURITY.md
│   ├── DEPLOYMENT.md
│   ├── UI_DESIGN.md
│   └── ROADMAP.md
├── .gitignore
├── firebase.json
├── .firebaserc
├── firestore.rules
├── firestore.indexes.json
├── ARCHITECTURE.md
└── README.md
```

---

## Consideraciones de Performance

### Frontend
- **Code Splitting**: lazy loading de páginas con React.lazy()
- **Memoization**: React.memo, useMemo, useCallback para evitar re-renders
- **Virtual Scrolling**: para tablas con miles de filas
- **Debouncing**: en filtros y búsquedas
- **CDN**: Hostinger sirve assets estáticos desde CDN

### Backend
- **Firestore Indexes**: crear índices compuestos para queries complejas
- **Batching**: escrituras en batch (hasta 500 docs)
- **Caching**: cachear resultados de APIs externas (Redis en futuro)
- **Parallel Requests**: llamadas simultáneas a múltiples APIs
- **Rate Limiting**: respetar límites de cada plataforma

### Database
- **Denormalización**: duplicar datos para queries rápidas (ej. totales pre-calculados)
- **Aggregations**: usar Firestore aggregation queries (count, sum)
- **Partitioning**: dividir métricas por fecha (metrics_daily/{YYYY-MM-DD})
- **TTL**: eliminar datos antiguos automáticamente (Functions scheduled)

---

## Monitoreo y Observabilidad

### Logs
- **Firebase Console**: logs automáticos de Functions
- **Google Cloud Logging**: logs estructurados con niveles (info, warn, error)
- **Frontend**: enviar errores a Firebase Crashlytics (futuro)

### Métricas
- **Firebase Analytics**: eventos de usuario (page views, clicks)
- **Cloud Monitoring**: latencia de Functions, errores HTTP
- **Custom Metrics**: ROAS, revenue, orders (almacenados en Firestore)

### Alertas
- **Error Rate**: alertar si tasa de error > 5%
- **Latency**: alertar si p99 > 2 segundos
- **Quota**: alertar si se acerca a límites de API
- **Billing**: alertar si costo mensual > umbral

---

## Testing

### Frontend
- **Unit Tests**: Jest + React Testing Library
- **Integration Tests**: probar flujos completos (login, dashboard)
- **E2E Tests**: Cypress / Playwright (opcional)

### Backend
- **Unit Tests**: Jest para servicios y utils
- **Integration Tests**: Firebase Emulator Suite
- **API Tests**: probar endpoints HTTP con supertest

### Coverage
- Objetivo: >80% code coverage
- CI/CD: correr tests en GitHub Actions antes de merge

---

## Costos Estimados (MVP)

### Firebase (Free Tier + Pay-as-you-go)
- **Firestore**: ~$10-50/mes (1-10 tenants, 100K reads/día)
- **Functions**: ~$5-20/mes (100K invocaciones/mes)
- **Storage**: ~$1-5/mes (logos, exports)
- **Auth**: gratis hasta 50K usuarios activos

### Hostinger
- **Hosting estático**: ~$3-10/mes (plan básico)

### APIs Externas
- **Meta Ads**: gratis (pero requiere app aprobada)
- **Shopify**: gratis para apps públicas
- **Google Ads**: gratis
- **TikTok Ads**: gratis
- **Amazon**: gratis
- **MercadoLibre**: gratis
- **Tiendanube**: gratis

**Total estimado**: $20-85/mes para MVP (1-10 clientes)

---

## Próximos Pasos

1. **Setup inicial**: crear proyecto Firebase, configurar React app
2. **Implementar autenticación**: Firebase Auth + login/signup UI
3. **Diseñar schema Firestore**: crear colecciones y reglas de seguridad
4. **Desarrollar dashboards**: componentes KPI, gráficos, layout
5. **Integrar primera plataforma**: Shopify (más simple que ads)
6. **Desplegar MVP**: build a Hostinger, Functions a Firebase
7. **Testing con cliente piloto**: iterar basado en feedback
8. **Agregar más integraciones**: Meta Ads, Google Ads, etc.
9. **Optimizar performance**: caching, indexes, code splitting
10. **Escalar**: BigQuery, IA, billing, multi-región

---

## Capa Semántica (Semantic Layer)

DataMetricX incluye una capa semántica que abstrae la complejidad del SQL y define modelos de datos reutilizables llamados **Entities** (similares a Views en Looker).

Para documentación completa, consultar:

- **[docs/SEMANTIC_LAYER.md](docs/SEMANTIC_LAYER.md)**: Especificación técnica completa
  - Esquema JSON de Entity (id, label, sql_table, attributes, metrics)
  - Propiedades de comportamiento (`hidden`, `extends`, `sql_filter`)
  - Definición de Attributes (dimensiones) y Metrics (medidas)
  - Lógica de herencia y merge
  - Generación de SQL
  - Ejemplos completos de Entities

---

## Flujo de Desarrollo con Agentes

Este proyecto utiliza múltiples agentes especializados para diferentes dominios. Es importante respetar las responsabilidades de cada uno.

### Agentes y Responsabilidades

| Agente | Responsabilidad | NO debe hacer |
|--------|-----------------|---------------|
| **Frontend** | Código en `/frontend`, React, TypeScript, UI/UX | Cambios en backend, infraestructura, GCP |
| **Backend** | Código en `/functions`, APIs, Cloud Functions | Cambios en frontend, infraestructura IAM |
| **Terraform** | Infraestructura GCP, IAM, buckets, permisos | Cambios en código de aplicación |

### Reglas Importantes

1. **El agente de Frontend NO debe:**
   - Ejecutar comandos `gcloud` para cambiar permisos o IAM
   - Modificar configuraciones de infraestructura
   - Crear o modificar recursos en GCP (buckets, service accounts, etc.)
   - Hacer cambios en el backend o Cloud Functions

2. **Cuando hay errores de permisos GCP (403, IAM):**
   - El agente de Frontend debe reportar el error
   - Indicar qué permiso falta y qué service account lo necesita
   - El usuario se encarga de comunicarlo al agente de Terraform

3. **Cuando hay errores de API backend (404, 500):**
   - El agente de Frontend debe reportar el error
   - Indicar qué endpoint falta o qué respuesta se esperaba
   - El usuario se encarga de comunicarlo al agente de Backend

### Ejemplo de Comunicación

```
Error detectado por Frontend:
  - Error: 403 - sa-backend-api@project.iam.gserviceaccount.com
    no tiene storage.objects.list en bucket X

Mensaje para Terraform:
  - Agregar rol roles/storage.objectViewer al service account
    sa-backend-api para el bucket X
```

---

## Referencias

- [Firebase Documentation](https://firebase.google.com/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Meta Marketing API](https://developers.facebook.com/docs/marketing-apis)
- [Shopify Admin API](https://shopify.dev/api/admin)
- [Google Ads API](https://developers.google.com/google-ads/api)
- [TikTok Ads API](https://ads.tiktok.com/marketing_api/docs)

---

## Documentación Adicional (Frontend)

Para más detalles sobre implementaciones específicas del frontend, consultar:

- **[frontend/docs/TENANT_AUTH_FLOW.md](frontend/docs/TENANT_AUTH_FLOW.md)**: Flujo de autenticación y custom claims
  - Arquitectura Frontend ↔ Backend ↔ Firebase
  - Custom Claims en Firebase Auth (tenant_id)
  - Flujo completo de creación de tenant
  - Flujo de conexión de datasources
  - Estructura de datos en Firestore
  - Endpoints del Backend API
  - Troubleshooting

- **[frontend/docs/API_REFERENCE.md](frontend/docs/API_REFERENCE.md)**: Referencia rápida de API
  - Todos los endpoints del Backend
  - Frontend Services (apiService, tenantService, datasourceService)
  - Tipos principales (Request/Response, Firestore)
  - Mapeo de plataformas
  - Variables de entorno
  - Códigos de error

- **[frontend/docs/CONNECTIONS_PAGE.md](frontend/docs/CONNECTIONS_PAGE.md)**: Documentación completa de la página de Integraciones
  - Layout con sidebar de plataformas
  - Flujo de Meta Ads Onboarding (OAuth + start_date + frequency)
  - Estructura en Firestore
  - Listener de Firestore (evitar loops infinitos)
  - Tipos y constantes

- **[frontend/docs/FRONTEND_META_ONBOARDING.md](frontend/docs/FRONTEND_META_ONBOARDING.md)**: Especificación del onboarding de Meta Ads
  - Campos a capturar (start_date, frequency)
  - Estructura en Firestore
  - Estados del datasource
  - API endpoints requeridos

---

**Documento creado**: 2025-11-18
**Última actualización**: 2025-11-29
**Versión**: 1.1

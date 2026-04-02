# DataMetricX Frontend - Documentation

## Quick Links

| Documento | Descripción |
|-----------|-------------|
| [API_REFERENCE.md](./API_REFERENCE.md) | Referencia completa de endpoints y servicios |
| [TENANT_AUTH_FLOW.md](./TENANT_AUTH_FLOW.md) | Flujo de autenticación y custom claims |
| [CONNECTIONS_PAGE.md](./CONNECTIONS_PAGE.md) | Página de integraciones/conexiones |
| [FRONTEND_META_ONBOARDING.md](./FRONTEND_META_ONBOARDING.md) | Onboarding de Meta Ads |
| [META_ADS_DATA_MODEL.md](./META_ADS_DATA_MODEL.md) | Modelo de datos de Meta Ads |
| [FRONTEND_FLOWS.md](./FRONTEND_FLOWS.md) | Flujos generales del frontend |

---

## Arquitectura General

```
┌────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                     │
│                     http://localhost:5173                       │
├────────────────────────────────────────────────────────────────┤
│  Context          │  Services           │  Components          │
│  - AuthContext    │  - apiService       │  - connections/      │
│  - TenantContext  │  - tenantService    │  - layout/           │
│                   │  - datasourceService│  - dashboard/        │
└───────────────────┴─────────────────────┴──────────────────────┘
          │                    │
          ▼                    ▼
┌─────────────────────┐  ┌─────────────────────────────────────┐
│   Firebase Auth     │  │         Backend API (Cloud Run)     │
│   Firebase SDK      │  │  https://backend-api-jrzfm3jccq-uc  │
├─────────────────────┤  │         .a.run.app                  │
│  - Authentication   │  ├─────────────────────────────────────┤
│  - ID Token (JWT)   │  │  /api/auth/set-claims               │
│  - Custom Claims    │  │  /api/secrets/{datasource}          │
└─────────────────────┘  │  /api/ingest/run-now                │
          │              │  /api/ingest/backfill               │
          ▼              └─────────────────────────────────────┘
┌─────────────────────┐              │
│    Firestore        │              ▼
├─────────────────────┤  ┌─────────────────────────────────────┐
│  /users/{uid}       │  │       Google Cloud Services         │
│  /tenants/{id}      │  ├─────────────────────────────────────┤
│    /members         │  │  - Secret Manager (credentials)     │
│    /datasources     │  │  - BigQuery (data)                  │
│    /pipeline_runs   │  │  - Cloud Tasks (jobs)               │
└─────────────────────┘  └─────────────────────────────────────┘
```

---

## Flujo Principal: Nuevo Usuario

```
1. Login/Signup
   └─► Firebase Auth

2. Onboarding (crear tenant)
   └─► tenantService.createTenant()
   └─► apiService.setUserClaims() → Backend
   └─► auth.getIdToken(true) → JWT con tenant_id

3. Conectar integraciones
   └─► apiService.saveCredentials() → Secret Manager
   └─► Guardar datasource en Firestore

4. Sincronizar datos
   └─► apiService.runSyncNow() → Backend pipeline
   └─► Datos en BigQuery

5. Ver dashboard
   └─► Consultar Firestore/BigQuery
   └─► Renderizar gráficos
```

---

## Estructura de Archivos

```
frontend/
├── src/
│   ├── components/
│   │   ├── connections/        # Integraciones
│   │   │   ├── meta/           # Meta Ads onboarding
│   │   │   └── ...
│   │   ├── layout/             # Navbar, Sidebar
│   │   └── dashboard/          # KPIs, Charts
│   │
│   ├── context/
│   │   ├── AuthContext.tsx     # Usuario y auth
│   │   └── TenantContext.tsx   # Tenant activo
│   │
│   ├── services/
│   │   ├── apiService.ts       # Calls al backend
│   │   ├── tenantService.ts    # CRUD Firestore
│   │   └── datasourceService.ts# Pipeline runs
│   │
│   ├── types/
│   │   ├── tenant.ts           # Tipos de tenant
│   │   └── connections.ts      # Tipos de conexiones
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Connections.tsx
│   │   └── Settings.tsx
│   │
│   └── config/
│       └── firebase.ts         # Firebase SDK config
│
├── docs/                       # Esta carpeta
└── .env.local                  # Variables de entorno
```

---

## Variables de Entorno

```bash
# .env.local
VITE_API_BASE_URL=https://backend-api-jrzfm3jccq-uc.a.run.app
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=datametricx-prod.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=datametricx-prod
```

---

## Comandos de Desarrollo

```bash
# Instalar dependencias
pnpm install

# Servidor de desarrollo
pnpm dev

# Build para producción
pnpm build

# Type check
npx tsc --noEmit

# Limpiar cache de Vite
rm -rf node_modules/.vite
```

---

## Documentos por Tema

### Autenticación
- [TENANT_AUTH_FLOW.md](./TENANT_AUTH_FLOW.md) - Custom claims y JWT

### Integraciones
- [CONNECTIONS_PAGE.md](./CONNECTIONS_PAGE.md) - Página de conexiones
- [FRONTEND_META_ONBOARDING.md](./FRONTEND_META_ONBOARDING.md) - Meta Ads setup
- [META_ADS_DATA_MODEL.md](./META_ADS_DATA_MODEL.md) - Estructura de datos Meta

### API
- [API_REFERENCE.md](./API_REFERENCE.md) - Endpoints y servicios

### General
- [FRONTEND_FLOWS.md](./FRONTEND_FLOWS.md) - Flujos de usuario

---

**Última actualización**: 2025-11-29

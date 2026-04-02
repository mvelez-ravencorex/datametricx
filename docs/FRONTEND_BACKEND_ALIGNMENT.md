# DataMetricX - Alineacion Frontend-Backend

> **Objetivo:** Documentar la arquitectura compartida entre frontend y backend para facilitar el desarrollo coordinado.
> **Frontend:** React + TypeScript + Vite (Claude Code)
> **Backend:** FastAPI + BigQuery + GCS (Agente Terraform/Backend)
> **Ultima actualizacion:** 2025-01-04

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Studio (Frontend React)                          │
│                           Interfaz No-Code                               │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  VizBuilder │  │  Dashboard  │  │  Explore    │  │ Development │    │
│  │             │  │   Editor    │  │  (Datasets) │  │    (IDE)    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ REST API + Firebase Auth
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Semantic Compiler (Backend API)                      │
│                          Cloud Run (FastAPI)                             │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   /query    │  │  /models/*  │  │ /warehouse  │  │  /sync/*    │    │
│  │ SQL Builder │  │ CRUD JSON   │  │ Introspect  │  │  Meta Ads   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└──────────────┬──────────────────────────────────────┬───────────────────┘
               │                                      │
               ▼                                      ▼
┌──────────────────────────┐              ┌───────────────────────────────┐
│   Storage Layer (GCS)    │              │   Data Warehouse (BigQuery)   │
│   Modelos JSON           │              │   Tablas RAW/Reporting        │
│   /core/ + /tenants/     │              │   + Row Level Security        │
└──────────────────────────┘              └───────────────────────────────┘
```

---

## 1. Endpoints del Backend

### Semantic Layer (Queries)

| Endpoint | Metodo | Descripcion | Frontend Consumer |
|----------|--------|-------------|-------------------|
| `/api/semantic/query` | POST | Ejecutar query semantica | VizBuilder, DashboardEditor |
| `/api/semantic/dry-run` | POST | Preview SQL + costo estimado | VizBuilder (SQL tab) |
| `/api/semantic/datasets` | GET | Listar datasets disponibles | DatasetsNew, Sidebar |
| `/api/semantic/datasets/{id}` | GET | Obtener dataset con entities | VizBuilder |
| `/api/semantic/entities/{provider}` | GET | Listar entities por provider | VizBuilder |
| `/api/semantic/distinct-values` | GET | Valores unicos para filtros | VizBuilder (dropdowns) |

### Semantic Models (CRUD - Solo SysOwner)

| Endpoint | Metodo | Descripcion | Frontend Consumer |
|----------|--------|-------------|-------------------|
| `/api/semantic/models/tree` | GET | Arbol de archivos (Core + Tenant) | Development IDE |
| `/api/semantic/models/file` | GET | Leer archivo JSON | Development IDE |
| `/api/semantic/models/file` | PUT | Guardar archivo | Development IDE |
| `/api/semantic/models/file` | DELETE | Eliminar archivo | Development IDE |

### Core Dashboards (Templates globales)

| Endpoint | Metodo | Descripcion | Frontend Consumer |
|----------|--------|-------------|-------------------|
| `/api/core-dashboards` | GET | Listar core dashboards | Visualizations |
| `/api/core-dashboards` | POST | Copiar dashboard a core | Visualizations (SysOwner) |
| `/api/core-dashboards/{id}` | DELETE | Eliminar de core | Visualizations (SysOwner) |
| `/api/core-dashboard-folders` | POST | Crear carpeta en core | Visualizations (SysOwner) |

### Warehouse (Introspeccion)

| Endpoint | Metodo | Descripcion | Frontend Consumer |
|----------|--------|-------------|-------------------|
| `/api/warehouse/tables` | GET | Listar tablas BigQuery | (Futuro: Dataset Builder) |
| `/api/warehouse/schema` | GET | Esquema de tabla | (Futuro: Dataset Builder) |
| `/api/models/validate-sql` | POST | Validar sintaxis SQL | Development IDE |

---

## 2. Estructura de QueryRequest

### Frontend → Backend

```typescript
interface QueryRequest {
  dataset_id: string           // ID del dataset
  attributes: string[]         // IDs de atributos (con timeframe si aplica)
  metrics: string[]            // IDs de metricas
  filters?: MetricFilter[]     // Filtros aplicados
  order_by?: OrderByConfig[]   // Ordenamiento
  limit?: number               // Max filas (default 500)

  // Futuro: PoP en backend
  comparison?: {
    enabled: boolean
    type: ComparisonType
    dateField: string
    variants: MetricVariant[]
    customRange?: { startDate: string; endDate: string }
  }
}

interface MetricFilter {
  field: string                // ID del campo (entity.field o field)
  operator: string             // =, !=, >, <, contains, last_7_days, etc.
  value: string | number | boolean | string[] | null
}

interface OrderByConfig {
  field: string
  direction: 'ASC' | 'DESC'
}
```

### Backend → Frontend

```typescript
interface QueryResponse {
  success: boolean
  data: Record<string, unknown>[]   // Filas de datos
  columns: QueryColumnInfo[]        // Metadata de columnas
  meta: {
    row_count: number
    sql?: string                    // SQL ejecutado (debug)
  }
}

interface QueryColumnInfo {
  id: string                        // ID del campo
  label: string                     // Nombre para mostrar
  type: string                      // number, string, date, percent
  format?: string                   // Formato Numeral.js
}
```

---

## 3. Semantic Layer Schema

### Entity (JSON en GCS)

```json
{
  "id": "fact_meta_performance",
  "type": "entity",
  "label": "Rendimiento Meta Ads",
  "category": "Marketing",
  "subcategory": "Performance",

  "extends": "fact_meta_performance_core",  // Herencia opcional

  "source": {
    "type": "table",
    "sql_table": "`datametricx-prod.reporting.meta_performance_campaign_daily`",
    "sql_filter": "{TABLE}.status != 'DELETED'"  // RLS base
  },

  "attributes": [
    {
      "id": "date",
      "label": "Fecha",
      "type": "date",
      "field": "date_start",
      "primary_key": true,
      "group_label": "Fechas"
    }
  ],

  "metrics": [
    {
      "id": "spend",
      "label": "Inversion",
      "type": "currency",
      "sql": "{TABLE}.spend",
      "sql_agg": "SUM",
      "format": "$0,0.00"
    },
    {
      "id": "ctr",
      "label": "CTR",
      "type": "percent",
      "sql": "SAFE_DIVIDE(SUM({TABLE}.clicks), SUM({TABLE}.impressions))",
      "sql_agg": "CUSTOM",
      "format": "0.00%"
    }
  ]
}
```

### Dataset (JSON en GCS)

```json
{
  "id": "meta_ads_insights",
  "type": "dataset",
  "label": "Meta Ads Insights",
  "base_entity": "fact_meta_performance",

  "relationships": [
    {
      "entity": "meta_campaigns",
      "join_type": "left",
      "sql_on": "{fact_meta_performance.campaign_id} = {meta_campaigns.id}"
    }
  ],

  "governance": {
    "default_filter": "last_30_days",
    "partition_field": "fact_meta_performance.date"
  }
}
```

### Agregaciones Soportadas (sql_agg)

| Valor | SQL Generado | Uso |
|-------|--------------|-----|
| `SUM` | `SUM(expr)` | Suma estandar |
| `SUM_DISTINCT` | `SUM(DISTINCT expr)` | Evitar duplicados |
| `AVG` | `AVG(expr)` | Promedio |
| `AVG_DISTINCT` | `AVG(DISTINCT expr)` | Promedio unicos |
| `COUNT` | `COUNT(expr)` | Cuenta filas |
| `COUNT_DISTINCT` | `COUNT(DISTINCT expr)` | Cardinalidad |
| `MIN` | `MIN(expr)` | Minimo |
| `MAX` | `MAX(expr)` | Maximo |
| `CUSTOM` | `expr` | Formula completa (ratios) |

---

## 4. Sistema de Capas (GCS)

```
gs://datametricx-models/
├── core/                           # Read-Only para tenants
│   ├── entities/
│   │   └── meta/
│   │       ├── meta_campaigns.json
│   │       ├── meta_adsets.json
│   │       └── fact_meta_performance.json
│   └── datasets/
│       └── meta/
│           └── meta_ads_insights.json
│
└── tenants/
    └── {tenant_id}/                # Read/Write para tenant
        ├── entities/
        │   └── custom/
        │       └── custom_entity.json
        └── datasets/
            └── custom_report.json
```

### Resolucion de Cascada

1. Buscar en `/tenants/{tenant_id}/` → Si existe, usar este (Override)
2. Si no existe, buscar en `/core/`
3. Si tiene `extends`, resolver herencia (Hijo sobrescribe Padre)

---

## 5. Multi-Tenancy y Seguridad

### Custom Claims (Firebase Auth)

```json
{
  "uid": "user_uid",
  "email": "usuario@email.com",
  "tenant_id": "tenant_123",    // Tenant activo
  "role": "admin",              // owner, admin, analyst, member
  "sys_owner": true             // Solo para SysOwner
}
```

### Roles y Permisos

| Rol | Ver datos | Crear Viz | Editar ajenas | Gestionar usuarios | Billing |
|-----|-----------|-----------|---------------|--------------------| --------|
| viewer | Si | No | No | No | No |
| member | Si | No | No | No | No |
| analyst | Si | Si | No | No | No |
| admin | Si | Si | Si | Si | No |
| owner | Si | Si | Si | Si | Si |
| SysOwner | TODO | TODO | TODO | TODO | TODO |

### Row Level Security (BigQuery)

```sql
-- El backend SIEMPRE inyecta:
WHERE tenant_id = @current_tenant_id  -- Parametrizado
  AND (sql_filter_de_entity)          -- RLS adicional
  AND (filtros_del_usuario)           -- Filtros de la query
```

**SysOwner:** No se aplica filtro de tenant_id (ve todo)

---

## 6. Period over Period (PoP)

### Estado Actual

| Componente | Estado | Ubicacion |
|------------|--------|-----------|
| Frontend (2 queries + merge) | Implementado | `comparisonService.ts` |
| Backend (CTEs) | Especificado | `PERIOD_OVER_PERIOD_SPEC.md` |

### Tipos de Comparacion

| Tipo | Descripcion |
|------|-------------|
| `same_point` | Mismo punto del periodo anterior (dia por dia) |
| `full_previous` | Periodo anterior completo |
| `same_point_yoy` | Mismo punto del ano anterior |
| `full_previous_yoy` | Ano anterior completo |
| `custom` | Rango personalizado |

### Variantes de Metricas

| Variante | Sufijo | Descripcion |
|----------|--------|-------------|
| `current` | `_current` | Valor del periodo actual |
| `previous` | `_previous` | Valor del periodo anterior |
| `delta` | `_delta` | Diferencia absoluta |
| `delta_pct` | `_delta_pct` | Variacion porcentual |

### Propuesta Backend (Pendiente)

```typescript
// Agregar a QueryRequest
comparison?: {
  enabled: boolean
  type: ComparisonType
  dateField: string
  variants: MetricVariant[]
  customRange?: { startDate: string; endDate: string }
}

// Backend genera SQL con CTEs:
WITH current_period AS (
  SELECT ... WHERE date BETWEEN @current_start AND @current_end
),
previous_period AS (
  SELECT ... WHERE date BETWEEN @previous_start AND @previous_end
)
SELECT
  c.*,
  p.spend AS spend_previous,
  c.spend - p.spend AS spend_delta,
  SAFE_DIVIDE(c.spend - p.spend, p.spend) * 100 AS spend_delta_pct
FROM current_period c
LEFT JOIN previous_period p ON c.date + INTERVAL @offset_days DAY = p.date
```

---

## 7. Firestore (Frontend directo)

### Colecciones

```
firestore/
├── tenants/{tenantId}/
│   ├── members/{userId}           # Membresia
│   ├── datasources/{id}           # Conexiones OAuth
│   ├── vizs/{vizId}               # Visualizaciones guardadas
│   ├── viz_folders/{id}           # Carpetas de vizs
│   ├── dashboards/{dashId}        # Dashboards
│   └── dashboard_folders/{id}     # Carpetas de dashboards
│
├── core_dashboards/{id}           # Templates globales (root)
├── core_dashboard_folders/{id}    # Carpetas de templates
│
├── users/{userId}                 # Perfiles de usuario
│   └── activeTenant, preferences
│
└── roles/{roleId}                 # Roles del sistema (read-only)
```

### Security Rules (Resumen)

```javascript
// Vizs y Dashboards
allow read: if isTenantMember(tenantId) || isPublic
allow create: if canCreate(tenantId)  // analyst+
allow update: if canEdit(tenantId, createdBy)  // owner o admin+
allow delete: if canDelete(tenantId)  // admin+

// Core Dashboards
allow read: if isAuthenticated()
allow write: if false  // Solo backend
```

---

## 8. Flujos de Datos Criticos

### Flujo: VizBuilder ejecuta query

```
1. Usuario selecciona dataset
2. Frontend: GET /api/semantic/datasets/{id}
3. Backend: Carga dataset + entities relacionadas de GCS
4. Frontend: Muestra campos en sidebar

5. Usuario selecciona campos y filtros
6. Usuario presiona "Run"
7. Frontend: POST /api/semantic/query { dataset_id, attributes, metrics, filters, ... }
8. Backend:
   a. Valida JWT, extrae tenant_id
   b. Carga dataset y entities de GCS
   c. Resuelve herencia (extends)
   d. Construye SQL con tokens reemplazados
   e. Inyecta WHERE tenant_id = @tenant
   f. Ejecuta en BigQuery
   g. Retorna { data, columns, meta }
9. Frontend: Renderiza tabla/grafico
```

### Flujo: Dashboard carga visualizaciones

```
1. Usuario abre dashboard
2. Frontend: getDocument('dashboards/{dashId}')
3. Por cada visualization element:
   a. Extrae embeddedConfig (VizConfig)
   b. Construye QueryRequest
   c. POST /api/semantic/query
   d. Almacena resultado en _runtimeData
4. Renderiza todos los graficos
```

### Flujo: Guardar viz

```
1. Usuario configura en VizBuilder
2. Usuario presiona "Guardar"
3. Frontend: Construye VizConfig
4. Frontend: addDoc('vizs', { config, name, folderId, ... })
5. Firestore: Valida security rules
6. Frontend: Redirige a viz guardada
```

---

## 9. Gaps y Proximos Pasos

### Backend (Agente Terraform)

| Feature | Estado | Prioridad |
|---------|--------|-----------|
| PoP con CTEs | Especificado, no implementado | CRITICA |
| Symmetric Aggregation | No implementado | CRITICA |
| Aggregate Awareness | No implementado | CRITICA |
| Cache (Datagroups) | No implementado | ALTA |
| Validate SQL endpoint | Parcial | MEDIA |

### Frontend (Claude Code)

| Feature | Estado | Prioridad |
|---------|--------|-----------|
| Cross-filtering | No implementado | ALTA |
| Drill-down | No implementado | ALTA |
| Export Excel/CSV | TODO | ALTA |
| Global Filters funcionales | Definido, no funcional | MEDIA |
| Busqueda global de campos | No implementado | MEDIA |

---

## 10. Convenios de Desarrollo

### Nomenclatura

| Concepto | Frontend | Backend | BigQuery |
|----------|----------|---------|----------|
| Dimension | Attribute | Attribute | Column |
| Medida | Metric | Metric | Column + AGG |
| Tabla logica | Entity | Entity | Table |
| Contexto query | Dataset | Dataset | JOIN config |
| Filtro | MetricFilter | Filter | WHERE clause |

### IDs de Campos

```
# Formato en frontend
entity.field           # Full ID (para queries cross-entity)
field                  # Short ID (dentro de un dataset)
field_timeframe        # Con transformacion (date_month, date_week)
field_variant          # Con comparacion (spend_previous, spend_delta_pct)
```

### Tokens SQL

| Token | Uso | Ejemplo |
|-------|-----|---------|
| `{TABLE}` | Referencia a tabla base | `{TABLE}.spend` |
| `{field_id}` | Referencia a otro campo | `SAFE_DIVIDE({clicks}, {impressions})` |
| `{entity.field}` | Campo de otra entity | `{meta_campaigns.name}` |

---

## Documentacion Relacionada

### Backend
- `frontend/docs/backend/SEMANTIC_LAYER_SPEC.md` - Especificacion completa
- `frontend/docs/backend/MULTI_TENANCY_RLS.md` - Seguridad multi-tenant
- `frontend/docs/backend/PERIOD_OVER_PERIOD_SPEC.md` - Spec de PoP
- `frontend/docs/backend/REPORTING_SCHEMA_PROPOSAL.md` - Schema BigQuery
- `frontend/docs/backend/DICCIONARIO_DATOS_META_ADS.md` - Diccionario de datos
- `frontend/docs/backend/VIZ_DASHBOARDS_SPEC.md` - Spec de Viz/Dashboards
- `frontend/docs/backend/SECURITY_AUDIT.md` - Auditoria de seguridad

### Frontend
- `CLAUDE.md` - Guia principal para desarrollo
- `docs/DATAMETRICX_VS_LOOKER.md` - Comparativa con Looker
- `docs/competitors/LOOKER_ANALYSIS.md` - Analisis de Looker

---

**Documento creado:** 2025-01-04

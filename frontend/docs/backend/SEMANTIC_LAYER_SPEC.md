# DataMetricX - Especificacion Tecnica del Core

**Version:** 1.5 (Release Candidate)
**Fecha:** Noviembre 2024
**Objetivo:** Motor de Business Intelligence "Headless" sobre BigQuery con modelado semantico flexible, generacion de SQL optimizado y experiencia No-Code.

---

## 1. Arquitectura General

El sistema actua como una **capa semantica intermedia** entre el Frontend (Studio) y el Data Warehouse.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Studio (Frontend React)                          │
│                           Interfaz No-Code                               │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ REST API
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Semantic Compiler (Backend API)                      │
│         Lee JSONs → Resuelve herencia → Inyecta SQL → Optimiza          │
└──────────────┬──────────────────────────────────────┬───────────────────┘
               │                                      │
               ▼                                      ▼
┌──────────────────────────┐              ┌───────────────────────────────┐
│   Storage Layer (GCS)    │              │   Data Warehouse (BigQuery)   │
│   Modelos JSON           │              │   Tablas RAW/Reporting        │
└──────────────────────────┘              └───────────────────────────────┘
```

### Componentes Principales

| Componente | Descripcion |
|------------|-------------|
| **Storage Layer (GCS)** | Sistema de archivos jerarquico que almacena modelos JSON |
| **Semantic Compiler (Backend)** | Motor que lee JSONs, resuelve herencia, inyecta SQL y optimiza consultas |
| **Data Warehouse (BigQuery)** | Ejecuta procesamiento masivo, almacena tablas RAW/Reporting |
| **Studio (Frontend React)** | Interfaz No-Code que consume la API para crear modelos y visualizar datos |

---

## 2. Modelo de Objetos (Jerarquia)

```
Dataset (Grafo)
    │
    ├── base_entity ─────► Entity (Nodo)
    │                          │
    │                          ├── Attribute (Dimension)
    │                          └── Metric (Medida)
    │
    └── relationships ───► [Entity, Entity, ...]
```

| Nivel | Descripcion |
|-------|-------------|
| **Dataset (Grafo)** | Define el contexto de analisis: Tabla base + Joins + Politicas de cache |
| **Entity (Nodo)** | Representa una tabla logica (Fisica o Derivada). Contiene definicion de campos |
| **Attribute (Dimension)** | Caracteristica cualitativa (Fecha, Campana, Pais) |
| **Metric (Medida)** | Calculo cuantitativo agregado (Inversion, ROAS, CTR) |

---

## 3. Especificacion del Esquema JSON

### 3.1. Entity (`/entities/*.json`)

```json
{
  "id": "fact_meta_ads",
  "type": "entity",
  "label": "Rendimiento Meta Ads",
  "category": "Marketing",
  "subcategory": "Performance",
  "hidden": false,

  "extends": "fact_meta_ads_core",

  "source": {
    "type": "table",
    "sql_table": "`datametricx-prod.reporting.fact_meta_ads_daily`",
    "sql_filter": "{TABLE}.status != 'DELETED'"
  },

  "attributes": [],
  "metrics": []
}
```

#### Propiedades de Entity

| Propiedad | Tipo | Obligatorio | Descripcion |
|-----------|------|-------------|-------------|
| `id` | String | Si | ID unico en el sistema (slug) |
| `type` | String | Si | Siempre `"entity"` |
| `label` | String | Si | Nombre visible para el usuario |
| `category` | String | No | Agrupador principal en menu lateral |
| `subcategory` | String | No | Agrupador secundario |
| `hidden` | Bool | No | Si `true`, no aparece en menu pero se usa para Joins |
| `extends` | String | No | ID de entidad padre para herencia |

#### Propiedad `source` (Origen de Datos)

**Caso A: Tabla Fisica**
```json
{
  "source": {
    "type": "table",
    "sql_table": "`project.dataset.table_name`",
    "sql_filter": "{TABLE}.status != 'DELETED'"
  }
}
```

**Caso B: Tabla Derivada (SQL Custom con Persistencia)**
```json
{
  "source": {
    "type": "derived",
    "sql": "SELECT campaign_id, SUM(spend) as total_spend FROM `project.raw.meta_ads` GROUP BY 1",
    "persistence": {
      "strategy": "persistent",
      "trigger": "24_hours",
      "partition_by": { "field": "date", "type": "day" }
    }
  }
}
```

| Propiedad | Tipo | Descripcion |
|-----------|------|-------------|
| `type` | String | `"table"` o `"derived"` |
| `sql_table` | String | Tabla fisica en BigQuery (solo type=table) |
| `sql` | String | Query SQL completa (solo type=derived) |
| `sql_filter` | String | WHERE fijo aplicado siempre. Row Level Security base |
| `persistence` | Object | Estrategia de cache: `ephemeral` (CTE) o `persistent` (Table) |

---

### 3.2. Attribute (Dimensiones)

```json
{
  "id": "campaign_name",
  "label": "Nombre Campana",
  "type": "string",
  "field": "campaign_name",
  "primary_key": false,
  "hidden": false
}
```

#### Propiedades de Attribute

| Propiedad | Tipo | Obligatorio | Descripcion |
|-----------|------|-------------|-------------|
| `id` | String | Si | Identificador unico interno |
| `label` | String | No | Nombre para la UI |
| `type` | String | Si | `string`, `number`, `date`, `boolean`, `location` |
| `field` | String | Condicional | Mapeo directo a columna (Opcion A - Recomendado) |
| `sql` | String | Condicional | Logica SQL personalizada (Opcion B) |
| `primary_key` | Bool | No | Si `true`, identifica la fila unica |
| `hidden` | Bool | No | Si `true`, no aparece en selector de campos |
| `group_label` | String | No | Agrupar en menu (ej: "Geografia") |

**Opcion A: Mapeo Directo (Recomendado)**
```json
{ "id": "name", "field": "campaign_name", "type": "string" }
```

**Opcion B: SQL Personalizado**
```json
{ "id": "name_upper", "sql": "UPPER({TABLE}.campaign_name)", "type": "string" }
```

---

### 3.3. Metric (Medidas)

Separamos la **expresion** (`sql`) de la **funcion** (`sql_agg`) para permitir inyeccion de filtros.

```json
{
  "id": "revenue_red_shoes",
  "label": "Ingresos (Zapatos Rojos)",
  "type": "currency",
  "sql": "{purchase_value}",
  "sql_agg": "SUM",
  "filters": [
    { "field": "product_category", "operator": "=", "value": "Shoes" },
    { "field": "product_color", "operator": "=", "value": "Red" }
  ],
  "format": "$0,0.00"
}
```

#### Propiedades de Metric

| Propiedad | Tipo | Obligatorio | Descripcion |
|-----------|------|-------------|-------------|
| `id` | String | Si | Identificador unico |
| `label` | String | No | Nombre para la UI |
| `type` | String | Si | `currency`, `number`, `percent` |
| `sql` | String | Si | Expresion nivel fila. Puede usar tokens `{ID_ATRIBUTO}` |
| `sql_agg` | String | Si | Funcion de agregacion |
| `filters` | Array | No | Filtros para Filtered Measure (CASE WHEN automatico) |
| `format` | String | No | Formato D3 (ej: `$0,0.00`) |
| `hidden` | Bool | No | Si `true`, se usa para calculos pero no se muestra |

#### Matriz de Agregacion (`sql_agg`)

| Valor | SQL Generado | Descripcion |
|-------|--------------|-------------|
| `SUM` | `SUM(expr)` | Suma estandar |
| `SUM_DISTINCT` | `SUM(DISTINCT expr)` | Suma valores unicos |
| `AVG` | `AVG(expr)` | Promedio estandar |
| `AVG_DISTINCT` | `AVG(DISTINCT expr)` | Promedio de valores unicos |
| `COUNT` | `COUNT(expr)` | Cuenta filas no nulas |
| `COUNT_DISTINCT` | `COUNT(DISTINCT expr)` | Cuenta valores unicos |
| `MIN` | `MIN(expr)` | Valor minimo |
| `MAX` | `MAX(expr)` | Valor maximo |
| `CUSTOM` | `expr` | Formula manual completa (ya incluye agregacion) |

---

### 3.4. Dataset (Relaciones)

```json
{
  "id": "meta_ads_insights",
  "type": "dataset",
  "label": "Meta Ads Insights",
  "base_entity": "fact_meta_ads",

  "relationships": [
    {
      "entity": "meta_campaigns",
      "join_type": "left",
      "sql_on": "{fact_meta_ads.campaign_id} = {meta_campaigns.id}"
    }
  ],

  "governance": {
    "default_filter": "last_30_days",
    "partition_field": "fact_meta_ads.date"
  }
}
```

#### Propiedades de Dataset

| Propiedad | Tipo | Obligatorio | Descripcion |
|-----------|------|-------------|-------------|
| `id` | String | Si | ID unico del dataset |
| `type` | String | Si | Siempre `"dataset"` |
| `label` | String | No | Nombre visible |
| `base_entity` | String | Si | ID de la entidad principal (FROM) |
| `relationships` | Array | No | Lista de joins |
| `governance` | Object | No | Politicas de filtro y particion (vital para costos) |

#### Propiedades de Relationship

| Propiedad | Tipo | Descripcion |
|-----------|------|-------------|
| `entity` | String | ID de la entidad a unir |
| `join_type` | String | `left`, `inner`, `full` |
| `sql_on` | String | Condicion de join usando tokens `{entity.field}` |

---

## 4. Logica del Compilador (Backend)

### 4.1. Resolucion de Tokens

El compilador parsea los strings `sql` y reemplaza:

| Token | Descripcion | Reemplazo |
|-------|-------------|-----------|
| `{TABLE}` | Referencia a la tabla base | Alias generado en runtime (ej: `t1`) |
| `{ID}` | Referencia a otro Atributo/Metrica | Inyeccion recursiva del SQL referenciado |

### 4.2. Generacion de SQL para Metricas

Algoritmo para construir el SELECT final:

```
1. Resolver Expresion Base (sql)
   └── Reemplazar tokens {ID} por SQL del atributo referenciado

2. Aplicar Filtros (filters)
   └── Si existen: CASE WHEN (condition) THEN expr ELSE NULL END

3. Aplicar Agregacion (sql_agg)
   └── SUM(expr_filtrada) AS metric_id
```

**Ejemplo de Compilacion:**

Input JSON:
```json
{
  "id": "spend_active",
  "sql": "{spend}",
  "sql_agg": "SUM",
  "filters": [{ "field": "status", "operator": "=", "value": "ACTIVE" }]
}
```

Output SQL:
```sql
SUM(CASE WHEN t1.status = 'ACTIVE' THEN t1.spend ELSE NULL END) AS spend_active
```

---

## 5. Storage & Gobernanza (Sistema de Capas)

Implementamos un sistema de archivos **"Overlay"** en Google Cloud Storage (GCS).

### 5.1. Estructura de Directorios

| Capa | Ruta GCS | Permisos | Uso |
|------|----------|----------|-----|
| **CORE** | `/core/...` | Read-Only (Tenant) | Modelos base mantenidos por RavencoreX |
| **TENANT** | `/tenants/{id}/...` | Read/Write | Personalizaciones y nuevos modelos del cliente |

```
gs://datametricx-models/
├── core/
│   ├── entities/
│   │   ├── marketing/
│   │   │   ├── meta_campaigns.json
│   │   │   ├── meta_adsets.json
│   │   │   └── fact_meta_performance.json
│   │   └── sales/
│   │       └── shopify_orders.json
│   └── datasets/
│       └── meta_ads_insights.json
│
└── tenants/
    └── {tenant_id}/
        ├── entities/
        │   └── marketing/
        │       └── meta_campaigns.json  (Override)
        └── datasets/
            └── custom_report.json
```

### 5.2. Estrategia de Resolucion (Cascada)

Cuando se solicita una entidad (ej: `meta_campaigns`), el backend busca en este orden:

```
1. Tenant Folder
   └── Si existe → Carga este archivo (Override)

2. Core Folder
   └── Si no existe en Tenant → Carga archivo base

3. Merge (extends)
   └── Si tiene `extends` → Busca padre y fusiona (Hijo sobrescribe Padre)
```

**Ejemplo de Merge:**

```json
// CORE: meta_campaigns_core.json
{
  "id": "meta_campaigns_core",
  "attributes": [
    { "id": "id", "field": "campaign_id" },
    { "id": "name", "field": "name" }
  ]
}

// TENANT: meta_campaigns.json
{
  "id": "meta_campaigns",
  "extends": "meta_campaigns_core",
  "attributes": [
    { "id": "custom_tag", "field": "client_tag" }  // Se agrega
  ]
}

// RESULTADO (Runtime)
{
  "id": "meta_campaigns",
  "attributes": [
    { "id": "id", "field": "campaign_id" },      // Del padre
    { "id": "name", "field": "name" },           // Del padre
    { "id": "custom_tag", "field": "client_tag" } // Del hijo
  ]
}
```

---

## 6. Soporte No-Code (Introspeccion para UI)

Endpoints auxiliares para que el Frontend construya formularios visuales sin que el usuario toque JSON.

### A. Listar Tablas (Catalog)

```
GET /api/v1/warehouse/tables
```

Retorna lista de tablas disponibles en BigQuery para crear nuevas Entidades.

**Response:**
```json
{
  "tables": [
    { "dataset": "raw", "table": "meta_campaigns", "row_count": 15420 },
    { "dataset": "raw", "table": "meta_ads", "row_count": 892341 }
  ]
}
```

### B. Detectar Esquema (Schema)

```
GET /api/v1/warehouse/schema?table=raw.meta_campaigns
```

Retorna columnas de una tabla fisica para pre-llenar Atributos y sugerir Metricas.

**Response:**
```json
{
  "columns": [
    { "name": "campaign_id", "type": "STRING", "mode": "NULLABLE" },
    { "name": "name", "type": "STRING", "mode": "NULLABLE" },
    { "name": "spend", "type": "FLOAT64", "mode": "NULLABLE" },
    { "name": "impressions", "type": "INT64", "mode": "NULLABLE" }
  ]
}
```

### C. Validar SQL

```
POST /api/v1/models/validate-sql
```

Verifica sintaxis de formulas personalizadas antes de guardar.

**Request:**
```json
{ "sql": "SAFE_DIVIDE(SUM({spend}), SUM({impressions})) * 1000" }
```

**Response:**
```json
{ "valid": true, "estimated_bytes": 1024000 }
```

---

## 7. API Reference

### Modeling

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| `GET` | `/api/v1/models/tree` | Arbol de archivos (Core + Tenant merged) |
| `GET` | `/api/v1/models/:type/:id` | Obtener definicion JSON |
| `PUT` | `/api/v1/models/:type/:id` | Guardar definicion (GCS Tenant) |
| `DELETE` | `/api/v1/models/:type/:id` | Eliminar modelo del Tenant |

### Analytics

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| `POST` | `/api/v1/analytics/query` | Ejecutar consulta (Dataset + Metrics + Dims) |
| `POST` | `/api/v1/analytics/dry-run` | Previsualizar SQL y costo estimado |

### Warehouse (Introspeccion)

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| `GET` | `/api/v1/warehouse/tables` | Listar tablas disponibles (Catalog) |
| `GET` | `/api/v1/warehouse/schema` | Detectar esquema de tabla fisica |
| `POST` | `/api/v1/models/validate-sql` | Validar sintaxis SQL |

---

## 8. Consideraciones de Seguridad

### SQL Injection
**JAMAS** concatenar inputs de usuario directos. Usar siempre IDs validados contra el modelo JSON.

### Row Level Security
Inyectar siempre el `tenant_id` en el WHERE de consultas si la tabla es compartida (multi-tenant fisica).

```sql
WHERE {TABLE}.tenant_id = @current_tenant_id
  AND (sql_filter_entidad)
  AND (filtros_usuario)
```

### Cost Control
- Imponer limites duros (`LIMIT`) en queries
- Obligar uso de particiones (`REQUIRE_PARTITION_FILTER`) en BigQuery
- Usar `governance.default_filter` para forzar rango de fechas

---

## 9. Ejemplos Completos

### 9.1. Entity: Meta Campaigns

```json
{
  "id": "meta_campaigns",
  "type": "entity",
  "label": "Campanas Meta",
  "category": "Marketing",
  "subcategory": "Meta Ads",

  "source": {
    "type": "table",
    "sql_table": "`datametricx-prod.reporting.meta_campaigns`",
    "sql_filter": "{TABLE}.status != 'DELETED'"
  },

  "attributes": [
    {
      "id": "id",
      "label": "Campaign ID",
      "type": "string",
      "field": "campaign_id",
      "primary_key": true,
      "hidden": true
    },
    {
      "id": "name",
      "label": "Nombre",
      "type": "string",
      "field": "name"
    },
    {
      "id": "status",
      "label": "Estado",
      "type": "string",
      "field": "status"
    },
    {
      "id": "objective",
      "label": "Objetivo",
      "type": "string",
      "field": "objective"
    },
    {
      "id": "daily_budget",
      "label": "Presupuesto Diario",
      "type": "number",
      "sql": "SAFE_DIVIDE({TABLE}.daily_budget_micro, 1000000)",
      "group_label": "Presupuesto"
    }
  ],

  "metrics": []
}
```

### 9.2. Entity: Fact Meta Performance

```json
{
  "id": "fact_meta_performance",
  "type": "entity",
  "label": "Rendimiento Meta Ads",
  "category": "Marketing",
  "subcategory": "Performance",

  "source": {
    "type": "table",
    "sql_table": "`datametricx-prod.reporting.meta_performance_campaign_daily`"
  },

  "attributes": [
    {
      "id": "date",
      "label": "Fecha",
      "type": "date",
      "field": "date_start",
      "primary_key": true
    },
    {
      "id": "campaign_id",
      "type": "string",
      "field": "campaign_id",
      "hidden": true
    }
  ],

  "metrics": [
    {
      "id": "impressions",
      "label": "Impresiones",
      "type": "number",
      "sql": "{TABLE}.impressions",
      "sql_agg": "SUM",
      "format": "0,0"
    },
    {
      "id": "clicks",
      "label": "Clicks",
      "type": "number",
      "sql": "{TABLE}.clicks",
      "sql_agg": "SUM",
      "format": "0,0"
    },
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
    },
    {
      "id": "cpm",
      "label": "CPM",
      "type": "currency",
      "sql": "SAFE_DIVIDE(SUM({TABLE}.spend), SUM({TABLE}.impressions)) * 1000",
      "sql_agg": "CUSTOM",
      "format": "$0.00"
    },
    {
      "id": "cpc",
      "label": "CPC",
      "type": "currency",
      "sql": "SAFE_DIVIDE(SUM({TABLE}.spend), SUM({TABLE}.clicks))",
      "sql_agg": "CUSTOM",
      "format": "$0.00"
    }
  ]
}
```

### 9.3. Dataset: Meta Ads Insights

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

---

## 10. Proximos Pasos

- [ ] Definir entities para todas las tablas raw de Meta Ads
- [ ] Implementar sistema de capas CORE/TENANT en GCS
- [ ] Crear endpoints de introspeccion (`/warehouse/*`)
- [ ] Implementar logica de herencia (`extends`) en backend
- [ ] Agregar validacion JSON Schema
- [ ] Implementar Row Level Security por tenant

---

## Changelog

| Fecha | Version | Descripcion |
|-------|---------|-------------|
| 2024-11-30 | 1.5 | Sistema de capas CORE/TENANT, soporte No-Code, API Reference |
| 2024-11-30 | 1.3 | Source polimorfico, sql_agg, datasets |
| 2024-11-30 | 1.0 | Especificacion inicial de Entity Schema |

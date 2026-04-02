# DataMetricX - Capa Semántica (Semantic Layer)

**Versión:** 1.5 (Release Candidate)
**Fecha:** Noviembre 2024
**Objetivo:** Construir un motor de Business Intelligence "Headless" sobre BigQuery que permita modelado semántico flexible, generación de SQL optimizado y una experiencia de usuario No-Code.

---

## Visión General

La capa semántica de DataMetricX actúa como una **capa intermedia** entre el Frontend (Studio) y el Data Warehouse. Convierte definiciones JSON (Objetos Semánticos) en consultas SQL nativas optimizadas para BigQuery.

### Capacidades

1. **Abstracción del SQL**: Los usuarios finales trabajan con campos "bonitos" sin ver SQL crudo
2. **Reutilización**: Definir lógica de negocio una vez y usarla en múltiples dashboards
3. **Gobernanza**: Control centralizado de métricas y dimensiones
4. **Herencia**: Extender entidades CORE sin modificarlas
5. **Joins Automáticos**: Definir relaciones entre entidades en un Dataset
6. **No-Code**: Interfaz visual que consume la API para crear modelos

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                      STUDIO UI (React)                           │
│           Interfaz No-Code para modelado y visualización         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Request: Dataset + Metrics + Dims
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 SEMANTIC COMPILER (Backend API)                  │
│                      Node.js / Python                            │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     MOTOR DE COMPILACIÓN                    │ │
│  │                                                              │ │
│  │  1. Lee JSONs de GCS (Core + Tenant)                        │ │
│  │  2. Aplica estrategia de resolución (Cascada)               │ │
│  │  3. Resuelve herencia (extends)                             │ │
│  │  4. Resuelve tokens ({TABLE}, {field_id})                   │ │
│  │  5. Aplica filtros permanentes (sql_filter)                 │ │
│  │  6. Construye JOINs desde Dataset                           │ │
│  │  7. Aplica gobernanza (particiones, límites, RLS)           │ │
│  │  8. Genera SQL optimizado                                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │ SQL Nativo
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BIGQUERY                                  │
│            Procesamiento masivo + Tablas RAW/Reporting           │
└─────────────────────────────────────────────────────────────────┘
```

### Componentes Principales

| Componente | Descripción |
|------------|-------------|
| **Storage Layer (GCS)** | Sistema de archivos jerárquico que almacena modelos JSON (Core + Tenant) |
| **Semantic Compiler** | Motor que lee JSONs, resuelve herencia, inyecta SQL y optimiza consultas |
| **Data Warehouse (BigQuery)** | Ejecuta procesamiento masivo y almacena tablas RAW/Reporting |
| **Studio (Frontend React)** | Interfaz No-Code que consume la API para crear modelos y visualizar datos |

---

## Modelo de Objetos (Jerarquía)

```
┌─────────────────────────────────────────────────────────────────┐
│                     DATASET (Grafo)                              │
│  Define el contexto de análisis:                                 │
│  - Tabla base + Joins                                            │
│  - Políticas de caché/particionamiento                           │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    ENTITY (Nodo)                            │ │
│  │  Representa una tabla lógica (Física o Derivada)            │ │
│  │  Contiene la definición de campos                           │ │
│  │                                                              │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                   │ │
│  │  │   ATTRIBUTE     │  │     METRIC      │                   │ │
│  │  │  (Dimensión)    │  │    (Medida)     │                   │ │
│  │  │                 │  │                 │                   │ │
│  │  │ Característica  │  │ Cálculo         │                   │ │
│  │  │ cualitativa:    │  │ cuantitativo:   │                   │ │
│  │  │ Fecha, Campaña, │  │ Inversión, ROAS,│                   │ │
│  │  │ País            │  │ CTR             │                   │ │
│  │  └─────────────────┘  └─────────────────┘                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Esquema JSON: Entity

Define la estructura de una tabla o vista lógica.

```json
{
  "id": "fact_meta_ads",
  "type": "entity",
  "label": "Rendimiento Meta Ads",
  "category": "Marketing",
  "subcategory": "Performance",
  "hidden": false,

  // ═══════════════════════════════════════════════════════════════
  // HERENCIA
  // Permite extender una entidad Core sin modificarla
  // ═══════════════════════════════════════════════════════════════
  "extends": "fact_meta_ads_core",

  // ═══════════════════════════════════════════════════════════════
  // ORIGEN DE DATOS (Polimórfico)
  // ═══════════════════════════════════════════════════════════════
  "source": {
    "type": "table",
    "sql_table": "`ravencore.reporting.fact_meta_ads_daily`",
    "sql_filter": "{TABLE}.status != 'DELETED'"
  },

  // ═══════════════════════════════════════════════════════════════
  // CONTENIDO
  // ═══════════════════════════════════════════════════════════════
  "attributes": [],
  "metrics": []
}
```

---

## Propiedades de Entity

### Propiedades de Identidad

| Propiedad | Tipo | Obligatorio | Descripción |
|-----------|------|-------------|-------------|
| `id` | String | Sí | ID único (snake_case). Ej: `fact_meta_ads` |
| `type` | String | Sí | Siempre `"entity"` |
| `label` | String | Sí | Nombre visible para la UI |
| `category` | String | No | Agrupador nivel 1. Ej: `"Marketing"` |
| `subcategory` | String | No | Agrupador nivel 2. Ej: `"Performance"` |

### Propiedades de Comportamiento

| Propiedad | Tipo | Obligatorio | Descripción |
|-----------|------|-------------|-------------|
| `hidden` | Boolean | No | Si `true`, no aparece en menú pero se usa en Joins |
| `extends` | String | No | ID de Entity CORE para heredar campos sin modificarla |

---

## Source: Origen de Datos (Polimórfico)

La propiedad `source` define de dónde vienen los datos.

### Caso A: Tabla Física

```json
{
  "source": {
    "type": "table",
    "sql_table": "`ravencore.reporting.fact_meta_ads_daily`",
    "sql_filter": "{TABLE}.status != 'DELETED'"
  }
}
```

### Caso B: Tabla Derivada (SQL Custom con Persistencia)

```json
{
  "source": {
    "type": "derived",
    "sql": "SELECT campaign_id, SUM(spend) as total_spend FROM `project.raw.meta_insights` GROUP BY 1",
    "persistence": {
      "strategy": "persistent",
      "trigger": "24_hours",
      "partition_by": {
        "field": "date",
        "type": "day"
      }
    }
  }
}
```

### Propiedades de Source

| Propiedad | Tipo | Obligatorio | Descripción |
|-----------|------|-------------|-------------|
| `type` | String | Sí | `"table"` o `"derived"` |
| `sql_table` | String | Si type=table | Tabla física en BigQuery |
| `sql` | String | Si type=derived | Query SQL completo |
| `sql_filter` | String | No | WHERE permanente (Row Level Security base). Usa `{TABLE}` |
| `persistence` | Object | No | Config de materialización para derived tables |

### Persistence (para Derived Tables)

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `strategy` | String | `"ephemeral"` (CTE) o `"persistent"` (Table materializada) |
| `trigger` | String | Frecuencia de refresh: `"24_hours"`, `"1_hour"`, `"on_demand"` |
| `partition_by` | Object | `{ "field": "date", "type": "day" }` |

---

## Propiedades de Attribute (Dimensión)

Los Attributes son características cualitativas para agrupar y filtrar.

```json
{
  "id": "campaign_name",
  "label": "Nombre Campaña",
  "type": "string",

  // OPCIÓN A: Mapeo Directo (Recomendado)
  "field": "campaign_name",

  // OPCIÓN B: SQL Personalizado
  // "sql": "UPPER({TABLE}.campaign_name)",

  "primary_key": false,
  "hidden": false
}
```

### Tabla de Propiedades

| Propiedad | Tipo | Obligatorio | Descripción |
|-----------|------|-------------|-------------|
| `id` | String | Sí | Identificador único interno |
| `label` | String | No | Nombre para la UI |
| `type` | String | Sí | `string`, `number`, `date`, `boolean`, `location` |
| `field` | String | Opción A | Nombre de columna directa (Recomendado) |
| `sql` | String | Opción B | Expresión SQL. Usa `{TABLE}` o `{otro_id}` |
| `primary_key` | Boolean | No | Si `true`, identifica fila única |
| `hidden` | Boolean | No | Si `true`, no visible en selector |

### field vs sql

```json
// OPCIÓN A: field (mapeo directo) - RECOMENDADO
{
  "id": "campaign_name",
  "field": "campaign_name",
  "type": "string"
}
// Genera: t1.campaign_name AS campaign_name

// OPCIÓN B: sql (lógica custom)
{
  "id": "campaign_status_label",
  "sql": "CASE WHEN {TABLE}.status = 'ACTIVE' THEN 'Activa' ELSE 'Inactiva' END",
  "type": "string"
}
// Genera: CASE WHEN t1.status = 'ACTIVE' THEN 'Activa' ELSE 'Inactiva' END AS campaign_status_label
```

### Tipos de Attribute

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| `string` | Texto, categorías | `"campaign_name"` |
| `number` | Valores numéricos | `"quantity"` |
| `date` | Fechas (DATE, TIMESTAMP) | `"created_at"` |
| `boolean` | Verdadero/Falso | `"is_active"` |
| `location` | Datos geográficos | `"country_code"` |

---

## Propiedades de Metric (Medida)

Los Metrics son cálculos cuantitativos agregados. Separamos la **expresión** (`sql`) de la **función** (`sql_agg`) para permitir inyección automática de filtros.

```json
{
  "id": "revenue_red_shoes",
  "label": "Ingresos (Zapatos Rojos)",
  "type": "currency",

  // 1. EXPRESIÓN (Nivel Fila)
  // Referencia a columna o cálculo simple. Puede usar tokens {ID_ATRIBUTO}.
  "sql": "{purchase_value}",

  // 2. AGREGACIÓN (Envoltura)
  "sql_agg": "SUM",

  // 3. FILTROS (Filtered Measure)
  // El backend genera el CASE WHEN automáticamente.
  "filters": [
    { "field": "product_category", "operator": "=", "value": "Shoes" },
    { "field": "product_color", "operator": "=", "value": "Red" }
  ],

  "format": "$0,0.00",
  "hidden": false
}
```

### Tabla de Propiedades

| Propiedad | Tipo | Obligatorio | Descripción |
|-----------|------|-------------|-------------|
| `id` | String | Sí | Identificador único |
| `label` | String | No | Nombre para la UI |
| `type` | String | Sí | `number`, `currency`, `percent` |
| `sql` | String | Sí | Expresión a nivel fila. Puede usar `{TABLE}` o `{otro_id}` |
| `sql_agg` | String | Sí | Función de agregación (ver matriz) |
| `format` | String | No | Formato de visualización (D3/Numeral.js) |
| `hidden` | Boolean | No | Si `true`, se usa para cálculos pero no se muestra |
| `filters` | Array | No | Filtros específicos para esta métrica |

---

## Matriz de Agregación (sql_agg)

El compilador genera SQL según el valor de `sql_agg`:

| Valor `sql_agg` | SQL Generado | Descripción |
|-----------------|--------------|-------------|
| `SUM` | `SUM(expr_filtrada)` | Suma estándar |
| `SUM_DISTINCT` | `SUM(DISTINCT expr_filtrada)` | Suma valores únicos (evita duplicados por joins) |
| `AVG` | `AVG(expr_filtrada)` | Promedio estándar |
| `AVG_DISTINCT` | `AVG(DISTINCT expr_filtrada)` | Promedio de valores únicos |
| `COUNT` | `COUNT(expr_filtrada)` | Cuenta filas no nulas |
| `COUNT_DISTINCT` | `COUNT(DISTINCT expr_filtrada)` | Cuenta valores únicos (Cardinalidad) |
| `MIN` | `MIN(expr_filtrada)` | Valor mínimo |
| `MAX` | `MAX(expr_filtrada)` | Valor máximo |
| `CUSTOM` | `expr_filtrada` | El usuario escribió la fórmula manual completa |

### Ejemplos de Metrics con sql_agg

```json
// Suma simple
{
  "id": "total_spend",
  "label": "Gasto Total",
  "sql": "{TABLE}.spend",
  "sql_agg": "SUM",
  "type": "currency",
  "format": "$0,0.00"
}
// Genera: SUM(t1.spend) AS total_spend

// Suma DISTINCT (evitar duplicados por joins)
{
  "id": "unique_revenue",
  "label": "Ingresos Únicos",
  "sql": "{TABLE}.order_total",
  "sql_agg": "SUM_DISTINCT",
  "type": "currency"
}
// Genera: SUM(DISTINCT t1.order_total) AS unique_revenue

// Conteo de valores únicos
{
  "id": "unique_customers",
  "label": "Clientes Únicos",
  "sql": "{TABLE}.customer_id",
  "sql_agg": "COUNT_DISTINCT",
  "type": "number",
  "format": "0,0"
}
// Genera: COUNT(DISTINCT t1.customer_id) AS unique_customers

// Ratio calculado (CUSTOM)
{
  "id": "roas",
  "label": "ROAS",
  "sql": "SAFE_DIVIDE(SUM({TABLE}.revenue), SUM({TABLE}.spend))",
  "sql_agg": "CUSTOM",
  "type": "number",
  "format": "0.00"
}
// Genera: SAFE_DIVIDE(SUM(t1.revenue), SUM(t1.spend)) AS roas
```

---

## Métricas Filtradas (Filtered Measures)

Permite crear métricas que solo consideran registros que cumplen ciertos criterios. El backend genera el `CASE WHEN` automáticamente.

```json
{
  "id": "revenue_shoes",
  "label": "Ventas Zapatos",
  "sql": "{TABLE}.revenue",
  "sql_agg": "SUM",
  "type": "currency",
  "format": "$0,0.00",
  "filters": [
    { "field": "product_category", "operator": "=", "value": "Shoes" }
  ]
}
```

### SQL Generado (con filtros)

```sql
SUM(CASE WHEN t1.product_category = 'Shoes' THEN t1.revenue ELSE NULL END) AS revenue_shoes
```

### Operadores Soportados

| Operador | Descripción | Ejemplo |
|----------|-------------|---------|
| `=` | Igual a | `"value": "Shoes"` |
| `!=` | Diferente de | `"value": "Deleted"` |
| `>` | Mayor que | `"value": 100` |
| `>=` | Mayor o igual | `"value": 0` |
| `<` | Menor que | `"value": 1000` |
| `<=` | Menor o igual | `"value": 50` |
| `in` | En lista | `"value": ["Shoes", "Bags"]` |
| `not_in` | No en lista | `"value": ["Test", "Demo"]` |
| `contains` | Contiene substring | `"value": "promo"` |
| `is_null` | Es NULL | `"value": null` |
| `is_not_null` | No es NULL | `"value": null` |

---

## Esquema JSON: Dataset (Relaciones)

Define cómo se unen las Entities para crear un contexto de análisis (similar a Explores en Looker).

```json
{
  "id": "meta_ads_insights",
  "type": "dataset",
  "label": "Meta Ads Performance",
  "base_entity": "fact_meta_ads",

  "relationships": [
    {
      "entity": "meta_campaigns",
      "join_type": "left",
      "sql_on": "{fact_meta_ads.campaign_id} = {meta_campaigns.id}"
    },
    {
      "entity": "meta_adsets",
      "join_type": "left",
      "sql_on": "{fact_meta_ads.adset_id} = {meta_adsets.id}"
    }
  ],

  "governance": {
    "default_filter": "last_30_days",
    "partition_field": "fact_meta_ads.date"
  }
}
```

### Propiedades de Dataset

| Propiedad | Tipo | Obligatorio | Descripción |
|-----------|------|-------------|-------------|
| `id` | String | Sí | Identificador único |
| `type` | String | Sí | Siempre `"dataset"` |
| `label` | String | No | Nombre visible |
| `base_entity` | String | Sí | ID de la Entity principal (FROM) |
| `relationships` | Array | No | Lista de Joins |
| `governance` | Object | No | Políticas de acceso y optimización |

### Propiedades de Relationship

| Propiedad | Tipo | Obligatorio | Descripción |
|-----------|------|-------------|-------------|
| `entity` | String | Sí | ID de la Entity a unir |
| `join_type` | String | Sí | `"left"`, `"inner"`, `"full"` |
| `sql_on` | String | Sí | Condición de JOIN. Usa `{entity.field}` |

### Propiedades de Governance

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `default_filter` | String | Filtro obligatorio para optimizar costos (vital) |
| `partition_field` | String | Campo de partición para BigQuery |

---

## Sistema de Tokens del Compilador

El compilador parsea los strings `sql` y reemplaza tokens:

| Token | Descripción | Reemplazo |
|-------|-------------|-----------|
| `{TABLE}` | Referencia a la tabla base | Alias generado en runtime (ej. `t1`) |
| `{field_id}` | Referencia a otro Attribute/Metric | Inyección recursiva del SQL del campo referenciado |

### Ejemplos de Resolución

```json
// Definición
{
  "id": "ctr",
  "sql": "SAFE_DIVIDE({total_clicks}, {total_impressions}) * 100",
  "sql_agg": "CUSTOM"
}

// Dependencias
{ "id": "total_clicks", "sql": "{TABLE}.clicks", "sql_agg": "SUM" }
{ "id": "total_impressions", "sql": "{TABLE}.impressions", "sql_agg": "SUM" }

// Resolución paso a paso:
// 1. {total_clicks} → SUM(t1.clicks)
// 2. {total_impressions} → SUM(t1.impressions)
// 3. Resultado: SAFE_DIVIDE(SUM(t1.clicks), SUM(t1.impressions)) * 100 AS ctr
```

---

## Storage & Gobernanza (Sistema de Capas)

Implementamos un sistema de archivos **"Overlay"** en Google Cloud Storage (GCS).

### Estructura de Directorios

| Capa | Ruta GCS | Permisos | Uso |
|------|----------|----------|-----|
| **CORE** | `/core/...` | Read-Only (Tenant) | Modelos base mantenidos por RavencoreX |
| **TENANT** | `/tenants/{id}/...` | Read/Write | Personalizaciones y nuevos modelos del cliente |

### Estructura de Archivos

```
/core/
├── datasets/
│   ├── meta_ads_insights.json
│   └── google_ads_performance.json
├── entities/
│   ├── marketing/
│   │   ├── fact_meta_ads_core.json
│   │   ├── meta_campaigns_core.json
│   │   └── meta_adsets_core.json
│   └── sales/
│       └── shopify_orders_core.json

/tenants/{tenant_id}/
├── datasets/
│   └── custom_ecommerce_analysis.json
├── entities/
│   ├── marketing/
│   │   └── fact_meta_ads.json       # extends: fact_meta_ads_core
│   └── custom/
│       └── my_custom_entity.json
```

### Estrategia de Resolución (Cascada)

Cuando se solicita una entidad (ej: `meta_campaigns`), el backend busca en este orden:

```
1. TENANT FOLDER
   └── Si existe → Carga este archivo (Override)

2. CORE FOLDER
   └── Si no existe en Tenant → Carga el archivo base

3. MERGE (extends)
   └── Si el archivo tiene "extends" → Busca al padre y fusiona
       (Hijo sobrescribe Padre)
```

### Ejemplo de Override

```json
// CORE: /core/entities/marketing/fact_meta_ads_core.json
{
  "id": "fact_meta_ads_core",
  "source": { "type": "table", "sql_table": "`ravencore.reporting.fact_meta_ads`" },
  "attributes": [
    { "id": "campaign_id", "field": "campaign_id", "type": "string" }
  ],
  "metrics": [
    { "id": "spend", "sql": "{TABLE}.spend", "sql_agg": "SUM", "type": "currency" }
  ]
}

// TENANT: /tenants/acme/entities/marketing/fact_meta_ads.json
{
  "id": "fact_meta_ads",
  "extends": "fact_meta_ads_core",
  "metrics": [
    // Agrega métrica custom del tenant
    { "id": "custom_roas", "sql": "SAFE_DIVIDE({revenue}, {spend})", "sql_agg": "CUSTOM", "type": "number" }
  ]
}
```

---

## Soporte No-Code (Introspección para UI)

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
    { "project": "ravencore", "dataset": "reporting", "table": "fact_meta_ads_daily" },
    { "project": "ravencore", "dataset": "reporting", "table": "meta_campaigns" }
  ]
}
```

### B. Detectar Esquema (Schema)

```
GET /api/v1/warehouse/schema?table=dataset.table
```

Retorna columnas (name, type) de una tabla física.

**Response:**
```json
{
  "columns": [
    { "name": "campaign_id", "type": "STRING", "mode": "NULLABLE" },
    { "name": "spend", "type": "FLOAT64", "mode": "NULLABLE" },
    { "name": "date", "type": "DATE", "mode": "NULLABLE" }
  ]
}
```

**Uso Frontend:** Permite pre-llenar la lista de Atributos y sugerir Métricas automáticamente.

### C. Validar SQL

```
POST /api/v1/models/validate-sql
```

Verifica sintaxis de fórmulas personalizadas antes de guardar.

**Request:**
```json
{
  "sql": "SAFE_DIVIDE(SUM({TABLE}.revenue), SUM({TABLE}.spend))",
  "entity_id": "fact_meta_ads"
}
```

**Response:**
```json
{
  "valid": true,
  "compiled_sql": "SAFE_DIVIDE(SUM(t1.revenue), SUM(t1.spend))",
  "errors": []
}
```

---

## API Reference

### Endpoints de Modeling

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/v1/models/tree` | Árbol de archivos (Core + Tenant merged) |
| `GET` | `/api/v1/models/:type/:id` | Obtener definición JSON |
| `PUT` | `/api/v1/models/:type/:id` | Guardar definición (GCS Tenant) |

### Endpoints de Analytics

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/v1/analytics/query` | Ejecutar consulta (Dataset + Metrics + Dims) |
| `POST` | `/api/v1/analytics/dry-run` | Previsualizar SQL y costo estimado |

### Endpoints de Warehouse

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/v1/warehouse/tables` | Listar tablas disponibles en BigQuery |
| `GET` | `/api/v1/warehouse/schema` | Introspección de esquema de tabla física |
| `POST` | `/api/v1/models/validate-sql` | Validar sintaxis de fórmulas SQL |

### Request de Query

```json
{
  "dataset": "meta_ads_insights",
  "attributes": ["campaign_name", "adset_name", "date"],
  "metrics": ["total_spend", "total_revenue", "roas"],
  "filters": [
    { "field": "date", "operator": ">=", "value": "2024-01-01" }
  ],
  "sort": [{ "field": "total_spend", "direction": "desc" }],
  "limit": 1000
}
```

### Response

```json
{
  "data": [...],
  "metadata": {
    "total_rows": 1000,
    "bytes_processed": 52428800,
    "cache_hit": false,
    "sql": "SELECT ... FROM ... WHERE ... GROUP BY ..."
  }
}
```

---

## Lógica del Compilador

### Paso 1: Resolución de Capas

```typescript
async function loadEntity(entityId: string, tenantId: string): Promise<Entity> {
  // 1. Buscar en Tenant
  const tenantPath = `/tenants/${tenantId}/entities/${entityId}.json`;
  let entity = await tryReadFromGCS(tenantPath);

  // 2. Si no existe, buscar en Core
  if (!entity) {
    const corePath = `/core/entities/${entityId}.json`;
    entity = await readFromGCS(corePath);
  }

  // 3. Si tiene extends, resolver herencia
  if (entity.extends) {
    const parent = await loadEntity(entity.extends, tenantId);
    return mergeEntities(parent, entity);
  }

  return entity;
}
```

### Paso 2: Resolución de Tokens

```typescript
function resolveTokens(sql: string, entity: Entity, alias: string): string {
  // Reemplazar {TABLE}
  let resolved = sql.replace(/\{TABLE\}/g, alias);

  // Reemplazar {field_id} con recursión
  const fieldRefs = sql.match(/\{([a-z_]+)\}/g) || [];
  for (const ref of fieldRefs) {
    const fieldId = ref.slice(1, -1);
    if (fieldId === 'TABLE') continue;

    const field = [...entity.attributes, ...entity.metrics].find(f => f.id === fieldId);
    if (!field) throw new Error(`Field {${fieldId}} not found`);

    const resolvedField = resolveTokens(field.sql, entity, alias);
    resolved = resolved.replace(ref, resolvedField);
  }

  return resolved;
}
```

### Paso 3: Generación de Métrica

```typescript
function compileMetric(metric: Metric, entity: Entity, alias: string): string {
  // 1. Resolver expresión base
  let expr = resolveTokens(metric.sql, entity, alias);

  // 2. Aplicar filtros (CASE WHEN)
  if (metric.filters?.length) {
    const conditions = metric.filters.map(f => filterToSQL(f, alias)).join(' AND ');
    expr = `CASE WHEN ${conditions} THEN ${expr} ELSE NULL END`;
  }

  // 3. Aplicar función de agregación
  switch (metric.sql_agg) {
    case 'SUM': return `SUM(${expr})`;
    case 'SUM_DISTINCT': return `SUM(DISTINCT ${expr})`;
    case 'AVG': return `AVG(${expr})`;
    case 'AVG_DISTINCT': return `AVG(DISTINCT ${expr})`;
    case 'COUNT': return `COUNT(${expr})`;
    case 'COUNT_DISTINCT': return `COUNT(DISTINCT ${expr})`;
    case 'MIN': return `MIN(${expr})`;
    case 'MAX': return `MAX(${expr})`;
    case 'CUSTOM': return expr;
    default: throw new Error(`Unknown aggregation: ${metric.sql_agg}`);
  }
}
```

---

## Consideraciones de Seguridad

### SQL Injection

```typescript
// JAMÁS hacer esto:
const sql = `SELECT * FROM ${userInput}`;

// SIEMPRE validar IDs contra el modelo JSON:
function validateFieldId(fieldId: string, entity: Entity): boolean {
  const validIds = [...entity.attributes, ...entity.metrics].map(f => f.id);
  return validIds.includes(fieldId);
}
```

### Row Level Security (RLS)

Inyectar siempre el `tenant_id` en el WHERE de consultas si la tabla es compartida (multi-tenant física):

```typescript
function injectTenantFilter(sql: string, tenantId: string): string {
  return `${sql} AND tenant_id = '${sanitize(tenantId)}'`;
}
```

### Cost Control

1. **Límites duros**: Imponer `LIMIT` máximo en todas las queries
2. **Particiones obligatorias**: Usar `REQUIRE_PARTITION_FILTER` en BigQuery
3. **Governance filters**: Forzar `default_filter` en Datasets (ej: `last_30_days`)

```sql
-- BigQuery Table Options
ALTER TABLE `project.dataset.table`
SET OPTIONS (require_partition_filter = true);
```

---

## Formatos de Visualización

### Formatos Numeral.js

| Formato | Resultado | Uso |
|---------|-----------|-----|
| `0,0` | 1,234 | Enteros |
| `0,0.00` | 1,234.56 | Decimales |
| `$0,0.00` | $1,234.56 | Moneda USD |
| `0.00%` | 12.34% | Porcentaje |
| `0.0a` | 1.2k, 1.2M | Abreviado |
| `0,0[.]00` | 1,234 o 1,234.56 | Decimales opcionales |

---

## Roadmap

### Fase 1: MVP (Actual)
- [x] Entity con attributes y metrics
- [x] Propiedad `hidden`
- [x] Propiedad `extends` (herencia)
- [x] Source polimórfico (table/derived)
- [x] Separación `sql` + `sql_agg`
- [x] Agregaciones DISTINCT
- [x] Filtered measures
- [x] Sistema de capas (CORE/TENANT)
- [ ] Implementación del Compilador en backend

### Fase 2: Datasets (Explores)
- [ ] Definición de relaciones (relationships)
- [ ] Joins automáticos
- [ ] Fanout warnings (1:N joins)
- [ ] Governance policies

### Fase 3: No-Code UI
- [ ] Introspección de tablas BigQuery
- [ ] Sugerencia automática de atributos/métricas
- [ ] Validación de SQL en tiempo real
- [ ] Editor visual de Entities

### Fase 4: Optimización
- [ ] Caching de Entities resueltas
- [ ] Validación de SQL pre-ejecución
- [ ] Sugerencias de índices
- [ ] Materialización automática

---

## Referencias

- [LookML Reference (Looker)](https://cloud.google.com/looker/docs/lookml-reference)
- [Cube.js Schema](https://cube.dev/docs/schema/fundamentals/concepts)
- [dbt Semantic Layer](https://docs.getdbt.com/docs/use-dbt-semantic-layer/quickstart-sl)
- [MetricFlow Specification](https://docs.transform.co/docs/metricflow/spec)

---

**Documento creado**: 2025-11-30
**Última actualización**: 2025-11-30
**Versión**: 1.5 (Release Candidate)

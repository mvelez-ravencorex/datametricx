# Dataset System Rules

Este documento describe las reglas y convenciones para crear y mantener datasets en DataMetricX.

## 1. Estructura del Schema JSON

Cada dataset se define en un archivo JSON con la siguiente estructura:

```json
{
  "name": "dataset_name",
  "label": "Display Name",
  "description": "Description of the dataset",
  "category": "advertising|analytics|ecommerce",
  "source": {
    "type": "bigquery",
    "project": "datametricx-prod",
    "dataset": "reporting",
    "table": "table_name"
  },
  "primary_key": ["field_id"],
  "dimensions": [...],
  "dimension_groups": [...],
  "measures": [...],
  "calculations": [...],
  "filters": [...]
}
```

---

## 2. Tipos de Campos

### 2.1 Dimensions (Atributos)

Campos para agrupar y filtrar datos. NO se agregan.

```json
{
  "name": "campaign_id",
  "label": "Campaign ID",
  "type": "string|number|yesno",
  "description": "Description",
  "sql": "${TABLE}.campaign_id",
  "primary_key": true,
  "hidden": false
}
```

**Tipos soportados:**
- `string` - Texto
- `number` - Número
- `yesno` - Booleano (true/false)

---

### 2.2 Dimension Groups (Campos de Fecha/Tiempo)

Campos de fecha que se expanden en múltiples timeframes.

```json
{
  "name": "created_time",
  "label": "Created",
  "type": "time",
  "description": "When the record was created",
  "sql": "${TABLE}.created_time",
  "timeframes": ["raw", "time", "datetime", "date", "week", "month", "quarter", "year"],
  "datatype": "timestamp|date|datetime",
  "convert_tz": false,
  "hidden": false
}
```

**Timeframes disponibles:**

| Timeframe | Descripción | Ejemplo Display | SQL BigQuery |
|-----------|-------------|-----------------|--------------|
| `raw` | Timestamp original | `2024-01-15T14:30:00Z` | `field` |
| `time` | Solo hora | `02:30 PM` | `FORMAT_TIMESTAMP('%I:%M %p', field)` |
| `datetime` | Fecha y hora | `01/15/2024, 02:30 PM` | `FORMAT_TIMESTAMP('%Y-%m-%d %I:%M %p', field)` |
| `date` | Solo fecha | `2024-01-15` | `DATE(field)` |
| `week` | Inicio de semana (lunes) | `2024-01-15` | `DATE_TRUNC(DATE(field), WEEK(MONDAY))` |
| `month` | Año-mes | `2024-01` | `FORMAT_DATE('%Y-%m', DATE(field))` |
| `quarter` | Trimestre | `Q1` | `CONCAT('Q', CAST(EXTRACT(QUARTER FROM field) AS STRING))` |
| `year` | Año | `2024` | `EXTRACT(YEAR FROM field)` |
| `day_of_week` | Nombre del día | `Monday` | `FORMAT_DATE('%A', DATE(field))` |
| `day_of_month` | Día del mes | `15` | `EXTRACT(DAY FROM field)` |
| `week_of_year` | Semana del año | `3` | `EXTRACT(WEEK FROM field)` |
| `month_name` | Nombre del mes | `January` | `FORMAT_DATE('%B', DATE(field))` |

**Importante:** El campo `datatype` indica el tipo de dato en BigQuery:
- `timestamp` - TIMESTAMP (con hora)
- `date` - DATE (solo fecha)
- `datetime` - DATETIME

---

### 2.3 Measures (Métricas)

Campos que se agregan (SUM, COUNT, AVG, etc.).

```json
{
  "name": "impressions",
  "label": "Impressions",
  "type": "sum|count|average|min|max|count_distinct",
  "description": "Total impressions",
  "sql": "${TABLE}.impressions",
  "value_format": "#,##0|$#,##0.00|#,##0.00'%'",
  "hidden": false,
  "drill_fields": ["campaign_id", "ad_id"]
}
```

**Tipos de agregación:**
- `sum` - Suma
- `count` - Conteo (usar `sql: "1"` para contar filas)
- `average` - Promedio
- `min` - Mínimo
- `max` - Máximo
- `count_distinct` - Conteo de valores únicos

---

### 2.4 Calculations (Campos Calculados)

Métricas derivadas de otras métricas.

```json
{
  "name": "ctr",
  "label": "CTR",
  "type": "number|string|yesno",
  "description": "Click-through rate",
  "sql": "SAFE_DIVIDE(${clicks}, ${impressions}) * 100",
  "value_format": "#,##0.00'%'",
  "hidden": false
}
```

**Referencia a otros campos:**
- `${field_name}` - Referencia a una medida o dimensión
- `${TABLE}.column` - Referencia directa a columna de la tabla

---

## 3. Filtros Predefinidos

```json
{
  "name": "status_filter",
  "label": "Status",
  "type": "string|number|date|yesno",
  "field": "status",
  "allowed_values": ["ACTIVE", "PAUSED", "ARCHIVED"],
  "suggestions": true,
  "default_value": "ACTIVE",
  "operator": "=|!=|>|<|>=|<=|contains|starts_with|ends_with"
}
```

---

## 4. Categorización y Agrupación de Campos en el Frontend

### 4.1 Agrupación de Dimensiones en el Sidebar

**IMPORTANTE:** Las dimensiones SIEMPRE se agrupan en el sidebar. Nunca se muestran como lista plana.

#### Grupos de Tiempo (dimension_groups)
Cada `dimension_group` del schema se convierte en un grupo independiente al nivel superior del sidebar:
- **Created** - campos `created_time_*`
- **Updated** - campos `updated_time_*`
- **Start** - campos `start_time_*`
- **Stop** - campos `stop_time_*`
- **Date** - campos `date_*`
- **Extracted** - campos `extracted_at_*`
- **Ingestion Time** - campos `_ingestion_time_*`

Cada grupo de tiempo contiene sus timeframes: `raw`, `time`, `datetime`, `date`, `week`, `month`, `quarter`, `year`

#### Grupos de Dimensiones Regulares
Las dimensiones regulares se agrupan automáticamente según su nombre:

| Grupo | Patrón de detección | Icono |
|-------|---------------------|-------|
| `Campaign` | `campaign` en name o displayName | TagIcon |
| `Ad Set` | `adset`, `ad_set` en name | TagIcon |
| `Ad` | `ad_` en name (pero no `ad set`) | TagIcon |
| `Audience` | `age`, `gender`, `audience` en name | TagIcon |
| `Geo` | `country`, `region`, `city`, `placement`, `platform` | TagIcon |
| `Other Dimensions` | Cualquier dimensión que no coincida | TagIcon |

**Nota:** Todos los grupos de dimensiones usan `TagIcon` para consistencia visual.

### 4.2 Agrupación de Métricas en el Sidebar

Las métricas también se agrupan automáticamente:

| Grupo | Patrón de detección | Icono |
|-------|---------------------|-------|
| `Performance` | Métricas base: `impressions`, `clicks`, `reach`, etc. | HashtagIcon |
| `Cost` | `spend`, `cost`, `budget` | HashtagIcon |
| `Conversion` | `conversion`, `purchase`, `revenue` | HashtagIcon |
| `Engagement` | `engagement`, `like`, `comment`, `share`, `video`, `post_` | HashtagIcon |
| `Calculated` | `ctr`, `cpc`, `cpm`, `cpa`, `roas`, `roi`, `rate`, `profit` | HashtagIcon |

**Nota:** Todos los grupos de métricas usan `HashtagIcon` para consistencia visual.

### 4.3 Campos Ocultos

Los siguientes campos se ocultan automáticamente del sidebar:
- `tenant_id` - Campo interno de multi-tenancy

Para ocultar un campo, agregar `"hidden": true` en su definición.

---

## 5. Reglas de Nombrado

### 5.1 Nombres de campos (name)
- Snake_case: `campaign_id`, `created_time`, `daily_budget`
- Sin espacios ni caracteres especiales
- Debe coincidir con el nombre de la columna en BigQuery

### 5.2 Labels de campos (label)
- Title Case: `Campaign ID`, `Created Time`, `Daily Budget`
- Para dimension_groups, el label NO incluye el timeframe (se agrega automáticamente)

### 5.3 Generación de IDs en el frontend
Para dimension_groups, el ID se genera como: `{name}_{timeframe}`
- Ejemplo: `created_time` con timeframe `date` → ID: `created_time_date`

---

## 6. Mapeo Backend ↔ Frontend

### 6.1 Campos de Fecha
El backend devuelve el campo base (ej: `created_time`), el frontend lo transforma según el timeframe seleccionado.

```
Backend: { created_time: "2024-01-15T14:30:00Z" }
Frontend (date): "2024-01-15"
Frontend (month): "2024-01"
Frontend (quarter): "Q1"
```

### 6.2 Mapeo de nombres
Algunos campos tienen nombres diferentes en backend vs frontend:

| Backend | Frontend |
|---------|----------|
| `campaign_name` | `name` |
| `adset_name` | `name` |
| `ad_name` | `name` |

---

## 7. Generación de SQL

### 7.1 SELECT
```sql
-- Dimensiones (sin agregación)
SELECT
  campaign_id AS campaign_id,
  DATE(created_time) AS created_date,
  FORMAT_DATE('%Y-%m', DATE(created_time)) AS created_month,

-- Métricas (con agregación)
  SUM(impressions) AS impressions,
  AVG(cpc) AS avg_cpc,
  COUNT(*) AS record_count,

-- Cálculos
  SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100 AS ctr

FROM `project.dataset.table`

-- GROUP BY solo dimensiones
GROUP BY
  campaign_id,
  DATE(created_time),
  FORMAT_DATE('%Y-%m', DATE(created_time))

ORDER BY created_date
LIMIT 1000
```

### 7.2 Alias SQL
Los alias se generan limpiando el label:
- `Campaign Name` → `campaign_name`
- `Created (date)` → `created_date`
- Caracteres especiales se reemplazan por `_`
- Se eliminan `_` múltiples y al inicio/final

---

## 8. Formatos de Valor (value_format)

| Formato | Ejemplo | Uso |
|---------|---------|-----|
| `#,##0` | 1,234 | Números enteros |
| `#,##0.00` | 1,234.56 | Decimales |
| `$#,##0.00` | $1,234.56 | Moneda |
| `#,##0.00'%'` | 12.34% | Porcentaje |

---

## 9. Ejemplo Completo de Dataset

```json
{
  "name": "meta_campaigns",
  "label": "Meta Ads Campaigns",
  "description": "Campaign level metadata and configuration",
  "category": "advertising",
  "source": {
    "type": "bigquery",
    "project": "datametricx-prod",
    "dataset": "reporting",
    "table": "meta_campaigns"
  },
  "primary_key": ["campaign_id"],

  "dimensions": [
    {
      "name": "campaign_id",
      "label": "Campaign ID",
      "type": "string",
      "description": "Unique identifier for the campaign",
      "sql": "${TABLE}.campaign_id",
      "primary_key": true
    },
    {
      "name": "name",
      "label": "Campaign Name",
      "type": "string",
      "description": "Name of the campaign",
      "sql": "${TABLE}.name"
    },
    {
      "name": "status",
      "label": "Status",
      "type": "string",
      "description": "Current status (ACTIVE, PAUSED, etc.)",
      "sql": "${TABLE}.status"
    }
  ],

  "dimension_groups": [
    {
      "name": "created_time",
      "label": "Created",
      "type": "time",
      "description": "When the campaign was created",
      "sql": "${TABLE}.created_time",
      "timeframes": ["raw", "time", "datetime", "date", "week", "month", "quarter", "year"],
      "datatype": "timestamp"
    }
  ],

  "measures": [
    {
      "name": "daily_budget",
      "label": "Daily Budget",
      "type": "sum",
      "description": "Total daily budget across campaigns",
      "sql": "${TABLE}.daily_budget",
      "value_format": "$#,##0.00"
    },
    {
      "name": "count",
      "label": "Campaign Count",
      "type": "count",
      "description": "Number of campaigns",
      "sql": "1",
      "value_format": "#,##0"
    }
  ],

  "calculations": [
    {
      "name": "is_active",
      "label": "Is Active",
      "type": "yesno",
      "description": "Whether campaign is currently active",
      "sql": "${status} = 'ACTIVE'"
    },
    {
      "name": "avg_daily_budget",
      "label": "Avg Daily Budget",
      "type": "number",
      "description": "Average daily budget per campaign",
      "sql": "AVG(${TABLE}.daily_budget)",
      "value_format": "$#,##0.00"
    }
  ],

  "filters": [
    {
      "name": "status_filter",
      "label": "Status",
      "type": "string",
      "field": "status",
      "allowed_values": ["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"]
    }
  ]
}
```

---

## 10. Agregación de Datos en Frontend

El frontend **SIEMPRE** agrega los datos cuando hay métricas seleccionadas, ya que el backend devuelve datos sin agregar.

### 10.1 Reglas de Agregación

| Escenario | Comportamiento |
|-----------|----------------|
| Solo métricas (sin dimensiones) | Agregar todas las filas en UNA sola fila con los totales |
| Dimensiones + métricas | Agrupar por valores únicos de dimensiones y agregar métricas por grupo |
| Solo dimensiones (sin métricas) | Mostrar datos sin agregar |

### 10.2 Tipos de Agregación por Métrica

El tipo de agregación se define en el schema JSON del dataset:

| Tipo | SQL | Frontend |
|------|-----|----------|
| `sum` | `SUM(campo)` | `values.reduce((a, b) => a + b, 0)` |
| `count` | `COUNT(*)` | `values.length` |
| `count_distinct` | `COUNT(DISTINCT campo)` | `new Set(values).size` |
| `average` | `AVG(campo)` | `sum / count` |
| `min` | `MIN(campo)` | `Math.min(...values)` |
| `max` | `MAX(campo)` | `Math.max(...values)` |

### 10.3 Lógica de Agrupación

```typescript
// 1. Crear clave única por combinación de dimensiones
const groupKey = selectedDims
  .map(dim => String(value).trim().toLowerCase())
  .join('|||')

// 2. Agrupar filas por clave
groupedData[groupKey].push(row)

// 3. Para cada grupo: tomar dimensiones del primer registro + agregar métricas
```

### 10.4 Ejemplo

**Datos del backend:**
```
| status  | daily_budget |
|---------|--------------|
| ACTIVE  | 100          |
| ACTIVE  | 200          |
| PAUSED  | 50           |
| ACTIVE  | 150          |
```

**Resultado después de agregar (status + SUM(daily_budget)):**
```
| status  | daily_budget |
|---------|--------------|
| ACTIVE  | 450          |
| PAUSED  | 50           |
```

### 10.5 Normalización de Valores

Los valores de dimensiones se normalizan para evitar duplicados:
- `String(value).trim().toLowerCase()`
- Esto evita que "ACTIVE" y "active" se traten como grupos diferentes

---

## 11. Checklist para Nuevos Datasets

- [ ] Crear archivo JSON en `/src/datasets/{platform}/{dataset_name}.json`
- [ ] Registrar en `/src/datasets/index.ts`
- [ ] Verificar que todos los campos existan en BigQuery
- [ ] Incluir timeframes completos para dimension_groups: `["raw", "time", "datetime", "date", "week", "month", "quarter", "year"]`
- [ ] Agregar formatos de valor apropiados para métricas
- [ ] **Definir tipo de agregación correcto para cada métrica** (`sum`, `count`, `average`, etc.)
- [ ] Probar que el backend devuelva todos los campos necesarios
- [ ] Verificar categorización automática de campos
- [ ] Probar agregación con diferentes combinaciones de dimensiones/métricas

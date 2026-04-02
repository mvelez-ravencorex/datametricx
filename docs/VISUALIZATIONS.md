# Sistema de Visualizaciones - DataMetricX

## Descripción General

El sistema de visualizaciones de DataMetricX sigue un modelo similar a Looker, donde las consultas y visualizaciones se definen mediante configuraciones JSON declarativas que se conectan con la Capa Semántica.

## Arquitectura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Query JSON    │────▶│  Semantic API   │────▶│   Viz Config    │
│  (qué datos)    │     │  (ejecuta SQL)  │     │  (cómo mostrar) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 1. Query Definition

Define qué datos obtener de la Capa Semántica.

### Estructura

```json
{
  "dataset": "ds_performance_campaign",
  "attributes": ["campaign_name", "date"],
  "metrics": ["spend", "impressions", "clicks"],
  "pivot": null,
  "filters": [],
  "sorts": [],
  "limit": 100
}
```

### Campos

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `dataset` | string | Sí | ID del dataset de la Capa Semántica |
| `attributes` | string[] | Sí | Atributos para agrupar (Eje X / Dimensiones) |
| `metrics` | string[] | Sí | Métricas a calcular (Eje Y / Medidas) |
| `pivot` | string \| null | No | Atributo para pivotar (crear series múltiples) |
| `filters` | Filter[] | No | Filtros a aplicar |
| `sorts` | Sort[] | No | Ordenamiento de resultados |
| `limit` | number | No | Límite de filas (default: 100) |

### Filter Object

```json
{
  "field": "date",
  "operator": ">=",
  "value": "2024-01-01"
}
```

**Operadores disponibles:**
- `=`, `!=` - Igualdad
- `>`, `>=`, `<`, `<=` - Comparación
- `in`, `not_in` - Lista de valores
- `contains`, `starts_with`, `ends_with` - Texto
- `is_null`, `is_not_null` - Nulos
- `between` - Rango (value es array [min, max])

**Operadores de fecha (estilo Looker):**

| Operador | Descripción | BigQuery SQL |
|----------|-------------|--------------|
| `today` | Hoy | `{field} = CURRENT_DATE()` |
| `yesterday` | Ayer | `{field} = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)` |
| `last_day` | Último día con datos | `{field} = (SELECT MAX({field}) FROM {table})` |
| `last_7_days` | Últimos 7 días | `{field} >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)` |
| `last_30_days` | Últimos 30 días | `{field} >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)` |
| `last_month` | Último mes completo | `{field} >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), MONTH) AND {field} < DATE_TRUNC(CURRENT_DATE(), MONTH)` |
| `last_quarter` | Último trimestre | `{field} >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 QUARTER), QUARTER) AND {field} < DATE_TRUNC(CURRENT_DATE(), QUARTER)` |
| `last_year` | Último año completo | `{field} >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 YEAR), YEAR) AND {field} < DATE_TRUNC(CURRENT_DATE(), YEAR)` |
| `this_month` | Este mes | `{field} >= DATE_TRUNC(CURRENT_DATE(), MONTH)` |
| `this_quarter` | Este trimestre | `{field} >= DATE_TRUNC(CURRENT_DATE(), QUARTER)` |
| `this_year` | Este año | `{field} >= DATE_TRUNC(CURRENT_DATE(), YEAR)` |

**Operadores de días hábiles (Lun-Vie):**

| Operador | Descripción | BigQuery SQL |
|----------|-------------|--------------|
| `last_5_working_days` | Últimos 5 días hábiles | `{field} >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) AND EXTRACT(DAYOFWEEK FROM {field}) BETWEEN 2 AND 6` (aprox) |
| `last_10_working_days` | Últimos 10 días hábiles | `{field} >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY) AND EXTRACT(DAYOFWEEK FROM {field}) BETWEEN 2 AND 6` (aprox) |
| `last_20_working_days` | Últimos 20 días hábiles | `{field} >= DATE_SUB(CURRENT_DATE(), INTERVAL 28 DAY) AND EXTRACT(DAYOFWEEK FROM {field}) BETWEEN 2 AND 6` (aprox) |
| `this_month_working_days` | Este mes (solo hábiles) | `{field} >= DATE_TRUNC(CURRENT_DATE(), MONTH) AND EXTRACT(DAYOFWEEK FROM {field}) BETWEEN 2 AND 6` |
| `last_month_working_days` | Último mes (solo hábiles) | `{field} >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), MONTH) AND {field} < DATE_TRUNC(CURRENT_DATE(), MONTH) AND EXTRACT(DAYOFWEEK FROM {field}) BETWEEN 2 AND 6` |

> **Nota:** En BigQuery, `EXTRACT(DAYOFWEEK FROM date)` retorna: 1=Domingo, 2=Lunes, 3=Martes, 4=Miércoles, 5=Jueves, 6=Viernes, 7=Sábado.
> Los días hábiles (Lun-Vie) son los valores 2-6.

### Sort Object

```json
{
  "field": "spend",
  "direction": "desc"
}
```

---

## 2. Pivot (Series Múltiples)

El pivot transforma filas en columnas, creando múltiples series.

### Sin Pivot

**Query:**
```json
{
  "dataset": "ds_performance_campaign",
  "attributes": ["campaign_name"],
  "metrics": ["spend", "impressions"]
}
```

**Resultado:**
| campaign_name | spend | impressions |
|---------------|-------|-------------|
| Campaign A    | 1000  | 50000       |
| Campaign B    | 800   | 40000       |

**Series generadas:** 2 (spend, impressions)

### Con Pivot

**Query:**
```json
{
  "dataset": "ds_performance_campaign",
  "attributes": ["campaign_name"],
  "metrics": ["spend"],
  "pivot": "month"
}
```

**Resultado:**
| campaign_name | spend_ene | spend_feb | spend_mar |
|---------------|-----------|-----------|-----------|
| Campaign A    | 300       | 350       | 350       |
| Campaign B    | 250       | 280       | 270       |

**Series generadas:** 3 (una por cada valor único del pivot)

### Pivot + Múltiples Métricas

**Query:**
```json
{
  "dataset": "ds_performance_campaign",
  "attributes": ["campaign_name"],
  "metrics": ["spend", "clicks"],
  "pivot": "month"
}
```

**Series generadas:** 6 (2 métricas × 3 meses)
- spend_ene, spend_feb, spend_mar
- clicks_ene, clicks_feb, clicks_mar

---

## 3. Visualization Config

Define cómo renderizar los datos.

### Estructura Completa

```json
{
  "type": "bar",
  "title": "Inversión por Campaña",
  "subtitle": "Últimos 30 días",

  "series": {
    "stacked": false,
    "colors": {
      "spend": "#3B82F6",
      "impressions": "#10B981",
      "clicks": "#F59E0B"
    },
    "labels": {
      "spend": "Inversión",
      "impressions": "Impresiones",
      "clicks": "Clics"
    }
  },

  "axis": {
    "x": {
      "label": "Campaña",
      "rotate": 45,
      "truncate": 20
    },
    "y": {
      "label": "Valor",
      "format": "number",
      "min": 0,
      "max": null
    },
    "y2": {
      "enabled": false,
      "metrics": [],
      "label": "",
      "format": "number"
    }
  },

  "legend": {
    "enabled": true,
    "position": "bottom"
  },

  "tooltip": {
    "enabled": true,
    "format": "default"
  },

  "format": {
    "spend": {
      "type": "currency",
      "currency": "USD",
      "decimals": 2
    },
    "impressions": {
      "type": "number",
      "decimals": 0,
      "compact": true
    },
    "clicks": {
      "type": "number",
      "decimals": 0
    }
  }
}
```

### Tipos de Visualización

| Tipo | Descripción | Atributos | Métricas |
|------|-------------|-----------|----------|
| `bar` | Barras verticales | 1+ | 1+ |
| `bar_horizontal` | Barras horizontales | 1+ | 1+ |
| `line` | Líneas | 1 (temporal) | 1+ |
| `area` | Áreas | 1 (temporal) | 1+ |
| `pie` | Pastel/Dona | 1 | 1 |
| `donut` | Dona | 1 | 1 |
| `scatter` | Dispersión | 0 | 2-3 |
| `table` | Tabla | N | N |
| `metric` | KPI/Número grande | 0 | 1-2 |
| `funnel` | Embudo | 1 | 1 |
| `treemap` | Mapa de árbol | 1-2 | 1 |
| `heatmap` | Mapa de calor | 2 | 1 |

### Formatos de Número

```json
{
  "type": "number",      // number, currency, percent
  "decimals": 2,         // Decimales
  "compact": true,       // 1.2K, 3.4M
  "prefix": "",          // Prefijo personalizado
  "suffix": "",          // Sufijo personalizado
  "currency": "USD",     // Para type: currency
  "locale": "es-MX"      // Localización
}
```

**Ejemplos de formato:**

| Valor | Formato | Resultado |
|-------|---------|-----------|
| 1234567 | `{ type: "number", compact: true }` | 1.2M |
| 0.1234 | `{ type: "percent", decimals: 1 }` | 12.3% |
| 1234.5 | `{ type: "currency", currency: "USD" }` | $1,234.50 |

---

## 4. Ejemplos Completos

### 4.1 Gráfico de Barras - Inversión por Campaña

```json
{
  "query": {
    "dataset": "ds_performance_campaign",
    "attributes": ["campaign_name"],
    "metrics": ["spend"],
    "filters": [
      { "field": "date", "operator": ">=", "value": "2024-01-01" }
    ],
    "sorts": [
      { "field": "spend", "direction": "desc" }
    ],
    "limit": 10
  },
  "viz": {
    "type": "bar",
    "title": "Top 10 Campañas por Inversión",
    "series": {
      "colors": { "spend": "#3B82F6" }
    },
    "axis": {
      "x": { "label": "Campaña", "rotate": 45 },
      "y": { "label": "Inversión", "format": "currency" }
    },
    "format": {
      "spend": { "type": "currency", "currency": "USD" }
    }
  }
}
```

### 4.2 Gráfico de Líneas - Tendencia Temporal

```json
{
  "query": {
    "dataset": "ds_performance_campaign",
    "attributes": ["date"],
    "metrics": ["spend", "impressions"],
    "filters": [
      { "field": "date", "operator": "between", "value": ["2024-01-01", "2024-03-31"] }
    ],
    "sorts": [
      { "field": "date", "direction": "asc" }
    ]
  },
  "viz": {
    "type": "line",
    "title": "Tendencia de Inversión e Impresiones",
    "series": {
      "colors": {
        "spend": "#3B82F6",
        "impressions": "#10B981"
      }
    },
    "axis": {
      "x": { "label": "Fecha" },
      "y": { "label": "Inversión", "format": "currency" },
      "y2": {
        "enabled": true,
        "metrics": ["impressions"],
        "label": "Impresiones",
        "format": "number"
      }
    }
  }
}
```

### 4.3 Gráfico con Pivot - Comparación Mensual

```json
{
  "query": {
    "dataset": "ds_performance_campaign",
    "attributes": ["campaign_name"],
    "metrics": ["spend"],
    "pivot": "month",
    "filters": [
      { "field": "campaign_status", "operator": "=", "value": "ACTIVE" }
    ],
    "limit": 5
  },
  "viz": {
    "type": "bar",
    "title": "Inversión por Campaña y Mes",
    "series": {
      "stacked": false
    },
    "legend": {
      "position": "right"
    }
  }
}
```

### 4.4 KPI / Métrica

```json
{
  "query": {
    "dataset": "ds_performance_campaign",
    "attributes": [],
    "metrics": ["spend"],
    "filters": [
      { "field": "date", "operator": ">=", "value": "2024-01-01" }
    ]
  },
  "viz": {
    "type": "metric",
    "title": "Inversión Total",
    "comparison": {
      "enabled": true,
      "type": "previous_period",
      "label": "vs período anterior"
    },
    "format": {
      "spend": { "type": "currency", "currency": "USD", "compact": true }
    }
  }
}
```

### 4.5 Tabla con Totales

```json
{
  "query": {
    "dataset": "ds_performance_campaign",
    "attributes": ["campaign_name", "adset_name"],
    "metrics": ["spend", "impressions", "clicks", "ctr"],
    "sorts": [
      { "field": "spend", "direction": "desc" }
    ],
    "limit": 50
  },
  "viz": {
    "type": "table",
    "title": "Detalle de Performance",
    "table": {
      "pagination": true,
      "pageSize": 10,
      "totals": true,
      "search": true,
      "columnWidths": {
        "campaign_name": 200,
        "adset_name": 200
      }
    },
    "format": {
      "spend": { "type": "currency" },
      "impressions": { "type": "number", "compact": true },
      "clicks": { "type": "number" },
      "ctr": { "type": "percent", "decimals": 2 }
    }
  }
}
```

### 4.6 Pie Chart - Distribución

```json
{
  "query": {
    "dataset": "ds_breakdown_platform",
    "attributes": ["platform"],
    "metrics": ["spend"]
  },
  "viz": {
    "type": "donut",
    "title": "Distribución por Plataforma",
    "pie": {
      "showLabels": true,
      "showPercent": true,
      "innerRadius": 60
    },
    "series": {
      "colors": {
        "facebook": "#1877F2",
        "instagram": "#E4405F",
        "messenger": "#00B2FF",
        "audience_network": "#7C3AED"
      }
    }
  }
}
```

---

## 5. Paleta de Colores Predefinida

### Colores por Defecto

```json
{
  "palette": {
    "primary": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"],
    "sequential": {
      "blue": ["#DBEAFE", "#93C5FD", "#60A5FA", "#3B82F6", "#2563EB", "#1D4ED8"],
      "green": ["#D1FAE5", "#6EE7B7", "#34D399", "#10B981", "#059669", "#047857"]
    },
    "divergent": {
      "red_blue": ["#EF4444", "#FCA5A5", "#FEE2E2", "#DBEAFE", "#93C5FD", "#3B82F6"]
    }
  }
}
```

### Colores Semánticos

```json
{
  "semantic": {
    "positive": "#10B981",
    "negative": "#EF4444",
    "neutral": "#6B7280",
    "warning": "#F59E0B",
    "info": "#3B82F6"
  }
}
```

---

## 6. Flujo de Datos

```
1. Usuario define Query JSON
         ↓
2. Frontend envía a /api/semantic/query
         ↓
3. Backend traduce a SQL usando Capa Semántica
         ↓
4. BigQuery ejecuta consulta
         ↓
5. Backend retorna datos en formato tabular
         ↓
6. Frontend aplica Viz Config
         ↓
7. Librería de charts renderiza visualización
```

---

## 7. Integración con Capa Semántica

Los `attributes` y `metrics` en el Query corresponden directamente a los IDs definidos en las Entities y Datasets de la Capa Semántica.

### Atributos con Pivot

Los atributos pueden configurarse para ser usados como pivot en visualizaciones:

**Entity con atributo pivoteable:**
```
Entity fact_meta_performance_campaign {
  ...
  attribute date {
    type: date
    sql: {TABLE}.date;
    pivot: {
      enabled: true
      default: true
      max_values: 12
      sort: asc
      format: "MMM YYYY"
    }
  }

  attribute campaign_name {
    type: string
    sql: {TABLE}.campaign_name;
  }

  metric spend {
    type: currency
    sql: {TABLE}.spend;
    sql_agg: SUM
  }
}
```

### Configuración de Pivot

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `enabled` | boolean | Si este atributo puede usarse como pivot |
| `default` | boolean | Si es el pivot por defecto cuando se selecciona el dataset |
| `max_values` | number | Límite de valores únicos (ej: 12 para meses) |
| `sort` | 'asc' \| 'desc' | Ordenamiento de los valores del pivot |
| `format` | string | Formato para labels (ej: "MMM YYYY" para fechas) |

### Ejemplos de Pivot

**Pivot por mes:**
```
attribute month {
  type: date
  sql: DATE_TRUNC({TABLE}.date, MONTH);
  pivot: {
    enabled: true
    max_values: 12
    sort: asc
    format: "MMM"
  }
}
```

**Pivot por plataforma:**
```
attribute platform {
  type: string
  sql: {TABLE}.platform;
  pivot: {
    enabled: true
    max_values: 5
    sort: desc
  }
}
```

**Query usando pivot:**
```json
{
  "dataset": "ds_performance_campaign",
  "attributes": ["campaign_name"],
  "metrics": ["spend"],
  "pivot": "month"
}
```

---

## 8. Próximos Pasos

1. [ ] Implementar tipos de archivo para Query y Viz en la Capa Semántica
2. [ ] Crear componente `<Visualization>` que consuma estos JSON
3. [ ] Implementar cada tipo de visualización (bar, line, pie, etc.)
4. [ ] Crear editor visual para construir queries
5. [ ] Implementar sistema de dashboards (colección de visualizaciones)

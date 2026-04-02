# Datasets - Data Model Definitions

Este directorio contiene las definiciones de datasets (modelos de datos) siguiendo el patrón de Looker/LookML.

## Estructura de un Dataset

Cada dataset es un archivo JSON que define:

### 1. **Metadata**
- `name`: Identificador único del dataset
- `label`: Nombre legible para mostrar en UI
- `description`: Descripción del dataset
- `category`: Categoría (advertising, analytics, ecommerce, etc.)

### 2. **Source (Fuente de Datos)**
```json
{
  "source": {
    "type": "bigquery",
    "project": "datametricx-prod",
    "dataset": "reporting",
    "table": "meta_insights"
  }
}
```

### 3. **Dimensions (Dimensiones)**
Campos para agrupar y filtrar datos. No se agregan.

```json
{
  "dimensions": [
    {
      "name": "campaign_name",
      "label": "Campaign Name",
      "type": "string",
      "description": "Name of the campaign",
      "sql": "${TABLE}.campaign_name"
    }
  ]
}
```

**Tipos disponibles:**
- `string`: Texto
- `number`: Número
- `yesno`: Booleano

### 4. **Dimension Groups (Grupos de Dimensiones)**
Usado principalmente para fechas, permite múltiples granularidades.

```json
{
  "dimension_groups": [
    {
      "name": "date",
      "label": "Date",
      "type": "time",
      "sql": "${TABLE}.date",
      "timeframes": ["raw", "date", "week", "month", "quarter", "year"],
      "datatype": "date"
    }
  ]
}
```

**Timeframes disponibles:**
- `raw`: Timestamp original
- `date`: Fecha (YYYY-MM-DD)
- `week`: Semana
- `month`: Mes
- `quarter`: Trimestre
- `year`: Año
- `day_of_week`: Día de la semana
- `day_of_month`: Día del mes
- `week_of_year`: Semana del año
- `month_name`: Nombre del mes

### 5. **Measures (Métricas)**
Campos agregados (SUM, COUNT, AVG, etc.)

```json
{
  "measures": [
    {
      "name": "impressions",
      "label": "Impressions",
      "type": "sum",
      "sql": "${TABLE}.impressions",
      "value_format": "#,##0"
    }
  ]
}
```

**Tipos de agregación:**
- `sum`: Suma
- `count`: Conteo
- `average`: Promedio
- `min`: Mínimo
- `max`: Máximo

**Formatos de valor:**
- `#,##0`: Número entero con separadores
- `#,##0.00`: Número decimal con 2 decimales
- `$#,##0.00`: Moneda
- `#,##0.00'%'`: Porcentaje

### 6. **Calculations (Cálculos Personalizados)**
Campos derivados calculados dinámicamente.

```json
{
  "calculations": [
    {
      "name": "ctr",
      "label": "CTR",
      "type": "number",
      "description": "Click-through rate",
      "sql": "SAFE_DIVIDE(${clicks}, ${impressions}) * 100",
      "value_format": "#,##0.00'%'"
    }
  ]
}
```

**Referencias a otros campos:**
- `${field_name}`: Referencia a otra medida o dimensión
- `${TABLE}.field_name`: Referencia directa a columna de la tabla

### 7. **Filters (Filtros Predefinidos)**
Filtros comunes que se pueden aplicar al dataset.

```json
{
  "filters": [
    {
      "name": "status_filter",
      "label": "Status",
      "type": "string",
      "field": "status",
      "allowed_values": ["ACTIVE", "PAUSED", "ARCHIVED"]
    }
  ]
}
```

## Datasets Disponibles

### Meta Ads
- **meta_insights.json**: Tabla de hechos con métricas diarias de performance
- **meta_campaigns.json**: Dimensión de campañas
- **meta_adsets.json**: Dimensión de ad sets
- **meta_ads.json**: Dimensión de anuncios
- **meta_creatives.json**: Dimensión de creativos con performance

## Uso en la Aplicación

Los datasets se usarán para:

1. **Generar queries dinámicas a BigQuery**
   - Parser lee el JSON y construye SQL
   - Aplica filtros y agregaciones

2. **Crear visualizaciones**
   - Seleccionar dimensiones y métricas de un dataset
   - Generar charts basados en la configuración

3. **Construir dashboards**
   - Combinar múltiples visualizaciones
   - Aplicar filtros globales

## Ejemplo de Flujo

```
Dataset (meta_insights.json)
    ↓
Visualization Config
    {
      "dataset": "meta_insights",
      "dimensions": ["date", "campaign_name"],
      "measures": ["impressions", "clicks", "ctr"]
    }
    ↓
Query Builder
    SELECT
      date,
      campaign_name,
      SUM(impressions) as impressions,
      SUM(clicks) as clicks,
      SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100 as ctr
    FROM reporting.meta_insights
    GROUP BY date, campaign_name
    ↓
BigQuery Result
    ↓
Chart Renderer
```

## Mejores Prácticas

1. **Naming**: Usar snake_case para nombres de campos
2. **Labels**: Usar Title Case para labels
3. **Descriptions**: Siempre incluir descripciones claras
4. **SQL**: Usar `${TABLE}` en lugar del nombre de tabla hardcodeado
5. **Calculations**: Usar `SAFE_DIVIDE` para evitar división por cero
6. **Formats**: Definir formato apropiado para cada métrica

## Extensión

Para agregar una nueva plataforma:

1. Crear carpeta: `/datasets/{platform-name}/`
2. Crear datasets JSON para cada tabla
3. Seguir la misma estructura
4. Documentar en este README

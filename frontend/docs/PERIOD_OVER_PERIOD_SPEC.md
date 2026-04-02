# Period Over Period - Especificacion Tecnica

## Resumen Ejecutivo

Implementar comparaciones de periodos temporales en DataMetricX, permitiendo a los usuarios comparar metricas entre el periodo actual y periodos anteriores de referencia.

---

## 1. Concepto de Negocio

### Pregunta que responde
- "¿Vamos mejor o peor que antes?"
- "¿Estamos en camino de superar el mes pasado?"
- "¿Cómo nos comparamos con el año anterior?"

### Tipos de Comparacion

| Tipo | Descripcion | Ejemplo (hoy: 16 Dic) |
|------|-------------|----------------------|
| **same_point** | Mismo punto del periodo anterior | Dic 1-16 vs Nov 1-16 |
| **full_previous** | Periodo anterior completo | Dic 1-16 vs Nov 1-30 |
| **same_point_yoy** | Mismo punto año anterior | Dic 1-16 vs Dic 1-16 (2023) |
| **full_previous_yoy** | Mismo periodo año anterior completo | Dic 1-16 vs Dic 1-31 (2023) |
| **custom** | Rango personalizado | Usuario define ambos rangos |

---

## 2. Parametro de Comparacion

### Definicion
```typescript
type ComparisonType =
  | "none"              // Sin comparacion
  | "same_point"        // Mismo punto periodo anterior
  | "full_previous"     // Periodo anterior completo
  | "same_point_yoy"    // Mismo punto año anterior
  | "full_previous_yoy" // Año anterior completo
  | "custom";           // Rango personalizado

interface ComparisonConfig {
  type: ComparisonType;
  // Solo para type === "custom"
  customRange?: {
    startDate: string;  // ISO date
    endDate: string;    // ISO date
  };
}
```

### Calculo Automatico de Rangos

```typescript
interface DateRange {
  startDate: string;
  endDate: string;
}

function calculateComparisonRange(
  currentRange: DateRange,
  comparisonType: ComparisonType
): DateRange {
  // Logica segun tipo
}
```

#### Ejemplos de Calculo

**Periodo actual: Semana (Lun 9 Dic - Mie 11 Dic)**
| Tipo | Rango Comparacion |
|------|-------------------|
| same_point | Lun 2 Dic - Mie 4 Dic |
| full_previous | Lun 2 Dic - Dom 8 Dic |
| same_point_yoy | Lun 11 Dic - Mie 13 Dic 2023 |

**Periodo actual: Mes (Dic 1-16)**
| Tipo | Rango Comparacion |
|------|-------------------|
| same_point | Nov 1-16 |
| full_previous | Nov 1-30 |
| same_point_yoy | Dic 1-16 2023 |
| full_previous_yoy | Dic 1-31 2023 |

**Periodo actual: Quarter (Oct 1 - Dic 16)**
| Tipo | Rango Comparacion |
|------|-------------------|
| same_point | Jul 1 - Sep 16 |
| full_previous | Jul 1 - Sep 30 |
| same_point_yoy | Oct 1 - Dic 16 2023 |

---

## 3. Arquitectura de Implementacion

### Opcion Recomendada: Calculo en Frontend + Query Paralela

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                            │
├─────────────────────────────────────────────────────────┤
│  1. Usuario selecciona:                                 │
│     - Rango principal: Dic 1-16                         │
│     - Comparacion: "same_point" (periodo anterior)      │
│                                                         │
│  2. Frontend calcula rango de comparacion:              │
│     - Nov 1-16                                          │
│                                                         │
│  3. Frontend hace DOS requests al backend:              │
│     - Query 1: metricas Dic 1-16                        │
│     - Query 2: metricas Nov 1-16                        │
│                                                         │
│  4. Frontend combina y calcula deltas:                  │
│     - Delta absoluto: valor_actual - valor_anterior     │
│     - Delta %: ((actual - anterior) / anterior) * 100   │
└─────────────────────────────────────────────────────────┘
```

### Ventajas de este approach
- Backend simple (no necesita logica de comparacion)
- Frontend tiene control total del display
- Facil de cachear cada query independiente
- Flexible para diferentes visualizaciones

### Alternativa: Calculo en Backend
```
Frontend envia: { dateRange, comparisonType }
Backend retorna: { current: {...}, comparison: {...}, deltas: {...} }
```
- Mas complejo en backend
- Menos requests
- Mejor para datasets muy grandes

---

## 4. Implementacion Frontend

### 4.1 Componente de Selector de Comparacion

```typescript
// components/ComparisonSelector.tsx

interface ComparisonSelectorProps {
  value: ComparisonConfig;
  onChange: (config: ComparisonConfig) => void;
  currentDateRange: DateRange;
}

const COMPARISON_OPTIONS = [
  { value: "none", label: "Sin comparacion" },
  { value: "same_point", label: "Mismo punto periodo anterior" },
  { value: "full_previous", label: "Periodo anterior completo" },
  { value: "same_point_yoy", label: "Mismo punto año anterior" },
  { value: "full_previous_yoy", label: "Año anterior completo" },
  { value: "custom", label: "Rango personalizado..." },
];
```

### 4.2 Utilidad de Calculo de Rangos

```typescript
// utils/dateComparison.ts

import {
  subDays, subWeeks, subMonths, subYears,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, differenceInDays
} from 'date-fns';

export function calculateComparisonRange(
  currentRange: DateRange,
  comparisonType: ComparisonType
): DateRange | null {
  if (comparisonType === 'none') return null;

  const start = new Date(currentRange.startDate);
  const end = new Date(currentRange.endDate);
  const daysDiff = differenceInDays(end, start);

  switch (comparisonType) {
    case 'same_point':
      // Mismo numero de dias, periodo inmediatamente anterior
      return {
        startDate: subDays(start, daysDiff + 1).toISOString(),
        endDate: subDays(start, 1).toISOString()
      };

    case 'full_previous':
      // Detectar si es semana, mes, quarter y dar periodo completo
      return calculateFullPreviousPeriod(start, end);

    case 'same_point_yoy':
      return {
        startDate: subYears(start, 1).toISOString(),
        endDate: subYears(end, 1).toISOString()
      };

    case 'full_previous_yoy':
      return calculateFullPreviousPeriodYoY(start, end);

    case 'custom':
      // Retornado desde customRange del config
      return null;
  }
}

function calculateFullPreviousPeriod(start: Date, end: Date): DateRange {
  // Detectar tipo de periodo basado en las fechas
  const daysDiff = differenceInDays(end, start);

  // Si es ~7 dias, asumir semana
  if (daysDiff >= 6 && daysDiff <= 7) {
    const prevWeekStart = startOfWeek(subWeeks(start, 1));
    const prevWeekEnd = endOfWeek(subWeeks(start, 1));
    return {
      startDate: prevWeekStart.toISOString(),
      endDate: prevWeekEnd.toISOString()
    };
  }

  // Si es ~28-31 dias, asumir mes
  if (daysDiff >= 27 && daysDiff <= 31) {
    const prevMonthStart = startOfMonth(subMonths(start, 1));
    const prevMonthEnd = endOfMonth(subMonths(start, 1));
    return {
      startDate: prevMonthStart.toISOString(),
      endDate: prevMonthEnd.toISOString()
    };
  }

  // Default: mismo numero de dias hacia atras
  return {
    startDate: subDays(start, daysDiff + 1).toISOString(),
    endDate: subDays(start, 1).toISOString()
  };
}
```

### 4.3 Hook para Queries con Comparacion

```typescript
// hooks/useMetricsWithComparison.ts

interface UseMetricsWithComparisonParams {
  endpoint: string;
  dateRange: DateRange;
  comparison: ComparisonConfig;
  // otros params...
}

interface MetricsWithComparison<T> {
  current: T;
  comparison: T | null;
  deltas: DeltaMetrics<T> | null;
  isLoading: boolean;
  error: Error | null;
}

export function useMetricsWithComparison<T>(
  params: UseMetricsWithComparisonParams
): MetricsWithComparison<T> {
  const comparisonRange = useMemo(() =>
    calculateComparisonRange(params.dateRange, params.comparison.type),
    [params.dateRange, params.comparison]
  );

  // Query principal
  const currentQuery = useQuery({
    queryKey: ['metrics', params.endpoint, params.dateRange],
    queryFn: () => fetchMetrics(params.endpoint, params.dateRange)
  });

  // Query de comparacion (solo si hay comparacion activa)
  const comparisonQuery = useQuery({
    queryKey: ['metrics', params.endpoint, comparisonRange],
    queryFn: () => fetchMetrics(params.endpoint, comparisonRange!),
    enabled: comparisonRange !== null
  });

  // Calcular deltas
  const deltas = useMemo(() => {
    if (!currentQuery.data || !comparisonQuery.data) return null;
    return calculateDeltas(currentQuery.data, comparisonQuery.data);
  }, [currentQuery.data, comparisonQuery.data]);

  return {
    current: currentQuery.data,
    comparison: comparisonQuery.data,
    deltas,
    isLoading: currentQuery.isLoading || comparisonQuery.isLoading,
    error: currentQuery.error || comparisonQuery.error
  };
}
```

### 4.4 Calculo de Deltas

```typescript
// utils/deltaCalculations.ts

interface DeltaValue {
  absolute: number;      // valor_actual - valor_anterior
  percentage: number;    // ((actual - anterior) / anterior) * 100
  direction: 'up' | 'down' | 'neutral';
  isPositive: boolean;   // Depende de la metrica (para CPC, down es bueno)
}

// Metricas donde "menos es mejor"
const INVERSE_METRICS = ['cpc', 'cpm', 'cpa', 'cost_per_lead', 'frequency'];

export function calculateDelta(
  current: number,
  previous: number,
  metricName: string
): DeltaValue {
  const absolute = current - previous;
  const percentage = previous !== 0
    ? ((current - previous) / previous) * 100
    : 0;

  const direction = absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'neutral';

  // Para metricas inversas, "down" es positivo
  const isInverse = INVERSE_METRICS.includes(metricName.toLowerCase());
  const isPositive = isInverse
    ? direction === 'down'
    : direction === 'up';

  return { absolute, percentage, direction, isPositive };
}
```

### 4.5 Componente de Visualizacion de Delta

```typescript
// components/DeltaIndicator.tsx

interface DeltaIndicatorProps {
  delta: DeltaValue;
  format?: 'percentage' | 'absolute' | 'both';
  size?: 'sm' | 'md' | 'lg';
}

export function DeltaIndicator({ delta, format = 'percentage', size = 'md' }: DeltaIndicatorProps) {
  const colorClass = delta.isPositive
    ? 'text-green-600'
    : delta.direction === 'neutral'
      ? 'text-gray-500'
      : 'text-red-600';

  const icon = delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : '→';

  return (
    <span className={`${colorClass} ${sizeClasses[size]}`}>
      {icon} {formatDelta(delta, format)}
    </span>
  );
}

// Ejemplo de uso en un KPI card:
// <KPICard
//   title="Spend"
//   value={current.spend}
//   delta={deltas.spend}
//   comparisonLabel="vs mes anterior"
// />
```

---

## 5. Implementacion Backend (Minima)

El backend NO necesita cambios significativos si el frontend maneja la logica de comparacion.

### Lo que ya existe y funciona
Los endpoints actuales ya soportan filtros de fecha:
```
GET /api/meta/campaigns/performance?start_date=2024-12-01&end_date=2024-12-16
```

### Optimizacion opcional futura
Si se necesita mejor performance, agregar endpoint dedicado:

```python
@app.get("/api/metrics/comparison")
async def get_metrics_with_comparison(
    entity: str,  # campaigns, adsets, ads
    metric: str,  # spend, impressions, etc
    current_start: date,
    current_end: date,
    comparison_start: date,
    comparison_end: date,
    user_info: dict = Depends(get_current_user)
):
    """
    Retorna metricas para ambos periodos en una sola query.
    Mas eficiente para BigQuery (una sola lectura).
    """
    query = f"""
    WITH current_period AS (
        SELECT SUM({metric}) as value
        FROM `reporting.meta_performance_campaign_daily`
        WHERE tenant_id = @tenant_id
          AND date BETWEEN @current_start AND @current_end
    ),
    comparison_period AS (
        SELECT SUM({metric}) as value
        FROM `reporting.meta_performance_campaign_daily`
        WHERE tenant_id = @tenant_id
          AND date BETWEEN @comparison_start AND @comparison_end
    )
    SELECT
        c.value as current_value,
        p.value as comparison_value,
        c.value - p.value as delta_absolute,
        SAFE_DIVIDE(c.value - p.value, p.value) * 100 as delta_percentage
    FROM current_period c, comparison_period p
    """
    # ejecutar query...
```

---

## 6. UX/UI Guidelines

### 6.1 Selector de Comparacion
- Ubicado junto al date picker principal
- Dropdown simple con opciones predefinidas
- "Custom" abre un segundo date picker

```
┌─────────────────────────────────────────────────┐
│  📅 Dic 1 - Dic 16, 2024  ▼  │  🔄 vs Periodo anterior ▼  │
└─────────────────────────────────────────────────┘
```

### 6.2 Visualizacion en KPI Cards
```
┌─────────────────────────┐
│  Total Spend            │
│  $12,450.00             │
│  ↑ 15.3% vs Nov 1-16    │
│  (+$1,650.00)           │
└─────────────────────────┘
```

### 6.3 Visualizacion en Tablas
| Campaign | Spend | vs Anterior | ROAS | vs Anterior |
|----------|-------|-------------|------|-------------|
| Campaign A | $5,000 | ↑ +12% | 3.2x | ↓ -5% |
| Campaign B | $3,200 | ↓ -8% | 4.1x | ↑ +15% |

### 6.4 Visualizacion en Graficos
- Linea punteada para periodo de comparacion
- Tooltip muestra ambos valores
- Leyenda indica ambos periodos

---

## 7. Plan de Implementacion

### Fase 1: Frontend - Logica Base
1. Crear utilidades de calculo de rangos (`dateComparison.ts`)
2. Crear hook `useMetricsWithComparison`
3. Crear componente `ComparisonSelector`
4. Crear componente `DeltaIndicator`

### Fase 2: Frontend - Integracion en Dashboards
1. Agregar selector de comparacion al header del dashboard
2. Modificar KPI widgets para mostrar deltas
3. Modificar tablas para columnas de comparacion
4. Modificar graficos para lineas de comparacion

### Fase 3: Persistencia
1. Guardar preferencia de comparacion en config del dashboard
2. Permitir comparacion por widget (override del global)

### Fase 4: Backend (Opcional)
1. Endpoint optimizado para comparaciones
2. Cache de queries frecuentes

---

## 8. Ejemplos de Uso

### Ejemplo 1: Dashboard de Performance Mensual
```typescript
// Dashboard config
{
  dateRange: { preset: 'this_month' },
  comparison: { type: 'same_point' },  // vs mismo punto mes anterior
  widgets: [
    { type: 'kpi', metric: 'spend', showDelta: true },
    { type: 'kpi', metric: 'roas', showDelta: true },
    { type: 'chart', metrics: ['spend'], showComparison: true }
  ]
}
```

### Ejemplo 2: Analisis YoY
```typescript
{
  dateRange: { preset: 'this_quarter' },
  comparison: { type: 'same_point_yoy' },
  widgets: [...]
}
```

### Ejemplo 3: Comparacion Custom
```typescript
{
  dateRange: {
    startDate: '2024-12-01',
    endDate: '2024-12-15'
  },
  comparison: {
    type: 'custom',
    customRange: {
      startDate: '2024-11-15',
      endDate: '2024-11-30'
    }
  },
  widgets: [...]
}
```

---

## 9. Consideraciones Tecnicas

### Performance
- Las queries de comparacion duplican las lecturas a BigQuery
- Considerar cache agresivo para periodos historicos (no cambian)
- Para dashboards con muchos widgets, evaluar endpoint batch

### Edge Cases
- Periodo actual mas corto que periodo de comparacion (ej: Feb vs Ene)
- Años bisiestos en comparaciones YoY
- Datos faltantes en periodo de comparacion
- Tenant nuevo sin datos historicos

### Metricas Calculadas
- ROAS, CTR, CPC son ratios - calcular delta sobre el ratio, no sobre componentes
- Ejemplo: Delta ROAS = ROAS_actual - ROAS_anterior (no recalcular desde spend/revenue)

---

## 10. IMPLEMENTACION BACKEND CON CTEs (RECOMENDADO)

> **Fecha:** 2024-12-22
> **Status:** Especificacion lista para implementar
> **Razon del cambio:** El approach frontend con 2 queries tiene problemas de matching por offset. El backend con CTEs es mas robusto (similar a Looker).

### 10.1 Problema del Approach Frontend

El approach actual ejecuta 2 queries separadas y hace merge en frontend:

```
Query 1: Dic 1-16 → [{ date: '2024-12-01', spend: 100 }, ...]
Query 2: Nov 1-16 → [{ date: '2024-11-01', spend: 80 }, ...]

Frontend merge: Intenta hacer match por offset de dias
  → 2024-12-01 deberia matchear con 2024-11-01
  → Problemas: meses de diferente longitud, datos faltantes, edge cases
```

### 10.2 Solucion: Backend genera SQL con CTEs

El backend recibe la configuracion de comparacion y genera **una sola query** con Common Table Expressions (CTEs) que hace el merge en BigQuery.

### 10.3 Cambios en QueryRequest

```typescript
// types/semantic.ts

interface QueryRequest {
  dataset_id: string
  attributes: string[]
  metrics: string[]
  filters?: MetricFilter[]
  order_by?: OrderByConfig[]
  limit?: number

  // NUEVO: Configuracion de comparacion PoP
  comparison?: {
    enabled: boolean
    type: ComparisonType  // 'same_point' | 'full_previous' | 'same_point_yoy' | 'full_previous_yoy' | 'custom'
    dateField: string     // ID del campo fecha a usar para la comparacion
    variants: MetricVariant[]  // ['current', 'previous', 'delta', 'delta_pct']
    customRange?: {       // Solo si type === 'custom'
      startDate: string   // ISO date
      endDate: string     // ISO date
    }
  }
}

type ComparisonType = 'none' | 'same_point' | 'full_previous' | 'same_point_yoy' | 'full_previous_yoy' | 'custom'
type MetricVariant = 'current' | 'previous' | 'delta' | 'delta_pct'
```

### 10.4 Ejemplo de Request con Comparacion

```json
{
  "dataset_id": "ds_meta_performance_campaign",
  "attributes": ["campaign_name", "date_date"],
  "metrics": ["spend", "impressions", "clicks"],
  "filters": [
    {
      "field": "date_date",
      "operator": "between",
      "value": ["2024-12-01", "2024-12-16"]
    }
  ],
  "order_by": [{ "field": "date_date", "direction": "DESC" }],
  "limit": 1000,
  "comparison": {
    "enabled": true,
    "type": "same_point",
    "dateField": "date_date",
    "variants": ["current", "previous", "delta", "delta_pct"]
  }
}
```

### 10.5 SQL Generado por el Backend

El backend debe generar SQL con esta estructura:

```sql
-- PASO 1: Extraer rango de fechas del filtro
-- current_start = '2024-12-01', current_end = '2024-12-16'

-- PASO 2: Calcular rango de comparacion segun tipo
-- Para 'same_point': Nov 1-16 (mismo numero de dias, periodo anterior)
-- previous_start = '2024-11-01', previous_end = '2024-11-16'

-- PASO 3: Calcular offset en dias
-- offset_days = DATE_DIFF(current_start, previous_start, DAY) = 30

-- PASO 4: Generar SQL con CTEs
WITH current_period AS (
  -- Query normal con filtro de fecha actual
  SELECT
    campaign_name,
    date_date,
    SUM(spend) as spend,
    SUM(impressions) as impressions,
    SUM(clicks) as clicks
  FROM `project.dataset.table` t1
  LEFT JOIN `project.dataset.campaigns` t2 ON t1.campaign_id = t2.id
  WHERE date_date BETWEEN '2024-12-01' AND '2024-12-16'
    AND tenant_id = 'tenant_xyz'
  GROUP BY 1, 2
),

previous_period AS (
  -- Misma query pero con fechas del periodo anterior
  -- Y aplicamos offset a las fechas para que coincidan con current
  SELECT
    campaign_name,
    DATE_ADD(date_date, INTERVAL 30 DAY) as date_date,  -- Offset para matching
    SUM(spend) as spend_previous,
    SUM(impressions) as impressions_previous,
    SUM(clicks) as clicks_previous
  FROM `project.dataset.table` t1
  LEFT JOIN `project.dataset.campaigns` t2 ON t1.campaign_id = t2.id
  WHERE date_date BETWEEN '2024-11-01' AND '2024-11-16'
    AND tenant_id = 'tenant_xyz'
  GROUP BY 1, 2
)

SELECT
  -- Atributos
  c.campaign_name,
  c.date_date,

  -- Fecha del periodo de comparacion (para mostrar en UI)
  DATE_SUB(c.date_date, INTERVAL 30 DAY) as date_date_comparison,

  -- Metricas actuales
  c.spend as spend_current,
  c.impressions as impressions_current,
  c.clicks as clicks_current,

  -- Metricas anteriores
  p.spend_previous,
  p.impressions_previous,
  p.clicks_previous,

  -- Deltas absolutos
  c.spend - COALESCE(p.spend_previous, 0) as spend_delta,
  c.impressions - COALESCE(p.impressions_previous, 0) as impressions_delta,
  c.clicks - COALESCE(p.clicks_previous, 0) as clicks_delta,

  -- Deltas porcentuales
  SAFE_DIVIDE(c.spend - p.spend_previous, p.spend_previous) * 100 as spend_delta_pct,
  SAFE_DIVIDE(c.impressions - p.impressions_previous, p.impressions_previous) * 100 as impressions_delta_pct,
  SAFE_DIVIDE(c.clicks - p.clicks_previous, p.clicks_previous) * 100 as clicks_delta_pct

FROM current_period c
LEFT JOIN previous_period p
  ON c.campaign_name = p.campaign_name  -- Match por atributos no-fecha
  AND c.date_date = p.date_date         -- Match por fecha (ya con offset aplicado)

ORDER BY c.date_date DESC
LIMIT 1000
```

### 10.6 Logica de Calculo de Offset

```typescript
// Backend: calculateComparisonOffset.ts

interface DateRange {
  start: string  // ISO date
  end: string    // ISO date
}

interface ComparisonRangeResult {
  previousRange: DateRange
  offsetDays: number
}

function calculateComparisonRange(
  currentRange: DateRange,
  comparisonType: ComparisonType,
  customRange?: DateRange
): ComparisonRangeResult {
  const currentStart = new Date(currentRange.start)
  const currentEnd = new Date(currentRange.end)
  const daysDiff = Math.round((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24))

  switch (comparisonType) {
    case 'same_point': {
      // Mismo numero de dias, inmediatamente antes del periodo actual
      const previousEnd = new Date(currentStart)
      previousEnd.setDate(previousEnd.getDate() - 1)
      const previousStart = new Date(previousEnd)
      previousStart.setDate(previousStart.getDate() - daysDiff)

      const offsetDays = Math.round(
        (currentStart.getTime() - previousStart.getTime()) / (1000 * 60 * 60 * 24)
      )

      return {
        previousRange: {
          start: previousStart.toISOString().split('T')[0],
          end: previousEnd.toISOString().split('T')[0]
        },
        offsetDays
      }
    }

    case 'same_point_yoy': {
      // Mismo periodo, año anterior
      const previousStart = new Date(currentStart)
      previousStart.setFullYear(previousStart.getFullYear() - 1)
      const previousEnd = new Date(currentEnd)
      previousEnd.setFullYear(previousEnd.getFullYear() - 1)

      return {
        previousRange: {
          start: previousStart.toISOString().split('T')[0],
          end: previousEnd.toISOString().split('T')[0]
        },
        offsetDays: 365  // o 366 para años bisiestos
      }
    }

    case 'full_previous': {
      // Periodo anterior completo (detectar si es semana, mes, quarter)
      // ... logica de deteccion de periodo
      return calculateFullPreviousPeriod(currentStart, currentEnd)
    }

    case 'custom': {
      if (!customRange) throw new Error('customRange required for custom comparison')
      const previousStart = new Date(customRange.start)
      const offsetDays = Math.round(
        (currentStart.getTime() - previousStart.getTime()) / (1000 * 60 * 60 * 24)
      )
      return {
        previousRange: customRange,
        offsetDays
      }
    }

    default:
      throw new Error(`Unknown comparison type: ${comparisonType}`)
  }
}
```

### 10.7 Respuesta del Backend

```typescript
interface QueryResponse {
  success: boolean
  data: Record<string, unknown>[]
  columns: QueryColumnInfo[]
  meta: {
    row_count: number
    sql?: string
    comparison?: {
      enabled: true
      currentRange: DateRange
      previousRange: DateRange
      offsetDays: number
    }
  }
}

// Ejemplo de columnas retornadas cuando comparison.enabled = true
const columns: QueryColumnInfo[] = [
  { id: 'campaign_name', label: 'Campaign', type: 'string' },
  { id: 'date_date', label: 'Date', type: 'date' },
  { id: 'date_date_comparison', label: 'Comparison Date', type: 'date' },

  // Metricas con variantes
  { id: 'spend_current', label: 'Spend', type: 'currency' },
  { id: 'spend_previous', label: 'Spend (Previous)', type: 'currency' },
  { id: 'spend_delta', label: 'Spend (Delta)', type: 'currency' },
  { id: 'spend_delta_pct', label: 'Spend (% Change)', type: 'percent' },

  // ... mismo patron para otras metricas
]
```

### 10.8 Casos Especiales

#### Sin campo fecha en attributes (agregacion total)

Si el usuario no incluye el campo fecha en attributes, la comparacion es un total vs total:

```sql
WITH current_period AS (
  SELECT
    campaign_name,
    SUM(spend) as spend
  FROM ...
  WHERE date_date BETWEEN '2024-12-01' AND '2024-12-16'
  GROUP BY 1
),
previous_period AS (
  SELECT
    campaign_name,
    SUM(spend) as spend_previous
  FROM ...
  WHERE date_date BETWEEN '2024-11-01' AND '2024-11-16'
  GROUP BY 1
)
SELECT
  c.campaign_name,
  c.spend as spend_current,
  p.spend_previous,
  c.spend - COALESCE(p.spend_previous, 0) as spend_delta,
  SAFE_DIVIDE(c.spend - p.spend_previous, p.spend_previous) * 100 as spend_delta_pct
FROM current_period c
LEFT JOIN previous_period p ON c.campaign_name = p.campaign_name
```

#### Multiples campos fecha

Si hay varios campos fecha en el dataset, el campo `comparison.dateField` indica cual usar:

```json
{
  "comparison": {
    "enabled": true,
    "type": "same_point",
    "dateField": "created_date",  // Usar created_date, no updated_date
    "variants": ["current", "previous", "delta_pct"]
  }
}
```

#### Variantes selectivas

El frontend puede solicitar solo algunas variantes para reducir ancho de respuesta:

```json
{
  "comparison": {
    "variants": ["current", "delta_pct"]  // Solo valor actual y % cambio
  }
}
```

SQL generado solo incluye columnas solicitadas:
```sql
SELECT
  c.campaign_name,
  c.spend as spend_current,
  -- spend_previous OMITIDO
  -- spend_delta OMITIDO
  SAFE_DIVIDE(c.spend - p.spend_previous, p.spend_previous) * 100 as spend_delta_pct
FROM ...
```

### 10.9 Cambios en Frontend (Simplificacion)

Con el backend manejando la logica, el frontend se simplifica:

```typescript
// Antes (complejo)
const { mergedData } = await executeComparisonQuery(request, config, tenantId)
// Frontend hacia: 2 queries → merge → calcular deltas

// Despues (simple)
const response = await executeQuery({
  ...request,
  comparison: {
    enabled: true,
    type: 'same_point',
    dateField: 'date_date',
    variants: ['current', 'previous', 'delta', 'delta_pct']
  }
})
// Backend retorna datos ya mergeados con todas las variantes
```

### 10.10 Compatibilidad hacia atras

El campo `comparison` es **opcional**. Si no se incluye, el backend genera la query normal sin CTEs.

```typescript
// Sin comparacion (comportamiento actual)
{
  "dataset_id": "...",
  "attributes": [...],
  "metrics": [...]
}

// Con comparacion (nuevo)
{
  "dataset_id": "...",
  "attributes": [...],
  "metrics": [...],
  "comparison": { ... }
}
```

### 10.11 Validaciones del Backend

El backend debe validar:

1. **dateField existe**: El campo especificado en `comparison.dateField` debe existir en el dataset
2. **dateField es tipo fecha**: Debe ser un campo de tipo `date` o `datetime`
3. **Filtro de fecha presente**: Debe haber un filtro en el campo dateField para determinar el rango actual
4. **Variantes validas**: Solo `['current', 'previous', 'delta', 'delta_pct']`
5. **Tipo de comparacion valido**: Uno de los tipos definidos

Errores de validacion:
```json
{
  "success": false,
  "error": {
    "code": "COMPARISON_INVALID_DATE_FIELD",
    "message": "Field 'xyz' not found or is not a date type"
  }
}
```

### 10.12 Performance

El approach con CTEs es **mas eficiente** que 2 queries separadas:

| Aspecto | 2 Queries Frontend | 1 Query CTEs Backend |
|---------|-------------------|---------------------|
| Round trips | 2 | 1 |
| Merge location | JavaScript (memoria) | BigQuery (optimizado) |
| Datos transferidos | 2x | 1x (ya mergeado) |
| Manejo de NULLs | Manual en frontend | COALESCE en SQL |
| Edge cases | Propenso a errores | Manejado en SQL |

### 10.13 Resumen de Archivos a Modificar

#### Backend (Cloud Functions / Cloud Run)

| Archivo | Cambios |
|---------|---------|
| `types/query.ts` | Agregar interface `ComparisonConfig` |
| `compiler/index.ts` | Detectar `comparison` y delegar a CTE generator |
| `compiler/cteGenerator.ts` | **NUEVO**: Generar SQL con CTEs |
| `compiler/comparisonOffset.ts` | **NUEVO**: Calcular rangos y offset |
| `validators/queryValidator.ts` | Validar configuracion de comparison |

#### Frontend

| Archivo | Cambios |
|---------|---------|
| `types/semantic.ts` | Agregar `comparison` a `QueryRequest` |
| `services/comparisonService.ts` | Simplificar - solo agregar config al request |
| `components/viz/VizBuilder.tsx` | Pasar comparison config al executeQuery |

---

## 11. Checklist de Implementacion Backend

- [ ] Agregar `ComparisonConfig` a tipos de QueryRequest
- [ ] Implementar `calculateComparisonRange()` para cada tipo
- [ ] Implementar generador de CTEs en el compilador SQL
- [ ] Generar columnas con sufijos `_current`, `_previous`, `_delta`, `_delta_pct`
- [ ] Agregar columna `{dateField}_comparison` para mostrar fecha de comparacion
- [ ] Usar `SAFE_DIVIDE` para evitar division por cero
- [ ] Usar `COALESCE` para manejar datos faltantes
- [ ] Agregar validaciones de entrada
- [ ] Agregar metadata de comparacion en respuesta
- [ ] Tests unitarios para calculo de offset
- [ ] Tests de integracion para SQL generado
- [ ] Documentar endpoint en API docs

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

### 6.0 Opciones de Selector de Comparacion (Evaluadas)

Se evaluaron 4 opciones para el selector de comparacion:

#### Opcion A: Toggle Simple + Smart Default
```
┌──────────────────────────────────────────────────┐
│  📅 Dic 1 - Dic 16     [○ Comparar]              │
└──────────────────────────────────────────────────┘

Usuario activa toggle → sistema elige automaticamente:
- Si es "este mes" → compara con mes anterior mismo punto
- Si es "esta semana" → compara con semana anterior
- Si es custom range → compara con mismo # dias anteriores
```
**Pro:** Un click, cero friccion
**Con:** Menos control

#### Opcion B: Date Picker con Dual Range
```
┌─────────────────────────────────────────────────────────┐
│  Periodo actual:      📅 Dic 1 - Dic 16                 │
│  ☑ Comparar con:      📅 Nov 1 - Nov 16  [Auto ▼]      │
└─────────────────────────────────────────────────────────┘

[Auto ▼] despliega:
  • Mismo punto (recomendado)
  • Periodo completo
  • Año anterior
  • Elegir fechas...
```
**Pro:** Visual, claro que se compara
**Con:** Ocupa mas espacio

#### Opcion C: Timeline Visual (Evolucion Futura)
```
        Nov                    Dic
   ├────────────────────┼────────────────────┤
   │▓▓▓▓▓▓▓▓▓░░░░░░░░░░░│████████████░░░░░░░│
   │  Comparacion       │  Periodo actual    │
   │  Nov 1-16          │  Dic 1-16          │
   └────────────────────┴────────────────────┘

   Arrastras para ajustar ambos rangos visualmente
```
**Pro:** Muy intuitivo, ves la relacion temporal
**Con:** Mas complejo de construir

#### Opcion D: Hibrido Pragmatico (RECOMENDADA PARA MVP)
```
┌─────────────────────────────────────────┐
│  📅 Dic 1-16, 2024 ▼  │  🔄 vs Nov ▼    │
└─────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ ○ Sin comparar  │
                    │ ● Nov 1-16      │  ← mismo punto (default)
                    │ ○ Nov completo  │
                    │ ○ Dic 2023      │  ← YoY
                    │ ○ Personalizado │
                    └─────────────────┘
```
**Pro:** Simple pero con opciones claras, muestra fechas concretas
**Con:** Nada especial

### Decision de Implementacion

**MVP: Opcion D** (Hibrido Pragmatico)
- Selector muestra fechas concretas, no solo "periodo anterior"
- Usuario ve exactamente que se compara
- Facil de implementar

**Evolucion: Opcion C** (Timeline Visual)
- Para version futura cuando haya mas feedback de usuarios
- Mas intuitivo para power users

### 6.1 Selector de Comparacion (Implementacion)
- Ubicado junto al date picker principal
- Dropdown muestra FECHAS CONCRETAS, no solo labels genericos
- El selector calcula y muestra el rango resultante antes de seleccionar

```
┌─────────────────────────────────────────────────┐
│  📅 Dic 1 - Dic 16, 2024  ▼  │  🔄 vs Nov 1-16 ▼  │
└─────────────────────────────────────────────────┘
                                        │
                                        ▼
                              ┌─────────────────────┐
                              │ ○ Sin comparar      │
                              │ ● Nov 1-16          │
                              │ ○ Nov 1-30 completo │
                              │ ○ Dic 1-16, 2023    │
                              │ ○ Personalizado...  │
                              └─────────────────────┘
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

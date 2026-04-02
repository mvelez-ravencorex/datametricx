# VizBuilder - Componente de Construcción de Visualizaciones

## Descripción General

`VizBuilder` es un componente reutilizable para construir visualizaciones de datos a partir de datasets semánticos. Permite seleccionar campos (atributos y métricas), aplicar filtros, y generar diferentes tipos de gráficos.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         VizBuilder                               │
├─────────────────────┬───────────────────────────────────────────┤
│    FieldsPanel      │           DataExplorerPanel               │
│   (Panel Izquierdo) │           (Panel Derecho)                 │
│                     │                                           │
│  ┌───────────────┐  │  ┌─────────────────────────────────────┐  │
│  │ Entity Groups │  │  │ Toolbar (Run, Filters, Viz Type)   │  │
│  │  └─ Attributes│  │  ├─────────────────────────────────────┤  │
│  │  └─ Metrics   │  │  │ Data Table / Chart View             │  │
│  └───────────────┘  │  │                                     │  │
│                     │  │  ┌─────────┐ ┌─────────┐            │  │
│  [Select All]       │  │  │  Line   │ │  Bar    │            │  │
│  [Clear]            │  │  │  Chart  │ │  Chart  │            │  │
│                     │  │  └─────────┘ └─────────┘            │  │
│                     │  │                                     │  │
│                     │  │  SQL Preview / Save Controls        │  │
│                     │  └─────────────────────────────────────┘  │
└─────────────────────┴───────────────────────────────────────────┘
```

## Ubicación de Archivos

```
src/
├── components/
│   └── viz/
│       └── VizBuilder.tsx     # Componente principal (~5100 líneas)
├── pages/
│   ├── DatasetsNew.tsx        # Wrapper que carga datos y usa VizBuilder
│   └── DashboardEditor.tsx    # Editor de dashboards, usa DatasetsNew embebido
├── services/
│   ├── vizService.ts          # CRUD de visualizaciones guardadas
│   └── dashboardService.ts    # CRUD de dashboards
└── types/
    └── viz.ts                 # Tipos para visualizaciones y dashboards
```

## Componentes Internos de VizBuilder

### FieldsPanel
Panel izquierdo que muestra los campos disponibles del dataset agrupados por entidad.

- **EntitySection**: Grupo colapsable de campos por entidad
- **GroupSection**: Subgrupo de campos (atributos o métricas)
- **FieldItemRow**: Campo individual seleccionable con opciones de formato

### DataExplorerPanel
Panel derecho con la exploración de datos y visualización.

- **Toolbar**: Botón Run, selector de tipo de viz, filtros
- **FiltersSection**: Panel de filtros activos
- **DataTable**: Tabla de resultados de la consulta
- **ChartView**: Visualización gráfica (Line, Bar, Area, Pie)
- **SQLPreview**: Vista previa del SQL generado
- **SaveVizModal**: Modal para guardar la visualización

## Props del Componente

```typescript
interface VizBuilderProps {
  // Requerido: Dataset y sus entidades cargadas
  dataset: DatasetWithMeta
  entities: Map<string, SemanticEntity>

  // Opcional: Configuración inicial para cargar (edición)
  initialConfig?: VizConfig

  // Opcional: Modo embebido (para dashboards)
  embedded?: boolean

  // Callback cuando los datos de la viz cambian
  onVizDataChange?: (vizData: DashboardVizData) => void

  // Mostrar controles de guardado
  showSaveControls?: boolean

  // Clase CSS para altura personalizada
  heightClass?: string
}
```

## Tipos Exportados

### DashboardVizData
Datos de visualización para widgets del dashboard:

```typescript
interface DashboardVizData {
  datasetId: string
  datasetLabel: string
  vizType: VizType  // 'line' | 'column' | 'area' | 'pie' | 'single' | 'progress'
  chartData: Record<string, unknown>[]
  selectedMetrics: { fieldId: string; label: string; entityId: string }[]
  selectedAttributes: { fieldId: string; label: string; entityId: string }[]
  seriesConfig: Record<string, { label?: string; color?: string }>
  chartSettings: {
    showDataLabels: boolean
    showXGridLines: boolean
    showYGridLines: boolean
    pointStyle?: string
    pieInnerRadius?: number
  }
  filters?: MetricFilter[]
}
```

### DatasetWithMeta
Dataset extendido con metadatos:

```typescript
interface DatasetWithMeta extends SemanticDataset {
  group: string      // Grupo de clasificación
  subgroup: string   // Subgrupo
  path: string       // Ruta del archivo
}
```

### FieldItem
Representación de un campo seleccionable:

```typescript
interface FieldItem {
  id: string           // entity.field_id format
  fieldId: string      // Solo el ID del campo
  label: string
  type: string
  fieldType: 'attribute' | 'metric'
  entityId: string
  entityLabel: string
  group: string
  description?: string
  sql?: string
  sql_agg?: string
}
```

## Uso

### Uso Básico (con carga de datos)

```tsx
import DatasetsNew from '@/pages/DatasetsNew'

function MyPage() {
  return (
    <DatasetsNew />
  )
}
```

### Uso Embebido (en Dashboard)

```tsx
import DatasetsNew, { DashboardVizData } from '@/pages/DatasetsNew'

function DashboardEditor() {
  const [vizData, setVizData] = useState<DashboardVizData | null>(null)

  return (
    <DatasetsNew
      embedded={true}
      initialDatasetId="my_dataset_id"
      initialVizConfig={existingConfig}  // Para edición
      onAddToDashboard={setVizData}
    />
  )
}
```

### Uso Directo de VizBuilder (datos ya cargados)

```tsx
import VizBuilder, { DatasetWithMeta, DashboardVizData } from '@/components/viz/VizBuilder'

function CustomVizPage() {
  const [dataset, setDataset] = useState<DatasetWithMeta | null>(null)
  const [entities, setEntities] = useState<Map<string, SemanticEntity>>(new Map())

  // ... cargar dataset y entities ...

  if (!dataset) return <Loading />

  return (
    <VizBuilder
      dataset={dataset}
      entities={entities}
      onVizDataChange={(data) => console.log('Viz data:', data)}
      showSaveControls={true}
      heightClass="h-[600px]"
    />
  )
}
```

## Tipos de Visualización Soportados

| Tipo | Descripción | Requiere |
|------|-------------|----------|
| `line` | Gráfico de líneas | 1+ atributo, 1+ métrica |
| `column` | Gráfico de barras verticales | 1+ atributo, 1+ métrica |
| `area` | Gráfico de área | 1+ atributo, 1+ métrica |
| `pie` | Gráfico circular | 1 atributo, 1 métrica |
| `single` | Valor único grande | 1 métrica |
| `progress` | Barra de progreso | 1 métrica |

## Funcionalidades

### Selección de Campos
- Click para seleccionar/deseleccionar
- Arrastrar para reordenar (en selectedFields)
- Formato de métricas (número, moneda, porcentaje, compacto)
- Timeframes para fechas (raw, date, week, month, year)

### Filtros
- Agregar desde el menú del campo
- Operadores: =, !=, >, <, >=, <=, LIKE, IN, IS NULL, etc.
- Filtros de fecha: last_7_days, last_30_days, this_month, etc.
- Múltiples filtros combinables

### Pivot
- Seleccionar un atributo como pivot
- Genera columnas dinámicas basadas en valores únicos

### Guardar Visualización
- Guardar como .viz en Firestore
- Organizar en carpetas
- Compartir con URL pública

## Integración con Dashboard

El componente se integra con el sistema de dashboards:

1. **DatasetsNew** carga el dataset y entidades
2. **VizBuilder** renderiza la UI de construcción
3. Al hacer click en "Agregar al Dashboard", se llama `onVizDataChange`
4. **DashboardEditor** recibe los datos y crea un elemento `VisualizationElement`
5. El elemento se guarda con `embeddedConfig` conteniendo la configuración completa

```typescript
// Flujo de datos
DatasetsNew
  → loadDataset()
  → loadEntities()
  → <VizBuilder onVizDataChange={callback} />
      → Usuario configura visualización
      → callback(DashboardVizData)
          → DashboardEditor.addVisualizationWidget()
              → Crea VisualizationElement con embeddedConfig
```

## Notas de Implementación

### Performance
- useMemo para cálculos pesados (entityFieldsList, allFields)
- useCallback para handlers
- Lazy loading de datos de gráficos

### Estado
- Estado local para selección de campos y configuración
- sessionStorage para configuración pendiente (entre renders)
- Props para control externo (embedded mode)

### Estilos
- Tailwind CSS para estilos
- Recharts para gráficos
- Grid responsivo con paneles redimensionables

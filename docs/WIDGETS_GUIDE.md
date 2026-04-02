# Guía de Widgets Personalizables - DataMetricX

## 📊 Introducción

DataMetricX incluye un sistema completo de widgets personalizables que permite a los usuarios crear dashboards adaptados a sus necesidades específicas.

## 🎨 Tipos de Widgets Disponibles

### 1. **KPI Widget**
Muestra métricas clave con tendencia y formato personalizable.

**Características:**
- Formatos: número, moneda, porcentaje, multiplicador
- Indicador de tendencia (↑↓)
- Comparación con valor anterior
- Colores personalizables
- Iconos opcionales

**Uso:**
```typescript
import { KPIWidget } from '@/components/widgets'
import { KPIWidgetConfig } from '@/types/widgets'

const config: KPIWidgetConfig = {
  id: 'kpi-1',
  type: 'kpi',
  title: 'Ingresos Totales',
  dataSource: 'firestore',
  visible: true,
  layout: { i: 'kpi-1', x: 0, y: 0, w: 4, h: 2 },
  settings: {
    value: 150000,
    previousValue: 120000,
    format: 'currency',
    showTrend: true,
    trendType: 'up-good',
    colorScheme: 'blue',
    decimals: 0
  },
  createdAt: new Date(),
  updatedAt: new Date()
}

<KPIWidget config={config} />
```

### 2. **Line Chart Widget**
Visualiza tendencias a lo largo del tiempo.

**Características:**
- Líneas curvas o rectas
- Área rellena opcional
- Grid personalizable
- Tooltip interactivo
- Múltiples series de datos
- Colores por esquema

**Uso:**
```typescript
const config: LineChartWidgetConfig = {
  type: 'line-chart',
  title: 'Ventas Mensuales',
  settings: {
    dataKey: 'sales',
    xAxisKey: 'month',
    yAxisKey: 'value',
    showGrid: true,
    showLegend: true,
    curved: true,
    colorScheme: 'blue',
    height: 300,
    fillArea: false
  }
}

const data = [
  { month: 'Ene', value: 4000 },
  { month: 'Feb', value: 3000 },
  { month: 'Mar', value: 5000 }
]

<LineChartWidget config={config} data={data} />
```

### 3. **Bar Chart Widget**
Compara valores entre categorías.

**Características:**
- Orientación vertical u horizontal
- Barras apiladas
- Grid personalizable
- Colores por esquema
- Tooltip interactivo

**Uso:**
```typescript
const config: BarChartWidgetConfig = {
  type: 'bar-chart',
  title: 'Ventas por Categoría',
  settings: {
    dataKey: 'sales',
    xAxisKey: 'category',
    yAxisKey: 'value',
    orientation: 'vertical',
    showGrid: true,
    colorScheme: 'green',
    height: 300
  }
}
```

### 4. **Table Widget**
Tabla de datos con funcionalidades avanzadas.

**Características:**
- Búsqueda en tiempo real
- Ordenamiento por columnas
- Paginación
- Formatos personalizados (número, moneda, fecha, porcentaje)
- Exportación de datos
- Estilos configurables (striped, hoverable, compact)

**Uso:**
```typescript
const config: TableWidgetConfig = {
  type: 'table',
  title: 'Top Productos',
  settings: {
    columns: [
      { key: 'name', label: 'Producto', sortable: true, align: 'left' },
      { key: 'sales', label: 'Ventas', sortable: true, format: 'currency', align: 'right' },
      { key: 'units', label: 'Unidades', sortable: true, format: 'number', align: 'right' }
    ],
    pagination: true,
    pageSize: 10,
    searchable: true,
    striped: true,
    hoverable: true
  }
}
```

### 5. **Metric Card Widget**
Tarjeta de métrica con objetivo.

**Características:**
- Muestra valor actual
- Objetivo configurable
- Barra de progreso
- Iconos personalizables
- Formatos: número, moneda, porcentaje

### 6. **Progress Bar Widget**
Barra de progreso visual.

**Características:**
- Valor actual vs total
- Animación opcional
- Colores personalizables
- Etiquetas configurables

### 7. **Text Widget**
Contenido de texto libre.

**Características:**
- Tamaños de fuente configurables
- Alineación personalizable
- Soporte para Markdown
- Colores personalizados

## 🎨 Esquemas de Colores

```typescript
const COLOR_SCHEMES = {
  blue: ['#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE'],
  green: ['#10B981', '#34D399', '#6EE7B7', '#D1FAE5'],
  red: ['#EF4444', '#F87171', '#FCA5A5', '#FEE2E2'],
  purple: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#EDE9FE'],
  orange: ['#F59E0B', '#FBBF24', '#FCD34D', '#FEF3C7'],
  gradient: ['#667eea', '#764ba2', '#f093fb', '#4facfe']
}
```

## 🔧 Componentes del Sistema

### `WidgetContainer`
Contenedor base para todos los widgets.

**Características:**
- Header con título y descripción
- Botones de acción (refresh, configure, delete)
- Estados de carga y error
- Footer con última actualización

### `WidgetRenderer`
Renderiza el widget correcto según el tipo.

**Uso:**
```typescript
<WidgetRenderer
  config={widgetConfig}
  data={widgetData}
  onRefresh={() => fetchData()}
  onConfigure={() => openConfigPanel()}
  onDelete={() => deleteWidget()}
  isLoading={loading}
  error={error}
/>
```

### `WidgetConfigPanel`
Panel lateral para configurar propiedades del widget.

**Características:**
- Configuración general (título, descripción)
- Opciones específicas por tipo
- Selector de esquemas de colores
- Vista previa en tiempo real

**Uso:**
```typescript
const [configPanelOpen, setConfigPanelOpen] = useState(false)
const [selectedWidget, setSelectedWidget] = useState<WidgetConfig | null>(null)

<WidgetConfigPanel
  widget={selectedWidget}
  isOpen={configPanelOpen}
  onClose={() => setConfigPanelOpen(false)}
  onSave={(config) => updateWidget(config)}
/>
```

### `WidgetCatalog`
Catálogo de widgets disponibles para agregar.

**Uso:**
```typescript
const [catalogOpen, setCatalogOpen] = useState(false)

<WidgetCatalog
  isOpen={catalogOpen}
  onClose={() => setCatalogOpen(false)}
  onSelectWidget={(template) => addWidget(template)}
/>
```

## 📝 Ejemplo Completo de Integración

```typescript
import { useState } from 'react'
import { WidgetRenderer, WidgetCatalog, WidgetConfigPanel } from '@/components/widgets'
import { WidgetConfig, WidgetTemplate } from '@/types/widgets'

export default function CustomDashboard() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([])
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [configPanelOpen, setConfigPanelOpen] = useState(false)
  const [selectedWidget, setSelectedWidget] = useState<WidgetConfig | null>(null)

  const handleAddWidget = (template: WidgetTemplate) => {
    const newWidget: WidgetConfig = {
      ...template.defaultConfig,
      id: `widget-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    setWidgets([...widgets, newWidget])
  }

  const handleConfigureWidget = (widget: WidgetConfig) => {
    setSelectedWidget(widget)
    setConfigPanelOpen(true)
  }

  const handleUpdateWidget = (updatedConfig: WidgetConfig) => {
    setWidgets(widgets.map(w =>
      w.id === updatedConfig.id ? updatedConfig : w
    ))
  }

  const handleDeleteWidget = (widgetId: string) => {
    setWidgets(widgets.filter(w => w.id !== widgetId))
  }

  return (
    <div className="p-6">
      {/* Add Widget Button */}
      <button
        onClick={() => setCatalogOpen(true)}
        className="mb-4 px-4 py-2 bg-primary-blue text-white rounded-lg"
      >
        + Agregar Widget
      </button>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-12 gap-4">
        {widgets.map((widget) => (
          <div
            key={widget.id}
            className={`col-span-${widget.layout.w}`}
          >
            <WidgetRenderer
              config={widget}
              onConfigure={() => handleConfigureWidget(widget)}
              onDelete={() => handleDeleteWidget(widget.id)}
            />
          </div>
        ))}
      </div>

      {/* Widget Catalog */}
      <WidgetCatalog
        isOpen={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onSelectWidget={handleAddWidget}
      />

      {/* Config Panel */}
      <WidgetConfigPanel
        widget={selectedWidget}
        isOpen={configPanelOpen}
        onClose={() => setConfigPanelOpen(false)}
        onSave={handleUpdateWidget}
      />
    </div>
  )
}
```

## 💾 Persistencia en Firestore

```typescript
import { widgetConfigService } from '@/services/firestore'
import { useAuth } from '@/contexts/AuthContext'

// Guardar configuración de widget
const saveWidget = async (config: WidgetConfig) => {
  const { currentUser } = useAuth()
  if (!currentUser) return

  await widgetConfigService.create({
    ...config,
    userId: currentUser.uid
  })
}

// Cargar widgets del usuario
const loadWidgets = async () => {
  const { currentUser } = useAuth()
  if (!currentUser) return []

  return await widgetConfigService.getByUserId(currentUser.uid)
}
```

## 🎯 Mejores Prácticas

1. **Performance**
   - Usa `React.memo` para widgets que no cambian frecuentemente
   - Implementa virtualización para dashboards con muchos widgets
   - Cachea datos para reducir llamadas a la API

2. **Datos**
   - Valida los datos antes de pasarlos a los widgets
   - Maneja estados de carga y error apropiadamente
   - Implementa refresh automático con intervals configurables

3. **UX**
   - Proporciona feedback visual al guardar cambios
   - Confirma antes de eliminar widgets
   - Guarda automáticamente los cambios de layout

4. **Seguridad**
   - Valida permisos antes de modificar widgets
   - Sanitiza el contenido de widgets de texto
   - Verifica ownership en Firestore rules

## 🚀 Próximos Pasos

- [ ] Implementar más tipos de widgets (Pie Chart, Gauge, etc.)
- [ ] Agregar templates predefinidos de dashboards
- [ ] Implementar compartir dashboards entre usuarios
- [ ] Agregar export/import de configuraciones
- [ ] Implementar widgets con datos en tiempo real

## 📚 Recursos

- [Recharts Documentation](https://recharts.org/)
- [React Grid Layout](https://github.com/react-grid-layout/react-grid-layout)
- [Tailwind CSS](https://tailwindcss.com/)

---

**Última actualización**: 2025-11-21
**Versión**: 1.0

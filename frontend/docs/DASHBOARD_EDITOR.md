# Dashboard Editor - Editor de Dashboards

## Descripcion General

El Dashboard Editor permite crear y editar dashboards interactivos con visualizaciones, texto, filtros y otros elementos. Los elementos se posicionan en un canvas con grid de 100x100px para facilitar la alineacion.

## Caracteristicas

### Canvas con Grid
- Grid de **25x25 pixeles** para alineacion de elementos
- Canvas de 2000x1500px minimo (scrolleable)
- Fondo visual con lineas de grid para guia

### Elementos del Dashboard
- **Visualization**: Graficos creados con VizBuilder
- **Text**: Bloques de texto con estilo
- **Filter**: Filtros interactivos
- **Image**: Imagenes
- **Button**: Botones con acciones
- **Menu**: Menus de navegacion

### Drag & Drop
- Click y arrastrar para mover elementos
- Los elementos se alinean automaticamente al grid (snap-to-grid)
- Cursor cambia a "grab" al pasar sobre elementos

### Redimensionamiento
- Resize desde los bordes del contenedor (8 zonas: 4 esquinas + 4 bordes)
- Zonas de resize invisibles de 8px en los bordes
- Redimensionamiento con snap-to-grid (50px)
- Indicador de tamano (width x height) visible al seleccionar
- Cursores de resize contextuales (n-resize, s-resize, e-resize, w-resize, etc.)

### Titulos de Visualizaciones
- Opcion para ocultar/mostrar titulo desde menu de opciones
- Titulo editable haciendo click directamente sobre el
- Cancelar edicion con Escape, guardar con Enter o click fuera

### Seleccion de Elementos
- Click para seleccionar un elemento
- Borde azul indica elemento seleccionado
- Click en canvas vacio deselecciona

## Arquitectura

```
DashboardEditor
├── Header
│   ├── Dashboard Name (editable)
│   ├── Description (editable)
│   ├── Create Dropdown (add elements)
│   └── Save/Preview/Export buttons
│
├── Canvas (with grid)
│   ├── Grid Background (100x100px)
│   └── Elements (absolute positioned)
│       ├── ElementWrapper
│       │   ├── Content (Viz, Text, Filter, etc)
│       │   ├── OptionsMenu (Edit, Delete)
│       │   ├── ResizeHandles (8 handles)
│       │   └── SizeIndicator (when selected)
│       └── ...more elements
│
└── Visualization Modal
    ├── Dataset Selector
    ├── DatasetsNew (embedded VizBuilder)
    └── Add/Update button
```

## Constantes

```typescript
const GRID_SIZE = 25 // 25px grid cells
```

## Estado Principal

```typescript
// Canvas y elementos
const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>()
const [selectedElement, setSelectedElement] = useState<string | null>(null)

// Drag
const [draggingElement, setDraggingElement] = useState<string | null>(null)
const [dragStart, setDragStart] = useState<{ x, y, elementX, elementY } | null>(null)

// Resize
const [resizingElement, setResizingElement] = useState<{ id, handle } | null>(null)
const [resizeStart, setResizeStart] = useState<{ x, y, width, height, elementX, elementY } | null>(null)

// Title editing
const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
const [editingTitleValue, setEditingTitleValue] = useState('')
```

## Funciones Principales

### snapToGrid
Alinea un valor al grid mas cercano:
```typescript
const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE
```

### handleDragStart
Inicia el arrastre de un elemento:
```typescript
const handleDragStart = (e: React.MouseEvent, elementId: string) => {
  e.stopPropagation()
  setDraggingElement(elementId)
  setSelectedElement(elementId)
  setDragStart({ x: e.clientX, y: e.clientY, elementX, elementY })
}
```

### handleResizeStart
Inicia el redimensionamiento desde un handle:
```typescript
const handleResizeStart = (e: React.MouseEvent, elementId: string, handle: string) => {
  // handle: 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'
  e.stopPropagation()
  setResizingElement({ id: elementId, handle })
  setResizeStart({ x, y, width, height, elementX, elementY })
}
```

## Componentes Internos

### ElementWrapper
Contenedor comun para todos los elementos:
- Posicionamiento absoluto
- Eventos de drag/click
- Borde de seleccion
- Zonas de resize en bordes
- Size indicator
- Soporte para titulo editable

### ResizeBorders
Zonas invisibles para redimensionar desde los bordes:
- 4 esquinas: nw, ne, sw, se (cursor nwse-resize o nesw-resize)
- 4 bordes: n, s, e, w (cursor n-resize, s-resize, etc.)
- Cada zona tiene 8px de ancho/alto

### OptionsMenu
Menu contextual:
- Ocultar/Mostrar titulo (solo visualizaciones)
- Editar (solo visualizaciones)
- Eliminar

## Posicionamiento de Elementos

Los elementos nuevos se posicionan automaticamente:

```typescript
// Widgets normales
const baseX = GRID_SIZE + (elementCount % 3) * (GRID_SIZE * 4)  // 400px spacing
const baseY = GRID_SIZE + Math.floor(elementCount / 3) * (GRID_SIZE * 3)  // 300px spacing

// Visualizaciones
const baseX = GRID_SIZE + (elementCount % 2) * (GRID_SIZE * 5)  // 500px spacing
const baseY = GRID_SIZE + Math.floor(elementCount / 2) * (GRID_SIZE * 4)  // 400px spacing
```

## Tamanos por Defecto

| Tipo | Ancho | Alto |
|------|-------|------|
| Visualization | 400px (8 celdas) | 300px (6 celdas) |
| Text | 300px (6 celdas) | 100px (2 celdas) |
| Image | 200px (4 celdas) | 200px (4 celdas) |
| Filter | 200px (4 celdas) | 100px (2 celdas) |
| Button | 200px (4 celdas) | 50px (1 celda) |
| Menu | 200px (4 celdas) | 50px (1 celda) |

## Persistencia

El dashboard se guarda en Firestore:
```typescript
// Estructura del documento
{
  id: string
  tenantId: string
  name: string
  description?: string
  folderId: string | null
  config: DashboardConfig  // Contiene layout, theme, elements
  createdAt: Date
  createdBy: string
  updatedAt: Date
  updatedBy: string
  isPublic: boolean
  publicToken?: string
}
```

## Uso

### Crear Dashboard
1. Navegar a `/dashboard-editor`
2. Escribir nombre y descripcion
3. Click en "Crear" para agregar elementos
4. Configurar visualizaciones con el modal
5. Mover y redimensionar elementos en el canvas
6. Click "Guardar" para persistir

### Editar Dashboard Existente
1. Navegar a `/dashboard-editor?id={dashboardId}`
2. El dashboard se carga automaticamente
3. Modificar elementos
4. Click "Guardar" para actualizar

### Agregar Visualizacion
1. Click "Crear" > "Visualizacion"
2. Seleccionar dataset del dropdown
3. Configurar campos, filtros y tipo de grafico en VizBuilder
4. Click "Agregar al dashboard"

### Editar Visualizacion
1. Click en menu de opciones del elemento (...)
2. Click "Editar"
3. Modificar configuracion en VizBuilder
4. Click "Actualizar"

## Estilos CSS

El grid se renderiza con gradientes CSS:
```css
.canvas-grid {
  background-image:
    linear-gradient(to right, #e5e7eb 1px, transparent 1px),
    linear-gradient(to bottom, #e5e7eb 1px, transparent 1px);
  background-size: 25px 25px;
}
```

Las zonas de resize (invisibles):
```css
.resize-border {
  position: absolute;
  z-index: 10;
  /* Borde superior */
  top: 0;
  left: 8px;
  right: 8px;
  height: 8px;
  cursor: n-resize;
}
```

# Sistema de Visualizaciones (Viz)

## Descripcion General

El sistema de Viz permite a los usuarios guardar configuraciones de visualizaciones creadas en la pagina DatasetsNew. Cada visualizacion guarda el estado completo incluyendo:

- Dataset seleccionado
- Atributos y metricas seleccionados
- Filtros aplicados
- Ordenamiento
- Tipo de grafico y configuracion especifica
- Esquema de colores

## Arquitectura

### Almacenamiento

Las visualizaciones se almacenan en **Firestore** (no en Cloud Storage) porque:

1. **Tamano pequeno**: Una VizConfig es ~2-5 KB de JSON
2. **Queries necesarias**: Listar por carpeta, buscar por nombre, ordenar por fecha
3. **Metadatos consultables**: createdBy, updatedAt, folderId
4. **Costo eficiente**: Para configuraciones pequenas, Firestore es mas economico

### Estructura en Firestore

```
tenants/{tenantId}/
├── vizs/{vizId}
│   ├── id: string
│   ├── tenantId: string
│   ├── name: string
│   ├── description: string | null
│   ├── folderId: string | null
│   ├── config: VizConfig
│   ├── createdAt: Timestamp
│   ├── createdBy: string
│   ├── updatedAt: Timestamp
│   ├── updatedBy: string
│   ├── isPublic: boolean
│   └── publicToken: string | null
│
└── viz_folders/{folderId}
    ├── id: string
    ├── tenantId: string
    ├── name: string
    ├── parentId: string | null
    ├── createdAt: Timestamp
    ├── createdBy: string
    └── updatedAt: Timestamp
```

## Tipos TypeScript

### VizConfig

```typescript
interface VizConfig {
  // Referencia al dataset
  datasetId: string

  // Campos seleccionados
  selectedAttributes: SelectedField[]
  selectedMetrics: SelectedField[]

  // Filtros y ordenamiento
  filters: MetricFilter[]
  orderBy: OrderByConfig[]
  rowLimit: number

  // Configuracion visual
  vizType: VizType
  chartSettings: ChartSettings
  colorScheme: string
  customColors?: string[]
  chartRowLimit?: number
  xAxisFormat?: XAxisFormatConfig
}
```

### Tipos de Visualizacion

| Tipo | Descripcion | Requiere Atributos |
|------|-------------|-------------------|
| `line` | Grafico de lineas | Si |
| `column` | Grafico de barras | Si |
| `area` | Grafico de area | Si |
| `pie` | Grafico circular | Si |
| `single` | Valor unico (KPI) | No |
| `progress` | Barra de progreso | No |

### ChartSettings (Union Discriminada)

```typescript
type ChartSettings =
  | { type: 'line'; settings: LineChartSettings }
  | { type: 'column'; settings: ColumnChartSettings }
  | { type: 'area'; settings: AreaChartSettings }
  | { type: 'pie'; settings: PieChartSettings }
  | { type: 'single'; settings: SingleValueSettings }
  | { type: 'progress'; settings: ProgressBarSettings }
```

## Servicio (vizService.ts)

### Funciones de Viz

```typescript
// Crear nueva visualizacion
createViz(tenantId, userId, request: CreateVizRequest): Promise<string>

// Obtener visualizacion por ID
getViz(tenantId, vizId): Promise<VizDocument | null>

// Actualizar visualizacion
updateViz(tenantId, vizId, userId, request: UpdateVizRequest): Promise<void>

// Eliminar visualizacion
deleteViz(tenantId, vizId): Promise<void>

// Listar visualizaciones (opcionalmente por carpeta)
listVizs(tenantId, folderId?): Promise<VizListItem[]>
```

### Funciones de Folders

```typescript
// Crear carpeta
createFolder(tenantId, userId, request: CreateFolderRequest): Promise<string>

// Obtener carpeta
getFolder(tenantId, folderId): Promise<FolderDocument | null>

// Actualizar nombre de carpeta
updateFolder(tenantId, folderId, name): Promise<void>

// Eliminar carpeta (solo si esta vacia)
deleteFolder(tenantId, folderId): Promise<{ success: boolean; error?: string }>

// Listar carpetas
listFolders(tenantId, parentId?): Promise<FolderListItem[]>
```

### Funciones de Arbol

```typescript
// Construir arbol completo de vizs y folders
getVizTree(tenantId): Promise<VizTreeNode[]>
```

### Acceso Publico

```typescript
// Habilitar/deshabilitar acceso publico
togglePublicAccess(tenantId, vizId, userId, isPublic): Promise<string | null>

// Obtener viz por token publico (TODO: implementar con collectionGroup)
getVizByPublicToken(token): Promise<{ viz: VizDocument; config: VizConfig } | null>
```

## UI Components

### Menu de Configuracion

Ubicacion: Junto al boton "Run" en DatasetsNew

```tsx
<button onClick={() => setShowSettingsMenu(!showSettingsMenu)}>
  <Cog6ToothIcon />
</button>
```

Opciones del menu:
- **Guardar como Viz**: Abre modal de guardado

### Modal de Guardado

Campos:
- **Nombre** (requerido): Nombre de la visualizacion
- **Descripcion** (opcional): Descripcion breve
- **Ubicacion**: Explorador de carpetas

### Explorador de Carpetas

Interacciones:
- **Un clic**: Selecciona carpeta como destino
- **Doble clic**: Expande/colapsa carpeta
- **Icono +**: Inicia creacion de nueva carpeta
- **Enter**: Confirma nombre de nueva carpeta
- **Escape**: Cancela creacion de carpeta

Estados visuales:
- Carpeta seleccionada: Fondo purpura
- Carpeta con hijos: Muestra chevron >
- Carpeta expandida: Chevron rotado 90°
- Input de nueva carpeta: Fondo azul claro

## Reglas de Seguridad (Firestore)

```javascript
// vizs
match /vizs/{vizId} {
  allow read: if isTenantMember(tenantId);
  allow create: if isTenantMember(tenantId);
  allow update: if isTenantMember(tenantId);
  allow delete: if isTenantMember(tenantId);
}

// viz_folders
match /viz_folders/{folderId} {
  allow read: if isTenantMember(tenantId);
  allow create: if isTenantMember(tenantId);
  allow update: if isTenantMember(tenantId);
  allow delete: if isTenantMember(tenantId);
}
```

## Proximos Pasos (TODO)

1. **Cargar Viz guardada**: Restaurar estado desde VizConfig
2. **Editar Viz existente**: Actualizar configuracion
3. **Eliminar Viz**: Con confirmacion
4. **Mover Viz entre carpetas**: Drag & drop
5. **Buscar Viz**: Por nombre o descripcion
6. **Compartir Viz**: Generar URL publica
7. **Dashboard**: Combinar multiples Viz en un layout
8. **Exportar**: PDF, PNG, CSV

## Ejemplo de Uso

```typescript
// Guardar nueva visualizacion
const vizConfig: VizConfig = {
  datasetId: 'ds_performance_campaign',
  selectedAttributes: [
    { fieldId: 'campaign_name', entityId: 'fact_meta_performance_campaign' }
  ],
  selectedMetrics: [
    { fieldId: 'spend', entityId: 'fact_meta_performance_campaign' }
  ],
  filters: [],
  orderBy: [{ field: 'spend', direction: 'DESC' }],
  rowLimit: 100,
  vizType: 'column',
  chartSettings: {
    type: 'column',
    settings: {
      showGrid: true,
      orientation: 'vertical',
      stacked: false
    }
  },
  colorScheme: 'default'
}

const vizId = await createViz(tenantId, userId, {
  name: 'Gasto por Campana',
  description: 'Top campanas por gasto',
  folderId: null, // raiz
  config: vizConfig
})
```

---

**Ultima actualizacion:** 2024-12-11

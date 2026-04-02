# DataMetricX - Guia para Claude Code

## Reglas de Trabajo

### 1. NO tocar Google Cloud directamente

**NUNCA ejecutar comandos que modifiquen GCP:**
- `gcloud run services add-iam-policy-binding`
- `gcloud projects add-iam-policy-binding`
- `gcloud iam service-accounts`
- `terraform apply`
- Cualquier comando que cree/modifique recursos GCP

**SI puedo hacer:**
- Consultas de lectura: `gcloud auth list`, `gcloud config get-value project`
- Verificar permisos existentes
- Diagnosticar errores

### 2. Workflow con Agente de Backend/Terraform

Cuando encuentre un error de GCP/IAM/permisos, debo:

1. **Diagnosticar** el problema (leer logs, verificar configuracion)
2. **Documentar** el cambio requerido en detalle
3. **Informar** al usuario con el cambio exacto que debe hacer

**Formato para reportar cambios de GCP:**

```
## Cambio Requerido en GCP

**Problema:** [Descripcion del error]

**Servicio afectado:** [Cloud Run, IAM, Storage, etc.]

**Cambio necesario:**
- Recurso: [nombre del recurso]
- Accion: [agregar permiso, crear service account, etc.]
- Detalles: [comando o configuracion Terraform]

**Comando sugerido (para el agente de Terraform):**
```bash
[comando exacto]
```

**Alternativa Terraform:**
```hcl
[configuracion terraform]
```
```

### 3. Este Agente es de FRONTEND

Mi responsabilidad es el codigo en `/frontend`:
- React, TypeScript, Tailwind CSS
- Servicios, hooks, componentes
- Configuracion de Vite, ESLint, etc.

---

## Vision del Producto

**Filosofia:** Hacer facil al usuario lo que Looker hace dificil, con soporte semantico robusto y arquitectura GCP solida.

### Ventajas Competitivas de DataMetricX

| Area | Looker | DataMetricX |
|------|--------|-------------|
| Curva de aprendizaje | LookML requiere codigo | UI visual completa |
| Velocidad de valor | Semanas de setup | Minutos con VizBuilder |
| Multi-tenancy | Configuracion manual | Nativo desde dia 1 |
| Costos | Pricing opaco y alto | Arquitectura GCP optimizada |
| PoP dinamico | Requiere LookML | Desde UI (en progreso) |

### Gaps Criticos a Cerrar

| Feature | Descripcion | Prioridad |
|---------|-------------|-----------|
| **PoP Backend (CTEs)** | Mover logica de comparacion a BigQuery | CRITICA |
| **Symmetric Aggregation** | Evitar duplicacion en JOINs 1:N | CRITICA |
| **Aggregate Awareness** | Enrutar a tablas pre-agregadas | CRITICA |
| **Cross-filtering** | Click en grafico filtra otros | ALTA |
| **Drill-down** | Click en valor muestra detalle | ALTA |

### Documentacion Estrategica

- `docs/competitors/LOOKER_ANALYSIS.md` - Analisis detallado de Looker
- `docs/DATAMETRICX_VS_LOOKER.md` - Comparacion completa y roadmap

---

## Estado Actual del Proyecto

### Problema Activo: Error 401 en Development

**Fecha:** 2024-12-07

**Descripcion:**
Al acceder a la pagina de Development en localhost:5173, hay errores 401 Unauthorized al llamar a `/api/semantic/models/tree`.

**Causa raiz:**
La cuenta de gcloud (`martin.velez@ravencorex.com`) no tiene el rol `Cloud Run Invoker` para el servicio `datametricx-backend-api`.

**Diagnostico completado:**
- El proxy de Vite esta configurado correctamente
- Los tokens IAM y Firebase se envian correctamente
- El backend de Cloud Run rechaza las llamadas por falta de permisos IAM

**Cambio requerido para el agente de Terraform:**

```bash
gcloud run services add-iam-policy-binding datametricx-backend-api \
  --region=us-central1 \
  --member="user:martin.velez@ravencorex.com" \
  --role="roles/run.invoker" \
  --project=datametricx-prod
```

**Estado:** Pendiente - esperando que el usuario aplique el cambio

---

## Arquitectura Relevante

### Frontend en Desarrollo

```
localhost:5173 (Vite)
    |
    | Proxy /api/* --> Cloud Run
    |
    v
https://datametricx-backend-api-jrzfm3jccq-uc.a.run.app
```

El proxy de Vite (`vite.config.ts`) hace:
1. Obtiene token IAM de `gcloud auth print-identity-token`
2. Envia el token en header `Authorization: Bearer {IAM_TOKEN}`
3. Envia el token de Firebase en header `X-Firebase-Auth`

### Servicios Clave

| Archivo | Descripcion |
|---------|-------------|
| `src/services/semanticService.ts` | API client para la capa semantica |
| `src/pages/Development.tsx` | IDE para editar entities/datasets |
| `src/config/firebase.ts` | Configuracion de Firebase |
| `vite.config.ts` | Proxy para desarrollo |

---

## Historial de Trabajo

### 2024-12-07: Sesion actual

1. Usuario intento ejecutar `pnpm dev` desde raiz - error porque el script esta en `/frontend`
2. Iniciamos el servidor de desarrollo desde `/frontend`
3. Detectamos error 401 al acceder a Development
4. Diagnosticamos que falta permiso Cloud Run Invoker
5. Documentamos el cambio requerido para Terraform

---

## Comandos Utiles

### Desarrollo Frontend

```bash
# Iniciar servidor de desarrollo
cd frontend && pnpm dev

# Build de produccion
cd frontend && pnpm build

# Type check
cd frontend && npx tsc --noEmit
```

### Diagnostico

```bash
# Verificar cuenta activa
gcloud auth list

# Verificar proyecto
gcloud config get-value project

# Obtener token IAM (para pruebas)
gcloud auth print-identity-token
```

---

## Sistema de Visualizaciones (Viz)

### Descripcion

Sistema para guardar y gestionar visualizaciones creadas en DatasetsNew. Permite a los usuarios guardar configuraciones de graficos con sus filtros, metricas y atributos seleccionados.

### Estructura de Datos en Firestore

```
tenants/{tenantId}/
├── vizs/{vizId}           # Visualizaciones guardadas
│   ├── id: string
│   ├── tenantId: string
│   ├── name: string
│   ├── description: string | null
│   ├── folderId: string | null  # null = raiz
│   ├── config: VizConfig        # Configuracion completa
│   ├── createdAt: Timestamp
│   ├── createdBy: string (uid)
│   ├── updatedAt: Timestamp
│   ├── updatedBy: string (uid)
│   ├── isPublic: boolean
│   └── publicToken: string | null
│
└── viz_folders/{folderId}  # Carpetas para organizar vizs
    ├── id: string
    ├── tenantId: string
    ├── name: string
    ├── parentId: string | null  # null = raiz
    ├── createdAt: Timestamp
    ├── createdBy: string (uid)
    └── updatedAt: Timestamp
```

### VizConfig (Configuracion de Visualizacion)

```typescript
interface VizConfig {
  datasetId: string
  selectedAttributes: SelectedField[]
  selectedMetrics: SelectedField[]
  filters: MetricFilter[]
  orderBy: OrderByConfig[]
  rowLimit: number
  vizType: 'line' | 'column' | 'area' | 'pie' | 'single' | 'progress'
  chartSettings: ChartSettings
  colorScheme: string
  customColors?: string[]
  chartRowLimit?: number
  xAxisFormat?: XAxisFormatConfig
}
```

### Archivos Clave

| Archivo | Descripcion |
|---------|-------------|
| `src/types/viz.ts` | Tipos TypeScript para Viz, Folder, Config |
| `src/services/vizService.ts` | CRUD de Firestore para vizs y folders |
| `src/pages/DatasetsNew.tsx` | UI del modal de guardado |
| `firestore.rules` | Reglas de seguridad para vizs y viz_folders |

### Reglas de Firestore

Las colecciones `vizs` y `viz_folders` requieren:
- **Lectura**: Ser miembro del tenant (`isTenantMember`)
- **Escritura**: Ser miembro del tenant (`isTenantMember`)

### UI del Explorador de Carpetas

- **Un clic**: Selecciona carpeta como destino
- **Doble clic**: Expande/colapsa carpeta (si tiene subcarpetas)
- **Icono +**: Crea nueva carpeta dentro de la seleccionada
- **Chevron >**: Indica que la carpeta tiene contenido

### Tipos de Visualizacion Soportados

1. **line**: Grafico de lineas
2. **column**: Grafico de barras/columnas
3. **area**: Grafico de area
4. **pie**: Grafico de pastel/dona
5. **single**: Valor unico (KPI)
6. **progress**: Barra de progreso

---

## Historial de Trabajo

### 2024-12-11: Sistema de Visualizaciones (Viz)

**Funcionalidades implementadas:**

1. **Tipos TypeScript** (`src/types/viz.ts`)
   - VizDocument, FolderDocument, DashboardDocument
   - VizConfig con todas las opciones de configuracion
   - ChartSettings discriminado por tipo de grafico
   - Tipos para Single Value y Progress Bar

2. **Servicio Firestore** (`src/services/vizService.ts`)
   - CRUD completo para vizs: createViz, getViz, updateViz, deleteViz, listVizs
   - CRUD para folders: createFolder, getFolder, updateFolder, deleteFolder, listFolders
   - Arbol de navegacion: getVizTree
   - Acceso publico: togglePublicAccess, getVizByPublicToken

3. **UI de Guardado** (en DatasetsNew.tsx)
   - Menu de configuracion (icono engranaje) junto al boton Run
   - Modal de guardado con nombre, descripcion y explorador de carpetas
   - Explorador de carpetas con expand/collapse en doble clic
   - Creacion de carpetas inline (Enter para guardar, Escape para cancelar)
   - Soporte para 3 niveles de anidacion de carpetas

4. **Reglas de Firestore** (firestore.rules)
   - Agregadas reglas para `vizs` y `viz_folders`
   - Permisos basados en membresia del tenant

**Fixes aplicados:**
- Corregido error de tipos en `textAnchor` de widgets de graficos
- Eliminada funcion `SemanticHighlight` no utilizada en Development.tsx
- Corregido cast de tipos en `dslToJson`

### 2024-12-07: Sesion inicial

1. Usuario intento ejecutar `pnpm dev` desde raiz - error porque el script esta en `/frontend`
2. Iniciamos el servidor de desarrollo desde `/frontend`
3. Detectamos error 401 al acceder a Development
4. Diagnosticamos que falta permiso Cloud Run Invoker
5. Documentamos el cambio requerido para Terraform

---

## Sistema de Dashboards

### Descripcion

Editor visual de dashboards que permite crear y organizar visualizaciones en un canvas con drag & drop. Los dashboards se guardan en Firestore y pueden contener multiples elementos de visualizacion.

### Estructura de Datos en Firestore

```
tenants/{tenantId}/
├── dashboards/{dashboardId}
│   ├── id: string
│   ├── tenantId: string
│   ├── name: string
│   ├── description: string | null
│   ├── folderId: string | null
│   ├── config: DashboardConfig
│   ├── createdAt: Timestamp
│   ├── createdBy: string (uid)
│   ├── updatedAt: Timestamp
│   ├── updatedBy: string (uid)
│   ├── isPublic: boolean
│   └── publicToken: string | null
│
└── dashboard_folders/{folderId}
    ├── id: string
    ├── tenantId: string
    ├── name: string
    ├── parentId: string | null
    ├── createdAt: Timestamp
    ├── createdBy: string (uid)
    └── updatedAt: Timestamp
```

### DashboardConfig

```typescript
interface DashboardConfig {
  layout: {
    columns: number      // Grid columns (12)
    rowHeight: number    // Base row height (50px)
    gap: number          // Gap between elements (16px)
    padding: number      // Dashboard padding (24px)
  }
  theme: {
    backgroundColor: string
    fontFamily: string
    primaryColor: string
  }
  globalFilters?: MetricFilter[]
  elements: DashboardElement[]
  variables?: Variable[]
}
```

### Tipos de Elementos

1. **VisualizationElement**: Graficos (line, column, area, pie, single, progress)
2. **TextElement**: Texto enriquecido
3. **ImageElement**: Imagenes
4. **MenuElement**: Navegacion
5. **ButtonElement**: Acciones
6. **FilterElement**: Filtros interactivos

### Archivos Clave

| Archivo | Descripcion |
|---------|-------------|
| `src/pages/DashboardEditor.tsx` | Editor principal de dashboards |
| `src/services/dashboardService.ts` | CRUD Firestore para dashboards |
| `src/types/viz.ts` | Tipos para Dashboard, Elements, Config |

### Funcionalidades Implementadas (2024-12-12)

#### Editor de Dashboard (`DashboardEditor.tsx`)

1. **Canvas con Grid 25x25px**
   - Grid visual de puntos para alineacion
   - Snap automático al grid al mover/redimensionar

2. **Drag & Drop de Elementos**
   - Arrastre libre con `cursor-grab`/`cursor-grabbing`
   - Desplazamiento automatico de elementos colisionantes
   - Efecto cascada cuando un elemento empuja a otros

3. **Redimensionamiento**
   - 8 handles de redimensionamiento (esquinas + lados)
   - Minimo 1 celda de grid (25px)

4. **Elementos de Visualizacion**
   - Integracion con VizBuilder para crear/editar graficos
   - Titulo editable con alineacion (izquierda/centro/derecha)
   - Toggle de visibilidad del titulo
   - Menu de opciones por elemento (editar, duplicar, eliminar)

5. **Renderizado de Graficos**
   - Line, Column, Area, Pie charts con Recharts
   - Single Value centrado con padding simetrico
   - Progress Bar
   - Formateo de ejes Y (auto, compact K/M/B, percent, currency)
   - Estilos de punto configurables
   - Leyenda con texto negro

6. **Modal de Guardado**
   - Nombre (requerido)
   - Descripcion (opcional)
   - Selector de carpeta
   - Limpieza de `_runtimeData` antes de guardar

7. **Estilos de Contenedor**
   - `rounded-xl` border radius
   - `shadow-md` sombra suave
   - Padding adaptativo segun tipo de viz
   - Tamaño por defecto: 625x400 (25x16 celdas)

### Integracion VizBuilder-Dashboard

#### Flujo de Datos

```
DashboardEditor
    │
    ├── showVizModal = true
    │       │
    │       └── DatasetsNew (embedded mode)
    │               │
    │               └── VizBuilder
    │                       │
    │                       ├── Seleccion de campos
    │                       ├── Ejecucion de query
    │                       ├── Configuracion de viz
    │                       │
    │                       └── dispatch 'dashboard-viz-ready' event
    │                               │
    │                               └── DashboardVizData
    │
    └── handleAddVisualization()
            │
            ├── Crea VisualizationElement
            ├── Guarda embeddedConfig (VizConfig)
            └── Almacena _runtimeData (temporal)
```

#### DashboardVizData (Interface)

```typescript
interface DashboardVizData {
  datasetId: string
  datasetLabel: string
  vizType: VizType
  chartData: Record<string, unknown>[]
  selectedMetrics: SelectedField[]
  selectedAttributes: SelectedField[]
  seriesConfig: Record<string, SeriesConfig>
  chartSettings: {
    showDataLabels: boolean
    showXGridLines: boolean
    showYGridLines: boolean
    pointStyle?: string
    pieInnerRadius?: number
    yAxisFormatType?: YAxisFormatType
  }
  filters: MetricFilter[]
  embeddedConfig: VizConfig
  singleValueSettings?: SingleValueSettings
}
```

#### Edicion de Visualizaciones Existentes

1. Usuario hace clic en "Editar" en el menu del elemento
2. `handleEditVisualization()` extrae `embeddedConfig` del elemento
3. Abre modal con `initialVizConfig` pasado a DatasetsNew
4. DatasetsNew pasa `initialConfig` a VizBuilder
5. VizBuilder aplica la configuracion:
   - Campos seleccionados (VizBuilder useEffect)
   - vizType y chart settings (DataExplorerPanel useEffect)
6. El query se ejecuta automaticamente (`autoRunPending`)
7. El grafico se muestra con la configuracion restaurada

### Historial de Trabajo 2024-12-12

**Sesion actual - Dashboard Editor:**

1. **Grid 25x25px**: Cambiado de grid anterior a 25px para mejor alineacion

2. **Centrado de graficos**:
   - Contenedor flex con `items-center justify-center`
   - Padding asimetrico para charts con ejes
   - Padding simetrico (`p-4`) para single/progress

3. **Tamaño por defecto aumentado**: 625x400 (antes 400x300)

4. **Estilos de contenedor mejorados**:
   - `rounded-xl` (antes `rounded-lg`)
   - `shadow-md` (antes shadow custom)
   - Border `border-gray-200` (antes `border-gray-300`)

5. **Formateo de eje Y**:
   - Agregado `yAxisFormatType` a DashboardVizData
   - Funcion `formatYAxisValue()` para compact K/M/B

6. **Estilos de punto y leyenda**:
   - Props `dot` y `activeDot` en Area chart
   - Leyenda con `formatter` para texto negro `#374151`

7. **Padding del contenedor**:
   - `pl-2 pr-10 pb-4` para charts
   - `pt-2` con titulo, `pt-8` sin titulo
   - `p-4` simetrico para single/progress

8. **Desplazamiento automatico de elementos**:
   - Funcion `checkCollision()` para detectar superposicion
   - Funcion `displaceOverlappingElements()` con efecto cascada
   - Limite de 50 iteraciones para prevenir loops

9. **Edicion de visualizaciones**:
   - Corregido error `setVizType not found` (estaba fuera de scope)
   - Agregado `initialConfig` como prop de DataExplorerPanel
   - useEffect en DataExplorerPanel para aplicar vizType y settings
   - Ref para rastrear config aplicada y evitar re-aplicaciones

10. **Modal de guardado**:
    - Nuevo estado: `showSaveModal`, `saveName`, `saveDescription`, `saveFolderId`
    - Funcion `openSaveModal()` inicializa valores
    - Modal con nombre, descripcion y selector de carpeta
    - Limpieza de `_runtimeData` antes de guardar en Firestore

---

### Historial de Trabajo 2024-12-14

**Sesion actual - Mejoras de UI:**

1. **Tabla en Dashboard**: Agregado `case 'table':` en `renderChart()` de DashboardEditor.tsx para mostrar visualizaciones de tipo tabla.

2. **Mejoras de tabla**:
   - Tabla ocupa ancho completo del contenedor
   - Scroll cuando la tabla excede el contenedor
   - Redimensionamiento de columnas en VizBuilder
   - Opciones de formato de header (fondo: blanco/gris/negro, alineacion: izquierda/centro/derecha)
   - Tab "Formato" dedicado para configuracion de tabla

3. **Tooltips en Explorar**: Agregado tooltip con descripcion al pasar mouse sobre datasets en el sidebar.

4. **VizBuilder hideDatasetInfo**: Nueva prop para ocultar titulo y descripcion del dataset cuando se muestra en seccion Explorar (evita duplicacion con sidebar).

5. **Nombres de propietario en Carpetas**: En `Visualizations.tsx`, el propietario ahora muestra el nombre del usuario (displayName) en lugar del ID de Firebase.
   - Agregado estado `userNames` para mapear IDs a nombres
   - Carga perfiles de usuario con `getUserProfile` del userService
   - Modificados `VizListItem` y `DashboardListItem` para usar el mapa de nombres

**Archivos modificados:**
- `src/pages/DashboardEditor.tsx` - Render de tabla
- `src/components/viz/VizBuilder.tsx` - Opciones de formato de tabla, hideDatasetInfo prop, logs de debug
- `src/components/layout/Sidebar.tsx` - Tooltip de datasets
- `src/pages/DatasetsNew.tsx` - hideDatasetInfo prop
- `src/pages/Visualizations.tsx` - Mostrar nombre de propietario

---

## TAREA PENDIENTE: Campos faltantes en Dataset sin fields definidos

**Fecha:** 2024-12-14

**Problema:**
El dataset `ds_meta_accounts` no define campos explicitamente (`fields` esta vacio o no definido), por lo que deberia mostrar TODOS los campos de las entities que usa. Sin embargo, faltan campos como:
- `account_name`
- `timezone_offset_hours_utc`
- `business_name`

El usuario confirma que estos campos ESTAN en la entity `meta_accounts` pero NO se muestran en el VizBuilder.

**Estado de la investigacion:**

1. **Logica de filtrado de campos** (`VizBuilder.tsx` linea 5827-5892):
   - Si `dataset.fields` esta vacio/undefined, `hasFieldsFilter = false`
   - Con `hasFieldsFilter = false`, deberia incluir TODOS los atributos y metricas de las entities
   - La logica parece correcta

2. **Carga de entities** (`DatasetsNew.tsx` linea 251-302):
   - Carga entities basado en `selectedDataset.base_entity` y `relationships`
   - Para `ds_meta_accounts`, carga `meta_accounts` entity

3. **DEBUG agregado** (`VizBuilder.tsx` linea 5836-5850):
   ```typescript
   console.log('🔍 [VizBuilder] Building fields from entities:', {
     entitiesCount: entities.size,
     entityIds: Array.from(entities.keys()),
     datasetFields: datasetFieldIds,
     hasFieldsFilter
   })
   entities.forEach((entity, entityId) => {
     console.log(`  📦 Entity "${entityId}":`, {
       label: entity.label,
       attributesCount: entity.attributes?.length || 0,
       metricsCount: entity.metrics?.length || 0,
       attributeIds: entity.attributes?.map(a => a.id) || []
     })
   })
   ```

**Proximos pasos para diagnosticar:**
1. Abrir consola del navegador (F12 -> Console)
2. Seleccionar el dataset `ds_meta_accounts` en Explorar
3. Verificar los logs que muestran:
   - Cuantas entities se cargaron
   - Que atributos tiene cada entity
   - Si `hasFieldsFilter` es false (deberia ser)
4. Comparar los atributos logueados con los que se muestran en la UI

**Posibles causas:**
1. La entity `meta_accounts` en el backend no tiene todos los campos
2. Algun campo tiene `hidden: true` en la entity
3. Hay un bug en como se cargan los datos de la entity desde el backend

**NOTA:** Los logs de debug estan activos en produccion. Remover despues de diagnosticar.

---

## Sistema de Core Dashboards

### Descripcion

Dashboards creados por DataMetricX que son visibles para TODOS los tenants como templates. Los core dashboards se almacenan en colecciones root-level (no dentro de ningun tenant) y aparecen en una carpeta virtual "Main Dashboards" en todos los tenants.

### Arquitectura

```
Firestore (root level):
├── core_dashboards/{dashboardId}     # Dashboards globales
│   ├── id: string
│   ├── name: string
│   ├── description: string | null
│   ├── folderId: string | null       # Para organizar dentro de core
│   ├── config: DashboardConfig       # Misma estructura que dashboards normales
│   ├── createdAt: Timestamp
│   ├── createdBy: string (uid)
│   ├── updatedAt: Timestamp
│   ├── updatedBy: string (uid)
│   └── isCore: true                  # Flag para identificar
│
└── core_dashboard_folders/{folderId} # Carpetas para organizar core dashboards
    ├── id: string
    ├── name: string
    ├── parentId: string | null
    ├── createdAt: Timestamp
    └── createdBy: string (uid)
```

### Reglas de Seguridad

**Firestore Rules (firestore.rules):**
- **Lectura**: Cualquier usuario autenticado puede leer `core_dashboards` y `core_dashboard_folders`
- **Escritura**: BLOQUEADA para todos los clientes. Solo via Firebase Admin SDK en backend

```javascript
match /core_dashboards/{dashboardId} {
  allow read: if request.auth != null;
  allow write: if false; // Solo Admin SDK
}
match /core_dashboard_folders/{folderId} {
  allow read: if request.auth != null;
  allow write: if false; // Solo Admin SDK
}
```

### Endpoints del Backend

| Metodo | Endpoint | Descripcion | Permisos |
|--------|----------|-------------|----------|
| POST | `/api/core-dashboards` | Copiar dashboard de tenant a core | SysOwner |
| DELETE | `/api/core-dashboards/:id` | Eliminar dashboard de core | SysOwner |
| GET | `/api/core-dashboards` | Listar core dashboards | Autenticado |
| POST | `/api/core-dashboard-folders` | Crear carpeta en core | SysOwner |
| DELETE | `/api/core-dashboard-folders/:id` | Eliminar carpeta de core | SysOwner |

### Archivos Clave

| Archivo | Descripcion |
|---------|-------------|
| `src/services/dashboardService.ts` | Funciones `getCoreDashboard`, `listCoreDashboards`, `listCoreFolders` |
| `src/services/coreDashboardAdminService.ts` | API calls al backend para admin (SysOwner) |
| `src/services/vizService.ts` | `getVizTreeWithCore()` - combina tree de tenant con core |
| `src/pages/Visualizations.tsx` | UI para publicar/quitar de core, carpeta Main Dashboards |
| `src/pages/DashboardEditor.tsx` | Carga dashboards de core cuando `isCore=true` en URL |

### Flujo de Navegacion

```
Visualizations.tsx
    │
    ├── getVizTreeWithCore(tenantId)
    │       │
    │       ├── getVizTree(tenantId)         # Vizs y dashboards del tenant
    │       │
    │       └── getCoreTree()                 # Core dashboards
    │               │
    │               └── Wraps in virtual folder "Main Dashboards"
    │
    └── handleSelectDashboard(id, isCore)
            │
            └── navigate(`/dashboard-editor?id=${id}&isCore=true`)
                    │
                    └── DashboardEditor.tsx
                            │
                            ├── isCoreDashboard = searchParams.get('isCore') === 'true'
                            │
                            └── loadDashboard()
                                    │
                                    ├── if isCoreDashboard:
                                    │       getCoreDashboard(dashboardId)
                                    │
                                    └── else:
                                            getDashboard(tenantId, dashboardId)
```

### Carpeta Virtual "Main Dashboards"

- **ID Constante**: `__main_dashboards__` (definido en `vizService.ts`)
- **Solo existe en frontend**: No se guarda en Firestore
- **Read-only para usuarios normales**: No se puede renombrar ni eliminar
- **Editable por SysOwner/SysAdmin**: Pueden agregar/quitar dashboards

### Funcionalidades Implementadas

1. **Lectura de Core Dashboards**
   - `getCoreDashboard(dashboardId)`: Lee un dashboard de `core_dashboards`
   - `listCoreDashboards()`: Lista todos los core dashboards
   - `listCoreFolders()`: Lista carpetas de core

2. **Carpeta Main Dashboards**
   - Aparece automaticamente si hay core dashboards
   - Contiene todos los core dashboards y carpetas
   - Flag `isCore: true` en cada item

3. **Navegacion a Core Dashboards**
   - URL incluye `?isCore=true` para identificar
   - DashboardEditor lee de la coleccion correcta

4. **Publicar/Quitar de Core (SysOwner)**
   - Menu contextual en dashboards de tenant: "Publicar como Core"
   - Menu contextual en dashboards de core: "Quitar de Core"
   - Usa `coreDashboardAdminService.ts` para llamar al backend

### Scripts de Utilidad

```bash
# Copiar dashboards de un tenant a core_dashboards
node scripts/copy-dashboards-to-core.js

# Debug: Ver estructura de dashboards en un tenant
node scripts/debug-dashboards.js
```

### Historial de Trabajo 2024-12-16

**Sesion actual - Core Dashboards:**

1. **Backend desplegado** con endpoints para core-dashboards y core-dashboard-folders

2. **Servicio admin creado** (`coreDashboardAdminService.ts`):
   - `copyDashboardToCore()`: Copia dashboard de tenant a core
   - `deleteCoreDashboard()`: Elimina dashboard de core

3. **Carpeta Main Dashboards**:
   - Implementada en `vizService.ts` con `getVizTreeWithCore()`
   - Carpeta virtual con ID `__main_dashboards__`
   - Componentes actualizados para no permitir editar la carpeta virtual

4. **Permisos Firestore desplegados**:
   - Reglas para `core_dashboards` y `core_dashboard_folders`
   - Lectura publica, escritura bloqueada

5. **Scripts de migracion**:
   - `copy-dashboards-to-core.js`: Copia dashboards completos (incluye config.elements)
   - `debug-dashboards.js`: Diagnostico de estructura de dashboards
   - Descubierto que 2 de 3 dashboards estaban vacios (sin elements)

6. **Fix de navegacion a core dashboards**:
   - Agregado parametro `isCore=true` en URL al hacer clic
   - DashboardEditor actualizado para leer de `core_dashboards` cuando `isCore=true`
   - Importado `getCoreDashboard` en DashboardEditor
   - Agregado estado `isCoreDashboard` desde URL query params
   - Modificado `loadDashboard()` para usar `getCoreDashboard()` o `getDashboard()`

**Estado:** FUNCIONANDO - Core dashboards se muestran correctamente con titulo y elementos

---

## ROADMAP: Dataset Builder para Clientes

**Fecha:** 2024-12-17
**Estado:** PENDIENTE - Documentado para implementar despues del primer set de dashboards

### Contexto

Actualmente las entities y datasets se definen en YAML y solo el equipo interno puede crearlos/modificarlos. Los clientes dependen de nosotros para crear nuevos datasets.

### Objetivo

Permitir a los clientes crear sus propios datasets mediante una UI, sin exponer la complejidad tecnica de la capa semantica.

### Arquitectura Propuesta

```
INTERNO (equipo)               CLIENTES
      |                            |
      v                            v
   YAML                      UI Dataset Builder
entities/*.yaml              +------------------+
datasets/*.yaml              | Basico | Avanzado|
      |                      +--------+---------+
      |                               |
      v                               v
   Backend                    Firestore
(capa semantica)           tenant_datasets/{id}
      |                               |
      +---------------+---------------+
                      v
                VizBuilder
             (consume ambos)
```

### Dos Modos de Creacion

#### Modo Basico (Wizard Guiado)

**Para:** Usuarios de negocio, marketing, operaciones
**UX:** Wizard paso a paso, solo opciones validadas

```
Paso 1: "Que quieres analizar?"
        [Campanas Meta] [Pedidos Shopify] [Sesiones GA4]

Paso 2: "Que informacion adicional necesitas?"
        [x] Datos de Adsets
        [x] Datos de Ads
        [ ] Datos de Cuenta

Paso 3: "Selecciona los campos"
        [Lista de campos disponibles de las entities seleccionadas]

Paso 4: "Nombra tu dataset"
        [Mi analisis de campanas______]
```

**Caracteristicas:**
- Relaciones pre-definidas (solo JOINs validados por nosotros)
- Campos sugeridos por categoria
- Filtros simples
- Metricas pre-calculadas
- Sin aggregations custom
- JOIN implicito (el usuario no ve la complejidad)

#### Modo Avanzado

**Para:** Usuarios power, analistas
**UX:** Mas control, pero guiado

**Caracteristicas adicionales:**
- Relaciones custom (con guia y validacion)
- Todos los campos disponibles
- Filtros con logica AND/OR
- Metricas custom (formulas/expresiones)
- Aggregations: SUM, AVG, COUNT, etc.
- Tipo de JOIN visible (LEFT, INNER)
- Campos calculados
- Renombrar campos

### Estructura de Datos

#### Relaciones Pre-definidas (para modo basico)

```yaml
# Podria vivir en: semantic/relationships.yaml
entity_relationships:
  meta_campaigns:
    allowed_joins:
      - entity: meta_adsets
        relation: one_to_many
        join_key: campaign_id
      - entity: meta_accounts
        relation: many_to_one
        join_key: account_id

  shopify_orders:
    allowed_joins:
      - entity: shopify_customers
        relation: many_to_one
        join_key: customer_id
      - entity: shopify_line_items
        relation: one_to_many
        join_key: order_id
```

#### Dataset Generado (guardado en Firestore)

```json
{
  "id": "custom_ds_abc123",
  "tenantId": "tenant_xyz",
  "type": "dataset",
  "label": "Mi reporte de campanas",
  "base_entity": "meta_campaigns",
  "relationships": [
    {
      "entity": "meta_adsets",
      "type": "left",
      "on": "campaign_id"
    }
  ],
  "fields": ["campaign_name", "spend", "impressions"],
  "metrics": [
    {
      "id": "custom_roas",
      "label": "ROAS",
      "expression": "revenue / spend"
    }
  ],
  "createdBy": "user_123",
  "createdAt": "2024-12-17T..."
}
```

### Custom Calculations (Metricas Calculadas)

Los usuarios podran crear metricas calculadas usando expresiones:

```
ROAS = revenue / spend
CPA = spend / conversions
Margen = (revenue - cost) / revenue * 100
```

**Pendiente definir:**
- Sintaxis de expresiones
- Funciones disponibles (IF, CASE, aggregations)
- Validacion de expresiones
- Preview de resultados

### Integracion con VizBuilder

El VizBuilder debe consumir datasets de ambas fuentes:

1. **Datasets YAML** (internos) - Se cargan via API semantica
2. **Datasets Firestore** (clientes) - Se cargan via Firestore

El selector de datasets en VizBuilder mostrara ambos, posiblemente con indicadores:
- [Sistema] Performance de Campanas
- [Custom] Mi reporte personalizado

### Proximos Pasos

1. [ ] Terminar primer set de dashboards (prioridad actual)
2. [ ] Definir estructura de `entity_relationships`
3. [ ] Implementar UI Modo Basico
4. [ ] Integrar datasets custom en VizBuilder
5. [ ] Implementar UI Modo Avanzado
6. [ ] Agregar Custom Calculations

---

## Sistema de Comparacion Period over Period (PoP)

### Descripcion

Sistema de comparacion de periodos estilo Looker que permite comparar metricas entre un periodo actual y un periodo anterior. La comparacion se hace **dia por dia** basado en un offset de tiempo.

### Como Funciona

1. **Usuario selecciona un filtro de fecha** (ej: "Ultimos 7 dias")
2. **Usuario selecciona tipo de comparacion** (ej: "vs Periodo anterior")
3. **Sistema calcula los rangos**:
   - Periodo actual: 11-dic-2025 a 17-dic-2025
   - Periodo anterior: 04-dic-2025 a 10-dic-2025
4. **Match por offset**: Cada fecha del periodo actual se compara con la fecha correspondiente del periodo anterior
   - 17-dic-2025 vs 10-dic-2025 (offset -7 dias)
   - 16-dic-2025 vs 09-dic-2025
   - etc.

### Tipos de Comparacion

| Tipo | Descripcion |
|------|-------------|
| `same_point` | Mismo punto del periodo anterior (dia por dia) |
| `full_previous` | Periodo anterior completo |
| `same_point_yoy` | Mismo punto del año anterior |
| `full_previous_yoy` | Año anterior completo |
| `custom` | Rango de fechas personalizado |

### Variantes de Metricas

| Variante | Sufijo | Descripcion |
|----------|--------|-------------|
| `current` | `_current` | Valor del periodo actual |
| `previous` | `_previous` | Valor del periodo anterior |
| `delta` | `_delta` | Diferencia absoluta (actual - anterior) |
| `delta_pct` | `_delta_pct` | Variacion porcentual |

### Columna de Fecha de Comparacion

Cuando se activa la comparacion, se agrega automaticamente una columna "Fecha Comparacion" que muestra la fecha del periodo anterior correspondiente a cada fila.

**Ejemplo de tabla con PoP:**

| Fecha | Fecha Comparacion | Impresiones | Impresiones (Anterior) | Δ% |
|-------|-------------------|-------------|------------------------|-----|
| 2025-12-17 | 2025-12-10 | 124,482 | 150,000 | -17% |
| 2025-12-16 | 2025-12-09 | 142,452 | 138,000 | +3.2% |
| 2025-12-15 | 2025-12-08 | 164,737 | 160,000 | +2.9% |

### Archivos Clave

| Archivo | Descripcion |
|---------|-------------|
| `src/services/comparisonService.ts` | Logica de ejecucion de queries y merge de datos |
| `src/utils/comparisonDateUtils.ts` | Calculo de rangos de fechas y offsets |
| `src/types/comparison.ts` | Tipos TypeScript para configuracion y resultados |
| `src/components/viz/VizBuilder.tsx` | UI para seleccionar variantes y mostrar resultados |

### Flujo de Datos

```
VizBuilder
    │
    ├── Usuario selecciona metrica variante (ej: "Valor anterior")
    │       │
    │       └── Se agrega a selectedFields: "entity.metric_previous"
    │
    ├── handleRun()
    │       │
    │       ├── Detecta variantMetrics (metricas con sufijo _previous, _delta, etc.)
    │       │
    │       ├── Auto-detecta dateFieldId del filtro de fecha activo
    │       │
    │       └── Llama executeComparisonQuery()
    │
    └── executeComparisonQuery()
            │
            ├── Calcula rangos de fechas (actual y anterior)
            │
            ├── Ejecuta 2 queries en paralelo
            │
            └── mergeComparisonData()
                    │
                    ├── Calcula offset en dias entre periodos
                    │
                    ├── Crea lookup por fecha+offset
                    │
                    └── Merge dia por dia con calculo de deltas
```

### Comportamiento de UI

1. **Mostrar opciones de variantes**: Las opciones (Anterior, Δ, Δ%) solo aparecen si:
   - Hay un filtro de fecha con operador relativo (`last_7_days`, `this_month`, etc.)
   - O hay un filtro con operador `between` con fechas validas

2. **Columnas inmediatas**: Al seleccionar una variante, la columna aparece inmediatamente (vacia) en la tabla

3. **Limpieza automatica**: Al seleccionar "Sin comparar", todas las variantes seleccionadas se eliminan automaticamente

### Logs de Debug

```javascript
📊 [PoP] Merge config: { dateFieldId, currentRange, previousRange, offsetDays }
📊 [PoP] Previous row mapping: { previousDate, correspondingCurrentDate, key }
📊 [PoP] Current row merge: { currentDate, comparisonDate, foundPrevious }
```

---

### Historial de Trabajo 2024-12-19

**Sesion actual - Period over Period (PoP):**

1. **Corregido bug de variantes con filtro `between`**:
   - `hasDateFilterForComparison` ahora detecta filtros `between` con valores validos
   - Auto-deteccion de campo de fecha incluye operador `between`

2. **Columnas de variantes inmediatas**:
   - Al seleccionar una variante, la columna aparece inmediatamente (vacia)
   - Se llena cuando se ejecuta la query
   - Modificado `orderedColumns` en VizBuilder.tsx

3. **Limpieza automatica de variantes**:
   - Al seleccionar "Sin comparar" o quitar filtro de fecha, las variantes se eliminan
   - Agregado `useEffect` que monitorea `comparisonConfig.type` y `hasDateFilterForComparison`

4. **Implementado PoP estilo Looker**:
   - Match por offset de dias (no por valor de fecha)
   - Agregada columna "Fecha Comparacion" que muestra la fecha del periodo anterior
   - Reescrita funcion `mergeComparisonData` en comparisonService.ts

5. **Mapeo correcto de campo de fecha**:
   - Detecta si el atributo de fecha tiene timeframe (ej: `date_time_date`)
   - Pasa el campo correcto al servicio de comparacion

**Archivos modificados:**
- `src/services/comparisonService.ts` - Nueva logica de merge PoP
- `src/components/viz/VizBuilder.tsx` - UI de variantes, columnas, limpieza

---

### Historial de Trabajo 2024-12-22

**Sesion actual - Especificacion PoP Backend:**

Se decidio que el approach de PoP en frontend (2 queries + merge) no es robusto. Se documento la especificacion para implementar PoP a nivel de backend con CTEs, similar a como lo hace Looker.

**Documentacion creada:**
- `frontend/docs/PERIOD_OVER_PERIOD_SPEC.md` - Seccion 10: Implementacion Backend con CTEs

**Resumen de la especificacion:**

1. **Problema identificado**: El merge en frontend tiene problemas con offset de fechas, meses de diferente longitud, y edge cases

2. **Solucion propuesta**: Backend genera una sola query SQL con CTEs que hace el merge en BigQuery

3. **Cambios en QueryRequest**:
```typescript
interface QueryRequest {
  // ... campos existentes
  comparison?: {
    enabled: boolean
    type: ComparisonType
    dateField: string
    variants: MetricVariant[]
    customRange?: { startDate: string; endDate: string }
  }
}
```

4. **SQL generado**: CTEs `current_period` y `previous_period` con LEFT JOIN por atributos + fecha con offset aplicado

5. **Columnas generadas**: `{metric}_current`, `{metric}_previous`, `{metric}_delta`, `{metric}_delta_pct`

6. **Beneficios**:
   - 1 round trip (vs 2)
   - Merge en BigQuery (optimizado)
   - Manejo de NULLs con COALESCE
   - Manejo de division por cero con SAFE_DIVIDE

**Estado:** Especificacion lista para implementar en backend

---

## Documentacion Relacionada

- `ARCHITECTURE.md` - Arquitectura general del sistema
- `BACKEND_SYNC_HISTORY.md` - Sistema de historial de sincronizaciones
- `docs/SEMANTIC_LAYER.md` - Especificacion de la capa semantica
- `docs/DEVELOPMENT_FEATURES.md` - Funcionalidades del IDE Development
- `docs/competitors/LOOKER_ANALYSIS.md` - Analisis competitivo de Looker (fortalezas, debilidades, oportunidades)
- `frontend/docs/` - Documentacion especifica del frontend
- `frontend/docs/VIZ_SYSTEM.md` - Documentacion del sistema de visualizaciones
- `frontend/docs/PERIOD_OVER_PERIOD_SPEC.md` - Especificacion de comparacion de periodos

---

**Ultima actualizacion:** 2025-01-04

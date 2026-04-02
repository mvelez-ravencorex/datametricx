# Especificacion de Viz y Dashboards - DataMetricX

**Version:** 1.0
**Fecha:** 2025-12-08
**Estado:** Diseno aprobado - Pendiente implementacion

---

## 1. Resumen Ejecutivo

Sistema de persistencia y comparticion de visualizaciones (Viz) y Dashboards para DataMetricX. Similar al concepto de "Looks" en Looker, permite a los usuarios guardar configuraciones de datasets con sus visualizaciones para reutilizarlas en el futuro o compartirlas.

### Objetivos
- Guardar configuraciones de datasets + visualizaciones como archivos reutilizables
- Organizar Viz y Dashboards en carpetas jerarquicas por tenant
- Compartir via URLs (privadas o publicas)
- Reutilizar Viz en multiples Dashboards

---

## 2. Arquitectura de Almacenamiento

### Decision: Firestore (no GCS)

Se eligio Firestore sobre GCS por:

| Aspecto | GCS | Firestore | Decision |
|---------|-----|-----------|----------|
| Queries/busquedas | Manual | Nativo | Firestore |
| Tiempo real | No | Si (Listeners) | Firestore |
| Tamano documento | Sin limite | 1MB | Suficiente |
| Versionado | Nativo | Manual | GCS mejor, pero no critico |
| Integracion Auth | Manual | Security Rules | Firestore |
| Consistencia proyecto | Semantic Layer | Tenants/Members | Firestore |

### Estructura Firestore

```
firestore/
├── tenants/{tenantId}/
│   │
│   ├── folders/{folderId}
│   │   ├── name: string
│   │   ├── parentId: string | null
│   │   ├── path: string              # "/ventas/reportes/"
│   │   ├── type: "viz" | "dashboard" | "mixed"
│   │   ├── createdAt: timestamp
│   │   ├── createdBy: { uid, email }
│   │   └── updatedAt: timestamp
│   │
│   ├── vizs/{vizId}
│   │   ├── name: string
│   │   ├── description: string
│   │   ├── folderId: string | null
│   │   ├── path: string
│   │   ├── slug: string              # URL-friendly name
│   │   ├── config: { ... }           # Configuracion completa
│   │   ├── sharing: { ... }          # Configuracion de compartir
│   │   ├── createdAt: timestamp
│   │   ├── createdBy: { uid, email }
│   │   └── updatedAt: timestamp
│   │
│   └── dashboards/{dashId}
│       ├── name: string
│       ├── description: string
│       ├── folderId: string | null
│       ├── path: string
│       ├── tiles: [...]              # Referencias a Vizs
│       ├── globalFilters: [...]
│       ├── sharing: { ... }
│       ├── createdAt: timestamp
│       └── createdBy: { uid, email }
```

---

## 3. Schema de Viz (`.viz`)

### Estructura completa del documento

```json
{
  "id": "viz_a1b2c3d4e5f6",
  "version": "1.0",
  "type": "viz",

  "metadata": {
    "name": "Funnel E-commerce por Campana",
    "description": "Analisis del embudo de conversion por campana",
    "slug": "funnel-ecommerce-campana",
    "folderId": "folder_xyz",
    "path": "/marketing/reportes/",
    "tags": ["funnel", "ecommerce", "campaigns"]
  },

  "config": {
    "datasetId": "ds_performance_campaign",

    "attributes": [
      {
        "id": "date_month",
        "label": "Mes",
        "visible": true,
        "order": 0
      },
      {
        "id": "campaign_name",
        "label": "Campana",
        "visible": true,
        "order": 1
      }
    ],

    "metrics": [
      {
        "id": "view_content",
        "label": "View Content",
        "format": "0,0",
        "visible": true,
        "order": 0
      },
      {
        "id": "add_to_cart",
        "label": "Add to Cart",
        "format": "0,0",
        "visible": true,
        "order": 1
      },
      {
        "id": "atc_rate",
        "label": "ATC Rate",
        "format": "0.00%",
        "visible": true,
        "order": 2
      }
    ],

    "filters": [
      {
        "field": "date_date",
        "operator": ">=",
        "value": "2025-01-01",
        "type": "fixed"
      },
      {
        "field": "campaign_name",
        "operator": "contains",
        "value": "Black Friday",
        "type": "fixed"
      }
    ],

    "sortConfig": {
      "field": "spend",
      "direction": "DESC"
    },

    "limit": 100,

    "columnOrder": ["date_month", "campaign_name", "view_content", "add_to_cart", "atc_rate"]
  },

  "visualization": {
    "type": "funnel_chart",
    "title": "Embudo de Conversion",

    "options": {
      "showDataLabels": true,
      "showLegend": true,
      "treatNullsAsZero": true,
      "showXGridLines": false,
      "showYGridLines": true
    },

    "chartConfig": {
      "stages": ["view_content", "add_to_cart", "initiate_checkout", "purchase_count"],
      "labels": ["View Content", "Add to Cart", "Checkout", "Purchase"],
      "colors": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"],
      "showPercentages": true,
      "showValues": true
    },

    "seriesConfig": [
      {
        "field": "spend",
        "color": "#3B82F6",
        "label": "Inversion"
      }
    ],

    "size": {
      "width": 800,
      "height": 400
    }
  },

  "sharing": {
    "visibility": "private",
    "publicToken": null,
    "publicLinkEnabled": false,
    "embedAllowed": false,
    "sharedWith": []
  },

  "createdAt": "2025-12-08T10:30:00Z",
  "updatedAt": "2025-12-08T14:20:00Z",
  "createdBy": {
    "uid": "LyCBbtgicPXqK5hQ9GJvNUhdyTI3",
    "email": "martin.velez@ravencorex.com"
  }
}
```

### Tipos de Visualizacion soportados

| Tipo | Descripcion | Campos requeridos |
|------|-------------|-------------------|
| `table` | Tabla de datos | - |
| `line_chart` | Grafico de lineas | xAxis, yAxis |
| `column_chart` | Grafico de barras | xAxis, yAxis |
| `area_chart` | Grafico de area | xAxis, yAxis |
| `pie_chart` | Grafico de torta | dimension, metric |
| `funnel_chart` | Embudo | stages, values |
| `single_value` | Valor unico (KPI) | metric |
| `progress_bar` | Barra de progreso | metric, target |
| `scatter_plot` | Dispersion | xAxis, yAxis, size? |
| `heatmap` | Mapa de calor | xAxis, yAxis, value |

---

## 4. Schema de Dashboard (`.dash`)

```json
{
  "id": "dash_x1y2z3w4",
  "version": "1.0",
  "type": "dashboard",

  "metadata": {
    "name": "Executive Dashboard",
    "description": "KPIs principales para ejecutivos",
    "slug": "executive-dashboard",
    "folderId": "folder_abc",
    "path": "/executives/",
    "tags": ["kpi", "executive", "monthly"]
  },

  "layout": {
    "type": "grid",
    "columns": 12,
    "rowHeight": 80,
    "margin": [10, 10],
    "containerPadding": [10, 10]
  },

  "tiles": [
    {
      "id": "tile_1",
      "vizId": "viz_a1b2c3d4e5f6",
      "position": { "x": 0, "y": 0, "w": 6, "h": 4 },
      "title": "Funnel Este Mes",
      "overrides": {
        "filters": [
          { "field": "date_month", "operator": "=", "value": "{{current_month}}" }
        ]
      }
    },
    {
      "id": "tile_2",
      "vizId": "viz_b2c3d4e5f6g7",
      "position": { "x": 6, "y": 0, "w": 6, "h": 4 },
      "title": "ROAS por Campana"
    },
    {
      "id": "tile_3",
      "vizId": "viz_c3d4e5f6g7h8",
      "position": { "x": 0, "y": 4, "w": 12, "h": 6 },
      "title": "Tendencia Mensual"
    }
  ],

  "globalFilters": [
    {
      "id": "date_range",
      "type": "date_range",
      "field": "date_date",
      "label": "Periodo",
      "default": "last_30_days",
      "appliesTo": "all"
    },
    {
      "id": "campaign_filter",
      "type": "multi_select",
      "field": "campaign_name",
      "label": "Campanas",
      "appliesTo": ["tile_1", "tile_2"]
    }
  ],

  "refreshConfig": {
    "autoRefresh": false,
    "intervalMinutes": 30
  },

  "sharing": {
    "visibility": "tenant",
    "publicToken": null,
    "sharedWith": []
  },

  "createdAt": "2025-12-08T10:30:00Z",
  "updatedAt": "2025-12-08T14:20:00Z",
  "createdBy": {
    "uid": "LyCBbtgicPXqK5hQ9GJvNUhdyTI3",
    "email": "martin.velez@ravencorex.com"
  }
}
```

---

## 5. Estructura de URLs

| URL | Descripcion | Auth |
|-----|-------------|------|
| `/app/viz/new` | Crear nueva viz | Required |
| `/app/viz/{vizId}` | Ver viz (modo lectura) | Required (o public) |
| `/app/viz/{vizId}/edit` | Editar viz | Required + permisos |
| `/app/dashboard/new` | Crear dashboard | Required |
| `/app/dashboard/{dashId}` | Ver dashboard | Required (o public) |
| `/app/dashboard/{dashId}/edit` | Editar dashboard | Required + permisos |
| `/app/explore` | Explorador de carpetas | Required |
| `/app/explore/{folderId}` | Ver carpeta especifica | Required |
| `/public/v/{publicToken}` | Link publico viz | No |
| `/public/d/{publicToken}` | Link publico dashboard | No |
| `/embed/v/{embedToken}` | Embed viz (iframe) | No |
| `/embed/d/{embedToken}` | Embed dashboard (iframe) | No |

---

## 6. Permisos y Roles

### Matriz de Permisos

| Accion | viewer | analyst | admin | owner | SysOwner |
|--------|--------|---------|-------|-------|----------|
| Ver propias | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver del tenant | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear viz | ❌ | ✅ | ✅ | ✅ | ✅ |
| Editar propias | ❌ | ✅ | ✅ | ✅ | ✅ |
| Editar ajenas | ❌ | ❌ | ✅ | ✅ | ✅ |
| Eliminar | ❌ | ❌ | ✅ | ✅ | ✅ |
| Compartir publico | ❌ | ❌ | ✅ | ✅ | ✅ |
| Crear carpetas | ❌ | ✅ | ✅ | ✅ | ✅ |
| Eliminar carpetas | ❌ | ❌ | ✅ | ✅ | ✅ |

### Security Rules (Firestore)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isTenantMember(tenantId) {
      return exists(/databases/$(database)/documents/tenants/$(tenantId)/members/$(request.auth.uid));
    }

    function getTenantRole(tenantId) {
      return get(/databases/$(database)/documents/tenants/$(tenantId)/members/$(request.auth.uid)).data.role;
    }

    function isSysOwner() {
      return request.auth.token.sys_owner == true;
    }

    function canCreate(tenantId) {
      return getTenantRole(tenantId) in ['owner', 'admin', 'analyst'];
    }

    function canEdit(tenantId, resourceCreatorUid) {
      let role = getTenantRole(tenantId);
      return role in ['owner', 'admin'] ||
             (role == 'analyst' && resourceCreatorUid == request.auth.uid);
    }

    function canDelete(tenantId) {
      return getTenantRole(tenantId) in ['owner', 'admin'];
    }

    // Folders
    match /tenants/{tenantId}/folders/{folderId} {
      allow read: if isTenantMember(tenantId) || isSysOwner();
      allow create: if canCreate(tenantId);
      allow update, delete: if canDelete(tenantId) || isSysOwner();
    }

    // Vizs
    match /tenants/{tenantId}/vizs/{vizId} {
      allow read: if isTenantMember(tenantId) || isSysOwner() ||
                     resource.data.sharing.visibility == 'public';
      allow create: if canCreate(tenantId);
      allow update: if canEdit(tenantId, resource.data.createdBy.uid) || isSysOwner();
      allow delete: if canDelete(tenantId) || isSysOwner();
    }

    // Dashboards
    match /tenants/{tenantId}/dashboards/{dashId} {
      allow read: if isTenantMember(tenantId) || isSysOwner() ||
                     resource.data.sharing.visibility == 'public';
      allow create: if canCreate(tenantId);
      allow update: if canEdit(tenantId, resource.data.createdBy.uid) || isSysOwner();
      allow delete: if canDelete(tenantId) || isSysOwner();
    }
  }
}
```

---

## 7. API Backend (Operaciones Complejas)

El frontend maneja CRUD directamente con Firestore SDK. El backend expone endpoints para operaciones que requieren logica adicional:

### Endpoints

```
# Duplicar
POST   /api/viz/{vizId}/duplicate
       Body: { name: string, folderId?: string }
       Response: { vizId: string, path: string }

# Compartir publicamente
POST   /api/viz/{vizId}/share/public
       Response: { publicToken: string, url: string }

DELETE /api/viz/{vizId}/share/public
       Response: { success: true }

# Mover multiples items
POST   /api/folders/move
       Body: { items: [{ type: 'viz'|'dashboard', id: string }], targetFolderId: string }
       Response: { moved: number }

# Busqueda
GET    /api/viz/search?q={query}&tenant={tenantId}
       Response: { results: [...], total: number }

# Recientes
GET    /api/viz/recent?limit=10
       Response: { vizs: [...], dashboards: [...] }

# Exportar
GET    /api/viz/{vizId}/export?format=json|pdf|png
       Response: File download

# Dashboard: Obtener datos de todos los tiles
POST   /api/dashboard/{dashId}/data
       Body: { globalFilters: [...] }
       Response: { tiles: { [tileId]: { data: [...], error?: string } } }
```

---

## 8. Integracion con Semantic Layer

Las Viz consultan datos a traves del Semantic Layer existente:

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────┐
│   Frontend  │────>│   Backend   │────>│   Semantic   │────>│ BigQuery │
│   (Viz UI)  │     │   API       │     │   Layer      │     │          │
└─────────────┘     └─────────────┘     └──────────────┘     └──────────┘
       │                   │
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│  Firestore  │     │    GCS      │
│  (Viz/Dash) │     │  (Entities) │
└─────────────┘     └─────────────┘
```

### Flujo de carga de una Viz

1. Usuario abre `/app/viz/{vizId}`
2. Frontend carga documento de Firestore
3. Frontend extrae `config.datasetId` y campos
4. Frontend llama a `/api/semantic/query` con la configuracion
5. Backend traduce a SQL usando Semantic Layer
6. BigQuery ejecuta query
7. Frontend renderiza visualizacion con los datos

---

## 9. Roadmap de Implementacion

### Fase 1: MVP (Sprint 1-2)
- [ ] Estructura Firestore (folders, vizs)
- [ ] CRUD basico de Viz desde frontend
- [ ] Guardar/cargar configuracion completa
- [ ] UI de "Guardar como Viz"
- [ ] Navegador de carpetas basico

### Fase 2: Compartir (Sprint 3)
- [ ] Links publicos
- [ ] Security Rules completas
- [ ] UI de compartir

### Fase 3: Dashboards (Sprint 4-5)
- [ ] Estructura de Dashboard
- [ ] Editor de dashboard (drag & drop)
- [ ] Filtros globales
- [ ] Tiles con overrides

### Fase 4: Avanzado (Sprint 6+)
- [ ] Embed/iframe
- [ ] Exportar PDF/PNG
- [ ] Versionado/historial
- [ ] Alertas programadas

---

## 10. Consideraciones Tecnicas

### Limites
- Tamano maximo documento Firestore: 1MB
- Vizs por tenant: Sin limite (pero monitorear costos)
- Tiles por dashboard: Recomendado < 20

### Performance
- Usar paginacion en listados de carpetas
- Cachear Vizs frecuentes en frontend
- Lazy load de datos en dashboards

### Migracion
- El semantic layer (GCS) se mantiene igual
- Las Viz son una capa encima, no reemplazan nada existente

---

*Documento creado: 2025-12-08*
*Ultima actualizacion: 2025-12-08*

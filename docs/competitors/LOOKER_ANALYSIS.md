# Looker Analysis - Referencia Competitiva para DataMetricX

> **Objetivo:** Documentar cómo funciona Looker, sus puntos de dolor, y las oportunidades para DataMetricX.
> **Última actualización:** 2025-01-04

---

## Resumen Ejecutivo

### Fortalezas de Looker (No perder de vista)
1. **Fuente Única de Verdad** - Capa semántica centralizada
2. **BI como Código** - Git integration, versioning, CI/CD
3. **Embedded Analytics** - Líder en analítica incorporada
4. **Symmetric Aggregation** - Resuelve fan-out automáticamente
5. **Aggregate Awareness** - Optimización automática de queries

### Debilidades de Looker (Oportunidades para DataMetricX)
1. **Curva de aprendizaje empinada** - LookML requiere desarrolladores
2. **Falta de flexibilidad tipo Excel** - Table Calculations lentos
3. **Rendimiento en dashboards complejos** - >25 tiles = lento
4. **Costos prohibitivos** - Especialmente para startups
5. **Reportes no "Pixel-Perfect"** - Difícil personalizar branding
6. **PoP estático** - Requiere desarrollador para cambiar periodos

---

## 1. Arquitectura y Capa Semántica

### Cómo lo hace Looker

#### Estructura de LookML
```
Proyecto (Git repo)
├── Modelos (conexión + explores)
│   └── Explores (puntos de entrada para queries)
├── Vistas (representan tablas)
│   ├── Dimensiones (atributos, GROUP BY)
│   └── Medidas (agregaciones SQL)
└── Archivos auxiliares
```

#### Características Técnicas
- **Lenguaje declarativo** (no imperativo)
- **Operadores de sustitución**: `${field_name}` para referencias, `${TABLE}.column` para columnas físicas
- **Principio DRY**: Lógica definida una vez, SQL generado bajo demanda
- **JOINs en Explores**: Recomendado `many_to_one` desde tabla de hechos hacia dimensiones
- **Cardinalidad explícita**: Parámetro `relationship` (1:1, 1:m, m:1, m:m)

#### Symmetric Aggregation (Solución Fan-out)
- Requiere **clave primaria única** en cada vista
- Genera SQL con hashing MD5 para valores únicos
- Aplica `SUM(DISTINCT)` ponderada matemáticamente
- Cuenta cada hecho solo una vez independiente de duplicación por JOIN

#### Caching con Datagroups
- **sql_trigger**: Query que detecta cambios (ej. `MAX(id)`)
- **max_cache_age**: Temporizador de respaldo (ej. 24 horas)
- **interval_trigger**: Invalidación por cronograma fijo
- Cachea resultados exactos de queries (campos + filtros + límites)

### Puntos de Dolor

| Problema | Impacto | Frecuencia |
|----------|---------|------------|
| Curva de aprendizaje empinada | Usuarios no técnicos bloqueados | Muy alta |
| Validador lento (1-5 min) | Productividad del desarrollador | Alta en proyectos grandes |
| Conflictos de Git en IDE web | Equipos grandes | Media |
| Explores duplicados/desactualizados | Desorden, confusión | Alta |

### Oportunidades para DataMetricX

| Problema Looker | Solución DataMetricX |
|-----------------|----------------------|
| LookML requiere código | **UI visual para crear datasets** (Dataset Builder) |
| Validación lenta | Validación en tiempo real en el navegador |
| Conflictos Git | Sin dependencia de Git para usuarios finales |
| Explores duplicados | Sistema de versionado y deprecación automática |

### Decisiones para DataMetricX

1. **Mantener**: Capa semántica centralizada (ya la tenemos en YAML)
2. **Mejorar**: Agregar Dataset Builder visual para clientes
3. **Implementar**: Symmetric Aggregation automático
4. **Simplificar**: Cache automático sin configuración manual

---

## 2. Explores y Query Builder

### Cómo lo hace Looker

#### Flujo de Usuario
1. Seleccionar Explore desde menú
2. (Opcional) Quick Start con queries pre-configuradas
3. Seleccionar campos del selector izquierdo
4. Configurar filtros
5. Ejecutar (Run) → Looker genera SQL y ejecuta

#### Presentación de Campos
- **Dimensiones (Azul)**: Atributos, van en GROUP BY
- **Medidas (Naranja)**: Agregaciones SQL
- Organizados por Vistas (Views)
- Búsqueda integrada en selector

#### Sistema de Filtros
| Tipo | Descripción |
|------|-------------|
| Filtros estándar | Calendario para fechas, dropdowns para texto |
| Dimensiones | Cláusula WHERE (antes de agregación) |
| Medidas | Cláusula HAVING (después de agregación) |
| Advanced Matches | Lenguaje natural ("last 90 days") |
| Custom Filters | Expresiones CASE WHEN |
| User Attributes | Filtros automáticos por usuario |

#### Pivots y Ordenamiento
- **Pivot**: Transpone dimensión a columnas (máx 200 valores)
- **Ordenamiento default**: Fecha desc → Métrica desc → Dimensión asc
- **Multinivel**: Shift+click en headers

#### Límites
- **Filas en UI**: 5,000 (protección de memoria)
- **Columnas recomendadas**: 50 (límite técnico: 200)
- **Descargas**: Opción "All Results" sin límites

### Puntos de Dolor

| Problema | Impacto |
|----------|---------|
| Rigidez vs Excel | Tareas simples requieren Table Calculations |
| Table Calculations en navegador | Lag con datos grandes |
| Latencia de metadatos | >100 campos = selector lento |
| Sin búsqueda global | No encuentra campos entre Explores |
| Cuotas de API | Bloquea integraciones como GA4 |

### Features que piden los usuarios
1. **Reporting Pixel-Perfect** - Diseños personalizados para ejecutivos
2. **PoP dinámico en UI** - Cambiar periodos sin desarrollador
3. **Cálculos ad-hoc en servidor** - No en memoria del navegador

### Oportunidades para DataMetricX

| Problema Looker | Solución DataMetricX |
|-----------------|----------------------|
| Table Calculations lentas | Cálculos en BigQuery, nunca en browser |
| Sin búsqueda global | Búsqueda unificada en todos los datasets |
| PoP estático | **PoP dinámico desde filtros** (en progreso) |
| Metadatos lentos | Lazy loading de campos por categoría |

### Decisiones para DataMetricX

1. **Ya implementado**: VizBuilder con selector de campos
2. **Mejorar**: Agregar Quick Start / queries sugeridas
3. **Crítico**: PoP dinámico sin código (especificación lista)
4. **Implementar**: Búsqueda global de campos

---

## 3. Period over Period (PoP)

### Cómo lo hace Looker

#### Implementación Nativa (type: period_over_period)
```yaml
measure: orders_pop {
  type: period_over_period
  based_on: count_orders        # Medida base
  based_on_time: order_date     # Dimensión temporal
  period: month                 # Ventana de comparación
  kind: relative_change         # Tipo de cálculo
}
```

#### Parámetros
| Parámetro | Valores |
|-----------|---------|
| `period` | year, quarter, month, week, date |
| `kind` | previous, difference, relative_change |
| `value_to_date` | yes/no (comparación justa "to-date") |

#### Tipos de Comparación (kind)
- **previous**: Valor bruto del periodo anterior
- **difference**: Actual - Anterior (delta absoluto)
- **relative_change**: (Actual - Anterior) / Anterior (%)

#### Manejo de Edge Cases
- **value_to_date: yes** limita agregación a días comparables
- Granularidad se adapta automáticamente a la query
- **NO soporta**: Calendarios fiscales 4-5-4, periodos irregulares
- **Workaround estacionalidad**: Restar 364 días (52 semanas exactas)

#### Ejecución: SQL con CTEs
```sql
WITH current_period AS (
  SELECT ... WHERE date BETWEEN '2024-01-01' AND '2024-01-31'
),
previous_period AS (
  SELECT ... WHERE date BETWEEN '2023-12-01' AND '2023-12-31'
)
SELECT
  current.*,
  previous.value AS previous_value,
  current.value - previous.value AS delta
FROM current_period
LEFT JOIN previous_period ON ...
```

**Ventaja**: Procesamiento en base de datos (BigQuery, Snowflake)
**Fricción**: Filtros dobles en tablas particionadas por fecha

### Puntos de Dolor

| Problema | Descripción |
|----------|-------------|
| PoP estático | Cambiar periodos requiere modificar LookML |
| Sin calendarios fiscales | 4-5-4, retail calendar no soportados |
| Requiere dimensión temporal en query | Obligatorio para que funcione |

### Estado en DataMetricX

**Especificación lista** en `frontend/docs/PERIOD_OVER_PERIOD_SPEC.md`:
- Frontend implementado (2 queries + merge) - limitado
- Backend con CTEs especificado - pendiente implementar

### Oportunidades para DataMetricX

| Problema Looker | Solución DataMetricX |
|-----------------|----------------------|
| PoP estático | **Selector dinámico en filtros** |
| Sin calendarios fiscales | Soporte para calendarios custom |
| Requiere LookML | UI sin código |

### Decisiones para DataMetricX

1. **Prioridad alta**: Implementar PoP en backend con CTEs
2. **Diferenciador**: PoP dinámico desde UI de filtros
3. **Futuro**: Soporte para calendarios fiscales personalizados

---

## 4. Visualizaciones y Dashboards

### Cómo lo hace Looker

#### Tipos de Visualización
| Categoría | Tipos |
|-----------|-------|
| Básicos | Tabla, Barras, Columnas, Líneas, Área |
| Avanzados | Scatter, Pie, Donut, Funnel, Timeline, Waterfall |
| Geoespaciales | Google Maps, Mapas estáticos |
| KPIs | Single Value |

#### Configuración
- Panel de edición para colores, ejes, leyendas
- **Chart Config Editor** para personalizaciones avanzadas
- **Visualizaciones custom** con JavaScript + API 2.0

#### Layout System de Dashboards
| Tipo | Descripción |
|------|-------------|
| **Newspaper** (principal) | Grid 24 columnas, posición por coordenadas |
| Tile | Ajuste dinámico al navegador |
| Grid | Anchos fijos por filas |
| Static | Posicionamiento absoluto manual |

#### Interactividad
- **Filtros con "listen"**: Tiles escuchan selecciones de filtros
- **auto_run**: Carga automática o requiere click
- **Gemini AI**: Preguntas en lenguaje natural

#### Cross-filtering
- Click en punto de datos → filtra todos los tiles
- **Requisito**: Todos los tiles del mismo Explore
- Soporta selección de rangos en ejes continuos

#### Drill-down
- **En dimensión**: Nueva query filtrada por valor
- **En medida**: Muestra registros individuales (raw data)
- **drill_fields en LookML**: Control de qué campos aparecen

### Puntos de Dolor

| Problema | Impacto |
|----------|---------|
| >25 tiles = lento | Degradación de rendimiento |
| Sin pixel-perfect | Difícil personalizar branding |
| Table Calculations en browser | Lag con datos grandes |
| Sin búsqueda global | No encuentra campos entre Explores |

### Estado en DataMetricX

**Ya implementado**:
- Dashboard Editor con grid 25x25px
- Drag & drop con collision detection
- Visualizaciones: line, column, area, pie, single, progress, table
- Títulos editables con alineación
- Formateo de ejes Y (compact K/M/B)

### Oportunidades para DataMetricX

| Problema Looker | Solución DataMetricX |
|-----------------|----------------------|
| Grid 24 columnas rígido | Grid flexible 25px con snap |
| Tile limit performance | Lazy loading de tiles |
| Sin pixel-perfect | Más opciones de personalización |
| Drill solo en LookML | Drill configurable desde UI |

### Decisiones para DataMetricX

1. **Ya implementado**: Grid flexible, drag & drop
2. **Próximo**: Cross-filtering entre visualizaciones
3. **Próximo**: Drill-down configurable desde UI
4. **Futuro**: Más tipos de viz (funnel, waterfall, maps)

---

## 5. Permisos y Multi-tenancy

### Cómo lo hace Looker

#### Row-level Security (RLS)
- **access_filter** + **User Attributes**
- Inyecta WHERE automático en cada query
- Ejemplo: Usuario solo ve filas de su `client_id`

#### Field-level Security
- **access_grants** basados en User Attributes
- Campos ocultos si usuario no tiene atributo requerido
- Alternativa: Modelos separados con campos específicos

#### Multi-tenancy (Closed System)
- Elimina grupo "Todos los usuarios"
- Grupos por cliente con subgrupos internos
- Aislamiento total: Cliente A no sabe que existe Cliente B
- **Limitación**: Montaje manual, no automatizado

#### Content Access vs Data Access
| Tipo | Control | Efecto |
|------|---------|--------|
| Content Access | Carpetas | Ver/editar dashboards |
| Data Access | Roles + Modelos | Query a datos |

**Interacción**: Puedes ver un dashboard pero tiles vacíos si no tienes data access

### Puntos de Dolor

| Problema | Descripción |
|----------|-------------|
| Montaje manual | No hay "Security as Code" automatizado |
| Confusión Content vs Data | Usuarios ven dashboards vacíos |

### Estado en DataMetricX

**Ya implementado**:
- Multi-tenancy con `tenants/{tenantId}/`
- Permisos basados en membresía de tenant
- Core Dashboards globales (read-only para tenants)

### Oportunidades para DataMetricX

| Problema Looker | Solución DataMetricX |
|-----------------|----------------------|
| Montaje manual | Tenant auto-provisioning |
| Confusión permisos | UI clara de qué puedes ver/acceder |

### Decisiones para DataMetricX

1. **Ya implementado**: Tenant isolation en Firestore
2. **Próximo**: Row-level security configurable
3. **Futuro**: Field-level security desde UI

---

## 6. Performance y Escalabilidad

### Cómo lo hace Looker

#### Optimización de Queries
- **JOINs many_to_one** desde hechos hacia dimensiones
- **PDTs (Persistent Derived Tables)**: Pre-materialización
- **Cargas incrementales**: Solo datos nuevos
- **Índices en LookML**: Declaración explícita

#### Aggregate Awareness
- **Enrutador inteligente**: Redirige a tabla agregada más pequeña
- **Reducción de costos**: Consulta resúmenes, no transacciones
- **Unión dinámica**: UNION con datos recientes si falta hoy

#### Manejo de Millones de Filas
- Escala a **petabytes** (depende del warehouse)
- Límite UI: 5,000 filas (protección de memoria)
- "All Results" para descargas masivas

### Puntos de Dolor

| Problema | Impacto |
|----------|---------|
| >20 JOINs = metadatos lentos | Selector de campos lento |
| >100 campos = renderizado lento | UX degradada |
| Validador 1-5 min | Flujo de desarrollo lento |
| >25 tiles = dashboard lento | Competencia por recursos |
| Table Calculations en browser | Lag con datos grandes |

### Workarounds de Usuarios
1. **Denormalización upstream** - Evitar JOINs en tiempo real
2. **Modelado en dbt/BigQuery** - Capa semántica "delgada"
3. **Inclusión estratégica** - Limitar vistas por modelo
4. **Datagroups estrictos** - Cache sincronizado con ETL

### Estado en DataMetricX

**Ya implementado**:
- Queries directo a BigQuery
- Límite de filas configurable
- Cache a nivel de proxy (en desarrollo)

### Oportunidades para DataMetricX

| Problema Looker | Solución DataMetricX |
|-----------------|----------------------|
| Table Calcs en browser | **Todo en BigQuery** |
| Validador lento | Validación instantánea |
| Cache manual | Cache automático inteligente |

### Decisiones para DataMetricX

1. **Principio**: Nunca procesar en browser, siempre en BigQuery
2. **Próximo**: Aggregate Awareness automático
3. **Próximo**: PDTs equivalentes para queries frecuentes

---

## 7. Experiencia de Usuario (UX)

### Lo que aman de Looker (NO perder)

| Feature | Por qué importa |
|---------|-----------------|
| Fuente Única de Verdad | Métricas consistentes en toda la empresa |
| BI como Código | Control de versiones, code review, CI/CD |
| Embedded Analytics | Líder para insertar en apps terceras |
| Symmetric Aggregation | Fan-out resuelto automáticamente |
| Aggregate Awareness | Optimización sin intervención |

### Por qué migran DESDE Looker

| Razón | Alternativas que eligen |
|-------|------------------------|
| Fatiga de LookML | Sigma, Hex (interfaz tipo Excel) |
| Costos altos/opacos | Metabase, Superset (open source) |
| Brecha de autoservicio | Tools con UI más amigable |
| Sin pixel-perfect | Power BI, Tableau |

### Puntos de Dolor UX

| Problema | Frecuencia |
|----------|------------|
| Curva de aprendizaje LookML | Muy alta |
| Dashboards lentos (>25 tiles) | Alta |
| Validación lenta (1-5 min) | Alta en proyectos grandes |
| Rigidez vs Excel | Alta |
| Integraciones fuera de GCP | Media |

### Estrategia DataMetricX

#### Mantener de Looker
- [x] Capa semántica centralizada
- [ ] Aggregate Awareness (pendiente)
- [ ] Symmetric Aggregation (pendiente)

#### Mejorar vs Looker
- [x] UI visual sin código (VizBuilder)
- [x] Grid flexible (25px vs 24 columnas)
- [ ] PoP dinámico (especificación lista)
- [ ] Búsqueda global de campos
- [ ] Cache automático

#### Diferenciadores únicos
- [ ] Dataset Builder para clientes (roadmap)
- [ ] Multi-tenant nativo desde día 1
- [ ] Integración BigQuery optimizada
- [ ] Costos transparentes y accesibles

---

## Matriz de Prioridades

### Alta Prioridad (Implementar pronto)

| Feature | Razón | Estado |
|---------|-------|--------|
| PoP Backend con CTEs | Diferenciador clave, especificación lista | Spec ready |
| Aggregate Awareness | Performance crítico a escala | Pendiente |
| Cross-filtering | Interactividad esperada en dashboards | Pendiente |
| Drill-down desde UI | UX básica de BI | Pendiente |

### Media Prioridad (Próximos meses)

| Feature | Razón | Estado |
|---------|-------|--------|
| Dataset Builder (Básico) | Autoservicio para clientes | Documentado |
| Búsqueda global de campos | UX solicitada por usuarios | Pendiente |
| Symmetric Aggregation | Precisión en JOINs complejos | Pendiente |
| Cache automático | Reducir carga en BigQuery | Pendiente |

### Baja Prioridad (Futuro)

| Feature | Razón |
|---------|-------|
| Dataset Builder (Avanzado) | Después de validar básico |
| Calendarios fiscales custom | Nicho específico |
| Embedded Analytics | Requiere API robusta |
| Visualizaciones geo | Complejidad alta |

---

## Glosario Looker → DataMetricX

| Looker | DataMetricX | Notas |
|--------|-------------|-------|
| LookML | YAML semantic layer | Estructura similar |
| Explore | Dataset | Punto de entrada para queries |
| View | Entity | Representa una tabla/concepto |
| Dimension | Attribute | Campos para agrupar |
| Measure | Metric | Agregaciones |
| PDT | (Pendiente) | Tablas pre-materializadas |
| Datagroup | (Pendiente) | Cache policies |
| access_filter | (Pendiente) | RLS |
| access_grant | (Pendiente) | Field-level security |

---

## Referencias

- Documentación oficial Looker: https://cloud.google.com/looker/docs
- LookML reference: https://cloud.google.com/looker/docs/lookml-reference
- Community forums: https://community.looker.com
- G2 Reviews: https://www.g2.com/products/looker/reviews
- Reddit r/looker: https://reddit.com/r/looker

---

## Changelog

| Fecha | Cambios |
|-------|---------|
| 2025-01-04 | Documento inicial con investigación completa |

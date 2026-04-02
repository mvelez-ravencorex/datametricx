# Diccionario de Datos - Meta/Facebook Ads

**Plataforma:** DataMetricX
**Proveedor:** Meta (Facebook/Instagram Ads)
**Actualizado:** 2025-12-08

---

## Resumen Ejecutivo

DataMetricX extrae y procesa datos de Meta Ads API para proporcionar insights profundos sobre el rendimiento de campanas publicitarias. Los datos se organizan en **13 entidades** y **29 datasets** que cubren:

- Performance a nivel de Campana, Ad Set y Anuncio
- Breakdowns demograficos (edad, genero, pais, dispositivo, plataforma)
- Informacion de creativos y contenido publicitario
- Metricas de funnel de conversion completo

---

## Arquitectura de Datos

```
Meta Ads API
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    BigQuery (Raw Layer)                      │
│  raw_meta_*  -  Datos crudos sin transformar                │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                  BigQuery (Reporting Layer)                  │
│  meta_*  -  Datos procesados, normalizados por tenant       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Semantic Layer (GCS)                      │
│  Entities + Datasets  -  Modelos para consultas             │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                      Frontend / API                          │
│  Dashboards, Reports, Analytics                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Entidades de Dimensiones

### 1.1 Cuentas Meta (`meta_accounts`)

**Descripcion:** Cuentas publicitarias de Meta con informacion de moneda, timezone y negocio.

| Campo | Label | Tipo | Descripcion |
|-------|-------|------|-------------|
| `account_id` | Account ID | string | Identificador unico de la cuenta publicitaria |
| `account_name` | Nombre de Cuenta | string | Nombre legible de la cuenta |
| `currency` | Moneda | string | Moneda de la cuenta (USD, MXN, etc.) |
| `timezone_name` | Zona Horaria | string | Timezone configurado |
| `business_name` | Nombre del Negocio | string | Nombre del Business Manager |
| `business_id` | Business Manager ID | string | ID del Business Manager |
| `account_status` | Estado de Cuenta | number | Estado numerico (1=Activo, 2=Deshabilitado, etc.) |

**Metricas disponibles:**
| Metrica | Label | Formato | Descripcion |
|---------|-------|---------|-------------|
| `spend_cap` | Limite de Gasto | $0,0.00 | Limite maximo de gasto configurado |
| `amount_spent` | Total Gastado | $0,0.00 | Monto total gastado historico |
| `account_count` | Cuentas | 0,0 | Conteo de cuentas |

---

### 1.2 Campanas (`meta_campaigns`)

**Descripcion:** Campanas publicitarias de Meta/Facebook Ads.

| Campo | Label | Tipo | Descripcion |
|-------|-------|------|-------------|
| `campaign_id` | Campaign ID | string | ID unico de la campana |
| `name` | Nombre de Campana | string | Nombre de la campana |
| `status` | Estado | string | ACTIVE, PAUSED, DELETED, ARCHIVED |
| `effective_status` | Estado Efectivo | string | Estado real considerando jerarquia |
| `objective` | Objetivo | string | CONVERSIONS, TRAFFIC, AWARENESS, etc. |
| `buying_type` | Tipo de Compra | string | AUCTION, RESERVED |
| `created_time` | Fecha Creacion | timestamp | Fecha de creacion |
| `start_time` | Fecha Inicio | timestamp | Fecha de inicio programada |
| `stop_time` | Fecha Fin | timestamp | Fecha de fin programada |

**Metricas disponibles:**
| Metrica | Label | Formato | Descripcion |
|---------|-------|---------|-------------|
| `daily_budget` | Presupuesto Diario | $0,0.00 | Presupuesto diario configurado |
| `lifetime_budget` | Presupuesto Total | $0,0.00 | Presupuesto total de vida |
| `budget_remaining` | Presupuesto Restante | $0,0.00 | Presupuesto sin gastar |
| `campaign_count` | Campanas | 0,0 | Conteo de campanas |

---

### 1.3 Ad Sets (`meta_adsets`)

**Descripcion:** Conjuntos de anuncios de Meta/Facebook Ads.

| Campo | Label | Tipo | Descripcion |
|-------|-------|------|-------------|
| `adset_id` | AdSet ID | string | ID unico del ad set |
| `campaign_id` | Campaign ID | string | ID de la campana padre |
| `name` | Nombre de Ad Set | string | Nombre del ad set |
| `status` | Estado | string | ACTIVE, PAUSED, DELETED |
| `effective_status` | Estado Efectivo | string | Estado real |
| `optimization_goal` | Objetivo de Optimizacion | string | OFFSITE_CONVERSIONS, LINK_CLICKS, etc. |
| `bid_strategy` | Estrategia de Puja | string | LOWEST_COST_WITHOUT_CAP, COST_CAP, etc. |
| `start_time` | Fecha Inicio | timestamp | Fecha de inicio |
| `end_time` | Fecha Fin | timestamp | Fecha de fin |

**Metricas disponibles:**
| Metrica | Label | Formato |
|---------|-------|---------|
| `daily_budget` | Presupuesto Diario | $0,0.00 |
| `lifetime_budget` | Presupuesto Total | $0,0.00 |
| `adset_count` | Ad Sets | 0,0 |

---

### 1.4 Anuncios (`meta_ads`)

**Descripcion:** Anuncios individuales de Meta/Facebook Ads.

| Campo | Label | Tipo | Descripcion |
|-------|-------|------|-------------|
| `ad_id` | Ad ID | string | ID unico del anuncio |
| `adset_id` | AdSet ID | string | ID del ad set padre |
| `campaign_id` | Campaign ID | string | ID de la campana |
| `creative_id` | Creative ID | string | ID del creativo asociado |
| `name` | Nombre de Anuncio | string | Nombre del anuncio |
| `status` | Estado | string | ACTIVE, PAUSED, DELETED |
| `effective_status` | Estado Efectivo | string | Estado real |
| `created_time` | Fecha Creacion | timestamp | Fecha de creacion |

---

### 1.5 Creativos (`meta_creatives`)

**Descripcion:** Creativos publicitarios con contenido multimedia.

| Campo | Label | Tipo | Descripcion |
|-------|-------|------|-------------|
| `creative_id` | Creative ID | string | ID unico del creativo |
| `ad_id` | Ad ID | string | ID del anuncio asociado |
| `ad_name` | Nombre del Anuncio | string | Nombre del anuncio |
| `creative_name` | Nombre del Creativo | string | Nombre del creativo |
| `title` | Titulo | string | Titulo del anuncio |
| `body` | Cuerpo | string | Texto del cuerpo |
| `image_url` | URL Imagen | string | URL de la imagen principal |
| `thumbnail_url` | URL Thumbnail | string | URL del thumbnail |
| `call_to_action_type` | Tipo de CTA | string | SHOP_NOW, LEARN_MORE, SIGN_UP, etc. |

---

## 2. Entidades de Performance (Facts)

### 2.1 Performance de Campanas (`fact_meta_performance_campaign`)

**Descripcion:** Metricas de rendimiento diario a nivel de campana.
**Granularidad:** Diaria por campana
**Tabla fuente:** `reporting.meta_performance_campaign_daily`

#### Atributos (Dimensiones)

| Campo | Label | Tipo | Grupo |
|-------|-------|------|-------|
| `date` | Fecha | date | Fechas |
| `campaign_name` | Campana | string | Campana |
| `quality_score_organic` | Calidad Organica | string | Calidad |
| `engagement_rate_ranking` | Ranking Engagement | string | Calidad |
| `conversion_rate_ranking` | Ranking Conversion | string | Calidad |

**Timeframes disponibles para `date`:** raw, date, week, month, quarter, year

#### Metricas

| Grupo | Metrica | Label | Tipo | Formato | Descripcion |
|-------|---------|-------|------|---------|-------------|
| **Alcance** | `impressions` | Impresiones | number | 0,0 | Total de impresiones |
| | `reach` | Alcance | number | 0,0 | Usuarios unicos alcanzados |
| | `frequency` | Frecuencia | number | 0.00 | Impresiones / Alcance |
| **Inversion** | `spend` | Inversion | currency | $0,0.00 | Gasto total |
| | `cpm` | CPM | currency | $0.00 | Costo por mil impresiones |
| | `cpc` | CPC | currency | $0.00 | Costo por click |
| | `cpp` | CPP | currency | $0.00 | Costo por persona alcanzada (x1000) |
| **Engagement** | `clicks` | Clicks | number | 0,0 | Clicks totales |
| | `inline_link_clicks` | Link Clicks | number | 0,0 | Clicks en enlaces |
| | `unique_clicks` | Clicks Unicos | number | 0,0 | Usuarios unicos que clickearon |
| | `ctr` | CTR | percent | 0.00% | Click-through rate |
| | `unique_ctr` | CTR Unico | percent | 0.00% | CTR sobre usuarios unicos |
| **Video** | `video_plays` | Video Plays | number | 0,0 | Reproducciones de video |
| | `video_p25` | Video 25% | number | 0,0 | Videos vistos al 25% |
| | `video_p50` | Video 50% | number | 0,0 | Videos vistos al 50% |
| | `video_p75` | Video 75% | number | 0,0 | Videos vistos al 75% |
| | `video_p95` | Video 95% | number | 0,0 | Videos vistos al 95% |
| **Conversiones** | `conversions` | Conversiones | number | 0,0 | Total conversiones |
| | `purchase_count` | Compras | number | 0,0 | Numero de compras |
| | `purchase_value` | Valor Compras | currency | $0,0.00 | Revenue de compras |
| | `roas` | ROAS | number | 0.00x | Return on Ad Spend |
| | `cost_per_purchase` | CPA | currency | $0.00 | Costo por adquisicion |
| | `aov` | AOV | currency | $0.00 | Average Order Value |
| | `conversion_rate` | Conversion Rate | percent | 0.00% | Tasa de conversion |
| **Funnel** | `add_to_cart` | Add to Cart | number | 0,0 | Agregados al carrito |
| | `initiate_checkout` | Checkout | number | 0,0 | Inicios de checkout |
| | `view_content` | View Content | number | 0,0 | Vistas de contenido |
| | `lead_count` | Leads | number | 0,0 | Leads generados |
| | `cost_per_lead` | CPL | currency | $0.00 | Costo por lead |
| **Acciones** | `action_link_click` | Link Clicks (Actions) | number | 0,0 | Clicks en enlaces |
| | `action_landing_page_view` | Landing Views | number | 0,0 | Vistas de landing |
| | `action_post_engagement` | Engagement | number | 0,0 | Engagement total |
| | `action_video_view` | Video Views 3s | number | 0,0 | Videos vistos 3+ segundos |

---

### 2.2 Performance de Ad Sets (`fact_meta_performance_adset`)

**Descripcion:** Metricas de rendimiento diario a nivel de ad set.
**Granularidad:** Diaria por ad set
**Tabla fuente:** `reporting.meta_performance_adset_daily`

#### Atributos adicionales (vs Campana)

| Campo | Label | Tipo |
|-------|-------|------|
| `adset_name` | Ad Set | string |

#### Metricas (similares a campana, subset)

Incluye: impressions, reach, frequency, spend, cpm, cpc, clicks, ctr, action_link_click, action_outbound_click, conversions, purchase_count, purchase_value, roas, cost_per_purchase, aov, add_to_cart, initiate_checkout

---

### 2.3 Performance de Anuncios (`fact_meta_performance_ad`)

**Descripcion:** Metricas de rendimiento diario a nivel de anuncio. Incluye Creative Analytics.
**Granularidad:** Diaria por anuncio
**Tabla fuente:** `reporting.meta_performance_ad_daily`

#### Atributos adicionales

| Campo | Label | Tipo | Grupo |
|-------|-------|------|-------|
| `ad_name` | Anuncio | string | Anuncio |
| `quality_ranking` | Ranking Calidad | string | Calidad |
| `engagement_rate_ranking` | Ranking Engagement | string | Calidad |
| `conversion_rate_ranking` | Ranking Conversion | string | Calidad |

#### Metricas de Creative Analytics (exclusivas de este nivel)

| Metrica | Label | Formato | Descripcion |
|---------|-------|---------|-------------|
| `thumbstop_rate` | Thumbstop Rate | 0.00% | Video 3s views / Impressions - Mide la capacidad del creativo de captar atencion |
| `hold_rate` | Hold Rate | 0.00% | Video 50% / Plays - Mide la capacidad de retener |
| `completion_rate` | Completion Rate | 0.00% | Video 95% / Plays - Mide visualizacion completa |

---

## 3. Entidades de Breakdowns

### 3.1 Breakdown por Edad y Genero (`fact_meta_breakdown_age_gender`)

**Descripcion:** Performance segmentado por edad y genero.
**Tabla fuente:** `reporting.meta_performance_campaign_age_gender`

| Atributo | Label | Valores posibles |
|----------|-------|------------------|
| `age` | Edad | 13-17, 18-24, 25-34, 35-44, 45-54, 55-64, 65+ |
| `gender` | Genero | male, female, unknown |

**Metricas:** impressions, clicks, ctr, spend, cpc, conversions, purchase_value, roas

---

### 3.2 Breakdown por Pais (`fact_meta_breakdown_country`)

**Descripcion:** Performance segmentado por pais.
**Tabla fuente:** `reporting.meta_performance_campaign_country`

| Atributo | Label | Valores posibles |
|----------|-------|------------------|
| `country` | Pais | Codigos ISO de pais (US, MX, BR, AR, etc.) |

**Metricas:** impressions, clicks, ctr, spend, conversions, purchase_value, roas

---

### 3.3 Breakdown por Dispositivo (`fact_meta_breakdown_device`)

**Descripcion:** Performance segmentado por tipo de dispositivo.
**Tabla fuente:** `reporting.meta_performance_campaign_device`

| Atributo | Label | Valores posibles |
|----------|-------|------------------|
| `device_platform` | Dispositivo | mobile, desktop, tablet |

---

### 3.4 Breakdown por Plataforma (`fact_meta_breakdown_platform`)

**Descripcion:** Performance segmentado por plataforma de Meta.
**Tabla fuente:** `reporting.meta_performance_campaign_platform`

| Atributo | Label | Valores posibles |
|----------|-------|------------------|
| `publisher_platform` | Plataforma | facebook, instagram, audience_network, messenger |
| `platform_position` | Posicion | feed, story, reels, right_column, etc. |

---

### 3.5 Top Creativos (`fact_meta_top_creatives`)

**Descripcion:** Metricas de rendimiento de los mejores creativos.
**Tabla fuente:** `reporting.meta_top_creatives_performance`

---

## 4. Formulas de Metricas Calculadas

### Metricas de Eficiencia

```sql
-- CPM (Costo por Mil Impresiones)
SAFE_DIVIDE(SUM(spend), SUM(impressions)) * 1000

-- CPC (Costo por Click)
SAFE_DIVIDE(SUM(spend), SUM(clicks))

-- CTR (Click-Through Rate)
SAFE_DIVIDE(SUM(clicks), SUM(impressions))

-- Frequency (Frecuencia)
SAFE_DIVIDE(SUM(impressions), SUM(reach))
```

### Metricas de Conversion

```sql
-- ROAS (Return on Ad Spend)
SAFE_DIVIDE(SUM(purchase_value), SUM(spend))

-- CPA (Costo por Adquisicion)
SAFE_DIVIDE(SUM(spend), SUM(purchase_count))

-- AOV (Average Order Value)
SAFE_DIVIDE(SUM(purchase_value), SUM(purchase_count))

-- Conversion Rate
SAFE_DIVIDE(SUM(purchase_count), SUM(action_link_click))
```

### Metricas de Video / Creative Analytics

```sql
-- Thumbstop Rate (Capacidad de captar atencion)
SAFE_DIVIDE(SUM(action_video_view), SUM(impressions))

-- Hold Rate (Capacidad de retener)
SAFE_DIVIDE(SUM(video_p50_watched_actions), SUM(video_play_actions))

-- Completion Rate (Visualizacion completa)
SAFE_DIVIDE(SUM(video_p95_watched_actions), SUM(video_play_actions))
```

---

## E-commerce Funnel Completo

### Metricas del Funnel

El funnel de e-commerce esta completamente disponible en las entities de performance:

| Paso | Metrica Count | Metrica Value | Rate |
|------|---------------|---------------|------|
| **1. View Content** | `view_content` | `view_content_value` | - |
| **2. Add to Cart** | `add_to_cart` | `add_to_cart_value` | `atc_rate` |
| **3. Initiate Checkout** | `initiate_checkout` | `initiate_checkout_value` | `checkout_rate` |
| **4. Purchase** | `purchase_count` | `purchase_value` | `purchase_rate` |

### Tasas de Conversion del Funnel

| Metrica | Label | Formula | Descripcion |
|---------|-------|---------|-------------|
| `atc_rate` | Add to Cart Rate | add_to_cart / view_content | % que agrega al carrito |
| `checkout_rate` | Checkout Rate | initiate_checkout / add_to_cart | % que inicia checkout |
| `purchase_rate` | Purchase Rate | purchase / initiate_checkout | % que completa compra |
| `overall_conversion_rate` | Conversion Rate Total | purchase / view_content | Conversion total del funnel |

### Disponibilidad por Entity

| Entity | Funnel Counts | Funnel Values | Funnel Rates |
|--------|---------------|---------------|--------------|
| `fact_meta_performance_campaign` | ✅ | ✅ | ✅ |
| `fact_meta_performance_adset` | ✅ | ✅ | ✅ |
| `fact_meta_performance_ad` | ✅ | ✅ | ✅ |

---

## 5. Casos de Uso para Analisis

### 5.1 Analisis de Rendimiento de Campanas

**Pregunta:** ¿Cuales campanas tienen mejor ROAS este mes?

```
Dataset: ds_performance_campaign
Metricas: spend, purchase_value, roas
Dimensiones: campaign_name, date_month
Filtros: date >= primer dia del mes
Orden: roas DESC
```

### 5.2 Analisis Demografico

**Pregunta:** ¿Que segmentos de edad/genero convierten mejor?

```
Dataset: ds_breakdown_age_gender
Metricas: spend, conversions, roas
Dimensiones: age, gender
Orden: roas DESC
```

### 5.3 Analisis de Creativos

**Pregunta:** ¿Que creativos tienen mejor engagement inicial?

```
Dataset: ds_performance_ad
Metricas: impressions, thumbstop_rate, hold_rate, completion_rate, roas
Dimensiones: ad_name
Orden: thumbstop_rate DESC
```

### 5.4 Analisis Geografico

**Pregunta:** ¿En que paises tenemos mejor eficiencia de costos?

```
Dataset: ds_breakdown_country
Metricas: spend, conversions, cpc, roas
Dimensiones: country
Orden: roas DESC
```

### 5.5 Analisis de Funnel

**Pregunta:** ¿Donde se pierde el funnel de conversion?

```
Dataset: ds_performance_campaign
Metricas: impressions, clicks, view_content, add_to_cart, initiate_checkout, purchase_count
Dimensiones: campaign_name
Calcular: Tasas de conversion entre cada paso
```

---

## 6. Glosario de Terminos

| Termino | Definicion |
|---------|------------|
| **Impression** | Cada vez que un anuncio se muestra en pantalla |
| **Reach** | Numero de personas unicas que vieron el anuncio |
| **Frequency** | Promedio de veces que cada persona vio el anuncio |
| **CTR** | Click-Through Rate - % de impresiones que generan click |
| **CPC** | Cost Per Click - Costo promedio de cada click |
| **CPM** | Cost Per Mille - Costo por cada 1000 impresiones |
| **CPA** | Cost Per Acquisition - Costo por cada compra |
| **ROAS** | Return On Ad Spend - Revenue generado por cada dolar invertido |
| **AOV** | Average Order Value - Valor promedio de cada orden |
| **Thumbstop Rate** | % de impresiones que logran 3+ segundos de video view |
| **Hold Rate** | % de plays que llegan al 50% del video |
| **Completion Rate** | % de plays que llegan al 95%+ del video |

---

## 7. Notas Tecnicas

### Latencia de Datos
- Los datos de Meta se sincronizan cada **4-6 horas**
- El retraso tipico es de **~24 horas** para datos completos
- Las metricas de conversion pueden tener hasta **7 dias** de atribucion retroactiva

### Limitaciones
- Los datos de breakdown no suman al total debido a superposicion de audiencias
- Las metricas de video solo aplican a anuncios con contenido de video
- El ROAS solo se calcula si hay eventos de purchase configurados

### Multi-Tenant
- Todos los datos estan filtrados por `tenant_id`
- Cada cliente solo ve sus propios datos
- Los SysOwner pueden ver datos de todos los tenants

---

*Documento generado para DataMetricX - RavencoreX*

# DataMetricX - Catálogo de Capa Semántica

## Descripción General

Este documento describe todos los datasets, entidades, atributos y métricas disponibles en la Capa Semántica de DataMetricX para Meta Ads. Esta información permite realizar análisis profundos de rendimiento publicitario para nuestros clientes.

---

## Resumen Ejecutivo

| Categoría | Cantidad |
|-----------|----------|
| **Datasets Totales** | 13 |
| **Datasets de Entidades** | 4 (Campaigns, Ad Sets, Ads, Creatives) |
| **Datasets de Performance** | 9 |
| **Métricas Principales** | 12+ por dataset |
| **Dimensiones de Desglose** | Age/Gender, Country, Platform, Device |

---

## Plataforma: Meta Ads

### Fuente de Datos
- **Base de Datos**: BigQuery
- **Proyecto**: `datametricx-prod`
- **Schema**: `reporting`

---

# DATASETS DE ENTIDADES

## 1. Meta Campaigns (Campañas)

### Información General
| Campo | Valor |
|-------|-------|
| **ID** | `meta_campaigns` |
| **Label** | Meta Ads Campaigns |
| **Descripción** | Metadatos y configuración a nivel de campaña |
| **Categoría** | advertising |
| **Tabla Fuente** | `datametricx-prod.reporting.meta_campaigns` |
| **Primary Key** | `campaign_id` |

### Atributos (Dimensiones)

| ID | Label | Tipo | Descripción | Grupo |
|----|-------|------|-------------|-------|
| `tenant_id` | Tenant ID | string | Identificador del tenant | Sistema |
| `account_id` | Account ID | string | Identificador de cuenta Meta Ads | Cuenta |
| `campaign_id` | Campaign ID | string | Identificador único de la campaña | Campaña |
| `name` | Name | string | Nombre de la campaña | Campaña |
| `status` | Status | string | Estado actual (ACTIVE, PAUSED, ARCHIVED, DELETED) | Estado |
| `effective_status` | Effective Status | string | Estado efectivo considerando entidades padre | Estado |
| `objective` | Objective | string | Objetivo de marketing (CONVERSIONS, TRAFFIC, etc.) | Configuración |
| `buying_type` | Buying Type | string | Tipo de compra (Auction, Reserved) | Configuración |

### Dimensiones Temporales

| Dimensión | Descripción | Granularidades |
|-----------|-------------|----------------|
| `created_time` | Fecha de creación | raw, time, date, week, month, quarter, year |
| `updated_time` | Última actualización | raw, time, date, week, month, quarter, year |
| `start_time` | Fecha de inicio | raw, time, date, week, month, quarter, year |
| `stop_time` | Fecha de finalización | raw, time, date, week, month, quarter, year |

### Métricas

| ID | Label | Tipo | Agregación | Formato | Descripción |
|----|-------|------|------------|---------|-------------|
| `daily_budget` | Daily Budget | currency | SUM | $#,##0.00 | Presupuesto diario total |
| `lifetime_budget` | Lifetime Budget | currency | SUM | $#,##0.00 | Presupuesto de vida total |
| `budget_remaining` | Budget Remaining | currency | SUM | $#,##0.00 | Presupuesto restante |
| `count` | Count | number | COUNT | #,##0 | Número de campañas |
| `avg_daily_budget` | Avg Daily Budget | currency | AVG | $#,##0.00 | Presupuesto diario promedio |

### Campos Calculados

| ID | Tipo | Fórmula | Descripción |
|----|------|---------|-------------|
| `is_active` | yesno | `status = 'ACTIVE'` | Si la campaña está activa |
| `budget_type` | string | `CASE WHEN daily_budget > 0 THEN 'Daily' ELSE 'Lifetime' END` | Tipo de presupuesto |
| `days_running` | number | `DATE_DIFF(CURRENT_DATE(), start_time, DAY)` | Días en ejecución |

---

## 2. Meta Ad Sets (Conjuntos de Anuncios)

### Información General
| Campo | Valor |
|-------|-------|
| **ID** | `meta_adsets` |
| **Label** | Meta Ads Ad Sets |
| **Descripción** | Metadatos y configuración de presupuesto a nivel de ad set |
| **Tabla Fuente** | `datametricx-prod.reporting.meta_adsets` |
| **Primary Key** | `adset_id` |

### Atributos (Dimensiones)

| ID | Label | Tipo | Descripción | Grupo |
|----|-------|------|-------------|-------|
| `adset_id` | Ad Set ID | string | Identificador único del ad set | Ad Set |
| `name` | Name | string | Nombre del ad set | Ad Set |
| `account_id` | Account ID | string | ID de cuenta Meta Ads | Cuenta |
| `campaign_id` | Campaign ID | string | ID de campaña padre | Relación |
| `status` | Status | string | Estado actual | Estado |
| `effective_status` | Effective Status | string | Estado efectivo | Estado |
| `optimization_goal` | Optimization Goal | string | Objetivo de optimización | Configuración |
| `bid_strategy` | Bid Strategy | string | Estrategia de puja (LOWEST_COST_WITH_BID_CAP, etc.) | Configuración |

### Métricas

| ID | Label | Tipo | Agregación | Formato |
|----|-------|------|------------|---------|
| `daily_budget` | Daily Budget | currency | SUM | $#,##0.00 |
| `lifetime_budget` | Lifetime Budget | currency | SUM | $#,##0.00 |
| `count` | Count | number | COUNT | #,##0 |
| `avg_daily_budget` | Avg Daily Budget | currency | AVG | $#,##0.00 |

---

## 3. Meta Ads (Anuncios)

### Información General
| Campo | Valor |
|-------|-------|
| **ID** | `meta_ads` |
| **Label** | Meta Ads Ads |
| **Descripción** | Metadatos y configuración de creativos a nivel de anuncio |
| **Tabla Fuente** | `datametricx-prod.reporting.meta_ads` |
| **Primary Key** | `ad_id` |

### Atributos (Dimensiones)

| ID | Label | Tipo | Descripción | Grupo |
|----|-------|------|-------------|-------|
| `ad_id` | Ad ID | string | Identificador único del anuncio | Anuncio |
| `ad_name` | Ad Name | string | Nombre del anuncio | Anuncio |
| `adset_id` | Ad Set ID | string | ID del ad set padre | Relación |
| `campaign_id` | Campaign ID | string | ID de campaña padre | Relación |
| `status` | Status | string | Estado actual | Estado |
| `creative_id` | Creative ID | string | ID del creativo asociado | Creativo |
| `effective_status` | Effective Status | string | Estado efectivo | Estado |
| `bid_type` | Bid Type | string | Tipo de puja | Configuración |

### Métricas

| ID | Label | Tipo | Agregación | Formato |
|----|-------|------|------------|---------|
| `count` | Count | number | COUNT | #,##0 |
| `count_active` | Active Ads | number | COUNT | #,##0 |

### Campos Calculados

| ID | Tipo | Descripción |
|----|------|-------------|
| `is_active` | yesno | Si el anuncio está activo |
| `is_effectively_active` | yesno | Si el anuncio está efectivamente en ejecución |
| `days_since_created` | number | Días desde la creación |
| `days_since_updated` | number | Días desde la última actualización |

---

## 4. Meta Creatives (Creativos)

### Información General
| Campo | Valor |
|-------|-------|
| **ID** | `meta_creatives` |
| **Label** | Meta Ads Creatives |
| **Descripción** | Assets creativos y sus métricas de rendimiento |
| **Tabla Fuente** | `datametricx-prod.reporting.meta_creatives` |
| **Primary Key** | `creative_id` |

### Atributos (Dimensiones)

| ID | Label | Tipo | Descripción | Grupo |
|----|-------|------|-------------|-------|
| `creative_id` | Creative ID | string | Identificador único del creativo | Creativo |
| `creative_name` | Creative Name | string | Nombre del creativo | Creativo |
| `title` | Title | string | Texto del título | Contenido |
| `body` | Body | string | Texto del cuerpo | Contenido |
| `call_to_action_type` | CTA Type | string | Tipo de call-to-action | Contenido |
| `image_url` | Image URL | string | URL de la imagen | Media |
| `video_id` | Video ID | string | ID del video (si aplica) | Media |
| `link_url` | Link URL | string | URL de destino | Contenido |
| `object_type` | Object Type | string | Tipo de creativo (IMAGE, VIDEO, CAROUSEL, COLLECTION) | Tipo |
| `thumbnail_url` | Thumbnail URL | string | URL de miniatura | Media |

### Métricas

| ID | Label | Tipo | Agregación | Formato | Descripción |
|----|-------|------|------------|---------|-------------|
| `impressions` | Impressions | number | SUM | #,##0 | Total de impresiones |
| `clicks` | Clicks | number | SUM | #,##0 | Total de clics |
| `spend` | Spend | currency | SUM | $#,##0.00 | Gasto total |
| `conversions` | Conversions | number | SUM | #,##0 | Total de conversiones |
| `count` | Count | number | COUNT | #,##0 | Creativos únicos |

### Campos Calculados

| ID | Tipo | Fórmula | Formato | Descripción |
|----|------|---------|---------|-------------|
| `ctr` | number | `clicks / impressions * 100` | #,##0.00% | Click-through rate |
| `conversion_rate` | number | `conversions / clicks * 100` | #,##0.00% | Tasa de conversión |
| `cpc` | number | `spend / clicks` | $#,##0.00 | Costo por clic |
| `cpa` | number | `spend / conversions` | $#,##0.00 | Costo por adquisición |
| `is_video` | yesno | `object_type = 'VIDEO'` | - | Si es video |
| `is_image` | yesno | `object_type = 'IMAGE'` | - | Si es imagen |
| `has_cta` | yesno | `call_to_action_type IS NOT NULL` | - | Si tiene CTA |
| `title_length` | number | `LENGTH(title)` | #,##0 | Longitud del título |
| `body_length` | number | `LENGTH(body)` | #,##0 | Longitud del cuerpo |

---

# DATASETS DE PERFORMANCE

## 5. Campaign Daily Performance

### Información General
| Campo | Valor |
|-------|-------|
| **ID** | `meta_performance_campaign_daily` |
| **Label** | Campaign Daily Performance |
| **Descripción** | Métricas de rendimiento diario a nivel de campaña |
| **Tabla Fuente** | `datametricx-prod.reporting.meta_performance_campaign_daily` |
| **Primary Key** | `date, campaign_id` |
| **Granularidad** | Diaria |

### Atributos (Dimensiones)

| ID | Label | Tipo | Descripción |
|----|-------|------|-------------|
| `account_id` | Account ID | string | Identificador de cuenta |
| `campaign_id` | Campaign ID | string | Identificador de campaña |
| `campaign_name` | Campaign Name | string | Nombre de la campaña |
| `objective` | Objective | string | Objetivo de marketing |
| `status` | Status | string | Estado de la campaña |

### Dimensiones Temporales

| ID | Tipo | Descripción |
|----|------|-------------|
| `date` | DATE | Fecha de las métricas |
| `date_start` | DATE | Inicio del período de reporte |
| `date_stop` | DATE | Fin del período de reporte |

### Métricas Base

| ID | Label | Tipo | Agregación | Formato | Descripción |
|----|-------|------|------------|---------|-------------|
| `impressions` | Impressions | number | SUM | #,##0 | Número total de veces que se mostraron los anuncios |
| `clicks` | Clicks | number | SUM | #,##0 | Número total de clics |
| `spend` | Spend | currency | SUM | $#,##0.00 | Monto total gastado |
| `reach` | Reach | number | SUM | #,##0 | Número de personas únicas alcanzadas |
| `frequency` | Frequency | number | AVG | #,##0.00 | Promedio de veces que cada persona vio el anuncio |
| `actions` | Actions | number | SUM | #,##0 | Número total de acciones |
| `conversions` | Conversions | number | SUM | #,##0 | Número total de conversiones |
| `conversions_value` | Conversions Value | currency | SUM | $#,##0.00 | Valor total de las conversiones |

### Métricas Calculadas

| ID | Label | Fórmula | Formato | Descripción |
|----|-------|---------|---------|-------------|
| `ctr` | CTR | `clicks / impressions * 100` | #,##0.00% | Click-through rate |
| `cpc` | CPC | `spend / clicks` | $#,##0.00 | Costo por clic |
| `cpm` | CPM | `spend / impressions * 1000` | $#,##0.00 | Costo por mil impresiones |
| `cost_per_conversion` | Cost per Conversion | `spend / conversions` | $#,##0.00 | Costo promedio por conversión |
| `roas` | ROAS | `conversions_value / spend` | #,##0.00 | Retorno sobre gasto publicitario |
| `conversion_rate` | Conversion Rate | `conversions / clicks * 100` | #,##0.00% | Tasa de conversión |
| `profit` | Profit | `conversions_value - spend` | $#,##0.00 | Valor de conversiones menos gasto |

---

## 6. Ad Set Daily Performance

### Información General
| Campo | Valor |
|-------|-------|
| **ID** | `meta_performance_adset_daily` |
| **Label** | Ad Set Daily Performance |
| **Descripción** | Métricas de rendimiento diario a nivel de ad set |
| **Tabla Fuente** | `datametricx-prod.reporting.meta_performance_adset_daily` |
| **Primary Key** | `date, adset_id` |
| **Granularidad** | Diaria |

### Atributos Adicionales

| ID | Label | Tipo | Descripción |
|----|-------|------|-------------|
| `adset_id` | Ad Set ID | string | Identificador del ad set |
| `adset_name` | Ad Set Name | string | Nombre del ad set |
| `campaign_id` | Campaign ID | string | ID de campaña padre |
| `campaign_name` | Campaign Name | string | Nombre de la campaña padre |

*Métricas: Mismas que Campaign Daily Performance*

---

## 7. Ad Daily Performance

### Información General
| Campo | Valor |
|-------|-------|
| **ID** | `meta_performance_ad_daily` |
| **Label** | Ad Daily Performance |
| **Descripción** | Métricas de rendimiento diario a nivel de anuncio |
| **Tabla Fuente** | `datametricx-prod.reporting.meta_performance_ad_daily` |
| **Primary Key** | `date, ad_id` |
| **Granularidad** | Diaria |

### Atributos Adicionales

| ID | Label | Tipo | Descripción |
|----|-------|------|-------------|
| `ad_id` | Ad ID | string | Identificador del anuncio |
| `ad_name` | Ad Name | string | Nombre del anuncio |
| `adset_id` | Ad Set ID | string | ID del ad set padre |
| `adset_name` | Ad Set Name | string | Nombre del ad set |

*Métricas: Mismas que Campaign Daily Performance*

---

# DATASETS DE DESGLOSE (BREAKDOWN)

## 8. Campaign Age & Gender Performance

### Información General
| Campo | Valor |
|-------|-------|
| **ID** | `meta_performance_campaign_age_gender` |
| **Label** | Campaign Age & Gender Performance |
| **Descripción** | Rendimiento de campaña desglosado por edad y género |
| **Primary Key** | `date, campaign_id, age, gender` |

### Dimensiones de Desglose

| ID | Label | Valores Posibles | Descripción |
|----|-------|------------------|-------------|
| `age` | Age | 13-17, 18-24, 25-34, 35-44, 45-54, 55-64, 65+ | Rango de edad |
| `gender` | Gender | male, female, unknown | Género |

### Casos de Uso
- Análisis demográfico de audiencia
- Optimización de targeting por edad y género
- Identificación de segmentos de mejor rendimiento
- Comparación de CTR y conversion rate por demografía

---

## 9. Campaign Country Performance

### Información General
| Campo | Valor |
|-------|-------|
| **ID** | `meta_performance_campaign_country` |
| **Label** | Campaign Country Performance |
| **Descripción** | Rendimiento de campaña desglosado por país |
| **Primary Key** | `date, campaign_id, country` |

### Dimensiones de Desglose

| ID | Label | Descripción |
|----|-------|-------------|
| `country` | Country | Código de país donde se mostró el anuncio (ISO 3166-1) |

### Casos de Uso
- Análisis de rendimiento geográfico
- Optimización de presupuesto por país
- Identificación de mercados de alto rendimiento
- Expansión geográfica basada en datos

---

## 10. Campaign Platform Performance

### Información General
| Campo | Valor |
|-------|-------|
| **ID** | `meta_performance_campaign_publisher_platform` |
| **Label** | Campaign Platform Performance |
| **Descripción** | Rendimiento de campaña desglosado por plataforma |
| **Primary Key** | `date, campaign_id, publisher_platform` |

### Dimensiones de Desglose

| ID | Label | Valores Posibles | Descripción |
|----|-------|------------------|-------------|
| `publisher_platform` | Platform | facebook, instagram, messenger, audience_network | Plataforma de publicación |

### Casos de Uso
- Comparación de rendimiento entre plataformas
- Optimización de distribución de presupuesto
- Estrategia de contenido por plataforma
- Análisis de audiencia por plataforma

---

## 11. Campaign Impression Device Performance

### Información General
| Campo | Valor |
|-------|-------|
| **ID** | `meta_performance_campaign_impression_device` |
| **Label** | Campaign Impression Device Performance |
| **Descripción** | Rendimiento de campaña desglosado por dispositivo de impresión |
| **Primary Key** | `date, campaign_id, impression_device` |

### Dimensiones de Desglose

| ID | Label | Valores Posibles | Descripción |
|----|-------|------------------|-------------|
| `impression_device` | Device | desktop, mobile_app, mobile_web | Tipo de dispositivo |

### Casos de Uso
- Análisis de comportamiento por dispositivo
- Optimización de creativos por dispositivo
- Estrategia de puja por dispositivo
- Experiencia de usuario multiplataforma

---

## 12. Campaign Platform & Device Performance

### Información General
| Campo | Valor |
|-------|-------|
| **ID** | `meta_performance_campaign_platform_device` |
| **Label** | Campaign Platform & Device Performance |
| **Descripción** | Rendimiento de campaña desglosado por posición, plataforma y dispositivo |
| **Primary Key** | `date, campaign_id, platform_position, publisher_platform, device_platform` |

### Dimensiones de Desglose

| ID | Label | Valores Posibles | Descripción |
|----|-------|------------------|-------------|
| `platform_position` | Position | feed, story, reels, right_column, search, etc. | Posición del placement |
| `publisher_platform` | Platform | facebook, instagram, messenger, audience_network | Plataforma |
| `device_platform` | Device | mobile, desktop | Plataforma de dispositivo |

### Casos de Uso
- Análisis detallado de placement
- Optimización de posicionamiento
- Estrategia de contenido por posición
- Análisis cruzado plataforma-dispositivo-posición

---

## 13. Top Creatives Performance

### Información General
| Campo | Valor |
|-------|-------|
| **ID** | `meta_top_creatives_performance` |
| **Label** | Top Creatives Performance |
| **Descripción** | Métricas de rendimiento para los creativos de mejor desempeño |
| **Primary Key** | `creative_id, ad_id` |

### Atributos Especiales

| ID | Label | Tipo | Descripción |
|----|-------|------|-------------|
| `creative_id` | Creative ID | string | ID del creativo |
| `creative_name` | Creative Name | string | Nombre del creativo |
| `object_type` | Object Type | string | Tipo (IMAGE, VIDEO, CAROUSEL, COLLECTION) |
| `title` | Title | string | Texto del título |
| `body` | Body | string | Texto del cuerpo |
| `call_to_action_type` | CTA Type | string | Tipo de CTA |
| `image_url` | Image URL | string | URL de imagen |
| `video_id` | Video ID | string | ID de video |
| `thumbnail_url` | Thumbnail URL | string | URL de miniatura |

### Casos de Uso
- Identificación de creativos ganadores
- Análisis de elementos creativos
- Optimización de copy y diseño
- Benchmarking de creativos
- A/B testing de creativos

---

# GLOSARIO DE MÉTRICAS

## Métricas de Alcance

| Métrica | Definición | Importancia |
|---------|------------|-------------|
| **Impressions** | Número de veces que tu anuncio fue mostrado en pantalla | Medida de visibilidad y alcance |
| **Reach** | Número de personas únicas que vieron tu anuncio | Medida de audiencia alcanzada |
| **Frequency** | Promedio de veces que cada persona vio tu anuncio | Control de saturación de audiencia |

## Métricas de Engagement

| Métrica | Definición | Importancia |
|---------|------------|-------------|
| **Clicks** | Número de clics en tu anuncio | Medida de interés del usuario |
| **CTR** | Porcentaje de impresiones que resultaron en clic | Medida de relevancia del anuncio |
| **Actions** | Acciones tomadas relacionadas con tu anuncio | Medida de engagement total |

## Métricas de Costo

| Métrica | Definición | Importancia |
|---------|------------|-------------|
| **Spend** | Monto total gastado | Medida de inversión |
| **CPC** | Costo promedio por cada clic | Eficiencia de gasto por interacción |
| **CPM** | Costo por mil impresiones | Eficiencia de gasto por visibilidad |

## Métricas de Conversión

| Métrica | Definición | Importancia |
|---------|------------|-------------|
| **Conversions** | Acciones valiosas completadas | Medida de resultados de negocio |
| **Conversion Rate** | Porcentaje de clics que convierten | Eficiencia del funnel |
| **Cost per Conversion** | Costo promedio por conversión | Eficiencia de adquisición |
| **ROAS** | Valor de conversiones / Gasto | Retorno sobre inversión publicitaria |

## Métricas de Valor

| Métrica | Definición | Importancia |
|---------|------------|-------------|
| **Conversions Value** | Valor monetario total de las conversiones | Ingresos generados |
| **Profit** | Conversions Value - Spend | Ganancia neta de publicidad |

---

# FILTROS DISPONIBLES

## Filtros Comunes

| Filtro | Descripción | Valores |
|--------|-------------|---------|
| `date_range` | Rango de fechas | Selector de fechas |
| `status_filter` | Estado de la entidad | ACTIVE, PAUSED, ARCHIVED, DELETED |
| `min_spend` | Gasto mínimo | Numérico |
| `min_impressions` | Impresiones mínimas | Numérico |

## Filtros Específicos

| Filtro | Dataset | Valores |
|--------|---------|---------|
| `objective_filter` | Campaigns | CONVERSIONS, TRAFFIC, REACH, etc. |
| `age_filter` | Age/Gender | 13-17, 18-24, 25-34, 35-44, 45-54, 55-64, 65+ |
| `gender_filter` | Age/Gender | male, female, unknown |
| `platform_filter` | Platform | facebook, instagram, messenger, audience_network |
| `device_filter` | Device | desktop, mobile_app, mobile_web |
| `creative_type_filter` | Creatives | IMAGE, VIDEO, CAROUSEL, COLLECTION |

---

# CASOS DE USO PARA ANÁLISIS

## 1. Análisis de Rendimiento General
- Monitoreo de KPIs principales (Spend, ROAS, CTR, Conversions)
- Tendencias de performance a lo largo del tiempo
- Comparación período vs período

## 2. Análisis de Eficiencia de Gasto
- CPC y CPM por campaña/ad set/ad
- Identificación de campañas con mejor ROAS
- Optimización de presupuesto

## 3. Análisis Demográfico
- Performance por edad y género
- Identificación de audiencias objetivo
- Optimización de targeting

## 4. Análisis Geográfico
- Performance por país
- Expansión de mercados
- Localización de contenido

## 5. Análisis de Plataforma
- Comparación Facebook vs Instagram
- Rendimiento por placement
- Estrategia multicanal

## 6. Análisis de Creativos
- Top performers por tipo
- Elementos de copy efectivos
- Optimización visual

## 7. Análisis de Dispositivo
- Mobile vs Desktop performance
- Optimización de experiencia
- Estrategia de puja por dispositivo

---

*Última actualización: Diciembre 2024*
*Versión: 1.0*

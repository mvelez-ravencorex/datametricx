# Propuesta de Schema para Capa Reporting - Meta Ads

## Resumen

Este documento define la transformación de datos desde la capa **RAW** (append-only, datos crudos) hacia la capa **REPORTING** (datos limpios, desanidados, listos para consumo).

---

## Arquitectura de Capas

```
┌─────────────────────────────────────────────────────────────────┐
│                     Meta Marketing API                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAPA RAW (Bronze)                            │
│  - Append-only, histórico completo                              │
│  - Particionado por _ingestion_time                             │
│  - Campos JSON sin procesar                                     │
│  - Dataset: raw                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                    Scheduled Queries / Views
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 CAPA REPORTING (Silver/Gold)                    │
│  - Datos deduplicados (metadata)                                │
│  - Campos JSON desanidados (UNNEST)                             │
│  - Métricas calculadas                                          │
│  - Particionado por date o extracted_at                         │
│  - Dataset: reporting                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Campos JSON a Desanidar (UNNEST)

| Tabla | Campo JSON | Tipo | Contenido |
|-------|------------|------|-----------|
| **meta_ads** | `creative` | JSON Object | ID, nombre y configuración del creative |
| **meta_creatives** | `object_story_spec` | JSON Object | Especificación del post (link_data, video_data, etc.) |
| **meta_creatives** | `asset_feed_spec` | JSON Object | Assets dinámicos del creative |
| **meta_performance_ad_daily** | `actions` | JSON Array | Conteo de acciones por tipo |
| **meta_performance_ad_daily** | `action_values` | JSON Array | Valor monetario de acciones |
| **meta_performance_adset_daily** | `actions` | JSON Array | Conteo de acciones por tipo |
| **meta_performance_adset_daily** | `action_values` | JSON Array | Valor monetario de acciones |
| **meta_performance_campaign_daily** | `actions` | JSON Array | Conteo de acciones por tipo |
| **meta_performance_campaign_daily** | `action_values` | JSON Array | Valor monetario de acciones |
| **meta_performance_campaign_daily** | `cost_per_action_type` | JSON Array | Costo por tipo de acción |

---

## Tablas de Metadata

### 1. meta_campaigns

**Transformación:** Deduplicación - última versión por campaign_id

**Sin campos JSON** - Schema se mantiene igual.

```sql
-- Query de transformación RAW → REPORTING
SELECT * EXCEPT(row_num)
FROM (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, campaign_id
      ORDER BY _ingestion_time DESC
    ) as row_num
  FROM `raw.meta_campaigns`
)
WHERE row_num = 1
```

---

### 2. meta_adsets

**Transformación:** Deduplicación - última versión por adset_id

**Sin campos JSON** - Schema se mantiene igual.

```sql
SELECT * EXCEPT(row_num)
FROM (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, adset_id
      ORDER BY _ingestion_time DESC
    ) as row_num
  FROM `raw.meta_adsets`
)
WHERE row_num = 1
```

---

### 3. meta_ads

**Campo JSON:** `creative`

**Estructura del JSON `creative`:**
```json
{
  "id": "123456789",
  "name": "Creative Name",
  "title": "Ad Title",
  "body": "Ad body text",
  "image_url": "https://...",
  "thumbnail_url": "https://...",
  "call_to_action_type": "LEARN_MORE",
  "object_story_id": "page_id_post_id",
  "effective_object_story_id": "page_id_post_id"
}
```

**Query de transformación:**

```sql
SELECT
  tenant_id,
  account_id,
  ad_id,
  adset_id,
  campaign_id,
  name,
  status,
  effective_status,
  created_time,
  updated_time,
  extracted_at,
  _ingestion_time,

  -- Campos extraídos de creative JSON
  JSON_EXTRACT_SCALAR(creative, '$.id') as creative_id,
  JSON_EXTRACT_SCALAR(creative, '$.name') as creative_name,
  JSON_EXTRACT_SCALAR(creative, '$.title') as creative_title,
  JSON_EXTRACT_SCALAR(creative, '$.body') as creative_body,
  JSON_EXTRACT_SCALAR(creative, '$.image_url') as creative_image_url,
  JSON_EXTRACT_SCALAR(creative, '$.thumbnail_url') as creative_thumbnail_url,
  JSON_EXTRACT_SCALAR(creative, '$.call_to_action_type') as creative_cta_type,
  JSON_EXTRACT_SCALAR(creative, '$.object_story_id') as creative_object_story_id,
  JSON_EXTRACT_SCALAR(creative, '$.effective_object_story_id') as creative_effective_story_id,

  -- JSON original para referencia
  creative as creative_json

FROM (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, ad_id
      ORDER BY _ingestion_time DESC
    ) as row_num
  FROM `raw.meta_ads`
)
WHERE row_num = 1
```

**Schema Reporting - Campos Nuevos:**

| Campo Nuevo | Tipo | Origen |
|-------------|------|--------|
| creative_id | STRING | creative.id |
| creative_name | STRING | creative.name |
| creative_title | STRING | creative.title |
| creative_body | STRING | creative.body |
| creative_image_url | STRING | creative.image_url |
| creative_thumbnail_url | STRING | creative.thumbnail_url |
| creative_cta_type | STRING | creative.call_to_action_type |
| creative_object_story_id | STRING | creative.object_story_id |
| creative_effective_story_id | STRING | creative.effective_object_story_id |
| creative_json | JSON | JSON original (backup) |

---

### 4. meta_creatives

**Campos JSON:** `object_story_spec`, `asset_feed_spec`

**Estructura de `object_story_spec`:**
```json
{
  "page_id": "123456789",
  "link_data": {
    "link": "https://example.com",
    "message": "Post message text",
    "name": "Link title",
    "description": "Link description",
    "caption": "example.com",
    "picture": "https://...",
    "call_to_action": {
      "type": "LEARN_MORE",
      "value": {"link": "https://..."}
    }
  },
  "video_data": {
    "video_id": "987654321",
    "title": "Video title",
    "message": "Video description",
    "call_to_action": {"type": "WATCH_MORE"}
  },
  "photo_data": {
    "url": "https://..."
  }
}
```

**Estructura de `asset_feed_spec`:**
```json
{
  "images": [
    {"hash": "abc123", "url": "https://..."},
    {"hash": "def456", "url": "https://..."}
  ],
  "videos": [
    {"video_id": "123", "thumbnail_url": "https://..."}
  ],
  "bodies": [
    {"text": "Body text 1"},
    {"text": "Body text 2"}
  ],
  "titles": [
    {"text": "Title 1"},
    {"text": "Title 2"}
  ],
  "descriptions": [
    {"text": "Description 1"}
  ],
  "call_to_action_types": ["LEARN_MORE", "SHOP_NOW"],
  "link_urls": [
    {"website_url": "https://..."}
  ],
  "ad_formats": ["SINGLE_IMAGE", "CAROUSEL"]
}
```

**Query de transformación:**

```sql
SELECT
  tenant_id,
  account_id,
  ad_id,
  ad_name,
  ad_status,
  ad_effective_status,
  adset_id,
  creative_id,
  creative_name,
  effective_object_story_id,
  title,
  body,
  image_url,
  thumbnail_url,
  link_caption,
  link_description,
  link_message,
  call_to_action_type,
  extracted_at,
  _ingestion_time,

  -- Campos extraídos de object_story_spec
  JSON_EXTRACT_SCALAR(object_story_spec, '$.page_id') as page_id,
  JSON_EXTRACT_SCALAR(object_story_spec, '$.link_data.link') as link_url,
  JSON_EXTRACT_SCALAR(object_story_spec, '$.link_data.message') as link_post_message,
  JSON_EXTRACT_SCALAR(object_story_spec, '$.link_data.name') as link_title,
  JSON_EXTRACT_SCALAR(object_story_spec, '$.link_data.description') as link_description_full,
  JSON_EXTRACT_SCALAR(object_story_spec, '$.link_data.caption') as link_domain,
  JSON_EXTRACT_SCALAR(object_story_spec, '$.link_data.picture') as link_picture_url,
  JSON_EXTRACT_SCALAR(object_story_spec, '$.link_data.call_to_action.type') as link_cta_type,
  JSON_EXTRACT_SCALAR(object_story_spec, '$.video_data.video_id') as video_id,
  JSON_EXTRACT_SCALAR(object_story_spec, '$.video_data.title') as video_title,
  JSON_EXTRACT_SCALAR(object_story_spec, '$.video_data.message') as video_message,
  JSON_EXTRACT_SCALAR(object_story_spec, '$.video_data.call_to_action.type') as video_cta_type,
  JSON_EXTRACT_SCALAR(object_story_spec, '$.photo_data.url') as photo_url,

  -- Campos extraídos de asset_feed_spec (para Dynamic Ads)
  ARRAY_LENGTH(JSON_EXTRACT_ARRAY(asset_feed_spec, '$.images')) as asset_image_count,
  ARRAY_LENGTH(JSON_EXTRACT_ARRAY(asset_feed_spec, '$.videos')) as asset_video_count,
  ARRAY_LENGTH(JSON_EXTRACT_ARRAY(asset_feed_spec, '$.bodies')) as asset_body_variations,
  ARRAY_LENGTH(JSON_EXTRACT_ARRAY(asset_feed_spec, '$.titles')) as asset_title_variations,
  JSON_EXTRACT_SCALAR(asset_feed_spec, '$.call_to_action_types[0]') as asset_primary_cta,
  JSON_EXTRACT_SCALAR(asset_feed_spec, '$.link_urls[0].website_url') as asset_primary_url,
  JSON_EXTRACT_SCALAR(asset_feed_spec, '$.ad_formats[0]') as asset_primary_format,

  -- Tipo de creative detectado
  CASE
    WHEN JSON_EXTRACT(object_story_spec, '$.video_data') IS NOT NULL THEN 'VIDEO'
    WHEN JSON_EXTRACT(object_story_spec, '$.photo_data') IS NOT NULL THEN 'PHOTO'
    WHEN JSON_EXTRACT(object_story_spec, '$.link_data') IS NOT NULL THEN 'LINK'
    WHEN JSON_EXTRACT(asset_feed_spec, '$.videos') IS NOT NULL THEN 'DYNAMIC_VIDEO'
    WHEN JSON_EXTRACT(asset_feed_spec, '$.images') IS NOT NULL THEN 'DYNAMIC_IMAGE'
    ELSE 'OTHER'
  END as creative_type,

  -- JSON originales para referencia
  object_story_spec as object_story_spec_json,
  asset_feed_spec as asset_feed_spec_json

FROM (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, creative_id
      ORDER BY _ingestion_time DESC
    ) as row_num
  FROM `raw.meta_creatives`
)
WHERE row_num = 1
```

**Schema Reporting - Campos Nuevos:**

| Campo Nuevo | Tipo | Origen |
|-------------|------|--------|
| page_id | STRING | object_story_spec.page_id |
| link_url | STRING | object_story_spec.link_data.link |
| link_post_message | STRING | object_story_spec.link_data.message |
| link_title | STRING | object_story_spec.link_data.name |
| link_description_full | STRING | object_story_spec.link_data.description |
| link_domain | STRING | object_story_spec.link_data.caption |
| link_picture_url | STRING | object_story_spec.link_data.picture |
| link_cta_type | STRING | object_story_spec.link_data.call_to_action.type |
| video_id | STRING | object_story_spec.video_data.video_id |
| video_title | STRING | object_story_spec.video_data.title |
| video_message | STRING | object_story_spec.video_data.message |
| video_cta_type | STRING | object_story_spec.video_data.call_to_action.type |
| photo_url | STRING | object_story_spec.photo_data.url |
| asset_image_count | INT64 | COUNT(asset_feed_spec.images) |
| asset_video_count | INT64 | COUNT(asset_feed_spec.videos) |
| asset_body_variations | INT64 | COUNT(asset_feed_spec.bodies) |
| asset_title_variations | INT64 | COUNT(asset_feed_spec.titles) |
| asset_primary_cta | STRING | asset_feed_spec.call_to_action_types[0] |
| asset_primary_url | STRING | asset_feed_spec.link_urls[0].website_url |
| asset_primary_format | STRING | asset_feed_spec.ad_formats[0] |
| creative_type | STRING | Calculado (VIDEO/PHOTO/LINK/DYNAMIC) |

---

## Tablas de Performance

### Estructura de Arrays JSON Comunes

#### Array `actions`:
```json
[
  {"action_type": "link_click", "value": "150"},
  {"action_type": "landing_page_view", "value": "120"},
  {"action_type": "post_engagement", "value": "200"},
  {"action_type": "page_engagement", "value": "180"},
  {"action_type": "purchase", "value": "12"},
  {"action_type": "add_to_cart", "value": "45"},
  {"action_type": "video_view", "value": "500"},
  {"action_type": "comment", "value": "25"},
  {"action_type": "post_reaction", "value": "150"},
  {"action_type": "post_save", "value": "30"},
  {"action_type": "post_share", "value": "20"},
  {"action_type": "onsite_conversion.messaging_conversation_started_7d", "value": "10"}
]
```

#### Array `action_values` (valores monetarios):
```json
[
  {"action_type": "purchase", "value": "1250.50"},
  {"action_type": "add_to_cart", "value": "890.25"},
  {"action_type": "initiate_checkout", "value": "650.00"},
  {"action_type": "view_content", "value": "320.75"},
  {"action_type": "lead", "value": "450.00"},
  {"action_type": "omni_purchase", "value": "1500.00"}
]
```

#### Array `cost_per_action_type`:
```json
[
  {"action_type": "link_click", "value": "0.45"},
  {"action_type": "landing_page_view", "value": "0.85"},
  {"action_type": "purchase", "value": "25.50"},
  {"action_type": "add_to_cart", "value": "3.25"},
  {"action_type": "lead", "value": "15.00"},
  {"action_type": "video_view", "value": "0.02"}
]
```

---

### 5. meta_performance_campaign_daily

**Campos JSON:** `actions`, `action_values`, `cost_per_action_type`

**Query de transformación completa:**

```sql
SELECT
  tenant_id,
  account_id,
  date,
  campaign_id,
  campaign_name,

  -- Métricas base (sin cambios)
  impressions,
  reach,
  frequency,
  spend,
  cpm,
  cpc,
  cpp,
  clicks,
  ctr,
  inline_link_clicks,
  unique_clicks,
  unique_ctr,
  unique_inline_link_clicks,
  unique_inline_link_click_ctr,

  -- Video métricas base
  video_plays,
  video_play_actions,
  video_avg_time_watched_actions,
  video_p25_watched_actions,
  video_p50_watched_actions,
  video_p75_watched_actions,
  video_p95_watched_actions,

  -- Conversiones ya extraídas
  conversions,
  purchase_count,
  purchase_value,
  purchase_roas,
  add_to_cart_count,
  add_to_cart_value,
  initiate_checkout_count,
  initiate_checkout_value,
  view_content_count,
  view_content_value,
  add_to_wishlist_count,
  add_to_wishlist_value,
  lead_count,
  lead_value,
  complete_registration_count,
  complete_registration_value,
  cost_per_conversion,

  -- Quality & Ranking
  quality_score_organic,
  engagement_rate_ranking,
  conversion_rate_ranking,
  attribution_setting,

  -- =====================================================
  -- CAMPOS DESANIDADOS DE actions (conteos)
  -- =====================================================
  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'link_click') as action_link_click,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'landing_page_view') as action_landing_page_view,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'post_engagement') as action_post_engagement,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'page_engagement') as action_page_engagement,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'video_view') as action_video_view,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'comment') as action_comment,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'post_reaction') as action_reaction,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'post_save') as action_save,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'post_share') as action_share,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'photo_view') as action_photo_view,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'video_play') as action_video_play,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') LIKE 'onsite_conversion.messaging%') as action_messaging_started,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'onsite_conversion.messaging_first_reply') as action_messaging_reply,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'add_payment_info') as action_add_payment_info,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'search') as action_search,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'subscribe') as action_subscribe,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'contact') as action_contact,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'omni_purchase') as action_omni_purchase,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'omni_add_to_cart') as action_omni_add_to_cart,

  -- =====================================================
  -- CAMPOS DESANIDADOS DE action_values (valores monetarios)
  -- =====================================================
  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'omni_purchase') as value_omni_purchase,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'omni_add_to_cart') as value_omni_add_to_cart,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'omni_initiated_checkout') as value_omni_checkout,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'omni_view_content') as value_omni_view_content,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'add_payment_info') as value_add_payment_info,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'subscribe') as value_subscribe,

  -- =====================================================
  -- CAMPOS DESANIDADOS DE cost_per_action_type
  -- =====================================================
  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(cost_per_action_type)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'link_click') as cpa_link_click,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(cost_per_action_type)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'landing_page_view') as cpa_landing_page_view,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(cost_per_action_type)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'purchase') as cpa_purchase,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(cost_per_action_type)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'add_to_cart') as cpa_add_to_cart,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(cost_per_action_type)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'initiate_checkout') as cpa_checkout,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(cost_per_action_type)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'lead') as cpa_lead,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(cost_per_action_type)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'video_view') as cpa_video_view,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(cost_per_action_type)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'post_engagement') as cpa_post_engagement,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(cost_per_action_type)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'complete_registration') as cpa_registration,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(cost_per_action_type)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') LIKE 'onsite_conversion.messaging%') as cpa_messaging,

  -- =====================================================
  -- MÉTRICAS CALCULADAS
  -- =====================================================
  SAFE_DIVIDE(spend, NULLIF(lead_count, 0)) as calc_cost_per_lead,
  SAFE_DIVIDE(spend, NULLIF(purchase_count, 0)) as calc_cost_per_purchase,
  SAFE_DIVIDE(conversions, NULLIF(clicks, 0)) * 100 as calc_conversion_rate,
  SAFE_DIVIDE(video_p95_watched_actions, NULLIF(video_plays, 0)) * 100 as calc_video_completion_rate,
  SAFE_DIVIDE(purchase_value, NULLIF(purchase_count, 0)) as calc_avg_order_value,

  -- Engagement rate (reacciones + comentarios + shares + saves) / impressions
  SAFE_DIVIDE(
    COALESCE((SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
     FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
     WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'post_engagement'), 0),
    NULLIF(impressions, 0)
  ) * 100 as calc_engagement_rate,

  -- Metadata
  extracted_at,
  _ingestion_time,

  -- JSON originales para referencia
  actions as actions_json,
  action_values as action_values_json,
  cost_per_action_type as cost_per_action_type_json

FROM `raw.meta_performance_campaign_daily`
```

---

### 6. meta_performance_adset_daily

**Campos JSON:** `actions`, `action_values`

**Query de transformación:**

```sql
SELECT
  tenant_id,
  account_id,
  date,
  campaign_id,
  campaign_name,
  adset_id,
  adset_name,

  -- Métricas base
  impressions, reach, frequency, spend, cpm, cpc, clicks, ctr,
  unique_clicks, unique_ctr, conversions,
  purchase_count, purchase_value, purchase_roas,
  add_to_cart_count, initiate_checkout_count, view_content_count,

  -- =====================================================
  -- CAMPOS DESANIDADOS DE actions
  -- =====================================================
  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'link_click') as action_link_click,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'landing_page_view') as action_landing_page_view,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'post_engagement') as action_post_engagement,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'page_engagement') as action_page_engagement,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'video_view') as action_video_view,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'comment') as action_comment,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'post_reaction') as action_reaction,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'post_save') as action_save,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'post_share') as action_share,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') LIKE 'onsite_conversion.messaging%') as action_messaging_started,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'lead') as action_lead,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'complete_registration') as action_registration,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'omni_purchase') as action_omni_purchase,

  -- =====================================================
  -- CAMPOS DESANIDADOS DE action_values
  -- =====================================================
  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'lead') as value_lead,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'complete_registration') as value_registration,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'omni_purchase') as value_omni_purchase,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'omni_add_to_cart') as value_omni_add_to_cart,

  -- =====================================================
  -- MÉTRICAS CALCULADAS
  -- =====================================================
  SAFE_DIVIDE(spend, NULLIF(purchase_count, 0)) as calc_cost_per_purchase,
  SAFE_DIVIDE(spend, NULLIF(
    (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
     FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
     WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'lead'), 0)) as calc_cost_per_lead,
  SAFE_DIVIDE(conversions, NULLIF(clicks, 0)) * 100 as calc_conversion_rate,

  -- Metadata
  extracted_at,
  _ingestion_time,

  -- JSON originales
  actions as actions_json,
  action_values as action_values_json

FROM `raw.meta_performance_adset_daily`
```

---

### 7. meta_performance_ad_daily

**Campos JSON:** `actions`, `action_values`

**Query de transformación:**

```sql
SELECT
  tenant_id,
  account_id,
  date,
  campaign_id,
  adset_id,
  ad_id,
  ad_name,

  -- Métricas base
  impressions, clicks, ctr, spend, cpc, conversions,
  purchase_value, purchase_roas,

  -- =====================================================
  -- CAMPOS DESANIDADOS DE actions
  -- =====================================================
  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'link_click') as action_link_click,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'landing_page_view') as action_landing_page_view,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'post_engagement') as action_post_engagement,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'page_engagement') as action_page_engagement,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'video_view') as action_video_view,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'comment') as action_comment,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'post_reaction') as action_reaction,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'post_save') as action_save,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'post_share') as action_share,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'purchase') as action_purchase,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'add_to_cart') as action_add_to_cart,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'initiate_checkout') as action_checkout,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'lead') as action_lead,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') LIKE 'onsite_conversion.messaging%') as action_messaging_started,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'omni_purchase') as action_omni_purchase,

  -- =====================================================
  -- CAMPOS DESANIDADOS DE action_values
  -- =====================================================
  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'add_to_cart') as value_add_to_cart,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'initiate_checkout') as value_checkout,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'view_content') as value_view_content,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'lead') as value_lead,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'omni_purchase') as value_omni_purchase,

  (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS FLOAT64)
   FROM UNNEST(JSON_EXTRACT_ARRAY(action_values)) a
   WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'omni_add_to_cart') as value_omni_add_to_cart,

  -- =====================================================
  -- MÉTRICAS CALCULADAS
  -- =====================================================
  SAFE_DIVIDE(spend, NULLIF(conversions, 0)) as calc_cost_per_conversion,
  SAFE_DIVIDE(conversions, NULLIF(clicks, 0)) * 100 as calc_conversion_rate,
  SAFE_DIVIDE(purchase_value, NULLIF(
    (SELECT SAFE_CAST(JSON_EXTRACT_SCALAR(a, '$.value') AS INT64)
     FROM UNNEST(JSON_EXTRACT_ARRAY(actions)) a
     WHERE JSON_EXTRACT_SCALAR(a, '$.action_type') = 'purchase'), 0)) as calc_avg_order_value,

  -- Metadata
  extracted_at,
  _ingestion_time,

  -- JSON originales
  actions as actions_json,
  action_values as action_values_json

FROM `raw.meta_performance_ad_daily`
```

---

### 8-12. Tablas de Breakdown (Sin JSON)

Las siguientes tablas **no tienen campos JSON** que desanidar:
- `meta_performance_campaign_age_gender`
- `meta_performance_campaign_country`
- `meta_performance_campaign_impression_device`
- `meta_performance_campaign_publisher_platform`
- `meta_performance_campaign_platform_device`

**Solo agregar métricas calculadas:**

```sql
-- Métricas adicionales para todas las tablas de breakdown
SAFE_DIVIDE(spend, NULLIF(conversions, 0)) as calc_cost_per_conversion,
SAFE_DIVIDE(purchase_value, NULLIF(spend, 0)) as calc_roas,
SAFE_DIVIDE(clicks, NULLIF(impressions, 0)) * 100 as calc_ctr,
SAFE_DIVIDE(spend, NULLIF(impressions, 0)) * 1000 as calc_cpm
```

---

### 13. meta_top_creatives_performance

**Sin JSON** - Enriquecer con JOIN a meta_creatives:

```sql
SELECT
  p.*,
  c.creative_name,
  c.title as creative_title,
  c.body as creative_body,
  c.image_url as creative_image_url,
  c.thumbnail_url as creative_thumbnail_url,
  c.call_to_action_type as creative_cta_type,
  c.creative_type,

  -- Métricas calculadas
  SAFE_DIVIDE(p.spend, NULLIF(p.conversions, 0)) as calc_cost_per_conversion,
  SAFE_DIVIDE(p.purchase_value, NULLIF(p.spend, 0)) as calc_roas

FROM `raw.meta_top_creatives_performance` p
LEFT JOIN `reporting.meta_creatives` c
  ON p.tenant_id = c.tenant_id
  AND p.creative_id = c.creative_id
```

---

## Resumen de Campos JSON a Desanidar

### Tabla Resumen Completa

| Tabla | Campo JSON | Campos Extraídos |
|-------|------------|------------------|
| **meta_ads** | `creative` | creative_id, creative_name, creative_title, creative_body, creative_image_url, creative_thumbnail_url, creative_cta_type, creative_object_story_id, creative_effective_story_id |
| **meta_creatives** | `object_story_spec` | page_id, link_url, link_post_message, link_title, link_description_full, link_domain, link_picture_url, link_cta_type, video_id, video_title, video_message, video_cta_type, photo_url |
| **meta_creatives** | `asset_feed_spec` | asset_image_count, asset_video_count, asset_body_variations, asset_title_variations, asset_primary_cta, asset_primary_url, asset_primary_format, creative_type |
| **meta_performance_ad_daily** | `actions` | action_link_click, action_landing_page_view, action_post_engagement, action_page_engagement, action_video_view, action_comment, action_reaction, action_save, action_share, action_purchase, action_add_to_cart, action_checkout, action_lead, action_messaging_started, action_omni_purchase |
| **meta_performance_ad_daily** | `action_values` | value_add_to_cart, value_checkout, value_view_content, value_lead, value_omni_purchase, value_omni_add_to_cart |
| **meta_performance_adset_daily** | `actions` | (mismos que ad_daily) |
| **meta_performance_adset_daily** | `action_values` | value_lead, value_registration, value_omni_purchase, value_omni_add_to_cart |
| **meta_performance_campaign_daily** | `actions` | (todos los action_* listados arriba) + action_add_payment_info, action_search, action_subscribe, action_contact |
| **meta_performance_campaign_daily** | `action_values` | value_omni_purchase, value_omni_add_to_cart, value_omni_checkout, value_omni_view_content, value_add_payment_info, value_subscribe |
| **meta_performance_campaign_daily** | `cost_per_action_type` | cpa_link_click, cpa_landing_page_view, cpa_purchase, cpa_add_to_cart, cpa_checkout, cpa_lead, cpa_video_view, cpa_post_engagement, cpa_registration, cpa_messaging |

---

## Tipos de Acciones Comunes de Meta

### Engagement
- `link_click` - Clicks en enlaces
- `landing_page_view` - Vistas de landing page
- `post_engagement` - Engagement total del post
- `page_engagement` - Engagement con la página
- `post_reaction` - Reacciones (likes, love, etc.)
- `comment` - Comentarios
- `post_save` - Guardados
- `post_share` - Compartidos
- `photo_view` - Vistas de foto

### Video
- `video_view` - Vistas de video (3 segundos)
- `video_play` - Reproducciones
- `video_p25_watched` - 25% visto
- `video_p50_watched` - 50% visto
- `video_p75_watched` - 75% visto
- `video_p95_watched` - 95% visto (ThruPlay)
- `video_30_sec_watched` - 30 segundos vistos

### Conversions (Pixel/CAPI)
- `purchase` - Compras
- `add_to_cart` - Agregar al carrito
- `initiate_checkout` - Iniciar checkout
- `add_payment_info` - Agregar info de pago
- `view_content` - Ver contenido
- `search` - Búsquedas
- `complete_registration` - Registro completo
- `lead` - Leads generados
- `subscribe` - Suscripciones
- `contact` - Contactos

### Omnichannel (Online + Offline)
- `omni_purchase` - Compras omnicanal
- `omni_add_to_cart` - Agregar al carrito omnicanal
- `omni_initiated_checkout` - Checkout omnicanal
- `omni_view_content` - Ver contenido omnicanal

### Messaging
- `onsite_conversion.messaging_conversation_started_7d`
- `onsite_conversion.messaging_first_reply`
- `onsite_conversion.messaging_user_depth_2_message_send`
- `onsite_conversion.messaging_user_depth_3_message_send`

---

## Nueva Tabla: meta_actions_detail (Normalizada)

Para análisis flexible de todas las acciones:

```sql
CREATE TABLE reporting.meta_actions_detail (
  tenant_id STRING NOT NULL,
  account_id STRING NOT NULL,
  date DATE NOT NULL,
  level STRING NOT NULL,  -- 'campaign', 'adset', 'ad'
  campaign_id STRING NOT NULL,
  adset_id STRING,
  ad_id STRING,

  -- Dimensión de acción
  action_type STRING NOT NULL,
  action_category STRING,  -- 'engagement', 'conversion', 'video', 'messaging', 'omni'

  -- Métricas
  action_count INT64,
  action_value FLOAT64,
  cost_per_action FLOAT64,

  -- Metadata
  extracted_at TIMESTAMP,
  _ingestion_time TIMESTAMP
)
PARTITION BY date
CLUSTER BY tenant_id, level, action_category, action_type;
```

---

## Implementación

### Fase 1: Scheduled Queries
Crear scheduled queries en BigQuery para transformar RAW → REPORTING diariamente.

### Fase 2: Vistas Materializadas
Para tablas de alta consulta, considerar vistas materializadas.

### Fase 3: dbt (Futuro)
Migrar transformaciones a dbt para mejor mantenimiento y testing.

---

## Checklist de Implementación

- [ ] Aprobar schema propuesto
- [ ] Modificar tablas reporting con nuevos campos
- [ ] Crear scheduled query: meta_campaigns
- [ ] Crear scheduled query: meta_adsets
- [ ] Crear scheduled query: meta_ads
- [ ] Crear scheduled query: meta_creatives
- [ ] Crear scheduled query: meta_performance_campaign_daily
- [ ] Crear scheduled query: meta_performance_adset_daily
- [ ] Crear scheduled query: meta_performance_ad_daily
- [ ] Crear scheduled query: meta_performance_campaign_age_gender
- [ ] Crear scheduled query: meta_performance_campaign_country
- [ ] Crear scheduled query: meta_performance_campaign_impression_device
- [ ] Crear scheduled query: meta_performance_campaign_publisher_platform
- [ ] Crear scheduled query: meta_performance_campaign_platform_device
- [ ] Crear scheduled query: meta_top_creatives_performance
- [ ] (Opcional) Crear tabla meta_actions_detail
- [ ] Ajustar backend-api para usar nuevos campos
- [ ] Documentar en Looker Studio los nuevos campos

---

*Documento creado: 2024-11-28*
*Última actualización: 2024-11-28*
*Versión: 2.0 - Completo con todos los campos JSON*

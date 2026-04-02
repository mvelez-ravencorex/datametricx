# DataMetricX - Resumen de Sesión 2024-12-14

## Cambios Realizados

### 1. Backend API - Operadores de Días Hábiles

**Archivo:** `backend_code/api/main.py`

**Estado:** ✅ Deployado (revisión `datametricx-backend-api-00006-k52`)

Se agregó lógica para procesar operadores de filtro de días hábiles (lunes a viernes):

```python
# Líneas 2037-2046
if operator_lower in DATE_OPERATORS_WORKING_DAYS:
    conditions = DATE_OPERATORS_WORKING_DAYS[operator_lower]
    for i, cond in enumerate(conditions[:-1]):
        where_parts.append(f"{sql_field} {cond}")
    weekday_filter = conditions[-1].replace("{field}", sql_field)
    where_parts.append(weekday_filter)
    continue
```

**Operadores disponibles:**
| Operador | Descripción |
|----------|-------------|
| `last_5_working_days` | Últimos 5 días hábiles |
| `last_10_working_days` | Últimos 10 días hábiles |
| `last_20_working_days` | Últimos 20 días hábiles |
| `this_month_working_days` | Este mes (solo hábiles) |
| `last_month_working_days` | Mes pasado (solo hábiles) |

---

### 2. Nuevos Datasets del Semantic Layer

#### 2.1 ds_creative_deep_dive (Creative Retention)

**Archivos:**
- `gs://datametricx-semantic-models/core/entities/meta/fact_meta_creative_retention.json`
- `gs://datametricx-semantic-models/core/datasets/meta/ds_creative_deep_dive.json`

**Propósito:** Análisis profundo de creativos de video - Hook Rate, Hold Rate, Drop-off Analysis

**Métricas clave (22 total):**
| Métrica | Fórmula | Descripción |
|---------|---------|-------------|
| `play_rate` | video_plays / impressions | % que inician video |
| `hook_rate` | video_3s / impressions | Thumbstop - % que ven 3+ segundos |
| `hold_rate` | video_100% / video_3s | % retención final |
| `completion_rate` | video_100% / video_plays | % que completan |
| `outbound_ctr` | link_clicks / impressions | CTR hacia web |
| `drop_rate_25` | - | % abandono antes del 25% |
| `drop_rate_50` | - | % abandono entre 25-50% |
| `drop_rate_75` | - | % abandono entre 50-75% |
| `drop_rate_100` | - | % abandono entre 75-100% |
| `cost_per_3s_view` | spend / video_3s | Costo por vista 3s |
| `cost_per_completion` | spend / video_100% | Costo por video completo |

---

#### 2.2 ds_campaign_budget_analysis (Budget Utilization)

**Archivos:**
- `gs://datametricx-semantic-models/core/entities/meta/fact_meta_campaign_budget_performance.json`
- `gs://datametricx-semantic-models/core/datasets/meta/ds_campaign_budget_analysis.json`

**Propósito:** Análisis de utilización de presupuesto con JOIN entre performance y campaigns

**Métricas clave (19 total):**
| Métrica | Fórmula | Descripción |
|---------|---------|-------------|
| `budget_utilization` | spend / daily_budget | % del presupuesto usado |
| `budget_efficiency` | revenue / daily_budget | Revenue por $ de budget |
| `budget_gap` | daily_budget - spend | Diferencia (+ = subgasto) |
| `is_underspending` | utilization < 80% | Flag de subgasto |
| `is_overspending` | utilization > 110% | Flag de sobregasto |
| `pacing_status` | - | SEVERELY_UNDERSPENDING / UNDERSPENDING / ON_TRACK / OVERSPENDING |
| `lifetime_utilization` | - | % del lifetime consumido |
| `results_per_budget_dollar` | purchases / daily_budget | Compras por $ asignado |

---

### 3. Métricas Agregadas a ds_performance_campaign

**Archivo:** `gs://datametricx-semantic-models/core/entities/meta/fact_meta_performance_campaign.json`

**Nuevas métricas (+14):**

#### Eficiencia Financiera
| ID | Label | Fórmula |
|----|-------|---------|
| `gross_profit` | Profit Bruto | purchase_value - spend |
| `poas` | POAS | (purchase_value - spend) / spend |
| `mer` | MER | purchase_value / spend |
| `profit_margin` | Margen Profit | profit / revenue |
| `breakeven_roas` | Breakeven ROAS | 1.0x (constante) |

#### Creative Health
| ID | Label | Fórmula |
|----|-------|---------|
| `hook_rate` | Hook Rate | video_3s / impressions |
| `hold_rate` | Hold Rate | video_95% / video_plays |
| `video_completion_rate` | Video Completion | video_95% / video_3s |

#### Eficiencia Conversión
| ID | Label | Fórmula |
|----|-------|---------|
| `click_to_purchase_rate` | Click to Purchase | purchases / clicks |
| `impression_to_purchase_rate` | Impression to Purchase | purchases / impressions |
| `cost_per_impression` | Cost per Impression | spend / impressions |
| `revenue_per_impression` | Revenue per Impression | revenue / impressions |

---

### 4. Campos de Metadata Agregados

**Estado:** ✅ Subido a GCS

Se agregaron a **todas las 15 entidades**:

| Campo | Label | Tipo | Descripción |
|-------|-------|------|-------------|
| `extracted_at` | Fecha Extracción | timestamp | Cuándo se extrajeron de la API |
| `_ingestion_time` | Fecha Ingestion | timestamp | Cuándo se cargaron a BigQuery |

**Entidades actualizadas:**
- fact_meta_performance_campaign
- fact_meta_performance_adset
- fact_meta_performance_ad
- fact_meta_breakdown_age_gender
- fact_meta_breakdown_country
- fact_meta_breakdown_device
- fact_meta_breakdown_platform
- fact_meta_top_creatives
- fact_meta_creative_retention
- fact_meta_campaign_budget_performance
- meta_accounts
- meta_campaigns
- meta_adsets
- meta_ads
- meta_creatives

---

### 5. Fix: business_name en Extractor

**Archivo:** `backend_code/workers/extractors/meta_extractor.py`

**Estado:** ✅ Deployado (job `extract-meta`)

**Problema:** El campo `business_name` venía vacío porque la API de Meta lo devuelve dentro del objeto `business.name`, no como campo directo.

**Solución (líneas 146-150):**
```python
# Extract business_id and business_name from business object if available
# Meta API returns business info inside a nested 'business' object
business = account.get('business') or {}
business_id = business.get('id') if isinstance(business, dict) else None
business_name = business.get('name') if isinstance(business, dict) else account.get('business_name')
```

**Nota:** La cuenta "Shoppineando" no tiene Business Manager asociado en Meta, por eso `business_name` aparece vacío. Esto es correcto - no es un bug.

---

## Archivos Modificados (Pendientes de Commit)

```
M projects/datametricx-prod/backend_code/api/main.py
M projects/datametricx-prod/backend_code/workers/extractors/meta_extractor.py
```

---

## Deploys Realizados

| Servicio | Tipo | Revisión/Estado |
|----------|------|-----------------|
| datametricx-backend-api | Cloud Run Service | `datametricx-backend-api-00006-k52` |
| extract-meta | Cloud Run Job | Actualizado y ejecutado |

---

## Archivos en GCS (Semantic Layer)

### Entidades Nuevas/Actualizadas
```
gs://datametricx-semantic-models/core/entities/meta/fact_meta_creative_retention.json
gs://datametricx-semantic-models/core/entities/meta/fact_meta_campaign_budget_performance.json
gs://datametricx-semantic-models/core/entities/meta/fact_meta_performance_campaign.json (actualizado)
+ 12 entidades más con campos de metadata
```

### Datasets Nuevos
```
gs://datametricx-semantic-models/core/datasets/meta/ds_creative_deep_dive.json
gs://datametricx-semantic-models/core/datasets/meta/ds_campaign_budget_analysis.json
```

---

## Resumen de Datasets Disponibles

| Dataset | Atributos | Métricas | Estado |
|---------|:---------:|:--------:|--------|
| ds_performance_campaign | 10 | **54** | Actualizado |
| ds_performance_adset | 9 | 26 | + metadata |
| ds_performance_ad | 12 | 34 | + metadata |
| ds_breakdown_age_gender | 8 | 8 | + metadata |
| ds_breakdown_country | 7 | 7 | + metadata |
| ds_breakdown_platform | 7 | 6 | + metadata |
| ds_breakdown_device | 7 | 6 | + metadata |
| ds_meta_campaigns | 13 | 4 | + metadata |
| ds_meta_adsets | 13 | 3 | + metadata |
| ds_meta_ads | 12 | 1 | + metadata |
| ds_meta_creatives | 14 | 1 | + metadata |
| ds_meta_accounts | 10 | 3 | + metadata |
| ds_top_creatives | 7 | 9 | + metadata |
| **ds_creative_deep_dive** | 9 | **22** | **NUEVO** |
| **ds_campaign_budget_analysis** | 8 | **19** | **NUEVO** |

**Total: 15 datasets, ~118 atributos, ~203 métricas**

---

## Próximos Pasos Sugeridos

1. **Frontend:** Agregar operadores de días hábiles al selector de filtros
2. **Frontend:** Implementar dashboards sugeridos:
   - Executive Overview
   - Creative Analysis (con ds_creative_deep_dive)
   - Budget Pacing (con ds_campaign_budget_analysis)
   - Funnel Analysis
3. **Backend:** Considerar agregar más breakdowns si se necesitan
4. **Datos:** Verificar que todas las cuentas de Meta tengan Business Manager asociado para poblar `business_name`

---

## Comandos Útiles

```bash
# Ver datasets en GCS
gsutil ls "gs://datametricx-semantic-models/core/datasets/meta/"

# Ver entidades en GCS
gsutil ls "gs://datametricx-semantic-models/core/entities/meta/"

# Ejecutar extracción de Meta
gcloud run jobs execute extract-meta --project datametricx-prod --region us-central1 --wait

# Deploy del backend API
cd projects/datametricx-prod/backend_code/api
gcloud run deploy datametricx-backend-api --source . --project datametricx-prod --region us-central1

# Deploy del worker
cd projects/datametricx-prod/backend_code/workers
gcloud run jobs deploy extract-meta --source . --project datametricx-prod --region us-central1
```

---

*Documento generado: 2024-12-14*

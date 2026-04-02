# Meta Ads Extraction System - Documentación Técnica

## Resumen del Sistema

El sistema de extracción de Meta Ads está diseñado para extraer datos de la API de Facebook Marketing, almacenarlos en BigQuery y mantenerlos actualizados según la frecuencia configurada por cada tenant.

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLOUD SCHEDULER                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ meta-daily      │  │ meta-weekly     │  │ meta-monthly    │              │
│  │ (6:00 AM daily) │  │ (Mon 6:00 AM)   │  │ (1st 6:00 AM)   │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
└───────────┼────────────────────┼────────────────────┼────────────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DISPATCHER SERVICES                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ dispatcher-     │  │ dispatcher-     │  │ dispatcher-     │              │
│  │ meta-daily      │  │ meta-weekly     │  │ meta-monthly    │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
└───────────┼────────────────────┼────────────────────┼────────────────────────┘
            │                    │                    │
            │  1. Lee Firestore (tenants con frequency matching)
            │  2. Calcula backfill_days (start_date o ventana fija)
            │  3. Ejecuta Cloud Run Job por cada tenant
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLOUD RUN JOB: extract-meta                          │
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│  │ Secret      │    │ Meta API    │    │ GCS         │    │ BigQuery    │   │
│  │ Manager     │───▶│ Extractor   │───▶│ Staging     │───▶│ RAW         │   │
│  │ (tokens)    │    │             │    │ (JSONL)     │    │ Dataset     │   │
│  └─────────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘   │
│                                                                   │          │
│                                                                   ▼          │
│                                                           ┌─────────────┐   │
│                                                           │ BigQuery    │   │
│                                                           │ REPORTING   │   │
│                                                           │ (MERGE)     │   │
│                                                           └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Componentes

### 1. Dispatcher (`/backend_code/dispatchers/`)

**Archivos:**
- `dispatcher.py` - Lógica principal
- `main.py` - Entry point FastAPI

**Función:**
Lee Firestore para encontrar tenants con datasource Meta Ads configurado y la frecuencia que coincide con el scheduler que lo invocó. Para cada tenant, ejecuta el Cloud Run Job `extract-meta`.

**Variables de entorno:**
```
DATASOURCE=meta_ads
FREQUENCY=daily|weekly|monthly
JOB_NAME=extract-meta
PROJECT_ID=datametricx-prod
```

**Lógica de backfill_days:**

```python
# Constantes de ventana por frecuencia (para extracciones posteriores)
FREQUENCY_BACKFILL_DAYS = {
    "daily": 7,      # 48h adjustment window + margin
    "weekly": 14,
    "monthly": 45,
}

# Lógica en get_tenants_for_datasource():
if not initial_backfill_done and start_date:
    # Primera extracción: desde start_date hasta hoy
    backfill_days = (datetime.now() - start_date).days + 1
    backfill_days = min(backfill_days, 730)  # Límite API Meta
else:
    # Extracciones posteriores: ventana fija
    backfill_days = FREQUENCY_BACKFILL_DAYS.get(frequency, 7)
```

---

### 2. Worker (`/backend_code/workers/`)

**Archivos:**
- `main.py` - Entry point
- `extractors/meta_extractor.py` - Extractor de Meta API
- `common/bigquery_loader.py` - Carga a BigQuery
- `common/firestore_client.py` - Actualiza estado en Firestore
- `common/storage_client.py` - Staging en GCS
- `common/reporting_transformer.py` - RAW → REPORTING

**Variables de entorno (override por dispatcher):**
```
TENANT_ID=xxx
DATASOURCE=meta_ads
BACKFILL_DAYS=7 (o calculado)
PROJECT_ID=datametricx-prod
BQ_RAW_DATASET=raw
BQ_DATASET=reporting
```

**Flujo de ejecución:**

```
1. Lee credenciales de Secret Manager
   └─ Secret ID: meta-credentials-{tenant_id}

2. Inicializa extractor Meta
   └─ MetaAdsExtractor(credentials)

3. Extrae datos de Meta API
   └─ extract_all(tenant_id, backfill_days)
   └─ Retorna: {data_type: [records]}

4. Para cada data_type:
   a. Guarda CSV en raw-data bucket (backup)
   b. Guarda JSONL en staging bucket
   c. Carga JSONL a BigQuery RAW dataset
   d. Elimina JSONL de staging

5. Transforma RAW → REPORTING
   └─ MERGE con deduplicación

6. Actualiza Firestore:
   └─ status = "active"
   └─ initial_backfill_done = true
   └─ last_extraction = timestamp
   └─ last_extraction_records = count
```

---

### 3. Meta Extractor (`/backend_code/workers/extractors/meta_extractor.py`)

**Datos extraídos:**

| Data Type | Descripción | BigQuery Table |
|-----------|-------------|----------------|
| `account` | Info de cuenta (currency) | `meta_accounts` |
| `campaigns` | Campañas | `meta_campaigns` |
| `adsets` | Ad Sets | `meta_adsets` |
| `ads` | Anuncios | `meta_ads` |
| `creatives` | Creativos | `meta_creatives` |
| `performance_campaign_daily` | Performance diario campañas | `meta_performance_campaign_daily` |
| `performance_adset_daily` | Performance diario adsets | `meta_performance_adset_daily` |
| `performance_ad_daily` | Performance diario ads | `meta_performance_ad_daily` |
| `performance_age_gender` | Breakdown edad/género | `meta_performance_campaign_age_gender` |
| `performance_country` | Breakdown país | `meta_performance_campaign_country` |
| `performance_impression_device` | Breakdown dispositivo | `meta_performance_campaign_impression_device` |
| `performance_publisher_platform` | Breakdown plataforma | `meta_performance_campaign_publisher_platform` |
| `performance_platform_device` | Breakdown plataforma+dispositivo | `meta_performance_campaign_platform_device` |
| `top_creatives_performance` | Top creativos | `meta_top_creatives_performance` |

**Campos extraídos de JSON (actions):**

```python
# En performance tables:
actions = {
    "action_link_click": ...,
    "action_post_engagement": ...,
    "action_video_view": ...,
    "action_page_engagement": ...,
    "action_landing_page_view": ...,
    "action_add_to_cart": ...,
    "action_initiate_checkout": ...,
    "action_purchase": ...,
    "action_lead": ...,
    "action_complete_registration": ...,
    "action_search": ...,
}

# CPA calculados:
cpa = {
    "cpa_link_click": spend / action_link_click,
    "cpa_landing_page_view": ...,
    "cpa_add_to_cart": ...,
    "cpa_purchase": ...,
    "cpa_lead": ...,
}

# Métricas calculadas:
calc = {
    "calc_ctr": (clicks / impressions) * 100,
    "calc_cpc": spend / clicks,
    "calc_cpm": (spend / impressions) * 1000,
    "calc_frequency": impressions / reach,  # Solo en campaign/adset
}
```

---

### 4. Reporting Transformer (`/backend_code/workers/common/reporting_transformer.py`)

**Función:**
Transforma datos de RAW a REPORTING con:
- Deduplicación por clave primaria
- Extracción de campos JSON
- Cálculo de métricas derivadas

**Estrategia de deduplicación:**

```sql
-- Usa MERGE con QUALIFY para mantener solo el registro más reciente
MERGE reporting.table AS target
USING (
    SELECT *
    FROM raw.table
    WHERE tenant_id = '{tenant_id}'
    QUALIFY ROW_NUMBER() OVER (
        PARTITION BY {primary_key_columns}
        ORDER BY _ingested_at DESC
    ) = 1
) AS source
ON target.{pk} = source.{pk}
WHEN MATCHED THEN UPDATE SET ...
WHEN NOT MATCHED THEN INSERT ...
```

**Mapeo de tablas:**

| RAW Table | REPORTING Table | Primary Key |
|-----------|-----------------|-------------|
| `meta_accounts` | `meta_accounts` | `tenant_id, account_id` |
| `meta_campaigns` | `meta_campaigns` | `tenant_id, campaign_id` |
| `meta_adsets` | `meta_adsets` | `tenant_id, adset_id` |
| `meta_ads` | `meta_ads` | `tenant_id, ad_id` |
| `meta_creatives` | `meta_creatives` | `tenant_id, creative_id` |
| `meta_performance_campaign_daily` | `meta_performance_campaign_daily` | `tenant_id, campaign_id, date_start` |
| `meta_performance_adset_daily` | `meta_performance_adset_daily` | `tenant_id, adset_id, date_start` |
| `meta_performance_ad_daily` | `meta_performance_ad_daily` | `tenant_id, ad_id, date_start` |
| Performance breakdowns | Same name | `tenant_id, campaign_id, date_start, breakdown_field` |

---

## Estructura Firestore

### Ubicación de configuración de datasource:

```
/tenants/{tenant_id}/datasources/{datasource_doc_id}
```

**Nota:** El `datasource_doc_id` NO es "meta_ads", sino algo como "meta-1763999889616" (generado por el frontend con el account ID).

### Campos del documento:

```javascript
{
  // Configuración (frontend escribe durante onboarding)
  "connected": true,
  "ad_account_id": "act_123456789",
  "access_token_secret_id": "meta-credentials-{tenant_id}",
  "start_date": "2024-06-01",     // Fecha inicio datos históricos
  "frequency": "daily",            // daily | weekly | monthly

  // Estado (backend actualiza)
  "status": "active",              // pending_initial_sync | syncing | active | error
  "initial_backfill_done": true,   // Marca si ya se hizo extracción inicial
  "last_extraction": Timestamp,    // Última extracción exitosa
  "last_extraction_records": 1250, // Records en última extracción
  "last_run_at": Timestamp,        // Última ejecución (exitosa o no)
  "last_error": null,              // Mensaje de error si status=error
  "last_execution_time_seconds": 45.2
}
```

### Estados posibles:

| Status | Descripción | Transición |
|--------|-------------|------------|
| `pending_initial_sync` | Recién configurado, esperando primera extracción | Frontend → Backend |
| `syncing` | Extracción en progreso | Backend (inicio) |
| `active` | Funcionando normalmente | Backend (éxito) |
| `error` | Error en última extracción | Backend (fallo) |

---

## Secret Manager

### Estructura de credenciales Meta:

**Secret ID:** `meta-credentials-{tenant_id}`

**Contenido (JSON):**
```json
{
  "access_token": "EAAxxxxx...",
  "ad_account_id": "act_123456789"
}
```

---

## BigQuery Datasets

### RAW Dataset (`raw`)

- **Propósito:** Almacena todos los datos extraídos sin modificar
- **Write mode:** APPEND (mantiene historial completo)
- **Uso:** Auditoría, debugging, re-procesamiento

### REPORTING Dataset (`reporting`)

- **Propósito:** Datos listos para consumo (dashboards, APIs)
- **Write mode:** MERGE (deduplicación)
- **Campos adicionales:** Métricas calculadas, campos extraídos de JSON

---

## GCS Buckets

### Staging Bucket (`datametricx-prod-staging`)

- **Uso:** Archivos JSONL temporales para carga a BigQuery
- **Limpieza:** Automática después de cada carga
- **Path:** `{datasource}/{tenant_id}/{data_type}.jsonl`

### Raw Data Bucket (`datametricx-prod-raw-data`)

- **Uso:** Backup CSV de cada extracción
- **Retención:** Se sobrescribe en cada extracción
- **Path:** `{datasource}/{tenant_id}/{data_type}.csv`

---

## Ventana de Actualización de Meta

Meta puede ajustar métricas hasta **48 horas** después de la fecha original. Por esto:

| Frecuencia | Ventana de re-extracción | Razón |
|------------|-------------------------|-------|
| Daily | 7 días | 48h + margen para fines de semana |
| Weekly | 14 días | 2 semanas completas |
| Monthly | 45 días | Mes completo + margen |

Esta ventana asegura que:
1. Siempre capturamos las correcciones de Meta
2. La deduplicación en REPORTING mantiene solo el valor más reciente

---

## Límites de la API de Meta

| Límite | Valor | Manejo |
|--------|-------|--------|
| Historial máximo | 730 días (2 años) | `backfill_days = min(calculated, 730)` |
| Rate limit | Variable | Retry automático con backoff |
| Campos por request | ~50 | Requests separados para diferentes data types |

---

## Flujo Completo de Onboarding → Primera Extracción

```
1. Usuario conecta Meta (OAuth)
   └─ Frontend guarda access_token en Secret Manager

2. Usuario selecciona Ad Account
   └─ Frontend crea documento en Firestore:
      /tenants/{tenant_id}/datasources/meta-{account_id}
      {
        connected: true,
        ad_account_id: "act_xxx",
        start_date: "2024-06-01",
        frequency: "daily",
        initial_backfill_done: false,
        status: "pending_initial_sync"
      }

3. Scheduler dispara dispatcher-meta-daily (6:00 AM)
   └─ Dispatcher lee Firestore
   └─ Encuentra tenant con frequency="daily" y connected=true
   └─ Calcula backfill_days desde start_date (ej: 180 días)
   └─ Ejecuta extract-meta job

4. Worker extrae datos
   └─ Lee 180 días de historial de Meta API
   └─ Carga en RAW
   └─ Transforma a REPORTING
   └─ Actualiza Firestore:
      {
        status: "active",
        initial_backfill_done: true,
        last_extraction: now(),
        last_extraction_records: 5000
      }

5. Próximas ejecuciones (día siguiente)
   └─ Dispatcher ve initial_backfill_done=true
   └─ Usa backfill_days=7 (ventana daily)
   └─ Solo actualiza últimos 7 días
```

---

## Troubleshooting

### Ver logs del dispatcher:

```bash
gcloud run services logs read dispatcher-meta-daily \
  --region=us-central1 \
  --project=datametricx-prod \
  --limit=50
```

### Ver logs del worker:

```bash
gcloud run jobs executions list --job=extract-meta \
  --region=us-central1 \
  --project=datametricx-prod

gcloud run jobs executions describe {execution-name} \
  --region=us-central1 \
  --project=datametricx-prod
```

### Ejecutar extracción manual:

```bash
# Con backfill específico
gcloud run jobs execute extract-meta \
  --region=us-central1 \
  --project=datametricx-prod \
  --update-env-vars TENANT_ID=xxx,BACKFILL_DAYS=30 \
  --wait
```

### Verificar datos en BigQuery:

```sql
-- Últimas extracciones en RAW
SELECT tenant_id, COUNT(*) as records, MAX(_ingested_at) as last_ingested
FROM raw.meta_performance_campaign_daily
GROUP BY tenant_id;

-- Verificar deduplicación en REPORTING
SELECT tenant_id, campaign_id, date_start, COUNT(*)
FROM reporting.meta_performance_campaign_daily
GROUP BY 1,2,3
HAVING COUNT(*) > 1;  -- Debería estar vacío
```

---

## Archivos Clave

```
/backend_code/
├── dispatchers/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py              # FastAPI entry point
│   └── dispatcher.py        # Lógica de dispatch
│
├── workers/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py              # Entry point
│   ├── extractors/
│   │   └── meta_extractor.py
│   └── common/
│       ├── bigquery_loader.py
│       ├── firestore_client.py
│       ├── secret_manager.py
│       ├── storage_client.py
│       └── reporting_transformer.py
│
└── docs/
    ├── FRONTEND_META_ONBOARDING.md
    └── BACKEND_META_EXTRACTION.md  # Este archivo
```

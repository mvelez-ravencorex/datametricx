# 📊 Sistema de Historial de Sincronizaciones - Backend

## 🎯 Objetivo

Cuando un **Cloud Run Job** de sincronización se ejecuta (manual o programado), debe actualizar Firestore con:
1. **Estado del job** (running → completed/failed)
2. **Historial detallado** de la sincronización
3. **Métricas** (registros procesados, duración, errores)

---

## 📝 Estructura de Datos en Firestore

### Ubicación:
```
/tenants/{tenantId}/datasources/{datasourceId}
```

### Campos del Documento:

```typescript
{
  // ... otros campos del datasource ...

  // Estado actual
  "status": "ok" | "error" | "no-data" | "pending" | "never-run",
  "syncStatus": "ok" | "error" | "no-data" | "pending" | "never-run",
  "currentJobId": "job_abc123" | null,  // Job actualmente en ejecución
  "lastJobId": "job_abc123",             // Último job ejecutado

  // Último resultado
  "lastSyncAt": Timestamp,
  "lastSyncResult": {
    "status": "ok" | "error",
    "timestamp": Timestamp,
    "recordsProcessed": 1234,
    "errorMessage": "Error message" | null
  },

  // Historial (últimas 20 sincronizaciones)
  "syncHistory": [
    {
      "id": "job_abc123",
      "jobId": "job_abc123",
      "status": "running" | "completed" | "failed" | "cancelled",
      "type": "manual" | "scheduled",        // Manual (Sync Now) o programada (cron)
      "startedAt": Timestamp,
      "completedAt": Timestamp | null,
      "duration": 45,                        // Segundos
      "recordsProcessed": 1234,
      "errorMessage": "Error message" | null,
      "errorDetails": "Detailed error..." | null,
      "triggeredBy": "user_uid" | null      // Solo para manual
    },
    // ... hasta 19 más (las más recientes primero)
  ]
}
```

---

## 🔄 Flujo de Actualización

### 1️⃣ **Inicio del Job** (Ya manejado por Frontend)

El frontend ya se encarga de esto cuando se ejecuta "Sync Now":

```python
# Frontend ya creó la entrada en syncHistory con status="running"
# Backend solo debe actualizar cuando el job completa o falla
```

### 2️⃣ **Durante la Ejecución** (Opcional - Progreso)

Si el job tarda mucho, puede actualizarse el progreso:

```python
from google.cloud import firestore

db = firestore.Client()

def update_job_progress(tenant_id: str, datasource_id: str, job_id: str, records_processed: int):
    """
    Actualiza el progreso del job mientras está en ejecución.
    OPCIONAL: Solo si el job tarda > 1 minuto.
    """
    datasource_ref = db.collection('tenants').document(tenant_id).collection('datasources').document(datasource_id)

    # Obtener datasource actual
    datasource = datasource_ref.get().to_dict()
    sync_history = datasource.get('syncHistory', [])

    # Actualizar la entrada del historial
    updated_history = []
    for entry in sync_history:
        if entry.get('jobId') == job_id:
            entry['recordsProcessed'] = records_processed
            # El status sigue siendo "running"
        updated_history.append(entry)

    # Actualizar Firestore
    datasource_ref.update({
        'syncHistory': updated_history,
        'updatedAt': firestore.SERVER_TIMESTAMP
    })

    print(f"✅ Progress updated: {records_processed} records")
```

### 3️⃣ **Job Completado Exitosamente** ✅

```python
from google.cloud import firestore
from datetime import datetime

db = firestore.Client()

def mark_job_completed(
    tenant_id: str,
    datasource_id: str,
    job_id: str,
    records_processed: int
):
    """
    Marca un job como completado exitosamente.
    Debe llamarse AL FINAL del job, justo antes de return/exit.
    """
    datasource_ref = db.collection('tenants').document(tenant_id).collection('datasources').document(datasource_id)

    # Obtener datasource actual
    datasource = datasource_ref.get().to_dict()
    sync_history = datasource.get('syncHistory', [])

    # Encontrar y actualizar la entrada
    updated_history = []
    completed_at = datetime.utcnow()

    for entry in sync_history:
        if entry.get('jobId') == job_id:
            started_at = entry.get('startedAt')
            if isinstance(started_at, firestore.SERVER_TIMESTAMP.__class__):
                started_at = datetime.utcnow()
            elif hasattr(started_at, 'timestamp'):
                started_at = datetime.fromtimestamp(started_at.timestamp())

            duration = int((completed_at - started_at).total_seconds())

            entry.update({
                'status': 'completed',
                'completedAt': completed_at,
                'duration': duration,
                'recordsProcessed': records_processed,
                'errorMessage': None,
                'errorDetails': None
            })
        updated_history.append(entry)

    # Actualizar datasource
    datasource_ref.update({
        'syncHistory': updated_history,
        'status': 'ok',
        'syncStatus': 'ok',
        'lastSyncAt': firestore.SERVER_TIMESTAMP,
        'lastSyncResult': {
            'status': 'ok',
            'timestamp': firestore.SERVER_TIMESTAMP,
            'recordsProcessed': records_processed
        },
        'currentJobId': None,  # Ya no hay job en ejecución
        'lastJobId': job_id,
        'updatedAt': firestore.SERVER_TIMESTAMP
    })

    print(f"✅ Job {job_id} marcado como completado: {records_processed} registros procesados")
```

### 4️⃣ **Job Falló** ❌

```python
def mark_job_failed(
    tenant_id: str,
    datasource_id: str,
    job_id: str,
    error_message: str,
    error_details: str = None,
    records_processed: int = 0
):
    """
    Marca un job como fallido.
    Debe llamarse en el bloque except del job.
    """
    datasource_ref = db.collection('tenants').document(tenant_id).collection('datasources').document(datasource_id)

    # Obtener datasource actual
    datasource = datasource_ref.get().to_dict()
    sync_history = datasource.get('syncHistory', [])

    # Encontrar y actualizar la entrada
    updated_history = []
    completed_at = datetime.utcnow()

    for entry in sync_history:
        if entry.get('jobId') == job_id:
            started_at = entry.get('startedAt')
            if isinstance(started_at, firestore.SERVER_TIMESTAMP.__class__):
                started_at = datetime.utcnow()
            elif hasattr(started_at, 'timestamp'):
                started_at = datetime.fromtimestamp(started_at.timestamp())

            duration = int((completed_at - started_at).total_seconds())

            entry.update({
                'status': 'failed',
                'completedAt': completed_at,
                'duration': duration,
                'recordsProcessed': records_processed,
                'errorMessage': error_message,
                'errorDetails': error_details
            })
        updated_history.append(entry)

    # Actualizar datasource
    datasource_ref.update({
        'syncHistory': updated_history,
        'status': 'error',
        'syncStatus': 'error',
        'lastSyncAt': firestore.SERVER_TIMESTAMP,
        'lastSyncResult': {
            'status': 'error',
            'timestamp': firestore.SERVER_TIMESTAMP,
            'recordsProcessed': records_processed,
            'errorMessage': error_message
        },
        'currentJobId': None,  # Ya no hay job en ejecución
        'lastJobId': job_id,
        'updatedAt': firestore.SERVER_TIMESTAMP
    })

    print(f"❌ Job {job_id} marcado como fallido: {error_message}")
```

---

## 🔨 Implementación en Cloud Run Jobs

### Template del Job:

```python
import os
import sys
import traceback
from google.cloud import firestore
from datetime import datetime

# Inicializar Firestore
db = firestore.Client()

def run_meta_sync_job():
    """
    Job de sincronización de Meta Ads
    """
    # Obtener parámetros del job
    tenant_id = os.environ.get('TENANT_ID')
    datasource_id = os.environ.get('DATASOURCE_ID')
    job_id = os.environ.get('JOB_ID')  # Pasado por el dispatcher

    if not all([tenant_id, datasource_id, job_id]):
        print("❌ Faltan parámetros requeridos")
        sys.exit(1)

    records_processed = 0

    try:
        print(f"🚀 Iniciando sync job {job_id}")
        print(f"   Tenant: {tenant_id}")
        print(f"   Datasource: {datasource_id}")

        # 1. Obtener credenciales de Secret Manager
        credentials = get_credentials_from_secret_manager(tenant_id, datasource_id)

        # 2. Conectar a Meta Ads API
        meta_client = connect_to_meta_ads(credentials)

        # 3. Obtener datos
        data = fetch_meta_ads_data(meta_client)
        records_processed = len(data)

        print(f"✅ Obtenidos {records_processed} registros de Meta Ads")

        # 4. Guardar en BigQuery
        save_to_bigquery(tenant_id, datasource_id, data)

        print(f"✅ Datos guardados en BigQuery")

        # 5. ✨ IMPORTANTE: Marcar job como completado en Firestore
        mark_job_completed(
            tenant_id=tenant_id,
            datasource_id=datasource_id,
            job_id=job_id,
            records_processed=records_processed
        )

        print(f"✅ Job {job_id} completado exitosamente")
        return 0

    except Exception as e:
        error_message = str(e)
        error_details = traceback.format_exc()

        print(f"❌ Error en job {job_id}: {error_message}")
        print(f"   Detalles:\n{error_details}")

        # ✨ IMPORTANTE: Marcar job como fallido en Firestore
        mark_job_failed(
            tenant_id=tenant_id,
            datasource_id=datasource_id,
            job_id=job_id,
            error_message=error_message,
            error_details=error_details,
            records_processed=records_processed
        )

        return 1


if __name__ == '__main__':
    exit_code = run_meta_sync_job()
    sys.exit(exit_code)
```

---

## 🎯 Checklist de Implementación

### Para el Backend Agent:

- [ ] Copiar funciones `mark_job_completed()` y `mark_job_failed()` a un módulo común
- [ ] Importar estas funciones en TODOS los jobs de sincronización:
  - [ ] Meta Ads job
  - [ ] TikTok Ads job
  - [ ] Google Analytics 4 job
  - [ ] Shopify job
  - [ ] TiendaNube job
  - [ ] MercadoLibre job
- [ ] Llamar `mark_job_completed()` al final de cada job exitoso
- [ ] Llamar `mark_job_failed()` en el bloque `except` de cada job
- [ ] Verificar que los jobs reciben `JOB_ID` como variable de entorno
- [ ] Probar con un job manual (Sync Now)
- [ ] Verificar en Firestore Console que syncHistory se actualiza correctamente

---

## 🧪 Testing

### 1. Crear Sync Manual (Frontend):

1. Ir a página de Connections
2. Click en "Sync Now" en Meta Ads
3. Verificar en Firestore que se crea entrada en `syncHistory` con `status: "running"`

### 2. Verificar Update del Backend:

```python
# En Cloud Shell o localmente
from google.cloud import firestore

db = firestore.Client()

# Obtener datasource
datasource_ref = db.collection('tenants').document('TENANT_ID').collection('datasources').document('DATASOURCE_ID')
datasource = datasource_ref.get().to_dict()

print("Sync History:")
for entry in datasource.get('syncHistory', []):
    print(f"  - Job: {entry['jobId']}")
    print(f"    Status: {entry['status']}")
    print(f"    Type: {entry['type']}")
    print(f"    Records: {entry.get('recordsProcessed', 0)}")
    if entry.get('errorMessage'):
        print(f"    Error: {entry['errorMessage']}")
    print()
```

### 3. Verificar en Frontend:

1. Recargar página de Connections
2. Verificar que el badge de Meta Ads muestra:
   - ✅ "Exitoso" si completó
   - ❌ "Error" si falló
   - 🔄 "En progreso" si está running
3. Click en el datasource para ver historial completo

---

## 📊 Beneficios

1. **Transparencia:** Usuario ve exactamente qué pasó en cada sync
2. **Debugging:** Logs detallados de cada ejecución
3. **Auditoría:** Historial completo de sincronizaciones
4. **Monitoreo:** Detectar patrones de fallos
5. **UX mejorada:** Estado actualizado en tiempo real

---

## 🚨 Casos Especiales

### Job Timeout:

Si el job excede el timeout y es cancelado por Cloud Run:

```python
# Cloud Run envía SIGTERM antes de matar el proceso
import signal

def handle_sigterm(signum, frame):
    print("⚠️ SIGTERM recibido, job siendo cancelado por timeout")

    # Marcar como cancelado
    mark_job_failed(
        tenant_id=TENANT_ID,
        datasource_id=DATASOURCE_ID,
        job_id=JOB_ID,
        error_message="Job cancelled due to timeout",
        error_details="Cloud Run timeout exceeded",
        records_processed=records_processed
    )

    sys.exit(1)

# Registrar handler
signal.signal(signal.SIGTERM, handle_sigterm)
```

### Sincronización Programada (Cron):

Para jobs ejecutados por Cloud Scheduler, el dispatcher debe crear la entrada en syncHistory con `type: "scheduled"`:

```python
# En el dispatcher de Cloud Run
def schedule_sync_job(tenant_id: str, datasource_id: str):
    """
    Dispatcher ejecutado por Cloud Scheduler
    """
    job_id = generate_job_id()

    # Crear entrada en syncHistory ANTES de lanzar el job
    datasource_ref = db.collection('tenants').document(tenant_id).collection('datasources').document(datasource_id)
    datasource = datasource_ref.get().to_dict()
    sync_history = datasource.get('syncHistory', [])

    # Agregar nueva entrada
    new_entry = {
        'id': job_id,
        'jobId': job_id,
        'status': 'running',
        'type': 'scheduled',  # ← IMPORTANTE: scheduled, no manual
        'startedAt': firestore.SERVER_TIMESTAMP,
        'triggeredBy': None  # No hay usuario que lo disparó
    }

    updated_history = [new_entry] + sync_history[:19]  # Mantener últimas 20

    datasource_ref.update({
        'syncHistory': updated_history,
        'currentJobId': job_id,
        'syncStatus': 'pending',
        'updatedAt': firestore.SERVER_TIMESTAMP
    })

    # Lanzar Cloud Run Job con job_id
    launch_cloud_run_job(tenant_id, datasource_id, job_id)
```

---

¿Necesitas ayuda implementando alguna parte específica?

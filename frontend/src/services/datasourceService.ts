/**
 * Servicio para gestionar datasources dentro de tenants
 * Ruta en Firestore: /tenants/{tenantId}/datasources/{datasourceId}
 *
 * FRONT 1: Configurar datasource (sin credenciales, solo secret_id + config)
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
  limit,
  where,
  addDoc
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import {
  Connection,
  ConnectionPlatform,
  SyncFrequency,
  SyncResult,
  MetaDatasourceConfig,
  PipelineRun,
  PipelineRunStatus,
  PipelineRunType,
  PipelineRunsSummary
} from '@/types/connections'

/**
 * Configuración de datasource (FRONT 1)
 * Coincide con lo que esperan los dispatchers del backend
 */
export interface DatasourceConfig {
  name: string
  platform: ConnectionPlatform
  secret_id: string // ID del secret en Secret Manager

  // 🟢 Estado
  connected: boolean // true al crear/actualizar
  status: 'ok' | 'error' | 'no-data' | 'pending' | 'never-run'

  // ⚙️ Configuración de sincronización (nombres según backend)
  frequency: SyncFrequency // daily / weekly / monthly
  time_utc: string // HH:mm en UTC (ej: "03:00")

  // 📊 Backfill (días hacia atrás)
  backfill_days: number // 30 / 90 / 180 / 365

  // Metadata adicional (según plataforma)
  metadata?: Record<string, any>

  // Configuración específica de plataforma
  config?: Record<string, any>
}

/**
 * Convierte Timestamp de Firestore a Date
 */
function timestampToDate(timestamp: any): Date {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate()
  }
  if (timestamp?.toDate) {
    return timestamp.toDate()
  }
  return new Date(timestamp)
}

/**
 * Limpia recursivamente todos los campos undefined de un objeto
 * Firestore no permite valores undefined
 */
function removeUndefinedFields(obj: any): any {
  if (obj === null || obj === undefined) {
    return null
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item)).filter(item => item !== undefined)
  }

  if (typeof obj === 'object' && !(obj instanceof Timestamp)) {
    const cleaned: any = {}
    Object.keys(obj).forEach(key => {
      const value = obj[key]
      if (value !== undefined) {
        if (value === null) {
          cleaned[key] = null
        } else if (Array.isArray(value)) {
          cleaned[key] = removeUndefinedFields(value)
        } else if (typeof value === 'object' && !(value instanceof Timestamp)) {
          cleaned[key] = removeUndefinedFields(value)
        } else {
          cleaned[key] = value
        }
      }
    })
    return cleaned
  }

  return obj
}

/**
 * FRONT 1: Crea un nuevo datasource en Firestore
 *
 * @param tenantId - ID del tenant
 * @param datasourceId - ID único del datasource (generado por frontend o backend)
 * @param config - Configuración del datasource
 */
export async function createDatasource(
  tenantId: string,
  datasourceId: string,
  config: DatasourceConfig
): Promise<void> {
  const datasourceRef = doc(db, 'tenants', tenantId, 'datasources', datasourceId)

  console.log('📝 Creando datasource con config:', {
    backfill_days: config.backfill_days,
    frequency: config.frequency,
    time_utc: config.time_utc,
    name: config.name,
    platform: config.platform
  })

  const docData = {
    id: datasourceId,
    tenantId: tenantId, // 🏢 Guardar tenantId en el documento
    name: config.name,
    platform: config.platform,
    secret_id: config.secret_id,

    // 🟢 Estado (nombres según backend)
    connected: config.connected !== undefined ? config.connected : true,
    status: config.status || 'never-run',

    // ⚙️ Sincronización (nombres según backend)
    frequency: config.frequency,
    time_utc: config.time_utc,

    // 📊 Backfill (días hacia atrás)
    backfill_days: config.backfill_days,

    // Metadata y config
    ...config.metadata,
    config: config.config || {},

    // Timestamps
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }

  console.log('📤 Guardando en Firestore:', {
    datasourceId,
    backfill_days: docData.backfill_days,
    backfill_days_type: typeof docData.backfill_days
  })

  await setDoc(datasourceRef, docData)

  console.log(`✅ Datasource ${datasourceId} creado en tenant ${tenantId}`)
}

/**
 * FRONT 1: Actualiza un datasource existente
 */
export async function updateDatasource(
  tenantId: string,
  datasourceId: string,
  updates: Partial<DatasourceConfig>
): Promise<void> {
  const datasourceRef = doc(db, 'tenants', tenantId, 'datasources', datasourceId)

  console.log('📝 Actualizando datasource:', {
    datasourceId,
    backfill_days: updates.backfill_days,
    backfill_days_type: typeof updates.backfill_days,
    updates
  })

  const rawUpdateData = {
    ...updates,
    updatedAt: serverTimestamp()
  }

  console.log('🔧 Raw update data antes de limpiar:', {
    backfill_days: rawUpdateData.backfill_days,
    backfill_days_type: typeof rawUpdateData.backfill_days
  })

  // Limpiar campos undefined
  const updateData = removeUndefinedFields(rawUpdateData)

  console.log('✅ Update data después de limpiar:', {
    backfill_days: updateData.backfill_days,
    backfill_days_type: typeof updateData.backfill_days,
    hasBackfillDays: 'backfill_days' in updateData
  })

  await updateDoc(datasourceRef, updateData)

  console.log(`✅ Datasource ${datasourceId} actualizado`)
}

/**
 * Obtiene un datasource específico
 */
export async function getDatasource(
  tenantId: string,
  datasourceId: string
): Promise<Connection | null> {
  const datasourceRef = doc(db, 'tenants', tenantId, 'datasources', datasourceId)
  const datasourceSnap = await getDoc(datasourceRef)

  if (!datasourceSnap.exists()) {
    return null
  }

  const data = datasourceSnap.data()

  return {
    ...data,
    id: datasourceSnap.id,
    tenantId: data.tenantId || tenantId, // Usar el del documento o el parámetro como fallback
    userId: '', // Legacy field, no usado en multi-tenant
    createdAt: data.createdAt ? timestampToDate(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? timestampToDate(data.updatedAt) : new Date(),
    lastSyncAt: data.lastSyncAt ? timestampToDate(data.lastSyncAt) : undefined,
    lastSyncResult: data.lastSyncResult ? {
      ...data.lastSyncResult,
      timestamp: timestampToDate(data.lastSyncResult.timestamp)
    } : undefined
  } as Connection
}

/**
 * Obtiene todos los datasources de un tenant
 */
export async function getTenantDatasources(
  tenantId: string
): Promise<Connection[]> {
  console.log('📋 Cargando datasources del tenant:', tenantId)

  const datasourcesRef = collection(db, 'tenants', tenantId, 'datasources')
  const datasourcesSnap = await getDocs(datasourcesRef)

  console.log(`✅ Encontrados ${datasourcesSnap.docs.length} datasources`)

  const datasources = datasourcesSnap.docs.map(docSnap => {
    const data = docSnap.data()

    return {
      ...data,
      id: docSnap.id,
      tenantId: data.tenantId || tenantId, // Usar el del documento o el parámetro como fallback
      userId: '', // Legacy field
      createdAt: data.createdAt ? timestampToDate(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? timestampToDate(data.updatedAt) : new Date(),
      lastSyncAt: data.lastSyncAt ? timestampToDate(data.lastSyncAt) : undefined,
      lastSyncResult: data.lastSyncResult ? {
        ...data.lastSyncResult,
        timestamp: timestampToDate(data.lastSyncResult.timestamp)
      } : undefined
    } as Connection
  })

  console.log('📊 Datasources cargados:', datasources.map(ds => ({
    id: ds.id,
    platform: ds.platform,
    connected: ds.connected,
    name: ds.name
  })))

  return datasources
}

/**
 * Actualiza el estado de sincronización de un datasource
 * (Llamado después de ejecutar sync o al recibir webhook del backend)
 */
export async function updateSyncStatus(
  tenantId: string,
  datasourceId: string,
  syncResult: SyncResult,
  jobId?: string
): Promise<void> {
  const datasourceRef = doc(db, 'tenants', tenantId, 'datasources', datasourceId)

  // Construir lastSyncResult sin valores undefined
  const lastSyncResult: any = {
    status: syncResult.status,
    timestamp: Timestamp.fromDate(syncResult.timestamp),
    recordsProcessed: syncResult.recordsProcessed || 0
  }

  // Solo agregar errorMessage si existe
  if (syncResult.errorMessage) {
    lastSyncResult.errorMessage = syncResult.errorMessage
  }

  // Construir update data
  const rawUpdateData: any = {
    syncStatus: syncResult.status,
    lastSyncResult,
    lastSyncAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }

  // Solo agregar jobId si existe
  if (jobId) {
    rawUpdateData.lastJobId = jobId
    rawUpdateData.currentJobId = syncResult.status === 'pending' ? jobId : null
  }

  // Limpiar campos undefined
  const updateData = removeUndefinedFields(rawUpdateData)

  await updateDoc(datasourceRef, updateData)

  console.log(`✅ Sync status actualizado para datasource ${datasourceId}:`, syncResult.status)
}

/**
 * Actualiza el estado del backfill
 */
export async function updateBackfillStatus(
  tenantId: string,
  datasourceId: string,
  status: 'pending' | 'in_progress' | 'completed' | 'failed',
  jobId?: string
): Promise<void> {
  const datasourceRef = doc(db, 'tenants', tenantId, 'datasources', datasourceId)

  const rawUpdateData = {
    backfillStatus: status,
    currentJobId: status === 'in_progress' ? jobId : null,
    lastJobId: jobId,
    updatedAt: serverTimestamp()
  }

  // Limpiar campos undefined
  const updateData = removeUndefinedFields(rawUpdateData)

  await updateDoc(datasourceRef, updateData)
}

/**
 * Elimina un datasource
 */
export async function deleteDatasource(
  tenantId: string,
  datasourceId: string
): Promise<void> {
  const datasourceRef = doc(db, 'tenants', tenantId, 'datasources', datasourceId)
  await deleteDoc(datasourceRef)

  console.log(`🗑️ Datasource ${datasourceId} eliminado`)
}

/**
 * Verifica si un datasource existe
 */
export async function datasourceExists(
  tenantId: string,
  datasourceId: string
): Promise<boolean> {
  const datasourceRef = doc(db, 'tenants', tenantId, 'datasources', datasourceId)
  const datasourceSnap = await getDoc(datasourceRef)
  return datasourceSnap.exists()
}

/**
 * Obtiene datasources filtrados por plataforma
 */
export async function getDatasourcesByPlatform(
  tenantId: string,
  platform: ConnectionPlatform
): Promise<Connection[]> {
  const allDatasources = await getTenantDatasources(tenantId)
  return allDatasources.filter(ds => ds.platform === platform)
}

/**
 * Cuenta cuántos datasources de una plataforma tiene el tenant
 * (Para validar límites del plan)
 */
export async function countDatasourcesByPlatform(
  tenantId: string,
  platform: ConnectionPlatform
): Promise<number> {
  const datasources = await getDatasourcesByPlatform(tenantId, platform)
  return datasources.length
}

// ==================== PIPELINE RUNS (Subcolección) ====================
// Ubicación: /tenants/{tenantId}/datasources/{datasourceId}/pipeline_runs/{runId}

/**
 * Crea una nueva corrida de pipeline
 * Se llama cuando se inicia una sincronización
 */
export async function createPipelineRun(
  tenantId: string,
  datasourceId: string,
  run: {
    jobId: string
    type: PipelineRunType
    triggeredBy?: string
    dateRange?: { start: string; end: string }
  }
): Promise<string> {
  const runsRef = collection(db, 'tenants', tenantId, 'datasources', datasourceId, 'pipeline_runs')

  // Crear documento de la corrida
  const runData: any = {
    jobId: run.jobId,
    status: 'running' as PipelineRunStatus,
    type: run.type,
    startedAt: serverTimestamp()
  }

  // Agregar campos opcionales solo si existen
  if (run.triggeredBy) {
    runData.triggeredBy = run.triggeredBy
  }
  if (run.dateRange) {
    runData.dateRange = run.dateRange
  }

  // Limpiar campos undefined
  const cleanedData = removeUndefinedFields(runData)

  // Crear documento con ID auto-generado
  const docRef = await addDoc(runsRef, cleanedData)

  // Actualizar el datasource con el currentJobId
  const datasourceRef = doc(db, 'tenants', tenantId, 'datasources', datasourceId)
  await updateDoc(datasourceRef, {
    currentJobId: run.jobId,
    syncStatus: 'pending',
    updatedAt: serverTimestamp()
  })

  console.log(`✅ Pipeline run creada: ${docRef.id} (job: ${run.jobId})`)
  return docRef.id
}

/**
 * Actualiza una corrida de pipeline cuando completa o falla
 */
export async function updatePipelineRun(
  tenantId: string,
  datasourceId: string,
  jobId: string,
  update: {
    status: 'completed' | 'failed' | 'cancelled'
    recordsProcessed?: number
    recordsInserted?: number
    recordsUpdated?: number
    errorMessage?: string
    errorCode?: string
    errorDetails?: string
  }
): Promise<void> {
  // Buscar la corrida por jobId
  const runsRef = collection(db, 'tenants', tenantId, 'datasources', datasourceId, 'pipeline_runs')
  const q = query(runsRef, where('jobId', '==', jobId), limit(1))
  const snapshot = await getDocs(q)

  if (snapshot.empty) {
    console.warn(`⚠️ Pipeline run no encontrada para jobId: ${jobId}`)
    return
  }

  const runDoc = snapshot.docs[0]
  const runData = runDoc.data()

  // Calcular duración
  const startedAt = runData.startedAt?.toDate?.() || new Date()
  const completedAt = new Date()
  const duration = Math.round((completedAt.getTime() - startedAt.getTime()) / 1000)

  // Construir datos de actualización
  const updateData: any = {
    status: update.status,
    completedAt: Timestamp.fromDate(completedAt),
    duration,
    recordsProcessed: update.recordsProcessed || 0
  }

  // Campos opcionales
  if (update.recordsInserted !== undefined) {
    updateData.recordsInserted = update.recordsInserted
  }
  if (update.recordsUpdated !== undefined) {
    updateData.recordsUpdated = update.recordsUpdated
  }
  if (update.errorMessage) {
    updateData.errorMessage = update.errorMessage
  }
  if (update.errorCode) {
    updateData.errorCode = update.errorCode
  }
  if (update.errorDetails) {
    updateData.errorDetails = update.errorDetails
  }

  // Limpiar y actualizar
  const cleanedData = removeUndefinedFields(updateData)
  await updateDoc(runDoc.ref, cleanedData)

  // Actualizar el datasource principal
  const datasourceRef = doc(db, 'tenants', tenantId, 'datasources', datasourceId)
  const dsUpdateData: any = {
    lastJobId: jobId,
    currentJobId: null,
    updatedAt: serverTimestamp()
  }

  if (update.status === 'completed') {
    dsUpdateData.syncStatus = 'ok'
    dsUpdateData.status = 'ok'
    dsUpdateData.lastSyncAt = serverTimestamp()
    dsUpdateData.lastSyncResult = {
      status: 'ok',
      timestamp: serverTimestamp(),
      recordsProcessed: update.recordsProcessed || 0
    }
  } else if (update.status === 'failed') {
    dsUpdateData.syncStatus = 'error'
    dsUpdateData.status = 'error'
    dsUpdateData.lastSyncAt = serverTimestamp()
    dsUpdateData.lastSyncResult = {
      status: 'error',
      timestamp: serverTimestamp(),
      recordsProcessed: update.recordsProcessed || 0,
      errorMessage: update.errorMessage || 'Sync failed'
    }
  }

  await updateDoc(datasourceRef, removeUndefinedFields(dsUpdateData))

  console.log(`✅ Pipeline run actualizada: ${jobId} → ${update.status}`)
}

/**
 * Obtiene las corridas de pipeline de un datasource
 * @param maxResults Número máximo de resultados (default: 20)
 */
export async function getPipelineRuns(
  tenantId: string,
  datasourceId: string,
  maxResults: number = 20
): Promise<PipelineRun[]> {
  const runsRef = collection(db, 'tenants', tenantId, 'datasources', datasourceId, 'pipeline_runs')
  const q = query(runsRef, orderBy('startedAt', 'desc'), limit(maxResults))
  const snapshot = await getDocs(q)

  return snapshot.docs.map(docSnap => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      jobId: data.jobId,
      status: data.status,
      type: data.type,
      startedAt: data.startedAt?.toDate?.() || new Date(),
      completedAt: data.completedAt?.toDate?.() || undefined,
      duration: data.duration,
      recordsProcessed: data.recordsProcessed,
      recordsInserted: data.recordsInserted,
      recordsUpdated: data.recordsUpdated,
      errorMessage: data.errorMessage,
      errorCode: data.errorCode,
      errorDetails: data.errorDetails,
      triggeredBy: data.triggeredBy,
      dateRange: data.dateRange,
      logs: data.logs
    } as PipelineRun
  })
}

/**
 * Obtiene una corrida específica por ID
 */
export async function getPipelineRun(
  tenantId: string,
  datasourceId: string,
  runId: string
): Promise<PipelineRun | null> {
  const runRef = doc(db, 'tenants', tenantId, 'datasources', datasourceId, 'pipeline_runs', runId)
  const runSnap = await getDoc(runRef)

  if (!runSnap.exists()) {
    return null
  }

  const data = runSnap.data()
  return {
    id: runSnap.id,
    jobId: data.jobId,
    status: data.status,
    type: data.type,
    startedAt: data.startedAt?.toDate?.() || new Date(),
    completedAt: data.completedAt?.toDate?.() || undefined,
    duration: data.duration,
    recordsProcessed: data.recordsProcessed,
    recordsInserted: data.recordsInserted,
    recordsUpdated: data.recordsUpdated,
    errorMessage: data.errorMessage,
    errorCode: data.errorCode,
    errorDetails: data.errorDetails,
    triggeredBy: data.triggeredBy,
    dateRange: data.dateRange,
    logs: data.logs
  } as PipelineRun
}

/**
 * Obtiene resumen de corridas para UI
 */
export async function getPipelineRunsSummary(
  tenantId: string,
  datasourceId: string
): Promise<PipelineRunsSummary> {
  const runs = await getPipelineRuns(tenantId, datasourceId, 100)

  const summary: PipelineRunsSummary = {
    totalRuns: runs.length,
    successfulRuns: runs.filter(r => r.status === 'completed').length,
    failedRuns: runs.filter(r => r.status === 'failed').length,
    lastRun: runs[0],
    lastSuccessfulRun: runs.find(r => r.status === 'completed')
  }

  return summary
}

/**
 * Agrega un log a una corrida en ejecución
 */
export async function addPipelineRunLog(
  tenantId: string,
  datasourceId: string,
  jobId: string,
  log: {
    level: 'info' | 'warn' | 'error' | 'debug'
    message: string
    data?: Record<string, any>
  }
): Promise<void> {
  // Buscar la corrida por jobId
  const runsRef = collection(db, 'tenants', tenantId, 'datasources', datasourceId, 'pipeline_runs')
  const q = query(runsRef, where('jobId', '==', jobId), limit(1))
  const snapshot = await getDocs(q)

  if (snapshot.empty) {
    console.warn(`⚠️ Pipeline run no encontrada para log: ${jobId}`)
    return
  }

  const runDoc = snapshot.docs[0]
  const runData = runDoc.data()
  const currentLogs = runData.logs || []

  // Agregar nuevo log (máximo 100 logs por corrida)
  const newLog = {
    timestamp: Timestamp.fromDate(new Date()),
    level: log.level,
    message: log.message,
    data: log.data
  }

  const updatedLogs = [...currentLogs, removeUndefinedFields(newLog)].slice(-100)

  await updateDoc(runDoc.ref, { logs: updatedLogs })
}

// ==================== SYNC HISTORY (Legacy - Deprecated) ====================
// @deprecated Usar createPipelineRun y updatePipelineRun en su lugar

/**
 * @deprecated Usar createPipelineRun
 */
export async function addSyncHistoryEntry(
  tenantId: string,
  datasourceId: string,
  entry: {
    jobId: string
    type: 'manual' | 'scheduled'
    triggeredBy?: string
  }
): Promise<string> {
  console.warn('⚠️ addSyncHistoryEntry está deprecated. Usar createPipelineRun.')
  return createPipelineRun(tenantId, datasourceId, entry)
}

/**
 * @deprecated Usar updatePipelineRun
 */
export async function updateSyncHistoryEntry(
  tenantId: string,
  datasourceId: string,
  jobId: string,
  update: {
    status: 'completed' | 'failed' | 'cancelled'
    recordsProcessed?: number
    errorMessage?: string
    errorDetails?: string
  }
): Promise<void> {
  console.warn('⚠️ updateSyncHistoryEntry está deprecated. Usar updatePipelineRun.')
  return updatePipelineRun(tenantId, datasourceId, jobId, update)
}

/**
 * @deprecated Usar getPipelineRuns
 */
export async function getSyncHistory(
  tenantId: string,
  datasourceId: string
): Promise<any[]> {
  console.warn('⚠️ getSyncHistory está deprecated. Usar getPipelineRuns.')
  const runs = await getPipelineRuns(tenantId, datasourceId)
  return runs.map(run => ({
    ...run,
    id: run.id,
    completedAt: run.completedAt || null
  }))
}

// ==================== META ADS (Nueva estructura con start_date) ====================

/**
 * Guarda la configuración de Meta Ads con la nueva estructura
 * Ubicación: /tenants/{tenant_id}/datasources/meta_ads
 */
export async function saveMetaDatasourceConfig(
  tenantId: string,
  config: MetaDatasourceConfig
): Promise<void> {
  const datasourceRef = doc(db, 'tenants', tenantId, 'datasources', 'meta_ads')

  console.log('📝 Guardando Meta Ads config (nueva estructura):', {
    start_date: config.start_date,
    frequency: config.frequency,
    ad_account_id: config.ad_account_id
  })

  const docData = {
    // Identificación
    id: 'meta_ads',
    tenantId: tenantId,
    platform: 'meta_ads' as const,
    name: 'Meta Ads',

    // Campos del onboarding
    start_date: config.start_date,
    frequency: config.frequency,

    // Campos de conexión
    connected: config.connected,
    ad_account_id: config.ad_account_id,
    access_token_secret_id: config.access_token_secret_id,
    secret_id: config.access_token_secret_id, // Para compatibilidad

    // Campos de estado
    status: config.status,
    initial_backfill_done: config.initial_backfill_done,
    last_extraction: config.last_extraction,
    last_extraction_records: config.last_extraction_records,
    last_error: config.last_error,

    // Timestamps
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }

  // Limpiar campos undefined
  const cleanedData = removeUndefinedFields(docData)

  await setDoc(datasourceRef, cleanedData, { merge: true })

  console.log(`✅ Meta Ads config guardada para tenant ${tenantId}`)
}

/**
 * Obtiene la configuración de Meta Ads
 */
export async function getMetaDatasourceConfig(
  tenantId: string
): Promise<MetaDatasourceConfig | null> {
  const datasourceRef = doc(db, 'tenants', tenantId, 'datasources', 'meta_ads')
  const datasourceSnap = await getDoc(datasourceRef)

  if (!datasourceSnap.exists()) {
    return null
  }

  const data = datasourceSnap.data()

  return {
    start_date: data.start_date,
    frequency: data.frequency,
    connected: data.connected,
    ad_account_id: data.ad_account_id,
    access_token_secret_id: data.access_token_secret_id || data.secret_id,
    status: data.status,
    initial_backfill_done: data.initial_backfill_done || false,
    last_extraction: data.last_extraction ? timestampToDate(data.last_extraction) : null,
    last_extraction_records: data.last_extraction_records,
    last_error: data.last_error,
    next_scheduled_run: data.next_scheduled_run ? timestampToDate(data.next_scheduled_run) : null
  }
}

/**
 * Actualiza la configuración de Meta Ads
 */
export async function updateMetaDatasourceConfig(
  tenantId: string,
  updates: Partial<MetaDatasourceConfig>
): Promise<void> {
  const datasourceRef = doc(db, 'tenants', tenantId, 'datasources', 'meta_ads')

  const rawUpdateData = {
    ...updates,
    updatedAt: serverTimestamp()
  }

  const updateData = removeUndefinedFields(rawUpdateData)

  await updateDoc(datasourceRef, updateData)

  console.log(`✅ Meta Ads config actualizada para tenant ${tenantId}`)
}

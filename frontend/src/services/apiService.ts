/**
 * Servicio para comunicarse con el backend API
 * Maneja: credenciales, ingesta de datos, sincronización
 */

import { auth } from '@/config/firebase'

// URL base del backend - usa rutas relativas para proxy de Firebase Hosting/Vite
const API_BASE_URL = ''

/**
 * Obtiene el token de autenticación de Firebase
 */
async function getAuthToken(): Promise<string> {
  const user = auth.currentUser
  if (!user) {
    throw new Error('Usuario no autenticado')
  }
  return await user.getIdToken()
}

/**
 * Realiza una petición HTTP al backend
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken()

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    let errorData = null
    const responseText = await response.text()

    try {
      errorData = JSON.parse(responseText)
    } catch (e) {
      // Si no es JSON, usar el texto crudo
      console.error('❌ Backend response (not JSON):', responseText)
    }

    console.error('❌ Backend error response:', {
      status: response.status,
      statusText: response.statusText,
      data: errorData,
      rawText: responseText
    })

    const errorMessage = errorData?.error || errorData?.message || responseText || response.statusText
    const errorDetails = errorData?.details || errorData?.validation || ''
    const fullError = errorDetails
      ? `${errorMessage} - ${JSON.stringify(errorDetails)}`
      : errorMessage
    throw new Error(`API Error (${response.status}): ${fullError}`)
  }

  return await response.json()
}

// ==================== FRONT 2: Credenciales ====================

export interface SaveCredentialsRequest {
  tenantId: string
  platform: string
  credentials: Record<string, any>
}

export interface SaveCredentialsResponse {
  success: boolean
  secret_id: string
  message: string
}

/**
 * FRONT 2: Guarda credenciales en Secret Manager
 * @param request - Datos de las credenciales a guardar
 * @returns secret_id para guardar en Firestore
 */
export async function saveCredentials(
  request: SaveCredentialsRequest
): Promise<SaveCredentialsResponse> {
  // Mapear el nombre de la plataforma al endpoint correcto
  const platformEndpoints: Record<string, string> = {
    'meta_ads': 'meta',
    'google_analytics_4': 'ga4',
    'shopify': 'shopify',
    'tiendanube': 'tiendanube',
    'mercadolibre': 'mercadolibre',
    'tiktok_ads': 'tiktok'
  }

  const endpoint = platformEndpoints[request.platform] || request.platform

  // Enviar solo credentials en el body (el backend extrae tenantId del token JWT)
  return await apiRequest<SaveCredentialsResponse>(
    `/api/secrets/${endpoint}`,
    {
      method: 'POST',
      body: JSON.stringify({
        credentials: request.credentials
      }),
    }
  )
}

/**
 * Renueva credenciales existentes
 */
export async function renewCredentials(
  tenantId: string,
  platform: string,
  secretId: string,
  newCredentials: Record<string, any>
): Promise<SaveCredentialsResponse> {
  return await apiRequest<SaveCredentialsResponse>(
    '/api/credentials/renew',
    {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        platform,
        secretId,
        credentials: newCredentials
      }),
    }
  )
}

// ==================== FRONT 3: Sync Now ====================

// Mapeo de nombres de plataforma del frontend al backend
// Reserved for future use when implementing platform mapping
/*
const PLATFORM_TO_DATASOURCE: Record<string, string> = {
  'meta-ads': 'meta',
  'tiktok': 'tiktok',
  'shopify': 'shopify',
  'google-analytics-4': 'ga4',
  'tiendanube': 'tiendanube',
  'mercadolibre': 'mercadolibre',
  'amazon': 'amazon',
  'google-ads': 'google-ads'
}
*/

export interface SyncNowRequest {
  tenantId: string
  datasourceId: string  // ID del datasource en Firestore
  datasource: string    // Nombre de la plataforma para el backend (meta, tiktok, etc)
}

export interface SyncNowResponse {
  job_id: string
  status: 'started' | 'queued'
  message: string
}

export interface SyncStatusResponse {
  job_id: string
  status: 'running' | 'completed' | 'failed' | 'queued'
  progress?: number
  recordsProcessed?: number
  error?: string
  startedAt?: string
  completedAt?: string
}

/**
 * FRONT 3: Ejecuta sincronización manual inmediata
 * @param request - Datos del datasource a sincronizar
 * @returns job_id para hacer seguimiento
 */
export async function runSyncNow(
  request: SyncNowRequest
): Promise<SyncNowResponse> {
  // El backend solo necesita tenantId, datasourceId y datasource (nombre de plataforma)
  const payload = {
    tenantId: request.tenantId,
    datasourceId: request.datasourceId,
    datasource: request.datasource
  }

  console.log('📤 Enviando request al backend:', payload)

  return await apiRequest<SyncNowResponse>(
    '/api/ingest/run-now',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
}

/**
 * Obtiene el estado de una sincronización en progreso
 */
export async function getSyncStatus(
  jobId: string
): Promise<SyncStatusResponse> {
  return await apiRequest<SyncStatusResponse>(
    `/api/ingest/status/${jobId}`,
    {
      method: 'GET',
    }
  )
}

// ==================== OAuth / Integraciones ====================

export interface MetaOAuthRequest {
  tenantId: string
  code: string // Authorization code de Meta
  redirectUri: string
}

export interface MetaOAuthResponse {
  secret_id: string
  adAccountId: string
  expiresAt: string
}

/**
 * Intercambia código de autorización de Meta por credenciales
 * y guarda en Secret Manager
 */
export async function exchangeMetaAuthCode(
  request: MetaOAuthRequest
): Promise<MetaOAuthResponse> {
  return await apiRequest<MetaOAuthResponse>(
    '/api/oauth/meta/exchange',
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  )
}

// ==================== Validación ====================

export interface ValidateCredentialsRequest {
  platform: string
  secretId: string
}

export interface ValidateCredentialsResponse {
  valid: boolean
  error?: string
}

/**
 * Valida que las credenciales guardadas en Secret Manager sean válidas
 */
export async function validateCredentials(
  request: ValidateCredentialsRequest
): Promise<ValidateCredentialsResponse> {
  return await apiRequest<ValidateCredentialsResponse>(
    '/api/credentials/validate',
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  )
}

// ==================== Eliminación de Secrets ====================

export interface DeleteSecretRequest {
  tenantId: string
  secretId: string
  platform: string
}

export interface DeleteSecretResponse {
  success: boolean
  message: string
}

/**
 * Elimina un secret de Google Cloud Secret Manager
 * IMPORTANTE: Esta acción es irreversible
 */
export async function deleteSecret(
  request: DeleteSecretRequest
): Promise<DeleteSecretResponse> {
  const platformMapping: Record<string, string> = {
    'meta_ads': 'meta',
    'tiktok_ads': 'tiktok',
    'shopify': 'shopify',
    'google_analytics_4': 'ga4',
    'tiendanube': 'tiendanube',
    'mercadolibre': 'mercadolibre',
    'amazon': 'amazon'
  }

  const backendPlatform = platformMapping[request.platform] || request.platform

  return await apiRequest<DeleteSecretResponse>(
    `/api/secrets/${backendPlatform}/${request.secretId}`,
    {
      method: 'DELETE',
    }
  )
}

// ==================== User Claims ====================

export interface SetUserClaimsRequest {
  tenantId: string
}

export interface SetUserClaimsResponse {
  success: boolean
  message: string
}

/**
 * Configura los custom claims del usuario en Firebase Auth
 * IMPORTANTE: Después de llamar esto, el usuario debe refrescar su token
 */
export async function setUserClaims(
  request: SetUserClaimsRequest
): Promise<SetUserClaimsResponse> {
  return await apiRequest<SetUserClaimsResponse>(
    '/api/auth/set-claims',
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  )
}

// ==================== Backfill ====================

export interface BackfillRequest {
  tenantId: string
  datasourceId: string
  platform: string
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
}

export interface BackfillResponse {
  job_id: string
  status: 'started' | 'queued'
  dateRange: {
    start: string
    end: string
  }
  estimatedDays: number
}

/**
 * Ejecuta backfill de datos históricos
 */
export async function runBackfill(
  request: BackfillRequest
): Promise<BackfillResponse> {
  return await apiRequest<BackfillResponse>(
    '/api/ingest/backfill',
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  )
}

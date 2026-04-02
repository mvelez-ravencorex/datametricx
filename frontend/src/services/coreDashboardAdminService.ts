/**
 * Admin Service for Core Dashboards
 *
 * These endpoints require SysOwner permission (isSysOwner custom claim)
 * Core dashboards are TEMPLATES stored in root-level Firestore collections
 * They are visible to all users but only SysOwner can manage them
 */

import { getAuth } from 'firebase/auth'

const API_BASE = '/api/admin'

interface CoreDashboard {
  id: string
  name: string
  description: string | null
  folderId: string | null
  config: Record<string, unknown>
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

interface CoreFolder {
  id: string
  name: string
  parentId: string | null
  createdAt: string
  createdBy: string
}

interface CopyToCoreRequest {
  tenant_id: string
  dashboard_id: string
  folder_id?: string | null
}

interface CreateFolderRequest {
  name: string
  parent_id?: string | null
}

/**
 * Get authorization headers with Firebase ID token
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const auth = getAuth()
  const user = auth.currentUser

  if (!user) {
    throw new Error('Usuario no autenticado')
  }

  const token = await user.getIdToken()

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

/**
 * Handle API response
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error desconocido' }))
    throw new Error(error.detail || `Error ${response.status}`)
  }
  return response.json()
}

// ============================================================================
// CORE DASHBOARDS
// ============================================================================

/**
 * Copy a dashboard from a tenant to the core collection
 * Only SysOwner can perform this action
 */
export async function copyDashboardToCore(
  tenantId: string,
  dashboardId: string,
  folderId?: string | null
): Promise<{ id: string; message: string }> {
  const headers = await getAuthHeaders()

  const body: CopyToCoreRequest = {
    tenant_id: tenantId,
    dashboard_id: dashboardId
  }

  if (folderId) {
    body.folder_id = folderId
  }

  const response = await fetch(`${API_BASE}/core-dashboards`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  return handleResponse(response)
}

/**
 * Delete a dashboard from the core collection
 * Only SysOwner can perform this action
 */
export async function deleteCoreDashboard(dashboardId: string): Promise<{ message: string }> {
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_BASE}/core-dashboards/${dashboardId}`, {
    method: 'DELETE',
    headers
  })

  return handleResponse(response)
}

/**
 * List all core dashboards
 * Only SysOwner can perform this action
 */
export async function listCoreDashboardsAdmin(): Promise<CoreDashboard[]> {
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_BASE}/core-dashboards`, {
    method: 'GET',
    headers
  })

  return handleResponse(response)
}

// ============================================================================
// CORE FOLDERS
// ============================================================================

/**
 * Create a folder in the core collection
 * Only SysOwner can perform this action
 */
export async function createCoreFolder(
  name: string,
  parentId?: string | null
): Promise<{ id: string; message: string }> {
  const headers = await getAuthHeaders()

  const body: CreateFolderRequest = { name }

  if (parentId) {
    body.parent_id = parentId
  }

  const response = await fetch(`${API_BASE}/core-dashboard-folders`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  return handleResponse(response)
}

/**
 * Delete a folder from the core collection
 * Only SysOwner can perform this action
 */
export async function deleteCoreFolder(folderId: string): Promise<{ message: string }> {
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_BASE}/core-dashboard-folders/${folderId}`, {
    method: 'DELETE',
    headers
  })

  return handleResponse(response)
}

/**
 * List all core folders
 * Only SysOwner can perform this action
 */
export async function listCoreFoldersAdmin(): Promise<CoreFolder[]> {
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_BASE}/core-dashboard-folders`, {
    method: 'GET',
    headers
  })

  return handleResponse(response)
}

/**
 * Servicio para gestionar Dashboards (.dsh) en Firestore
 * Estructura: tenants/{tenantId}/dashboards/{dashboardId}
 *             tenants/{tenantId}/dashboard_folders/{folderId}
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
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import {
  DashboardDocument,
  DashboardConfig,
  CreateDashboardRequest,
  UpdateDashboardRequest,
  DashboardListItem,
  FolderDocument,
  FolderListItem,
  CreateFolderRequest
} from '@/types/viz'
import { nanoid } from 'nanoid'

const TENANTS_COLLECTION = 'tenants'
const DASHBOARDS_SUBCOLLECTION = 'dashboards'
const FOLDERS_SUBCOLLECTION = 'viz_folders' // Share folders with visualizations

// Core collections - ROOT LEVEL (not tenant-specific)
// These are templates created by DataMetricX, accessible to all users
// SECURITY: These collections only contain CONFIGURATION, not data
// Data is always fetched from the user's own tenant
const CORE_DASHBOARDS_COLLECTION = 'core_dashboards'
const CORE_FOLDERS_COLLECTION = 'core_dashboard_folders'

// Core folder ID - this is a special folder that contains system dashboards
export const CORE_FOLDER_NAME = 'Core'

// ============================================================================
// HELPERS
// ============================================================================

function convertTimestamp(timestamp: Timestamp | null | undefined): Date {
  return timestamp?.toDate() || new Date()
}

function generatePublicToken(): string {
  return nanoid(24)
}

/**
 * Recursively removes undefined values from an object.
 * Firestore doesn't accept undefined values, so we need to clean the data before saving.
 */
function removeUndefinedValues<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedValues(item)) as T
  }

  if (typeof obj === 'object' && obj !== null) {
    const cleaned: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedValues(value)
      }
    }
    return cleaned as T
  }

  return obj
}

/**
 * Genera un config de dashboard vacío por defecto
 */
export function getDefaultDashboardConfig(): DashboardConfig {
  return {
    layout: {
      columns: 12,
      rowHeight: 50,
      gap: 16,
      padding: 24
    },
    theme: {
      backgroundColor: '#f9fafb',  // bg-gray-50
      fontFamily: 'Montserrat',
      primaryColor: '#3B82F6'  // secondary-blue
    },
    globalFilters: [],
    elements: [],
    variables: []
  }
}

// ============================================================================
// DASHBOARD CRUD
// ============================================================================

/**
 * Crear un nuevo dashboard
 */
export async function createDashboard(
  tenantId: string,
  userId: string,
  request: CreateDashboardRequest
): Promise<string> {
  try {
    const dashboardRef = doc(collection(db, TENANTS_COLLECTION, tenantId, DASHBOARDS_SUBCOLLECTION))
    const dashboardId = dashboardRef.id

    const dashboardData = {
      id: dashboardId,
      tenantId,
      name: request.name,
      description: request.description || null,
      folderId: request.folderId,
      // Clean undefined values from config - Firestore doesn't accept undefined
      config: removeUndefinedValues(request.config),
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
      isPublic: false,
      publicToken: null
    }

    await setDoc(dashboardRef, dashboardData)

    console.log('✅ Dashboard creado:', dashboardId)
    return dashboardId
  } catch (error) {
    console.error('❌ Error al crear dashboard:', error)
    throw error
  }
}

/**
 * Obtener un dashboard por ID
 */
export async function getDashboard(
  tenantId: string,
  dashboardId: string
): Promise<DashboardDocument | null> {
  try {
    const dashboardRef = doc(db, TENANTS_COLLECTION, tenantId, DASHBOARDS_SUBCOLLECTION, dashboardId)
    const dashboardSnap = await getDoc(dashboardRef)

    if (!dashboardSnap.exists()) {
      return null
    }

    const data = dashboardSnap.data()
    return {
      ...data,
      id: dashboardSnap.id,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt)
    } as DashboardDocument
  } catch (error) {
    console.error('❌ Error al obtener dashboard:', error)
    return null
  }
}

/**
 * Actualizar un dashboard
 */
export async function updateDashboard(
  tenantId: string,
  dashboardId: string,
  userId: string,
  request: UpdateDashboardRequest
): Promise<void> {
  try {
    const dashboardRef = doc(db, TENANTS_COLLECTION, tenantId, DASHBOARDS_SUBCOLLECTION, dashboardId)

    const updates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: userId
    }

    if (request.name !== undefined) updates.name = request.name
    if (request.description !== undefined) updates.description = request.description
    if (request.folderId !== undefined) updates.folderId = request.folderId
    if (request.config !== undefined) {
      // Clean undefined values from config - Firestore doesn't accept undefined
      updates.config = removeUndefinedValues(request.config)
    }
    if (request.isPublic !== undefined) {
      updates.isPublic = request.isPublic
      if (request.isPublic) {
        // Generar token si se hace público
        const existingDashboard = await getDashboard(tenantId, dashboardId)
        if (!existingDashboard?.publicToken) {
          updates.publicToken = generatePublicToken()
        }
      }
    }

    await updateDoc(dashboardRef, updates)

    console.log('✅ Dashboard actualizado:', dashboardId)
  } catch (error) {
    console.error('❌ Error al actualizar dashboard:', error)
    throw error
  }
}

/**
 * Eliminar un dashboard
 */
export async function deleteDashboard(
  tenantId: string,
  dashboardId: string
): Promise<void> {
  try {
    const dashboardRef = doc(db, TENANTS_COLLECTION, tenantId, DASHBOARDS_SUBCOLLECTION, dashboardId)
    await deleteDoc(dashboardRef)

    console.log('✅ Dashboard eliminado:', dashboardId)
  } catch (error) {
    console.error('❌ Error al eliminar dashboard:', error)
    throw error
  }
}

/**
 * Listar todos los dashboards de un tenant
 */
export async function listDashboards(
  tenantId: string,
  folderId?: string | null
): Promise<DashboardListItem[]> {
  try {
    const dashboardsRef = collection(db, TENANTS_COLLECTION, tenantId, DASHBOARDS_SUBCOLLECTION)

    let q
    if (folderId === undefined) {
      // Todos los dashboards
      q = query(dashboardsRef, orderBy('updatedAt', 'desc'))
    } else {
      // Dashboards en folder específico (null = root)
      q = query(
        dashboardsRef,
        where('folderId', '==', folderId),
        orderBy('updatedAt', 'desc')
      )
    }

    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.name,
        description: data.description,
        folderId: data.folderId,
        elementCount: data.config?.elements?.length || 0,
        updatedAt: convertTimestamp(data.updatedAt),
        updatedBy: data.updatedBy
      } as DashboardListItem
    })
  } catch (error) {
    console.error('❌ Error al listar dashboards:', error)
    return []
  }
}

// ============================================================================
// DASHBOARD FOLDER CRUD
// ============================================================================

/**
 * Crear una nueva carpeta de dashboards
 */
export async function createDashboardFolder(
  tenantId: string,
  userId: string,
  request: CreateFolderRequest
): Promise<string> {
  try {
    const folderRef = doc(collection(db, TENANTS_COLLECTION, tenantId, FOLDERS_SUBCOLLECTION))
    const folderId = folderRef.id

    const folderData = {
      id: folderId,
      tenantId,
      name: request.name,
      parentId: request.parentId,
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp()
    }

    await setDoc(folderRef, folderData)

    console.log('✅ Dashboard folder creado:', folderId)
    return folderId
  } catch (error) {
    console.error('❌ Error al crear dashboard folder:', error)
    throw error
  }
}

/**
 * Obtener una carpeta por ID
 */
export async function getDashboardFolder(
  tenantId: string,
  folderId: string
): Promise<FolderDocument | null> {
  try {
    const folderRef = doc(db, TENANTS_COLLECTION, tenantId, FOLDERS_SUBCOLLECTION, folderId)
    const folderSnap = await getDoc(folderRef)

    if (!folderSnap.exists()) {
      return null
    }

    const data = folderSnap.data()
    return {
      ...data,
      id: folderSnap.id,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt)
    } as FolderDocument
  } catch (error) {
    console.error('❌ Error al obtener dashboard folder:', error)
    return null
  }
}

/**
 * Actualizar una carpeta
 */
export async function updateDashboardFolder(
  tenantId: string,
  folderId: string,
  name: string
): Promise<void> {
  try {
    const folderRef = doc(db, TENANTS_COLLECTION, tenantId, FOLDERS_SUBCOLLECTION, folderId)

    await updateDoc(folderRef, {
      name,
      updatedAt: serverTimestamp()
    })

    console.log('✅ Dashboard folder actualizado:', folderId)
  } catch (error) {
    console.error('❌ Error al actualizar dashboard folder:', error)
    throw error
  }
}

/**
 * Eliminar una carpeta (solo si está vacía)
 */
export async function deleteDashboardFolder(
  tenantId: string,
  folderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verificar que no tenga dashboards
    const dashboards = await listDashboards(tenantId, folderId)
    if (dashboards.length > 0) {
      return { success: false, error: 'La carpeta contiene dashboards' }
    }

    // Verificar que no tenga subcarpetas
    const subfolders = await listDashboardFolders(tenantId, folderId)
    if (subfolders.length > 0) {
      return { success: false, error: 'La carpeta contiene subcarpetas' }
    }

    const folderRef = doc(db, TENANTS_COLLECTION, tenantId, FOLDERS_SUBCOLLECTION, folderId)
    await deleteDoc(folderRef)

    console.log('✅ Dashboard folder eliminado:', folderId)
    return { success: true }
  } catch (error) {
    console.error('❌ Error al eliminar dashboard folder:', error)
    throw error
  }
}

/**
 * Listar carpetas de dashboards de un tenant
 */
export async function listDashboardFolders(
  tenantId: string,
  parentId?: string | null
): Promise<FolderListItem[]> {
  try {
    const foldersRef = collection(db, TENANTS_COLLECTION, tenantId, FOLDERS_SUBCOLLECTION)

    let q
    if (parentId === undefined) {
      // Todas las carpetas
      q = query(foldersRef, orderBy('name', 'asc'))
    } else {
      // Carpetas en parent específico (null = root)
      q = query(
        foldersRef,
        where('parentId', '==', parentId),
        orderBy('name', 'asc')
      )
    }

    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      parentId: doc.data().parentId
    } as FolderListItem))
  } catch (error) {
    console.error('❌ Error al listar dashboard folders:', error)
    return []
  }
}

// ============================================================================
// TREE VIEW
// ============================================================================

export interface DashboardTreeNode {
  type: 'folder' | 'dashboard'
  id: string
  name: string
  children?: DashboardTreeNode[]
  elementCount?: number
}

/**
 * Construir árbol de dashboards y carpetas
 */
export async function getDashboardTree(tenantId: string): Promise<DashboardTreeNode[]> {
  try {
    // Obtener todas las carpetas y dashboards
    const [folders, dashboards] = await Promise.all([
      listDashboardFolders(tenantId),
      listDashboards(tenantId)
    ])

    // Crear mapa de carpetas
    const folderMap = new Map<string | null, DashboardTreeNode[]>()

    // Inicializar root
    folderMap.set(null, [])

    // Agregar carpetas al mapa
    for (const folder of folders) {
      const node: DashboardTreeNode = {
        type: 'folder',
        id: folder.id,
        name: folder.name,
        children: []
      }

      // Agregar al parent
      const parentChildren = folderMap.get(folder.parentId) || []
      parentChildren.push(node)
      folderMap.set(folder.parentId, parentChildren)

      // Inicializar children de este folder
      if (!folderMap.has(folder.id)) {
        folderMap.set(folder.id, [])
      }
    }

    // Agregar dashboards al mapa
    for (const dashboard of dashboards) {
      const node: DashboardTreeNode = {
        type: 'dashboard',
        id: dashboard.id,
        name: dashboard.name,
        elementCount: dashboard.elementCount
      }

      const parentChildren = folderMap.get(dashboard.folderId) || []
      parentChildren.push(node)
      folderMap.set(dashboard.folderId, parentChildren)
    }

    // Asignar children a cada folder
    for (const folder of folders) {
      const folderNode = findNodeById(folderMap.get(folder.parentId) || [], folder.id)
      if (folderNode) {
        folderNode.children = folderMap.get(folder.id) || []
      }
    }

    // Retornar root
    return folderMap.get(null) || []
  } catch (error) {
    console.error('❌ Error al construir árbol de dashboards:', error)
    return []
  }
}

function findNodeById(nodes: DashboardTreeNode[], id: string): DashboardTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
  }
  return undefined
}

// ============================================================================
// PUBLIC ACCESS
// ============================================================================

/**
 * Habilitar/deshabilitar acceso público
 */
export async function toggleDashboardPublicAccess(
  tenantId: string,
  dashboardId: string,
  userId: string,
  isPublic: boolean
): Promise<string | null> {
  try {
    const dashboardRef = doc(db, TENANTS_COLLECTION, tenantId, DASHBOARDS_SUBCOLLECTION, dashboardId)

    const updates: Record<string, unknown> = {
      isPublic,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    }

    if (isPublic) {
      const existingDashboard = await getDashboard(tenantId, dashboardId)
      if (!existingDashboard?.publicToken) {
        updates.publicToken = generatePublicToken()
      }
    }

    await updateDoc(dashboardRef, updates)

    if (isPublic) {
      const updatedDashboard = await getDashboard(tenantId, dashboardId)
      return updatedDashboard?.publicToken || null
    }

    return null
  } catch (error) {
    console.error('❌ Error al toggle acceso público de dashboard:', error)
    throw error
  }
}

// ============================================================================
// DUPLICATE DASHBOARD
// ============================================================================

/**
 * Duplicar un dashboard existente
 */
export async function duplicateDashboard(
  tenantId: string,
  userId: string,
  dashboardId: string,
  newName?: string
): Promise<string> {
  try {
    const originalDashboard = await getDashboard(tenantId, dashboardId)
    if (!originalDashboard) {
      throw new Error('Dashboard no encontrado')
    }

    const duplicateRequest: CreateDashboardRequest = {
      name: newName || `${originalDashboard.name} (copia)`,
      description: originalDashboard.description,
      folderId: originalDashboard.folderId,
      config: JSON.parse(JSON.stringify(originalDashboard.config)) // Deep copy
    }

    // Generar nuevos IDs para los elementos
    duplicateRequest.config.elements = duplicateRequest.config.elements.map(element => ({
      ...element,
      id: nanoid(10)
    }))

    return await createDashboard(tenantId, userId, duplicateRequest)
  } catch (error) {
    console.error('❌ Error al duplicar dashboard:', error)
    throw error
  }
}

// ============================================================================
// CORE DASHBOARDS - System dashboards visible to all tenants
// ============================================================================

/**
 * Listar dashboards core (colección raíz core_dashboards)
 * Estos son PLANTILLAS creadas por DataMetricX, visibles para todos los usuarios
 * SECURITY: Solo contienen configuración, no datos. Los datos vienen del tenant del usuario
 */
export async function listCoreDashboards(): Promise<DashboardListItem[]> {
  try {
    // Read from ROOT LEVEL collection - accessible to all authenticated users
    const dashboardsRef = collection(db, CORE_DASHBOARDS_COLLECTION)
    const q = query(dashboardsRef, orderBy('updatedAt', 'desc'))

    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.name,
        description: data.description,
        folderId: data.folderId,
        elementCount: data.config?.elements?.length || 0,
        updatedAt: convertTimestamp(data.updatedAt),
        updatedBy: data.updatedBy,
        isCore: true // Always true for core dashboards
      } as DashboardListItem
    })
  } catch (error) {
    console.error('❌ Error al listar core dashboards:', error)
    return []
  }
}

/**
 * Listar carpetas core (colección raíz core_dashboard_folders)
 * SECURITY: Solo contienen organización de plantillas, no datos
 */
export async function listCoreFolders(): Promise<FolderListItem[]> {
  try {
    // Read from ROOT LEVEL collection
    const foldersRef = collection(db, CORE_FOLDERS_COLLECTION)
    const q = query(foldersRef, orderBy('name', 'asc'))

    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      parentId: doc.data().parentId,
      isCore: true // Always true for core folders
    } as FolderListItem))
  } catch (error) {
    console.error('❌ Error al listar core folders:', error)
    return []
  }
}

/**
 * Listar dashboards combinando los del tenant con los core
 * Los core dashboards aparecen primero y están marcados como isCore
 */
export async function listDashboardsWithCore(
  tenantId: string,
  folderId?: string | null
): Promise<DashboardListItem[]> {
  try {
    // Si estamos en el root (folderId=null), incluir core dashboards
    // Si estamos en una carpeta específica, solo mostrar dashboards de esa carpeta
    const [tenantDashboards, coreDashboards] = await Promise.all([
      listDashboards(tenantId, folderId),
      folderId === null ? listCoreDashboards() : Promise.resolve([])
    ])

    // Core dashboards primero, luego tenant dashboards
    return [...coreDashboards, ...tenantDashboards]
  } catch (error) {
    console.error('❌ Error al listar dashboards con core:', error)
    return []
  }
}

/**
 * Listar carpetas combinando las del tenant con las core
 */
export async function listFoldersWithCore(
  tenantId: string,
  parentId?: string | null
): Promise<FolderListItem[]> {
  try {
    // En el root, mostrar carpetas core + carpetas del tenant
    const [tenantFolders, coreFolders] = await Promise.all([
      listDashboardFolders(tenantId, parentId),
      parentId === null ? listCoreFolders() : Promise.resolve([])
    ])

    // Core folders primero
    return [...coreFolders, ...tenantFolders]
  } catch (error) {
    console.error('❌ Error al listar folders con core:', error)
    return []
  }
}

/**
 * Obtener un dashboard core por ID (desde colección raíz)
 * SECURITY: Solo lectura de configuración. Los datos vienen del tenant del usuario
 */
export async function getCoreDashboard(dashboardId: string): Promise<DashboardDocument | null> {
  try {
    const dashboardRef = doc(db, CORE_DASHBOARDS_COLLECTION, dashboardId)
    const dashboardSnap = await getDoc(dashboardRef)

    if (!dashboardSnap.exists()) {
      return null
    }

    const data = dashboardSnap.data()
    return {
      ...data,
      id: dashboardSnap.id,
      isCore: true,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt)
    } as DashboardDocument
  } catch (error) {
    console.error('❌ Error al obtener core dashboard:', error)
    return null
  }
}

// ============================================================================
// CORE DASHBOARD MANAGEMENT (Admin SDK only)
// ============================================================================
// NOTE: The following functions are placeholders for Admin SDK operations
// Writing to core_dashboards and core_dashboard_folders is ONLY allowed via
// Firebase Admin SDK on the backend. Firestore rules block client writes.

/**
 * Copiar un dashboard de tenant a la colección core
 * NOTA: Esta operación requiere Admin SDK en el backend
 * El frontend debe llamar a una Cloud Function para esto
 */
export async function copyDashboardToCore(
  _tenantId: string,
  _dashboardId: string,
  _userId: string
): Promise<void> {
  throw new Error(
    'copyDashboardToCore requires Admin SDK. ' +
    'Call the backend API endpoint to copy a dashboard to core collection.'
  )
}

/**
 * Eliminar un dashboard de la colección core
 * NOTA: Esta operación requiere Admin SDK en el backend
 */
export async function removeFromCore(_dashboardId: string): Promise<void> {
  throw new Error(
    'removeFromCore requires Admin SDK. ' +
    'Call the backend API endpoint to remove a dashboard from core collection.'
  )
}

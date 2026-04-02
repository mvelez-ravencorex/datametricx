/**
 * Servicio para gestionar Visualizaciones (Viz) en Firestore
 * Estructura: tenants/{tenantId}/vizs/{vizId}
 *             tenants/{tenantId}/viz_folders/{folderId}
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
  VizDocument,
  FolderDocument,
  VizConfig,
  CreateVizRequest,
  UpdateVizRequest,
  CreateFolderRequest,
  VizListItem,
  FolderListItem,
  VizTreeNode
} from '@/types/viz'
import { nanoid } from 'nanoid'

const TENANTS_COLLECTION = 'tenants'
const VIZS_SUBCOLLECTION = 'vizs'
const FOLDERS_SUBCOLLECTION = 'viz_folders'
const DASHBOARDS_SUBCOLLECTION = 'dashboards'

// Core collections - ROOT LEVEL (not tenant-specific)
// These are templates created by DataMetricX, accessible to all users
// SECURITY: These collections only contain CONFIGURATION, not data
// Data is always fetched from the user's own tenant context
const CORE_DASHBOARDS_COLLECTION = 'core_dashboards'
const CORE_FOLDERS_COLLECTION = 'core_dashboard_folders'

// ============================================================================
// HELPERS
// ============================================================================

function convertTimestamp(timestamp: Timestamp | null | undefined): Date {
  return timestamp?.toDate() || new Date()
}

function generatePublicToken(): string {
  return nanoid(24)
}

// ============================================================================
// VIZ CRUD
// ============================================================================

/**
 * Crear una nueva visualización
 */
export async function createViz(
  tenantId: string,
  userId: string,
  request: CreateVizRequest
): Promise<string> {
  try {
    const vizRef = doc(collection(db, TENANTS_COLLECTION, tenantId, VIZS_SUBCOLLECTION))
    const vizId = vizRef.id

    const vizData = {
      id: vizId,
      tenantId,
      name: request.name,
      description: request.description || null,
      folderId: request.folderId,
      config: request.config,
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
      isPublic: false,
      publicToken: null
    }

    await setDoc(vizRef, vizData)

    console.log('✅ Viz creada:', vizId)
    return vizId
  } catch (error) {
    console.error('❌ Error al crear viz:', error)
    throw error
  }
}

/**
 * Obtener una visualización por ID
 */
export async function getViz(
  tenantId: string,
  vizId: string
): Promise<VizDocument | null> {
  try {
    const vizRef = doc(db, TENANTS_COLLECTION, tenantId, VIZS_SUBCOLLECTION, vizId)
    const vizSnap = await getDoc(vizRef)

    if (!vizSnap.exists()) {
      return null
    }

    const data = vizSnap.data()
    return {
      ...data,
      id: vizSnap.id,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt)
    } as VizDocument
  } catch (error) {
    console.error('❌ Error al obtener viz:', error)
    return null
  }
}

/**
 * Actualizar una visualización
 */
export async function updateViz(
  tenantId: string,
  vizId: string,
  userId: string,
  request: UpdateVizRequest
): Promise<void> {
  try {
    const vizRef = doc(db, TENANTS_COLLECTION, tenantId, VIZS_SUBCOLLECTION, vizId)

    const updates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: userId
    }

    if (request.name !== undefined) updates.name = request.name
    if (request.description !== undefined) updates.description = request.description
    if (request.folderId !== undefined) updates.folderId = request.folderId
    if (request.config !== undefined) updates.config = request.config
    if (request.isPublic !== undefined) {
      updates.isPublic = request.isPublic
      if (request.isPublic) {
        // Generar token si se hace pública
        const existingViz = await getViz(tenantId, vizId)
        if (!existingViz?.publicToken) {
          updates.publicToken = generatePublicToken()
        }
      }
    }

    await updateDoc(vizRef, updates)

    console.log('✅ Viz actualizada:', vizId)
  } catch (error) {
    console.error('❌ Error al actualizar viz:', error)
    throw error
  }
}

/**
 * Eliminar una visualización
 */
export async function deleteViz(
  tenantId: string,
  vizId: string
): Promise<void> {
  try {
    const vizRef = doc(db, TENANTS_COLLECTION, tenantId, VIZS_SUBCOLLECTION, vizId)
    await deleteDoc(vizRef)

    console.log('✅ Viz eliminada:', vizId)
  } catch (error) {
    console.error('❌ Error al eliminar viz:', error)
    throw error
  }
}

/**
 * Listar todas las visualizaciones de un tenant
 */
export async function listVizs(
  tenantId: string,
  folderId?: string | null
): Promise<VizListItem[]> {
  try {
    const vizsRef = collection(db, TENANTS_COLLECTION, tenantId, VIZS_SUBCOLLECTION)

    let q
    if (folderId === undefined) {
      // Todas las vizs
      q = query(vizsRef, orderBy('updatedAt', 'desc'))
    } else {
      // Vizs en folder específico (null = root)
      q = query(
        vizsRef,
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
        vizType: data.config?.vizType,
        datasetId: data.config?.datasetId,
        updatedAt: convertTimestamp(data.updatedAt),
        updatedBy: data.updatedBy
      } as VizListItem
    })
  } catch (error) {
    console.error('❌ Error al listar vizs:', error)
    return []
  }
}

// ============================================================================
// FOLDER CRUD
// ============================================================================

/**
 * Crear una nueva carpeta
 */
export async function createFolder(
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

    console.log('✅ Folder creado:', folderId)
    return folderId
  } catch (error) {
    console.error('❌ Error al crear folder:', error)
    throw error
  }
}

/**
 * Obtener una carpeta por ID
 */
export async function getFolder(
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
    console.error('❌ Error al obtener folder:', error)
    return null
  }
}

/**
 * Actualizar una carpeta
 */
export async function updateFolder(
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

    console.log('✅ Folder actualizado:', folderId)
  } catch (error) {
    console.error('❌ Error al actualizar folder:', error)
    throw error
  }
}

/**
 * Eliminar una carpeta (solo si está vacía)
 */
export async function deleteFolder(
  tenantId: string,
  folderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verificar que no tenga vizs
    const vizs = await listVizs(tenantId, folderId)
    if (vizs.length > 0) {
      return { success: false, error: 'La carpeta contiene visualizaciones' }
    }

    // Verificar que no tenga subcarpetas
    const subfolders = await listFolders(tenantId, folderId)
    if (subfolders.length > 0) {
      return { success: false, error: 'La carpeta contiene subcarpetas' }
    }

    const folderRef = doc(db, TENANTS_COLLECTION, tenantId, FOLDERS_SUBCOLLECTION, folderId)
    await deleteDoc(folderRef)

    console.log('✅ Folder eliminado:', folderId)
    return { success: true }
  } catch (error) {
    console.error('❌ Error al eliminar folder:', error)
    throw error
  }
}

/**
 * Listar carpetas de un tenant
 */
export async function listFolders(
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
    console.error('❌ Error al listar folders:', error)
    return []
  }
}

// ============================================================================
// TREE VIEW
// ============================================================================

/**
 * Listar dashboards de un tenant (helper interno)
 */
async function listDashboardsInternal(tenantId: string): Promise<{ id: string; name: string; folderId: string | null; updatedAt: Date; updatedBy: string }[]> {
  try {
    const dashboardsRef = collection(db, TENANTS_COLLECTION, tenantId, DASHBOARDS_SUBCOLLECTION)
    const q = query(dashboardsRef, orderBy('updatedAt', 'desc'))
    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.name,
        folderId: data.folderId,
        updatedAt: convertTimestamp(data.updatedAt),
        updatedBy: data.updatedBy || ''
      }
    })
  } catch (error) {
    console.error('❌ Error al listar dashboards:', error)
    return []
  }
}

/**
 * Construir árbol de visualizaciones, dashboards y carpetas
 */
export async function getVizTree(tenantId: string): Promise<VizTreeNode[]> {
  try {
    // Obtener todas las carpetas, vizs y dashboards
    const [folders, vizs, dashboards] = await Promise.all([
      listFolders(tenantId),
      listVizs(tenantId),
      listDashboardsInternal(tenantId)
    ])

    // Crear mapa de carpetas
    const folderMap = new Map<string | null, VizTreeNode[]>()

    // Inicializar root
    folderMap.set(null, [])

    // Agregar carpetas al mapa
    for (const folder of folders) {
      const node: VizTreeNode = {
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

    // Agregar vizs al mapa
    for (const viz of vizs) {
      const node: VizTreeNode = {
        type: 'viz',
        id: viz.id,
        name: viz.name,
        vizType: viz.vizType,
        datasetId: viz.datasetId,
        updatedAt: viz.updatedAt,
        updatedBy: viz.updatedBy
      }

      const parentChildren = folderMap.get(viz.folderId) || []
      parentChildren.push(node)
      folderMap.set(viz.folderId, parentChildren)
    }

    // Agregar dashboards al mapa
    for (const dashboard of dashboards) {
      const node: VizTreeNode = {
        type: 'dashboard',
        id: dashboard.id,
        name: dashboard.name,
        updatedAt: dashboard.updatedAt,
        updatedBy: dashboard.updatedBy
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
    console.error('❌ Error al construir árbol:', error)
    return []
  }
}

function findNodeById(nodes: VizTreeNode[], id: string): VizTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
  }
  return undefined
}

// ============================================================================
// PUBLIC ACCESS
// ============================================================================

/**
 * Obtener viz por token público
 */
export async function getVizByPublicToken(
  _token: string
): Promise<{ viz: VizDocument; config: VizConfig } | null> {
  try {
    // Buscar en todos los tenants (query de grupo de colecciones)
    // Por ahora buscar secuencialmente - optimizar con collectionGroup después
    // Esta función se usará para el acceso público sin autenticación

    // TODO: Implementar con collectionGroup cuando sea necesario
    console.warn('getVizByPublicToken: Implementar con collectionGroup')
    return null
  } catch (error) {
    console.error('❌ Error al obtener viz por token:', error)
    return null
  }
}

/**
 * Habilitar/deshabilitar acceso público
 */
export async function togglePublicAccess(
  tenantId: string,
  vizId: string,
  userId: string,
  isPublic: boolean
): Promise<string | null> {
  try {
    const vizRef = doc(db, TENANTS_COLLECTION, tenantId, VIZS_SUBCOLLECTION, vizId)

    const updates: Record<string, unknown> = {
      isPublic,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    }

    if (isPublic) {
      const existingViz = await getViz(tenantId, vizId)
      if (!existingViz?.publicToken) {
        updates.publicToken = generatePublicToken()
      }
    }

    await updateDoc(vizRef, updates)

    if (isPublic) {
      const updatedViz = await getViz(tenantId, vizId)
      return updatedViz?.publicToken || null
    }

    return null
  } catch (error) {
    console.error('❌ Error al toggle acceso público:', error)
    throw error
  }
}

// ============================================================================
// CORE ITEMS - Visible to all tenants (from root-level collections)
// ============================================================================

/**
 * List core dashboards from root collection
 * SECURITY: These are TEMPLATES - data comes from user's own tenant
 */
async function listCoreDashboards(): Promise<{ id: string; name: string; folderId: string | null; updatedAt: Date; updatedBy: string }[]> {
  try {
    const dashboardsRef = collection(db, CORE_DASHBOARDS_COLLECTION)
    const q = query(dashboardsRef, orderBy('updatedAt', 'desc'))
    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.name,
        folderId: data.folderId || null,
        updatedAt: convertTimestamp(data.updatedAt),
        updatedBy: data.updatedBy || ''
      }
    })
  } catch (error) {
    console.error('❌ Error al listar core dashboards:', error)
    return []
  }
}

/**
 * List core folders from root collection
 */
async function listCoreFolders(): Promise<FolderListItem[]> {
  try {
    const foldersRef = collection(db, CORE_FOLDERS_COLLECTION)
    const q = query(foldersRef, orderBy('name', 'asc'))
    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      parentId: doc.data().parentId || null
    } as FolderListItem))
  } catch (error) {
    console.error('❌ Error al listar core folders:', error)
    return []
  }
}

/**
 * Build tree from core items (dashboards and folders from root collections)
 */
async function getCoreTree(): Promise<VizTreeNode[]> {
  try {
    const [folders, dashboards] = await Promise.all([
      listCoreFolders(),
      listCoreDashboards()
    ])

    // Create folder map
    const folderMap = new Map<string | null, VizTreeNode[]>()
    folderMap.set(null, [])

    // Add folders to map
    for (const folder of folders) {
      const node: VizTreeNode = {
        type: 'folder',
        id: folder.id,
        name: folder.name,
        isCore: true,
        children: []
      }

      const parentChildren = folderMap.get(folder.parentId) || []
      parentChildren.push(node)
      folderMap.set(folder.parentId, parentChildren)

      if (!folderMap.has(folder.id)) {
        folderMap.set(folder.id, [])
      }
    }

    // Add dashboards to map
    for (const dashboard of dashboards) {
      const node: VizTreeNode = {
        type: 'dashboard',
        id: dashboard.id,
        name: dashboard.name,
        isCore: true,
        updatedAt: dashboard.updatedAt,
        updatedBy: dashboard.updatedBy
      }

      const parentChildren = folderMap.get(dashboard.folderId) || []
      parentChildren.push(node)
      folderMap.set(dashboard.folderId, parentChildren)
    }

    // Assign children to each folder
    for (const folder of folders) {
      const folderNode = findNodeById(folderMap.get(folder.parentId) || [], folder.id)
      if (folderNode) {
        folderNode.children = folderMap.get(folder.id) || []
      }
    }

    return folderMap.get(null) || []
  } catch (error) {
    console.error('❌ Error al construir árbol core:', error)
    return []
  }
}

// Virtual folder ID for "Main Dashboards" - this is a client-side only ID
export const MAIN_DASHBOARDS_FOLDER_ID = '__main_dashboards__'

/**
 * Get viz tree with core items merged
 * Core items are dashboards/folders from ROOT LEVEL collections (core_dashboards, core_dashboard_folders)
 * These are TEMPLATES created by DataMetricX, visible to all users
 * SECURITY: Core items only contain CONFIGURATION - data is fetched from user's own tenant
 *
 * Core items are wrapped in a virtual "Main Dashboards" folder that appears first in all tenants
 */
export async function getVizTreeWithCore(tenantId: string): Promise<VizTreeNode[]> {
  try {
    // Get both trees in parallel
    const [tenantTree, coreTree] = await Promise.all([
      getVizTree(tenantId),
      getCoreTree()
    ])

    // If there are no core items, just return the tenant tree
    if (coreTree.length === 0) {
      return tenantTree
    }

    // Wrap core items in a virtual "Main Dashboards" folder
    const mainDashboardsFolder: VizTreeNode = {
      type: 'folder',
      id: MAIN_DASHBOARDS_FOLDER_ID,
      name: 'Main Dashboards',
      isCore: true,
      children: coreTree
    }

    // Main Dashboards folder appears first
    return [mainDashboardsFolder, ...tenantTree]
  } catch (error) {
    console.error('❌ Error al obtener árbol con core:', error)
    return []
  }
}

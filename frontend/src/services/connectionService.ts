/**
 * Servicio para gestionar conexiones a plataformas externas
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  getDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { Connection, ConnectionPlatform } from '@/types/connections'

const CONNECTIONS_COLLECTION = 'connections'

/**
 * Crear una nueva conexión
 */
export async function createConnection(
  userId: string,
  platform: ConnectionPlatform,
  credentials: any,
  config?: any
): Promise<string> {
  try {
    const connectionRef = doc(collection(db, CONNECTIONS_COLLECTION))

    const connectionData = {
      id: connectionRef.id,
      platform,
      status: 'connected' as const,
      userId,
      credentials,
      config: config || {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastSyncAt: null
    }

    await setDoc(connectionRef, connectionData)

    console.log('✅ Conexión creada:', platform, connectionRef.id)
    return connectionRef.id
  } catch (error) {
    console.error('❌ Error al crear conexión:', error)
    throw error
  }
}

/**
 * Obtener todas las conexiones de un usuario
 */
export async function getUserConnections(userId: string): Promise<Connection[]> {
  try {
    const q = query(
      collection(db, CONNECTIONS_COLLECTION),
      where('userId', '==', userId)
    )

    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => convertFirestoreConnection({
      ...doc.data(),
      id: doc.id
    }))
  } catch (error) {
    console.error('❌ Error al obtener conexiones:', error)
    return []
  }
}

/**
 * Obtener una conexión específica
 */
export async function getConnection(connectionId: string): Promise<Connection | null> {
  try {
    const connectionRef = doc(db, CONNECTIONS_COLLECTION, connectionId)
    const connectionSnap = await getDoc(connectionRef)

    if (!connectionSnap.exists()) {
      return null
    }

    return convertFirestoreConnection({
      ...connectionSnap.data(),
      id: connectionSnap.id
    })
  } catch (error) {
    console.error('❌ Error al obtener conexión:', error)
    return null
  }
}

/**
 * Actualizar una conexión existente
 */
export async function updateConnection(
  connectionId: string,
  updates: Partial<Connection>
): Promise<void> {
  try {
    const connectionRef = doc(db, CONNECTIONS_COLLECTION, connectionId)

    await updateDoc(connectionRef, {
      ...updates,
      updatedAt: serverTimestamp()
    })

    console.log('✅ Conexión actualizada:', connectionId)
  } catch (error) {
    console.error('❌ Error al actualizar conexión:', error)
    throw error
  }
}

/**
 * Actualizar estado de una conexión
 */
export async function updateConnectionStatus(
  connectionId: string,
  status: 'ok' | 'error' | 'no-data' | 'pending' | 'never-run'
): Promise<void> {
  await updateConnection(connectionId, { status })
}

/**
 * Registrar última sincronización
 */
export async function updateLastSync(connectionId: string): Promise<void> {
  try {
    const connectionRef = doc(db, CONNECTIONS_COLLECTION, connectionId)

    await updateDoc(connectionRef, {
      lastSyncAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    console.log('✅ Última sincronización actualizada:', connectionId)
  } catch (error) {
    console.error('❌ Error al actualizar última sincronización:', error)
    throw error
  }
}

/**
 * Eliminar una conexión
 */
export async function deleteConnection(connectionId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, CONNECTIONS_COLLECTION, connectionId))
    console.log('✅ Conexión eliminada:', connectionId)
  } catch (error) {
    console.error('❌ Error al eliminar conexión:', error)
    throw error
  }
}

/**
 * Verificar si existe una conexión para una plataforma
 */
export async function hasConnectionForPlatform(
  userId: string,
  platform: ConnectionPlatform
): Promise<boolean> {
  try {
    const q = query(
      collection(db, CONNECTIONS_COLLECTION),
      where('userId', '==', userId),
      where('platform', '==', platform)
    )

    const snapshot = await getDocs(q)
    return !snapshot.empty
  } catch (error) {
    console.error('❌ Error al verificar conexión:', error)
    return false
  }
}

/**
 * Obtener conexión por plataforma
 */
export async function getConnectionByPlatform(
  userId: string,
  platform: ConnectionPlatform
): Promise<Connection | null> {
  try {
    const q = query(
      collection(db, CONNECTIONS_COLLECTION),
      where('userId', '==', userId),
      where('platform', '==', platform)
    )

    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      return null
    }

    const doc = snapshot.docs[0]
    return convertFirestoreConnection({
      ...doc.data(),
      id: doc.id
    })
  } catch (error) {
    console.error('❌ Error al obtener conexión por plataforma:', error)
    return null
  }
}

/**
 * Convertir datos de Firestore a Connection
 */
function convertFirestoreConnection(data: any): Connection {
  return {
    ...data,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
    lastSyncAt: data.lastSyncAt ? (data.lastSyncAt instanceof Timestamp ? data.lastSyncAt.toDate() : new Date(data.lastSyncAt)) : undefined
  }
}

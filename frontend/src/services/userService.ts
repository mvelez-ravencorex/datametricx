/**
 * Servicio para gestionar usuarios en Firestore
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { UserProfile, CreateUserData, UpdateUserData } from '@/types/user'

const USERS_COLLECTION = 'users'

/**
 * Crear o actualizar usuario en Firestore al hacer login
 */
export async function createOrUpdateUser(userData: CreateUserData): Promise<UserProfile> {
  try {
    console.log('📝 Intentando crear/actualizar usuario en Firestore:', userData.uid)

    const userRef = doc(db, USERS_COLLECTION, userData.uid)
    const userSnap = await getDoc(userRef)

    const now = new Date()

    if (!userSnap.exists()) {
      console.log('🆕 Usuario nuevo detectado, creando documento...')

      // Usuario nuevo - crear documento
      const newUser: Omit<UserProfile, 'id'> = {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName || null,
        photoURL: userData.photoURL || null,
        phoneNumber: userData.phoneNumber || null,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
        role: 'user',
        authProvider: userData.authProvider || 'email',
        authProviders: [userData.authProvider || 'email'],
        preferences: {
          language: 'es',
          timezone: 'America/Argentina/Buenos_Aires',
          currency: 'USD',
          notifications: {
            email: true,
            push: true
          }
        },
        metadata: {
          firstLogin: true,
          loginCount: 1
        }
      }

      await setDoc(userRef, {
        ...newUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      })

      console.log('✅ Usuario creado exitosamente en Firestore:', userData.uid)

      return {
        ...newUser,
        id: userData.uid
      }
    } else {
      console.log('🔄 Usuario existente, actualizando...')

      // Usuario existente - actualizar lastLoginAt y loginCount
      const existingData = userSnap.data()

      // Agregar provider si es nuevo
      const existingProviders = existingData.authProviders || []
      const newProvider = userData.authProvider || 'email'
      const updatedProviders = existingProviders.includes(newProvider)
        ? existingProviders
        : [...existingProviders, newProvider]

      await updateDoc(userRef, {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        authProvider: newProvider,
        authProviders: updatedProviders,
        'metadata.loginCount': (existingData.metadata?.loginCount || 0) + 1,
        'metadata.firstLogin': false
      })

      console.log('✅ Usuario actualizado exitosamente en Firestore:', userData.uid)

      return convertFirestoreUser({
        id: userSnap.id,
        ...existingData
      })
    }
  } catch (error) {
    console.error('❌ Error en createOrUpdateUser:', error)
    throw error
  }
}

/**
 * Obtener perfil de usuario por UID
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      return null
    }

    return convertFirestoreUser({
      id: userSnap.id,
      ...userSnap.data()
    })
  } catch (error) {
    console.error('Error obteniendo perfil de usuario:', error)
    return null
  }
}

/**
 * Actualizar perfil de usuario
 */
export async function updateUserProfile(
  uid: string,
  data: UpdateUserData
): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid)

    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    })

    console.log('✓ Perfil de usuario actualizado:', uid)
  } catch (error) {
    console.error('Error actualizando perfil:', error)
    throw error
  }
}

/**
 * Verificar si un usuario existe en Firestore
 */
export async function userExists(uid: string): Promise<boolean> {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid)
    const userSnap = await getDoc(userRef)
    return userSnap.exists()
  } catch (error) {
    console.error('Error verificando existencia de usuario:', error)
    return false
  }
}

/**
 * Convertir datos de Firestore a UserProfile
 */
function convertFirestoreUser(data: any): UserProfile {
  return {
    ...data,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
    lastLoginAt: data.lastLoginAt instanceof Timestamp ? data.lastLoginAt.toDate() : new Date(data.lastLoginAt)
  }
}

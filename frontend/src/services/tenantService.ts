/**
 * Servicio para gestionar tenants (organizaciones)
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'
import { db, auth } from '@/config/firebase'
import { setUserClaims } from './apiService'
import {
  Tenant,
  TenantMember,
  DataSource,
  Dashboard,
  TenantSettings,
  PlanType,
  PLAN_FEATURES,
  convertFirestoreTenant,
  convertFirestoreMember,
  convertFirestoreDataSource
} from '@/types/tenant'

const TENANTS_COLLECTION = 'tenants'

// ===== TENANT CRUD =====

/**
 * Crear un nuevo tenant (organización)
 * Este método debe ejecutarse solo cuando un usuario crea su organización por primera vez
 */
export async function createTenant(
  name: string,
  ownerUid: string,
  ownerEmail: string,
  plan: PlanType = 'trial'
): Promise<string> {
  try {
    const batch = writeBatch(db)

    // Crear ID único para el tenant
    const tenantRef = doc(collection(db, TENANTS_COLLECTION))
    const tenantId = tenantRef.id

    // Generar slug único
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    // Datos del tenant
    const tenantData = {
      id: tenantId,
      name,
      slug,
      owner_uid: ownerUid,
      plan,
      billing_status: 'active' as const,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      features: PLAN_FEATURES[plan],
      datasource_status: {},
      last_pipeline_run_at: null,
      pipeline_error: null
    }

    batch.set(tenantRef, tenantData)

    // Crear member (owner)
    const memberRef = doc(db, TENANTS_COLLECTION, tenantId, 'members', ownerUid)
    const memberData = {
      uid: ownerUid,
      email: ownerEmail,
      role: 'owner' as const,
      status: 'active' as const,
      joinedAt: serverTimestamp()
    }

    batch.set(memberRef, memberData)

    // Actualizar user con tenantId y activeTenant
    const userRef = doc(db, 'users', ownerUid)
    batch.update(userRef, {
      tenantId: tenantId,  // ← Campo principal para verificar si tiene tenant
      activeTenant: tenantId,
      updatedAt: serverTimestamp()
    })

    // Ejecutar batch
    await batch.commit()

    console.log('✅ Tenant creado en Firestore:', tenantId)

    // IMPORTANTE: Configurar custom claims en Firebase Auth
    // Esto permite que el backend lea el tenant_id del JWT
    try {
      console.log('🔑 Configurando custom claims...')
      await setUserClaims({ tenantId })
      console.log('✅ Custom claims configurados')

      // Refrescar el token para obtener los nuevos claims
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true)
        console.log('✅ Token refrescado con nuevos claims')
      }
    } catch (claimsError) {
      // No fallar si los claims no se pueden configurar
      // El usuario puede intentar refrescar manualmente más tarde
      console.warn('⚠️ No se pudieron configurar los custom claims:', claimsError)
      console.warn('El usuario deberá cerrar sesión y volver a entrar para que los claims se actualicen')
    }

    console.log('✅ Tenant creado exitosamente:', tenantId)
    return tenantId
  } catch (error) {
    console.error('❌ Error al crear tenant:', error)
    throw error
  }
}

/**
 * Obtener un tenant por ID
 */
export async function getTenant(tenantId: string): Promise<Tenant | null> {
  try {
    const tenantRef = doc(db, TENANTS_COLLECTION, tenantId)
    const tenantSnap = await getDoc(tenantRef)

    if (!tenantSnap.exists()) {
      return null
    }

    return convertFirestoreTenant({
      ...tenantSnap.data(),
      id: tenantSnap.id
    })
  } catch (error) {
    console.error('❌ Error al obtener tenant:', error)
    return null
  }
}

/**
 * Obtener tenants del usuario
 * Lee el campo tenantId del documento del usuario
 */
export async function getUserTenants(uid: string): Promise<Tenant[]> {
  try {
    const userTenants: Tenant[] = []

    // Obtener el documento del usuario
    const userRef = doc(db, 'users', uid)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      console.log('⚠️ Usuario no encontrado en Firestore')
      return []
    }

    const userData = userSnap.data()

    // Verificar si el usuario tiene tenantId
    const tenantId = userData?.tenantId || userData?.activeTenant

    if (!tenantId) {
      console.log('ℹ️ Usuario sin tenant asignado, requiere onboarding')
      return []
    }

    // Obtener el tenant
    const tenant = await getTenant(tenantId)

    if (tenant) {
      userTenants.push(tenant)
      console.log(`✅ Tenant encontrado: ${tenantId}`)

      // Asegurar que activeTenant esté configurado
      if (!userData?.activeTenant) {
        await updateDoc(userRef, {
          activeTenant: tenantId,
          updatedAt: serverTimestamp()
        })
        console.log('✅ activeTenant configurado automáticamente')
      }
    } else {
      console.log('⚠️ Tenant no encontrado en Firestore:', tenantId)
    }

    return userTenants
  } catch (error) {
    console.error('❌ Error al obtener tenants del usuario:', error)
    return []
  }
}

/**
 * Actualizar tenant
 */
export async function updateTenant(
  tenantId: string,
  updates: Partial<Tenant>
): Promise<void> {
  try {
    const tenantRef = doc(db, TENANTS_COLLECTION, tenantId)

    await updateDoc(tenantRef, {
      ...updates,
      updatedAt: serverTimestamp()
    })

    console.log('✅ Tenant actualizado:', tenantId)
  } catch (error) {
    console.error('❌ Error al actualizar tenant:', error)
    throw error
  }
}

// ===== MEMBERS =====

/**
 * Obtener members de un tenant
 */
export async function getTenantMembers(tenantId: string): Promise<TenantMember[]> {
  try {
    const membersRef = collection(db, TENANTS_COLLECTION, tenantId, 'members')
    const snapshot = await getDocs(membersRef)

    return snapshot.docs.map(doc => convertFirestoreMember(doc.data()))
  } catch (error) {
    console.error('❌ Error al obtener members:', error)
    return []
  }
}

/**
 * Obtener un member específico
 */
export async function getTenantMember(
  tenantId: string,
  uid: string
): Promise<TenantMember | null> {
  try {
    const memberRef = doc(db, TENANTS_COLLECTION, tenantId, 'members', uid)
    const memberSnap = await getDoc(memberRef)

    if (!memberSnap.exists()) {
      return null
    }

    return convertFirestoreMember(memberSnap.data())
  } catch (error) {
    console.error('❌ Error al obtener member:', error)
    return null
  }
}

/**
 * Agregar member a un tenant
 */
export async function addTenantMember(
  tenantId: string,
  member: Omit<TenantMember, 'joinedAt'>
): Promise<void> {
  try {
    const memberRef = doc(db, TENANTS_COLLECTION, tenantId, 'members', member.uid)

    await setDoc(memberRef, {
      ...member,
      joinedAt: serverTimestamp()
    })

    console.log('✅ Member agregado:', member.uid)
  } catch (error) {
    console.error('❌ Error al agregar member:', error)
    throw error
  }
}

// ===== DATASOURCES =====

/**
 * Obtener datasources de un tenant
 */
export async function getTenantDataSources(tenantId: string): Promise<DataSource[]> {
  try {
    const datasourcesRef = collection(db, TENANTS_COLLECTION, tenantId, 'datasources')
    const snapshot = await getDocs(datasourcesRef)

    return snapshot.docs.map(doc => convertFirestoreDataSource({
      ...doc.data(),
      id: doc.id
    }))
  } catch (error) {
    console.error('❌ Error al obtener datasources:', error)
    return []
  }
}

/**
 * Obtener un datasource específico
 */
export async function getTenantDataSource(
  tenantId: string,
  datasourceId: string
): Promise<DataSource | null> {
  try {
    const datasourceRef = doc(db, TENANTS_COLLECTION, tenantId, 'datasources', datasourceId)
    const datasourceSnap = await getDoc(datasourceRef)

    if (!datasourceSnap.exists()) {
      return null
    }

    return convertFirestoreDataSource({
      ...datasourceSnap.data(),
      id: datasourceSnap.id
    })
  } catch (error) {
    console.error('❌ Error al obtener datasource:', error)
    return null
  }
}

/**
 * Crear o actualizar datasource
 */
export async function upsertTenantDataSource(
  tenantId: string,
  datasourceId: string,
  datasource: Omit<DataSource, 'id'>
): Promise<void> {
  try {
    const datasourceRef = doc(db, TENANTS_COLLECTION, tenantId, 'datasources', datasourceId)

    await setDoc(datasourceRef, datasource, { merge: true })

    // Actualizar el datasource_status en el tenant
    const tenantRef = doc(db, TENANTS_COLLECTION, tenantId)
    await updateDoc(tenantRef, {
      [`datasource_status.${datasourceId}`]: datasource.connected ? 'connected' : 'disconnected',
      updatedAt: serverTimestamp()
    })

    console.log('✅ Datasource guardado:', datasourceId)
  } catch (error) {
    console.error('❌ Error al guardar datasource:', error)
    throw error
  }
}

// ===== DASHBOARDS =====

/**
 * Obtener dashboards de un tenant
 */
export async function getTenantDashboards(tenantId: string): Promise<Dashboard[]> {
  try {
    const dashboardsRef = collection(db, TENANTS_COLLECTION, tenantId, 'dashboards')
    const snapshot = await getDocs(dashboardsRef)

    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date()
    } as Dashboard))
  } catch (error) {
    console.error('❌ Error al obtener dashboards:', error)
    return []
  }
}

// ===== SETTINGS =====

/**
 * Obtener settings de un tenant
 */
export async function getTenantSettings(tenantId: string): Promise<TenantSettings | null> {
  try {
    const settingsRef = doc(db, TENANTS_COLLECTION, tenantId, 'settings', 'general')
    const settingsSnap = await getDoc(settingsRef)

    if (!settingsSnap.exists()) {
      // Retornar settings por defecto
      return {
        timezone: 'America/Argentina/Buenos_Aires',
        currency: 'USD',
        language: 'es',
        dateFormat: 'DD/MM/YYYY'
      }
    }

    return settingsSnap.data() as TenantSettings
  } catch (error) {
    console.error('❌ Error al obtener settings:', error)
    return null
  }
}

/**
 * Actualizar settings de un tenant
 */
export async function updateTenantSettings(
  tenantId: string,
  settings: TenantSettings
): Promise<void> {
  try {
    const settingsRef = doc(db, TENANTS_COLLECTION, tenantId, 'settings', 'general')

    await setDoc(settingsRef, settings, { merge: true })

    console.log('✅ Settings actualizados')
  } catch (error) {
    console.error('❌ Error al actualizar settings:', error)
    throw error
  }
}

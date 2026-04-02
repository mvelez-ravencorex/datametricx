/**
 * Utilidades de diagnóstico para debugging
 */

import { db } from '@/config/firebase'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'

/**
 * Verifica el estado completo de un datasource
 */
export async function diagnoseDatasource(tenantId: string, datasourceId: string) {
  console.log('🔍 Diagnosticando datasource...')

  try {
    // 1. Verificar que el tenant existe
    const tenantDoc = await getDoc(doc(db, 'tenants', tenantId))
    console.log('📁 Tenant:', {
      exists: tenantDoc.exists(),
      id: tenantId,
      data: tenantDoc.data()
    })

    // 2. Verificar que el datasource existe
    const datasourceDoc = await getDoc(
      doc(db, `tenants/${tenantId}/datasources`, datasourceId)
    )
    console.log('📊 Datasource:', {
      exists: datasourceDoc.exists(),
      id: datasourceId,
      data: datasourceDoc.data()
    })

    if (!datasourceDoc.exists()) {
      console.error('❌ El datasource no existe en Firestore')
      return {
        success: false,
        error: 'Datasource not found in Firestore'
      }
    }

    const datasourceData = datasourceDoc.data()

    // 3. Verificar campos requeridos según la plataforma
    const baseRequiredFields = [
      'platform',
      'connected',
      'frequency'
    ]

    // Para Meta Ads con nueva estructura (start_date)
    const isNewMetaStructure = datasourceData.platform === 'meta_ads' && 'start_date' in datasourceData

    let requiredFields: string[]
    if (isNewMetaStructure) {
      // Nueva estructura Meta Ads: usa start_date y access_token_secret_id
      requiredFields = [
        ...baseRequiredFields,
        'start_date',
        'ad_account_id'
      ]
      // secret_id puede ser access_token_secret_id
      if (!datasourceData.secret_id && !datasourceData.access_token_secret_id) {
        console.error('❌ Falta secret_id o access_token_secret_id')
        return {
          success: false,
          error: 'Missing secret_id or access_token_secret_id'
        }
      }
    } else {
      // Estructura legacy: usa backfill_days y time_utc
      requiredFields = [
        ...baseRequiredFields,
        'secret_id',
        'status',
        'time_utc',
        'backfill_days'
      ]
    }

    const missingFields = requiredFields.filter(field => !(field in datasourceData))

    if (missingFields.length > 0) {
      console.error('❌ Campos faltantes:', missingFields)
      return {
        success: false,
        error: `Missing fields: ${missingFields.join(', ')}`
      }
    }

    console.log('✅ Todos los campos requeridos están presentes')

    // 4. Verificar que el secret_id tiene el formato correcto
    const secretId = datasourceData.secret_id || datasourceData.access_token_secret_id
    if (!secretId || typeof secretId !== 'string') {
      console.error('❌ secret_id inválido:', secretId)
      return {
        success: false,
        error: 'Invalid secret_id'
      }
    }

    console.log('✅ secret_id válido:', secretId)

    // 5. Verificar que el datasource está conectado
    if (!datasourceData.connected) {
      console.warn('⚠️ El datasource no está marcado como conectado')
    }

    console.log('✅ Diagnóstico completo')
    return {
      success: true,
      datasource: datasourceData,
      validation: {
        hasAllRequiredFields: true,
        secretIdValid: true,
        connected: datasourceData.connected
      }
    }

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Lista todos los datasources de un tenant
 */
export async function listTenantDatasources(tenantId: string) {
  console.log('📋 Listando datasources del tenant:', tenantId)

  try {
    const datasourcesRef = collection(db, `tenants/${tenantId}/datasources`)
    const snapshot = await getDocs(datasourcesRef)

    const datasources = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    console.log(`✅ Encontrados ${datasources.length} datasources:`, datasources)
    return datasources
  } catch (error) {
    console.error('❌ Error listando datasources:', error)
    return []
  }
}

/**
 * Verifica el documento del usuario en Firestore
 */
export async function diagnoseUserDocument(userId: string) {
  console.log('🔍 Verificando documento del usuario:', userId)

  try {
    const userDoc = await getDoc(doc(db, 'users', userId))

    if (!userDoc.exists()) {
      console.error('❌ El documento del usuario no existe en Firestore')
      return {
        exists: false,
        error: 'User document not found'
      }
    }

    const userData = userDoc.data()
    console.log('📄 Documento del usuario:', userData)

    if (!userData.tenantId) {
      console.error('❌ El usuario no tiene tenantId en Firestore')
      return {
        exists: true,
        hasTenantId: false,
        data: userData
      }
    }

    console.log('✅ Usuario tiene tenantId:', userData.tenantId)
    return {
      exists: true,
      hasTenantId: true,
      tenantId: userData.tenantId,
      data: userData
    }

  } catch (error) {
    console.error('❌ Error verificando usuario:', error)
    return {
      exists: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Utilidad temporal para arreglar el campo platform en datasources
 */

import { db } from '@/config/firebase'
import { doc, updateDoc } from 'firebase/firestore'

/**
 * Actualiza el campo platform de un datasource
 * De "meta-ads" a "meta_ads" para que coincida con el backend
 */
export async function fixDatasourcePlatform(
  tenantId: string,
  datasourceId: string,
  oldPlatform: string,
  newPlatform: string
) {
  console.log('🔧 Actualizando platform del datasource...')
  console.log(`  De: "${oldPlatform}"`)
  console.log(`  A: "${newPlatform}"`)

  try {
    const datasourceRef = doc(db, `tenants/${tenantId}/datasources`, datasourceId)

    await updateDoc(datasourceRef, {
      platform: newPlatform
    })

    console.log('✅ Platform actualizado exitosamente')
    return { success: true }
  } catch (error) {
    console.error('❌ Error actualizando platform:', error)
    return { success: false, error }
  }
}

/**
 * Utilidades para debug de autenticación
 */

import { auth } from '@/config/firebase'

/**
 * Muestra información completa del usuario autenticado
 */
export async function debugCurrentUser() {
  const user = auth.currentUser

  if (!user) {
    console.error('❌ No hay usuario autenticado')
    return null
  }

  console.log('👤 Usuario autenticado:')
  console.log('  - UID:', user.uid)
  console.log('  - Email:', user.email)
  console.log('  - Display Name:', user.displayName)

  // Obtener el token y decodificarlo
  try {
    await user.getIdToken() // Ensure token is fresh
    const tokenResult = await user.getIdTokenResult()

    console.log('🔑 Token JWT:')
    console.log('  - Claims:', tokenResult.claims)
    console.log('  - Tenant ID en claims:', tokenResult.claims.tenantId || '❌ No existe')
    console.log('  - Auth time:', tokenResult.authTime)
    console.log('  - Expiration:', tokenResult.expirationTime)

    return {
      uid: user.uid,
      email: user.email,
      claims: tokenResult.claims,
      tenantIdInToken: tokenResult.claims.tenantId
    }
  } catch (error) {
    console.error('❌ Error obteniendo token:', error)
    return null
  }
}

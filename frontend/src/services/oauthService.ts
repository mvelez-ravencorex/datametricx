/**
 * Servicio para manejar flujos OAuth con plataformas externas
 * FRONT 2: Conectar datasources mediante OAuth
 */

import { saveCredentials, exchangeMetaAuthCode } from './apiService'
import { MetaAdsCredentials } from '@/types/connections'

// URLs de OAuth (ajustar según environment)
const META_APP_ID = import.meta.env.VITE_META_APP_ID
const META_REDIRECT_URI = import.meta.env.VITE_META_REDIRECT_URI || `${window.location.origin}/oauth/meta/callback`
const GA4_CLIENT_ID = import.meta.env.VITE_GA4_CLIENT_ID

/**
 * Resultado del flujo OAuth
 */
export interface OAuthResult {
  secret_id: string
  metadata?: Record<string, any>
}

/**
 * Abre una ventana popup para OAuth
 */
function openOAuthPopup(url: string, name: string): Window | null {
  const width = 600
  const height = 700
  const left = window.screen.width / 2 - width / 2
  const top = window.screen.height / 2 - height / 2

  return window.open(
    url,
    name,
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
  )
}

/**
 * Espera a que el popup se cierre y recibe el código de autorización
 */
function waitForOAuthCallback(popup: Window): Promise<string> {
  return new Promise((resolve, reject) => {
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed)
        reject(new Error('OAuth cancelado por el usuario'))
      }
    }, 500)

    // Escuchar mensaje del callback
    const handleMessage = (event: MessageEvent) => {
      // Verificar origen por seguridad
      if (event.origin !== window.location.origin) {
        return
      }

      if (event.data.type === 'oauth-callback') {
        clearInterval(checkClosed)
        window.removeEventListener('message', handleMessage)
        popup.close()

        if (event.data.code) {
          resolve(event.data.code)
        } else if (event.data.error) {
          reject(new Error(event.data.error))
        } else {
          reject(new Error('No se recibió código de autorización'))
        }
      }
    }

    window.addEventListener('message', handleMessage)

    // Timeout de 5 minutos
    setTimeout(() => {
      clearInterval(checkClosed)
      window.removeEventListener('message', handleMessage)
      if (!popup.closed) {
        popup.close()
      }
      reject(new Error('Timeout: El proceso OAuth tardó demasiado'))
    }, 5 * 60 * 1000)
  })
}

// ==================== META ADS OAUTH ====================

/**
 * FRONT 2: Inicia el flujo OAuth con Meta Ads
 *
 * @param tenantId - ID del tenant
 * @returns secret_id para guardar en Firestore
 */
export async function connectMetaAds(
  tenantId: string
): Promise<OAuthResult> {
  if (!META_APP_ID) {
    throw new Error('META_APP_ID no configurado en variables de entorno')
  }

  // Construir URL de OAuth de Meta
  const scope = 'ads_read,ads_management,business_management'
  const state = btoa(JSON.stringify({ tenantId, timestamp: Date.now() }))

  const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth')
  authUrl.searchParams.set('client_id', META_APP_ID)
  authUrl.searchParams.set('redirect_uri', META_REDIRECT_URI)
  authUrl.searchParams.set('scope', scope)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('response_type', 'code')

  // Abrir popup
  const popup = openOAuthPopup(authUrl.toString(), 'Meta Ads Login')
  if (!popup) {
    throw new Error('No se pudo abrir la ventana de autenticación')
  }

  try {
    // Esperar código de autorización
    const code = await waitForOAuthCallback(popup)

    // Llamar al backend para intercambiar el código
    const result = await exchangeMetaAuthCode({
      tenantId,
      code,
      redirectUri: META_REDIRECT_URI
    })

    return {
      secret_id: result.secret_id,
      metadata: {
        adAccountId: result.adAccountId,
        expiresAt: result.expiresAt
      }
    }
  } catch (error) {
    console.error('❌ Error en OAuth de Meta:', error)
    throw error
  }
}

/**
 * Flujo alternativo: Conectar Meta Ads con credenciales manuales
 * (Para testing o cuando el usuario ya tiene un access token)
 */
export async function connectMetaAdsManual(
  tenantId: string,
  credentials: MetaAdsCredentials
): Promise<OAuthResult> {
  // Validar formato del Ad Account ID
  if (!credentials.adAccountId.startsWith('act_')) {
    throw new Error('El Ad Account ID debe comenzar con "act_"')
  }

  // Guardar credenciales en Secret Manager vía backend API
  const result = await saveCredentials({
    tenantId,
    platform: 'meta_ads',
    credentials: {
      access_token: credentials.accessToken,
      ad_account_id: credentials.adAccountId,
      app_id: credentials.appId,
      app_secret: credentials.appSecret
    }
  })

  return {
    secret_id: result.secret_id,
    metadata: {
      adAccountId: credentials.adAccountId
    }
  }
}

// ==================== GOOGLE ANALYTICS 4 OAUTH ====================

/**
 * FRONT 2: Inicia el flujo OAuth con Google Analytics 4
 */
export async function connectGA4(
  tenantId: string
): Promise<OAuthResult> {
  if (!GA4_CLIENT_ID) {
    throw new Error('GA4_CLIENT_ID no configurado en variables de entorno')
  }

  const scope = 'https://www.googleapis.com/auth/analytics.readonly'
  const redirectUri = `${window.location.origin}/oauth/google/callback`
  const state = btoa(JSON.stringify({ tenantId, timestamp: Date.now() }))

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', GA4_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', scope)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  const popup = openOAuthPopup(authUrl.toString(), 'Google Analytics Login')
  if (!popup) {
    throw new Error('No se pudo abrir la ventana de autenticación')
  }

  try {
    await waitForOAuthCallback(popup)

    // TODO: Implementar endpoint en backend para GA4
    // const result = await exchangeGA4AuthCode({ tenantId, code, redirectUri })

    // Por ahora, placeholder
    throw new Error('OAuth de GA4 no implementado en el backend todavía')
  } catch (error) {
    console.error('❌ Error en OAuth de GA4:', error)
    throw error
  }
}

// ==================== SHOPIFY OAUTH ====================

/**
 * FRONT 2: Inicia el flujo OAuth con Shopify
 */
export async function connectShopify(
  tenantId: string,
  shopDomain: string
): Promise<OAuthResult> {
  // Validar dominio
  if (!shopDomain.endsWith('.myshopify.com')) {
    throw new Error('El dominio debe terminar en .myshopify.com')
  }

  const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY
  if (!apiKey) {
    throw new Error('SHOPIFY_API_KEY no configurado')
  }

  const redirectUri = `${window.location.origin}/oauth/shopify/callback`
  const scope = 'read_orders,read_products,read_customers'
  const state = btoa(JSON.stringify({ tenantId, shopDomain, timestamp: Date.now() }))

  const authUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${apiKey}&scope=${scope}&redirect_uri=${redirectUri}&state=${state}`

  const popup = openOAuthPopup(authUrl, 'Shopify Login')
  if (!popup) {
    throw new Error('No se pudo abrir la ventana de autenticación')
  }

  try {
    await waitForOAuthCallback(popup)

    // TODO: Implementar endpoint en backend para Shopify
    throw new Error('OAuth de Shopify no implementado en el backend todavía')
  } catch (error) {
    console.error('❌ Error en OAuth de Shopify:', error)
    throw error
  }
}

// ==================== TIKTOK ADS OAUTH ====================

/**
 * FRONT 2: Inicia el flujo OAuth con TikTok Ads
 */
export async function connectTikTokAds(
  _tenantId: string
): Promise<OAuthResult> {
  // TODO: Implementar OAuth de TikTok
  throw new Error('OAuth de TikTok no implementado todavía')
}

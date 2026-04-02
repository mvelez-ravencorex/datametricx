import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'child_process'

// Cloud Run service URL
const CLOUD_RUN_URL = 'https://datametricx-backend-api-jrzfm3jccq-uc.a.run.app'

// Cache del token IAM (dura 1 hora)
let cachedToken: string | null = null
let tokenExpiry: number = 0

// Get IAM token for Cloud Run authentication (con cache)
function getGcloudToken(): string {
  const now = Date.now()

  // Usar cache si el token tiene menos de 50 minutos
  if (cachedToken && now < tokenExpiry) {
    return cachedToken
  }

  try {
    console.log('🔄 Refreshing IAM token...')
    cachedToken = execSync('gcloud auth print-identity-token', { encoding: 'utf-8' }).trim()
    tokenExpiry = now + (50 * 60 * 1000) // 50 minutos
    console.log('✅ IAM token refreshed:', cachedToken.substring(0, 50) + '...')
    return cachedToken
  } catch (error) {
    console.error('❌ gcloud token failed:', error)
    return cachedToken || ''
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: CLOUD_RUN_URL,
        changeOrigin: true,
        secure: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('🔄 Proxy request:', req.url)

            const iamToken = getGcloudToken()
            const firebaseToken = req.headers['authorization']

            // IAM token for Cloud Run layer
            if (iamToken) {
              proxyReq.setHeader('Authorization', `Bearer ${iamToken}`)
            } else {
              console.error('❌ No IAM token available!')
            }

            // Firebase token in separate header for backend auth
            if (firebaseToken) {
              const token = Array.isArray(firebaseToken) ? firebaseToken[0] : firebaseToken
              proxyReq.setHeader('X-Firebase-Auth', token.replace('Bearer ', ''))
            }
          })
        }
      }
    }
  },
})

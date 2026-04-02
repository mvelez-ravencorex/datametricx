/**
 * Tipos para usuarios en Firestore
 */

export interface UserProfile {
  id: string
  uid: string // Firebase Auth UID
  email: string
  displayName: string | null
  photoURL: string | null
  createdAt: Date
  updatedAt: Date
  lastLoginAt: Date

  // Multi-tenant
  activeTenant?: string // ID del tenant actualmente seleccionado

  // Información adicional
  phoneNumber?: string | null
  company?: string
  role?: 'user' | 'admin' | 'viewer'

  // Método de autenticación
  authProvider?: 'google' | 'email' | 'facebook' | 'github'
  authProviders?: string[] // Historial de proveedores usados

  // Configuración del usuario
  preferences?: {
    language?: string
    timezone?: string
    currency?: string
    notifications?: {
      email?: boolean
      push?: boolean
    }
  }

  // Metadata
  metadata?: {
    firstLogin?: boolean
    loginCount?: number
    lastIP?: string
  }
}

export interface CreateUserData {
  uid: string
  email: string
  displayName?: string | null
  photoURL?: string | null
  phoneNumber?: string | null
  authProvider?: 'google' | 'email' | 'facebook' | 'github'
}

export interface UpdateUserData {
  displayName?: string | null
  photoURL?: string | null
  phoneNumber?: string | null
  company?: string
  preferences?: UserProfile['preferences']
}

import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react'
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth'
import { auth, db } from '@/config/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { createOrUpdateUser } from '@/services/userService'
import { getTenant, getUserTenants, getTenantMember } from '@/services/tenantService'
import { Tenant, TenantMember, MemberRole } from '@/types/tenant'
import { UserProfile } from '@/types/user'
import { DEMO_TENANT_ID, isDemoTenant, createDemoTenantFallback } from '@/config/demo'

// Configuración del rol desde Firestore
interface RoleSettings {
  id: string
  name: string
  entity?: {
    showTenantID?: boolean
  }
}

interface AuthContextType {
  currentUser: User | null
  userProfile: UserProfile | null
  currentTenant: Tenant | null
  currentMember: TenantMember | null
  userTenants: Tenant[]
  loading: boolean
  needsOnboarding: boolean

  // SysOwner - Super Admin access
  isSysOwner: boolean
  jwtClaims: Record<string, unknown> | null

  // Demo mode - read-only access to demo tenant
  isDemoMode: boolean

  // Role settings
  roleSettings: RoleSettings | null
  canShowTenantId: boolean

  // Auth methods
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName?: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updateUserProfile: (displayName: string, photoURL?: string) => Promise<void>

  // Tenant methods
  switchTenant: (tenantId: string) => Promise<void>
  refreshTenant: () => Promise<void>
  reloadUserData: () => Promise<void>

  // Permission helpers
  hasPermission: (permission: keyof typeof PERMISSIONS_MAP['owner']) => boolean
  canManageBilling: boolean
  canManageUsers: boolean
  canManageDatasources: boolean
  canManageDashboards: boolean
  canViewDashboards: boolean
  canExploreData: boolean
}

const PERMISSIONS_MAP = {
  owner: {
    canManageBilling: true,
    canManageUsers: true,
    canManageDatasources: true,
    canManageDashboards: true,
    canViewDashboards: true,
    canExploreData: true
  },
  admin: {
    canManageBilling: false,
    canManageUsers: true,
    canManageDatasources: true,
    canManageDashboards: true,
    canViewDashboards: true,
    canExploreData: true
  },
  analyst: {
    canManageBilling: false,
    canManageUsers: false,
    canManageDatasources: false,
    canManageDashboards: true,
    canViewDashboards: true,
    canExploreData: true
  },
  viewer: {
    canManageBilling: false,
    canManageUsers: false,
    canManageDatasources: false,
    canManageDashboards: false,
    canViewDashboards: true,
    canExploreData: false
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null)
  const [currentMember, setCurrentMember] = useState<TenantMember | null>(null)
  const [userTenants, setUserTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  // SysOwner - Super Admin state
  const [isSysOwner, setIsSysOwner] = useState(false)
  const [jwtClaims, setJwtClaims] = useState<Record<string, unknown> | null>(null)

  // Role settings from Firestore
  const [roleSettings, setRoleSettings] = useState<RoleSettings | null>(null)

  // Cargar configuración del rol desde colección roles (raíz)
  const loadRoleSettings = async (roleId: string) => {
    try {
      const roleRef = doc(db, 'roles', roleId)
      const roleSnap = await getDoc(roleRef)

      if (roleSnap.exists()) {
        const data = roleSnap.data()
        const settings: RoleSettings = {
          id: roleSnap.id,
          name: data.name,
          entity: data.entity
        }
        setRoleSettings(settings)
        console.log('📋 Role settings cargados:', settings)
        return settings
      }
      return null
    } catch (error) {
      console.error('❌ Error al cargar role settings:', error)
      return null
    }
  }

  // Cargar datos del tenant
  const loadTenantData = async (uid: string, tenantId: string) => {
    try {
      // Para el demo tenant, siempre asignamos rol viewer
      if (isDemoTenant(tenantId)) {
        // Intentar cargar de Firestore, si no existe usar fallback
        let tenant = await getTenant(tenantId)
        if (!tenant) {
          tenant = createDemoTenantFallback()
        }
        setCurrentTenant(tenant)

        const demoMember: TenantMember = {
          uid,
          email: '',
          role: 'viewer',
          status: 'active',
          joinedAt: new Date()
        }
        setCurrentMember(demoMember)
        await loadRoleSettings('viewer')
        console.log('👁️ Demo tenant cargado - modo solo lectura')
        return
      }

      // Cargar tenant normal
      const tenant = await getTenant(tenantId)
      if (tenant) {
        setCurrentTenant(tenant)

        // Cargar member info
        const member = await getTenantMember(tenantId, uid)
        setCurrentMember(member)

        // Cargar configuración del rol del usuario
        if (member?.role) {
          await loadRoleSettings(member.role)
        }
      }
    } catch (error) {
      console.error('❌ Error al cargar datos del tenant:', error)
    }
  }

  // Cargar perfil de usuario
  const loadUserProfile = async (uid: string) => {
    try {
      const userRef = doc(db, 'users', uid)
      const userSnap = await getDoc(userRef)

      if (userSnap.exists()) {
        const profile = {
          ...userSnap.data(),
          id: userSnap.id,
          createdAt: userSnap.data().createdAt?.toDate() || new Date(),
          updatedAt: userSnap.data().updatedAt?.toDate() || new Date(),
          lastLoginAt: userSnap.data().lastLoginAt?.toDate() || new Date()
        } as UserProfile

        setUserProfile(profile)
        return profile
      }
      return null
    } catch (error) {
      console.error('❌ Error al cargar perfil de usuario:', error)
      return null
    }
  }

  // Sign up with email and password
  const signUp = async (email: string, password: string, displayName?: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)

    // Update profile with display name if provided
    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, { displayName })
    }
  }

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  // Sign in with Google
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  // Sign out
  const signOut = async () => {
    await firebaseSignOut(auth)
    setUserProfile(null)
    setCurrentTenant(null)
    setCurrentMember(null)
    setUserTenants([])
    setIsSysOwner(false)
    setJwtClaims(null)
    setRoleSettings(null)
  }

  // Reset password
  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email)
  }

  // Update user profile
  const updateUserProfile = async (displayName: string, photoURL?: string) => {
    if (currentUser) {
      await updateProfile(currentUser, {
        displayName,
        ...(photoURL && { photoURL })
      })
      setCurrentUser({ ...currentUser })
    }
  }

  // Switch tenant
  const switchTenant = async (tenantId: string) => {
    if (!currentUser) return

    try {
      // Actualizar activeTenant en user document
      const userRef = doc(db, 'users', currentUser.uid)
      await updateDoc(userRef, { activeTenant: tenantId })

      // Recargar tenant data
      await loadTenantData(currentUser.uid, tenantId)

      console.log('✅ Tenant cambiado:', tenantId)
    } catch (error) {
      console.error('❌ Error al cambiar tenant:', error)
      throw error
    }
  }

  // Refresh tenant data
  const refreshTenant = async () => {
    if (!currentUser || !userProfile?.activeTenant) return

    await loadTenantData(currentUser.uid, userProfile.activeTenant)
  }

  // Reload all user data (tenants, profile, etc.)
  const reloadUserData = async () => {
    if (!currentUser) return

    try {
      // Recargar perfil de usuario
      const profile = await loadUserProfile(currentUser.uid)

      // Recargar tenants del usuario
      const tenants = await getUserTenants(currentUser.uid)
      setUserTenants(tenants)

      // Si ya no necesita onboarding
      if (tenants.length > 0) {
        setNeedsOnboarding(false)

        // Cargar tenant activo o el primero disponible
        const activeTenantId = profile?.activeTenant || tenants[0]?.id
        if (activeTenantId) {
          await loadTenantData(currentUser.uid, activeTenantId)
        }
      } else {
        setNeedsOnboarding(true)
      }

      console.log('✅ Datos de usuario recargados')
    } catch (error) {
      console.error('❌ Error al recargar datos de usuario:', error)
    }
  }

  // Permission helper
  const hasPermission = (permission: keyof typeof PERMISSIONS_MAP['owner']): boolean => {
    // SysOwner tiene todos los permisos
    if (isSysOwner) return true
    if (!currentMember) return false
    const rolePermissions = PERMISSIONS_MAP[currentMember.role as MemberRole]
    return rolePermissions[permission]
  }

  // Derived permission flags
  const canManageBilling = hasPermission('canManageBilling')
  const canManageUsers = hasPermission('canManageUsers')
  const canManageDatasources = hasPermission('canManageDatasources')
  const canManageDashboards = hasPermission('canManageDashboards')
  const canViewDashboards = hasPermission('canViewDashboards')
  const canExploreData = hasPermission('canExploreData')

  // Derived from role settings - SysOwner siempre puede ver tenant_id
  const canShowTenantId = isSysOwner || (roleSettings?.entity?.showTenantID === true)

  // Demo mode - computed from current tenant
  const isDemoMode = useMemo(() => isDemoTenant(currentTenant?.id), [currentTenant?.id])

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Usuario autenticado
        try {
          // Detectar el método de autenticación
          const providerData = user.providerData[0]
          let authProvider: 'google' | 'email' | 'facebook' | 'github' = 'email'

          if (providerData) {
            if (providerData.providerId === 'google.com') {
              authProvider = 'google'
            } else if (providerData.providerId === 'facebook.com') {
              authProvider = 'facebook'
            } else if (providerData.providerId === 'github.com') {
              authProvider = 'github'
            } else {
              authProvider = 'email'
            }
          }

          console.log('🔐 Método de autenticación detectado:', authProvider)

          // Crear o actualizar usuario en Firestore
          await createOrUpdateUser({
            uid: user.uid,
            email: user.email!,
            displayName: user.displayName,
            photoURL: user.photoURL,
            phoneNumber: user.phoneNumber,
            authProvider
          })

          // Cargar perfil de usuario
          const profile = await loadUserProfile(user.uid)

          // Cargar tenants del usuario
          const userOwnTenants = await getUserTenants(user.uid)

          // Cargar el Demo Tenant y agregarlo a la lista
          let allTenants = [...userOwnTenants]
          try {
            // Intentar cargar el demo tenant desde Firestore
            let demoTenant = await getTenant(DEMO_TENANT_ID)

            // Si no existe en Firestore, usar el fallback
            if (!demoTenant) {
              console.log('🎭 Demo tenant no encontrado en Firestore, usando fallback')
              demoTenant = createDemoTenantFallback()
            }

            // Agregar el demo tenant si no está ya en la lista
            const hasDemoTenant = allTenants.some(t => t.id === DEMO_TENANT_ID)
            if (!hasDemoTenant) {
              allTenants.push(demoTenant)
              console.log('🎭 Demo tenant agregado a la lista de tenants disponibles')
            }
          } catch (demoError) {
            // En caso de error, usar el fallback
            console.warn('⚠️ Error al cargar demo tenant, usando fallback:', demoError)
            const hasDemoTenant = allTenants.some(t => t.id === DEMO_TENANT_ID)
            if (!hasDemoTenant) {
              allTenants.push(createDemoTenantFallback())
            }
          }

          setUserTenants(allTenants)

          // Verificar si necesita onboarding (no tiene tenants propios)
          // Pero aún puede acceder al demo tenant
          if (userOwnTenants.length === 0) {
            setNeedsOnboarding(true)
            // Si no tiene tenants propios, cargar automáticamente el demo tenant
            if (allTenants.length > 0) {
              const demoTenantObj = allTenants.find(t => t.id === DEMO_TENANT_ID)
              if (demoTenantObj) {
                await loadTenantData(user.uid, DEMO_TENANT_ID)
                console.log('🎭 Usuario sin tenants - cargando Demo automáticamente')
              }
            }
            setLoading(false)
            setCurrentUser(user)
            return
          }

          setNeedsOnboarding(false)

          // 🔥 IMPORTANTE: Verificar custom claims y refrescar token si es necesario
          const idTokenResult = await user.getIdTokenResult()
          const hasTenantClaim = idTokenResult.claims.tenant_id

          // 🔐 Guardar claims y detectar SysOwner
          setJwtClaims(idTokenResult.claims as Record<string, unknown>)
          const sysOwnerDetected =
            idTokenResult.claims.sys_owner === true ||
            idTokenResult.claims.role === 'SysOwner'
          setIsSysOwner(sysOwnerDetected)

          if (sysOwnerDetected) {
            console.log('🔑 SysOwner detectado - acceso total habilitado')
          }

          // Si el usuario tiene tenants en Firestore pero NO tiene tenant_id en el token,
          // forzar refresh del token para obtener los custom claims actualizados
          if (!hasTenantClaim && profile?.activeTenant) {
            console.log('⚠️  Token sin custom claims detectado. Refrescando token...')

            try {
              // Forzar refresh del token
              await user.getIdToken(true)

              // Verificar nuevamente
              const refreshedTokenResult = await user.getIdTokenResult()
              const refreshedTenantClaim = refreshedTokenResult.claims.tenant_id

              if (refreshedTenantClaim) {
                console.log('✅ Token refrescado exitosamente con tenant_id:', refreshedTenantClaim)
              } else {
                console.warn('⚠️  Token refrescado pero aún sin tenant_id. Custom claims pueden no estar configurados.')
              }
            } catch (refreshError) {
              console.error('❌ Error al refrescar token:', refreshError)
            }
          }

          // Cargar tenant activo o el primero de los tenants propios
          const activeTenantId = profile?.activeTenant || userOwnTenants[0]?.id
          if (activeTenantId) {
            await loadTenantData(user.uid, activeTenantId)
          }
        } catch (error) {
          console.error('❌ Error al inicializar usuario:', error)
        }
      } else {
        // Usuario no autenticado
        setUserProfile(null)
        setCurrentTenant(null)
        setCurrentMember(null)
        setUserTenants([])
        setNeedsOnboarding(false)
        setIsSysOwner(false)
        setJwtClaims(null)
        setRoleSettings(null)
      }

      setCurrentUser(user)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value: AuthContextType = {
    currentUser,
    userProfile,
    currentTenant,
    currentMember,
    userTenants,
    loading,
    needsOnboarding,
    isSysOwner,
    jwtClaims,
    isDemoMode,
    roleSettings,
    canShowTenantId,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
    updateUserProfile,
    switchTenant,
    refreshTenant,
    reloadUserData,
    hasPermission,
    canManageBilling,
    canManageUsers,
    canManageDatasources,
    canManageDashboards,
    canViewDashboards,
    canExploreData
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

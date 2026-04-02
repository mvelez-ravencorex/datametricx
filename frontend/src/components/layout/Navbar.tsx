import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { BellIcon, UserCircleIcon, Bars3Icon, ArrowRightOnRectangleIcon, Cog6ToothIcon, UserIcon, BuildingOfficeIcon, ChevronDownIcon, BeakerIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/contexts/AuthContext'
import { DEMO_TENANT_ID } from '@/config/demo'

const navItems = [
  { name: 'Overview', path: '/dashboard', label: 'Overview' },
  { name: 'Sales', path: '/sales', label: 'Sales' },
  { name: 'Marketing', path: '/marketing', label: 'Marketing' },
  { name: 'Operations', path: '/operations', label: 'Operations' },
  { name: 'Settings', path: '/settings', label: 'Settings' },
]

interface NavbarProps {
  onMenuClick?: () => void
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentUser, signOut, currentTenant, userTenants, switchTenant, isDemoMode, userProfile } = useAuth()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isTenantMenuOpen, setIsTenantMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const tenantMenuRef = useRef<HTMLDivElement>(null)

  // Get photo URL from Firebase Auth or Firestore userProfile
  const photoURL = currentUser?.photoURL || userProfile?.photoURL

  // Resetear error de imagen cuando cambia el usuario o la foto
  useEffect(() => {
    setImageError(false)
  }, [currentUser?.photoURL, userProfile?.photoURL])

  // Cerrar el menú al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
      if (tenantMenuRef.current && !tenantMenuRef.current.contains(event.target as Node)) {
        setIsTenantMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSwitchTenant = async (tenantId: string) => {
    setIsTenantMenuOpen(false)
    if (tenantId !== currentTenant?.id) {
      await switchTenant(tenantId)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
    }
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left side: Logo + Navigation */}
          <div className="flex items-center">
            {/* Mobile menu button */}
            <button
              onClick={onMenuClick}
              className="lg:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-secondary-blue mr-2"
            >
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>

            {/* Logo */}
            <Link to="/dashboard" className="flex-shrink-0 flex items-center">
              <div className="flex items-center space-x-3">
                <svg className="h-9 w-9" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Bar 1 - Shortest */}
                  <rect x="15" y="55" width="18" height="30" rx="2" fill="#3B82F6"/>

                  {/* Bar 2 - Medium */}
                  <rect x="38" y="40" width="18" height="45" rx="2" fill="#60A5FA"/>

                  {/* Bar 3 - Tallest */}
                  <rect x="61" y="20" width="18" height="65" rx="2" fill="#2563EB"/>

                  {/* Chevron/Arrow */}
                  <path d="M65 75 L75 85 L85 75 L85 80 L75 90 L65 80 Z" fill="#1D4ED8"/>
                </svg>
                <span className="text-xl font-heading font-bold text-primary-blue">DataMetricX</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:ml-8 lg:flex lg:space-x-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path ||
                                (item.path === '/dashboard' && location.pathname === '/')

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-4 py-2 border-b-2 text-sm font-medium transition-colors duration-150 ${
                      isActive
                        ? 'border-primary-blue text-primary-blue'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Right side: User menu and notifications */}
          <div className="flex items-center space-x-4">
            {/* Demo Mode Badge */}
            {isDemoMode && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300" title="Datos de demostración - Solo lectura">
                <BeakerIcon className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700 hidden sm:inline">DEMO</span>
              </div>
            )}

            {/* Tenant Selector */}
            {userTenants.length > 0 && (
              <div className="relative" ref={tenantMenuRef}>
                <button
                  onClick={() => setIsTenantMenuOpen(!isTenantMenuOpen)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition-colors ${
                    isDemoMode
                      ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {isDemoMode ? (
                    <BeakerIcon className="h-5 w-5 text-amber-600" />
                  ) : (
                    <BuildingOfficeIcon className="h-5 w-5 text-gray-500" />
                  )}
                  <span className={`text-sm font-medium max-w-[150px] truncate hidden sm:block ${
                    isDemoMode ? 'text-amber-700' : 'text-gray-700'
                  }`}>
                    {currentTenant?.name || 'Tenant'}
                  </span>
                  <ChevronDownIcon className={`h-4 w-4 ${isDemoMode ? 'text-amber-500' : 'text-gray-400'}`} />
                </button>

                {isTenantMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                        Cambiar tenant
                      </div>
                      {userTenants.map((tenant) => {
                        const isDemo = tenant.id === DEMO_TENANT_ID
                        const isActive = tenant.id === currentTenant?.id
                        return (
                          <button
                            key={tenant.id}
                            onClick={() => handleSwitchTenant(tenant.id)}
                            className={`w-full flex items-center px-4 py-2 text-sm hover:bg-gray-100 ${
                              isActive
                                ? isDemo ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                                : 'text-gray-700'
                            }`}
                          >
                            {isDemo ? (
                              <BeakerIcon className="h-4 w-4 mr-2 flex-shrink-0 text-amber-500" />
                            ) : (
                              <BuildingOfficeIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                            )}
                            <span className="truncate flex-1 text-left">{tenant.name}</span>
                            {isDemo && (
                              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded">
                                DEMO
                              </span>
                            )}
                            {isActive && (
                              <span className={`ml-2 text-xs ${isDemo ? 'text-amber-600' : 'text-blue-600'}`}>
                                Activo
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notifications */}
            <button className="relative p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-blue">
              <span className="sr-only">View notifications</span>
              <BellIcon className="h-6 w-6" aria-hidden="true" />
              {/* Notification badge */}
              <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-accent-red ring-2 ring-white" />
            </button>

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-2 p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-blue"
              >
                <span className="sr-only">Open user menu</span>
                {photoURL && !imageError ? (
                  <img
                    src={photoURL.includes('googleusercontent.com') ? photoURL.replace(/=s\d+-c$/, '=s64-c') : photoURL}
                    alt="Avatar"
                    className="h-8 w-8 rounded-full object-cover border-2 border-gray-200"
                    onError={() => setImageError(true)}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <UserCircleIcon className="h-8 w-8" aria-hidden="true" />
                )}
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 z-50">
                  {/* User Info */}
                  <div className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {currentUser?.displayName || 'Usuario'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {currentUser?.email}
                    </p>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false)
                        navigate('/settings')
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <UserIcon className="h-5 w-5 mr-3 text-gray-400" />
                      Mi Perfil
                    </button>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false)
                        navigate('/settings')
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Cog6ToothIcon className="h-5 w-5 mr-3 text-gray-400" />
                      Configuración
                    </button>
                  </div>

                  {/* Sign Out */}
                  <div className="py-1">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <ArrowRightOnRectangleIcon className="h-5 w-5 mr-3" />
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden border-t border-gray-200">
        <div className="px-2 pt-2 pb-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
                            (item.path === '/dashboard' && location.pathname === '/')

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  isActive
                    ? 'bg-primary-blue text-white'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

/**
 * Página de callback para OAuth
 * Recibe el código de autorización y lo envía a la ventana principal
 */

import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

export default function OAuthCallback() {
  const location = useLocation()
  const [message, setMessage] = useState('Procesando autenticación...')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const code = params.get('code')
    const error = params.get('error')
    const errorDescription = params.get('error_description')

    if (window.opener) {
      // Enviar mensaje a la ventana principal
      if (error) {
        window.opener.postMessage(
          {
            type: 'oauth-callback',
            error: errorDescription || error
          },
          window.location.origin
        )
        setMessage(`Error: ${errorDescription || error}`)
      } else if (code) {
        window.opener.postMessage(
          {
            type: 'oauth-callback',
            code: code
          },
          window.location.origin
        )
        setMessage('¡Autenticación exitosa! Esta ventana se cerrará automáticamente...')

        // Cerrar ventana después de 1 segundo
        setTimeout(() => {
          window.close()
        }, 1000)
      } else {
        window.opener.postMessage(
          {
            type: 'oauth-callback',
            error: 'No se recibió código de autorización'
          },
          window.location.origin
        )
        setMessage('Error: No se recibió código de autorización')
      }
    } else {
      setMessage('Error: Esta ventana debe ser abierta desde la aplicación principal')
    }
  }, [location])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Autenticación
          </h2>
          <p className="text-gray-600">
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}

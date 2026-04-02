/**
 * Sistema de manejo de errores centralizado
 * Proporciona clases de error personalizadas y utilidades para manejar errores
 */

/**
 * Clase base para errores de la aplicación
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true,
    public meta?: Record<string, unknown>
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      meta: this.meta
    }
  }
}

/**
 * Error de validación de datos
 */
export class ValidationError extends AppError {
  constructor(message: string, meta?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, true, meta)
  }
}

/**
 * Error de autenticación
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'No autorizado') {
    super(message, 'UNAUTHORIZED', 401)
  }
}

/**
 * Error de autorización/permisos
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Acceso denegado') {
    super(message, 'FORBIDDEN', 403)
  }
}

/**
 * Error de recurso no encontrado
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} no encontrado`, 'NOT_FOUND', 404)
  }
}

/**
 * Error de conflicto (ej. recurso ya existe)
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409)
  }
}

/**
 * Error de límite de tasa excedido
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Demasiadas solicitudes. Intenta más tarde.') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429)
  }
}

/**
 * Error de servicio externo
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(`Error en ${service}: ${message}`, 'EXTERNAL_SERVICE_ERROR', 502)
  }
}

/**
 * Error de red/conectividad
 */
export class NetworkError extends AppError {
  constructor(message: string = 'Error de conexión') {
    super(message, 'NETWORK_ERROR', 503)
  }
}

/**
 * Convierte errores de Firebase a errores de la aplicación
 */
export function fromFirebaseError(error: { code?: string; message: string }): AppError {
  const { code, message } = error

  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return new UnauthorizedError('Credenciales inválidas')

    case 'auth/email-already-in-use':
      return new ConflictError('El correo ya está registrado')

    case 'auth/weak-password':
      return new ValidationError('La contraseña es demasiado débil')

    case 'auth/invalid-email':
      return new ValidationError('El correo electrónico no es válido')

    case 'auth/operation-not-allowed':
      return new ForbiddenError('Operación no permitida')

    case 'auth/too-many-requests':
      return new RateLimitError()

    case 'permission-denied':
      return new ForbiddenError('No tienes permisos para realizar esta acción')

    case 'not-found':
      return new NotFoundError('Recurso')

    case 'already-exists':
      return new ConflictError('El recurso ya existe')

    case 'resource-exhausted':
      return new RateLimitError('Cuota excedida')

    case 'unauthenticated':
      return new UnauthorizedError()

    case 'unavailable':
      return new NetworkError('Servicio no disponible temporalmente')

    default:
      return new AppError(message, code || 'UNKNOWN_ERROR', 500)
  }
}

/**
 * Determina si un error es operacional (esperado) o de programación
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational
  }
  return false
}

/**
 * Extrae un mensaje de error amigable para el usuario
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message
  }

  if (error instanceof Error) {
    // Convertir errores de Firebase
    if ('code' in error) {
      const appError = fromFirebaseError(error as { code: string; message: string })
      return appError.message
    }

    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Ha ocurrido un error inesperado'
}

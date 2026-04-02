/**
 * Utilidades de validación usando Zod
 * Proporciona schemas reutilizables y funciones de validación
 */

import { z } from 'zod'
import { ValidationError } from '@/lib/errors'

// ===== SCHEMAS BÁSICOS =====

export const schemas = {
  // Primitivos comunes
  email: z.string().email('El correo electrónico no es válido').max(255),

  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(100, 'La contraseña no puede tener más de 100 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),

  displayName: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede tener más de 50 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras'),

  uuid: z.string().uuid('ID inválido'),

  url: z.string().url('URL inválida'),

  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Número de teléfono inválido'),

  // Rangos numéricos
  positiveNumber: z.number().positive('El número debe ser positivo'),
  nonNegativeNumber: z.number().nonnegative('El número no puede ser negativo'),
  percentage: z.number().min(0).max(100, 'El porcentaje debe estar entre 0 y 100'),

  // Fechas
  dateString: z.string().datetime('Fecha inválida'),
  dateObject: z.date(),
}

// ===== SCHEMAS DE MODELOS =====

/**
 * Schema de perfil de usuario
 */
export const userProfileSchema = z.object({
  uid: schemas.uuid,
  email: schemas.email,
  displayName: schemas.displayName.nullable(),
  photoURL: schemas.url.nullable(),
  role: z.enum(['admin', 'user', 'viewer']),
  createdAt: z.date().or(z.any()), // Timestamp de Firestore
  updatedAt: z.date().or(z.any()),
  settings: z
    .object({
      theme: z.enum(['light', 'dark']).optional(),
      notifications: z.boolean().optional(),
      language: z.string().optional(),
    })
    .optional(),
})

/**
 * Schema de fuente de datos
 */
export const dataSourceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'El nombre es requerido').max(100),
  type: z.enum(['facebook', 'google', 'shopify', 'tiktok', 'other']),
  status: z.enum(['connected', 'disconnected', 'error']),
  credentials: z.record(z.unknown()).optional(),
  lastSync: z.date().or(z.any()).optional(),
  createdAt: z.date().or(z.any()),
  updatedAt: z.date().or(z.any()),
  userId: schemas.uuid,
})

/**
 * Schema de métrica
 */
export const metricSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'El nombre es requerido').max(100),
  value: schemas.nonNegativeNumber,
  change: z.number().optional(),
  dataSourceId: z.string().optional(),
  userId: schemas.uuid,
  timestamp: z.date().or(z.any()),
  metadata: z.record(z.unknown()).optional(),
})

/**
 * Schema de configuración de widget
 */
export const widgetConfigSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['kpi', 'chart', 'table', 'custom']),
  title: z.string().min(1).max(100),
  dataSourceId: z.string().optional(),
  metrics: z.array(z.string()).optional(),
  layout: z.object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    w: z.number().int().positive(),
    h: z.number().int().positive(),
  }),
  settings: z.record(z.unknown()).optional(),
  userId: schemas.uuid,
  createdAt: z.date().or(z.any()),
  updatedAt: z.date().or(z.any()),
})

/**
 * Schema de datos de venta
 */
export const salesDataSchema = z.object({
  id: z.string().optional(),
  productId: z.string(),
  productName: z.string().min(1).max(200),
  quantity: z.number().int().positive(),
  revenue: schemas.nonNegativeNumber,
  date: z.date().or(z.any()),
  userId: schemas.uuid,
  metadata: z
    .object({
      category: z.string().optional(),
      sku: z.string().optional(),
    })
    .passthrough()
    .optional(),
})

// ===== SCHEMAS DE FORMULARIOS =====

/**
 * Schema de login
 */
export const loginSchema = z.object({
  email: schemas.email,
  password: z.string().min(1, 'La contraseña es requerida'),
})

/**
 * Schema de registro
 */
export const registerSchema = z
  .object({
    displayName: schemas.displayName,
    email: schemas.email,
    password: schemas.password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

/**
 * Schema de actualización de perfil
 */
export const updateProfileSchema = z.object({
  displayName: schemas.displayName,
  photoURL: schemas.url.optional(),
})

// ===== FUNCIONES DE VALIDACIÓN =====

/**
 * Valida datos contra un schema de Zod
 * @throws ValidationError si la validación falla
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((err) => err.message).join(', ')
      throw new ValidationError(messages, {
        errors: error.errors,
      })
    }
    throw error
  }
}

/**
 * Valida datos contra un schema de Zod (sin lanzar error)
 * @returns Objeto con success y data/error
 */
export function validateSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data)
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error }
}

/**
 * Sanitiza un string removiendo caracteres peligrosos
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Prevenir XSS
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remover caracteres de control
    .slice(0, 1000) // Limitar longitud
}

/**
 * Sanitiza un objeto recursivamente
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj }

  for (const key in sanitized) {
    const value = sanitized[key]

    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value) as T[typeof key]
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>) as T[typeof key]
    }
  }

  return sanitized
}

/**
 * Verifica si un email es válido (quick check sin Zod)
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Verifica si una URL es válida (quick check sin Zod)
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Valida estructura de UUID
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

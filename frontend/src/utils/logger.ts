/**
 * Sistema de logging centralizado
 * Proporciona logging estructurado con niveles y metadatos
 */

import { analytics } from '@/config/firebase'
import { logEvent, Analytics } from 'firebase/analytics'

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  meta?: Record<string, unknown>
  userAgent?: string
  url?: string
}

/**
 * Clase Logger para logging estructurado
 */
export class Logger {
  private static instance: Logger
  private isDevelopment: boolean

  private constructor() {
    this.isDevelopment = import.meta.env.DEV
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  /**
   * Registra un log en consola
   */
  private logToConsole(entry: LogEntry) {
    const { timestamp, level, message, meta } = entry
    const style = this.getConsoleStyle(level)

    if (this.isDevelopment) {
      console[level](
        `%c[${timestamp}] ${level.toUpperCase()}: ${message}`,
        style,
        meta || ''
      )
    }
  }

  /**
   * Envía logs a servicios externos (producción)
   */
  private async logToService(entry: LogEntry) {
    if (!import.meta.env.PROD) return

    try {
      // Log a Firebase Analytics
      if (analytics && entry.level === LogLevel.ERROR) {
        logEvent(analytics as Analytics, 'exception', {
          description: entry.message,
          fatal: entry.level === LogLevel.ERROR,
          ...entry.meta
        })
      }

      // Aquí puedes agregar integración con otros servicios
      // como Sentry, LogRocket, DataDog, etc.

      /*
      // Ejemplo con Sentry
      if (typeof Sentry !== 'undefined') {
        Sentry.captureMessage(entry.message, {
          level: entry.level as Sentry.SeverityLevel,
          extra: entry.meta
        })
      }
      */
    } catch (error) {
      // Silenciosamente fallar si el logging externo falla
      console.error('Failed to log to external service:', error)
    }
  }

  /**
   * Obtiene estilos de consola según el nivel
   */
  private getConsoleStyle(level: LogLevel): string {
    const styles = {
      [LogLevel.DEBUG]: 'color: #9CA3AF',
      [LogLevel.INFO]: 'color: #3B82F6',
      [LogLevel.WARN]: 'color: #F59E0B',
      [LogLevel.ERROR]: 'color: #EF4444; font-weight: bold'
    }
    return styles[level]
  }

  /**
   * Crea un entry de log
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
      userAgent: navigator.userAgent,
      url: window.location.href
    }
  }

  /**
   * Método principal de logging
   */
  public log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const entry = this.createLogEntry(level, message, meta)

    this.logToConsole(entry)
    this.logToService(entry)
  }

  /**
   * Log de nivel DEBUG (solo en desarrollo)
   */
  public debug(message: string, meta?: Record<string, unknown>) {
    if (this.isDevelopment) {
      this.log(LogLevel.DEBUG, message, meta)
    }
  }

  /**
   * Log de nivel INFO
   */
  public info(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, meta)
  }

  /**
   * Log de nivel WARN
   */
  public warn(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, meta)
  }

  /**
   * Log de nivel ERROR
   */
  public error(message: string, error?: Error | unknown, meta?: Record<string, unknown>) {
    const errorMeta = {
      ...meta,
      ...(error instanceof Error && {
        error: error.message,
        stack: error.stack,
        name: error.name
      })
    }

    this.log(LogLevel.ERROR, message, errorMeta)
  }

  /**
   * Log de evento personalizado (para analytics)
   */
  public event(eventName: string, params?: Record<string, unknown>) {
    if (analytics) {
      logEvent(analytics as Analytics, eventName, params)
    }

    this.debug(`Event: ${eventName}`, params)
  }

  /**
   * Log de timing (para medir performance)
   */
  public timing(label: string, startTime: number) {
    const duration = Date.now() - startTime
    this.info(`Timing: ${label}`, { duration: `${duration}ms` })

    if (analytics) {
      logEvent(analytics as Analytics, 'timing_complete', {
        name: label,
        value: duration
      })
    }
  }
}

// Export singleton instance
const logger = Logger.getInstance()

export default logger

// Export convenience methods
export const { debug, info, warn, error, event, timing } = logger

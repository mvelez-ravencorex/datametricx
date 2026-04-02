/**
 * Tipos para arquitectura multi-tenant de DataMetricX
 */

import { Timestamp } from 'firebase/firestore'

// ===== TENANT =====

export type PlanType = 'trial' | 'basic' | 'pro' | 'enterprise'
export type BillingStatus = 'active' | 'past_due' | 'canceled' | 'paused'

export interface TenantFeatures {
  allow_custom_dashboards: boolean
  allow_explore_data: boolean
  max_users: number
  max_dashboards: number
  max_refresh_frequency: 'hourly' | 'daily' | 'weekly' | 'monthly'
}

export interface DatasourceStatus {
  [key: string]: 'connected' | 'disconnected' | 'pending' | 'error'
}

export interface Tenant {
  id: string
  name: string
  slug: string
  owner_uid: string
  plan: PlanType
  billing_status: BillingStatus
  createdAt: Date
  updatedAt: Date

  features: TenantFeatures
  datasource_status?: DatasourceStatus

  last_pipeline_run_at?: Date
  pipeline_error?: string | null
}

// ===== TENANT MEMBER =====

export type MemberRole = 'owner' | 'admin' | 'analyst' | 'viewer'
export type MemberStatus = 'active' | 'inactive' | 'pending'

export interface TenantMember {
  uid: string
  email: string
  role: MemberRole
  status: MemberStatus
  joinedAt: Date
}

// ===== DATASOURCE =====

export type DataSourcePlatform =
  | 'meta_ads'
  | 'tiktok_ads'
  | 'shopify'
  | 'ga4'
  | 'mercadolibre'
  | 'tiendanube'
  | 'google_ads'

export type DataSourceFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly'
export type DataSourceStatus = 'ok' | 'error' | 'pending' | 'disconnected'

export interface DataSource {
  id: string // ID del documento (ej: 'meta_ads', 'shopify')
  name: string // Nombre descriptivo (ej: "Meta Ads - Cuenta Principal")
  platform: DataSourcePlatform
  connected: boolean
  frequency: DataSourceFrequency
  time: string // HH:mm en UTC
  backfill_days: number

  credentials_stored: boolean
  business_id?: string
  account_id?: string

  last_run?: Date
  last_success?: Date
  last_error?: string | null
  status: DataSourceStatus
}

// ===== DASHBOARD =====

export interface Dashboard {
  id: string
  name: string
  description?: string
  createdBy: string // uid del usuario
  createdAt: Date
  updatedAt: Date
  public: boolean
}

// ===== VISUALIZATION =====

export type ChartType = 'line' | 'bar' | 'pie' | 'table' | 'kpi' | 'area'

export interface Visualization {
  id: string
  dataset: string
  fields: string[]
  groupBy?: string[]
  filters?: Record<string, any>
  chartType: ChartType
  createdAt: Date
  updatedAt: Date
}

// ===== SETTINGS =====

export interface TenantSettings {
  timezone: string
  currency: string
  language: string
  dateFormat: string
}

// ===== FIRESTORE CONVERTERS =====

/**
 * Convertir datos de Firestore a Tenant
 */
export function convertFirestoreTenant(data: any): Tenant {
  return {
    ...data,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
    last_pipeline_run_at: data.last_pipeline_run_at
      ? (data.last_pipeline_run_at instanceof Timestamp ? data.last_pipeline_run_at.toDate() : new Date(data.last_pipeline_run_at))
      : undefined
  }
}

/**
 * Convertir datos de Firestore a TenantMember
 */
export function convertFirestoreMember(data: any): TenantMember {
  return {
    ...data,
    joinedAt: data.joinedAt instanceof Timestamp ? data.joinedAt.toDate() : new Date(data.joinedAt)
  }
}

/**
 * Convertir datos de Firestore a DataSource
 */
export function convertFirestoreDataSource(data: any): DataSource {
  return {
    ...data,
    last_run: data.last_run
      ? (data.last_run instanceof Timestamp ? data.last_run.toDate() : new Date(data.last_run))
      : undefined,
    last_success: data.last_success
      ? (data.last_success instanceof Timestamp ? data.last_success.toDate() : new Date(data.last_success))
      : undefined
  }
}

// ===== PLAN FEATURES =====

export const PLAN_FEATURES: Record<PlanType, TenantFeatures> = {
  trial: {
    allow_custom_dashboards: true,
    allow_explore_data: true,
    max_users: 3,
    max_dashboards: 5,
    max_refresh_frequency: 'daily'
  },
  basic: {
    allow_custom_dashboards: true,
    allow_explore_data: true,
    max_users: 5,
    max_dashboards: 10,
    max_refresh_frequency: 'daily'
  },
  pro: {
    allow_custom_dashboards: true,
    allow_explore_data: true,
    max_users: 15,
    max_dashboards: 50,
    max_refresh_frequency: 'hourly'
  },
  enterprise: {
    allow_custom_dashboards: true,
    allow_explore_data: true,
    max_users: 999,
    max_dashboards: 999,
    max_refresh_frequency: 'hourly'
  }
}

// ===== ROLE PERMISSIONS =====

export const ROLE_PERMISSIONS = {
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

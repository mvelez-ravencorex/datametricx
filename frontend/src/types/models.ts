import { Timestamp } from 'firebase/firestore'

// User Profile
export interface UserProfile {
  uid: string
  email: string
  displayName: string | null
  photoURL: string | null
  role: 'admin' | 'user' | 'viewer'
  createdAt: Timestamp
  updatedAt: Timestamp
  settings?: {
    theme?: 'light' | 'dark'
    notifications?: boolean
    language?: string
  }
}

// Data Source
export interface DataSource {
  id: string
  name: string
  type: 'facebook' | 'google' | 'shopify' | 'tiktok' | 'other'
  status: 'connected' | 'disconnected' | 'error'
  credentials?: Record<string, unknown>
  lastSync?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
  userId: string
}

// Metric
export interface Metric {
  id: string
  name: string
  value: number
  change?: number
  dataSourceId: string
  userId: string
  timestamp: Timestamp
  metadata?: Record<string, unknown>
}

// Dashboard Widget Configuration
export interface WidgetConfig {
  id: string
  type: 'kpi' | 'chart' | 'table' | 'custom'
  title: string
  dataSourceId?: string
  metrics?: string[]
  layout: {
    x: number
    y: number
    w: number
    h: number
  }
  settings?: Record<string, unknown>
  userId: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Sales Data (Example)
export interface SalesData {
  id: string
  productId: string
  productName: string
  quantity: number
  revenue: number
  date: Timestamp
  userId: string
  metadata?: {
    category?: string
    sku?: string
    [key: string]: unknown
  }
}

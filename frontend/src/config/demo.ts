/**
 * Demo Tenant Configuration
 *
 * This tenant contains sample data for demonstration purposes.
 * All users automatically have read-only access to this tenant.
 */

import { Tenant } from '@/types/tenant'

export const DEMO_TENANT_ID = 'TENANT_DEMOAXNIY30L5'

// NOTE: Core dashboards are NO LONGER stored in a tenant.
// They are stored in root-level Firestore collections:
// - core_dashboards (dashboard templates)
// - core_dashboard_folders (folder organization)
// This ensures proper multi-tenant isolation - each tenant's data is ONLY accessible
// to members of that tenant. Core dashboards are TEMPLATES that show each user's
// own tenant data when viewed.

export const DEMO_TENANT_CONFIG = {
  id: DEMO_TENANT_ID,
  name: 'Demo DataMetricX',
  accountId: 'act_demo_123456789',
  datasourceId: 'meta-demo_123456789',
  // Demo tenant is always read-only
  isReadOnly: true,
}

/**
 * Check if a tenant ID is the demo tenant
 */
export function isDemoTenant(tenantId: string | undefined | null): boolean {
  return tenantId === DEMO_TENANT_ID
}

/**
 * Create a demo tenant object as fallback
 * This is used when the demo tenant doesn't exist in Firestore yet
 */
export function createDemoTenantFallback(): Tenant {
  return {
    id: DEMO_TENANT_ID,
    name: 'Demo DataMetricX',
    slug: 'demo-datametricx',
    owner_uid: 'system',
    plan: 'enterprise',
    billing_status: 'active',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date(),
    features: {
      allow_custom_dashboards: true,
      allow_explore_data: true,
      max_users: 999,
      max_dashboards: 999,
      max_refresh_frequency: 'hourly',
    },
  }
}

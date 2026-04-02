/**
 * Dataset Registry
 * Centralized access to all dataset schemas
 */

import type { DatasetSchema } from '@/types/datasetSchema'

// Import Meta Ads datasets - Entity tables
import metaCampaignsRaw from './meta-ads/meta_campaigns.json'
import metaAdsetsRaw from './meta-ads/meta_adsets.json'
import metaAdsRaw from './meta-ads/meta_ads.json'
import metaCreativesRaw from './meta-ads/meta_creatives.json'

// Import Meta Ads datasets - Performance tables
import metaPerformanceCampaignDailyRaw from './meta-ads/meta_performance_campaign_daily.json'
import metaPerformanceAdsetDailyRaw from './meta-ads/meta_performance_adset_daily.json'
import metaPerformanceAdDailyRaw from './meta-ads/meta_performance_ad_daily.json'
import metaPerformanceCampaignAgeGenderRaw from './meta-ads/meta_performance_campaign_age_gender.json'
import metaPerformanceCampaignCountryRaw from './meta-ads/meta_performance_campaign_country.json'
import metaPerformanceCampaignPublisherPlatformRaw from './meta-ads/meta_performance_campaign_publisher_platform.json'
import metaPerformanceCampaignImpressionDeviceRaw from './meta-ads/meta_performance_campaign_impression_device.json'
import metaPerformanceCampaignPlatformDeviceRaw from './meta-ads/meta_performance_campaign_platform_device.json'
import metaTopCreativesPerformanceRaw from './meta-ads/meta_top_creatives_performance.json'

// Type-safe dataset imports - Entity tables
const metaCampaigns = metaCampaignsRaw as DatasetSchema
const metaAdsets = metaAdsetsRaw as DatasetSchema
const metaAds = metaAdsRaw as DatasetSchema
const metaCreatives = metaCreativesRaw as DatasetSchema

// Type-safe dataset imports - Performance tables
const metaPerformanceCampaignDaily = metaPerformanceCampaignDailyRaw as DatasetSchema
const metaPerformanceAdsetDaily = metaPerformanceAdsetDailyRaw as DatasetSchema
const metaPerformanceAdDaily = metaPerformanceAdDailyRaw as DatasetSchema
const metaPerformanceCampaignAgeGender = metaPerformanceCampaignAgeGenderRaw as DatasetSchema
const metaPerformanceCampaignCountry = metaPerformanceCampaignCountryRaw as DatasetSchema
const metaPerformanceCampaignPublisherPlatform = metaPerformanceCampaignPublisherPlatformRaw as DatasetSchema
const metaPerformanceCampaignImpressionDevice = metaPerformanceCampaignImpressionDeviceRaw as DatasetSchema
const metaPerformanceCampaignPlatformDevice = metaPerformanceCampaignPlatformDeviceRaw as DatasetSchema
const metaTopCreativesPerformance = metaTopCreativesPerformanceRaw as DatasetSchema

/**
 * Dataset Registry - All available datasets
 */
export const DATASETS: Record<string, DatasetSchema> = {
  // Meta Ads - Entity tables
  'meta_campaigns': metaCampaigns,
  'meta_adsets': metaAdsets,
  'meta_ads': metaAds,
  'meta_creatives': metaCreatives,

  // Meta Ads - Performance tables
  'meta_performance_campaign_daily': metaPerformanceCampaignDaily,
  'meta_performance_adset_daily': metaPerformanceAdsetDaily,
  'meta_performance_ad_daily': metaPerformanceAdDaily,
  'meta_performance_campaign_age_gender': metaPerformanceCampaignAgeGender,
  'meta_performance_campaign_country': metaPerformanceCampaignCountry,
  'meta_performance_campaign_publisher_platform': metaPerformanceCampaignPublisherPlatform,
  'meta_performance_campaign_impression_device': metaPerformanceCampaignImpressionDevice,
  'meta_performance_campaign_platform_device': metaPerformanceCampaignPlatformDevice,
  'meta_top_creatives_performance': metaTopCreativesPerformance,

  // Future platforms will be added here:
  // 'ga4_sessions': ga4Sessions,
  // 'shopify_orders': shopifyOrders,
  // etc.
}

/**
 * Get dataset by name
 */
export function getDataset(name: string): DatasetSchema | undefined {
  return DATASETS[name]
}

/**
 * Get all datasets
 */
export function getAllDatasets(): DatasetSchema[] {
  return Object.values(DATASETS)
}

/**
 * Get datasets by category
 */
export function getDatasetsByCategory(category: string): DatasetSchema[] {
  return Object.values(DATASETS).filter(ds => ds.category === category)
}

/**
 * Get datasets by platform
 */
export function getDatasetsByPlatform(platform: string): DatasetSchema[] {
  return Object.values(DATASETS).filter(ds => ds.name.startsWith(platform))
}

/**
 * List all available dataset names
 */
export function listDatasetNames(): string[] {
  return Object.keys(DATASETS)
}

/**
 * Dataset categories
 */
export const DATASET_CATEGORIES = {
  ADVERTISING: 'advertising',
  ANALYTICS: 'analytics',
  ECOMMERCE: 'ecommerce',
  SOCIAL: 'social',
  FINANCE: 'finance',
  CUSTOM: 'custom'
} as const

/**
 * Platform mappings
 */
export const PLATFORM_DATASETS: Record<string, string[]> = {
  'meta-ads': [
    // Entity tables
    'meta_campaigns',
    'meta_adsets',
    'meta_ads',
    'meta_creatives',
    // Performance tables
    'meta_performance_campaign_daily',
    'meta_performance_adset_daily',
    'meta_performance_ad_daily',
    'meta_performance_campaign_age_gender',
    'meta_performance_campaign_country',
    'meta_performance_campaign_publisher_platform',
    'meta_performance_campaign_impression_device',
    'meta_performance_campaign_platform_device',
    'meta_top_creatives_performance'
  ],
  // Future platforms:
  // 'google-analytics-4': ['ga4_sessions', 'ga4_events', ...],
  // 'shopify': ['shopify_orders', 'shopify_products', ...],
}

/**
 * Get primary fact table for a platform
 */
export function getPrimaryDataset(platform: string): DatasetSchema | undefined {
  const datasetNames = PLATFORM_DATASETS[platform]
  if (!datasetNames || datasetNames.length === 0) return undefined

  // First dataset is typically the primary fact table
  return getDataset(datasetNames[0])
}

// Export dataset schemas for direct import
export {
  // Entity tables
  metaCampaigns,
  metaAdsets,
  metaAds,
  metaCreatives,
  // Performance tables
  metaPerformanceCampaignDaily,
  metaPerformanceAdsetDaily,
  metaPerformanceAdDaily,
  metaPerformanceCampaignAgeGender,
  metaPerformanceCampaignCountry,
  metaPerformanceCampaignPublisherPlatform,
  metaPerformanceCampaignImpressionDevice,
  metaPerformanceCampaignPlatformDevice,
  metaTopCreativesPerformance
}

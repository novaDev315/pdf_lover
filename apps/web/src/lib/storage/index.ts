/**
 * Storage utilities for PDFLover
 * Provides IndexedDB and Cache API functionality for local-first storage
 */

// IndexedDB exports
export {
  PDFLoverDB,
  db,
  isIndexedDBAvailable,
  generateId,
  type DocumentEmbedding,
  type AppSettings,
} from './indexeddb';

// Cache API exports
export {
  CACHE_NAMES,
  isCacheAvailable,
  openCache,
  cacheAsset,
  cacheAssets,
  getCachedAsset,
  getCachedText,
  getCachedBlob,
  getCachedArrayBuffer,
  isCached,
  deleteCachedAsset,
  clearCache,
  clearAllCaches,
  getCachedUrls,
  getCacheUsage,
  cacheData,
  getCachedData,
  deleteCachedData,
  pruneOldCacheEntries,
  type CacheName,
  type CacheMetadata,
} from './cache';

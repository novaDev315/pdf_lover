/**
 * Cache API utilities for PDFLover
 * Provides offline caching for static assets and processed data
 */

/**
 * Cache names for different types of content
 */
export const CACHE_NAMES = {
  /** Static assets like fonts, images, scripts */
  ASSETS: 'pdflover-assets-v1',
  /** PDF thumbnails and previews */
  THUMBNAILS: 'pdflover-thumbnails-v1',
  /** AI model files */
  MODELS: 'pdflover-models-v1',
  /** Processed PDF data */
  PDF_DATA: 'pdflover-pdf-data-v1',
} as const;

export type CacheName = (typeof CACHE_NAMES)[keyof typeof CACHE_NAMES];

/**
 * Cache entry metadata
 */
export interface CacheMetadata {
  /** URL of the cached resource */
  url: string;
  /** Timestamp when cached */
  cachedAt: number;
  /** Content type */
  contentType?: string;
  /** Content length in bytes */
  contentLength?: number;
  /** Custom tags for categorization */
  tags?: string[];
}

/**
 * Check if the Cache API is available
 * @returns Whether Cache API is supported
 */
export function isCacheAvailable(): boolean {
  return typeof caches !== 'undefined' && caches !== null;
}

/**
 * Open a cache by name
 * @param cacheName - Name of the cache to open
 * @returns The cache instance or null if unavailable
 */
export async function openCache(cacheName: CacheName = CACHE_NAMES.ASSETS): Promise<Cache | null> {
  if (!isCacheAvailable()) {
    console.warn('Cache API is not available in this browser');
    return null;
  }

  try {
    return await caches.open(cacheName);
  } catch (error) {
    console.error('Failed to open cache:', error);
    return null;
  }
}

/**
 * Cache an asset from a URL
 * @param url - The URL to fetch and cache
 * @param cacheName - The cache to store in (default: ASSETS)
 * @returns Whether the caching was successful
 */
export async function cacheAsset(
  url: string,
  cacheName: CacheName = CACHE_NAMES.ASSETS
): Promise<boolean> {
  const cache = await openCache(cacheName);
  if (!cache) {
    return false;
  }

  try {
    // Check if already cached
    const existingResponse = await cache.match(url);
    if (existingResponse) {
      return true;
    }

    // Fetch and cache
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'same-origin',
    });

    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.status}`);
      return false;
    }

    await cache.put(url, response.clone());
    return true;
  } catch (error) {
    console.error(`Failed to cache asset ${url}:`, error);
    return false;
  }
}

/**
 * Cache multiple assets in parallel
 * @param urls - Array of URLs to cache
 * @param cacheName - The cache to store in
 * @param onProgress - Optional progress callback
 * @returns Object with success/failure counts
 */
export async function cacheAssets(
  urls: string[],
  cacheName: CacheName = CACHE_NAMES.ASSETS,
  onProgress?: (progress: { completed: number; total: number; current: string }) => void
): Promise<{ successful: number; failed: number; errors: string[] }> {
  const results = {
    successful: 0,
    failed: 0,
    errors: [] as string[],
  };

  const total = urls.length;

  // Process in batches to avoid overwhelming the browser
  const batchSize = 5;
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const promises = batch.map(async (url) => {
      const success = await cacheAsset(url, cacheName);
      if (success) {
        results.successful++;
      } else {
        results.failed++;
        results.errors.push(url);
      }
      onProgress?.({
        completed: results.successful + results.failed,
        total,
        current: url,
      });
    });

    await Promise.all(promises);
  }

  return results;
}

/**
 * Get a cached asset
 * @param url - The URL of the cached asset
 * @param cacheName - The cache to search in (default: searches all)
 * @returns The cached response or null if not found
 */
export async function getCachedAsset(
  url: string,
  cacheName?: CacheName
): Promise<Response | null> {
  if (!isCacheAvailable()) {
    return null;
  }

  try {
    if (cacheName) {
      const cache = await openCache(cacheName);
      if (!cache) return null;
      return (await cache.match(url)) ?? null;
    }

    // Search all caches
    return (await caches.match(url)) ?? null;
  } catch (error) {
    console.error(`Failed to get cached asset ${url}:`, error);
    return null;
  }
}

/**
 * Get a cached asset as text
 * @param url - The URL of the cached asset
 * @param cacheName - The cache to search in
 * @returns The cached text or null
 */
export async function getCachedText(url: string, cacheName?: CacheName): Promise<string | null> {
  const response = await getCachedAsset(url, cacheName);
  if (!response) return null;

  try {
    return await response.text();
  } catch (error) {
    console.error('Failed to read cached text:', error);
    return null;
  }
}

/**
 * Get a cached asset as a Blob
 * @param url - The URL of the cached asset
 * @param cacheName - The cache to search in
 * @returns The cached Blob or null
 */
export async function getCachedBlob(url: string, cacheName?: CacheName): Promise<Blob | null> {
  const response = await getCachedAsset(url, cacheName);
  if (!response) return null;

  try {
    return await response.blob();
  } catch (error) {
    console.error('Failed to read cached blob:', error);
    return null;
  }
}

/**
 * Get a cached asset as an ArrayBuffer
 * @param url - The URL of the cached asset
 * @param cacheName - The cache to search in
 * @returns The cached ArrayBuffer or null
 */
export async function getCachedArrayBuffer(
  url: string,
  cacheName?: CacheName
): Promise<ArrayBuffer | null> {
  const response = await getCachedAsset(url, cacheName);
  if (!response) return null;

  try {
    return await response.arrayBuffer();
  } catch (error) {
    console.error('Failed to read cached array buffer:', error);
    return null;
  }
}

/**
 * Check if an asset is cached
 * @param url - The URL to check
 * @param cacheName - The cache to check (default: searches all)
 * @returns Whether the asset is cached
 */
export async function isCached(url: string, cacheName?: CacheName): Promise<boolean> {
  const response = await getCachedAsset(url, cacheName);
  return response !== null;
}

/**
 * Delete a cached asset
 * @param url - The URL of the cached asset
 * @param cacheName - The cache to delete from (default: all caches)
 * @returns Whether deletion was successful
 */
export async function deleteCachedAsset(
  url: string,
  cacheName?: CacheName
): Promise<boolean> {
  if (!isCacheAvailable()) {
    return false;
  }

  try {
    if (cacheName) {
      const cache = await openCache(cacheName);
      if (!cache) return false;
      return await cache.delete(url);
    }

    // Delete from all caches
    const cacheNames = await caches.keys();
    const results = await Promise.all(
      cacheNames.map(async (name) => {
        const cache = await caches.open(name);
        return cache.delete(url);
      })
    );

    return results.some((result) => result);
  } catch (error) {
    console.error(`Failed to delete cached asset ${url}:`, error);
    return false;
  }
}

/**
 * Clear all entries from a specific cache
 * @param cacheName - The cache to clear
 * @returns Whether clearing was successful
 */
export async function clearCache(cacheName: CacheName): Promise<boolean> {
  if (!isCacheAvailable()) {
    return false;
  }

  try {
    return await caches.delete(cacheName);
  } catch (error) {
    console.error(`Failed to clear cache ${cacheName}:`, error);
    return false;
  }
}

/**
 * Clear all PDFLover caches
 * @returns Object with results for each cache
 */
export async function clearAllCaches(): Promise<Record<CacheName, boolean>> {
  const results: Partial<Record<CacheName, boolean>> = {};

  for (const cacheName of Object.values(CACHE_NAMES)) {
    results[cacheName] = await clearCache(cacheName);
  }

  return results as Record<CacheName, boolean>;
}

/**
 * Get all cached URLs in a cache
 * @param cacheName - The cache to list
 * @returns Array of cached URLs
 */
export async function getCachedUrls(cacheName: CacheName): Promise<string[]> {
  const cache = await openCache(cacheName);
  if (!cache) {
    return [];
  }

  try {
    const keys = await cache.keys();
    return keys.map((request) => request.url);
  } catch (error) {
    console.error(`Failed to list cached URLs in ${cacheName}:`, error);
    return [];
  }
}

/**
 * Get cache storage usage information
 * @returns Object with usage information for each cache
 */
export async function getCacheUsage(): Promise<
  Record<CacheName, { count: number; estimatedSize: number }>
> {
  const usage: Partial<Record<CacheName, { count: number; estimatedSize: number }>> = {};

  for (const cacheName of Object.values(CACHE_NAMES)) {
    const cache = await openCache(cacheName);
    if (!cache) {
      usage[cacheName] = { count: 0, estimatedSize: 0 };
      continue;
    }

    try {
      const keys = await cache.keys();
      let estimatedSize = 0;

      // Sample a few responses to estimate size
      const sampleSize = Math.min(keys.length, 10);
      for (let i = 0; i < sampleSize; i++) {
        const response = await cache.match(keys[i]!);
        if (response) {
          const contentLength = response.headers.get('content-length');
          if (contentLength) {
            estimatedSize += parseInt(contentLength, 10);
          }
        }
      }

      // Extrapolate for full cache
      if (sampleSize > 0) {
        estimatedSize = (estimatedSize / sampleSize) * keys.length;
      }

      usage[cacheName] = {
        count: keys.length,
        estimatedSize: Math.round(estimatedSize),
      };
    } catch (error) {
      console.error(`Failed to get usage for ${cacheName}:`, error);
      usage[cacheName] = { count: 0, estimatedSize: 0 };
    }
  }

  return usage as Record<CacheName, { count: number; estimatedSize: number }>;
}

/**
 * Cache a custom response (not from a URL)
 * Useful for caching generated content like thumbnails
 * @param key - Unique key for the cached item
 * @param data - Data to cache (Blob, ArrayBuffer, or string)
 * @param contentType - MIME type of the content
 * @param cacheName - The cache to store in
 * @returns Whether caching was successful
 */
export async function cacheData(
  key: string,
  data: Blob | ArrayBuffer | string,
  contentType: string,
  cacheName: CacheName = CACHE_NAMES.PDF_DATA
): Promise<boolean> {
  const cache = await openCache(cacheName);
  if (!cache) {
    return false;
  }

  try {
    // Convert data to Blob if needed
    let blob: Blob;
    if (data instanceof Blob) {
      blob = data;
    } else if (data instanceof ArrayBuffer) {
      blob = new Blob([data], { type: contentType });
    } else {
      blob = new Blob([data], { type: contentType });
    }

    const response = new Response(blob, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': blob.size.toString(),
        'X-Cached-At': Date.now().toString(),
      },
    });

    // Use a namespaced synthetic URL as the cache key
    const cacheKeyUrl = `pdflover://cache/${cacheName}/${key}`;
    await cache.put(cacheKeyUrl, response);
    return true;
  } catch (error) {
    console.error(`Failed to cache data with key ${key}:`, error);
    return false;
  }
}

/**
 * Get cached data by key
 * @param key - The key used when caching
 * @param cacheName - The cache to search in
 * @returns The cached response or null
 */
export async function getCachedData(
  key: string,
  cacheName: CacheName = CACHE_NAMES.PDF_DATA
): Promise<Response | null> {
  const cacheKeyUrl = `pdflover://cache/${cacheName}/${key}`;
  return getCachedAsset(cacheKeyUrl, cacheName);
}

/**
 * Delete cached data by key
 * @param key - The key used when caching
 * @param cacheName - The cache to delete from
 * @returns Whether deletion was successful
 */
export async function deleteCachedData(
  key: string,
  cacheName: CacheName = CACHE_NAMES.PDF_DATA
): Promise<boolean> {
  const cacheKeyUrl = `pdflover://cache/${cacheName}/${key}`;
  return deleteCachedAsset(cacheKeyUrl, cacheName);
}

/**
 * Prune old cache entries based on age
 * @param cacheName - The cache to prune
 * @param maxAgeMs - Maximum age in milliseconds
 * @returns Number of entries removed
 */
export async function pruneOldCacheEntries(
  cacheName: CacheName,
  maxAgeMs: number
): Promise<number> {
  const cache = await openCache(cacheName);
  if (!cache) {
    return 0;
  }

  try {
    const keys = await cache.keys();
    let removed = 0;
    const now = Date.now();

    for (const request of keys) {
      const response = await cache.match(request);
      if (!response) continue;

      const cachedAt = response.headers.get('X-Cached-At');
      if (cachedAt) {
        const age = now - parseInt(cachedAt, 10);
        if (age > maxAgeMs) {
          await cache.delete(request);
          removed++;
        }
      }
    }

    return removed;
  } catch (error) {
    console.error(`Failed to prune cache ${cacheName}:`, error);
    return 0;
  }
}

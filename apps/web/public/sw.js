/**
 * PDFLover Service Worker
 *
 * Implements caching strategies for offline support while maintaining privacy.
 * User documents are NEVER cached - only application assets.
 */

const CACHE_VERSION = 'v1';
const CACHE_NAMES = {
  static: `pdflover-static-${CACHE_VERSION}`,
  runtime: `pdflover-runtime-${CACHE_VERSION}`,
  fonts: `pdflover-fonts-${CACHE_VERSION}`,
  pdfWorker: `pdflover-pdf-worker-${CACHE_VERSION}`,
  aiModels: `pdflover-ai-models-${CACHE_VERSION}`,
};

// Maximum size for AI model cache (500MB)
const AI_MODEL_CACHE_LIMIT = 500 * 1024 * 1024;
const SHARE_FILE_LIMIT = 200 * 1024 * 1024;

// App shell - core assets required for offline functionality
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
];

// PDF.js worker files to cache
const PDF_WORKER_PATTERNS = [
  /pdf\.worker.*\.js$/,
  /pdf\.worker.*\.mjs$/,
];

// AI model file patterns (Transformers.js)
const AI_MODEL_PATTERNS = [
  /\.onnx$/,
  /\.onnx\.data$/,
  /tokenizer.*\.json$/,
  /config\.json$/,
];

// Static asset patterns
const STATIC_ASSET_PATTERNS = [
  /\.js$/,
  /\.css$/,
  /\.woff2?$/,
  /\.ttf$/,
  /\.svg$/,
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.webp$/,
  /\.ico$/,
];

// Never cache these patterns (privacy-sensitive)
const NEVER_CACHE_PATTERNS = [
  /\/api\//,
  /\.pdf$/,
  /blob:/,
  /data:/,
];

/**
 * Install event - cache app shell
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAMES.static).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(APP_SHELL).catch((error) => {
        console.warn('[SW] Failed to cache some app shell assets:', error);
      });
    })
  );
  // Activate immediately without waiting
  self.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            // Delete old version caches
            return name.startsWith('pdflover-') &&
                   !Object.values(CACHE_NAMES).includes(name);
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activated and claimed clients');
      return self.clients.claim();
    })
  );
});

/**
 * Determine if a request should never be cached
 */
function shouldNeverCache(url) {
  return NEVER_CACHE_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Determine the cache name for a request
 */
function getCacheNameForRequest(url) {
  if (PDF_WORKER_PATTERNS.some((pattern) => pattern.test(url))) {
    return CACHE_NAMES.pdfWorker;
  }
  if (AI_MODEL_PATTERNS.some((pattern) => pattern.test(url))) {
    return CACHE_NAMES.aiModels;
  }
  if (/fonts\.g(oogle)?apis\.com/.test(url) || /\.woff2?$/.test(url) || /\.ttf$/.test(url)) {
    return CACHE_NAMES.fonts;
  }
  if (STATIC_ASSET_PATTERNS.some((pattern) => pattern.test(url))) {
    return CACHE_NAMES.static;
  }
  return CACHE_NAMES.runtime;
}

/**
 * Network-first strategy for dynamic content
 */
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

/**
 * Cache-first strategy for static assets
 */
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    throw error;
  }
}

/**
 * Stale-while-revalidate strategy
 */
async function staleWhileRevalidate(request, cacheName) {
  const cachedResponse = await caches.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      caches.open(cacheName).then((cache) => {
        cache.put(request, networkResponse.clone());
      });
    }
    return networkResponse;
  }).catch(() => null);

  return cachedResponse || fetchPromise;
}

/**
 * Cache AI models with size limit enforcement
 */
async function cacheAIModel(request) {
  const cache = await caches.open(CACHE_NAMES.aiModels);

  // Check cache size before adding
  const keys = await cache.keys();
  let totalSize = 0;

  for (const key of keys) {
    const response = await cache.match(key);
    if (response) {
      const blob = await response.clone().blob();
      totalSize += blob.size;
    }
  }

  // If cache is too large, remove oldest entries
  if (totalSize > AI_MODEL_CACHE_LIMIT) {
    console.log('[SW] AI model cache limit reached, clearing old entries');
    await cache.delete(keys[0]);
  }

  return cacheFirst(request, CACHE_NAMES.aiModels);
}

function openShareDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PDFLoverShareTarget', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('pending')) {
        request.result.createObjectStore('pending', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open share handoff'));
  });
}

async function storeSharedFiles(files) {
  const database = await openShareDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('pending', 'readwrite');
      const store = transaction.objectStore('pending');
      for (const file of files) {
        const now = Date.now();
        store.put({
          id: crypto.randomUUID(),
          file,
          createdAt: now,
          expiresAt: now + 60 * 60 * 1000,
        });
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Failed to store shared PDF'));
      transaction.onabort = () => reject(transaction.error || new Error('Shared PDF handoff was aborted'));
    });
  } finally {
    database.close();
  }
}

async function handleShareTarget(request) {
  const form = await request.formData();
  const candidates = form.getAll('files').filter((value) => value instanceof File);
  const valid = [];
  for (const file of candidates) {
    if (file.size === 0 || file.size > SHARE_FILE_LIMIT) continue;
    if (file.type && file.type !== 'application/pdf') continue;
    const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...header) !== '%PDF-') continue;
    valid.push(file);
  }
  if (valid.length === 0) {
    return Response.redirect(new URL('/files?shareError=invalid-pdf', self.location.origin), 303);
  }
  await storeSharedFiles(valid);
  return Response.redirect(new URL('/files?shared=1', self.location.origin), 303);
}

/**
 * Fetch event handler
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  if (request.method === 'POST' && new URL(url).pathname === '/') {
    event.respondWith(handleShareTarget(request));
    return;
  }

  // Skip other non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Never cache privacy-sensitive content
  if (shouldNeverCache(url)) {
    return;
  }

  // Handle different request types
  const cacheName = getCacheNameForRequest(url);

  if (AI_MODEL_PATTERNS.some((pattern) => pattern.test(url))) {
    // AI models: cache-first with size limit
    event.respondWith(cacheAIModel(request));
    return;
  }

  if (PDF_WORKER_PATTERNS.some((pattern) => pattern.test(url))) {
    // PDF workers: cache-first (stable files)
    event.respondWith(cacheFirst(request, cacheName));
    return;
  }

  if (cacheName === CACHE_NAMES.fonts) {
    // Fonts: cache-first (rarely change)
    event.respondWith(cacheFirst(request, cacheName));
    return;
  }

  if (request.mode === 'navigate') {
    // Navigation: network-first with offline fallback
    event.respondWith(
      networkFirst(request, CACHE_NAMES.runtime).catch(() => {
        return caches.match('/offline.html');
      })
    );
    return;
  }

  if (cacheName === CACHE_NAMES.static) {
    // Static assets: stale-while-revalidate
    event.respondWith(staleWhileRevalidate(request, cacheName));
    return;
  }

  // Default: network-first
  event.respondWith(networkFirst(request, cacheName));
});

/**
 * Background sync for pending operations
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'pdflover-sync') {
    event.waitUntil(syncPendingOperations());
  }
});

/**
 * Process pending operations when back online
 */
async function syncPendingOperations() {
  try {
    // Notify all clients that sync is happening
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_STARTED',
      });
    });

    // Sync operations would be handled by the app
    console.log('[SW] Background sync completed');

    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_COMPLETED',
      });
    });
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

/**
 * Message handler for client communication
 */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: CACHE_VERSION });
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(
        Promise.all(
          Object.values(CACHE_NAMES).map((name) => caches.delete(name))
        ).then(() => {
          event.ports[0]?.postMessage({ success: true });
        })
      );
      break;

    case 'CACHE_URLS':
      if (payload?.urls && Array.isArray(payload.urls)) {
        event.waitUntil(
          caches.open(CACHE_NAMES.runtime).then((cache) => {
            return cache.addAll(payload.urls);
          })
        );
      }
      break;

    default:
      break;
  }
});

/**
 * Push notification handler (for future use)
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New notification from PDFLover',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: data.tag || 'pdflover-notification',
      data: data.data || {},
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'PDFLover', options)
    );
  } catch (error) {
    console.error('[SW] Push notification error:', error);
  }
});

/**
 * Notification click handler
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing window if available
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Open new window if no existing window
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

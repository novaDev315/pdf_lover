/**
 * Service Worker Registration Module
 *
 * Handles service worker lifecycle including registration, updates,
 * and communication with the main application.
 */

export interface ServiceWorkerConfig {
  /** Callback when service worker is ready */
  onReady?: (registration: ServiceWorkerRegistration) => void;
  /** Callback when an update is available */
  onUpdateAvailable?: (registration: ServiceWorkerRegistration) => void;
  /** Callback when the app is updated and will reload */
  onUpdated?: () => void;
  /** Callback for registration errors */
  onError?: (error: Error) => void;
  /** Callback when offline status changes */
  onOfflineStatusChange?: (isOnline: boolean) => void;
}

/** Global registration instance for external access */
let swRegistration: ServiceWorkerRegistration | null = null;
let registrationPromise: Promise<ServiceWorkerRegistration | null> | null =
  null;
let updateCheckTimer: ReturnType<typeof setInterval> | null = null;
const registrationConfigs = new Set<ServiceWorkerConfig>();

function notifyConfigs<K extends keyof ServiceWorkerConfig>(
  callback: K,
  ...args: Parameters<NonNullable<ServiceWorkerConfig[K]>>
): void {
  for (const config of registrationConfigs) {
    const handler = config[callback] as
      | ((...values: typeof args) => void)
      | undefined;
    handler?.(...args);
  }
}

/**
 * Register the service worker
 */
export async function registerServiceWorker(
  config: ServiceWorkerConfig = {},
): Promise<ServiceWorkerRegistration | null> {
  registrationConfigs.add(config);

  if (!("serviceWorker" in navigator)) {
    console.warn(
      "[SW Registration] Service workers are not supported in this browser",
    );
    return null;
  }

  // Only register in production or if explicitly enabled
  const isProduction = import.meta.env.PROD;
  const forceEnable = import.meta.env.VITE_ENABLE_SW === "true";

  if (!isProduction && !forceEnable) {
    console.log(
      "[SW Registration] Skipping SW registration in development mode",
    );
    return null;
  }

  if (swRegistration) {
    config.onReady?.(swRegistration);
    if (swRegistration.waiting) config.onUpdateAvailable?.(swRegistration);
    return swRegistration;
  }

  if (registrationPromise) return registrationPromise;

  registrationPromise = (async () => {
    const hadControllerAtRegistration = Boolean(
      navigator.serviceWorker.controller,
    );
    let hasActiveController = hadControllerAtRegistration;
    let reloadRequested = false;

    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });

      swRegistration = registration;

      // Handle registration success
      console.log(
        "[SW Registration] Service worker registered:",
        registration.scope,
      );

      // Check if there's a waiting service worker
      if (registration.waiting) {
        notifyConfigs("onUpdateAvailable", registration);
      }

      // Listen for updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed") {
            if (navigator.serviceWorker.controller) {
              // New version available
              console.log("[SW Registration] New version available");
              notifyConfigs("onUpdateAvailable", registration);
            } else {
              // First install
              console.log("[SW Registration] Content cached for offline use");
            }
          }
        });
      });

      // Handle controller change (after skipWaiting)
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // clients.claim() also fires controllerchange on the first install. The
        // app is already running the current assets, so reloading here can erase
        // a file selection or an in-progress local operation.
        if (!hasActiveController) {
          hasActiveController = true;
          return;
        }
        if (reloadRequested) return;
        reloadRequested = true;
        console.log("[SW Registration] Controller changed, reloading...");
        notifyConfigs("onUpdated");
        window.location.reload();
      });

      // Wait for the service worker to be ready
      const readyRegistration = await navigator.serviceWorker.ready;
      notifyConfigs("onReady", readyRegistration);

      // Set up periodic update checks (every hour)
      updateCheckTimer = setInterval(
        () => {
          registration.update().catch(console.error);
        },
        60 * 60 * 1000,
      );

      return registration;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[SW Registration] Registration failed:", err);
      notifyConfigs("onError", err);
      registrationPromise = null;
      return null;
    }
  })();

  return registrationPromise;
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const success = await registration.unregister();
    console.log("[SW Registration] Service worker unregistered:", success);
    swRegistration = null;
    registrationPromise = null;
    if (updateCheckTimer) {
      clearInterval(updateCheckTimer);
      updateCheckTimer = null;
    }
    return success;
  } catch (error) {
    console.error("[SW Registration] Unregistration failed:", error);
    return false;
  }
}

/**
 * Skip waiting and activate the new service worker
 */
export function skipWaiting(): void {
  if (swRegistration?.waiting) {
    swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
  }
}

/**
 * Get the current service worker registration
 */
export function getRegistration(): ServiceWorkerRegistration | null {
  return swRegistration;
}

/**
 * Check if there's an update waiting
 */
export function hasUpdateWaiting(): boolean {
  return !!swRegistration?.waiting;
}

/**
 * Clear all service worker caches
 */
export async function clearCaches(): Promise<void> {
  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith("pdflover-"))
        .map((name) => caches.delete(name)),
    );
    console.log("[SW Registration] Caches cleared");
  }
}

/**
 * Send a message to the service worker
 */
export function postMessage(message: unknown): void {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
  }
}

/**
 * Request a message response from the service worker
 */
export function sendMessage<T = unknown>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!navigator.serviceWorker.controller) {
      reject(new Error("No active service worker"));
      return;
    }

    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data as T);
      }
    };

    navigator.serviceWorker.controller.postMessage(message, [
      messageChannel.port2,
    ]);
  });
}

/**
 * Get the service worker version
 */
export async function getServiceWorkerVersion(): Promise<string | null> {
  try {
    const response = await sendMessage<{ version: string }>({
      type: "GET_VERSION",
    });
    return response.version;
  } catch {
    return null;
  }
}

/**
 * Pre-cache specific URLs
 */
export function precacheUrls(urls: string[]): void {
  postMessage({ type: "CACHE_URLS", payload: { urls } });
}

/**
 * Set up online/offline status monitoring
 */
export function setupOnlineStatusMonitoring(
  callback: (isOnline: boolean) => void,
): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

/**
 * Check if the app is running in standalone mode (installed PWA)
 */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true ||
    document.referrer.includes("android-app://")
  );
}

/**
 * Check if the app can be installed
 */
export function canInstall(): boolean {
  // The beforeinstallprompt event is stored globally by the PWA hook
  return !!(window as Window & { deferredPrompt?: BeforeInstallPromptEvent })
    .deferredPrompt;
}

/**
 * BeforeInstallPrompt event interface
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Augment the Window interface
declare global {
  interface Window {
    deferredPrompt?: BeforeInstallPromptEvent;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
}

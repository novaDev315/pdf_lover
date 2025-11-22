import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import {
  registerServiceWorker,
  skipWaiting,
  getRegistration,
  hasUpdateWaiting,
  isStandalone,
  type BeforeInstallPromptEvent,
  type ServiceWorkerConfig,
} from '../service-worker-registration';

/**
 * PWA state interface
 */
export interface PWAState {
  /** Whether the app is installed as a PWA */
  isInstalled: boolean;
  /** Whether the device is online */
  isOnline: boolean;
  /** Whether the app can be installed */
  canInstall: boolean;
  /** Whether a service worker update is available */
  updateAvailable: boolean;
  /** Whether the service worker is ready */
  isReady: boolean;
  /** Whether the service worker is supported */
  isSupported: boolean;
  /** The current service worker registration */
  registration: ServiceWorkerRegistration | null;
}

/**
 * PWA actions interface
 */
export interface PWAActions {
  /** Prompt the user to install the app */
  installApp: () => Promise<boolean>;
  /** Apply the available update */
  updateApp: () => void;
  /** Dismiss the install prompt */
  dismissInstall: () => void;
  /** Check for updates manually */
  checkForUpdates: () => Promise<void>;
}

/**
 * usePWA hook return type
 */
export type UsePWAReturn = PWAState & PWAActions;

// External store for online status
const onlineStore = {
  getSnapshot: () => navigator.onLine,
  getServerSnapshot: () => true,
  subscribe: (callback: () => void) => {
    window.addEventListener('online', callback);
    window.addEventListener('offline', callback);
    return () => {
      window.removeEventListener('online', callback);
      window.removeEventListener('offline', callback);
    };
  },
};

/**
 * Hook for managing PWA functionality
 *
 * Provides:
 * - Install status and installation prompt
 * - Online/offline status
 * - Service worker update notifications
 * - Update management
 *
 * @example
 * ```tsx
 * function App() {
 *   const {
 *     isInstalled,
 *     isOnline,
 *     canInstall,
 *     updateAvailable,
 *     installApp,
 *     updateApp,
 *   } = usePWA();
 *
 *   return (
 *     <div>
 *       {!isOnline && <OfflineBanner />}
 *       {canInstall && <InstallButton onClick={installApp} />}
 *       {updateAvailable && <UpdateButton onClick={updateApp} />}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePWA(): UsePWAReturn {
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isStandalone());
  const [canInstall, setCanInstall] = useState<boolean>(false);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  // Use external store for online status (more reliable)
  const isOnline = useSyncExternalStore(
    onlineStore.subscribe,
    onlineStore.getSnapshot,
    onlineStore.getServerSnapshot
  );

  const isSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator;

  // Handle beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      // Prevent the mini-infobar from appearing on mobile
      event.preventDefault();
      // Store the event for later use
      setDeferredPrompt(event);
      window.deferredPrompt = event;
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      console.log('[usePWA] App installed');
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
      window.deferredPrompt = undefined;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if already installed
    if (isStandalone()) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Register service worker
  useEffect(() => {
    const config: ServiceWorkerConfig = {
      onReady: (reg) => {
        console.log('[usePWA] Service worker ready');
        setIsReady(true);
        setRegistration(reg);
        // Check if update is already waiting
        if (hasUpdateWaiting()) {
          setUpdateAvailable(true);
        }
      },
      onUpdateAvailable: (reg) => {
        console.log('[usePWA] Update available');
        setUpdateAvailable(true);
        setRegistration(reg);
      },
      onError: (error) => {
        console.error('[usePWA] Service worker error:', error);
      },
    };

    registerServiceWorker(config);
  }, []);

  // Track display mode changes (user might install while using the app)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');

    const handleChange = (event: MediaQueryListEvent) => {
      setIsInstalled(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    // Fallback for older browsers
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  /**
   * Install the app
   */
  const installApp = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      console.warn('[usePWA] No install prompt available');
      return false;
    }

    try {
      // Show the install prompt
      await deferredPrompt.prompt();

      // Wait for user response
      const { outcome } = await deferredPrompt.userChoice;

      console.log('[usePWA] Install outcome:', outcome);

      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        window.deferredPrompt = undefined;
        setCanInstall(false);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[usePWA] Install error:', error);
      return false;
    }
  }, [deferredPrompt]);

  /**
   * Apply the available update
   */
  const updateApp = useCallback((): void => {
    if (updateAvailable) {
      skipWaiting();
      // The page will reload automatically via controllerchange event
    }
  }, [updateAvailable]);

  /**
   * Dismiss the install prompt
   */
  const dismissInstall = useCallback((): void => {
    setDeferredPrompt(null);
    setCanInstall(false);
  }, []);

  /**
   * Check for updates manually
   */
  const checkForUpdates = useCallback(async (): Promise<void> => {
    const reg = getRegistration();
    if (reg) {
      try {
        await reg.update();
        if (reg.waiting) {
          setUpdateAvailable(true);
        }
      } catch (error) {
        console.error('[usePWA] Update check failed:', error);
      }
    }
  }, []);

  return {
    // State
    isInstalled,
    isOnline,
    canInstall,
    updateAvailable,
    isReady,
    isSupported,
    registration,
    // Actions
    installApp,
    updateApp,
    dismissInstall,
    checkForUpdates,
  };
}

/**
 * Hook for just online status (lighter weight)
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    onlineStore.subscribe,
    onlineStore.getSnapshot,
    onlineStore.getServerSnapshot
  );
}

/**
 * Hook for detecting standalone mode
 */
export function useStandaloneMode(): boolean {
  const [isStandaloneMode, setIsStandaloneMode] = useState<boolean>(() => isStandalone());

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');

    const handleChange = (event: MediaQueryListEvent) => {
      setIsStandaloneMode(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return isStandaloneMode;
}

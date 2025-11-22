/**
 * React hook for monitoring browser storage quota
 * Provides real-time storage usage information
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/storage';

/**
 * Base storage quota information
 * Mirrors StorageQuota from @pdflover/shared for type safety
 */
interface BaseStorageQuota {
  /** Total storage used in bytes */
  used: number;
  /** Total available storage in bytes */
  available: number;
  /** Storage quota in bytes (browser limit) */
  quota: number;
  /** Usage percentage (0-100) */
  usagePercentage: number;
  /** Number of documents stored */
  documentCount: number;
  /** Number of conversations stored */
  conversationCount: number;
  /** Whether storage is persisted (won't be evicted) */
  isPersisted: boolean;
  /** Last calculated timestamp */
  calculatedAt: Date;
}

/**
 * Storage quota state with additional computed properties
 */
export interface StorageQuotaState extends BaseStorageQuota {
  /** Whether storage data is currently loading */
  isLoading: boolean;
  /** Error message if quota check failed */
  error: string | null;
  /** Human-readable used storage (e.g., "1.5 GB") */
  usedFormatted: string;
  /** Human-readable available storage (e.g., "4.5 GB") */
  availableFormatted: string;
  /** Human-readable quota (e.g., "6 GB") */
  quotaFormatted: string;
  /** Whether storage is running low (>80% used) */
  isLow: boolean;
  /** Whether storage is critically low (>95% used) */
  isCritical: boolean;
}

/**
 * Options for the useStorageQuota hook
 */
export interface UseStorageQuotaOptions {
  /** Interval in milliseconds for automatic refresh (0 = disabled) */
  refreshInterval?: number;
  /** Low storage threshold percentage (default: 80) */
  lowThreshold?: number;
  /** Critical storage threshold percentage (default: 95) */
  criticalThreshold?: number;
  /** Callback when storage becomes low */
  onLowStorage?: (quota: StorageQuotaState) => void;
  /** Callback when storage becomes critical */
  onCriticalStorage?: (quota: StorageQuotaState) => void;
}

/**
 * Return type for the useStorageQuota hook
 */
export interface UseStorageQuotaReturn extends StorageQuotaState {
  /** Manually refresh storage quota information */
  refresh: () => Promise<void>;
  /** Request persistent storage from the browser */
  requestPersistence: () => Promise<boolean>;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);

  // Use appropriate decimal places
  if (size >= 100) {
    return `${Math.round(size)} ${units[i]}`;
  } else if (size >= 10) {
    return `${size.toFixed(1)} ${units[i]}`;
  } else {
    return `${size.toFixed(2)} ${units[i]}`;
  }
}

/**
 * Default storage quota state
 */
const defaultQuotaState: StorageQuotaState = {
  used: 0,
  available: 0,
  quota: 0,
  usagePercentage: 0,
  documentCount: 0,
  conversationCount: 0,
  isPersisted: false,
  calculatedAt: new Date(),
  isLoading: true,
  error: null,
  usedFormatted: '0 B',
  availableFormatted: '0 B',
  quotaFormatted: '0 B',
  isLow: false,
  isCritical: false,
};

/**
 * Hook for monitoring browser storage quota and usage
 *
 * @param options - Configuration options
 * @returns Storage quota information and control functions
 *
 * @example
 * ```tsx
 * function StorageIndicator() {
 *   const {
 *     usagePercentage,
 *     usedFormatted,
 *     quotaFormatted,
 *     isLow,
 *     isCritical,
 *     isPersisted,
 *     requestPersistence,
 *   } = useStorageQuota({
 *     refreshInterval: 30000, // Refresh every 30 seconds
 *     onLowStorage: () => console.warn('Storage is running low'),
 *   });
 *
 *   return (
 *     <div className={isCritical ? 'text-red-500' : isLow ? 'text-yellow-500' : ''}>
 *       Storage: {usedFormatted} / {quotaFormatted} ({usagePercentage.toFixed(1)}%)
 *       {!isPersisted && (
 *         <button onClick={requestPersistence}>
 *           Make Persistent
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useStorageQuota(options: UseStorageQuotaOptions = {}): UseStorageQuotaReturn {
  const {
    refreshInterval = 0,
    lowThreshold = 80,
    criticalThreshold = 95,
    onLowStorage,
    onCriticalStorage,
  } = options;

  const [state, setState] = useState<StorageQuotaState>(defaultQuotaState);

  // Track previous state for callbacks
  const prevState = useRef<StorageQuotaState>(defaultQuotaState);

  /**
   * Fetch storage quota information
   */
  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const quota = await db.getStorageUsage();

      const newState: StorageQuotaState = {
        used: quota.used,
        available: quota.available,
        quota: quota.quota,
        usagePercentage: quota.usagePercentage,
        documentCount: quota.documentCount,
        conversationCount: quota.conversationCount,
        isPersisted: quota.isPersisted,
        calculatedAt: quota.calculatedAt,
        isLoading: false,
        error: null,
        usedFormatted: formatBytes(quota.used),
        availableFormatted: formatBytes(quota.available),
        quotaFormatted: formatBytes(quota.quota),
        isLow: quota.usagePercentage >= lowThreshold,
        isCritical: quota.usagePercentage >= criticalThreshold,
      };

      // Trigger callbacks for threshold crossings
      if (newState.isCritical && !prevState.current.isCritical) {
        onCriticalStorage?.(newState);
      } else if (newState.isLow && !prevState.current.isLow) {
        onLowStorage?.(newState);
      }

      prevState.current = newState;
      setState(newState);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to get storage quota';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error,
      }));
    }
  }, [lowThreshold, criticalThreshold, onLowStorage, onCriticalStorage]);

  /**
   * Request persistent storage from the browser
   */
  const requestPersistence = useCallback(async (): Promise<boolean> => {
    try {
      const granted = await db.requestPersistence();
      if (granted) {
        await refresh();
      }
      return granted;
    } catch (err) {
      console.error('Failed to request persistence:', err);
      return false;
    }
  }, [refresh]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const intervalId = setInterval(refresh, refreshInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [refresh, refreshInterval]);

  // Listen for storage events (when other tabs modify storage)
  useEffect(() => {
    const handleStorageChange = () => {
      refresh();
    };

    // The 'storage' event fires when storage is modified in another tab
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refresh]);

  return {
    ...state,
    refresh,
    requestPersistence,
  };
}

/**
 * Hook to get storage quota as a percentage for progress bars
 *
 * @returns Storage usage percentage (0-100)
 *
 * @example
 * ```tsx
 * function StorageBar() {
 *   const percentage = useStoragePercentage();
 *   return <Progress value={percentage} />;
 * }
 * ```
 */
export function useStoragePercentage(): number {
  const result = useStorageQuota();
  return result.usagePercentage;
}

/**
 * Hook to check if storage is available
 * Useful for conditional rendering
 *
 * @returns Whether storage is sufficiently available
 *
 * @example
 * ```tsx
 * function UploadButton() {
 *   const hasStorage = useHasStorageSpace();
 *
 *   if (!hasStorage) {
 *     return <p>Storage is full. Please delete some documents.</p>;
 *   }
 *
 *   return <button>Upload PDF</button>;
 * }
 * ```
 */
export function useHasStorageSpace(minimumAvailable = 50 * 1024 * 1024): boolean {
  const result = useStorageQuota();

  if (result.isLoading) return true; // Optimistic default
  return result.available >= minimumAvailable;
}

/**
 * Format bytes utility exported for use elsewhere
 */
export { formatBytes };

export default useStorageQuota;

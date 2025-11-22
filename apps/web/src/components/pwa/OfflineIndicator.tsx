import { useState, useEffect } from 'react';
import { WifiOff, Wifi, CloudOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/hooks/usePWA';
import { cn } from '@/lib/utils';

/**
 * OfflineIndicator component props
 */
export interface OfflineIndicatorProps {
  /** Additional CSS classes */
  className?: string;
  /** Variant: 'banner' shows full banner, 'badge' shows small indicator */
  variant?: 'banner' | 'badge' | 'toast';
  /** Position for banner/toast variants */
  position?: 'top' | 'bottom';
  /** Whether to show when transitioning back online */
  showOnlineNotification?: boolean;
  /** Duration to show online notification (ms) */
  onlineNotificationDuration?: number;
  /** Whether the banner can be dismissed */
  dismissible?: boolean;
}

/**
 * OfflineIndicator - Shows when the user is offline
 *
 * Displays a notification when the device loses internet connectivity,
 * reassuring users that the app still works for many features.
 *
 * @example
 * ```tsx
 * // Fixed banner at top
 * <OfflineIndicator variant="banner" position="top" />
 *
 * // Small badge in header
 * <OfflineIndicator variant="badge" />
 *
 * // Toast notification
 * <OfflineIndicator variant="toast" showOnlineNotification />
 * ```
 */
export function OfflineIndicator({
  className,
  variant = 'banner',
  position = 'top',
  showOnlineNotification = true,
  onlineNotificationDuration = 3000,
  dismissible = true,
}: OfflineIndicatorProps) {
  const isOnline = useOnlineStatus();
  const [showOnlineToast, setShowOnlineToast] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Track online/offline transitions
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setIsDismissed(false);
    } else if (wasOffline && showOnlineNotification) {
      setShowOnlineToast(true);
      const timer = setTimeout(() => {
        setShowOnlineToast(false);
        setWasOffline(false);
      }, onlineNotificationDuration);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline, showOnlineNotification, onlineNotificationDuration]);

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  // Badge variant - small indicator
  if (variant === 'badge') {
    if (isOnline) return null;

    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200',
          className
        )}
      >
        <WifiOff className="h-3 w-3" />
        Offline
      </div>
    );
  }

  // Toast variant - floating notification
  if (variant === 'toast') {
    const showToast = (!isOnline && !isDismissed) || showOnlineToast;

    if (!showToast) return null;

    return (
      <div
        className={cn(
          'fixed left-4 right-4 z-50 mx-auto max-w-sm',
          position === 'top' ? 'top-4' : 'bottom-4',
          'animate-in',
          position === 'top' ? 'slide-in-from-top' : 'slide-in-from-bottom',
          'duration-300',
          className
        )}
      >
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg border p-3 shadow-lg',
            isOnline
              ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
              : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'
          )}
        >
          {isOnline ? (
            <Wifi className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
          ) : (
            <WifiOff className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          )}
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-sm font-medium',
                isOnline
                  ? 'text-green-800 dark:text-green-200'
                  : 'text-amber-800 dark:text-amber-200'
              )}
            >
              {isOnline ? "You're back online" : "You're offline"}
            </p>
            {!isOnline && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Some features still work
              </p>
            )}
          </div>
          {dismissible && !isOnline && (
            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Banner variant - full width bar
  if (isOnline && !showOnlineToast) return null;
  if (!isOnline && isDismissed) return null;

  return (
    <div
      className={cn(
        'fixed left-0 right-0 z-50',
        position === 'top' ? 'top-0' : 'bottom-0',
        'animate-in',
        position === 'top' ? 'slide-in-from-top' : 'slide-in-from-bottom',
        'duration-300',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center gap-2 px-4 py-2 text-sm',
          isOnline
            ? 'bg-green-500 text-white'
            : 'bg-amber-500 text-white'
        )}
      >
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4" />
            <span>Back online - Your changes will sync automatically</span>
          </>
        ) : (
          <>
            <CloudOff className="h-4 w-4" />
            <span>
              You&apos;re offline - Don&apos;t worry, PDFLover works offline for most features
            </span>
            {dismissible && (
              <Button
                onClick={handleDismiss}
                variant="ghost"
                size="icon"
                className="ml-2 h-6 w-6 text-white hover:bg-amber-600"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Simple hook-based offline status text
 */
export function OfflineStatusText({ className }: { className?: string }) {
  const isOnline = useOnlineStatus();

  return (
    <span
      className={cn(
        'text-sm',
        isOnline ? 'text-green-600' : 'text-amber-600',
        className
      )}
    >
      {isOnline ? 'Online' : 'Offline'}
    </span>
  );
}

export default OfflineIndicator;

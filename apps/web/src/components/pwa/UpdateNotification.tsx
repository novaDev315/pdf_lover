import { useState } from 'react';
import { RefreshCw, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWA } from '@/hooks/usePWA';
import { cn } from '@/lib/utils';

/**
 * UpdateNotification component props
 */
export interface UpdateNotificationProps {
  /** Additional CSS classes */
  className?: string;
  /** Position of the notification */
  position?: 'top' | 'bottom';
  /** Auto-update after specified delay (ms), 0 to disable */
  autoUpdateDelay?: number;
}

/**
 * UpdateNotification - Shows when a new version is available
 *
 * Appears when the service worker detects a new version.
 * Allows users to update immediately or dismiss.
 *
 * @example
 * ```tsx
 * <UpdateNotification position="bottom" />
 * ```
 */
export function UpdateNotification({
  className,
  position = 'bottom',
  autoUpdateDelay = 0,
}: UpdateNotificationProps) {
  const { updateAvailable, updateApp } = usePWA();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Handle auto-update if configured
  useState(() => {
    if (autoUpdateDelay > 0 && updateAvailable) {
      const timer = setTimeout(() => {
        updateApp();
      }, autoUpdateDelay);
      return () => clearTimeout(timer);
    }
  });

  const handleUpdate = () => {
    setIsUpdating(true);
    updateApp();
    // The page will reload, but show loading state just in case
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  if (!updateAvailable || isDismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed left-0 right-0 z-50 p-4',
        position === 'top' ? 'top-0' : 'bottom-0',
        className
      )}
    >
      <div
        className={cn(
          'mx-auto max-w-md rounded-lg border bg-card p-4 shadow-lg dark:bg-surface-900',
          'border-primary-200 dark:border-primary-800',
          'animate-in',
          position === 'top' ? 'slide-in-from-top' : 'slide-in-from-bottom',
          'duration-300'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
            <Sparkles className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-surface-900 dark:text-white">
              Update Available
            </h3>
            <p className="mt-1 text-sm text-surface-600 dark:text-surface-400">
              A new version of PDFLover is ready. Refresh to get the latest features and improvements.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={handleUpdate}
                disabled={isUpdating}
                size="sm"
                className="gap-2"
              >
                <RefreshCw className={cn('h-4 w-4', isUpdating && 'animate-spin')} />
                {isUpdating ? 'Updating...' : 'Refresh Now'}
              </Button>
              <Button
                onClick={handleDismiss}
                variant="ghost"
                size="sm"
              >
                Later
              </Button>
            </div>
          </div>
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Dismiss update notification"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact update button for use in headers/toolbars
 */
export function UpdateButton({ className }: { className?: string }) {
  const { updateAvailable, updateApp } = usePWA();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = () => {
    setIsUpdating(true);
    updateApp();
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <Button
      onClick={handleUpdate}
      disabled={isUpdating}
      variant="outline"
      size="sm"
      className={cn('gap-2 border-primary-500 text-primary-600', className)}
    >
      <RefreshCw className={cn('h-4 w-4', isUpdating && 'animate-spin')} />
      {isUpdating ? 'Updating...' : 'Update'}
    </Button>
  );
}

export default UpdateNotification;

import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWA } from '@/hooks/usePWA';
import { cn } from '@/lib/utils';

/**
 * InstallPrompt component props
 */
export interface InstallPromptProps {
  /** Additional CSS classes */
  className?: string;
  /** Variant: 'banner' shows as a fixed banner, 'inline' shows inline */
  variant?: 'banner' | 'inline' | 'minimal';
  /** Delay before showing the prompt (ms) */
  showDelay?: number;
  /** Storage key for dismissal persistence */
  dismissKey?: string;
  /** Duration to hide after dismissal (ms), 0 for permanent */
  dismissDuration?: number;
}

/**
 * InstallPrompt - Prompts users to install the PWA
 *
 * Appears when the app can be installed (beforeinstallprompt event fired).
 * Respects user dismissal with configurable persistence.
 *
 * @example
 * ```tsx
 * // Banner at bottom of screen
 * <InstallPrompt variant="banner" />
 *
 * // Inline in settings page
 * <InstallPrompt variant="inline" />
 *
 * // Minimal button
 * <InstallPrompt variant="minimal" />
 * ```
 */
export function InstallPrompt({
  className,
  variant = 'banner',
  showDelay = 3000,
  dismissKey = 'pdflover-install-dismissed',
  dismissDuration = 7 * 24 * 60 * 60 * 1000, // 7 days
}: InstallPromptProps) {
  const { canInstall, isInstalled, installApp, dismissInstall } = usePWA();
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Check if prompt was dismissed recently
  useEffect(() => {
    if (!canInstall || isInstalled) {
      setIsVisible(false);
      return;
    }

    // Check dismissal timestamp
    const dismissedAt = localStorage.getItem(dismissKey);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      if (dismissDuration === 0 || Date.now() - dismissedTime < dismissDuration) {
        return;
      }
      // Dismissal expired, remove it
      localStorage.removeItem(dismissKey);
    }

    // Show prompt after delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, showDelay);

    return () => clearTimeout(timer);
  }, [canInstall, isInstalled, showDelay, dismissKey, dismissDuration]);

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      const success = await installApp();
      if (success) {
        setIsVisible(false);
      }
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    dismissInstall();
    localStorage.setItem(dismissKey, Date.now().toString());
  };

  if (!isVisible) {
    return null;
  }

  // Minimal variant - just a button
  if (variant === 'minimal') {
    return (
      <Button
        onClick={handleInstall}
        disabled={isInstalling}
        variant="outline"
        size="sm"
        className={cn('gap-2', className)}
      >
        <Download className="h-4 w-4" />
        {isInstalling ? 'Installing...' : 'Install App'}
      </Button>
    );
  }

  // Inline variant - card style
  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'rounded-lg border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-950',
          className
        )}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
            <Smartphone className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-surface-900 dark:text-white">
              Install PDFLover
            </h3>
            <p className="mt-1 text-sm text-surface-600 dark:text-surface-400">
              Install the app for faster access and offline support for browser-native tools.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={handleInstall}
                disabled={isInstalling}
                size="sm"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {isInstalling ? 'Installing...' : 'Install'}
              </Button>
              <Button
                onClick={handleDismiss}
                variant="ghost"
                size="sm"
              >
                Not now
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Banner variant - fixed at bottom
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 border-t border-surface-200 bg-card p-4 shadow-lg dark:border-surface-800 dark:bg-surface-900',
        'animate-in slide-in-from-bottom duration-300',
        className
      )}
    >
      <div className="mx-auto flex max-w-4xl items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-500">
          <Smartphone className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-surface-900 dark:text-white">
            Install PDFLover
          </h3>
          <p className="text-sm text-surface-600 dark:text-surface-400 truncate">
            Quick access, works offline, and keeps your files private
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            onClick={handleInstall}
            disabled={isInstalling}
            size="sm"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {isInstalling ? 'Installing...' : 'Install'}
          </Button>
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default InstallPrompt;

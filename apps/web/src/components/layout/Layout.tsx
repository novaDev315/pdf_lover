import * as React from 'react'

import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { Toaster } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { selectEffectiveTheme, useSettingsStore } from '@/store/settings-store'

export interface LayoutProps {
  /** Content to render in the main area */
  children: React.ReactNode
  /** Currently active nav item ID */
  activeItem?: string
  /** Callback when a nav item is clicked */
  onNavItemClick?: (itemId: string) => void
  /** Additional CSS classes for the main content area */
  className?: string
}

/**
 * Main layout wrapper combining Header and Sidebar.
 * Handles responsive behavior for mobile and desktop.
 *
 * @example
 * ```tsx
 * <Layout
 *   activeItem="merge"
 *   onNavItemClick={(id) => navigate(`/${id}`)}
 * >
 *   <MergePanel />
 * </Layout>
 * ```
 */
export function Layout({
  children,
  activeItem,
  onNavItemClick,
  className,
}: LayoutProps) {
  const sidebarOpenByDefault = useSettingsStore((state) => state.appearance.sidebarOpen)
  const theme = useSettingsStore(selectEffectiveTheme)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const [sidebarOpen, setSidebarOpen] = React.useState(sidebarOpenByDefault)
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)

  const handleThemeToggle = React.useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme])

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        setSidebarOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  const handleNavItemClick = React.useCallback(
    (itemId: string) => {
      onNavItemClick?.(itemId)
      // Close sidebar on mobile after navigation
      setSidebarOpen(false)
    },
    [onNavItemClick]
  )

  return (
    <div className="min-h-screen bg-background">
      <Header
        theme={theme}
        onThemeToggle={handleThemeToggle}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        activeItem={activeItem}
        onNavItemClick={handleNavItemClick}
      />

      <main
        className={cn(
          'pt-14 transition-all duration-300',
          sidebarCollapsed ? 'md:pl-16' : 'md:pl-64',
          className
        )}
      >
        <div className="min-h-[calc(100vh-3.5rem)] p-4 md:p-6">{children}</div>
      </main>

      <Toaster />
    </div>
  )
}

export default Layout

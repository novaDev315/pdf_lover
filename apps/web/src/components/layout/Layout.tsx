import * as React from 'react'

import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { Toaster } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'

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
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light')

  // Initialize theme from localStorage or system preference
  React.useEffect(() => {
    const stored = localStorage.getItem('pdflover-theme')
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored)
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark')
    }
  }, [])

  // Apply theme to document
  React.useEffect(() => {
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(theme)
    localStorage.setItem('pdflover-theme', theme)
  }, [theme])

  const handleThemeToggle = React.useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
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

import * as React from 'react'
import {
  FileText,
  Scissors,
  Combine,
  ImageIcon,
  Minimize2,
  Lock,
  MessageSquare,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface NavItem {
  /** Unique identifier for the nav item */
  id: string
  /** Display label */
  label: string
  /** Icon component */
  icon: React.ReactNode
  /** Optional badge text (e.g., "New") */
  badge?: string
  /** Whether this item is disabled */
  disabled?: boolean
}

const defaultNavItems: NavItem[] = [
  { id: 'files', label: 'My Files', icon: <FolderOpen className="h-5 w-5" /> },
  { id: 'viewer', label: 'PDF Viewer', icon: <FileText className="h-5 w-5" /> },
  { id: 'merge', label: 'Merge PDFs', icon: <Combine className="h-5 w-5" /> },
  { id: 'split', label: 'Split PDF', icon: <Scissors className="h-5 w-5" /> },
  { id: 'convert', label: 'Convert', icon: <ImageIcon className="h-5 w-5" /> },
  { id: 'compress', label: 'Compress', icon: <Minimize2 className="h-5 w-5" /> },
  { id: 'security', label: 'Security', icon: <Lock className="h-5 w-5" /> },
  {
    id: 'chat',
    label: 'AI Chat',
    icon: <MessageSquare className="h-5 w-5" />,
    badge: 'Beta',
  },
]

export interface SidebarProps {
  /** Whether the sidebar is open (for mobile) */
  open?: boolean
  /** Callback to close the sidebar */
  onClose?: () => void
  /** Whether the sidebar is collapsed (for desktop) */
  collapsed?: boolean
  /** Callback to toggle collapse state */
  onCollapsedChange?: (collapsed: boolean) => void
  /** Currently active nav item ID */
  activeItem?: string
  /** Callback when a nav item is clicked */
  onNavItemClick?: (itemId: string) => void
  /** Custom nav items (uses defaults if not provided) */
  navItems?: NavItem[]
  /** Additional CSS classes */
  className?: string
}

/**
 * Sidebar navigation component with collapsible functionality.
 * Shows navigation links to different PDF tools.
 *
 * @example
 * ```tsx
 * <Sidebar
 *   open={sidebarOpen}
 *   onClose={() => setSidebarOpen(false)}
 *   collapsed={collapsed}
 *   onCollapsedChange={setCollapsed}
 *   activeItem="merge"
 *   onNavItemClick={(id) => navigate(`/${id}`)}
 * />
 * ```
 */
export function Sidebar({
  open = true,
  onClose,
  collapsed = false,
  onCollapsedChange,
  activeItem,
  onNavItemClick,
  navItems = defaultNavItems,
  className,
}: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] border-r bg-background transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          className
        )}
      >
        <div className="flex h-full flex-col">
          {/* Navigation items */}
          <nav className="flex-1 overflow-y-auto p-2">
            <TooltipProvider delayDuration={0}>
              <ul className="space-y-1">
                {navItems.map((item) => (
                  <li key={item.id}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={activeItem === item.id ? 'secondary' : 'ghost'}
                            size="icon"
                            className="w-full"
                            disabled={item.disabled}
                            onClick={() => onNavItemClick?.(item.id)}
                            aria-label={item.label}
                          >
                            {item.icon}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>
                            {item.label}
                            {item.badge && (
                              <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                                {item.badge}
                              </span>
                            )}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        variant={activeItem === item.id ? 'secondary' : 'ghost'}
                        className="w-full justify-start gap-3"
                        disabled={item.disabled}
                        onClick={() => onNavItemClick?.(item.id)}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                        {item.badge && (
                          <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                            {item.badge}
                          </span>
                        )}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </TooltipProvider>
          </nav>

          {/* Collapse toggle (desktop only) */}
          <div className="hidden border-t p-2 md:block">
            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'default'}
              className={cn('w-full', !collapsed && 'justify-start gap-3')}
              onClick={() => onCollapsedChange?.(!collapsed)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <>
                  <ChevronLeft className="h-5 w-5" />
                  <span>Collapse</span>
                </>
              )}
            </Button>
          </div>

          {/* Privacy notice */}
          {!collapsed && (
            <div className="border-t p-4">
              <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950">
                <p className="text-xs text-green-700 dark:text-green-300">
                  <strong>100% Private</strong>
                  <br />
                  All processing happens locally in your browser. Your files
                  never leave your device.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

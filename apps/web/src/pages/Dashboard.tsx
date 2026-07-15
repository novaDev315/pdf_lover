/**
 * Dashboard - Main dashboard with recent files and tool shortcuts
 */

import * as React from 'react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import {
  Heart,
  Settings,
  Merge,
  Split,
  Minimize2,
  FileOutput,
  MessageSquare,
  FileText,
  Clock,
  Star,
  Trash2,
  MoreVertical,
  FolderOpen,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFileStore, selectFilteredFiles } from '@/store/file-store'
import { formatFileSize, truncateFilename } from '@/lib/utils'
import { db } from '@/lib/storage'

/**
 * Tool card configuration
 */
interface ToolConfig {
  name: string
  description: string
  icon: React.ElementType
  path: string
  color: string
  bgColor: string
}

const TOOLS: ToolConfig[] = [
  {
    name: 'Merge PDF',
    description: 'Combine multiple PDFs into one',
    icon: Merge,
    path: '/merge',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500',
  },
  {
    name: 'Split PDF',
    description: 'Extract or split pages',
    icon: Split,
    path: '/split',
    color: 'text-green-500',
    bgColor: 'bg-green-500',
  },
  {
    name: 'Compress PDF',
    description: 'Reduce file size',
    icon: Minimize2,
    path: '/compress',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500',
  },
  {
    name: 'Convert PDF',
    description: 'Convert to images or text',
    icon: FileOutput,
    path: '/convert',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500',
  },
  {
    name: 'AI Chat',
    description: 'Chat with your PDFs',
    icon: MessageSquare,
    path: '/chat',
    color: 'text-pink-500',
    bgColor: 'bg-pink-500',
  },
]

/**
 * Tool card component
 */
function ToolCard({ tool }: { tool: ToolConfig }) {
  return (
    <Link
      to={tool.path}
      className="group block"
    >
      <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`flex-shrink-0 w-12 h-12 rounded-lg ${tool.bgColor} text-white flex items-center justify-center group-hover:scale-110 transition-transform`}
            >
              <tool.icon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-surface-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {tool.name}
              </h3>
              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                {tool.description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

/**
 * Recent file item component
 */
interface RecentFileItemProps {
  file: {
    id: string
    filename: string
    fileSize: number
    updatedAt: Date
    isFavorite?: boolean
  }
  onToggleFavorite: (id: string) => void
  onDelete: (id: string) => void
}

function RecentFileItem({ file, onToggleFavorite, onDelete }: RecentFileItemProps) {
  const timeAgo = React.useMemo(() => {
    const now = new Date()
    const updated = new Date(file.updatedAt)
    const diffMs = now.getTime() - updated.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return updated.toLocaleDateString()
  }, [file.updatedAt])

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors group">
      <div className="flex-shrink-0 w-10 h-12 bg-surface-100 dark:bg-surface-700 rounded flex items-center justify-center">
        <FileText className="h-5 w-5 text-surface-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
          {truncateFilename(file.filename, 35)}
        </p>
        <div className="flex items-center gap-2 text-xs text-surface-500 dark:text-surface-400">
          <span>{formatFileSize(file.fileSize)}</span>
          <span>-</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.preventDefault()
            onToggleFavorite(file.id)
          }}
        >
          <Star
            className={`h-4 w-4 ${
              file.isFavorite
                ? 'text-yellow-500 fill-yellow-500'
                : 'text-surface-400'
            }`}
          />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onToggleFavorite(file.id)}>
              <Star className="h-4 w-4 mr-2" />
              {file.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(file.id)}
              className="text-red-600 dark:text-red-400"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

/**
 * Dashboard page component
 *
 * Features:
 * - Tool shortcuts grid
 * - Recent files list
 * - Quick access to favorites
 * - Privacy-first messaging
 */
export function Dashboard() {
  const files = useFileStore(useShallow(selectFilteredFiles))
  const { toggleFavorite, removeFile } = useFileStore()

  const handleToggleFavorite = React.useCallback(async (id: string) => {
    const file = useFileStore.getState().files.find((candidate) => candidate.id === id)
    if (!file) return
    await db.updateDocument(id, { isFavorite: !file.isFavorite })
    toggleFavorite(id)
  }, [toggleFavorite])

  const handleDelete = React.useCallback(async (id: string) => {
    await db.deleteDocument(id)
    removeFile(id)
  }, [removeFile])

  // Get recent files (last 5)
  const recentFiles = React.useMemo(() => {
    return [...files]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
  }, [files])

  // Get favorite files
  const favoriteFiles = React.useMemo(() => {
    return files.filter((f) => f.isFavorite).slice(0, 5)
  }, [files])

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <header className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Heart className="h-8 w-8 text-primary-500" fill="currentColor" />
              <span className="text-xl font-bold text-surface-900 dark:text-white">
                PDFLover
              </span>
            </div>
            <nav className="flex items-center gap-2">
              <Button variant="ghost" asChild>
                <Link to="/files">
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Library
                </Link>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <Link to="/settings">
                  <Settings className="h-5 w-5" />
                </Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
            Welcome to PDFLover
          </h1>
          <p className="text-surface-600 dark:text-surface-400">
            Your privacy-first PDF workspace. Browser-safe tools stay local; server tools ask before upload.
          </p>
        </div>

        {/* Privacy Badge */}
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Local by default - server processing requires explicit consent
        </div>

        {/* Tools Grid */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-4">
            PDF Tools
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {TOOLS.map((tool) => (
              <ToolCard key={tool.path} tool={tool} />
            ))}
          </div>
        </section>

        {/* Recent Files & Favorites */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Files */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5 text-surface-400" />
                    Recent Files
                  </CardTitle>
                  <CardDescription>
                    Your recently accessed documents
                  </CardDescription>
                </div>
                {files.length > 0 && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/files">
                      View all
                    </Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {recentFiles.length > 0 ? (
                <div className="space-y-1">
                  {recentFiles.map((file) => (
                    <RecentFileItem
                      key={file.id}
                      file={file}
                    onToggleFavorite={(id) => void handleToggleFavorite(id)}
                    onDelete={(id) => void handleDelete(id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <FolderOpen className="h-12 w-12 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    No recent files
                  </p>
                  <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                    Start by using one of the tools above
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Favorites */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    Favorites
                  </CardTitle>
                  <CardDescription>
                    Your starred documents
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {favoriteFiles.length > 0 ? (
                <div className="space-y-1">
                  {favoriteFiles.map((file) => (
                    <RecentFileItem
                      key={file.id}
                      file={file}
                    onToggleFavorite={(id) => void handleToggleFavorite(id)}
                    onDelete={(id) => void handleDelete(id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Star className="h-12 w-12 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    No favorite files yet
                  </p>
                  <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                    Star files to add them here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Features Section */}
        <section className="mt-12 py-12 border-t border-surface-200 dark:border-surface-800">
          <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-8 text-center">
            Why Choose PDFLover?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 mb-4">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-surface-900 dark:text-white mb-2">
                Privacy First
              </h3>
              <p className="text-sm text-surface-600 dark:text-surface-400">
                Browser-native tools stay on your device. Server-required tools explain the upload and use temporary jobs. No analytics tracking.
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 mb-4">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-surface-900 dark:text-white mb-2">
                Lightning Fast
              </h3>
              <p className="text-sm text-surface-600 dark:text-surface-400">
                Local tools avoid upload waits; bounded server jobs handle operations browsers cannot perform safely.
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 mb-4">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-surface-900 dark:text-white mb-2">
                Works Offline
              </h3>
              <p className="text-sm text-surface-600 dark:text-surface-400">
                The app shell and local tools work offline. Backend operations report clearly when a connection is required.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-6 px-4 sm:px-6 lg:px-8 border-t border-surface-200 dark:border-surface-800">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-surface-500 dark:text-surface-500">
            PDFLover - Your privacy-first PDF processing tool
          </p>
        </div>
      </footer>
    </div>
  )
}

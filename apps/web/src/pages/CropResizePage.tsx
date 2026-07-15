/**
 * CropResizePage - Full page for crop, resize, and trim margin operations
 * Provides tabbed interface for different page transformation tools
 */

import * as React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Heart, Crop, Maximize, Scissors } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CropPanel } from '@/components/tools/CropPanel'
import { ResizePanel } from '@/components/tools/ResizePanel'
import { TrimMarginsPanel } from '@/components/tools/TrimMarginsPanel'

/**
 * Tab configuration
 */
interface TabConfig {
  id: string
  label: string
  icon: React.ReactNode
  description: string
}

const TABS: TabConfig[] = [
  {
    id: 'crop',
    label: 'Crop',
    icon: <Crop className="h-4 w-4" />,
    description: 'Crop pages to a specific area',
  },
  {
    id: 'resize',
    label: 'Resize',
    icon: <Maximize className="h-4 w-4" />,
    description: 'Change page dimensions',
  },
  {
    id: 'trim',
    label: 'Trim Margins',
    icon: <Scissors className="h-4 w-4" />,
    description: 'Remove white margins',
  },
]

/**
 * CropResizePage component
 *
 * Provides the full page layout for page transformation tools:
 * - Crop: Visual crop box editor
 * - Resize: Preset and custom page sizes
 * - Trim Margins: Auto-detect and remove whitespace
 */
export function CropResizePage() {
  const [activeTab, setActiveTab] = React.useState('crop')

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <header className="bg-card dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <Heart className="h-6 w-6 text-primary-500" fill="currentColor" />
                <span className="text-lg font-bold text-surface-900 dark:text-white">
                  PDFLover
                </span>
              </div>
            </div>
            <nav className="flex items-center gap-2 text-sm text-surface-500">
              <Link to="/" className="hover:text-surface-700 dark:hover:text-surface-300">
                Home
              </Link>
              <span>/</span>
              <span className="text-surface-900 dark:text-white font-medium">
                Crop & Resize
              </span>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
            Crop & Resize PDF Pages
          </h1>
          <p className="text-surface-600 dark:text-surface-400">
            Transform your PDF pages by cropping, resizing, or trimming margins.
            All processing happens locally in your browser.
          </p>
        </div>

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2 py-3 data-[state=active]:bg-white dark:data-[state=active]:bg-surface-800"
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="crop" className="mt-6">
            <CropPanel />
          </TabsContent>

          <TabsContent value="resize" className="mt-6">
            <ResizePanel />
          </TabsContent>

          <TabsContent value="trim" className="mt-6">
            <TrimMarginsPanel />
          </TabsContent>
        </Tabs>

        {/* Tips Section */}
        <div className="mt-8 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Tips for page transformations
          </h2>
          <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
            {activeTab === 'crop' && (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">-</span>
                  Use percentage-based cropping for consistent results across different page sizes
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">-</span>
                  CropBox is the most commonly used box type for viewing purposes
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">-</span>
                  MediaBox defines the physical page size; CropBox defines the visible area
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">-</span>
                  TrimBox and BleedBox are used primarily for professional printing
                </li>
              </>
            )}
            {activeTab === 'resize' && (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">-</span>
                  A4 is the standard page size for most documents outside North America
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">-</span>
                  Letter size (8.5 x 11 inches) is standard in North America
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">-</span>
                  Enable "Scale content" to automatically fit content to the new page size
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">-</span>
                  Use "Center content" to place content in the middle of the new page
                </li>
              </>
            )}
            {activeTab === 'trim' && (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">-</span>
                  Trim margins is useful for removing unnecessary whitespace from scanned documents
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">-</span>
                  Lower threshold values will trim more aggressively
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">-</span>
                  Add padding after trimming to maintain some margin around content
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-500">-</span>
                  Test on a single page first before applying to all pages
                </li>
              </>
            )}
          </ul>
        </div>

        {/* Feature Comparison */}
        <div className="mt-6 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            When to use each tool
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Crop className="h-5 w-5 text-blue-500" />
                <h3 className="font-medium text-surface-900 dark:text-white">Crop</h3>
              </div>
              <p className="text-sm text-surface-600 dark:text-surface-400">
                Best for removing specific areas from pages, like headers, footers, or margins with content.
              </p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Maximize className="h-5 w-5 text-green-500" />
                <h3 className="font-medium text-surface-900 dark:text-white">Resize</h3>
              </div>
              <p className="text-sm text-surface-600 dark:text-surface-400">
                Best for changing the page format, like converting Letter to A4 or making pages larger/smaller.
              </p>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Scissors className="h-5 w-5 text-purple-500" />
                <h3 className="font-medium text-surface-900 dark:text-white">Trim</h3>
              </div>
              <p className="text-sm text-surface-600 dark:text-surface-400">
                Best for removing white margins automatically, especially from scanned or imported documents.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

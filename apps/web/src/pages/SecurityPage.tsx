/**
 * SecurityPage - Page wrapper for the PDF security tools
 */

import { Link } from 'react-router-dom'
import { ArrowLeft, Heart } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SecurityPanel } from '@/components/tools/SecurityPanel'

/**
 * Security tools page component
 * Provides the full page layout for PDF encryption/decryption
 */
export function SecurityPage() {
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
              <span className="text-surface-900 dark:text-white font-medium">Protect PDF</span>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
            Protect PDF
          </h1>
          <p className="text-surface-600 dark:text-surface-400">
            Encrypt your PDF with password protection or remove existing passwords.
            Set permissions to control printing, copying, and editing.
            Encryption and password removal use an explicit temporary backend job.
          </p>
        </div>

        <SecurityPanel />

        {/* Tips Section */}
        <div className="mt-8 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            About PDF Protection
          </h2>
          <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <strong>User Password:</strong> Required to open the document. Leave empty if no password should be required to view.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <strong>Owner Password:</strong> Required to change permissions or remove protection.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <strong>256-bit AES:</strong> Maximum security encryption, recommended for sensitive documents.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Encryption uploads only after you start the operation; temporary inputs are deleted after processing and outputs after download or TTL.
            </li>
          </ul>
        </div>
      </main>
    </div>
  )
}

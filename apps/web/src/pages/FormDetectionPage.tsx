/**
 * FormDetectionPage - Full page for PDF form field detection
 *
 * Provides a complete interface for detecting and creating fillable PDF forms
 * with field editing, visual overlays, and export capabilities.
 */

import { Link } from 'react-router-dom'
import { ArrowLeft, Heart, FileSearch, Lightbulb, AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FormDetectionPanel } from '@/components/smart/FormDetectionPanel'

/**
 * Form detection page component
 * Full page layout for PDF form field detection and fillable form creation
 */
export function FormDetectionPage() {
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
                Form Detection
              </span>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2 flex items-center gap-3">
            <FileSearch className="h-8 w-8 text-primary-500" />
            Form Field Detection
          </h1>
          <p className="text-surface-600 dark:text-surface-400">
            Automatically detect form fields in PDF documents and convert them to fillable forms.
            Our smart detection identifies text fields, checkboxes, signature areas, dates, and more.
          </p>
        </div>

        {/* Main Panel */}
        <FormDetectionPanel />

        {/* How It Works Section */}
        <div className="mt-8 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
                1
              </div>
              <h3 className="font-medium text-surface-900 dark:text-white">Upload PDF</h3>
              <p className="text-sm text-surface-600 dark:text-surface-400">
                Upload any PDF document containing forms, applications, or questionnaires.
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
                2
              </div>
              <h3 className="font-medium text-surface-900 dark:text-white">Auto-Detect Fields</h3>
              <p className="text-sm text-surface-600 dark:text-surface-400">
                Our smart algorithm analyzes the document and identifies form fields automatically.
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
                3
              </div>
              <h3 className="font-medium text-surface-900 dark:text-white">Create Fillable PDF</h3>
              <p className="text-sm text-surface-600 dark:text-surface-400">
                Export your document as a fillable PDF that can be completed in any PDF viewer.
              </p>
            </div>
          </div>
        </div>

        {/* Field Types Section */}
        <div className="mt-6 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Supported Field Types
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <p className="font-medium text-blue-700 dark:text-blue-300">Text Fields</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Name, address, etc.
              </p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <p className="font-medium text-green-700 dark:text-green-300">Checkboxes</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Yes/No, agree, etc.
              </p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <p className="font-medium text-red-700 dark:text-red-300">Signatures</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Sign here areas
              </p>
            </div>
            <div className="p-3 bg-cyan-50 dark:bg-cyan-950/20 rounded-lg">
              <p className="font-medium text-cyan-700 dark:text-cyan-300">Dates</p>
              <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">
                Date of birth, etc.
              </p>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg">
              <p className="font-medium text-indigo-700 dark:text-indigo-300">Email</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                Email address fields
              </p>
            </div>
            <div className="p-3 bg-pink-50 dark:bg-pink-950/20 rounded-lg">
              <p className="font-medium text-pink-700 dark:text-pink-300">Phone</p>
              <p className="text-xs text-pink-600 dark:text-pink-400 mt-1">
                Phone number fields
              </p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
              <p className="font-medium text-amber-700 dark:text-amber-300">Numbers</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Amount, quantity, etc.
              </p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
              <p className="font-medium text-purple-700 dark:text-purple-300">Radio Buttons</p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                Multiple choice options
              </p>
            </div>
          </div>
        </div>

        {/* Tips Section */}
        <div className="mt-6 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Tips for Best Results
          </h2>
          <ul className="space-y-3 text-sm text-surface-600 dark:text-surface-400">
            <li className="flex items-start gap-2">
              <span className="text-primary-500 mt-0.5">-</span>
              <span>
                <strong>Clear documents:</strong> PDFs with clear, well-defined form fields work best.
                Scanned documents may require OCR preprocessing.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500 mt-0.5">-</span>
              <span>
                <strong>Adjust sensitivity:</strong> If too few fields are detected, increase sensitivity.
                If too many false positives appear, decrease it.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500 mt-0.5">-</span>
              <span>
                <strong>Manual refinement:</strong> After detection, you can edit field types, positions,
                and properties before creating the fillable PDF.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500 mt-0.5">-</span>
              <span>
                <strong>Standard layouts:</strong> Forms with standard layouts (labels followed by
                underlines or boxes) are detected most reliably.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500 mt-0.5">-</span>
              <span>
                <strong>Privacy first:</strong> Your files never leave your browser - all processing
                happens locally on your device.
              </span>
            </li>
          </ul>
        </div>

        {/* Limitations Notice */}
        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Detection Limitations
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Automatic detection works best with standard form layouts. Complex or
                highly stylized forms may require manual field placement. Detection
                accuracy varies based on document quality and structure.
              </p>
            </div>
          </div>
        </div>

        {/* Use Cases Section */}
        <div className="mt-6 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Common Use Cases
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary-500 mt-2" />
              <div>
                <p className="font-medium text-surface-900 dark:text-white">Job Applications</p>
                <p className="text-sm text-surface-600 dark:text-surface-400">
                  Convert static application forms to fillable PDFs for easy completion.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary-500 mt-2" />
              <div>
                <p className="font-medium text-surface-900 dark:text-white">Legal Documents</p>
                <p className="text-sm text-surface-600 dark:text-surface-400">
                  Transform contracts and agreements into forms that can be digitally filled.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary-500 mt-2" />
              <div>
                <p className="font-medium text-surface-900 dark:text-white">Surveys & Questionnaires</p>
                <p className="text-sm text-surface-600 dark:text-surface-400">
                  Make surveys fillable for digital distribution and easy data collection.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary-500 mt-2" />
              <div>
                <p className="font-medium text-surface-900 dark:text-white">Government Forms</p>
                <p className="text-sm text-surface-600 dark:text-surface-400">
                  Digitize tax forms, permits, and official documents for easier completion.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

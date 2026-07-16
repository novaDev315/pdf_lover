/**
 * SignaturePage - Page wrapper for the PDF signature tools
 */

import { SignaturePanel } from '@/components/tools/SignaturePanel'
import { DigitalSignaturePanel } from '@/components/tools/DigitalSignaturePanel'

/**
 * Signature tools page component
 * Provides the full page layout for signing PDFs
 */
export function SignaturePage() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
            Sign PDF
          </h1>
          <p className="text-surface-600 dark:text-surface-400">
            Add a local visual stamp or create a certificate-backed signature through an explicit temporary backend job.
          </p>
        </div>

        <SignaturePanel />

        <div className="mt-8">
          <DigitalSignaturePanel />
        </div>

        {/* Tips Section */}
        <div className="mt-8 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Tips for Visual Signatures
          </h2>
          <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <strong>Drawn Signatures:</strong> Use a mouse or stylus for best results. Draw slowly for a cleaner signature.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <strong>Typed Signatures:</strong> The signature will be rendered in a script-like font automatically.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <strong>Image Signatures:</strong> PNG images with transparent backgrounds work best for a natural look.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <strong>Placement:</strong> The signature is placed at the bottom of the specified page by default.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Your files and signatures never leave your device - all processing is done locally.
            </li>
          </ul>
        </div>

        {/* Signature distinction */}
        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Important:</strong> Drawn, typed, and image signatures are visual stamps only. Use the separate certificate-backed section for a cryptographic PDF signature.
          </p>
        </div>
      </main>
    </div>
  )
}

import { describe, expect, it } from 'vitest'

import { validateBatchOperation } from '@/lib/batch-validation'

describe('validateBatchOperation', () => {
  it.each([
    ['maximum compression', 'compress', { level: 'maximum' }],
    ['Office conversion', 'convert', { format: 'docx' }],
    ['server OCR', 'ocr', { language: 'eng', enhanceScans: false, engine: 'server' }],
  ] as const)('requires explicit upload consent for %s', (_label, type, options) => {
    expect(validateBatchOperation(type, options)).toMatchObject({
      title: 'Upload consent required',
    })
  })

  it('accepts server work after consent is recorded', () => {
    expect(validateBatchOperation('compress', { level: 'maximum', serverConsent: true })).toBeNull()
    expect(validateBatchOperation('convert', { format: 'xlsx', serverConsent: true })).toBeNull()
  })

  it('requires an owner password for encryption', () => {
    expect(validateBatchOperation('security', { userPassword: 'reader' })).toMatchObject({
      title: 'Owner password required',
    })
  })

  it('requires upload consent for encryption after a password is set', () => {
    expect(validateBatchOperation('security', { ownerPassword: 'owner-secret' })).toMatchObject({
      title: 'Upload consent required',
    })
  })

  it('rejects no-op or incomplete local batch operations', () => {
    expect(validateBatchOperation('crop', {
      cropMode: 'percentage',
      boxType: 'CropBox',
      cropPercent: { left: 0, right: 0, top: 0, bottom: 0 },
    })).toMatchObject({ title: 'Crop values required' })
    expect(validateBatchOperation('split', { mode: 'range', ranges: ' ' })).toMatchObject({ title: 'Page range required' })
    expect(validateBatchOperation('watermark', {
      text: ' ', position: 'center', opacity: 0.3, fontSize: 48, color: '#888888', rotation: 0,
    })).toMatchObject({ title: 'Watermark text required' })
  })
})

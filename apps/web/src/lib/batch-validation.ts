import type {
  BatchOperationOptions,
  BatchOperationType,
  CompressOptions,
  ConvertOptions,
  CropOptions,
  OCROptions,
  SecurityOptions,
  SplitOptions,
  WatermarkOptions,
} from '@/store/batch-store'

export interface BatchValidationError {
  title: string
  description: string
}

export function validateBatchOperation(
  type: BatchOperationType,
  options: BatchOperationOptions,
): BatchValidationError | null {
  if (type === 'security' && !(options as SecurityOptions).ownerPassword?.trim()) {
    return {
      title: 'Owner password required',
      description: 'Set a distinct owner password before adding encryption to the queue',
    }
  }
  if (
    type === 'security' &&
    (options as SecurityOptions).userPassword &&
    (options as SecurityOptions).userPassword === (options as SecurityOptions).ownerPassword
  ) {
    return {
      title: 'Passwords must be different',
      description: 'Use a distinct owner password so document permissions remain recoverable',
    }
  }
  if (type === 'watermark' && !(options as WatermarkOptions).text.trim()) {
    return { title: 'Watermark text required', description: 'Enter text before adding this watermark operation' }
  }
  if (type === 'split' && (options as SplitOptions).mode === 'range' && !(options as SplitOptions).ranges?.trim()) {
    return { title: 'Page range required', description: 'Enter at least one page or range to split' }
  }
  if (type === 'crop') {
    const crop = options as CropOptions
    const hasPercentageCrop = crop.cropMode === 'percentage' && crop.cropPercent
      ? Object.values(crop.cropPercent).some((value) => value > 0)
      : false
    const hasAbsoluteCrop = crop.cropMode === 'absolute' && crop.cropBox
      ? crop.cropBox.width > 0 && crop.cropBox.height > 0
      : false
    if (!hasPercentageCrop && !hasAbsoluteCrop) {
      return { title: 'Crop values required', description: 'Set at least one page edge or a valid crop box' }
    }
  }

  const requiresServerConsent =
    (type === 'compress' && (options as CompressOptions).level === 'maximum') ||
    (type === 'convert' && ['docx', 'xlsx', 'pptx'].includes((options as ConvertOptions).format)) ||
    (type === 'ocr' && (options as OCROptions).engine === 'server') ||
    type === 'security'

  if (requiresServerConsent && !('serverConsent' in options && options.serverConsent === true)) {
    return {
      title: 'Upload consent required',
      description: 'Confirm temporary backend processing before adding this operation to the queue',
    }
  }

  return null
}

/**
 * Shared contracts for work that crosses the browser/backend boundary.
 *
 * Browser-only operations keep using their focused pdf-core option types. These
 * types describe temporary server jobs and are intentionally serializable.
 */

export type OperationEngine = 'local' | 'server' | 'hybrid';

export type OperationStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'expired';

export type ServerOperationKind =
  | 'pdf.encrypt'
  | 'pdf.decrypt'
  | 'pdf.secure-redact'
  | 'pdf.digital-sign'
  | 'pdf.ocr'
  | 'pdf.convert.docx'
  | 'pdf.convert.xlsx'
  | 'pdf.convert.pptx'
  | 'pdf.compress.lossy';

export type OperationErrorCode =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FILE_TOO_LARGE'
  | 'INVALID_PDF'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'OPERATION_UNAVAILABLE'
  | 'ENGINE_UNAVAILABLE'
  | 'JOB_CANCELLED'
  | 'JOB_EXPIRED'
  | 'PROCESSING_TIMEOUT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR';

export interface OperationError {
  code: OperationErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export interface OperationProgress {
  percentage: number;
  stage: string;
  currentItem?: number;
  totalItems?: number;
}

export interface OperationArtifact {
  id: string;
  filename: string;
  mediaType: string;
  size: number;
  sha256: string;
  createdAt: string;
}

export interface OperationJob {
  id: string;
  operation: ServerOperationKind;
  status: OperationStatus;
  progress: OperationProgress;
  artifacts: OperationArtifact[];
  error?: OperationError;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface EngineCapability {
  id:
    | 'qpdf'
    | 'python'
    | 'pillow'
    | 'python-docx'
    | 'openpyxl'
    | 'python-pptx'
    | 'pyhanko'
    | 'tesseract'
    | 'poppler';
  available: boolean;
  required: boolean;
  version?: string;
  reason?: string;
}

export interface ApiCapabilities {
  serviceVersion: string;
  maxUploadBytes: number;
  artifactTtlSeconds: number;
  engines: EngineCapability[];
  operations: Array<{
    kind: ServerOperationKind;
    engine: OperationEngine;
    available: boolean;
    unavailableReason?: string;
  }>;
  ai: {
    openRouterConfigured: boolean;
  };
}

export interface ApiErrorResponse {
  error: OperationError & {
    requestId: string;
  };
}

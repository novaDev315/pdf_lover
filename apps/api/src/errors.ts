import type { OperationErrorCode } from '@pdflover/shared';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: OperationErrorCode;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(options: {
    statusCode: number;
    code: OperationErrorCode;
    message: string;
    retryable?: boolean;
    details?: Record<string, unknown>;
  }) {
    super(options.message);
    this.name = 'ApiError';
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

export function notFound(resource: 'job' | 'artifact'): ApiError {
  return new ApiError({
    statusCode: 404,
    code: 'NOT_FOUND',
    message: `${resource[0]?.toUpperCase()}${resource.slice(1)} not found`,
  });
}

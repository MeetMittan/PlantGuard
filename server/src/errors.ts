export type ServerErrorCode =
  | 'AI_NOT_CONFIGURED'
  | 'AI_QUOTA_EXCEEDED'
  | 'AI_TIMEOUT'
  | 'AI_RATE_LIMITED'
  | 'AI_PROVIDER_ERROR'
  | 'AI_SERVICE_UNAVAILABLE'
  | 'AI_MALFORMED_RESPONSE'
  | 'INVALID_IMAGE'
  | 'IMAGE_TOO_LARGE'
  | 'IMAGE_TOO_SMALL'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_SERVER_ERROR';

export interface ServerErrorResponse {
  success: false;
  error: {
    code: ServerErrorCode;
    message: string;
    status: number;
    details?: unknown;
  };
}

export class AppServerError extends Error {
  constructor(
    public readonly code: ServerErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppServerError';
  }

  static badRequest(message: string, details?: unknown) {
    return new AppServerError('BAD_REQUEST', message, 400, details);
  }

  static unauthorized(message = 'Authentication required', details?: unknown) {
    return new AppServerError('UNAUTHORIZED', message, 401, details);
  }

  static forbidden(message = 'Access denied', details?: unknown) {
    return new AppServerError('FORBIDDEN', message, 403, details);
  }

  static notFound(message = 'Resource not found', details?: unknown) {
    return new AppServerError('NOT_FOUND', message, 404, details);
  }

  static conflict(message: string, details?: unknown) {
    return new AppServerError('CONFLICT', message, 409, details);
  }

  static validation(message = 'Validation failed', details?: unknown) {
    return new AppServerError('VALIDATION_ERROR', message, 422, details);
  }
}

import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Error codes from docs/API.md §0. */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'CAPTCHA_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'EMAIL_NOT_VERIFIED'
  | 'NOT_ENROLLED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS_RULE'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export type ErrorDetail = { path: string; message: string };

const STATUS: Record<ErrorCode, ContentfulStatusCode> = {
  VALIDATION_ERROR: 400,
  CAPTCHA_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  EMAIL_NOT_VERIFIED: 403,
  NOT_ENROLLED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  BUSINESS_RULE: 422,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

/** An expected error that is safe to show to the client. Anything else becomes INTERNAL_ERROR. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: ContentfulStatusCode;
  readonly details: ErrorDetail[];
  readonly headers: Record<string, string>;

  constructor(
    code: ErrorCode,
    message: string,
    options: { details?: ErrorDetail[]; headers?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.details = options.details ?? [];
    this.headers = options.headers ?? {};
  }
}

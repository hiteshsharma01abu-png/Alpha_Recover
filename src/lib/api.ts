/**
 * Typed client for the Alpha Recover API (docs/API.md). Same origin, cookie session.
 * Not used by any page yet — forms switch over to it phase by phase.
 */

export type ApiErrorDetail = { path: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = [], requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

type Envelope<T> = { data: T; meta?: Record<string, unknown> };

const BASE = '/api/v1';

async function request<T>(method: string, path: string, body?: unknown): Promise<Envelope<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        // Required on mutations by the API's CSRF guard
        'X-Requested-With': 'fetch',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error. Check your connection and try again.');
  }

  const json = (await res.json().catch(() => null)) as
    | (Envelope<T> & { error?: never })
    | { error: { code: string; message: string; details?: ApiErrorDetail[]; requestId?: string } }
    | null;

  if (!res.ok || !json || 'error' in json) {
    const err = json && 'error' in json && json.error ? json.error : undefined;
    throw new ApiError(
      res.status,
      err?.code ?? 'INTERNAL_ERROR',
      err?.message ?? 'Something went wrong. Please try again.',
      err?.details ?? [],
      err?.requestId,
    );
  }
  return json;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

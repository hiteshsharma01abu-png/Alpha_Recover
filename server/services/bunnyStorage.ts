import { AppError } from '../lib/errors';
import type { Env } from '../env';

export type BunnyStorageEnv = Pick<Env, 'BUNNY_STORAGE_ZONE' | 'BUNNY_STORAGE_KEY' | 'BUNNY_CDN_HOSTNAME'>;

function requireStorage(env: BunnyStorageEnv) {
  if (!env.BUNNY_STORAGE_ZONE || !env.BUNNY_STORAGE_KEY || !env.BUNNY_CDN_HOSTNAME) {
    throw new AppError('SERVICE_UNAVAILABLE', 'File storage is not set up yet');
  }
  return {
    zone: env.BUNNY_STORAGE_ZONE,
    key: env.BUNNY_STORAGE_KEY,
    cdn: env.BUNNY_CDN_HOSTNAME.replace(/^https?:\/\//, '').replace(/\/$/, ''),
  };
}

/** Public CDN URL for an object path in the storage zone. */
export function publicUrl(env: BunnyStorageEnv, path: string): string {
  const { cdn } = requireStorage(env);
  return `https://${cdn}/${path.replace(/^\//, '')}`;
}

/** Object path inside our zone for a known CDN URL, or null if it is not ours. */
export function pathFromPublicUrl(env: BunnyStorageEnv, url: string): string | null {
  if (!env.BUNNY_CDN_HOSTNAME) return null;
  const cdn = env.BUNNY_CDN_HOSTNAME.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const prefix = `https://${cdn}/`;
  if (!url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length);
  return path && !path.includes('..') ? path : null;
}

function storageUrl(zone: string, path: string) {
  return `https://storage.bunnycdn.com/${encodeURIComponent(zone)}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** Uploads bytes to Bunny Storage. The AccessKey never leaves the server. */
export async function putObject(
  env: BunnyStorageEnv,
  path: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const { zone, key } = requireStorage(env);
  const res = await fetchImpl(storageUrl(zone, path), {
    method: 'PUT',
    headers: { AccessKey: key, 'Content-Type': contentType, Accept: 'application/json' },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new AppError('UPSTREAM_ERROR', 'Could not upload the file', {
      details: detail ? [{ path: 'bunny', message: detail.slice(0, 200) }] : undefined,
    });
  }
}

/** Best-effort delete; missing objects are fine. */
export async function deleteObject(
  env: BunnyStorageEnv,
  path: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const { zone, key } = requireStorage(env);
  const res = await fetchImpl(storageUrl(zone, path), {
    method: 'DELETE',
    headers: { AccessKey: key, Accept: 'application/json' },
  });
  if (!res.ok && res.status !== 404) {
    const detail = await res.text().catch(() => '');
    throw new AppError('UPSTREAM_ERROR', 'Could not delete the file', {
      details: detail ? [{ path: 'bunny', message: detail.slice(0, 200) }] : undefined,
    });
  }
}

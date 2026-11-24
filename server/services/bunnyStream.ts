import { createHash } from 'node:crypto';
import { AppError } from '../lib/errors';
import type { Env } from '../env';

const TUS_ENDPOINT = 'https://video.bunnycdn.com/tusupload';
/** Signed upload window for the browser TUS client. */
const TUS_TTL_SECONDS = 6 * 60 * 60;

export type BunnyStreamEnv = Pick<Env, 'BUNNY_STREAM_LIBRARY_ID' | 'BUNNY_STREAM_API_KEY'>;

function requireBunny(env: BunnyStreamEnv) {
  if (!env.BUNNY_STREAM_LIBRARY_ID || !env.BUNNY_STREAM_API_KEY) {
    throw new AppError('SERVICE_UNAVAILABLE', 'Video hosting is not set up yet');
  }
  return { libraryId: env.BUNNY_STREAM_LIBRARY_ID, apiKey: env.BUNNY_STREAM_API_KEY };
}

/** Creates an empty Bunny Stream video; the browser then uploads bytes with TUS. */
export async function createBunnyVideo(
  env: BunnyStreamEnv,
  title: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ videoId: string }> {
  const { libraryId, apiKey } = requireBunny(env);
  const res = await fetchImpl(`https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}/videos`, {
    method: 'POST',
    headers: { AccessKey: apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ title: title.slice(0, 200) }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new AppError('UPSTREAM_ERROR', 'Could not create the video on Bunny', {
      details: detail ? [{ path: 'bunny', message: detail.slice(0, 200) }] : undefined,
    });
  }
  const body = (await res.json()) as { guid?: string };
  if (!body.guid) throw new AppError('UPSTREAM_ERROR', 'Bunny did not return a video id');
  return { videoId: body.guid };
}

/** Short-lived TUS headers; the permanent API key never leaves the server. */
export function bunnyTusCredentials(env: BunnyStreamEnv, videoId: string, now = new Date()) {
  const { libraryId, apiKey } = requireBunny(env);
  const expiresAt = Math.floor(now.getTime() / 1000) + TUS_TTL_SECONDS;
  const signature = createHash('sha256').update(`${libraryId}${apiKey}${expiresAt}${videoId}`).digest('hex');
  return {
    videoId,
    endpoint: TUS_ENDPOINT,
    expiresAt,
    headers: {
      AuthorizationSignature: signature,
      AuthorizationExpire: String(expiresAt),
      VideoId: videoId,
      LibraryId: libraryId,
    },
  };
}

/** Bunny's encode status for a finished video. */
const BUNNY_FINISHED = 4;

/** Length in seconds of an encoded Bunny video, or null while it is still processing or Bunny can't be reached. */
export async function bunnyVideoLength(env: BunnyStreamEnv, videoId: string, fetchImpl: typeof fetch = fetch): Promise<number | null> {
  if (!env.BUNNY_STREAM_LIBRARY_ID || !env.BUNNY_STREAM_API_KEY) return null;
  try {
    const res = await fetchImpl(
      `https://video.bunnycdn.com/library/${encodeURIComponent(env.BUNNY_STREAM_LIBRARY_ID)}/videos/${encodeURIComponent(videoId)}`,
      { headers: { AccessKey: env.BUNNY_STREAM_API_KEY, Accept: 'application/json' }, signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { status?: number; length?: number };
    return body.status === BUNNY_FINISHED && typeof body.length === 'number' && body.length > 0 ? Math.round(body.length) : null;
  } catch {
    return null;
  }
}

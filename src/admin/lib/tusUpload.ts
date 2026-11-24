/**
 * Minimal TUS 1.0 upload for Bunny Stream (no extra dependency).
 * Creates the upload, then PATCHes the file in chunks.
 */

const TUS_VERSION = '1.0.0';
const CHUNK = 5 * 1024 * 1024;

function b64(value: string) {
  return btoa(unescape(encodeURIComponent(value)));
}

export type TusUploadOptions = {
  endpoint: string;
  headers: Record<string, string>;
  file: File;
  onProgress?: (ratio: number) => void;
};

/** Uploads `file` to a Bunny TUS endpoint using the signed headers from /admin/videos/upload-url. */
export async function tusUpload({ endpoint, headers, file, onProgress }: TusUploadOptions): Promise<void> {
  const metadata = `filename ${b64(file.name)},filetype ${b64(file.type || 'application/octet-stream')}`;
  const create = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...headers,
      'Tus-Resumable': TUS_VERSION,
      'Upload-Length': String(file.size),
      'Upload-Metadata': metadata,
    },
  });
  if (!create.ok && create.status !== 201) {
    throw new Error(`Upload could not start (${create.status})`);
  }
  const location = create.headers.get('Location') || create.headers.get('location');
  if (!location) throw new Error('Upload server did not return a location');
  const url = location.startsWith('http') ? location : new URL(location, endpoint).href;

  let offset = 0;
  onProgress?.(0);
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK, file.size);
    const chunk = file.slice(offset, end);
    const patch = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...headers,
        'Tus-Resumable': TUS_VERSION,
        'Upload-Offset': String(offset),
        'Content-Type': 'application/offset+octet-stream',
      },
      body: chunk,
    });
    if (!patch.ok) throw new Error(`Upload failed at ${offset} bytes (${patch.status})`);
    const next = patch.headers.get('Upload-Offset');
    offset = next ? Number(next) : end;
    if (!Number.isFinite(offset) || offset < end) offset = end;
    onProgress?.(file.size ? offset / file.size : 1);
  }
}

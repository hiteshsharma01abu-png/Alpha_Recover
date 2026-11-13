import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';

export type ResourceError = { message: string; status: number; requestId?: string };

/**
 * Loads `fetcher()` whenever `key` changes; keeps the previous data while the next request runs,
 * and ignores responses that arrive after a newer request started. `key: null` skips loading.
 */
export function useResource<T>(key: string | null, fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ResourceError | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const latest = useRef(0);
  const fetcherRef = useRef(fetcher);
  // Runs before the load effect below, so a key change always uses the matching fetcher.
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const load = useCallback(() => {
    if (key === null) return;
    const ticket = ++latest.current;
    fetcherRef.current().then(
      (d) => {
        if (ticket !== latest.current) return;
        setData(d);
        setError(null);
        setLoadedKey(key);
      },
      (err: unknown) => {
        if (ticket !== latest.current) return;
        setError({
          message: err instanceof ApiError ? err.message : 'Something went wrong.',
          status: err instanceof ApiError ? err.status : 0,
          requestId: err instanceof ApiError ? err.requestId : undefined,
        });
        setLoadedKey(key);
      },
    );
  }, [key]);

  useEffect(load, [load]);

  return { data, error, loading: key !== null && loadedKey !== key, reload: load, setData };
}

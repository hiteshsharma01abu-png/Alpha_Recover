import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Filters, page and selection live in the URL, so a filtered list can be bookmarked or shared and
 * the back button works. Changing any filter resets the page to 1.
 */
export function useTableState<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();

  const values = useMemo(() => Object.fromEntries(keys.map((k) => [k, params.get(k) ?? undefined])) as Record<K, string | undefined>, [keys, params]);
  const page = Math.max(1, Number(params.get('page')) || 1);

  const update = useCallback(
    (changes: Partial<Record<K | 'page', string | undefined>>, opts: { keepPage?: boolean; replace?: boolean } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(changes) as [string, string | undefined][]) {
            if (v) next.set(k, v);
            else next.delete(k);
          }
          if (!opts.keepPage && !('page' in changes)) next.delete('page');
          return next;
        },
        { replace: opts.replace },
      );
    },
    [setParams],
  );

  return { values, page, update, params };
}

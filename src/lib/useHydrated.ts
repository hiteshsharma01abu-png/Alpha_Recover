import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/**
 * false while rendering at build time and during hydration, true afterwards. Use it for markup that
 * only exists in the browser (portals into document.body), so the pre-rendered HTML still matches.
 */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

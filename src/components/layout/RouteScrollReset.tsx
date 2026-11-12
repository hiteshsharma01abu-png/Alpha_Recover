import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Resets window scroll to the top on every pathname change.
 * Same-page hash targets (if any) are scrolled into view instead.
 * Does not affect in-page scrollIntoView (e.g. Training Solutions on mobile).
 */
export function RouteScrollReset() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      requestAnimationFrame(() => {
        const el = id ? document.getElementById(id) : null;
        if (el) {
          el.scrollIntoView();
          return;
        }
        window.scrollTo(0, 0);
      });
      return;
    }

    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}

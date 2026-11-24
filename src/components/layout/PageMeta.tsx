import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pageSeo } from '../../data/seo';
import { applyPageMeta } from '../../lib/pageMeta';

/**
 * Keeps <head> in step with the route after client-side navigation (the pre-rendered HTML already
 * has the right tags on first load). A layout effect, so a page's own useEffect (e.g. a blog post
 * loaded from the API) can refine it afterwards.
 */
export function PageMeta() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    applyPageMeta(pageSeo(pathname));
  }, [pathname]);
  return null;
}

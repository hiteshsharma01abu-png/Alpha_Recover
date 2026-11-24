import { useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Header } from './Header';
import { Footer } from './Footer';
import { WhatsAppFloat } from './WhatsAppFloat';
import { PageMeta } from './PageMeta';
import { RouteScrollReset } from './RouteScrollReset';
import { ScrollToTop } from './ScrollToTop';
import '../../styles/glass.css';

/** /account/settings always, and signed-in /dashboard, use LearnerShell instead of marketing chrome. */
function isLearnerChrome(pathname: string, signedIn: boolean) {
  if (pathname === '/account/settings') return true;
  return pathname === '/dashboard' && signedIn;
}

export function Layout() {
  const { pathname } = useLocation();
  const auth = useAuth();
  const isHome = pathname === '/';
  const signedIn = Boolean(auth.user);
  const learner = isLearnerChrome(pathname, signedIn);
  const account = pathname === '/account';
  // Hide the site header on learner chrome, and while /dashboard session is still resolving
  // (avoids a flash of marketing nav before LearnerShell mounts).
  const hideMarketingHeader =
    pathname === '/account/settings' ||
    (pathname === '/dashboard' && (!auth.loaded || signedIn));

  // <html data-home> on the homepage: sections shared with other pages (pricing card, training
  // explorer) keep their original homepage buttons there (docs/DESIGN.md §5). The header is the
  // same on every page except signed-in learner chrome; the footer is hidden on /account too.
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute('data-home', isHome);
  }, [isHome]);

  return (
    <>
      <PageMeta />
      <RouteScrollReset />
      {hideMarketingHeader ? null : <Header />}
      <main className={learner || pathname === '/dashboard' ? 'page page-learner' : 'page'}>
        <Outlet />
      </main>
      {learner || account || pathname === '/dashboard' ? null : (
        <>
          <Footer />
          <ScrollToTop />
          <WhatsAppFloat />
        </>
      )}
    </>
  );
}

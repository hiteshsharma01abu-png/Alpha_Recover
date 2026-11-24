import { useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { WhatsAppFloat } from './WhatsAppFloat';
import { PageMeta } from './PageMeta';
import { RouteScrollReset } from './RouteScrollReset';
import { ScrollToTop } from './ScrollToTop';
import '../../styles/glass.css';

/** /account/settings and /dashboard use learner chrome. Logged-out /account keeps the homepage header. */
function isLearnerChrome(pathname: string) {
  return pathname === '/account/settings' || pathname === '/dashboard';
}

export function Layout() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const learner = isLearnerChrome(pathname);
  const account = pathname === '/account';

  // <html data-home> on the homepage: sections shared with other pages (pricing card, training
  // explorer) keep their original homepage buttons there (docs/DESIGN.md §5). The header is the
  // same on every page except learner chrome; the footer is hidden on /account as well.
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute('data-home', isHome);
  }, [isHome]);

  return (
    <>
      <PageMeta />
      <RouteScrollReset />
      {learner ? null : <Header />}
      <main className={learner ? 'page page-learner' : 'page'}>
        <Outlet />
      </main>
      {learner || account ? null : (
        <>
          <Footer />
          <ScrollToTop />
          <WhatsAppFloat />
        </>
      )}
    </>
  );
}

import { useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { WhatsAppFloat } from './WhatsAppFloat';
import { PageMeta } from './PageMeta';
import { RouteScrollReset } from './RouteScrollReset';
import { ScrollToTop } from './ScrollToTop';
import '../../styles/glass.css';

/** /account, /account/settings and /dashboard use their own chrome (AuthTopBar / LearnerShell). */
function isLearnerChrome(pathname: string) {
  return pathname === '/account' || pathname === '/account/settings' || pathname === '/dashboard';
}

export function Layout() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const learner = isLearnerChrome(pathname);

  // <html data-home> on the homepage: sections shared with other pages (pricing card, training
  // explorer) keep their original homepage buttons there (docs/DESIGN.md §5). The header and
  // footer are identical on every page except learner chrome routes (docs/DESIGN.md §5).
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
      {learner ? null : (
        <>
          <Footer />
          <ScrollToTop />
          <WhatsAppFloat />
        </>
      )}
    </>
  );
}

import { useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { WhatsAppFloat } from './WhatsAppFloat';
import { RouteScrollReset } from './RouteScrollReset';
import { ScrollToTop } from './ScrollToTop';
import '../../styles/glass.css';

export function Layout() {
  const isHome = useLocation().pathname === '/';

  // <html data-home> on the homepage: sections shared with other pages (pricing card, training
  // explorer) keep their original homepage buttons there (docs/DESIGN.md §5). The header and
  // footer are identical on every page and never use this flag.
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute('data-home', isHome);
  }, [isHome]);

  return (
    <>
      <RouteScrollReset />
      <Header />
      <main className="page">
        <Outlet />
      </main>
      <Footer />
      <ScrollToTop />
      <WhatsAppFloat />
    </>
  );
}

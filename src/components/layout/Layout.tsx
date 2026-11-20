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

  // <html data-home> on the homepage: shared header/footer/section buttons keep their original
  // homepage look there and use the site button style on every other page (docs/DESIGN.md §5).
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

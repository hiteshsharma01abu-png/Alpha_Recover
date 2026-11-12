import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { WhatsAppFloat } from './WhatsAppFloat';
import { RouteScrollReset } from './RouteScrollReset';
import { ScrollToTop } from './ScrollToTop';
import '../../styles/glass.css';

export function Layout() {
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

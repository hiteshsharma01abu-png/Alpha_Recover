import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { brandLogo } from '../../data/content';
import { logout, useAuth } from '../../lib/auth';
import { icons } from '../../lib/icons';
import { learnerAssets } from '../../lib/learnerAssets';
import './LearnerShell.css';

type NavItem = {
  id: string;
  label: string;
  to: string;
  icon: string;
  end?: boolean;
};

const SIDE_NAV: NavItem[] = [
  { id: 'learning', label: 'My Learning', to: '/dashboard', icon: learnerAssets.iconGraduation, end: true },
  { id: 'courses', label: 'My Courses', to: '/dashboard#courses', icon: learnerAssets.iconCourses },
  { id: 'progress', label: 'My Progress', to: '/dashboard#progress', icon: learnerAssets.iconProgress },
  { id: 'certificates', label: 'Certificates', to: '/dashboard#certificates', icon: learnerAssets.iconCertificate },
  { id: 'settings', label: 'Account settings', to: '/account/settings', icon: icons.settings },
  { id: 'support', label: 'Support', to: '/contact', icon: learnerAssets.iconSupport },
];

const BOTTOM_NAV = [
  { id: 'home', label: 'Home', to: '/', icon: learnerAssets.iconHome },
  { id: 'courses', label: 'Courses', to: '/dashboard#courses', icon: learnerAssets.iconCourses },
  { id: 'progress', label: 'Progress', to: '/dashboard#progress', icon: learnerAssets.iconProgress },
  { id: 'certificates', label: 'Certificates', to: '/dashboard#certificates', icon: learnerAssets.iconCertificate },
];

function pathActive(pathname: string, hash: string, item: NavItem): boolean {
  if (item.to === '/contact') return pathname === '/contact';
  if (item.to === '/account/settings') return pathname === '/account/settings';
  if (item.to === '/dashboard' && item.end) {
    return pathname === '/dashboard' && !hash;
  }
  if (item.to.includes('#')) {
    const anchor = item.to.split('#')[1];
    return pathname === '/dashboard' && hash === `#${anchor}`;
  }
  return pathname === item.to;
}

type LearnerShellProps = {
  children: ReactNode;
  /** When false, hide the Professional Plan upgrade card. Defaults true until dashboard data loads. */
  showUpgrade?: boolean;
  title?: string;
};

/** Signed-in student chrome for /dashboard (My Learning) and /account/settings. */
export function LearnerShell({ children, showUpgrade = true, title = 'My Learning' }: LearnerShellProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<null | 'one' | 'all'>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  async function onLogout(everywhere = false) {
    setBusy(everywhere ? 'all' : 'one');
    try {
      await logout(everywhere);
      navigate('/account', { replace: true });
    } finally {
      setBusy(null);
      setMenuOpen(false);
    }
  }

  const firstName = auth.user?.firstName ?? 'Student';

  return (
    <div className="lrn">
      <aside className="lrn-sidebar" aria-label="Learner navigation">
        <Link to="/" className="lrn-brand">
          <img className="brand-logo" src={brandLogo.header} alt="Alpha Recovery" width={660} height={180} />
        </Link>

        <nav className="lrn-nav">
          {SIDE_NAV.map((item) => {
            const active = pathActive(pathname, hash, item);
            return (
              <Link
                key={item.id}
                to={item.to}
                className={`lrn-nav-item${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMoreOpen(false)}
              >
                <img src={item.icon} alt="" width={20} height={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {showUpgrade ? (
          <div className="lrn-upgrade">
            <img src={learnerAssets.iconCrown} alt="" width={28} height={28} />
            <p className="lrn-upgrade-title">Professional Plan</p>
            <p className="lrn-upgrade-copy">Unlock every training track with lifetime access.</p>
            <Link className="btn btn-primary lrn-upgrade-btn" to="/pricing">
              Get Professional Plan
            </Link>
          </div>
        ) : null}
      </aside>

      <div className="lrn-main">
        <header className="lrn-top">
          <button
            type="button"
            className="lrn-menu-btn"
            aria-label={moreOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={moreOpen}
            onClick={() => {
              setMenuOpen(false);
              setMoreOpen((v) => !v);
            }}
          >
            <img src={learnerAssets.iconMenu} alt="" width={22} height={22} />
          </button>

          <h1 className="lrn-title">{title}</h1>

          <div className="lrn-top-actions">
            <div className="lrn-user-wrap" ref={menuRef}>
              <button
                type="button"
                className={`lrn-user${menuOpen ? ' is-open' : ''}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={`${firstName}, account menu`}
                onClick={() => {
                  setMoreOpen(false);
                  setMenuOpen((open) => !open);
                }}
              >
                <img className="lrn-avatar" src={auth.user?.image || learnerAssets.avatar} alt="" width={36} height={36} />
                <span className="lrn-user-name">{firstName}</span>
                <img className="lrn-user-chevron" src={learnerAssets.iconChevron} alt="" width={14} height={14} />
              </button>
              {menuOpen ? (
                <div className="lrn-user-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => void onLogout()} disabled={busy !== null}>
                    {busy === 'one' ? 'Logging out…' : 'Log out'}
                  </button>
                  <button type="button" role="menuitem" onClick={() => void onLogout(true)} disabled={busy !== null}>
                    {busy === 'all' ? 'Logging out…' : 'Log out of all devices'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {moreOpen ? (
          <div className="lrn-drawer" role="dialog" aria-label="More options">
            <Link to="/dashboard" onClick={() => setMoreOpen(false)}>
              My Learning
            </Link>
            <Link to="/account/settings" onClick={() => setMoreOpen(false)}>
              Account settings
            </Link>
            <Link to="/contact" onClick={() => setMoreOpen(false)}>
              Support
            </Link>
          </div>
        ) : null}

        <div className="lrn-content">{children}</div>
      </div>

      <nav className="lrn-bottom" aria-label="Mobile learner navigation">
        {BOTTOM_NAV.map((item) => {
          const active =
            item.to === '/'
              ? pathname === '/'
              : pathActive(pathname, hash, { ...item, end: false } as NavItem);
          return (
            <Link
              key={item.id}
              to={item.to}
              className={`lrn-bottom-item${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <img src={item.icon} alt="" width={22} height={22} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className={`lrn-bottom-item${moreOpen ? ' is-active' : ''}`}
          aria-expanded={moreOpen}
          onClick={() => {
            setMenuOpen(false);
            setMoreOpen((v) => !v);
          }}
        >
          <img src={learnerAssets.iconMore} alt="" width={22} height={22} />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}

/** Minimal top bar for logged-out auth screens (matches the reference nav). */
export function AuthTopBar() {
  return (
    <header className="auth-top">
      <Link to="/" className="auth-top-brand">
        <img className="brand-logo" src={brandLogo.header} alt="Alpha Recovery" width={660} height={180} />
      </Link>
      <nav className="auth-top-nav" aria-label="Account navigation">
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/training">Courses</NavLink>
        <NavLink to="/account" className="auth-top-cta">
          My Account
        </NavLink>
      </nav>
    </header>
  );
}

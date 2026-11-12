import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { company, trainingTracks } from '../data/content';
import './Header.css';

const infoLinks = [
  { to: '/blog', label: 'Blog', icon: 'blog' as const },
  { to: '/services', label: 'Services', icon: 'services' as const },
  { to: '/verify-certificate', label: 'Verify Certificate', icon: 'verify' as const },
  { to: '/industries', label: 'Industries', icon: 'industries' as const },
];

const primaryLinks = [
  { to: '/pricing', label: 'Pricing', icon: 'pricing' as const },
  { to: '/demos', label: 'Demo Videos', icon: 'demos' as const },
  { to: '/contact', label: 'Contact', icon: 'contact' as const },
];

type IconName =
  | 'home'
  | 'blog'
  | 'services'
  | 'verify'
  | 'industries'
  | 'training'
  | 'pricing'
  | 'demos'
  | 'contact'
  | 'user'
  | 'chevron'
  | 'close';

function MenuIcon({ name }: { name: IconName }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 20,
    height: 20,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5.5 9.5V21h13V9.5" />
        </svg>
      );
    case 'blog':
      return (
        <svg {...common}>
          <path d="M5 4h14v16H5z" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );
    case 'services':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2.5M12 18.5V21M4.9 6.5l1.8 1.8M17.3 15.7l1.8 1.8M3 12h2.5M18.5 12H21M4.9 17.5l1.8-1.8M17.3 8.3l1.8-1.8" />
        </svg>
      );
    case 'verify':
      return (
        <svg {...common}>
          <path d="M12 3 5 6v5c0 4.5 2.9 7.8 7 9 4.1-1.2 7-4.5 7-9V6l-7-3z" />
          <path d="m9.2 12 1.9 1.9 3.7-3.8" />
        </svg>
      );
    case 'industries':
      return (
        <svg {...common}>
          <path d="M4 21V9l6 3V9l6 3V5h4v16z" />
        </svg>
      );
    case 'training':
      return (
        <svg {...common}>
          <path d="M4 19V7l8-3 8 3v12" />
          <path d="M12 4v15M8 10.5h2M8 14h2M14 10.5h2M14 14h2" />
        </svg>
      );
    case 'pricing':
      return (
        <svg {...common}>
          <path d="M12 3v18M16.5 7.5c-.8-1.2-2-1.9-4.5-1.9-2.8 0-4.5 1.4-4.5 3.4S9.5 12 12 12s4.5 1.1 4.5 3.2c0 2.1-1.8 3.5-4.8 3.5-2.4 0-3.7-.8-4.5-1.9" />
        </svg>
      );
    case 'demos':
      return (
        <svg {...common}>
          <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
          <path d="m10 9.5 5 2.5-5 2.5v-5z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'contact':
      return (
        <svg {...common}>
          <path d="M5 6.5h14v11H5z" />
          <path d="m5.5 7.5 6.5 5 6.5-5" />
        </svg>
      );
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8.5" r="3.2" />
          <path d="M5.5 19c1.6-3.2 3.8-4.7 6.5-4.7S16.9 15.8 18.5 19" />
        </svg>
      );
    case 'chevron':
      return (
        <svg {...common} width={16} height={16}>
          <path d="m9 6 5 6-5 6" />
        </svg>
      );
    case 'close':
      return (
        <svg {...common} width={18} height={18}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    default:
      return null;
  }
}

function DrawerRow({
  to,
  label,
  icon,
  end,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  onNavigate: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) => `drawer-row${isActive ? ' is-active' : ''}`}
    >
      <span className="drawer-row-icon">
        <MenuIcon name={icon} />
      </span>
      <span className="drawer-row-label">{label}</span>
      <span className="drawer-row-chevron">
        <MenuIcon name="chevron" />
      </span>
    </NavLink>
  );
}

function DesktopNavLinks() {
  return (
    <>
      <NavLink to="/" end>
        Home
      </NavLink>

      <div className="nav-drop">
        <button type="button" className="nav-drop-btn">
          Information
        </button>
        <div className="nav-menu">
          {infoLinks.map((l) => (
            <Link key={l.to} to={l.to}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="nav-drop">
        <NavLink to="/training" className="nav-drop-btn linkish">
          Training
        </NavLink>
        <div className="nav-menu nav-menu-wide">
          {trainingTracks.map((t) => (
            <Link key={t.id} to={`/training/${t.id}`}>
              {t.title}
            </Link>
          ))}
        </div>
      </div>

      <NavLink to="/pricing">Pricing</NavLink>
      <NavLink to="/demos">Demo Videos</NavLink>
      <NavLink to="/contact">Contact</NavLink>
      <NavLink to="/account" className="nav-cta">
        Register / Login
        <span aria-hidden>→</span>
      </NavLink>
    </>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div
      id="mobile-nav"
      className={`nav nav-drawer ${open ? 'is-open' : ''}`}
      role="dialog"
      aria-modal={open}
      aria-label="Mobile navigation"
      aria-hidden={!open}
    >
      <div className="drawer-head">
        <Link to="/" className="drawer-brand" onClick={onClose} aria-label={`${company.name} home`}>
          <span className="brand-mark" aria-hidden>
            <span className="brand-ring" />
            <span className="brand-hub" />
          </span>
          <strong>{company.name}</strong>
        </Link>
        <button type="button" className="drawer-close" aria-label="Close menu" onClick={onClose}>
          <MenuIcon name="close" />
        </button>
      </div>

      <nav className="drawer-scroll" aria-label="Mobile">
        <DrawerRow to="/" end label="Home" icon="home" onNavigate={onClose} />

        <p className="drawer-section">Information</p>
        {infoLinks.map((l) => (
          <DrawerRow key={l.to} to={l.to} label={l.label} icon={l.icon} onNavigate={onClose} />
        ))}

        <p className="drawer-section">Training</p>
        {trainingTracks.map((t) => (
          <DrawerRow
            key={t.id}
            to={`/training/${t.id}`}
            label={t.title}
            icon="training"
            onNavigate={onClose}
          />
        ))}

        {primaryLinks.map((l) => (
          <DrawerRow key={l.to} to={l.to} label={l.label} icon={l.icon} onNavigate={onClose} />
        ))}
      </nav>

      <div className="drawer-foot">
        <NavLink to="/account" className="drawer-cta" onClick={onClose}>
          <span className="drawer-row-icon">
            <MenuIcon name="user" />
          </span>
          <span className="drawer-row-label">Register / Login</span>
          <span className="drawer-row-chevron">
            <MenuIcon name="chevron" />
          </span>
        </NavLink>
      </div>
    </div>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className={`site-header ${open ? 'is-nav-open' : ''}`}>
      <div className="container header-inner">
        <div className="header-bar">
          <Link to="/" className="brand" aria-label={`${company.name} home`}>
            <span className="brand-mark" aria-hidden>
              <span className="brand-ring" />
              <span className="brand-hub" />
            </span>
            <span className="brand-text">
              <strong>
                <span className="brand-alpha">Alpha</span>{' '}
                <span className="brand-recover">Recover</span>
              </strong>
            </span>
          </Link>

          <button
            type="button"
            className={`nav-toggle ${open ? 'is-open' : ''}`}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>

          <nav id="primary-nav" className="nav nav-desktop" aria-label="Primary">
            <DesktopNavLinks />
          </nav>
        </div>
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <>
            <MobileDrawer open={open} onClose={close} />
            {open ? (
              <button
                type="button"
                className="nav-backdrop"
                aria-label="Close menu"
                onClick={close}
              />
            ) : null}
          </>,
          document.body,
        )}
    </header>
  );
}

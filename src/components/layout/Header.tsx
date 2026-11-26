import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { brandLogo, company, type TrainingTrack } from '../../data/content';
import { useAuth } from '../../lib/auth';
import { useTrainingTracks } from '../../lib/catalog';
import { useHydrated } from '../../lib/useHydrated';
import { useOwnedPlans } from '../../lib/useOwnedPlans';
import './Header.css';

const resourceLinks = [
  {
    to: '/blog',
    label: 'Blog',
    icon: 'blog' as const,
    description: 'Articles and recovery insights',
  },
  {
    to: '/services',
    label: 'Services',
    icon: 'services' as const,
    description: 'Professional recovery services',
  },
  {
    to: '/verify-certificate',
    label: 'Verify Certificate',
    icon: 'verify' as const,
    description: 'Check a certificate code',
  },
  {
    to: '/industries',
    label: 'Industries',
    icon: 'industries' as const,
    description: 'Who we train and serve',
  },
];

/** Group map by track id — resolves against live catalog, not a duplicate course list. */
const COURSE_GROUPS: { id: string; label: string; trackIds: string[] }[] = [
  {
    id: 'data-recovery',
    label: 'Data Recovery',
    trackIds: ['logical', 'electrical', 'mechanical'],
  },
  {
    id: 'firmware',
    label: 'Firmware Repair',
    trackIds: ['firmware-basic', 'mrt'],
  },
  {
    id: 'fundamentals',
    label: 'Core Fundamentals',
    trackIds: ['electronics', 'basics'],
  },
  {
    id: 'specialized',
    label: 'Specialized Recovery',
    trackIds: ['media', 'bitlocker'],
  },
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
  | 'close'
  | 'chevronDown';

type CourseGroupView = {
  id: string;
  label: string;
  tracks: TrainingTrack[];
};

function groupCourses(tracks: TrainingTrack[]): { groups: CourseGroupView[]; extras: TrainingTrack[] } {
  const used = new Set<string>();
  const groups = COURSE_GROUPS.map((g) => {
    const list = g.trackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is TrainingTrack => Boolean(t));
    list.forEach((t) => used.add(t.id));
    return { id: g.id, label: g.label, tracks: list };
  }).filter((g) => g.tracks.length > 0);
  const extras = tracks.filter((t) => !used.has(t.id));
  return { groups, extras };
}

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
    case 'chevronDown':
      return (
        <svg {...common} width={14} height={14}>
          <path d="m6 9 6 5 6-5" />
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

type OpenMenu = null | 'courses' | 'resources';

function NavDropdown({
  id,
  label,
  open,
  onToggle,
  onClose,
  panelClassName,
  triggerClassName,
  children,
  triggerTo,
}: {
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  panelClassName: string;
  triggerClassName?: string;
  children: ReactNode;
  /** When set, the label is also a link (Courses → /training). */
  triggerTo?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = `${id}-panel`;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div className={`nav-drop${open ? ' is-open' : ''}`} ref={wrapRef}>
      {triggerTo ? (
        <div className="nav-drop-split">
          <NavLink to={triggerTo} className={`nav-drop-link ${triggerClassName ?? ''}`.trim()} onClick={onClose}>
            {label}
          </NavLink>
          <button
            type="button"
            className="nav-drop-chevron"
            aria-expanded={open}
            aria-haspopup="true"
            aria-controls={panelId}
            aria-label={`${label} menu`}
            onClick={onToggle}
          >
            <MenuIcon name="chevronDown" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`nav-drop-btn${open ? ' is-open' : ''}`}
          aria-expanded={open}
          aria-haspopup="true"
          aria-controls={panelId}
          onClick={onToggle}
        >
          {label}
          <span className="nav-drop-btn-chevron" aria-hidden>
            <MenuIcon name="chevronDown" />
          </span>
        </button>
      )}
      <div id={panelId} className={panelClassName} hidden={!open} role="region" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

function DesktopNav({ ownsPlan }: { ownsPlan: boolean }) {
  const trainingTracks = useTrainingTracks();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const uid = useId();
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const { groups, extras } = useMemo(() => groupCourses(trainingTracks), [trainingTracks]);

  const closeMenus = () => setOpenMenu(null);

  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  return (
    <>
      <div className="nav-primary">
        <NavLink to="/" end onClick={closeMenus}>
          Home
        </NavLink>

        <NavDropdown
          id={`${uid}-courses`}
          label="Courses"
          triggerTo="/training"
          open={openMenu === 'courses'}
          onToggle={() => setOpenMenu((m) => (m === 'courses' ? null : 'courses'))}
          onClose={closeMenus}
          panelClassName="nav-mega"
        >
          <div className="nav-mega-grid">
            {groups.map((g) => (
              <div key={g.id} className="nav-mega-col">
                <p className="nav-mega-heading">{g.label}</p>
                <ul className="nav-mega-list">
                  {g.tracks.map((t) => (
                    <li key={t.id}>
                      <Link to={`/training/${t.id}`} onClick={closeMenus}>
                        {t.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {extras.length ? (
            <div className="nav-mega-extras">
              <p className="nav-mega-heading">Also available</p>
              <ul className="nav-mega-extras-list">
                {extras.map((t) => (
                  <li key={t.id}>
                    <Link to={`/training/${t.id}`} onClick={closeMenus}>
                      {t.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="nav-mega-foot">
            <Link to="/training" className="nav-mega-all" onClick={closeMenus}>
              View All Courses
              <span aria-hidden>→</span>
            </Link>
          </div>
        </NavDropdown>

        <NavLink to="/demos" onClick={closeMenus}>
          Demo Videos
        </NavLink>

        <NavDropdown
          id={`${uid}-resources`}
          label="Resources"
          open={openMenu === 'resources'}
          onToggle={() => setOpenMenu((m) => (m === 'resources' ? null : 'resources'))}
          onClose={closeMenus}
          panelClassName="nav-resources"
        >
          {resourceLinks.map((l) => (
            <Link key={l.to} to={l.to} className="nav-resource-item" onClick={closeMenus}>
              <span className="nav-resource-icon" aria-hidden>
                <MenuIcon name={l.icon} />
              </span>
              <span className="nav-resource-copy">
                <strong>{l.label}</strong>
                <small>{l.description}</small>
              </span>
            </Link>
          ))}
        </NavDropdown>

        <NavLink to="/pricing" onClick={closeMenus}>
          Pricing
        </NavLink>
      </div>

      <div className="nav-actions">
        <NavLink to="/contact" className="nav-support" onClick={closeMenus}>
          Expert Support
        </NavLink>
        <NavLink to="/account" className="nav-login" onClick={closeMenus}>
          {user ? 'My Account' : 'Login'}
        </NavLink>
        <NavLink to={ownsPlan ? '/dashboard' : '/pricing'} className="nav-enroll" onClick={closeMenus}>
          {ownsPlan ? 'My Learning' : 'Enroll Now'}
        </NavLink>
      </div>
    </>
  );
}

function MobileDrawer({ open, onClose, ownsPlan }: { open: boolean; onClose: () => void; ownsPlan: boolean }) {
  const trainingTracks = useTrainingTracks();
  const { user } = useAuth();
  const { groups, extras } = useMemo(() => groupCourses(trainingTracks), [trainingTracks]);
  const [accordion, setAccordion] = useState<null | 'courses' | 'resources'>(null);

  useEffect(() => {
    if (!open) setAccordion(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

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
          <img className="drawer-logo" src={brandLogo.header} alt="" width={660} height={180} />
        </Link>
        <button type="button" className="drawer-close" aria-label="Close menu" onClick={onClose}>
          <MenuIcon name="close" />
        </button>
      </div>

      <nav className="drawer-scroll" aria-label="Mobile">
        <DrawerRow to="/" end label="Home" icon="home" onNavigate={onClose} />

        <button
          type="button"
          className={`drawer-acc-btn${accordion === 'courses' ? ' is-open' : ''}`}
          aria-expanded={accordion === 'courses'}
          onClick={() => setAccordion((a) => (a === 'courses' ? null : 'courses'))}
        >
          <span className="drawer-row-icon">
            <MenuIcon name="training" />
          </span>
          <span className="drawer-row-label">Courses</span>
          <span className="drawer-row-chevron">
            <MenuIcon name="chevronDown" />
          </span>
        </button>
        {accordion === 'courses' ? (
          <div className="drawer-acc-panel">
            {groups.map((g) => (
              <div key={g.id} className="drawer-acc-group">
                <p className="drawer-section">{g.label}</p>
                {g.tracks.map((t) => (
                  <DrawerRow
                    key={t.id}
                    to={`/training/${t.id}`}
                    label={t.title}
                    icon="training"
                    onNavigate={onClose}
                  />
                ))}
              </div>
            ))}
            {extras.length ? (
              <div className="drawer-acc-group">
                <p className="drawer-section">Also available</p>
                {extras.map((t) => (
                  <DrawerRow
                    key={t.id}
                    to={`/training/${t.id}`}
                    label={t.title}
                    icon="training"
                    onNavigate={onClose}
                  />
                ))}
              </div>
            ) : null}
            <DrawerRow to="/training" label="View All Courses" icon="training" onNavigate={onClose} />
          </div>
        ) : null}

        <DrawerRow to="/demos" label="Demo Videos" icon="demos" onNavigate={onClose} />

        <button
          type="button"
          className={`drawer-acc-btn${accordion === 'resources' ? ' is-open' : ''}`}
          aria-expanded={accordion === 'resources'}
          onClick={() => setAccordion((a) => (a === 'resources' ? null : 'resources'))}
        >
          <span className="drawer-row-icon">
            <MenuIcon name="blog" />
          </span>
          <span className="drawer-row-label">Resources</span>
          <span className="drawer-row-chevron">
            <MenuIcon name="chevronDown" />
          </span>
        </button>
        {accordion === 'resources' ? (
          <div className="drawer-acc-panel">
            {resourceLinks.map((l) => (
              <DrawerRow key={l.to} to={l.to} label={l.label} icon={l.icon} onNavigate={onClose} />
            ))}
          </div>
        ) : null}

        <DrawerRow to="/pricing" label="Pricing" icon="pricing" onNavigate={onClose} />
        <DrawerRow to="/contact" label="Expert Support" icon="contact" onNavigate={onClose} />
        <DrawerRow
          to="/account"
          label={user ? 'My Account' : 'Login'}
          icon="user"
          onNavigate={onClose}
        />
      </nav>

      <div className="drawer-foot">
        <NavLink to={ownsPlan ? '/dashboard' : '/pricing'} className="drawer-enroll" onClick={onClose}>
          {ownsPlan ? 'My Learning' : 'Enroll Now'}
        </NavLink>
      </div>
    </div>
  );
}

export function Header() {
  const location = useLocation();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === location.pathname;
  const hydrated = useHydrated();
  // Students who already hold a plan get "My Learning" instead of "Enroll Now"; reloaded after a purchase
  const ownsPlan = (useOwnedPlans(location.pathname === '/checkout/success')?.owned.size ?? 0) > 0;

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const close = () => setOpenOn(null);

  return (
    <header className={`site-header ${open ? 'is-nav-open' : ''}`}>
      <div className="container header-inner">
        <div className="header-bar">
          <Link to="/" className="brand" aria-label={`${company.name} home`}>
            <img className="brand-logo" src={brandLogo.header} alt="" width={660} height={180} />
          </Link>

          <button
            type="button"
            className={`nav-toggle ${open ? 'is-open' : ''}`}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpenOn(open ? null : location.pathname)}
          >
            <span />
            <span />
            <span />
          </button>

          <nav id="primary-nav" className="nav nav-desktop" aria-label="Primary">
            <DesktopNav ownsPlan={ownsPlan} />
          </nav>
        </div>
      </div>

      {hydrated &&
        createPortal(
          <>
            <MobileDrawer open={open} onClose={close} ownsPlan={ownsPlan} />
            {open ? (
              <button type="button" className="nav-backdrop" aria-label="Close menu" onClick={close} />
            ) : null}
          </>,
          document.body,
        )}
    </header>
  );
}

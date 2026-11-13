import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { logout } from '../../lib/auth';
import { useAdminSession } from '../auth/adminSessionContext';
import { BrandLogo } from '../components/BrandLogo';
import { useAdminTheme, type ThemePreference } from '../lib/theme';
import { ADMIN_NAV, type AdminNavItem } from '../routes';
import './AdminLayout.css';

const ICONS: Record<AdminNavItem['icon'], ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3.5" y="3.5" width="7" height="8" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
      <rect x="3.5" y="14.5" width="7" height="6" rx="1.5" />
    </svg>
  ),
  leads: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 5.5h16v10H8l-4 3.5z" />
    </svg>
  ),
  students: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 9l9-4 9 4-9 4z" />
      <path d="M7 11v4c3 2 7 2 10 0v-4" />
    </svg>
  ),
  team: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.9-3 3-4.5 5.5-4.5s4.6 1.5 5.5 4.5M16 6.5a3 3 0 0 1 0 5.5M17.5 14.6c1.6.5 2.6 2 3 4.4" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 12h4l3-7 4 14 3-7h4" />
    </svg>
  ),
};

const GROUP_ORDER: AdminNavItem['group'][] = ['Overview', 'Sales', 'Learners', 'Content', 'Insights', 'System'];

function ThemeSelect({ preference, choose }: { preference: ThemePreference; choose: (t: ThemePreference) => void }) {
  return (
    <label>
      <span className="adm-skip">Theme</span>
      <select className="adm-select" value={preference} onChange={(e) => choose(e.target.value as ThemePreference)} aria-label="Theme">
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}

/** Admin shell: sidebar (permission-filtered), top bar, theme, mobile drawer. */
export function AdminLayout({ title }: { title?: string }) {
  const theme = useAdminTheme();
  const { me, can } = useAdminSession();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  const items = ADMIN_NAV.filter((i) => can(i.permission));
  const current = ADMIN_NAV.find((i) => `/admin${i.path ? `/${i.path}` : ''}` === location.pathname);

  return (
    <div className="adm" data-theme={theme.resolved}>
      <a className="adm-skip" href="#adm-content">
        Skip to content
      </a>
      <div className={`adm-shell${navOpen ? ' is-nav-open' : ''}`}>
        <aside className="adm-sidebar" aria-label="Admin navigation">
          <Link to="/admin" className="adm-brand" onClick={() => setNavOpen(false)}>
            <BrandLogo tagline="Admin Panel" />
          </Link>
          <nav className="adm-nav">
            {GROUP_ORDER.map((group) => {
              const inGroup = items.filter((i) => i.group === group);
              if (!inGroup.length) return null;
              return (
                <div key={group}>
                  <p className="adm-nav-group">{group}</p>
                  {inGroup.map((i) => (
                    <NavLink key={i.path} to={`/admin${i.path ? `/${i.path}` : ''}`} end onClick={() => setNavOpen(false)}>
                      {ICONS[i.icon]}
                      {i.label}
                    </NavLink>
                  ))}
                </div>
              );
            })}
          </nav>
          <div className="adm-sidebar-foot">
            <strong>{me?.user.firstName}</strong>
            <span className="adm-role">{me?.roleLabel}</span>
            <p>
              <a href="/" target="_blank" rel="noopener noreferrer">
                View website ↗
              </a>
            </p>
          </div>
        </aside>
        <div className="adm-backdrop" onClick={() => setNavOpen(false)} aria-hidden />
        <div className="adm-main">
          <header className="adm-topbar">
            <button
              type="button"
              className="adm-btn adm-btn-icon adm-menu-btn"
              aria-label="Open navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              ☰
            </button>
            <h1>{title ?? current?.label ?? 'Admin'}</h1>
            <div className="adm-topbar-actions">
              <ThemeSelect preference={theme.preference} choose={theme.choose} />
              <button type="button" className="adm-btn" onClick={() => void logout().then(() => window.location.assign('/admin/login'))}>
                Log out
              </button>
            </div>
          </header>
          <main id="adm-content" className="adm-content">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

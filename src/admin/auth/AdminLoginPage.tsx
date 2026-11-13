import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { login, logout } from '../../lib/auth';
import { formErrors } from '../../lib/leads';
import { AdmIcon } from '../components/AdmIcon';
import type { AdmIconName } from '../components/AdmIcon';
import { BrandLogo } from '../components/BrandLogo';
import { useAdminTheme } from '../lib/theme';
import { useAdminSession } from './adminSessionContext';
import '../layout/AdminLayout.css';
import './AdminLogin.css';

const FEATURES: { icon: AdmIconName; label: string }[] = [
  { icon: 'users', label: 'Students Management' },
  { icon: 'book', label: 'Courses & Training' },
  { icon: 'chart', label: 'Reports & Analytics' },
  { icon: 'settings', label: 'System Settings' },
];

const TRUST: { icon: AdmIconName; label: string }[] = [
  { icon: 'shieldCheck', label: 'Role-based Access' },
  { icon: 'monitor', label: 'Encrypted & Secure' },
  { icon: 'clock', label: 'Activity Logging' },
];

/** /admin/login — staff sign in with the same accounts system; non-staff are told they lack access. */
export function AdminLoginPage() {
  const theme = useAdminTheme();
  const { status, reload } = useAdminSession();
  const [params] = useSearchParams();
  const next = params.get('next')?.startsWith('/admin') ? params.get('next')! : '/admin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (status === 'ready') return <Navigate to={next} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login({ email, password, remember: false });
      await reload();
    } catch (err) {
      setError(formErrors(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm" data-theme={theme.resolved}>
      <div className="adm-login">
        <section className="adm-login-brand">
          <BrandLogo size="lg" tagline="Data Recovery Training" />
          <div className="adm-login-hero">
            <div className="adm-login-copy">
              <span className="adm-login-pill">
                <AdmIcon name="shield" size={16} /> Admin Panel
              </span>
              <h1>
                Welcome to <span>Alpha Recover</span> Admin Panel
              </h1>
              <p>Manage students, courses, leads, and the website from one secure dashboard.</p>
              <ul className="adm-login-features">
                {FEATURES.map((f) => (
                  <li key={f.label}>
                    <span className="adm-login-feature-icon">
                      <AdmIcon name={f.icon} size={22} />
                    </span>
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="adm-login-visual" aria-hidden>
              <img src="/assets/hero-drive.webp" alt="" width={900} height={804} />
            </div>
          </div>
        </section>

        <section className="adm-login-panel">
          <div className="adm-login-card">
            {status === 'forbidden' ? (
              <div role="alert">
                <h2>No admin access</h2>
                <p className="adm-login-sub">This account doesn&apos;t have access to the admin panel. Sign in with a staff account.</p>
                <button type="button" className="adm-btn adm-login-submit" onClick={() => void logout().then(reload)}>
                  Sign out and switch account
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit}>
                <h2>Staff Sign In</h2>
                <p className="adm-login-sub">Access the Alpha Recover admin panel</p>
                <div className="adm-field">
                  <label htmlFor="adm-email">Email</label>
                  <div className="adm-input-icon">
                    <AdmIcon name="mail" />
                    <input id="adm-email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                </div>
                <div className="adm-field">
                  <label htmlFor="adm-password">Password</label>
                  <div className="adm-input-icon">
                    <AdmIcon name="lock" />
                    <input
                      id="adm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="adm-input-toggle"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      <AdmIcon name={showPassword ? 'eye' : 'eyeOff'} />
                    </button>
                  </div>
                </div>
                {error ? (
                  <p className="adm-error" role="alert">
                    {error}
                  </p>
                ) : null}
                {status === 'error' ? <p className="adm-error">The admin service is unavailable. Please try again later.</p> : null}
                <button className="adm-btn adm-login-submit" type="submit" disabled={busy}>
                  <AdmIcon name="login" />
                  {busy ? 'Signing in…' : 'Sign In'}
                </button>
                <p className="adm-login-foot">
                  Forgot your password? <Link to="/account?mode=forgot">Reset it here</Link>
                </p>
              </form>
            )}
            <div className="adm-login-secure">
              <span>
                <AdmIcon name="lock" size={14} /> Secure Access
              </span>
            </div>
            <ul className="adm-login-trust">
              {TRUST.map((t) => (
                <li key={t.label}>
                  <span className="adm-login-trust-icon">
                    <AdmIcon name={t.icon} />
                  </span>
                  {t.label}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { login, logout } from '../../lib/auth';
import { formErrors } from '../../lib/leads';
import { useAdminTheme } from '../lib/theme';
import { useAdminSession } from './adminSessionContext';
import '../layout/AdminLayout.css';
import './AdminLogin.css';

/** /admin/login — staff sign in with the same accounts system; non-staff are told they lack access. */
export function AdminLoginPage() {
  const theme = useAdminTheme();
  const { status, reload } = useAdminSession();
  const [params] = useSearchParams();
  const next = params.get('next')?.startsWith('/admin') ? params.get('next')! : '/admin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
          <h1>Alpha Recover</h1>
          <p>Admin panel for leads, students, courses and the website. Staff accounts only.</p>
        </section>
        <section className="adm-login-panel">
          {status === 'forbidden' ? (
            <div role="alert">
              <h2>No admin access</h2>
              <p>This account doesn&apos;t have access to the admin panel. Sign in with a staff account.</p>
              <button type="button" className="adm-btn adm-btn-primary" onClick={() => void logout().then(reload)}>
                Sign out and switch account
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit}>
              <h2>Staff sign in</h2>
              <div className="adm-field">
                <label htmlFor="adm-email">Email</label>
                <input id="adm-email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="adm-field">
                <label htmlFor="adm-password">Password</label>
                <input
                  id="adm-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error ? (
                <p className="adm-error" role="alert">
                  {error}
                </p>
              ) : null}
              {status === 'error' ? <p className="adm-error">The admin service is unavailable. Please try again later.</p> : null}
              <button className="adm-btn adm-btn-primary" type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
              <p className="adm-login-foot">
                Forgot your password? Use <Link to="/account">the account page</Link> to reset it.
              </p>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

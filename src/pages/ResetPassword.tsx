import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../lib/auth';
import { formErrors } from '../lib/leads';
import './SimplePages.css';

/** Landing page for the link in the password-reset email: /reset-password?token=… */
export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      await resetPassword(token, password, confirm);
      setDone(true);
    } catch (err) {
      const { fields, message } = formErrors(err);
      setFieldErrors(fields);
      setError(fields.token ? 'This reset link is invalid or has expired. Request a new one from the login page.' : message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <Link to="/account">My Account</Link>
            <span>/</span>
            <span>Reset password</span>
          </div>
          <h1>Choose a new password</h1>
        </div>
      </div>
      <section className="section">
        <div className="container narrow">
          {!token ? (
            <div className="panel">
              <p className="form-error">This reset link is incomplete. Open the link from your email again, or request a new one.</p>
              <Link className="btn btn-primary" to="/account">
                Back to login
              </Link>
            </div>
          ) : done ? (
            <div className="panel" role="status">
              <p className="form-success">✓ Your password has been changed. For your security, you&apos;ve been signed out on all devices.</p>
              <Link className="btn btn-primary" to="/account">
                Log in
              </Link>
            </div>
          ) : (
            <form className="panel" onSubmit={onSubmit}>
              <div className="field">
                <label htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.password)}
                />
                {fieldErrors.password ? <span className="field-error">{fieldErrors.password}</span> : null}
              </div>
              <div className="field">
                <label htmlFor="confirm-password">Confirm new password</label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                />
                {fieldErrors.confirmPassword ? <span className="field-error">{fieldErrors.confirmPassword}</span> : null}
              </div>
              <p className="note">At least 8 characters. Avoid common passwords.</p>
              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save new password'}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

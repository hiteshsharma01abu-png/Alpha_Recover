import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { REGISTER_COUNTRIES, type CountryCode } from '../../shared/countries';
import { Turnstile } from '../components/ui/Turnstile';
import { company } from '../data/content';
import {
  dismissSignedOutNotice,
  login,
  logout,
  register,
  requestPasswordReset,
  resendVerification,
  useAuth,
} from '../lib/auth';
import { formErrors } from '../lib/leads';
import './Account.css';

type Mode = 'login' | 'register' | 'forgot';

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4.5 7.5 7.5 6 7.5-6" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19.5c1.2-3.2 3.5-4.8 7-4.8s5.8 1.6 7 4.8" />
    </svg>
  );
}

function IconUserPlus() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="10" cy="8" r="3" />
      <path d="M3.5 19c1-2.8 2.9-4.2 6.5-4.2 1.4 0 2.6.3 3.6.8M16.5 10v6M13.5 13h6" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M7.5 4.5h3l1.2 4.2-2 1.2a12 12 0 0 0 5.4 5.4l1.2-2 4.2 1.2v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 5.5 6.7 2 2 0 0 1 7.5 4.5Z" />
    </svg>
  );
}

function IconEye({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 12s3.5-6.5 9-6.5S21 12 21 12s-3.5 6.5-9 6.5S3 12 3 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 5l16 14M9.9 9.9A3 3 0 0 0 12 15a3 3 0 0 0 2.1-.9M7.1 7.4C5 9 3.7 11.1 3 12c0 0 3.5 6.5 9 6.5 1.7 0 3.2-.5 4.5-1.2M12.5 6.6c2.8.2 5.2 1.8 8.5 5.4 0 0-1.1 1.8-2.7 3.3" />
    </svg>
  );
}

function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  required = true,
  error,
  autoComplete = 'current-password',
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="acc-field">
      <label htmlFor={id}>{label}</label>
      <div className="acc-input">
        <span className="acc-input-icon">
          <IconLock />
        </span>
        <input
          id={id}
          name={id}
          type={show ? 'text' : 'password'}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
        />
        <button
          type="button"
          className="acc-eye"
          aria-label={show ? 'Hide password' : 'Show password'}
          onClick={() => setShow((v) => !v)}
        >
          <IconEye open={show} />
        </button>
      </div>
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

const FieldError = ({ msg }: { msg?: string }) => (msg ? <span className="field-error">{msg}</span> : null);

export function Account() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [remember, setRemember] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [country, setCountry] = useState<CountryCode>('IN');
  const [phone, setPhone] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPass2, setRegPass2] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setNote('');
    setFieldErrors({});
  }

  /** Runs an API call with shared busy/error handling. */
  async function run(action: () => Promise<unknown>, onDone?: () => void) {
    setBusy(true);
    setError('');
    setNote('');
    setFieldErrors({});
    try {
      await action();
      onDone?.();
    } catch (err) {
      const { fields, message } = formErrors(err);
      setFieldErrors(fields);
      setError(message);
      setCaptchaReset((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  function onLogin(e: FormEvent) {
    e.preventDefault();
    void run(() => login({ email: loginEmail, password: loginPass, remember }), () => setLoginPass(''));
  }

  function onRegister(e: FormEvent) {
    e.preventDefault();
    if (regPass !== regPass2) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }
    void run(() =>
      register({
        firstName,
        email: regEmail,
        country,
        phone: phone.trim() || undefined,
        password: regPass,
        confirmPassword: regPass2,
        acceptTerms,
        captchaToken: captchaToken ?? undefined,
      }),
    );
  }

  function onForgot(e: FormEvent) {
    e.preventDefault();
    void run(
      () => requestPasswordReset(forgotEmail, captchaToken ?? undefined),
      () => setNote(`If an account exists for ${forgotEmail}, we've sent a link to reset the password. Check your inbox.`),
    );
  }

  function onResend() {
    void run(
      () => resendVerification(),
      () => setNote(`We've sent a new verification link to ${auth.user?.email}.`),
    );
  }

  return (
    <div className="account-page">
      <div className="account-hero">
        <div className="container account-hero-grid">
          <div className="account-hero-copy">
            <div className="breadcrumb">
              <Link to="/">Home</Link>
              <span>/</span>
              <span>My Account</span>
            </div>
            <h1>My Account</h1>
            <p>
              Access your account or create a new one to continue your data recovery learning journey.
            </p>
          </div>

          <div className="account-hero-visual" aria-hidden>
            <div className="account-lock-wrap">
              <span className="account-orbit account-orbit-1" />
              <span className="account-orbit account-orbit-2" />
              <span className="account-dots" />
              <svg className="account-lock-svg" viewBox="0 0 180 160" fill="none">
                <defs>
                  <linearGradient id="accLockGrad" x1="40" y1="30" x2="140" y2="140" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#F0EDE4" />
                    <stop offset="0.55" stopColor="#F0EDE4" />
                    <stop offset="1" stopColor="#4D7A73" />
                  </linearGradient>
                </defs>
                <path
                  d="M62 72V52a28 28 0 0 1 56 0v20"
                  stroke="#F0EDE4"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <rect x="42" y="70" width="96" height="72" rx="18" fill="url(#accLockGrad)" />
                <circle cx="90" cy="100" r="10" fill="#123128" opacity="0.95" />
                <path d="M90 108v18" stroke="#123128" strokeWidth="6" strokeLinecap="round" />
              </svg>
              <div className="account-shield">
                <svg viewBox="0 0 48 56" width="48" height="56" fill="none">
                  <path
                    d="M24 3 42 10v14c0 12.5-8 21.5-18 25.5C14 45.5 6 36.5 6 24V10L24 3Z"
                    fill="#4D7A73"
                  />
                  <path d="m16 27 5.5 5.5L33 21" stroke="#123128" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            <ul className="account-perks">
              <li>
                <span className="account-perk-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M4 19.5V7.8A2.8 2.8 0 0 1 6.8 5H20v12.5H6.8A2.8 2.8 0 0 0 4 20.3" />
                    <path d="M4 19.5A2.8 2.8 0 0 1 6.8 16.8H20" />
                  </svg>
                </span>
                <span>
                  <strong>Continue Learning</strong>
                  <em>Access your courses</em>
                </span>
              </li>
              <li>
                <span className="account-perk-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M7 18a4.5 4.5 0 0 1 .4-9 6 6 0 0 1 11.5 1.6A3.8 3.8 0 0 1 18 18H7Z" />
                  </svg>
                </span>
                <span>
                  <strong>Track Progress</strong>
                  <em>Pick up where you left off</em>
                </span>
              </li>
              <li>
                <span className="account-perk-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M12 3l8 3.5v5.2c0 4.4-3.3 7.8-8 9.3-4.7-1.5-8-4.9-8-9.3V6.5L12 3Z" />
                    <path d="m9.2 12.1 1.9 1.9 3.7-3.8" />
                  </svg>
                </span>
                <span>
                  <strong>Lifetime Access</strong>
                  <em>Learn at your own pace</em>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <section className="account-body">
        <div className="container">
          <div className="account-toggle" role="tablist" aria-label="Account mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode !== 'register'}
              className={mode !== 'register' ? 'is-active' : ''}
              onClick={() => switchMode('login')}
            >
              Login to your account
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'is-active' : ''}
              onClick={() => switchMode('register')}
            >
              Create a new account
            </button>
          </div>

          {auth.signedOutElsewhere ? (
            <p className="account-note" role="status">
              You were signed out. This happens when your session expires or you sign in on another device (up to 2 devices at
              a time).{' '}
              <button type="button" className="account-link" onClick={dismissSignedOutNotice}>
                Dismiss
              </button>
            </p>
          ) : null}
          {auth.unavailable && !auth.user ? (
            <p className="form-error" role="alert">
              Accounts are temporarily unavailable. Please try again later.
            </p>
          ) : null}
          {note ? (
            <p className="account-note success" role="status">
              {note}
            </p>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          {auth.user ? (
            <div className="account-cards">
              <div className="account-card is-active">
                <div className="account-card-head">
                  <span className="account-card-icon" aria-hidden>
                    <IconUser />
                  </span>
                  <div>
                    <h2>Hi, {auth.user.firstName}</h2>
                    <p>You&apos;re signed in as {auth.user.email}</p>
                  </div>
                </div>
                {auth.user.emailVerified ? (
                  <p className="form-success">✓ Your email address is verified.</p>
                ) : (
                  <div className="account-verify">
                    <p>
                      Please verify your email address. We sent a link to <strong>{auth.user.email}</strong>.
                    </p>
                    <button type="button" className="account-link" onClick={onResend} disabled={busy}>
                      Resend verification email
                    </button>
                  </div>
                )}
                <p className="account-soon">
                  Your courses, progress and certificates will appear here once training access is available.
                </p>
                <Link className="account-link" to="/account/settings">
                  Account settings: profile, password and devices →
                </Link>
                <button className="account-submit" type="button" onClick={() => void run(() => logout())} disabled={busy}>
                  Log out
                  <span aria-hidden>→</span>
                </button>
                <button type="button" className="account-link" onClick={() => void run(() => logout(true))} disabled={busy}>
                  Log out of all devices
                </button>
              </div>
            </div>
          ) : (
          <div className="account-cards">
            {mode === 'forgot' ? (
            <form className="account-card is-active" onSubmit={onForgot}>
              <div className="account-card-head">
                <span className="account-card-icon" aria-hidden>
                  <IconLock />
                </span>
                <div>
                  <h2>Reset password</h2>
                  <p>We&apos;ll email you a link to choose a new one</p>
                </div>
              </div>
              <div className="acc-field">
                <label htmlFor="forgot-email">Registered email</label>
                <div className="acc-input">
                  <span className="acc-input-icon">
                    <IconMail />
                  </span>
                  <input
                    id="forgot-email"
                    type="email"
                    inputMode="email"
                    required
                    placeholder="you@email.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    autoComplete="email"
                    spellCheck={false}
                  />
                </div>
                <FieldError msg={fieldErrors.email} />
              </div>
              <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />
              <button className="account-submit" type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send reset link'}
                <span aria-hidden>→</span>
              </button>
              <button type="button" className="account-link" onClick={() => switchMode('login')}>
                Back to login
              </button>
            </form>
            ) : (
            <form
              className={`account-card ${mode === 'login' ? 'is-active' : ''}`}
              onSubmit={onLogin}
            >
              <div className="account-card-head">
                <span className="account-card-icon" aria-hidden>
                  <IconUser />
                </span>
                <div>
                  <h2>Login</h2>
                  <p>Access your existing account</p>
                </div>
              </div>

              <div className="acc-field">
                <label htmlFor="login-email">Registered email</label>
                <div className="acc-input">
                  <span className="acc-input-icon">
                    <IconMail />
                  </span>
                  <input
                    id="login-email"
                    name="login_email"
                    type="text"
                    inputMode="email"
                    required
                    placeholder="you@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    autoComplete="email"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-invalid={Boolean(fieldErrors.email && mode === 'login')}
                  />
                </div>
                <FieldError msg={mode === 'login' ? fieldErrors.email : undefined} />
              </div>

              <PasswordField
                id="login-pass"
                label="Password"
                placeholder="Enter your password"
                value={loginPass}
                onChange={setLoginPass}
                error={mode === 'login' ? fieldErrors.password : undefined}
              />

              <div className="account-row">
                <label className="acc-check">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <span>Remember me</span>
                </label>
                <button type="button" className="account-link" onClick={() => switchMode('forgot')}>
                  Lost your password?
                </button>
              </div>

              <button className="account-submit" type="submit" disabled={busy}>
                {busy && mode === 'login' ? 'Logging in…' : 'Log in'}
                <span aria-hidden>→</span>
              </button>
            </form>
            )}

            <form
              className={`account-card ${mode === 'register' ? 'is-active' : ''}`}
              onSubmit={onRegister}
            >
              <div className="account-card-head">
                <span className="account-card-icon" aria-hidden>
                  <IconUserPlus />
                </span>
                <div>
                  <h2>Create an Account</h2>
                  <p>Join now and start your data recovery learning journey</p>
                </div>
              </div>

              <div className="account-reg-grid">
                <div className="acc-field">
                  <label htmlFor="first">First name</label>
                  <div className="acc-input">
                    <span className="acc-input-icon">
                      <IconUser />
                    </span>
                    <input
                      id="first"
                      name="first_name"
                      required
                      placeholder="Enter your first name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                      aria-invalid={Boolean(fieldErrors.firstName)}
                    />
                  </div>
                  <FieldError msg={fieldErrors.firstName} />
                </div>

                <div className="acc-field">
                  <label htmlFor="reg-email">Email</label>
                  <div className="acc-input">
                    <span className="acc-input-icon">
                      <IconMail />
                    </span>
                    <input
                      id="reg-email"
                      name="reg_email"
                      type="text"
                      inputMode="email"
                      required
                      placeholder="you@email.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      autoComplete="email"
                      spellCheck={false}
                      aria-invalid={Boolean(fieldErrors.email && mode === 'register')}
                    />
                  </div>
                  <FieldError msg={mode === 'register' ? fieldErrors.email : undefined} />
                </div>

                <div className="acc-field">
                  <label htmlFor="country">Country</label>
                  <div className="acc-input acc-select-wrap">
                    <span className="acc-input-icon" aria-hidden>
                      🇮🇳
                    </span>
                    <select
                      id="country"
                      name="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value as CountryCode)}
                      autoComplete="country"
                    >
                      {REGISTER_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="acc-field">
                  <label htmlFor="reg-phone">Phone (optional)</label>
                  <div className="acc-input">
                    <span className="acc-input-icon">
                      <IconPhone />
                    </span>
                    <input
                      id="reg-phone"
                      name="reg_phone"
                      type="text"
                      inputMode="tel"
                      placeholder={company.phoneDisplay}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      autoComplete="tel"
                      aria-invalid={Boolean(fieldErrors.phone)}
                    />
                  </div>
                  <FieldError msg={fieldErrors.phone} />
                </div>

                <PasswordField
                  id="reg-pass"
                  label="Password"
                  placeholder="Create a password"
                  value={regPass}
                  onChange={setRegPass}
                  error={mode === 'register' ? fieldErrors.password : undefined}
                  autoComplete="new-password"
                />

                <PasswordField
                  id="reg-pass2"
                  label="Confirm password"
                  placeholder="Confirm your password"
                  value={regPass2}
                  onChange={setRegPass2}
                  error={fieldErrors.confirmPassword}
                  autoComplete="new-password"
                />
              </div>

              <label className="acc-check account-terms">
                <input type="checkbox" required checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                <span>
                  I agree to the <Link to="/">terms</Link> and <Link to="/">privacy policy</Link>
                </span>
              </label>

              <FieldError msg={fieldErrors.acceptTerms} />
              {mode === 'register' ? <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} /> : null}

              <button className="account-submit" type="submit" disabled={busy}>
                {busy && mode === 'register' ? 'Creating account…' : 'Create account'}
                <span aria-hidden>→</span>
              </button>
            </form>
          </div>
          )}
        </div>
      </section>
    </div>
  );
}

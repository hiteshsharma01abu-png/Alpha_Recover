import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { REGISTER_COUNTRIES, type CountryCode } from '../../shared/countries';
import { PageHero } from '../components/ui/PageHero';
import { Turnstile } from '../components/ui/Turnstile';
import { company } from '../data/content';
import { heroArt } from '../data/pageContent';
import {
  dismissSignedOutNotice,
  login,
  logout,
  register,
  requestPasswordReset,
  resendVerification,
  useAuth,
} from '../lib/auth';
import { icons } from '../lib/icons';
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

function IconLogin() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M10 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
      <path d="M15 12H4" />
      <path d="m12 8 4 4-4 4" />
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

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 19V5M4 19h16" strokeLinecap="round" />
      <path d="M8 15v-4M12 15V8M16 15v-7" strokeLinecap="round" />
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
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'forgot' ? 'forgot' : 'login');
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
      <PageHero
        crumbs={[{ label: 'My Account' }]}
        title="My Account"
        sub="Access your account or create a new one to continue your data recovery learning journey."
        art={heroArt.account}
      >
        {!auth.user ? (
          <div className="account-hero-ctas">
            <button
              type="button"
              className={`account-cta account-cta-primary${mode !== 'register' ? ' is-active' : ''}`}
              onClick={() => switchMode('login')}
            >
              <IconLogin />
              Login
            </button>
            <button
              type="button"
              className={`account-cta account-cta-ghost${mode === 'register' ? ' is-active' : ''}`}
              onClick={() => switchMode('register')}
            >
              <IconUserPlus />
              Create Account
            </button>
          </div>
        ) : null}
      </PageHero>

      <section className="account-body">
        <div className="container">
          <div className="account-alerts">
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
          </div>

          {auth.user ? (
            <div className="account-signed">
              <div className="account-glass account-profile">
                <div className="account-profile-head">
                  <h2>Hi, {auth.user.firstName} 👋</h2>
                  <p>{auth.user.email}</p>
                </div>

                {auth.user.emailVerified ? (
                  <div className="account-verified">
                    <img src={icons.shieldCheck} alt="" width={18} height={18} />
                    <span>Your email address is verified</span>
                  </div>
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

                <div className="account-nav-links">
                  <Link className="account-nav-link" to="/dashboard">
                    <img src={icons.school} alt="" width={20} height={20} />
                    <span>My learning: courses, progress and certificates</span>
                    <img src={icons.chevronRight} alt="" width={16} height={16} />
                  </Link>
                  <Link className="account-nav-link" to="/account/settings">
                    <img src={icons.settings} alt="" width={20} height={20} />
                    <span>Account settings: profile, password and devices</span>
                    <img src={icons.chevronRight} alt="" width={16} height={16} />
                  </Link>
                </div>

                <div className="account-profile-actions">
                  <button
                    className="account-submit"
                    type="button"
                    onClick={() => void run(() => logout())}
                    disabled={busy}
                  >
                    Log out
                    <span aria-hidden>→</span>
                  </button>
                  <button
                    type="button"
                    className="account-link"
                    onClick={() => void run(() => logout(true))}
                    disabled={busy}
                  >
                    Log out of all devices
                  </button>
                </div>
              </div>

              <div className="account-side">
                <Link className="account-glass account-side-card" to="/dashboard">
                  <span className="account-side-icon">
                    <img src={icons.school} alt="" width={20} height={20} />
                  </span>
                  <strong>Continue Learning</strong>
                  <img src={icons.chevronRight} alt="" width={18} height={18} />
                </Link>
                <Link className="account-glass account-side-card" to="/dashboard">
                  <span className="account-side-icon">
                    <IconChart />
                  </span>
                  <strong>Track Progress</strong>
                  <img src={icons.chevronRight} alt="" width={18} height={18} />
                </Link>
                <Link className="account-glass account-side-card" to="/pricing">
                  <span className="account-side-icon">
                    <img src={icons.infinity} alt="" width={20} height={20} />
                  </span>
                  <strong>Lifetime Access</strong>
                  <img src={icons.chevronRight} alt="" width={18} height={18} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="account-cards">
              {mode === 'forgot' ? (
                <form className="account-glass account-card is-active" onSubmit={onForgot}>
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
                  className={`account-glass account-card${mode === 'login' ? ' is-active' : ''}`}
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
                className={`account-glass account-card${mode === 'register' ? ' is-active' : ''}`}
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

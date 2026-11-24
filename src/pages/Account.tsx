import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { REGISTER_COUNTRIES, type CountryCode } from '../../shared/countries';
import { AuthTopBar, LearnerShell } from '../components/layout/LearnerShell';
import { Turnstile } from '../components/ui/Turnstile';
import { company } from '../data/content';
import {
  dismissSignedOutNotice,
  login,
  register,
  requestPasswordReset,
  resendVerification,
  useAuth,
} from '../lib/auth';
import { icons } from '../lib/icons';
import { formErrors } from '../lib/leads';
import { getDashboard } from '../lib/learning';
import { learnerAssets } from '../lib/learnerAssets';
import './Account.css';

type Mode = 'login' | 'register' | 'forgot';

const COUNTRY_FLAG: Record<CountryCode, string> = {
  IN: '🇮🇳',
  US: '🇺🇸',
  GB: '🇬🇧',
  AE: '🇦🇪',
  ZZ: '🌐',
};

const LOGIN_FEATURES = [
  { icon: learnerAssets.iconGraduation, label: 'Expert-led Training' },
  { icon: learnerAssets.iconTarget, label: 'Hands-on Practice' },
  { icon: learnerAssets.iconCheck, label: 'Industry-ready Skills' },
];

const REGISTER_FEATURES = [
  'Access to All Courses',
  'Track Your Progress',
  'Exclusive Resources',
  'Get Expert Support',
];

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
        <span className="acc-input-icon" aria-hidden>
          <img src={learnerAssets.iconLock} alt="" width={18} height={18} />
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
          <img src={learnerAssets.iconEye} alt="" width={18} height={18} />
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
  const [hasActiveEnrollment, setHasActiveEnrollment] = useState(false);

  const userId = auth.user?.id;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    getDashboard()
      .then((d) => {
        if (live) setHasActiveEnrollment(d.hasActiveEnrollment);
      })
      .catch(() => {
        if (live) setHasActiveEnrollment(false);
      });
    return () => {
      live = false;
    };
  }, [userId]);

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

  const alerts = (
    <div className="account-alerts">
      {auth.signedOutElsewhere ? (
        <p className="account-note" role="status">
          You were signed out. This happens when your session expires or you sign in on another device (up to 2 devices at a
          time).{' '}
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
  );

  if (auth.user) {
    return (
      <LearnerShell title={`Hi, ${auth.user.firstName} 👋`} showUpgrade={!hasActiveEnrollment}>
        {alerts}
        <div className="account-signed">
          <div className="account-glass account-profile">
            <div className="account-profile-head">
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
          </div>

          <div className="account-side">
            <Link className="account-glass account-side-card" to="/dashboard">
              <span className="account-side-icon">
                <img src={icons.school} alt="" width={20} height={20} />
              </span>
              <strong>Continue Learning</strong>
              <img src={icons.chevronRight} alt="" width={18} height={18} />
            </Link>
            <Link className="account-glass account-side-card" to="/dashboard#progress">
              <span className="account-side-icon">
                <img src={learnerAssets.iconProgress} alt="" width={20} height={20} />
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
      </LearnerShell>
    );
  }

  const brandPanel =
    mode === 'register' ? (
      <div className="auth-brand">
        <span className="auth-pill">
          <img src={learnerAssets.iconGraduation} alt="" width={16} height={16} />
          Join Alpha Recovery
        </span>
        <h1>Create Your Account</h1>
        <p>Start your data recovery learning journey with expert-led training.</p>
        <ul className="auth-checklist">
          {REGISTER_FEATURES.map((label) => (
            <li key={label}>
              <img src={learnerAssets.iconCheck} alt="" width={18} height={18} />
              <span>{label}</span>
            </li>
          ))}
        </ul>
        <img className="auth-brand-art" src={learnerAssets.hardDrive} alt="" width={420} height={280} />
      </div>
    ) : (
      <div className="auth-brand">
        <span className="auth-pill">
          <img src={learnerAssets.iconGraduation} alt="" width={16} height={16} />
          Data Recovery Training
        </span>
        <h1>{mode === 'forgot' ? 'Reset Your Password' : 'Welcome Back'}</h1>
        <p>
          {mode === 'forgot'
            ? 'Enter your registered email and we will send a reset link.'
            : 'Continue your journey to becoming a data recovery expert.'}
        </p>
        {mode === 'login' ? (
          <ul className="auth-features">
            {LOGIN_FEATURES.map((f) => (
              <li key={f.label}>
                <span className="auth-feature-icon">
                  <img src={f.icon} alt="" width={18} height={18} />
                </span>
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <img className="auth-brand-art" src={learnerAssets.hardDrive} alt="" width={420} height={280} />
      </div>
    );

  return (
    <div className="auth-page">
      <div className="auth-bg" aria-hidden />
      <AuthTopBar />

      <div className="auth-mobile-head">
        <h1>My Account</h1>
        <p>Access your account or create a new one to continue your data recovery learning journey.</p>
        {mode !== 'forgot' ? (
          <div className="account-hero-ctas" role="tablist" aria-label="Account mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={`account-cta account-cta-primary${mode === 'login' ? ' is-active' : ''}`}
              onClick={() => switchMode('login')}
            >
              <img src={learnerAssets.iconUser} alt="" width={18} height={18} />
              Login
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={`account-cta account-cta-ghost${mode === 'register' ? ' is-active' : ''}`}
              onClick={() => switchMode('register')}
            >
              <img src={learnerAssets.iconUserPlus} alt="" width={18} height={18} />
              Create Account
            </button>
          </div>
        ) : null}
      </div>

      <section className="auth-split">
        {brandPanel}

        <div className="auth-panel">
          {alerts}

          {mode === 'forgot' ? (
            <form className="account-glass account-card is-active" onSubmit={onForgot}>
              <div className="account-card-head">
                <span className="account-card-icon" aria-hidden>
                  <img src={learnerAssets.iconLock} alt="" width={20} height={20} />
                </span>
                <div>
                  <h2>Reset password</h2>
                  <p>We&apos;ll email you a link to choose a new one</p>
                </div>
              </div>
              <div className="acc-field">
                <label htmlFor="forgot-email">Registered email</label>
                <div className="acc-input">
                  <span className="acc-input-icon" aria-hidden>
                    <img src={learnerAssets.iconEmail} alt="" width={18} height={18} />
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
          ) : mode === 'login' ? (
            <form className="account-glass account-card is-active" onSubmit={onLogin}>
              <div className="account-card-head">
                <span className="account-card-icon" aria-hidden>
                  <img src={learnerAssets.iconUser} alt="" width={20} height={20} />
                </span>
                <div>
                  <h2>Log in to Your Account</h2>
                  <p>Access your existing account</p>
                </div>
              </div>

              <div className="acc-field">
                <label htmlFor="login-email">Registered email</label>
                <div className="acc-input">
                  <span className="acc-input-icon" aria-hidden>
                    <img src={learnerAssets.iconEmail} alt="" width={18} height={18} />
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
                    aria-invalid={Boolean(fieldErrors.email)}
                  />
                </div>
                <FieldError msg={fieldErrors.email} />
              </div>

              <PasswordField
                id="login-pass"
                label="Password"
                placeholder="Enter your password"
                value={loginPass}
                onChange={setLoginPass}
                error={fieldErrors.password}
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
                {busy ? 'Logging in…' : 'Log In'}
                <span aria-hidden>→</span>
              </button>

              <div className="auth-card-foot">
                <p>Don&apos;t have an account?</p>
                <button type="button" className="account-cta account-cta-ghost auth-switch-btn" onClick={() => switchMode('register')}>
                  <img src={learnerAssets.iconUserPlus} alt="" width={18} height={18} />
                  Create Account
                </button>
              </div>
            </form>
          ) : (
            <form className="account-glass account-card is-active" onSubmit={onRegister}>
              <div className="account-card-head">
                <span className="account-card-icon" aria-hidden>
                  <img src={learnerAssets.iconUserPlus} alt="" width={20} height={20} />
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
                    <span className="acc-input-icon" aria-hidden>
                      <img src={learnerAssets.iconUser} alt="" width={18} height={18} />
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
                    <span className="acc-input-icon" aria-hidden>
                      <img src={learnerAssets.iconEmail} alt="" width={18} height={18} />
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
                      aria-invalid={Boolean(fieldErrors.email)}
                    />
                  </div>
                  <FieldError msg={fieldErrors.email} />
                </div>

                <div className="acc-field">
                  <label htmlFor="country">Country</label>
                  <div className="acc-input acc-select-wrap">
                    <span className="acc-input-icon" aria-hidden>
                      {COUNTRY_FLAG[country]}
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
                    <span className="acc-input-icon" aria-hidden>
                      <img src={learnerAssets.iconPhone} alt="" width={18} height={18} />
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
                  error={fieldErrors.password}
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
                  I agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy-policy">Privacy Policy</Link>
                </span>
              </label>

              <FieldError msg={fieldErrors.acceptTerms} />
              <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />

              <button className="account-submit" type="submit" disabled={busy}>
                {busy ? 'Creating account…' : 'Create Account'}
                <span aria-hidden>→</span>
              </button>

              <div className="auth-card-foot">
                <p>Already have an account?</p>
                <button type="button" className="account-cta account-cta-ghost auth-switch-btn" onClick={() => switchMode('login')}>
                  <img src={learnerAssets.iconUser} alt="" width={18} height={18} />
                  Log In
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

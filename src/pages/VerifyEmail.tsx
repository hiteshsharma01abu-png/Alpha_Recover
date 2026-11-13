import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { verifyEmail } from '../lib/auth';
import './SimplePages.css';

type Status = 'checking' | 'verified' | 'invalid' | 'error';

/** Landing page for the link in the verification email: /verify-email?token=… */
export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState<Status>(token ? 'checking' : 'invalid');
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true; // tokens are single-use: don't send twice under StrictMode
    verifyEmail(token)
      .then(() => setStatus('verified'))
      .catch((err: unknown) => setStatus(err instanceof ApiError && err.status === 400 ? 'invalid' : 'error'));
  }, [token]);

  return (
    <div>
      <div className="page-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <span>Verify email</span>
          </div>
          <h1>Verify email</h1>
        </div>
      </div>
      <section className="section">
        <div className="container narrow">
          <div className="panel" aria-live="polite">
            {status === 'checking' ? <p>Verifying your email address…</p> : null}
            {status === 'verified' ? (
              <>
                <p className="form-success">✓ Your email address is verified. Thank you!</p>
                <Link className="btn btn-primary" to="/account">
                  Go to my account
                </Link>
              </>
            ) : null}
            {status === 'invalid' ? (
              <>
                <p className="form-error">This verification link is invalid or has expired.</p>
                <p>Log in to your account to send a new link.</p>
                <Link className="btn btn-primary" to="/account">
                  Go to my account
                </Link>
              </>
            ) : null}
            {status === 'error' ? (
              <p className="form-error">We couldn&apos;t verify your email right now. Please try the link again later.</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import './SimplePages.css';

type Verification = {
  code: string;
  status: 'valid' | 'revoked';
  recipientName: string;
  programTitle: string;
  issuedAt: string;
  revokedAt?: string;
};

type Result =
  | { kind: 'found'; cert: Verification }
  | { kind: 'not_found'; code: string }
  | { kind: 'error'; message: string };

/** "2026-10-02" → "2 October 2026" */
const longDate = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export function VerifyCertificate() {
  const [params, setParams] = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const autoChecked = useRef(false);

  async function check(raw: string) {
    const value = raw.trim().toUpperCase();
    if (!value) return;
    setChecking(true);
    setResult(null);
    try {
      const res = await api.get<Verification>(`/certificates/verify/${encodeURIComponent(value)}`);
      setResult({ kind: 'found', cert: res.data });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setResult({ kind: 'not_found', code: value });
      else if (err instanceof ApiError && err.code === 'RATE_LIMITED') setResult({ kind: 'error', message: err.message });
      else setResult({ kind: 'error', message: 'Verification is temporarily unavailable. Please try again later.' });
    } finally {
      setChecking(false);
    }
  }

  // Links from a certificate's QR code arrive as /verify-certificate?code=AR-2026-00421
  useEffect(() => {
    const fromLink = params.get('code');
    if (fromLink && !autoChecked.current) {
      autoChecked.current = true;
      void check(fromLink);
    }
  }, [params]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setParams(code.trim() ? { code: code.trim().toUpperCase() } : {}, { replace: true });
    void check(code);
  }

  return (
    <div>
      <div className="page-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <span>Verify Certificate</span>
          </div>
          <h1>Verify Certificate</h1>
        </div>
      </div>
      <section className="section">
        <div className="container narrow">
          <form className="panel" onSubmit={onSubmit}>
            <p>Enter the certificate ID printed on the trainee’s certificate.</p>
            <div className="field">
              <label htmlFor="code">Certificate ID</label>
              <input
                id="code"
                name="code"
                required
                placeholder="e.g. AR-2026-00421"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={checking}>
              {checking ? 'Checking…' : 'Verify'}
            </button>

            {result?.kind === 'found' ? (
              <div className={`cert-result cert-result--${result.cert.status}`} role="status">
                <p className="cert-result-status">
                  {result.cert.status === 'valid' ? '✓ Valid certificate' : '✕ This certificate has been revoked'}
                </p>
                <dl>
                  <dt>Certificate ID</dt>
                  <dd>{result.cert.code}</dd>
                  <dt>Awarded to</dt>
                  <dd>{result.cert.recipientName}</dd>
                  <dt>Program</dt>
                  <dd>{result.cert.programTitle}</dd>
                  <dt>Issued</dt>
                  <dd>{longDate(result.cert.issuedAt)}</dd>
                  {result.cert.revokedAt ? (
                    <>
                      <dt>Revoked</dt>
                      <dd>{longDate(result.cert.revokedAt)}</dd>
                    </>
                  ) : null}
                </dl>
              </div>
            ) : null}
            {result?.kind === 'not_found' ? (
              <p className="form-error" role="alert">
                No certificate found with ID “{result.code}”. Check the ID and try again, or{' '}
                <Link to="/contact">contact us</Link>.
              </p>
            ) : null}
            {result?.kind === 'error' ? (
              <p className="form-error" role="alert">
                {result.message}
              </p>
            ) : null}
          </form>
        </div>
      </section>
    </div>
  );
}

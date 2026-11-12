import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import './SimplePages.css';

export function VerifyCertificate() {
  const [result, setResult] = useState('');

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const code = String(data.get('code') || '').trim();
    if (!code) return;
    setResult(
      `Checked “${code}” in the UI. Certificate lookup needs a certificates table + API.`,
    );
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
              <input id="code" name="code" required placeholder="e.g. AR-2026-00421" />
            </div>
            <button className="btn btn-primary" type="submit">
              Verify
            </button>
            {result && <p className="success">{result}</p>}
          </form>
        </div>
      </section>
    </div>
  );
}

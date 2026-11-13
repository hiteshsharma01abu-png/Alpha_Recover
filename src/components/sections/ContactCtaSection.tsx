import { useState } from 'react';
import type { FormEvent } from 'react';
import { icons } from '../../lib/icons';
import { formErrors, submitLead } from '../../lib/leads';
import { useSiteSettings } from '../../lib/settings';
import { Reveal } from '../ui/Reveal';
import { Turnstile } from '../ui/Turnstile';
import './ContactCtaSection.css';

type ContactCtaSectionProps = {
  /** Hide the large section title (use on /contact where page-hero already titles the page). */
  hideHead?: boolean;
};

export function ContactCtaSection({ hideHead = false }: ContactCtaSectionProps) {
  const { company } = useSiteSettings();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get('cta_email_callback') ?? '').trim();
    setSubmitting(true);
    setFieldErrors({});
    setFormError('');
    try {
      await submitLead(
        { source: 'callback', phone: String(data.get('cta_phone_callback') ?? ''), email: email || undefined },
        { captchaToken, website: String(data.get('website') ?? '') },
      );
      setSent(true);
    } catch (err) {
      const { fields, message } = formErrors(err);
      setFieldErrors(fields);
      setFormError(Object.keys(fields).length ? Object.values(fields)[0] : message);
      setCaptchaReset((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Reveal as="section" className="section cta-section">
      <div className="container">
        <div className="cta-card">
          <div className="cta-copy">
            {!hideHead ? (
              <>
                <p className="cta-kicker">
                  Get in touch
                  <span className="cta-kicker-line" aria-hidden />
                </p>
                <h2>
                  Ready to start your <em>data recovery journey?</em>
                </h2>
              </>
            ) : (
              <h2>
                Ready to start your <em>data recovery journey?</em>
              </h2>
            )}
            <p className="cta-lead">
              Call <a href={company.phoneHref}>{company.phoneDisplay}</a> or write{' '}
              <a href={`mailto:${company.email}`}>{company.email}</a>. We are based in{' '}
              {company.address}.
            </p>

            {sent ? (
              <p className="form-success cta-form" role="status">
                Thanks! We&apos;ll call you back within 24 hours (Mon – Sat, 9 AM – 6 PM IST).
              </p>
            ) : (
              <form className="cta-form" onSubmit={onSubmit} autoComplete="off">
                <label className="cta-input">
                  <span className="cta-input-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M7.5 4.5h3l1.2 4.2-2 1.2a12 12 0 0 0 5.4 5.4l1.2-2 4.2 1.2v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 5.5 6.7 2 2 0 0 1 7.5 4.5Z" />
                    </svg>
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    name="cta_phone_callback"
                    required
                    placeholder="Your phone number"
                    aria-label="Phone number"
                    aria-invalid={Boolean(fieldErrors.phone)}
                  />
                </label>
                <label className="cta-input">
                  <span className="cta-input-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m4 7 8 6 8-6" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    inputMode="email"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    name="cta_email_callback"
                    placeholder="Email (optional)"
                    aria-label="Email (optional)"
                    aria-invalid={Boolean(fieldErrors.email)}
                  />
                </label>
                <div className="hp-field" aria-hidden="true">
                  <label htmlFor="cta-website">Website</label>
                  <input id="cta-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
                </div>
                <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />
                <button className="cta-submit" type="submit" disabled={submitting}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
                    <path d="M8 6.5v11l9-5.5-9-5.5Z" />
                  </svg>
                  {submitting ? 'Sending…' : 'Request callback'}
                  <span aria-hidden>›</span>
                </button>
                {formError ? (
                  <p className="form-error" role="alert" style={{ flexBasis: '100%' }}>
                    {formError}
                  </p>
                ) : null}
              </form>
            )}

            <div className="cta-trust">
              <div className="cta-trust-item">
                <span className="cta-trust-icon" aria-hidden>
                  <img src={icons.headphones} alt="" width={16} height={16} decoding="async" />
                </span>
                <div>
                  <strong>Quick Response</strong>
                  <span>We usually reply within 24 hours.</span>
                </div>
              </div>
              <div className="cta-trust-item">
                <span className="cta-trust-icon" aria-hidden>
                  <img src={icons.shieldCheck} alt="" width={16} height={16} decoding="async" />
                </span>
                <div>
                  <strong>Secure &amp; Confidential</strong>
                  <span>Your data and queries are safe.</span>
                </div>
              </div>
              <div className="cta-trust-item">
                <span className="cta-trust-icon" aria-hidden>
                  <img src={icons.users} alt="" width={16} height={16} decoding="async" />
                </span>
                <div>
                  <strong>Expert Support</strong>
                  <span>Talk directly to our team.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

import type { FormEvent } from 'react';
import { company } from '../../data/content';
import { icons } from '../../lib/icons';
import { Reveal } from '../ui/Reveal';
import './ContactCtaSection.css';

type ContactCtaSectionProps = {
  /** Hide the large section title (use on /contact where page-hero already titles the page). */
  hideHead?: boolean;
};

export function ContactCtaSection({ hideHead = false }: ContactCtaSectionProps) {
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    alert('Thanks — backend wiring comes next. We will store leads once you choose a stack.');
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

            <form className="cta-form" onSubmit={onSubmit} autoComplete="off">
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
                  required
                  placeholder="Your email address"
                  aria-label="Email"
                />
              </label>
              <button className="cta-submit" type="submit">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
                  <path d="M8 6.5v11l9-5.5-9-5.5Z" />
                </svg>
                Request callback
                <span aria-hidden>›</span>
              </button>
            </form>

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

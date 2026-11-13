import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LEAD_REASONS, type LeadReason } from '../../shared/leads';
import { Turnstile } from '../components/ui/Turnstile';
import { formErrors, submitLead } from '../lib/leads';
import { useSiteSettings } from '../lib/settings';
import './SimplePages.css';

export function Contact() {
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
    const text = (name: string) => String(data.get(name) ?? '');
    setSubmitting(true);
    setFieldErrors({});
    setFormError('');
    try {
      await submitLead(
        {
          source: 'contact_form',
          name: text('contact_full_name'),
          email: text('contact_email_address'),
          phone: text('contact_phone_number'),
          reason: text('contact_reason') as LeadReason,
          message: text('contact_message_body'),
          whatsappConsent: data.get('contact_whatsapp_consent') === 'on',
        },
        { captchaToken, website: text('website') },
      );
      setSent(true);
    } catch (err) {
      const { fields, message } = formErrors(err);
      setFieldErrors(fields);
      setFormError(message);
      setCaptchaReset((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  }

  const fieldError = (key: string) =>
    fieldErrors[key] ? (
      <span className="field-error" id={`contact-${key}-error`}>
        {fieldErrors[key]}
      </span>
    ) : null;

  return (
    <div className="contact-page">
      <div className="contact-page-top">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <span>Contact</span>
          </div>
        </div>
      </div>

      <section className="section contact-page-section">
        <div className="container contact-page-grid">
          <div className="contact-page-info">
            <h1>
              Get in <em>Touch</em>
            </h1>
            <p className="contact-page-lead">
              Have a question about our training, pricing or support? We&apos;re here to help.
            </p>

            <div className="contact-info-cards">
              <a className="contact-info-card" href={company.phoneHref}>
                <span className="contact-info-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M7.5 4.5h3l1.2 4.2-2 1.2a12 12 0 0 0 5.4 5.4l1.2-2 4.2 1.2v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 5.5 6.7 2 2 0 0 1 7.5 4.5Z" />
                  </svg>
                </span>
                <span>
                  <strong>{company.phoneDisplay}</strong>
                  <span>{company.hours}</span>
                </span>
              </a>

              <a className="contact-info-card" href={`mailto:${company.email}`}>
                <span className="contact-info-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
                    <path d="m4.5 7.5 7.5 6 7.5-6" />
                  </svg>
                </span>
                <span>
                  <strong>{company.email}</strong>
                  <span>{company.replyNote}</span>
                </span>
              </a>

              <div className="contact-info-card">
                <span className="contact-info-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 21s-6.5-5.2-6.5-10a6.5 6.5 0 1 1 13 0c0 4.8-6.5 10-6.5 10Z" />
                    <circle cx="12" cy="11" r="2.2" />
                  </svg>
                </span>
                <span>
                  <strong>{company.addressFull}</strong>
                  <span>{company.visitNote}</span>
                </span>
              </div>
            </div>
          </div>

          <form className="contact-page-form" onSubmit={onSubmit} autoComplete="off">
            <h2>Send us a message</h2>

            {sent ? (
              <p className="success" role="status">
                Thanks! Your message has been sent. We&apos;ll reply within 24 hours.
              </p>
            ) : (
              <>
                <div className="contact-form-grid">
                  <div className="field">
                    <label htmlFor="name">Name</label>
                    <input
                      id="name"
                      name="contact_full_name"
                      required
                      placeholder="Your name"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="words"
                      spellCheck={false}
                      aria-invalid={Boolean(fieldErrors.name)}
                      aria-describedby={fieldErrors.name ? 'contact-name-error' : undefined}
                    />
                    {fieldError('name')}
                  </div>
                  <div className="field">
                    <label htmlFor="email">Email</label>
                    <input
                      id="email"
                      name="contact_email_address"
                      type="text"
                      inputMode="email"
                      required
                      placeholder="you@email.com"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={fieldErrors.email ? 'contact-email-error' : undefined}
                    />
                    {fieldError('email')}
                  </div>
                  <div className="field">
                    <label htmlFor="phone">Phone</label>
                    <input
                      id="phone"
                      name="contact_phone_number"
                      type="text"
                      inputMode="tel"
                      required
                      placeholder={company.phoneDisplay}
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-invalid={Boolean(fieldErrors.phone)}
                      aria-describedby={fieldErrors.phone ? 'contact-phone-error' : undefined}
                    />
                    {fieldError('phone')}
                  </div>
                  <div className="field">
                    <label htmlFor="reason">Reason for contact</label>
                    <select id="reason" name="contact_reason" defaultValue="training" autoComplete="off">
                      {LEAD_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    {fieldError('reason')}
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="message">Message</label>
                  <textarea
                    id="message"
                    name="contact_message_body"
                    required
                    placeholder="How can we help?"
                    rows={5}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-invalid={Boolean(fieldErrors.message)}
                    aria-describedby={fieldErrors.message ? 'contact-message-error' : undefined}
                  />
                  {fieldError('message')}
                </div>

                <div className="hp-field" aria-hidden="true">
                  <label htmlFor="contact-website">Website</label>
                  <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
                </div>

                <label className="check">
                  <input type="checkbox" name="contact_whatsapp_consent" />
                  <span>I agree to receive updates on WhatsApp / SMS</span>
                </label>

                <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />

                {formError ? (
                  <p className="form-error" role="alert">
                    {formError}
                  </p>
                ) : null}

                <button className="contact-send-btn" type="submit" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send message'}
                  <span aria-hidden>→</span>
                </button>
              </>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}

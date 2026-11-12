import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { company } from '../data/content';
import './SimplePages.css';

export function Contact() {
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSent(true);
  }

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
              <p className="success">
                Message captured in the UI. Connect a backend to email / CRM / WhatsApp notify.
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
                    />
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
                    />
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
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="reason">Reason for contact</label>
                    <select id="reason" name="contact_reason" defaultValue="Training" autoComplete="off">
                      <option>Technical Support</option>
                      <option>Software / hardware sale</option>
                      <option>Data Recovery services</option>
                      <option>Training</option>
                      <option>Other</option>
                    </select>
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
                  />
                </div>

                <label className="check">
                  <input type="checkbox" />
                  <span>I agree to receive updates on WhatsApp / SMS</span>
                </label>

                <button className="contact-send-btn" type="submit">
                  Send message
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

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { company, services } from '../../data/content';
import { icons } from '../../lib/icons';
import './Footer.css';

const FOOTER_BG = '/assets/footer-bg.webp';

const serviceIcons: Record<string, string> = {
  'CCTV / DVR drive data recovery': icons.cctv,
  'Data destruction & wiping': icons.shredder,
  'Encrypted data recovery': icons.lock,
  'Flash data recovery': icons.flash,
  'Hard drive data recovery': icons.hardDrive,
  'Laptop repairing': icons.laptop,
  'Mobile data recovery': icons.cellphone,
  'Scrap hard disk repairing': icons.tools,
  'SSD drive data recovery': icons.memory,
};

const infoLinks = [
  { to: '/about', label: 'About Us', icon: icons.info },
  { to: '/blog', label: 'Blog', icon: icons.blog },
  { to: '/verify-certificate', label: 'Verify Certificate', icon: icons.certificate },
  { to: '/industries', label: 'Industries', icon: icons.domain },
  { to: '/contact', label: 'Contact', icon: icons.mail },
  { to: '/pricing', label: 'Pricing', icon: icons.tag },
];

const highlights = [
  { label: 'Expert Training', icon: icons.school },
  { label: 'Safe & Secure', icon: icons.shieldCheck },
  { label: 'Trusted Support', icon: icons.headphones },
];

const social = [
  { href: 'https://youtube.com', label: 'YouTube', icon: icons.youtube, className: 'yt' },
  { href: 'https://linkedin.com', label: 'LinkedIn', icon: icons.linkedin, className: 'in' },
  { href: 'https://facebook.com', label: 'Facebook', icon: icons.facebook, className: 'fb' },
  { href: 'https://instagram.com', label: 'Instagram', icon: icons.instagram, className: 'ig' },
];

export function Footer() {
  const [desktop, setDesktop] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 981px)');
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return (
    <footer
      id="footer"
      className="site-footer"
      style={{
        backgroundImage: `url(${FOOTER_BG})`,
      }}
    >
      <div className="footer-inner">
        <div className="footer-shell">
          <div className="footer-grid">
            <div className="footer-brand-col">
              <div className="footer-logo">
                <span className="brand-mark" aria-hidden>
                  <span className="brand-ring" />
                  <span className="brand-hub" />
                </span>
                <strong className="footer-brand-name">
                  <span className="footer-brand-alpha">Alpha</span>{' '}
                  <span className="footer-brand-recover">Recover</span>
                </strong>
              </div>
              <p className="footer-brand-tag">Data Recovery Training</p>

              <p className="footer-lead">
                Online data recovery training and professional recovery services from Ahmedabad —
                practical lessons for technicians who need results on real drives.
              </p>

              <div className="footer-highlights">
                {highlights.map((h) => (
                  <div className="footer-highlight" key={h.label}>
                    <span className="footer-highlight-icon" aria-hidden>
                      <img src={h.icon} alt="" width={18} height={18} decoding="async" />
                    </span>
                    <span>{h.label}</span>
                  </div>
                ))}
              </div>

              <div className="footer-card">
                <div className="footer-card-row">
                  <span className="footer-card-icon" aria-hidden>
                    <img src={icons.mapPin} alt="" width={16} height={16} decoding="async" />
                  </span>
                  <span>{company.addressFull}</span>
                </div>
                <div className="footer-card-row">
                  <span className="footer-card-icon" aria-hidden>
                    <img src={icons.mail} alt="" width={16} height={16} decoding="async" />
                  </span>
                  <a href={`mailto:${company.email}`}>{company.email}</a>
                </div>
                <div className="footer-card-row">
                  <span className="footer-card-icon" aria-hidden>
                    <img src={icons.phone} alt="" width={16} height={16} decoding="async" />
                  </span>
                  <a href={company.phoneHref}>{company.phoneDisplay}</a>
                </div>
              </div>
            </div>

            <details
              key={desktop ? 'services-desk' : 'services-mob'}
              className="footer-col footer-services-col"
              open={desktop || undefined}
            >
              <summary className="footer-heading">
                <img src={icons.layers} alt="" width={16} height={16} decoding="async" />
                Our Services
                <span className="footer-acc-chevron" aria-hidden />
              </summary>
              <ul className="footer-links">
                {services.map((s) => (
                  <li key={s}>
                    <Link to="/services">
                      <span className="footer-link-icon" aria-hidden>
                        <img
                          src={serviceIcons[s] ?? icons.chip}
                          alt=""
                          width={14}
                          height={14}
                          decoding="async"
                        />
                      </span>
                      <span>{s}</span>
                      <span className="footer-chevron" aria-hidden>
                        ›
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>

            <details
              key={desktop ? 'info-desk' : 'info-mob'}
              className="footer-col footer-info-col"
              open={desktop || undefined}
            >
              <summary className="footer-heading">
                <img src={icons.info} alt="" width={16} height={16} decoding="async" />
                Information
                <span className="footer-acc-chevron" aria-hidden />
              </summary>
              <ul className="footer-links">
                {infoLinks.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to}>
                      <span className="footer-link-icon" aria-hidden>
                        <img src={l.icon} alt="" width={14} height={14} decoding="async" />
                      </span>
                      <span>{l.label}</span>
                      <span className="footer-chevron" aria-hidden>
                        ›
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>

            <div className="footer-touch-col">
              <details
                key={desktop ? 'touch-desk' : 'touch-mob'}
                className="footer-col footer-touch-acc"
                open
              >
                <summary className="footer-heading">
                  Get in Touch
                  <span className="footer-acc-chevron" aria-hidden />
                </summary>
                <ul className="footer-touch">
                  <li>
                    <span className="footer-touch-icon" aria-hidden>
                      <img src={icons.phone} alt="" width={18} height={18} decoding="async" />
                    </span>
                    <div>
                      <small>Call Us</small>
                      <a href={company.phoneHref}>{company.phoneDisplay}</a>
                    </div>
                  </li>
                  <li>
                    <span className="footer-touch-icon" aria-hidden>
                      <img src={icons.mail} alt="" width={18} height={18} decoding="async" />
                    </span>
                    <div>
                      <small>Email Us</small>
                      <a href={`mailto:${company.email}`}>{company.email}</a>
                    </div>
                  </li>
                  <li>
                    <span className="footer-touch-icon" aria-hidden>
                      <img src={icons.mapPin} alt="" width={18} height={18} decoding="async" />
                    </span>
                    <div>
                      <small>Our Location</small>
                      <strong>{company.address}</strong>
                    </div>
                  </li>
                </ul>
              </details>

              <h4 className="footer-subheading">Quick Connect</h4>
              <div className="footer-actions">
                <a
                  className="footer-btn footer-btn-solid"
                  href={company.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img src={icons.whatsapp} alt="" width={16} height={16} decoding="async" />
                  Chat on WhatsApp
                  <span aria-hidden>›</span>
                </a>
                <Link className="footer-btn footer-btn-outline" to="/contact">
                  <img src={icons.phone} alt="" width={16} height={16} decoding="async" />
                  Request Callback
                  <span aria-hidden>→</span>
                </Link>
              </div>

              <div className="footer-social">
                {social.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={s.label}
                    className={`social ${s.className}`}
                  >
                    <img src={s.icon} alt="" width={18} height={18} decoding="async" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Alpha Recover®. All rights reserved.</span>
            <div className="footer-legal">
              <Link to="/about">Privacy Policy</Link>
              <span>|</span>
              <Link to="/about">Terms &amp; Conditions</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

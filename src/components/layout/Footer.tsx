import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { brandLogo, services, type SocialPlatform } from '../../data/content';
import { useSiteSettings } from '../../lib/settings';
import { icons } from '../../lib/icons';
import './Footer.css';

const FOOTER_BG = '/assets/images/backgrounds/footer-bg.webp';

type AccordionPanel = 'services' | 'info' | 'touch';

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
  { to: '/training', label: 'Courses', icon: icons.school },
  { to: '/demos', label: 'Demo Videos', icon: icons.video },
];

const highlights = [
  { label: 'Expert Training', icon: icons.school },
  { label: 'Safe & Secure', icon: icons.shieldCheck },
  { label: 'Trusted Support', icon: icons.headphones },
];

/** Icon and style per platform; the URLs come from site settings. */
const socialStyle: Record<SocialPlatform, { label: string; icon: string; className: string }> = {
  youtube: { label: 'YouTube', icon: icons.youtube, className: 'yt' },
  linkedin: { label: 'LinkedIn', icon: icons.linkedin, className: 'in' },
  facebook: { label: 'Facebook', icon: icons.facebook, className: 'fb' },
  instagram: { label: 'Instagram', icon: icons.instagram, className: 'ig' },
};

function TrustHighlights({ className }: { className?: string }) {
  return (
    <div className={className ? `footer-highlights ${className}` : 'footer-highlights'}>
      {highlights.map((h) => (
        <div className="footer-highlight" key={h.label}>
          <span className="footer-highlight-icon" aria-hidden>
            <img src={h.icon} alt="" width={18} height={18} decoding="async" />
          </span>
          <span>{h.label}</span>
        </div>
      ))}
    </div>
  );
}

function SocialLinks({
  social,
  className,
}: {
  social: { href: string; label: string; icon: string; className: string }[];
  className?: string;
}) {
  if (!social.length) return null;
  return (
    <div className={className ? `footer-social ${className}` : 'footer-social'}>
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
  );
}

function QuickConnect({ whatsapp }: { whatsapp: string }) {
  return (
    <div className="footer-actions">
      <a className="footer-btn footer-btn-solid" href={whatsapp} target="_blank" rel="noreferrer">
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
  );
}

export function Footer() {
  const { company, socialLinks } = useSiteSettings();
  const social = socialLinks.map((s) => ({ href: s.url, ...socialStyle[s.platform] }));
  const [desktop, setDesktop] = useState(true);
  const [openPanel, setOpenPanel] = useState<AccordionPanel | null>(null);
  const baseId = useId();

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 981px)');
    const sync = () => {
      const isDesktop = mq.matches;
      setDesktop(isDesktop);
      if (isDesktop) setOpenPanel(null);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  function togglePanel(panel: AccordionPanel) {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  }

  function panelOpen(panel: AccordionPanel) {
    return desktop || openPanel === panel;
  }

  const servicesId = `${baseId}-services`;
  const infoId = `${baseId}-info`;
  const touchId = `${baseId}-touch`;

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
              <img
                className="footer-logo"
                src={brandLogo.footer}
                alt={`${company.name}: Professional Data Recovery Training`}
                width={660}
                height={240}
                loading="lazy"
              />

              <p className="footer-lead">
                Online data recovery training and recovery services from Ahmedabad — practical
                lessons for technicians on real drives.
              </p>

              {!desktop ? <TrustHighlights className="footer-trust-mobile" /> : null}

              {desktop ? <SocialLinks social={social} className="footer-social-brand" /> : null}
            </div>

            <nav className="footer-col footer-services-col" aria-labelledby={`${baseId}-services-heading`}>
              {desktop ? (
                <h3 id={`${baseId}-services-heading`} className="footer-heading">
                  <img src={icons.layers} alt="" width={16} height={16} decoding="async" />
                  Our Services
                </h3>
              ) : (
                <button
                  type="button"
                  id={`${baseId}-services-heading`}
                  className="footer-heading"
                  aria-expanded={panelOpen('services')}
                  aria-controls={servicesId}
                  onClick={() => togglePanel('services')}
                >
                  <img src={icons.layers} alt="" width={16} height={16} decoding="async" />
                  Our Services
                  <span className="footer-acc-chevron" aria-hidden />
                </button>
              )}
              {panelOpen('services') ? (
                <ul className="footer-links" id={servicesId}>
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
              ) : null}
            </nav>

            <nav className="footer-col footer-info-col" aria-labelledby={`${baseId}-info-heading`}>
              {desktop ? (
                <h3 id={`${baseId}-info-heading`} className="footer-heading">
                  <img src={icons.info} alt="" width={16} height={16} decoding="async" />
                  Information
                </h3>
              ) : (
                <button
                  type="button"
                  id={`${baseId}-info-heading`}
                  className="footer-heading"
                  aria-expanded={panelOpen('info')}
                  aria-controls={infoId}
                  onClick={() => togglePanel('info')}
                >
                  <img src={icons.info} alt="" width={16} height={16} decoding="async" />
                  Information
                  <span className="footer-acc-chevron" aria-hidden />
                </button>
              )}
              {panelOpen('info') ? (
                <ul className="footer-links" id={infoId}>
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
              ) : null}
            </nav>

            <div className="footer-touch-col">
              <div className="footer-col footer-touch-acc" aria-labelledby={`${baseId}-touch-heading`}>
                {desktop ? (
                  <h3 id={`${baseId}-touch-heading`} className="footer-heading">
                    Get in Touch
                  </h3>
                ) : (
                  <button
                    type="button"
                    id={`${baseId}-touch-heading`}
                    className="footer-heading"
                    aria-expanded={panelOpen('touch')}
                    aria-controls={touchId}
                    onClick={() => togglePanel('touch')}
                  >
                    Get in Touch
                    <span className="footer-acc-chevron" aria-hidden />
                  </button>
                )}
                {panelOpen('touch') ? (
                  <ul className="footer-touch" id={touchId}>
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
                        <strong>{company.addressFull}</strong>
                      </div>
                    </li>
                  </ul>
                ) : null}
              </div>

              {desktop ? (
                <>
                  <h4 className="footer-subheading">Quick Connect</h4>
                  <QuickConnect whatsapp={company.whatsapp} />
                </>
              ) : null}
            </div>
          </div>

          {!desktop ? (
            <div className="footer-mobile-connect">
              <h4 className="footer-subheading">Quick Connect</h4>
              <QuickConnect whatsapp={company.whatsapp} />
              <SocialLinks social={social} className="footer-social-mobile" />
            </div>
          ) : null}

          {desktop ? <TrustHighlights className="footer-trust-strip" /> : null}

          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Alpha Recovery®. All rights reserved.</span>
            <div className="footer-legal">
              <Link to="/privacy-policy">Privacy Policy</Link>
              <span>|</span>
              <Link to="/terms">Terms &amp; Conditions</Link>
              <span>|</span>
              <Link to="/refund-policy">Refund Policy</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

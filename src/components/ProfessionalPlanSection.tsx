import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { company, pricing } from '../data/content';
import { Reveal } from './Reveal';
import { icons } from '../lib/icons';
import {
  pricingFeatureIcons,
  pricingHeroVisual,
  pricingMobileFeatureIndexes,
  pricingPerks,
  pricingSectionBg,
} from './pricingVisuals';
import '../pages/Home.css';

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function useIsNarrow(maxWidth = 980) {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [maxWidth]);

  return narrow;
}

function Countdown() {
  const end = useMemo(() => Date.now() + 1000 * 60 * 60 * 52 + 1000 * 60 * 18 + 1000 * 40, []);
  const [left, setLeft] = useState(end - Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setLeft(Math.max(0, end - Date.now())), 1000);
    return () => window.clearInterval(id);
  }, [end]);

  const total = Math.floor(left / 1000);
  const days = Math.floor(total / 86400);
  const hrs = Math.floor((total % 86400) / 3600);
  const min = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const cells = [
    { label: 'Days', value: days },
    { label: 'Hrs', value: hrs },
    { label: 'Min', value: min },
    { label: 'Sec', value: sec },
  ];

  return (
    <div className="pp-countdown" aria-label="Sale countdown">
      {cells.map((c) => (
        <div key={c.label} className="pp-countdown-cell">
          <strong>{String(c.value).padStart(2, '0')}</strong>
          <span>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 6h2l1.2 10.2a1.5 1.5 0 0 0 1.5 1.3h8.6a1.5 1.5 0 0 0 1.5-1.3L20 8H7" />
      <circle cx="10" cy="20" r="1.2" />
      <circle cx="17" cy="20" r="1.2" />
    </svg>
  );
}

function WhatsAppIcon() {
  return <img src={icons.whatsapp} alt="" width={16} height={16} decoding="async" aria-hidden />;
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </svg>
  );
}

type ProfessionalPlanSectionProps = {
  buyMode?: 'link' | 'checkout';
  hideHead?: boolean;
};

const MOBILE_FEATURES_PREVIEW = 3;

export function ProfessionalPlanSection({
  buyMode = 'link',
  hideHead = false,
}: ProfessionalPlanSectionProps) {
  const narrow = useIsNarrow(980);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const offPct = Math.round(((pricing.was - pricing.now) / pricing.was) * 100);
  const allFeatureIndexes = narrow
    ? pricingMobileFeatureIndexes
    : pricing.features.map((_, i) => i);
  const featureIndexes =
    narrow && !featuresOpen
      ? allFeatureIndexes.slice(0, MOBILE_FEATURES_PREVIEW)
      : allFeatureIndexes;
  const canToggleFeatures = narrow && allFeatureIndexes.length > MOBILE_FEATURES_PREVIEW;

  useEffect(() => {
    if (!narrow) setFeaturesOpen(false);
  }, [narrow]);

  function onBuy() {
    alert('Checkout will connect once you pick payments (Razorpay / Stripe / etc.).');
  }

  const buyButton =
    buyMode === 'checkout' ? (
      <button type="button" className="pp-btn pp-btn-primary" onClick={onBuy}>
        <CartIcon />
        Buy Now
        <span aria-hidden>›</span>
      </button>
    ) : (
      <Link className="pp-btn pp-btn-primary" to="/pricing">
        <CartIcon />
        Buy Now
        <span aria-hidden>›</span>
      </Link>
    );

  return (
    <Reveal as="section" className="section pp-section" id="pricing">
      <div
        className="pp-bg"
        style={{ backgroundImage: `url(${pricingSectionBg})` }}
        aria-hidden
      />
      <div className="pp-glow pp-glow-tl" aria-hidden />
      <div className="pp-glow pp-glow-br" aria-hidden />

      <div className="container pp-shell">
        {!hideHead ? (
          <div className="pp-hero">
            <div className="pp-hero-copy">
              <span className="why-accent-bar" aria-hidden />
              <h2>
                Professional <em>Plan</em>
              </h2>
              <p className="pp-lead">
                Complete training, real case workflows, and lifetime access to become a data recovery
                expert.
              </p>
              <p className="pp-kicker">
                <span className="pp-kicker-bolt" aria-hidden>
                  ⚡
                </span>
                Limited time offer
              </p>
              <Countdown />
              <p className="pp-sale">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                  <path d="M21.4 11.6 12.4 2.6a2 2 0 0 0-2.8 0L2.6 9.6a2 2 0 0 0 0 2.8l9 9a2 2 0 0 0 2.8 0l7-7a2 2 0 0 0 0-2.8ZM7.5 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
                </svg>
                Festival Sale – <strong>Up to 60% Off</strong>
              </p>
            </div>
            <div className="pp-hero-visual">
              <img
                src={pricingHeroVisual}
                alt=""
                width={1200}
                height={360}
                decoding="async"
                fetchPriority="low"
              />
            </div>
          </div>
        ) : (
          <div className="pp-hero pp-hero-compact">
            <div className="pp-hero-copy">
              <p className="pp-kicker">
                <span className="pp-kicker-bolt" aria-hidden>
                  ⚡
                </span>
                Limited time offer
              </p>
              <Countdown />
              <p className="pp-sale">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                  <path d="M21.4 11.6 12.4 2.6a2 2 0 0 0-2.8 0L2.6 9.6a2 2 0 0 0 0 2.8l9 9a2 2 0 0 0 2.8 0l7-7a2 2 0 0 0 0-2.8ZM7.5 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
                </svg>
                Festival Sale – <strong>Up to 60% Off</strong>
              </p>
            </div>
          </div>
        )}

        <div className="pp-main">
          <div className="pp-price-card">
            <span className="pp-plan-badge">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
                <path d="M5 16.5h14l-1.15-7.6L14.4 11.5 12 6.2 9.6 11.5 6.15 8.9 5 16.5Z" />
                <path d="M5 16.5h14v2.2a1.3 1.3 0 0 1-1.3 1.3H6.3A1.3 1.3 0 0 1 5 18.7v-2.2Z" />
              </svg>
              {pricing.name}
            </span>
            <div className="pp-price">
              <s>{formatInr(pricing.was)}</s>
              <div className="pp-price-row">
                <strong>{formatInr(pricing.now)}</strong>
                <span className="pp-off">{offPct}% OFF</span>
              </div>
            </div>
            <div className="pp-actions">
              {buyButton}
              <a
                className="pp-btn pp-btn-outline"
                href={company.whatsapp}
                target="_blank"
                rel="noreferrer"
              >
                <WhatsAppIcon />
                Ask on WhatsApp
              </a>
              <span className="pp-btn pp-btn-ghost">
                <LockIcon />
                Get Lifetime Access &amp; Updates
              </span>
            </div>
          </div>

          <div className="pp-features-card">
            <h3 className="pp-features-title">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                <ellipse cx="12" cy="6.5" rx="6.5" ry="2.5" />
                <path d="M5.5 6.5v4c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-4M5.5 10.5v4c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-4" />
              </svg>
              What You&apos;ll Get
            </h3>
            <ul className="pp-features">
              {featureIndexes.map((i) => (
                <li key={pricing.features[i]}>
                  <span className="pp-feat-icon">{pricingFeatureIcons[i]}</span>
                  <span>{pricing.features[i]}</span>
                </li>
              ))}
            </ul>
            {canToggleFeatures ? (
              <button
                type="button"
                className="pp-features-more"
                aria-expanded={featuresOpen}
                onClick={() => setFeaturesOpen((v) => !v)}
              >
                {featuresOpen ? 'Show less' : 'Show more'}
                <svg
                  className={`pp-features-more-icon${featuresOpen ? ' is-open' : ''}`}
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>

        <div className="pp-perks-block">
          <div className="pp-perks-head">
            <p className="pp-perks-kicker">
              Why choose us
              <span className="pp-perks-kicker-line" aria-hidden />
            </p>
            <h3>
              Everything You Need, <em>All in One Place</em>
            </h3>
            <p>Powerful features designed to give you a complete and seamless experience.</p>
          </div>

          <div className="pp-perks">
            {pricingPerks.map((p) => (
              <article key={p.id} className={`pp-perk pp-perk--${p.id}`}>
                <div className="pp-perk-orb" aria-hidden>
                  <span className="pp-perk-orb-glow" />
                  <span className="pp-perk-orb-sphere">
                    <img src={p.iconSrc} alt="" width={26} height={26} decoding="async" />
                  </span>
                  <span className="pp-perk-crown">
                    <img
                      src={icons.crown}
                      alt=""
                      width={10}
                      height={10}
                      decoding="async"
                    />
                  </span>
                  <span className="pp-perk-orb-flare" />
                  <span className="pp-perk-orb-base" />
                </div>
                <div className="pp-perk-copy">
                  <h4>{p.label}</h4>
                  <p>{p.text}</p>
                </div>
                {p.id === 'workflows' ? (
                  <div className="pp-perk-chart" aria-hidden>
                    <span className="pp-perk-chart-pane">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="pp-perk-chart-pane">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="pp-perk-chart-pane">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="pp-perk-chart-arrow">
                      <img
                        src={icons.trendingUp}
                        alt=""
                        width={18}
                        height={18}
                        decoding="async"
                      />
                    </span>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

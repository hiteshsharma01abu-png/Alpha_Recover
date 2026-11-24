import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from '../ui/Reveal';
import { icons } from '../../lib/icons';
import { usePlan, withoutSale } from '../../lib/plans';
import { useSiteSettings } from '../../lib/settings';
import {
  pricingFeatureIcons,
  pricingHeroVisual,
  pricingPerks,
  pricingSectionBg,
} from '../visuals/pricingVisuals';
import '../../styles/sections.css';
import './ProfessionalPlanSection.css';

function formatInr(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
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

/** Counts down to the promotion's real end time; calls onExpire once it reaches zero. */
function Countdown({ endsAt, onExpire }: { endsAt: string; onExpire: () => void }) {
  const end = Date.parse(endsAt);
  // null until mounted: the page is pre-rendered at build time, so the first render can't know the current time.
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, end - Date.now());
      setLeft(remaining);
      if (remaining === 0) onExpire();
      return remaining;
    };
    if (tick() === 0) return;
    const id = window.setInterval(() => {
      if (tick() === 0) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [end, onExpire]);

  const total = Math.floor((left ?? 0) / 1000);
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
          <strong>{left === null ? '--' : String(c.value).padStart(2, '0')}</strong>
          <span>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

/** "Festival Sale – Up to 60% Off" → "Festival Sale – <strong>Up to 60% Off</strong>" */
function SaleLabel({ label }: { label: string }) {
  const [head, ...rest] = label.split(' – ');
  return rest.length ? (
    <>
      {head} – <strong>{rest.join(' – ')}</strong>
    </>
  ) : (
    <strong>{label}</strong>
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

type ProfessionalPlanSectionProps = {
  buyMode?: 'link' | 'checkout';
  hideHead?: boolean;
};

const MOBILE_FEATURES_PREVIEW = 3;

export function ProfessionalPlanSection({
  buyMode = 'link',
  hideHead = false,
}: ProfessionalPlanSectionProps) {
  const { company } = useSiteSettings();
  const narrow = useIsNarrow(980);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  // Widening past the breakpoint collapses the list again, so narrowing later starts from the preview.
  // Adjusted during render (React's pattern for reacting to a changed value) rather than in an effect.
  const [wasNarrow, setWasNarrow] = useState(narrow);
  if (narrow !== wasNarrow) {
    setWasNarrow(narrow);
    if (!narrow) setFeaturesOpen(false);
  }
  const livePlan = usePlan('professional');
  // When the countdown hits zero the sale ends immediately, without waiting for a reload.
  const [saleOver, setSaleOver] = useState(false);
  const endSale = useCallback(() => setSaleOver(true), []);
  const plan = saleOver ? withoutSale(livePlan) : livePlan;
  const features = plan.features;
  const allFeatureIndexes = narrow
    ? (plan.mobileFeatureOrder ?? features.map((_, i) => i)).filter((i) => i < features.length)
    : features.map((_, i) => i);
  const featureIndexes =
    narrow && !featuresOpen
      ? allFeatureIndexes.slice(0, MOBILE_FEATURES_PREVIEW)
      : allFeatureIndexes;
  const canToggleFeatures = narrow && allFeatureIndexes.length > MOBILE_FEATURES_PREVIEW;

  function onBuy() {
    alert('Checkout will connect once you pick payments (Razorpay / Stripe / etc.).');
  }

  const buyButton =
    buyMode === 'checkout' ? (
      <button type="button" className="pp-btn pp-btn-gold" onClick={onBuy}>
        <CartIcon />
        Buy Now
        <span aria-hidden>›</span>
      </button>
    ) : (
      <Link className="pp-btn pp-btn-gold" to="/pricing">
        <CartIcon />
        Buy Now
        <span aria-hidden>›</span>
      </Link>
    );

  const promoStrip = plan.promotion ? (
    <div className="pp-sale-strip">
      <div className="pp-sale-copy">
        <p className="pp-kicker">Limited time · Professional Plan</p>
        <p className="pp-sale">
          <SaleLabel label={plan.promotion.label} />
        </p>
      </div>
      <Countdown endsAt={plan.promotion.endsAt} onExpire={endSale} />
    </div>
  ) : null;

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
              {promoStrip}
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
        ) : promoStrip ? (
          <div className="pp-hero pp-hero-compact">
            <div className="pp-hero-copy">{promoStrip}</div>
          </div>
        ) : null}

        <div className="pp-main">
          <div className="pp-price-card">
            <span className="pp-recommended-badge">Recommended</span>
            <h3 className="pp-plan-name">{plan.name.replace(/ Plan$/, '')}</h3>
            <div className="pp-price-row">
              <strong className="pp-price">{formatInr(plan.effectivePricePaise)}</strong>
              {plan.comparePricePaise ? (
                <span className="pp-was">{formatInr(plan.comparePricePaise)}</span>
              ) : null}
              {plan.discountPct > 0 ? <span className="pp-off">{plan.discountPct}% OFF</span> : null}
            </div>
            <p className="pp-once">One-time payment · lifetime access</p>
            <div className="pp-actions">
              {buyButton}
              <a
                className="pp-btn pp-btn-ghost"
                href={company.whatsapp}
                target="_blank"
                rel="noreferrer"
              >
                <WhatsAppIcon />
                Ask on WhatsApp
              </a>
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
                <li key={features[i]}>
                  <span className="pp-feat-icon">
                    <img src={pricingFeatureIcons[i] ?? pricingFeatureIcons[0]} alt="" width={16} height={16} decoding="async" />
                  </span>
                  <span>{features[i]}</span>
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

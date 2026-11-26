import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PricingFaq } from '../components/sections/PricingFaq';
import { Reveal } from '../components/ui/Reveal';
import { pricingPerks } from '../components/visuals/pricingVisuals';
import { company } from '../data/content';
import { pricingPlans } from '../data/pricingPlans';
import { icons } from '../lib/icons';
import { type Plan, usePlans, withoutSale } from '../lib/plans';
import { useSiteSettings } from '../lib/settings';
import { useBuyPlan } from '../lib/useBuyPlan';
import { useOwnedPlans } from '../lib/useOwnedPlans';
import '../components/sections/ProfessionalPlanSection.css';
import './PricingPage.css';

function formatInr(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

/** Counts down to the promotion end; onExpire when remaining hits zero. */
function SaleCountdown({ endsAt, onExpire }: { endsAt: string; onExpire: () => void }) {
  const end = Date.parse(endsAt);
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
  const cells = [
    { label: 'Days', value: Math.floor(total / 86400) },
    { label: 'Hrs', value: Math.floor((total % 86400) / 3600) },
    { label: 'Min', value: Math.floor((total % 3600) / 60) },
    { label: 'Sec', value: total % 60 },
  ];

  return (
    <div className="px-countdown" aria-label="Sale countdown">
      {cells.map((c) => (
        <div key={c.label} className="px-countdown-cell">
          <strong>{left === null ? '--' : String(c.value).padStart(2, '0')}</strong>
          <span>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

type CompareCell = 'yes' | 'no' | 'soon' | string;

const COMPARE_ROWS: { label: string; category?: boolean; essential: CompareCell; professional: CompareCell; expert: CompareCell }[] = [
  { label: 'Core access', category: true, essential: '', professional: '', expert: '' },
  { label: 'Logical / basics / electronics tracks', essential: 'yes', professional: 'yes', expert: 'yes' },
  { label: 'All published training tracks', essential: 'no', professional: 'yes', expert: 'yes' },
  { label: 'Lifetime access & course updates', essential: 'yes', professional: 'yes', expert: 'yes' },
  { label: 'Self-paced learning', essential: 'yes', professional: 'yes', expert: 'yes' },
  { label: 'Curriculum depth', category: true, essential: '', professional: '', expert: '' },
  { label: 'Training certificate path', essential: 'no', professional: 'yes', expert: 'yes' },
  { label: 'Firmware repairing software access', essential: 'no', professional: 'yes', expert: 'yes' },
  { label: 'Seagate & WD firmware training', essential: 'no', professional: 'yes', expert: 'yes' },
  { label: 'Case study videos', essential: 'no', professional: 'yes', expert: 'yes' },
  { label: 'BitLocker recovery training', essential: 'no', professional: 'yes', expert: 'yes' },
  { label: 'MRT introduction & related modules', essential: 'no', professional: 'yes', expert: 'yes' },
  { label: 'Support', category: true, essential: '', professional: '', expert: '' },
  { label: 'WhatsApp technical assistance', essential: 'no', professional: 'yes', expert: 'yes' },
  { label: 'Personal mentoring', essential: 'no', professional: 'no', expert: 'soon' },
  { label: 'Priority technical assistance', essential: 'no', professional: 'no', expert: 'soon' },
];

const TRUST_ITEMS = [
  { title: 'One-time payment', text: 'No subscription fees' },
  { title: 'Lifetime access', text: 'Courses in your plan, forever' },
  { title: '3-day refund', text: 'Any reason — see policy' },
  { title: 'Certificate path', text: 'On Professional & Expert' },
  { title: 'Ahmedabad team', text: 'Training & recovery specialists' },
];

const CARD_FEATURE_LIMIT = 8;

function cellMarkup(value: CompareCell) {
  if (value === 'yes') return <span className="px-yes">Included</span>;
  if (value === 'no') return <span className="px-no">—</span>;
  if (value === 'soon') return <span className="px-no">Coming soon</span>;
  return value;
}

type BuyError = { message: string; owned: boolean };

/** Why checkout didn't open; owners get a link to their courses instead. */
function BuyMessage({ error }: { error: BuyError | null }) {
  if (!error) return null;
  return (
    <p className="px-buy-error" role="alert">
      {error.message}
      {error.owned ? (
        <>
          {' '}
          <Link to="/dashboard">Go to My Learning</Link>
        </>
      ) : null}
    </p>
  );
}

function PlanCard({
  plan,
  onBuy,
  busy,
  error,
  ownership,
  whatsappHref,
}: {
  plan: Plan;
  onBuy: () => void;
  busy: boolean;
  error: BuyError | null;
  /** Signed-in student already has this plan, or a plan that includes every course. */
  ownership: { kind: 'owned' } | { kind: 'included'; by: string } | null;
  whatsappHref: string;
}) {
  const staticDef = pricingPlans.find((p) => p.slug === plan.slug);
  const comingSoon = plan.comingSoon ?? staticDef?.comingSoon ?? false;
  const recommended = plan.recommended ?? staticDef?.recommended ?? false;
  const tagline = plan.tagline ?? staticDef?.tagline ?? '';
  const audience = plan.audience ?? plan.description ?? staticDef?.audience ?? '';
  const ctaLabel = plan.ctaLabel ?? staticDef?.ctaLabel ?? 'Buy Now';
  // Expert adds mentoring on top of every course: a Professional owner still sees "Coming soon" there, not "included"
  const owns = ownership?.kind === 'included' && comingSoon ? null : ownership;
  const features = plan.features.slice(0, CARD_FEATURE_LIMIT);
  const moreCount = Math.max(0, plan.features.length - features.length);

  return (
    <article className={`px-card${recommended ? ' is-recommended' : ''}`}>
      {recommended ? <span className="px-card-badge">Recommended</span> : null}
      <h2>{plan.name.replace(/ Plan$/, '')}</h2>
      <p className="px-card-audience">
        {tagline ? (
          <>
            <strong>{tagline}</strong>
            {audience ? <> — {audience}</> : null}
          </>
        ) : (
          audience
        )}
      </p>
      <div className="px-price-row">
        <span className="px-price">{formatInr(plan.effectivePricePaise)}</span>
        {plan.comparePricePaise ? <span className="px-was">{formatInr(plan.comparePricePaise)}</span> : null}
        {plan.discountPct > 0 ? <span className="px-off">{plan.discountPct}% OFF</span> : null}
      </div>
      <p className="px-once">One-time payment · lifetime access</p>
      <ul className="px-features">
        {features.map((f) => (
          <li key={f}>{f}</li>
        ))}
        {moreCount > 0 ? <li>+ {moreCount} more benefits</li> : null}
      </ul>
      <div className="px-card-actions">
        {owns ? (
          <>
            <p className="px-owned" role="status">
              <span aria-hidden>✓</span> {owns.kind === 'owned' ? 'You own this plan' : `Included in your ${owns.by}`}
            </p>
            <Link className="px-btn px-btn-primary" to="/dashboard">
              Go to My Learning
            </Link>
          </>
        ) : comingSoon ? (
          <button type="button" className="px-btn px-btn-ghost is-disabled" disabled>
            Coming soon
          </button>
        ) : recommended ? (
          <button type="button" className="px-btn px-btn-gold" onClick={onBuy} disabled={busy} aria-busy={busy}>
            {busy ? 'Opening checkout…' : ctaLabel}
          </button>
        ) : (
          <button type="button" className="px-btn px-btn-primary" onClick={onBuy} disabled={busy} aria-busy={busy}>
            {busy ? 'Opening checkout…' : ctaLabel}
          </button>
        )}
        <a className="px-btn px-btn-ghost" href={whatsappHref} target="_blank" rel="noopener noreferrer">
          <img src={icons.whatsapp} alt="" width={16} height={16} decoding="async" aria-hidden />
          Ask on WhatsApp
        </a>
      </div>
      <BuyMessage error={error} />
    </article>
  );
}

export function Pricing() {
  const { company: liveCompany } = useSiteSettings();
  const whatsappHref = liveCompany.whatsapp || company.whatsapp;
  const livePlans = usePlans();
  const [saleOver, setSaleOver] = useState(false);
  const endSale = useCallback(() => setSaleOver(true), []);

  const plans = livePlans.map((p) =>
    saleOver && p.slug === 'professional' && p.promotion ? withoutSale(p) : p,
  );
  const professional = plans.find((p) => p.slug === 'professional');
  const promo = !saleOver ? professional?.promotion : null;

  const { buy, busy, error } = useBuyPlan();
  const mine = useOwnedPlans();
  const ownershipOf = (slug: string) =>
    !mine ? null : mine.owned.has(slug) ? ({ kind: 'owned' } as const) : mine.allCoursesPlan ? ({ kind: 'included', by: mine.allCoursesPlan } as const) : null;
  const ownsProfessional = ownershipOf('professional') !== null;

  return (
    <div className="px-page">
      <header className="px-hero">
        <div className="container px-hero-inner">
          <p className="px-eyebrow">Flexible training plans</p>
          <h1>Invest in Your Skills. Build Your Future.</h1>
          <p className="px-hero-lead">
            Choose Essential foundations, the full Professional curriculum, or Expert when mentoring
            launches — one-time payment, lifetime access to the courses in your plan.
          </p>
        </div>
      </header>

      {promo ? (
        <div className="px-sale">
          <div className="container">
            <div className="px-sale-inner">
              <div className="px-sale-copy">
                <p className="px-sale-kicker">Limited time · Professional Plan</p>
                <p className="px-sale-label">{promo.label}</p>
              </div>
              <SaleCountdown endsAt={promo.endsAt} onExpire={endSale} />
            </div>
          </div>
        </div>
      ) : null}

      <Reveal as="section" className="px-plans" id="pricing-plans">
        <div className="container">
          <div className="px-plan-grid">
            {plans.map((plan) => (
              <PlanCard
                key={plan.slug}
                plan={plan}
                onBuy={() => void buy(plan.slug)}
                busy={busy === plan.slug}
                error={error?.plan === plan.slug ? error : null}
                ownership={ownershipOf(plan.slug)}
                whatsappHref={whatsappHref}
              />
            ))}
          </div>
        </div>
      </Reveal>

      <section className="px-trust" aria-label="Trust indicators">
        <div className="container">
          <div className="px-trust-grid">
            {TRUST_ITEMS.map((item) => (
              <div key={item.title} className="px-trust-item">
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Reveal as="section" className="px-compare" id="pricing-compare">
        <div className="container">
          <header className="px-section-head">
            <h2 id="px-compare-title">Compare plans</h2>
            <p>See which entitlements ship with Essential, Professional and Expert.</p>
          </header>
          <div className="px-table-wrap">
            <table className="px-table">
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  <th scope="col">Essential</th>
                  <th scope="col">Professional</th>
                  <th scope="col">Expert</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) =>
                  row.category ? (
                    <tr key={row.label}>
                      <td className="px-cat" colSpan={4}>
                        {row.label}
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{cellMarkup(row.essential)}</td>
                      <td>{cellMarkup(row.professional)}</td>
                      <td>{cellMarkup(row.expert)}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="px-benefits" id="pricing-benefits" aria-labelledby="px-benefits-title">
        <div className="container">
          <header className="px-section-head">
            <h2 id="px-benefits-title">Training benefits</h2>
            <p>Built for technicians who need practical recovery skills, not theory alone.</p>
          </header>

          <div className="pp-perks">
              {pricingPerks.map((p) => (
                <article key={p.id} className={`pp-perk pp-perk--${p.id}`}>
                  <div className="pp-perk-orb" aria-hidden>
                    <span className="pp-perk-orb-glow" />
                    <span className="pp-perk-orb-sphere">
                      <img src={p.iconSrc} alt="" width={26} height={26} decoding="async" />
                    </span>
                    <span className="pp-perk-crown">
                      <img src={icons.crown} alt="" width={10} height={10} decoding="async" />
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
                        <img src={icons.trendingUp} alt="" width={18} height={18} decoding="async" />
                      </span>
                    </div>
                  ) : null}
                </article>
              ))}
          </div>
        </div>
      </Reveal>

      <PricingFaq />

      <section className="px-consult" aria-labelledby="px-consult-title">
        <div className="container">
          <div className="px-consult-card">
            <p className="px-consult-kicker">Need guidance?</p>
            <h2 id="px-consult-title">Not sure which plan is right for you?</h2>
            <p>
              Tell us about your experience level and learning goals. Our team will help you choose
              between Essential and Professional.
            </p>
            <a className="px-btn px-btn-primary" href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <img src={icons.whatsapp} alt="" width={16} height={16} decoding="async" aria-hidden />
              Ask on WhatsApp
            </a>
          </div>
        </div>
      </section>

      <section className="px-final" aria-labelledby="px-final-title">
        <div className="container">
          <div className="px-final-card">
            <h2 id="px-final-title">{ownsProfessional ? 'Your Professional access is active' : 'Ready to start with Professional?'}</h2>
            <p>
              Full curriculum, lifetime updates and WhatsApp technical assistance. Pay securely with UPI,
              card or netbanking.
            </p>
            <div className="px-final-actions">
              {ownsProfessional ? (
                <Link className="px-btn px-btn-gold" to="/dashboard">
                  Go to My Learning
                </Link>
              ) : (
                <button
                  type="button"
                  className="px-btn px-btn-gold"
                  onClick={() => void buy('professional')}
                  disabled={busy === 'professional'}
                  aria-busy={busy === 'professional'}
                >
                  {busy === 'professional' ? 'Opening checkout…' : 'Enroll Now'}
                </button>
              )}
              <a className="px-btn px-btn-ghost" href={whatsappHref} target="_blank" rel="noopener noreferrer">
                Ask on WhatsApp
              </a>
              <Link className="px-btn px-btn-ghost" to="/refund-policy">
                Refund policy
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

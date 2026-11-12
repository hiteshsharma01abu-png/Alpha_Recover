import { Link } from 'react-router-dom';
import { heroHighlights, quickActions, stats, whyLearn } from '../data/content';
import { ContactCtaSection } from '../components/sections/ContactCtaSection';
import { DemoVideosSection } from '../components/sections/DemoVideosSection';
import {
  globalStatIcons,
  globalStatsBg,
  globalStatsGlobe,
  globalStatsWave,
  heroHighlightIcons,
} from '../components/visuals/impactVisuals';
import { ProfessionalPlanSection } from '../components/sections/ProfessionalPlanSection';
import { ProTrainingSection } from '../components/sections/ProTrainingSection';
import { Reveal } from '../components/ui/Reveal';
import { SolutionsStack } from '../components/sections/SolutionsStack';
import { TrainingSolutionsSection } from '../components/sections/TrainingSolutionsSection';
import {
  fallbackSectionImage,
  whyLearnBadgeSrc,
  whyLearnIconSrc,
  whyLearnImages,
} from '../data/sectionMedia';
import { icons } from '../lib/icons';
import '../styles/sections.css';
import './Home.css';

const heroDriveSrc = '/assets/hero-drive.webp';

const quickActionIconSrc: Record<string, string> = {
  'Logical Recovery': icons.laptop,
  'PCB Repair': icons.settings,
  'Firmware Tools': icons.cpu,
  'MRT Techniques': icons.layers,
};

const quickActionTitleLines: Record<string, [string, string]> = {
  'Logical Recovery': ['Logical', 'Recovery'],
  'PCB Repair': ['PCB', 'Repair'],
  'Firmware Tools': ['Firmware', 'Tools'],
  'MRT Techniques': ['MRT', 'Techniques'],
};

const railIconSrc: Record<string, string> = {
  'hands-on': icons.database,
  lifetime: icons.monitorPlay,
  mentorship: icons.users,
  skills: icons.fileBadge,
};

const railLabelLines: Record<string, [string, string]> = {
  'hands-on': ['Real Hands-on', 'Training'],
  lifetime: ['Lifetime Portal', 'Access'],
  mentorship: ['Expert', 'Mentorship'],
  skills: ['Industry Relevant', 'Skills'],
};

export function Home() {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-bg" aria-hidden>
          <span className="hero-bg-glow hero-bg-glow-a" />
          <span className="hero-bg-glow hero-bg-glow-b" />
          <span className="hero-bg-glow hero-bg-glow-c" />
          <span className="hero-bg-grid" />
          <span className="hero-bg-dots hero-bg-dots-tr" />
          <span className="hero-bg-dots hero-bg-dots-bl" />
        </div>

        <div className="container hero-shell">
          <div className="hero-main">
            <div className="hero-copy">
              <p className="hero-kicker">
                <span className="hero-kicker-line" aria-hidden />
                Professional data recovery training
              </p>
              <h1 className="hero-brand">
                <span className="hero-brand-name">
                  <span className="hero-brand-alpha">Alpha</span>
                  <span className="hero-brand-recover">Recover</span>
                </span>
                <span className="hero-brand-sub">Data Recovery Training Solutions</span>
              </h1>
              <p className="hero-lead">
                Online data recovery training from Ahmedabad — logical, PCB, mechanical,
                firmware, and MRT paths with lifetime portal access.
              </p>
              <div className="hero-actions">
                <Link className="btn hero-btn-primary" to="/pricing">
                  View Plan
                  <span aria-hidden>→</span>
                </Link>
                <Link className="btn hero-btn-ghost" to="/demos">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
                    <path d="M8 6.5v11l9-5.5-9-5.5Z" />
                  </svg>
                  Demo Videos
                  <span aria-hidden>›</span>
                </Link>
              </div>
            </div>

            <div className="hero-showcase">
              <div className="hero-visual">
                <div className="hero-aside hero-aside-media" aria-hidden>
                  <img
                    className="hero-drive-image"
                    src={heroDriveSrc}
                    alt=""
                    width={900}
                    height={804}
                    decoding="async"
                    fetchPriority="high"
                  />
                </div>
              </div>

              <aside className="hero-rail" aria-label="Training highlights">
                <span className="hero-rail-line" aria-hidden />
                {heroHighlights.map((item) => {
                  const lines = railLabelLines[item.id] ?? [item.label, ''];
                  return (
                    <div key={item.id} className="hero-rail-item">
                      <span className="hero-rail-dot" aria-hidden />
                      <div className="hero-rail-card">
                        <span className="hero-rail-icon" aria-hidden>
                          {railIconSrc[item.id] ? (
                            <img src={railIconSrc[item.id]} alt="" width={28} height={28} />
                          ) : (
                            heroHighlightIcons[item.id]
                          )}
                        </span>
                        <span className="hero-rail-label">
                          <span>{lines[0]}</span>
                          {lines[1] ? <span>{lines[1]}</span> : null}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </aside>
            </div>
          </div>

          <div className="hero-features">
            {quickActions.map((a) => {
              const lines = quickActionTitleLines[a.label] ?? [a.label, ''];
              return (
                <Link key={a.label} to={a.to} className="hero-feature">
                  <span className="hero-feature-icon" aria-hidden>
                    <img
                      src={quickActionIconSrc[a.label]}
                      alt=""
                      width={46}
                      height={46}
                      decoding="async"
                    />
                  </span>
                  <span className="hero-feature-copy">
                    <strong className="hero-feature-title">
                      <span>{lines[0]}</span>
                      {lines[1] ? <span>{lines[1]}</span> : null}
                    </strong>
                    <span>{a.hint}</span>
                  </span>
                  <span className="hero-feature-arrow" aria-hidden>
                    <img
                      src={icons.chevronRight}
                      alt=""
                      width={18}
                      height={18}
                      decoding="async"
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <Reveal as="section" className="section impact-section">
        <div
          className="gs-bg"
          style={{ backgroundImage: `url(${globalStatsBg})` }}
          aria-hidden
        />
        <img className="gs-wave gs-wave-top" src={globalStatsWave} alt="" aria-hidden />
        <img className="gs-wave gs-wave-bottom" src={globalStatsWave} alt="" aria-hidden />
        <img className="gs-globe" src={globalStatsGlobe} alt="" aria-hidden />

        <div className="container gs-shell">
          <div className="gs-head">
            <span className="gs-accent" aria-hidden />
            <h2>
              Learn the Realm of <em>Data Recovery</em>
            </h2>
            <p className="gs-lead">
              Numbers from how we teach and support technicians — not vanity tiles.
            </p>
          </div>

          <div className="gs-grid">
            {stats.map((s) => (
              <article key={s.label} className="gs-card">
                <span className="gs-card-icon" aria-hidden>
                  <img
                    src={globalStatIcons[s.label]}
                    alt=""
                    width={48}
                    height={48}
                    decoding="async"
                  />
                </span>
                <div className="gs-card-body">
                  <strong>{s.value}</strong>
                  <span className="gs-card-bar" aria-hidden />
                  <h3>{s.label}</h3>
                  <p>{s.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </Reveal>

      <SolutionsStack />

      <TrainingSolutionsSection />

      <ProTrainingSection />

      <DemoVideosSection limit={3} showViewAll linkCards />

      <Reveal as="section" className="section why-section">
        <div className="why-deco" aria-hidden />
        <div className="container">
          <div className="why-head">
            <span className="why-accent-bar" aria-hidden />
            <h2>
              Why learn <em>data recovery?</em>
            </h2>
            <p>
              Different careers. One practical skill: recover data when software alone isn’t enough.
            </p>
          </div>
          <div className="why-grid">
            {whyLearn.map((w, i) => (
              <article className="why-card" key={w.id}>
                <div className="why-card-top">
                  <span className="why-card-icon" aria-hidden>
                    <img
                      src={whyLearnIconSrc[w.id]}
                      alt=""
                      width={18}
                      height={18}
                      decoding="async"
                    />
                  </span>
                  <span className="why-card-num">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <div className="why-card-body">
                  <div className="why-card-copy">
                    <h3>{w.title}</h3>
                    <p>{w.text}</p>
                  </div>
                  <div className={`why-card-visual why-card-visual--${w.id}`} aria-hidden>
                    <img
                      className="why-card-photo"
                      src={whyLearnImages[w.id] ?? fallbackSectionImage}
                      alt=""
                      width={800}
                      height={600}
                      loading="lazy"
                      decoding="async"
                    />
                    {whyLearnBadgeSrc[w.id] ? (
                      <span className="why-card-badge">
                        <img
                          src={whyLearnBadgeSrc[w.id]}
                          alt=""
                          width={22}
                          height={22}
                          decoding="async"
                        />
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </Reveal>

      <ProfessionalPlanSection />

      <ContactCtaSection />
    </div>
  );
}

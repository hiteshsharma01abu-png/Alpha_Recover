import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { featuredSolutions } from '../data/content';
import { fallbackSectionImage, proTrainingImages } from '../data/sectionMedia';
import { icons } from '../lib/icons';
import {
  proTrainingBenefits,
  proTrainingBg,
  proTrainingHero,
  proTrainingMeta,
} from './proTrainingVisuals';
import '../pages/Home.css';

const proAccents = ['#D9B56E', '#7DFFC0', '#CFDDD8'] as const;

/**
 * Same sticky sibling stack as SolutionsStack on mobile.
 * Plain <section> (no Reveal transform / overflow) so sticky can pin.
 */
export function ProTrainingSection() {
  return (
    <section className="section pro-section">
      <div className="pro-backdrop" aria-hidden>
        <div
          className="pro-bg"
          style={{ backgroundImage: `url(${proTrainingBg})` }}
        />
        <div className="pro-glow pro-glow-tl" />
        <div className="pro-glow pro-glow-br" />
        <div className="pro-deco">
          <span className="pro-deco-dots pro-deco-dots-tr" />
          <span className="pro-deco-dots pro-deco-dots-bl" />
        </div>
      </div>

      <div className="container pro-shell">
        <div className="pro-hero">
          <div className="pro-hero-copy">
            <span className="why-accent-bar" aria-hidden />
            <h2>
              Professional <em>Online Training</em>
            </h2>
            <p className="pro-lead">
              Courses for students and working professionals. Recover your investment by completing
              one real recovery job. Lifetime access, notes, and technical assistance included.
            </p>
            <ul className="pro-benefits">
              {proTrainingBenefits.map((b) => (
                <li key={b.id}>
                  <span className="pro-benefit-icon" aria-hidden>
                    <img src={b.iconSrc} alt="" width={22} height={22} decoding="async" />
                  </span>
                  <span className="pro-benefit-copy">
                    <strong>{b.label}</strong>
                    <span>{b.sub}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pro-hero-visual">
            <img
              src={proTrainingHero}
              alt=""
              width={708}
              height={450}
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>

        <div
          className="pro-grid"
          style={{ '--stack-count': featuredSolutions.length } as CSSProperties}
        >
          {featuredSolutions.map((s, i) => {
            const meta = proTrainingMeta[s.id];
            return (
              <article
                key={s.id}
                className="stack-card"
                style={
                  {
                    '--stack-accent': proAccents[i % proAccents.length],
                    '--stack-i': i,
                  } as CSSProperties
                }
              >
                <div className="stack-card-shell">
                  <div className="stack-card-media" aria-hidden>
                    <img
                      className="stack-card-photo"
                      src={proTrainingImages[s.id] ?? fallbackSectionImage}
                      alt=""
                      width={1200}
                      height={800}
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="stack-index">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <div className="stack-card-body">
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                    {meta ? (
                      <div className="stack-card-meta">
                        <span>
                          <img src={icons.clock} alt="" width={12} height={12} decoding="async" />
                          {meta.hours}
                        </span>
                        <span>
                          <img src={icons.play} alt="" width={12} height={12} decoding="async" />
                          {meta.lessons}
                        </span>
                      </div>
                    ) : null}
                    <Link className="btn btn-cyan" to={s.to}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
                        <path d="M8 6.5v11l9-5.5-9-5.5Z" />
                      </svg>
                      Explore track
                      <span aria-hidden>›</span>
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

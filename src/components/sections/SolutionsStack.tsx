import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { recoverySolutions } from '../../data/content';
import { fallbackSectionImage, recoverySolutionImages } from '../../data/sectionMedia';
import '../../styles/sections.css';
import './SolutionsStack.css';

/**
 * Osaanj Featured Products: all cards are sticky SIBLINGS in one parent.
 * Shared parent = sticky works the same scrolling down from home and up from footer.
 * Tall rows + shorter cards → each card pins, then the next slides up and covers it.
 */
export function SolutionsStack() {
  return (
    <section className="section solutions-stack-section">
      <div className="container">
        <div className="section-head">
          <span className="training-accent-bar" aria-hidden />
          <h2>
            Recovery solution <em>paths</em>
          </h2>
          <p>Four core recovery tracks — scroll to stack each card.</p>
        </div>

        <div
          className="solutions-stack"
          style={{ '--stack-count': recoverySolutions.length } as CSSProperties}
        >
          {recoverySolutions.map((card, index) => (
            <article
              className="stack-card"
              key={card.id}
              style={
                {
                  '--stack-accent': card.accent,
                  '--stack-i': index,
                } as CSSProperties
              }
            >
              <div className="stack-card-shell">
                <div className="stack-card-media" aria-hidden>
                  <img
                    className="stack-card-photo"
                    src={recoverySolutionImages[card.id] ?? fallbackSectionImage}
                    alt=""
                    width={1200}
                    height={800}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="stack-index">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="stack-card-body">
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                  <Link className="btn btn-cyan" to={card.to}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
                      <path d="M8 6.5v11l9-5.5-9-5.5Z" />
                    </svg>
                    Explore track
                    <span aria-hidden>›</span>
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

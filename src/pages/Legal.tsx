import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { company } from '../data/content';
import { legalPages, legalUpdated, type LegalPageKey } from '../data/legal';
import './SimplePages.css';
import './Legal.css';

const OTHER_PAGES: { key: LegalPageKey; to: string }[] = [
  { key: 'privacy', to: '/privacy-policy' },
  { key: 'terms', to: '/terms' },
  { key: 'refund', to: '/refund-policy' },
];

/** Privacy Policy, Terms & Conditions, Refund & Cancellation: text lives in src/data/legal.ts. */
export function LegalPage({ page }: { page: LegalPageKey }) {
  const { title, intro, sections } = legalPages[page];

  useEffect(() => {
    const previous = document.title;
    document.title = `${title} | ${company.name}`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <div>
      <div className="page-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <span>{title}</span>
          </div>
          <h1>{title}</h1>
        </div>
      </div>
      <section className="section">
        <div className="container prose legal-prose">
          <p className="legal-updated">
            Last updated <time dateTime={legalUpdated.iso}>{legalUpdated.label}</time>
          </p>
          <p>{intro}</p>
          {sections.map((s) => (
            <section key={s.heading} className="legal-section">
              <h2>{s.heading}</h2>
              {s.body.map((block, i) =>
                Array.isArray(block) ? (
                  <ul key={i}>
                    {block.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={i}>{block}</p>
                ),
              )}
            </section>
          ))}
          <nav className="legal-others" aria-label="Other policies">
            {OTHER_PAGES.filter((o) => o.key !== page).map((o) => (
              <Link key={o.key} to={o.to}>
                {legalPages[o.key].title}
              </Link>
            ))}
            <Link to="/contact">Contact Us</Link>
          </nav>
        </div>
      </section>
    </div>
  );
}

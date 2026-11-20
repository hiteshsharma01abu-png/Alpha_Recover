import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { HeroArt } from '../../data/pageContent';
import './PageHero.css';

type Crumb = { label: string; to?: string };

/** Inner-page hero: breadcrumb, title, subtitle, optional chips, and a glowing illustration on the right. */
export function PageHero({
  crumbs,
  title,
  sub,
  art,
  children,
}: {
  crumbs: Crumb[];
  title: string;
  sub?: string;
  art?: HeroArt;
  children?: ReactNode;
}) {
  return (
    <header className={`ph${art ? ' ph-has-art' : ''}`}>
      <div className="container ph-inner">
        <div className="ph-copy">
          <nav className="ph-crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            {crumbs.map((c) => (
              <span key={c.label} className="ph-crumb">
                <span aria-hidden>›</span>
                {c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
              </span>
            ))}
          </nav>
          <h1>{title}</h1>
          {sub ? <p className="ph-sub">{sub}</p> : null}
          {children}
        </div>
        {art ? (
          <div className="ph-art" aria-hidden>
            <img src={art.src} alt="" width={art.width} height={art.height} decoding="async" fetchPriority="high" />
          </div>
        ) : null}
      </div>
    </header>
  );
}

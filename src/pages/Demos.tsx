import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { demoCategoryFilters, type DemoCategory } from '../data/content';
import {
  demoCategoryIconSrc,
  demoHeroHighlights,
  demoPlayIcon,
  demoPlayIconMint,
  demoSearchIcon,
} from '../components/visuals/demoVisuals';
import { demoThumb, useDemoVideos } from '../lib/demoVideos';
import { icons } from '../lib/icons';
import '../components/sections/DemoVideosSection.css';
import './Demos.css';

const PAGE_SIZE = 12;

function onPlay() {
  alert('This demo video is coming soon.');
}

function pageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('…');
  for (let n = start; n <= end; n += 1) pages.push(n);
  if (end < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}

export function Demos() {
  const [filter, setFilter] = useState<'all' | DemoCategory>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const demoVideos = useDemoVideos();
  const featured = demoVideos.find((d) => d.featured) ?? demoVideos[0];

  const filterCounts = useMemo(() => {
    const catalog = demoVideos.filter((d) => !d.featured);
    return {
      all: catalog.length,
      logical: catalog.filter((d) => d.category === 'logical').length,
      electrical: catalog.filter((d) => d.category === 'electrical').length,
      mechanical: catalog.filter((d) => d.category === 'mechanical').length,
      firmware: catalog.filter((d) => d.category === 'firmware').length,
    };
  }, [demoVideos]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return demoVideos.filter((d) => {
      if (d.featured) return false;
      if (filter !== 'all' && d.category !== filter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.tag.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [demoVideos, filter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const showPagination = filtered.length > PAGE_SIZE;

  function setFilterAndReset(next: 'all' | DemoCategory) {
    setFilter(next);
    setPage(1);
  }

  return (
    <div className="demos-page">
      <div className="demos-page-bg" aria-hidden />
      <div className="demos-page-glow demos-page-glow-tl" aria-hidden />
      <div className="demos-page-glow demos-page-glow-br" aria-hidden />

      <section className="demos-page-hero">
        <div className="container demos-page-hero-inner">
          <div className="demos-page-hero-copy">
            <p className="demos-kicker">
              <img src={demoPlayIconMint} alt="" width={14} height={14} decoding="async" />
              Demo Videos
            </p>
            <h1>
              Demo <em>Videos</em>
            </h1>
            <p>
              Preview real case workflows, troubleshooting, and recovery processes before you buy.
            </p>
            <ul className="demos-page-highlights">
              {demoHeroHighlights.map((h) => (
                <li key={h.id}>
                  <span className="demos-page-highlight-icon" aria-hidden>
                    <img src={h.icon} alt="" width={18} height={18} decoding="async" />
                  </span>
                  {h.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="container demos-page-body">
        <div className="demos-toolbar">
          <div className="demos-filters" role="tablist" aria-label="Demo categories">
            {demoCategoryFilters.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                className={`demos-filter${filter === f.id ? ' is-active' : ''}`}
                onClick={() => setFilterAndReset(f.id)}
              >
                {f.label} ({filterCounts[f.id]})
              </button>
            ))}
          </div>
          <label className="demos-search">
            <img src={demoSearchIcon} alt="" width={16} height={16} decoding="async" />
            <input
              type="search"
              placeholder="Search demo videos..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>

        <article className="demos-featured">
          <button type="button" className="demos-featured-media" onClick={onPlay}>
            <img
              src={demoThumb(featured)}
              alt=""
              width={1200}
              height={675}
              decoding="async"
            />
            <span className="demos-featured-badge">Featured</span>
            <span className="dv-hd">HD 1080p</span>
            <span className="dv-play demos-featured-play" aria-hidden>
              <img src={demoPlayIcon} alt="" width={26} height={26} decoding="async" />
            </span>
            <span className="demos-featured-progress" aria-hidden>
              <i />
              <span>0:00 / {featured.durationLong}</span>
            </span>
          </button>
          <div className="demos-featured-copy">
            <p className="demos-featured-cat">
              <img
                src={demoCategoryIconSrc[featured.category]}
                alt=""
                width={14}
                height={14}
                decoding="async"
              />
              {featured.tag === 'Native Solution' ? 'Logical Recovery' : featured.tag}
            </p>
            <h2>{featured.title}</h2>
            <p>{featured.description}</p>
            <ul className="demos-featured-meta">
              <li>
                <img
                  src={icons.clock}
                  alt=""
                  width={14}
                  height={14}
                  decoding="async"
                />
                {featured.durationLong} min
              </li>
              <li>
                <img
                  src={icons.gauge}
                  alt=""
                  width={14}
                  height={14}
                  decoding="async"
                />
                {featured.level}
              </li>
              <li>
                <img
                  src={icons.eye}
                  alt=""
                  width={14}
                  height={14}
                  decoding="async"
                />
                {featured.views} Views
              </li>
            </ul>
            <div className="demos-featured-actions">
              <button type="button" className="demos-btn demos-btn-primary" onClick={onPlay}>
                <img src={demoPlayIcon} alt="" width={16} height={16} decoding="async" />
                Watch Demo
              </button>
              <Link className="demos-btn demos-btn-outline" to="/training">
                View Course
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </article>

        <div className="demos-more-head">
          <h3>More Demo Videos</h3>
          <p className="demos-sort">
            Sort by: <strong>Latest</strong>
          </p>
        </div>

        <div className="demos-page-grid">
          {pageItems.map((d) => (
            <button key={d.id} type="button" className="dv-card demos-page-card" onClick={onPlay}>
              <div className="dv-thumb">
                <img
                  className="dv-art"
                  src={demoThumb(d)}
                  alt=""
                  width={800}
                  height={450}
                  loading="lazy"
                  decoding="async"
                />
                <span className="dv-cat">
                  <img
                    src={demoCategoryIconSrc[d.category] ?? demoPlayIconMint}
                    alt=""
                    width={12}
                    height={12}
                    decoding="async"
                  />
                  {d.tag}
                </span>
                <span className="dv-hd">HD 1080p</span>
                <span className="dv-duration">{d.duration}</span>
              </div>
              <div className="dv-body">
                <h3>{d.title}</h3>
                <div className="demos-page-card-meta">
                  <span>{d.views} views</span>
                  <span>{d.uploaded}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {showPagination ? (
          <nav className="demos-pagination" aria-label="Demo pages">
            <button
              type="button"
              className="demos-page-nav"
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </button>
            {pageWindow(currentPage, totalPages).map((item, i) =>
              item === '…' ? (
                <span key={`e-${i}`} className="demos-page-ellipsis">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`demos-page-num${item === currentPage ? ' is-active' : ''}`}
                  aria-current={item === currentPage ? 'page' : undefined}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              className="demos-page-nav"
              aria-label="Next page"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              ›
            </button>
          </nav>
        ) : null}

        <aside className="demos-cta-banner">
          <span className="demos-cta-icon" aria-hidden>
            <img
              src={icons.school}
              alt=""
              width={28}
              height={28}
              decoding="async"
            />
          </span>
          <div className="demos-cta-copy">
            <strong>Want to Learn Hands-On?</strong>
            <p>
              Join our professional data recovery training and work on real cases with expert
              guidance.
            </p>
          </div>
          <Link className="demos-btn demos-btn-primary" to="/#pricing">
            Explore Training Programs
            <span aria-hidden>→</span>
          </Link>
        </aside>
      </div>
    </div>
  );
}

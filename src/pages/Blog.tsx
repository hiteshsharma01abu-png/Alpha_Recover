import { Link, useSearchParams } from 'react-router-dom';
import { PageHero } from '../components/ui/PageHero';
import { blogPage, heroArt } from '../data/pageContent';
import { useBlogPosts } from '../lib/blog';
import { icons } from '../lib/icons';
import './Blog.css';

export function Blog() {
  const blogPosts = useBlogPosts();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? blogPosts.filter((p) => `${p.title} ${p.excerpt}`.toLowerCase().includes(needle))
    : blogPosts;
  const pages = Math.max(1, Math.ceil(matches.length / blogPage.pageSize));
  const page = Math.min(pages, Math.max(1, Number(params.get('page')) || 1));
  const shown = matches.slice((page - 1) * blogPage.pageSize, page * blogPage.pageSize);

  function update(next: { q?: string; page?: number }) {
    const q = next.q ?? query;
    const p = next.page ?? 1;
    const out: Record<string, string> = {};
    if (q) out.q = q;
    if (p > 1) out.page = String(p);
    setParams(out, { replace: next.q !== undefined });
  }

  // Same post → same decorative thumbnail, wherever it appears in the list.
  const thumbFor = (slug: string) => {
    const i = blogPosts.findIndex((p) => p.slug === slug);
    return blogPage.thumbs[(i < 0 ? 0 : i) % blogPage.thumbs.length];
  };

  return (
    <div>
      <PageHero crumbs={[{ label: 'Blog' }]} title={blogPage.title} sub={blogPage.sub} art={heroArt.laptop} />
      <section className="section">
        <div className="container bl">
          <label className="bl-search">
            <img src={icons.search} alt="" width={20} height={20} />
            <span className="bl-sr">Search blog articles</span>
            <input
              type="search"
              placeholder="Search blog articles…"
              value={query}
              onChange={(e) => update({ q: e.target.value })}
            />
          </label>

          {shown.length ? (
            <div className="bl-list">
              {shown.map((post) => (
                <article key={post.slug} className="bl-card">
                  <Link to={`/blog/${post.slug}`} className="bl-thumb" tabIndex={-1} aria-hidden>
                    <img src={thumbFor(post.slug)} alt="" width={320} height={180} loading="lazy" decoding="async" />
                  </Link>
                  <div className="bl-body">
                    <time dateTime={post.date}>
                      <img src={icons.calendar} alt="" width={16} height={16} />
                      {post.date}
                    </time>
                    <h2>
                      <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                    </h2>
                    <p>{post.excerpt}</p>
                    <Link className="bl-read" to={`/blog/${post.slug}`}>
                      Read article <span aria-hidden>→</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="bl-empty">No articles match “{query}”.</p>
          )}

          {pages > 1 ? (
            <nav className="bl-pages" aria-label="Blog pages">
              <button type="button" onClick={() => update({ page: page - 1 })} disabled={page === 1} aria-label="Previous page">
                <img src={icons.chevronLeft} alt="" width={18} height={18} />
              </button>
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" onClick={() => update({ page: n })} aria-current={n === page ? 'page' : undefined}>
                  {n}
                </button>
              ))}
              <button type="button" onClick={() => update({ page: page + 1 })} disabled={page === pages} aria-label="Next page">
                <img src={icons.chevronRight} alt="" width={18} height={18} />
              </button>
            </nav>
          ) : null}
        </div>
      </section>
    </div>
  );
}

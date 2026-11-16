import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdminSession } from '../../auth/adminSessionContext';
import { Pagination, StatusBadge } from '../../components/DataTable';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import type { BlogState } from '../../lib/adminApi';
import { ago, formatIst } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import { useTableState } from '../../lib/useTableState';
import { BLOG_STATE_LABEL, BLOG_STATE_TONE } from './blogDisplay';
import './Blog.css';

const FILTER_KEYS = ['state', 'q'] as const;
const TABS: (BlogState | 'all')[] = ['all', 'draft', 'scheduled', 'published'];

/** /admin/blog — posts, newest edit first. */
export function BlogListPage() {
  const { can } = useAdminSession();
  const navigate = useNavigate();
  const table = useTableState(FILTER_KEYS);
  const filters = table.values;
  const params = { ...filters, page: String(table.page) };
  const list = useResource(JSON.stringify(params), () => adminApi.blog.list(params));

  const [search, setSearch] = useState(filters.q ?? '');
  const { update } = table;
  useEffect(() => {
    if ((filters.q ?? '') === search.trim()) return;
    const t = window.setTimeout(() => update({ q: search.trim() || undefined }, { replace: true }), 300);
    return () => window.clearTimeout(t);
  }, [search, filters.q, update]);

  const counts = list.data?.meta.counts;
  const activeTab = filters.state ?? 'all';
  const open = (id: string) => navigate(`/admin/blog/${id}`);

  return (
    <div>
      <div className="adm-enr-bar">
        <div className="adm-tabs" role="tablist" aria-label="Post status">
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={activeTab === t} onClick={() => update({ state: t === 'all' ? undefined : t })}>
              {t === 'all' ? 'All' : BLOG_STATE_LABEL[t]}
              {counts ? <span className="adm-count">{t === 'all' ? counts.draft + counts.scheduled + counts.published : counts[t]}</span> : null}
            </button>
          ))}
        </div>
        {can('blog.add') ? (
          <Link className="adm-btn adm-btn-primary adm-blog-new" to="/admin/blog/new">
            + New post
          </Link>
        ) : null}
      </div>
      <div className="adm-filters">
        <label className="adm-search">
          Search
          <input type="search" placeholder="Title or slug" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      {list.error && !list.data ? (
        <ErrorState message="Posts could not be loaded." requestId={list.error.requestId} onRetry={list.reload} />
      ) : !list.data ? (
        <Skeleton height={300} />
      ) : list.data.rows.length === 0 ? (
        <EmptyState>
          <p>{filters.q || filters.state ? 'No posts match these filters.' : 'No posts yet.'}</p>
        </EmptyState>
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className={`adm-table${list.loading ? ' is-loading' : ''}`} aria-busy={list.loading}>
              <thead>
                <tr>
                  <th scope="col">Post</th>
                  <th scope="col">Status</th>
                  <th scope="col">Length</th>
                  <th scope="col">Last edited</th>
                </tr>
              </thead>
              <tbody>
                {list.data.rows.map((p) => (
                  <tr
                    key={p.id}
                    tabIndex={0}
                    onClick={() => open(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') open(p.id);
                    }}
                  >
                    <td data-label="Post">
                      <strong>{p.title}</strong>
                      <span className="adm-sub">/blog/{p.slug}</span>
                    </td>
                    <td data-label="Status">
                      <StatusBadge tone={BLOG_STATE_TONE[p.state]}>{BLOG_STATE_LABEL[p.state]}</StatusBadge>
                      {p.publishedAt && p.state !== 'draft' ? <span className="adm-sub">{p.state === 'scheduled' ? 'goes live ' : ''}{formatIst(p.publishedAt)}</span> : null}
                    </td>
                    <td data-label="Length">
                      {p.words.toLocaleString('en-IN')} words
                      {p.words < 150 ? <span className="adm-sub">Short: still a summary?</span> : null}
                    </td>
                    <td data-label="Last edited">
                      <time dateTime={p.updatedAt} title={formatIst(p.updatedAt)}>
                        {ago(p.updatedAt)}
                      </time>
                      {p.author?.firstName ? <span className="adm-sub">by {p.author.firstName}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={list.data.meta.page} pageSize={list.data.meta.pageSize} total={list.data.meta.total} onPage={(page) => update({ page: String(page) })} />
        </>
      )}
    </div>
  );
}

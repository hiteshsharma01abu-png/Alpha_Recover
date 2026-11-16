import { useEffect, useState } from 'react';
import { demoThumbFor } from '../../../lib/demoVideos';
import { useAdminSession } from '../../auth/adminSessionContext';
import { StatusBadge } from '../../components/DataTable';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import type { PublishStatus } from '../../lib/adminApi';
import { useResource } from '../../lib/useResource';
import { useTableState } from '../../lib/useTableState';
import { PUBLISH_LABEL, PUBLISH_STATUSES, PUBLISH_TONE } from '../plans/planDisplay';
import { DemoVideoDrawer } from './DemoVideoDrawer';
import { CATEGORY_LABEL, LEVEL_LABEL, mmss } from './demoDisplay';
import './Demos.css';

const FILTER_KEYS = ['status', 'category', 'q'] as const;
const TABLE_KEYS = [...FILTER_KEYS, 'video'] as const;
const TABS: (PublishStatus | 'all')[] = ['all', ...PUBLISH_STATUSES];

/** /admin/demo-videos — the public demo catalogue: text, order, status and the featured video. */
export function DemoVideosPage() {
  const { can } = useAdminSession();
  const table = useTableState(TABLE_KEYS);
  const { video: openId, ...filterValues } = table.values;
  const filters = filterValues as Record<(typeof FILTER_KEYS)[number], string | undefined>;
  const list = useResource(JSON.stringify(filters), () => adminApi.demoVideos.list(filters));
  const [notice, setNotice] = useState('');

  const [search, setSearch] = useState(filters.q ?? '');
  const { update } = table;
  useEffect(() => {
    if ((filters.q ?? '') === search.trim()) return;
    const t = window.setTimeout(() => update({ q: search.trim() || undefined }, { replace: true }), 300);
    return () => window.clearTimeout(t);
  }, [search, filters.q, update]);

  const counts = list.data?.meta.counts;
  const activeTab = filters.status ?? 'all';
  const hasFilters = Boolean(filters.category || filters.q);
  const open = (id: string) => update({ video: id }, { keepPage: true });

  return (
    <div>
      <div className="adm-enr-bar">
        <div className="adm-tabs" role="tablist" aria-label="Video status">
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={activeTab === t} onClick={() => update({ status: t === 'all' ? undefined : t })}>
              {t === 'all' ? 'All' : PUBLISH_LABEL[t]}
              {counts ? <span className="adm-count">{t === 'all' ? counts.draft + counts.published + counts.archived : counts[t]}</span> : null}
            </button>
          ))}
        </div>
        {can('demos.add') ? (
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => open('new')}>
            + New video
          </button>
        ) : null}
      </div>

      <div className="adm-filters">
        <label className="adm-search">
          Search
          <input type="search" placeholder="Title, label or tag" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          Category
          <select className="adm-select" value={filters.category ?? ''} onChange={(e) => update({ category: e.target.value || undefined })}>
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {hasFilters ? (
          <div className="adm-filters-actions">
            <button
              type="button"
              className="adm-btn"
              onClick={() => {
                setSearch('');
                update({ category: undefined, q: undefined });
              }}
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </div>

      {notice ? (
        <p className="adm-notice" role="status">
          {notice}
        </p>
      ) : null}

      {list.error && !list.data ? (
        <ErrorState message="Demo videos could not be loaded." requestId={list.error.requestId} onRetry={list.reload} />
      ) : !list.data ? (
        <Skeleton height={320} />
      ) : list.data.rows.length === 0 ? (
        <EmptyState>
          <p>{hasFilters || filters.status ? 'No videos match these filters.' : 'No demo videos yet.'}</p>
        </EmptyState>
      ) : (
        <div className="adm-table-wrap">
          <table className={`adm-table${list.loading ? ' is-loading' : ''}`} aria-busy={list.loading}>
            <thead>
              <tr>
                <th scope="col">Video</th>
                <th scope="col">Category</th>
                <th scope="col">Length</th>
                <th scope="col">Views</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.data.rows.map((v) => (
                <tr
                  key={v.id}
                  tabIndex={0}
                  aria-selected={openId === v.id}
                  onClick={() => open(v.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') open(v.id);
                  }}
                >
                  <td data-label="Video">
                    <span className="adm-demo-cell">
                      <img src={demoThumbFor(v.slug, v.thumbnailUrl)} alt="" width={72} height={40} loading="lazy" />
                      <span>
                        <strong>{v.title}</strong>
                        <span className="adm-sub">
                          {v.tag} · {LEVEL_LABEL[v.level]}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td data-label="Category">{CATEGORY_LABEL[v.category]}</td>
                  <td data-label="Length">{mmss(v.durationSeconds)}</td>
                  <td data-label="Views">{v.viewCount.toLocaleString('en-IN')}</td>
                  <td data-label="Status">
                    <span className="adm-badges">
                      <StatusBadge tone={PUBLISH_TONE[v.status]}>{PUBLISH_LABEL[v.status]}</StatusBadge>
                      {v.isFeatured ? <StatusBadge tone="accent">Featured</StatusBadge> : null}
                      {v.hasVideo ? null : <StatusBadge tone="muted">No video file</StatusBadge>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DemoVideoDrawer
        id={openId ?? null}
        onClose={() => update({ video: undefined }, { keepPage: true })}
        onSaved={(text, newId) => {
          setNotice(text);
          list.reload();
          update({ video: newId }, { keepPage: true, replace: true });
        }}
      />
    </div>
  );
}

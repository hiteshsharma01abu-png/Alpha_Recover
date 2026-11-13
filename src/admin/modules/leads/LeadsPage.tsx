import { useEffect, useState } from 'react';
import { LEAD_REASONS, LEAD_SOURCE_LABELS, LEAD_STATUSES } from '../../../../shared/leads';
import type { LeadStatus } from '../../../../shared/leads';
import { useAdminSession } from '../../auth/adminSessionContext';
import { Pagination, StatusBadge } from '../../components/DataTable';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import { useResource } from '../../lib/useResource';
import { useTableState } from '../../lib/useTableState';
import { LeadDrawer } from './LeadDrawer';
import { STATUS_TONE, ago, formatIst, reasonLabel, sourceLabel, statusLabel } from './leadDisplay';
import './LeadsPage.css';

const FILTER_KEYS = ['status', 'reason', 'source', 'assignee', 'q', 'from', 'to'] as const;
const TABLE_KEYS = [...FILTER_KEYS, 'lead'] as const;
const TABS: (LeadStatus | 'open')[] = ['open', ...LEAD_STATUSES];

/** /admin/leads — contact-form and callback inquiries: triage, assign, follow up, export. */
export function LeadsPage() {
  const { can } = useAdminSession();
  const table = useTableState(TABLE_KEYS);
  const { lead: openId, ...filterValues } = table.values;
  const filters = filterValues as Record<(typeof FILTER_KEYS)[number], string | undefined>;
  const listParams = { ...filters, page: String(table.page) };
  const key = JSON.stringify(listParams);
  const list = useResource(key, () => adminApi.leads.list(listParams));
  const assignees = useResource('assignees', adminApi.leads.assignees);

  // Search box: type freely, the URL (and the request) follows after a short pause.
  const [search, setSearch] = useState(filters.q ?? '');
  const { update } = table;
  useEffect(() => {
    if ((filters.q ?? '') === search.trim()) return;
    const t = window.setTimeout(() => update({ q: search.trim() || undefined }, { replace: true }), 300);
    return () => window.clearTimeout(t);
  }, [search, filters.q, update]);

  const activeTab = filters.status ?? 'open';
  const counts = list.data?.meta.counts;
  const hasFilters = FILTER_KEYS.some((k) => k !== 'status' && filters[k]);

  return (
    <div className="adm-leads">
      <div className="adm-tabs" role="tablist" aria-label="Lead status">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={activeTab === t}
            onClick={() => table.update({ status: t === 'open' ? undefined : t })}
          >
            {t === 'open' ? 'All open' : statusLabel(t)}
            {counts ? <span className="adm-count">{counts[t].toLocaleString('en-IN')}</span> : null}
          </button>
        ))}
      </div>

      <div className="adm-filters">
        <label className="adm-search">
          Search
          <input type="search" placeholder="Name, email, message or phone digits" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          Reason
          <select className="adm-select" value={filters.reason ?? ''} onChange={(e) => table.update({ reason: e.target.value || undefined })}>
            <option value="">All reasons</option>
            {LEAD_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Source
          <select className="adm-select" value={filters.source ?? ''} onChange={(e) => table.update({ source: e.target.value || undefined })}>
            <option value="">All sources</option>
            {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Assigned to
          <select className="adm-select" value={filters.assignee ?? ''} onChange={(e) => table.update({ assignee: e.target.value || undefined })}>
            <option value="">Anyone</option>
            <option value="me">Me</option>
            <option value="unassigned">Unassigned</option>
            {assignees.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" value={filters.from ?? ''} max={filters.to} onChange={(e) => table.update({ from: e.target.value || undefined })} />
        </label>
        <label>
          To
          <input type="date" value={filters.to ?? ''} min={filters.from} onChange={(e) => table.update({ to: e.target.value || undefined })} />
        </label>
        <div className="adm-filters-actions">
          {hasFilters ? (
            <button
              type="button"
              className="adm-btn"
              onClick={() => {
                setSearch('');
                table.update({ reason: undefined, source: undefined, assignee: undefined, q: undefined, from: undefined, to: undefined });
              }}
            >
              Clear filters
            </button>
          ) : null}
          {can('leads.export') ? (
            <a className="adm-btn" href={adminApi.leads.exportUrl(filters)} download>
              Export CSV
            </a>
          ) : null}
        </div>
      </div>

      {list.error && !list.data ? (
        <ErrorState message="Leads could not be loaded." requestId={list.error.requestId} onRetry={list.reload} />
      ) : !list.data ? (
        <Skeleton height={320} />
      ) : list.data.rows.length === 0 ? (
        <EmptyState>
          {hasFilters || filters.status ? (
            <p>No leads match these filters.</p>
          ) : (
            <p>No leads yet. Contact form and callback requests from the website will appear here.</p>
          )}
        </EmptyState>
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className={`adm-table${list.loading ? ' is-loading' : ''}`} aria-busy={list.loading}>
              <thead>
                <tr>
                  <th scope="col">Lead</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Status</th>
                  <th scope="col">Assigned</th>
                  <th scope="col">Received</th>
                </tr>
              </thead>
              <tbody>
                {list.data.rows.map((l) => (
                  <tr
                    key={l.id}
                    tabIndex={0}
                    aria-selected={openId === l.id}
                    onClick={() => table.update({ lead: l.id }, { keepPage: true })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        table.update({ lead: l.id }, { keepPage: true });
                      }
                    }}
                  >
                    <td data-label="Lead">
                      <strong>{l.name ?? sourceLabel(l.source)}</strong>
                      {l.name ? <span className="adm-sub">{sourceLabel(l.source)}</span> : null}
                    </td>
                    <td data-label="Contact">
                      {l.phone ?? '—'}
                      {l.email ? <span className="adm-sub">{l.email}</span> : null}
                    </td>
                    <td data-label="Reason">{reasonLabel(l.reason)}</td>
                    <td data-label="Status">
                      <StatusBadge tone={STATUS_TONE[l.status]}>{statusLabel(l.status)}</StatusBadge>
                    </td>
                    <td data-label="Assigned">{l.assignee?.firstName ?? <span className="adm-muted">Unassigned</span>}</td>
                    <td data-label="Received">
                      <time dateTime={l.createdAt} title={formatIst(l.createdAt)}>
                        {ago(l.createdAt)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={list.data.meta.page}
            pageSize={list.data.meta.pageSize}
            total={list.data.meta.total}
            onPage={(page) => table.update({ page: String(page) })}
          />
        </>
      )}

      <LeadDrawer
        id={openId ?? null}
        assignees={assignees.data ?? []}
        onClose={() => table.update({ lead: undefined }, { keepPage: true })}
        onChanged={list.reload}
      />
    </div>
  );
}

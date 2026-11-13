import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { REGISTER_COUNTRIES } from '../../../../shared/countries';
import { Pagination, StatusBadge } from '../../components/DataTable';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import { ago, countryName, formatDate, formatIst } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import { useTableState } from '../../lib/useTableState';
import './Students.css';

const FILTER_KEYS = ['q', 'status', 'enrolled', 'verified', 'country'] as const;

/** /admin/students — find a learner, then open their account. */
export function StudentsPage() {
  const navigate = useNavigate();
  const table = useTableState(FILTER_KEYS);
  const filters = table.values;
  const params = { ...filters, page: String(table.page) };
  const list = useResource(JSON.stringify(params), () => adminApi.students.list(params));

  const [search, setSearch] = useState(filters.q ?? '');
  const { update } = table;
  useEffect(() => {
    if ((filters.q ?? '') === search.trim()) return;
    const t = window.setTimeout(() => update({ q: search.trim() || undefined }, { replace: true }), 300);
    return () => window.clearTimeout(t);
  }, [search, filters.q, update]);

  const hasFilters = FILTER_KEYS.some((k) => filters[k]);
  const open = (id: string) => navigate(`/admin/students/${id}`);

  return (
    <div>
      <div className="adm-filters">
        <label className="adm-search">
          Search
          <input type="search" placeholder="Name, email or phone digits" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          Course access
          <select className="adm-select" value={filters.enrolled ?? ''} onChange={(e) => update({ enrolled: e.target.value || undefined })}>
            <option value="">Everyone</option>
            <option value="yes">Enrolled</option>
            <option value="no">Not enrolled</option>
          </select>
        </label>
        <label>
          Account
          <select className="adm-select" value={filters.status ?? ''} onChange={(e) => update({ status: e.target.value || undefined })}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <label>
          Email
          <select className="adm-select" value={filters.verified ?? ''} onChange={(e) => update({ verified: e.target.value || undefined })}>
            <option value="">Any</option>
            <option value="yes">Verified</option>
            <option value="no">Not verified</option>
          </select>
        </label>
        <label>
          Country
          <select className="adm-select" value={filters.country ?? ''} onChange={(e) => update({ country: e.target.value || undefined })}>
            <option value="">All countries</option>
            {REGISTER_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
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
                update({ q: undefined, status: undefined, enrolled: undefined, verified: undefined, country: undefined });
              }}
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </div>

      {list.error && !list.data ? (
        <ErrorState message="Students could not be loaded." requestId={list.error.requestId} onRetry={list.reload} />
      ) : !list.data ? (
        <Skeleton height={320} />
      ) : list.data.rows.length === 0 ? (
        <EmptyState>
          <p>{hasFilters ? 'No students match these filters.' : 'No students yet. Accounts created on the website appear here.'}</p>
        </EmptyState>
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className={`adm-table${list.loading ? ' is-loading' : ''}`} aria-busy={list.loading}>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Country</th>
                  <th scope="col">Access</th>
                  <th scope="col">Last sign-in</th>
                  <th scope="col">Joined</th>
                </tr>
              </thead>
              <tbody>
                {list.data.rows.map((s) => (
                  <tr
                    key={s.id}
                    tabIndex={0}
                    onClick={() => open(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') open(s.id);
                    }}
                  >
                    <td data-label="Student">
                      <strong>{[s.firstName, s.lastName].filter(Boolean).join(' ')}</strong>
                      <span className="adm-sub">
                        {s.email}
                        {s.emailVerified ? '' : ' · not verified'}
                      </span>
                    </td>
                    <td data-label="Phone">{s.phone ?? <span className="adm-muted">—</span>}</td>
                    <td data-label="Country">{countryName(s.country)}</td>
                    <td data-label="Access">
                      <span className="adm-badges">
                        {s.enrolled ? <StatusBadge tone="success">Enrolled</StatusBadge> : <StatusBadge tone="muted">No course</StatusBadge>}
                        {s.status === 'suspended' ? <StatusBadge tone="danger">Suspended</StatusBadge> : null}
                      </span>
                    </td>
                    <td data-label="Last sign-in">
                      {s.lastLoginAt ? (
                        <time dateTime={s.lastLoginAt} title={formatIst(s.lastLoginAt)}>
                          {ago(s.lastLoginAt)}
                        </time>
                      ) : (
                        <span className="adm-muted">Never</span>
                      )}
                    </td>
                    <td data-label="Joined">{formatDate(s.createdAt)}</td>
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

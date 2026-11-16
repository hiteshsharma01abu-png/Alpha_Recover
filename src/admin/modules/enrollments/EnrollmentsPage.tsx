import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminSession } from '../../auth/adminSessionContext';
import { Pagination, StatusBadge } from '../../components/DataTable';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import type { EnrollmentRow, EnrollmentStatus } from '../../lib/adminApi';
import { formatDate } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import { useTableState } from '../../lib/useTableState';
import { EndDateDialog, GrantDialog, RevokeDialog } from './EnrollmentDialogs';
import { ENROLLMENT_STATUSES, SOURCE_LABEL, STATUS_LABEL, STATUS_TONE } from './enrollmentDisplay';
import './Enrollments.css';

const FILTER_KEYS = ['status', 'source', 'planId', 'q'] as const;
const TABS: (EnrollmentStatus | 'all')[] = ['all', ...ENROLLMENT_STATUSES];

type Pending = { kind: 'end' | 'revoke'; row: EnrollmentRow } | null;

const studentName = (r: EnrollmentRow) => [r.student.firstName, r.student.lastName].filter(Boolean).join(' ');

/** /admin/enrollments — who has course access, plus manual grants, end-date changes and revokes. */
export function EnrollmentsPage() {
  const { can } = useAdminSession();
  const table = useTableState(FILTER_KEYS);
  const filters = table.values;
  const params = { ...filters, page: String(table.page) };
  const list = useResource(JSON.stringify(params), () => adminApi.enrollments.list(params));
  const plans = useResource('enrollment-plans', adminApi.enrollments.plans);
  const [granting, setGranting] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [notice, setNotice] = useState('');

  const [search, setSearch] = useState(filters.q ?? '');
  const { update } = table;
  useEffect(() => {
    if ((filters.q ?? '') === search.trim()) return;
    const t = window.setTimeout(() => update({ q: search.trim() || undefined }, { replace: true }), 300);
    return () => window.clearTimeout(t);
  }, [search, filters.q, update]);

  const done = (text: string) => {
    setGranting(false);
    setPending(null);
    setNotice(text);
    list.reload();
  };

  const activeTab = filters.status ?? 'all';
  const counts = list.data?.meta.counts;
  const hasFilters = FILTER_KEYS.some((k) => k !== 'status' && filters[k]);
  const canEnd = can('enrollments.edit');
  const canRevoke = can('enrollments.revoke');
  const hasActions = canEnd || canRevoke;

  return (
    <div>
      <div className="adm-enr-bar">
        <div className="adm-tabs" role="tablist" aria-label="Enrollment status">
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={activeTab === t} onClick={() => update({ status: t === 'all' ? undefined : t })}>
              {t === 'all' ? 'All' : STATUS_LABEL[t]}
              {counts ? <span className="adm-count">{(t === 'all' ? counts.active + counts.expired + counts.revoked : counts[t]).toLocaleString('en-IN')}</span> : null}
            </button>
          ))}
        </div>
        {can('enrollments.add') ? (
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => setGranting(true)}>
            + Grant access
          </button>
        ) : null}
      </div>

      <div className="adm-filters">
        <label className="adm-search">
          Search
          <input type="search" placeholder="Student name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          Plan
          <select className="adm-select" value={filters.planId ?? ''} onChange={(e) => update({ planId: e.target.value || undefined })}>
            <option value="">All plans</option>
            {plans.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select className="adm-select" value={filters.source ?? ''} onChange={(e) => update({ source: e.target.value || undefined })}>
            <option value="">All types</option>
            {Object.entries(SOURCE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="adm-filters-actions">
          {hasFilters ? (
            <button
              type="button"
              className="adm-btn"
              onClick={() => {
                setSearch('');
                update({ source: undefined, planId: undefined, q: undefined });
              }}
            >
              Clear filters
            </button>
          ) : null}
          {can('enrollments.export') ? (
            <a className="adm-btn" href={adminApi.enrollments.exportUrl(filters)} download>
              Export CSV
            </a>
          ) : null}
        </div>
      </div>

      {notice ? (
        <p className="adm-notice" role="status">
          {notice}
        </p>
      ) : null}

      {list.error && !list.data ? (
        <ErrorState message="Enrollments could not be loaded." requestId={list.error.requestId} onRetry={list.reload} />
      ) : !list.data ? (
        <Skeleton height={320} />
      ) : list.data.rows.length === 0 ? (
        <EmptyState>
          <p>{hasFilters || filters.status ? 'No enrollments match these filters.' : 'No one has course access yet. Purchases and staff grants appear here.'}</p>
        </EmptyState>
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className={`adm-table${list.loading ? ' is-loading' : ''}`} aria-busy={list.loading}>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Status</th>
                  <th scope="col">Access</th>
                  <th scope="col">Type</th>
                  {hasActions ? <th scope="col">{''}</th> : null}
                </tr>
              </thead>
              <tbody className="adm-static-rows">
                {list.data.rows.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Student">
                      <Link className="adm-enr-student" to={`/admin/students/${r.student.id}`}>
                        {studentName(r)}
                      </Link>
                      <span className="adm-sub">{r.student.email}</span>
                    </td>
                    <td data-label="Plan">{r.plan}</td>
                    <td data-label="Status">
                      <StatusBadge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusBadge>
                    </td>
                    <td data-label="Access">
                      {formatDate(r.startsAt)} → {r.expiresAt ? formatDate(r.expiresAt) : 'lifetime'}
                      {r.status === 'revoked' && r.revokedReason ? <span className="adm-sub">Revoked: {r.revokedReason}</span> : null}
                    </td>
                    <td data-label="Type">
                      {SOURCE_LABEL[r.source]}
                      {r.grantedBy?.firstName ? <span className="adm-sub">by {r.grantedBy.firstName}</span> : null}
                    </td>
                    {hasActions ? (
                      <td data-label="" className="adm-td-actions">
                        {r.status === 'active' ? (
                          <span className="adm-enr-actions">
                            {canEnd ? (
                              <button type="button" className="adm-btn" onClick={() => setPending({ kind: 'end', row: r })}>
                                Change end
                              </button>
                            ) : null}
                            {canRevoke ? (
                              <button type="button" className="adm-btn adm-btn-danger-outline" onClick={() => setPending({ kind: 'revoke', row: r })}>
                                Revoke
                              </button>
                            ) : null}
                          </span>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={list.data.meta.page} pageSize={list.data.meta.pageSize} total={list.data.meta.total} onPage={(page) => update({ page: String(page) })} />
        </>
      )}

      {granting ? <GrantDialog onClose={() => setGranting(false)} onDone={done} /> : null}
      {pending?.kind === 'end' ? <EndDateDialog enrollment={pending.row} onClose={() => setPending(null)} onDone={done} /> : null}
      {pending?.kind === 'revoke' ? (
        <RevokeDialog enrollment={{ ...pending.row, studentName: studentName(pending.row) }} onClose={() => setPending(null)} onDone={done} />
      ) : null}
    </div>
  );
}

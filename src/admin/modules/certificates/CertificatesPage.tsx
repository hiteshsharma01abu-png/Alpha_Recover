import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminSession } from '../../auth/adminSessionContext';
import { Pagination, StatusBadge } from '../../components/DataTable';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import type { CertificateRow } from '../../lib/adminApi';
import { formatDate } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import { useTableState } from '../../lib/useTableState';
import { IssueCertificateDialog, RenameCertificateDialog, RevokeCertificateDialog } from './CertificateDialogs';
import './Certificates.css';

const FILTER_KEYS = ['status', 'q', 'from', 'to'] as const;
const TABS = ['all', 'valid', 'revoked'] as const;

type Pending = { kind: 'rename' | 'revoke'; cert: CertificateRow } | null;

/** /admin/certificates — look up a certificate, issue one manually, fix a name, or revoke. */
export function CertificatesPage() {
  const { can } = useAdminSession();
  const table = useTableState(FILTER_KEYS);
  const filters = table.values;
  const params = { ...filters, page: String(table.page) };
  const list = useResource(JSON.stringify(params), () => adminApi.certificates.list(params));
  const [issuing, setIssuing] = useState(false);
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
    setIssuing(false);
    setPending(null);
    setNotice(text);
    list.reload();
  };
  const counts = list.data?.meta.counts;
  const activeTab = filters.status ?? 'all';
  const hasFilters = Boolean(filters.q || filters.from || filters.to);
  const canAct = can('certificates.edit') || can('certificates.revoke');

  return (
    <div>
      <div className="adm-enr-bar">
        <div className="adm-tabs" role="tablist" aria-label="Certificate status">
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={activeTab === t} onClick={() => update({ status: t === 'all' ? undefined : t })}>
              {t === 'all' ? 'All' : t === 'valid' ? 'Valid' : 'Revoked'}
              {counts ? <span className="adm-count">{t === 'all' ? counts.valid + counts.revoked : counts[t]}</span> : null}
            </button>
          ))}
        </div>
        {can('certificates.add') ? (
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => setIssuing(true)}>
            + Issue certificate
          </button>
        ) : null}
      </div>

      <div className="adm-filters">
        <label className="adm-search">
          Search
          <input type="search" placeholder="Certificate ID, name or student email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          Issued from
          <input type="date" value={filters.from ?? ''} max={filters.to} onChange={(e) => update({ from: e.target.value || undefined })} />
        </label>
        <label>
          To
          <input type="date" value={filters.to ?? ''} min={filters.from} onChange={(e) => update({ to: e.target.value || undefined })} />
        </label>
        <div className="adm-filters-actions">
          {hasFilters ? (
            <button
              type="button"
              className="adm-btn"
              onClick={() => {
                setSearch('');
                update({ q: undefined, from: undefined, to: undefined });
              }}
            >
              Clear filters
            </button>
          ) : null}
          {can('certificates.export') ? (
            <a className="adm-btn" href={adminApi.certificates.exportUrl(filters)} download>
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
        <ErrorState message="Certificates could not be loaded." requestId={list.error.requestId} onRetry={list.reload} />
      ) : !list.data ? (
        <Skeleton height={300} />
      ) : list.data.rows.length === 0 ? (
        <EmptyState>
          <p>{hasFilters || filters.status ? 'No certificates match these filters.' : 'No certificates issued yet.'}</p>
        </EmptyState>
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className={`adm-table${list.loading ? ' is-loading' : ''}`} aria-busy={list.loading}>
              <thead>
                <tr>
                  <th scope="col">Certificate</th>
                  <th scope="col">Issued to</th>
                  <th scope="col">Program</th>
                  <th scope="col">Status</th>
                  {canAct ? <th scope="col">{''}</th> : null}
                </tr>
              </thead>
              <tbody className="adm-static-rows">
                {list.data.rows.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Certificate">
                      <a className="adm-cert-code" href={`/verify-certificate?code=${r.code}`} target="_blank" rel="noreferrer" title="Open the public Verify page">
                        {r.code}
                      </a>
                      <span className="adm-sub">
                        {formatDate(r.issuedAt)}
                        {r.issuedBy?.firstName ? ` · by ${r.issuedBy.firstName}` : ''}
                      </span>
                    </td>
                    <td data-label="Issued to">
                      <strong>{r.recipientName}</strong>
                      <span className="adm-sub">
                        {can('students.view') ? <Link to={`/admin/students/${r.student.id}`}>{r.student.email}</Link> : r.student.email}
                      </span>
                    </td>
                    <td data-label="Program">{r.programTitle}</td>
                    <td data-label="Status">
                      <StatusBadge tone={r.status === 'valid' ? 'success' : 'danger'}>{r.status === 'valid' ? 'Valid' : 'Revoked'}</StatusBadge>
                      {r.status === 'revoked' && r.revokedReason ? <span className="adm-sub">{r.revokedReason}</span> : null}
                    </td>
                    {canAct ? (
                      <td data-label="" className="adm-td-actions">
                        {r.status === 'valid' ? (
                          <span className="adm-enr-actions">
                            {can('certificates.edit') ? (
                              <button type="button" className="adm-btn" onClick={() => setPending({ kind: 'rename', cert: r })}>
                                Correct name
                              </button>
                            ) : null}
                            {can('certificates.revoke') ? (
                              <button type="button" className="adm-btn adm-btn-danger-outline" onClick={() => setPending({ kind: 'revoke', cert: r })}>
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

      {issuing ? <IssueCertificateDialog onClose={() => setIssuing(false)} onDone={done} /> : null}
      {pending?.kind === 'rename' ? <RenameCertificateDialog cert={pending.cert} onClose={() => setPending(null)} onDone={done} /> : null}
      {pending?.kind === 'revoke' ? <RevokeCertificateDialog cert={pending.cert} onClose={() => setPending(null)} onDone={done} /> : null}
    </div>
  );
}

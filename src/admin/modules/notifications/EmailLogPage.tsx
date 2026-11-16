import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError } from '../../../lib/api';
import { useAdminSession } from '../../auth/adminSessionContext';
import { Drawer, Pagination, StatusBadge } from '../../components/DataTable';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import type { EmailJob, EmailState } from '../../lib/adminApi';
import { ago, formatIst } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import { useTableState } from '../../lib/useTableState';
import './EmailLog.css';

const FILTER_KEYS = ['state', 'template', 'q', 'from', 'to'] as const;
const TABLE_KEYS = [...FILTER_KEYS, 'email'] as const;
const TABS: (EmailState | 'all')[] = ['all', 'failed', 'retrying', 'queued', 'sent'];

const STATE_LABEL: Record<EmailState, string> = { queued: 'Queued', retrying: 'Retrying', sent: 'Sent', failed: 'Failed' };
const STATE_TONE: Record<EmailState, 'info' | 'warning' | 'success' | 'danger'> = { queued: 'info', retrying: 'warning', sent: 'success', failed: 'danger' };
const TEMPLATE_LABEL: Record<string, string> = {
  verify_email: 'Email verification',
  password_reset: 'Password reset',
  staff_invite: 'Team invite',
  lead_alert: 'New lead alert (to team)',
  lead_ack: 'Lead confirmation (to visitor)',
};
const templateLabel = (t: string) => TEMPLATE_LABEL[t] ?? t;

/** /admin/notifications — every email the site queued: what went out, what failed and why, and retry. */
export function EmailLogPage() {
  const table = useTableState(TABLE_KEYS);
  const { email: openId, ...filterValues } = table.values;
  const filters = filterValues as Record<(typeof FILTER_KEYS)[number], string | undefined>;
  const params = { ...filters, page: String(table.page) };
  const list = useResource(JSON.stringify(params), () => adminApi.notifications.list(params));
  const [notice, setNotice] = useState('');

  const [search, setSearch] = useState(filters.q ?? '');
  const { update } = table;
  useEffect(() => {
    if ((filters.q ?? '') === search.trim()) return;
    const t = window.setTimeout(() => update({ q: search.trim() || undefined }, { replace: true }), 300);
    return () => window.clearTimeout(t);
  }, [search, filters.q, update]);

  const counts = list.data?.meta.counts;
  const activeTab = filters.state ?? 'all';
  const hasFilters = Boolean(filters.template || filters.q || filters.from || filters.to);
  const open = list.data?.rows.find((r) => r.id === openId) ?? null;
  const stalledSince = list.data?.meta.stalledSince;

  return (
    <div>
      <p className="adm-muted adm-email-intro">
        Emails are queued by the website and sent every few minutes. A failed send is retried up to 5 times (after 1, 2, 4 and 8 minutes) before it shows as Failed.
      </p>
      {stalledSince ? (
        <p className="adm-email-stalled" role="alert">
          Emails have been waiting to go out since {formatIst(stalledSince)}. The scheduled sending job may not be running: ask whoever manages the server to check the cron jobs (docs/DEPLOYMENT.md).
        </p>
      ) : null}
      <div className="adm-tabs" role="tablist" aria-label="Email status">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={activeTab === t} onClick={() => update({ state: t === 'all' ? undefined : t })}>
            {t === 'all' ? 'All' : STATE_LABEL[t]}
            {counts ? <span className="adm-count">{(t === 'all' ? counts.queued + counts.retrying + counts.sent + counts.failed : counts[t]).toLocaleString('en-IN')}</span> : null}
          </button>
        ))}
      </div>

      <div className="adm-filters">
        <label className="adm-search">
          Recipient
          <input type="search" placeholder="Email address" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          Email type
          <select className="adm-select" value={filters.template ?? ''} onChange={(e) => update({ template: e.target.value || undefined })}>
            <option value="">All types</option>
            {Object.entries(TEMPLATE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" value={filters.from ?? ''} max={filters.to} onChange={(e) => update({ from: e.target.value || undefined })} />
        </label>
        <label>
          To
          <input type="date" value={filters.to ?? ''} min={filters.from} onChange={(e) => update({ to: e.target.value || undefined })} />
        </label>
        {hasFilters ? (
          <div className="adm-filters-actions">
            <button
              type="button"
              className="adm-btn"
              onClick={() => {
                setSearch('');
                update({ template: undefined, q: undefined, from: undefined, to: undefined });
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
        <ErrorState message="The email log could not be loaded." requestId={list.error.requestId} onRetry={list.reload} />
      ) : !list.data ? (
        <Skeleton height={320} />
      ) : list.data.rows.length === 0 ? (
        <EmptyState>
          <p>{hasFilters || filters.state ? 'No emails match these filters.' : 'No emails yet. Sign-ups, password resets and lead alerts will appear here.'}</p>
        </EmptyState>
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className={`adm-table${list.loading ? ' is-loading' : ''}`} aria-busy={list.loading}>
              <thead>
                <tr>
                  <th scope="col">Recipient</th>
                  <th scope="col">Email</th>
                  <th scope="col">Status</th>
                  <th scope="col">Queued</th>
                </tr>
              </thead>
              <tbody>
                {list.data.rows.map((r) => (
                  <tr
                    key={r.id}
                    tabIndex={0}
                    aria-selected={openId === r.id}
                    onClick={() => update({ email: r.id }, { keepPage: true })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') update({ email: r.id }, { keepPage: true });
                    }}
                  >
                    <td data-label="Recipient" className="adm-email-to">
                      {r.to}
                    </td>
                    <td data-label="Email">
                      <strong>{templateLabel(r.template)}</strong>
                      {r.subject ? <span className="adm-sub">{r.subject}</span> : null}
                    </td>
                    <td data-label="Status">
                      <StatusBadge tone={STATE_TONE[r.state]}>{STATE_LABEL[r.state]}</StatusBadge>
                      {r.state === 'failed' || r.state === 'retrying' ? <span className="adm-sub">{r.attempts} attempt{r.attempts === 1 ? '' : 's'}</span> : null}
                    </td>
                    <td data-label="Queued">
                      <time dateTime={r.createdAt} title={formatIst(r.createdAt)}>
                        {ago(r.createdAt)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={list.data.meta.page} pageSize={list.data.meta.pageSize} total={list.data.meta.total} onPage={(page) => update({ page: String(page) })} />
        </>
      )}

      <Drawer open={open !== null} onClose={() => update({ email: undefined }, { keepPage: true })} label="Email details">
        {open ? (
          <EmailDetails
            key={open.id}
            job={open}
            onRetried={(text) => {
              setNotice(text);
              list.reload();
            }}
          />
        ) : null}
      </Drawer>
    </div>
  );
}

function EmailDetails({ job, onRetried }: { job: EmailJob; onRetried: (text: string) => void }) {
  const { can } = useAdminSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const retry = () => {
    setBusy(true);
    setError('');
    adminApi.notifications
      .retry(job.id)
      .then(
        () => onRetried(`Queued again: “${templateLabel(job.template)}” to ${job.to}. It goes out with the next run.`),
        (err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not retry. Please try again.'),
      )
      .finally(() => setBusy(false));
  };

  const facts: [string, ReactNode][] = [
    ['To', job.to],
    ['Type', templateLabel(job.template)],
    ['Subject', job.subject ?? '—'],
    ['Queued', formatIst(job.createdAt)],
    ['Sent', job.sentAt ? formatIst(job.sentAt) : '—'],
    ['Attempts', String(job.attempts)],
  ];
  if (job.nextAttemptAt && job.state === 'retrying') facts.push(['Next try', formatIst(job.nextAttemptAt)]);
  if (job.providerMessageId) facts.push(['Provider message id', <code key="id">{job.providerMessageId}</code>]);

  return (
    <div className="adm-email">
      <header>
        <StatusBadge tone={STATE_TONE[job.state]}>{STATE_LABEL[job.state]}</StatusBadge>
        <h2>{job.subject ?? templateLabel(job.template)}</h2>
      </header>
      <dl className="adm-facts">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {job.lastError ? (
        <section>
          <h3>Last error</h3>
          <pre className="adm-email-error">{job.lastError}</pre>
        </section>
      ) : null}
      <p className="adm-muted adm-small">The email&apos;s content isn&apos;t shown here: verification, reset and invite emails contain private sign-in links.</p>
      {can('notifications.edit') && (job.state === 'failed' || job.state === 'retrying') ? (
        job.retryBlockedReason ? (
          <p className="adm-email-blocked">{job.retryBlockedReason}</p>
        ) : (
          <div>
            <button type="button" className="adm-btn adm-btn-primary" disabled={busy} onClick={retry}>
              {busy ? 'Queuing…' : job.state === 'failed' ? 'Retry sending' : 'Retry now'}
            </button>
          </div>
        )
      ) : null}
      {error ? (
        <p className="adm-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

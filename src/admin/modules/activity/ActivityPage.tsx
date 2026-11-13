import { Link } from 'react-router-dom';
import { ROLE_LABELS } from '../../../../shared/permissions';
import { useAdminSession } from '../../auth/adminSessionContext';
import { Drawer, Pagination } from '../../components/DataTable';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import type { ActivityEntry } from '../../lib/adminApi';
import { ago, formatIst } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import { useTableState } from '../../lib/useTableState';
import { actionLabel, entityLink } from './activityDisplay';
import './Activity.css';

const FILTER_KEYS = ['action', 'actor', 'from', 'to'] as const;
const TABLE_KEYS = [...FILTER_KEYS, 'entry'] as const;

/** /admin/activity — who did what, when. Read-only; entries can't be edited or deleted. */
export function ActivityPage() {
  const { can } = useAdminSession();
  const table = useTableState(TABLE_KEYS);
  const { entry: openId, ...filterValues } = table.values;
  const filters = filterValues as Record<(typeof FILTER_KEYS)[number], string | undefined>;
  const params = { ...filters, page: String(table.page) };
  const list = useResource(JSON.stringify(params), () => adminApi.activity.list(params));
  const facets = useResource('facets', adminApi.activity.facets);
  const { update } = table;

  const modules = [...new Set((facets.data?.actions ?? []).map((a) => a.split('.')[0]))];
  const hasFilters = FILTER_KEYS.some((k) => filters[k]);
  const open = list.data?.rows.find((e) => String(e.id) === openId) ?? null;

  return (
    <div>
      <div className="adm-filters">
        <label>
          What
          <select className="adm-select" value={filters.action ?? ''} onChange={(e) => update({ action: e.target.value || undefined })}>
            <option value="">All activity</option>
            {modules.map((m) => (
              <optgroup key={m} label={m}>
                <option value={`${m}.`}>All {m}</option>
                {facets.data!.actions
                  .filter((a) => a.startsWith(`${m}.`))
                  .map((a) => (
                    <option key={a} value={a}>
                      {actionLabel(a)}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          Who
          <select className="adm-select" value={filters.actor ?? ''} onChange={(e) => update({ actor: e.target.value || undefined })}>
            <option value="">Anyone</option>
            {facets.data?.actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.firstName} · {ROLE_LABELS[a.role]}
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
        <div className="adm-filters-actions">
          {hasFilters ? (
            <button type="button" className="adm-btn" onClick={() => update({ action: undefined, actor: undefined, from: undefined, to: undefined })}>
              Clear filters
            </button>
          ) : null}
          {can('audit.export') ? (
            <a className="adm-btn" href={adminApi.activity.exportUrl(filters)} download>
              Export CSV
            </a>
          ) : null}
        </div>
      </div>

      {list.error && !list.data ? (
        <ErrorState message="The activity log could not be loaded." requestId={list.error.requestId} onRetry={list.reload} />
      ) : !list.data ? (
        <Skeleton height={320} />
      ) : list.data.rows.length === 0 ? (
        <EmptyState>
          <p>{hasFilters ? 'Nothing matches these filters.' : 'No activity recorded yet.'}</p>
        </EmptyState>
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className={`adm-table${list.loading ? ' is-loading' : ''}`} aria-busy={list.loading}>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">What</th>
                  <th scope="col">On</th>
                </tr>
              </thead>
              <tbody>
                {list.data.rows.map((e) => (
                  <tr
                    key={e.id}
                    tabIndex={0}
                    aria-selected={openId === String(e.id)}
                    onClick={() => update({ entry: String(e.id) }, { keepPage: true })}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter') update({ entry: String(e.id) }, { keepPage: true });
                    }}
                  >
                    <td data-label="When">
                      <time dateTime={e.createdAt} title={formatIst(e.createdAt)}>
                        {ago(e.createdAt)}
                      </time>
                    </td>
                    <td data-label="Who">
                      <Actor entry={e} />
                    </td>
                    <td data-label="What">
                      {actionLabel(e.action)}
                      <span className="adm-sub adm-code">{e.action}</span>
                    </td>
                    <td data-label="On">{e.entityType ? `${e.entityType}` : <span className="adm-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={list.data.meta.page} pageSize={list.data.meta.pageSize} total={list.data.meta.total} onPage={(page) => update({ page: String(page) })} />
        </>
      )}

      <Drawer open={open !== null} onClose={() => update({ entry: undefined }, { keepPage: true })} label="Activity entry">
        {open ? <EntryDetails entry={open} /> : null}
      </Drawer>
    </div>
  );
}

function Actor({ entry }: { entry: ActivityEntry }) {
  if (!entry.actor) return <span className="adm-muted">System / visitor</span>;
  return (
    <>
      {entry.actor.firstName ?? 'Deleted user'}
      {entry.actorRole ? <span className="adm-sub">{ROLE_LABELS[entry.actorRole]}</span> : null}
    </>
  );
}

function EntryDetails({ entry }: { entry: ActivityEntry }) {
  const link = entityLink(entry);
  return (
    <div className="adm-entry">
      <h2>{actionLabel(entry.action)}</h2>
      <p className="adm-muted">{formatIst(entry.createdAt)}</p>
      <dl className="adm-entry-facts">
        <div>
          <dt>Who</dt>
          <dd>
            {entry.actor ? `${entry.actor.firstName ?? 'Deleted user'}${entry.actor.email ? ` (${entry.actor.email})` : ''}` : 'System / visitor'}
            {entry.actorRole ? ` · ${ROLE_LABELS[entry.actorRole]}` : ''}
          </dd>
        </div>
        <div>
          <dt>Action</dt>
          <dd className="adm-code">{entry.action}</dd>
        </div>
        {entry.entityType ? (
          <div>
            <dt>On</dt>
            <dd>
              {entry.entityType} <span className="adm-code">{entry.entityId}</span>
              {link ? (
                <>
                  {' '}
                  · <Link to={link}>Open</Link>
                </>
              ) : null}
            </dd>
          </div>
        ) : null}
        {entry.requestId ? (
          <div>
            <dt>Request reference</dt>
            <dd className="adm-code">{entry.requestId}</dd>
          </div>
        ) : null}
      </dl>
      <h3>Details</h3>
      {entry.metadata ? <pre className="adm-json">{JSON.stringify(entry.metadata, null, 2)}</pre> : <p className="adm-muted">No extra details.</p>}
    </div>
  );
}

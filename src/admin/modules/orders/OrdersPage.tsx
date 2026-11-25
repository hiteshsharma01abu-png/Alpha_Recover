import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminSession } from '../../auth/adminSessionContext';
import { Pagination, StatusBadge } from '../../components/DataTable';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import type { OrderRow } from '../../lib/adminApi';
import { formatDate, formatInr, formatIst } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import { useTableState } from '../../lib/useTableState';
import { methodLabel, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, ORDER_TABS, TAB_LABEL } from './orderDisplay';
import '../enrollments/Enrollments.css';
import './Orders.css';

const FILTER_KEYS = ['status', 'planId', 'from', 'to', 'q'] as const;

const studentName = (r: OrderRow) => [r.student.firstName, r.student.lastName].filter(Boolean).join(' ');

/** /admin/orders — purchases (paid and refunded) by default; unpaid and failed attempts on their tabs. */
export function OrdersPage() {
  const { can } = useAdminSession();
  const table = useTableState(FILTER_KEYS);
  const filters = table.values;
  const params = { ...filters, page: String(table.page) };
  const list = useResource(JSON.stringify(params), () => adminApi.orders.list(params));
  const plans = useResource('order-plans', adminApi.orders.plans);

  const [search, setSearch] = useState(filters.q ?? '');
  const { update } = table;
  useEffect(() => {
    if ((filters.q ?? '') === search.trim()) return;
    const t = window.setTimeout(() => update({ q: search.trim() || undefined }, { replace: true }), 300);
    return () => window.clearTimeout(t);
  }, [search, filters.q, update]);

  const activeTab = filters.status ?? 'purchases';
  const counts = list.data?.meta.counts;
  const tabCount = (t: (typeof ORDER_TABS)[number]) => {
    if (!counts) return null;
    if (t === 'purchases') return counts.paid + counts.refunded + counts.partially_refunded;
    if (t === 'all') return Object.values(counts).reduce((n, c) => n + c, 0);
    if (t === 'refunded') return counts.refunded + counts.partially_refunded;
    return counts[t];
  };
  const hasFilters = FILTER_KEYS.some((k) => k !== 'status' && filters[k]);

  return (
    <div>
      <div className="adm-enr-bar">
        <div className="adm-tabs" role="tablist" aria-label="Order status">
          {ORDER_TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={activeTab === t} onClick={() => update({ status: t === 'purchases' ? undefined : t })}>
              {TAB_LABEL[t]}
              {counts ? <span className="adm-count">{(tabCount(t) ?? 0).toLocaleString('en-IN')}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="adm-filters">
        <label className="adm-search">
          Search
          <input type="search" placeholder="Order number, name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
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
          From
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
                update({ planId: undefined, from: undefined, to: undefined, q: undefined });
              }}
            >
              Clear filters
            </button>
          ) : null}
          {can('orders.export') ? (
            <a className="adm-btn" href={adminApi.orders.exportUrl(filters)} download>
              Export CSV
            </a>
          ) : null}
        </div>
      </div>

      {list.error && !list.data ? (
        <ErrorState message="Orders could not be loaded." requestId={list.error.requestId} onRetry={list.reload} />
      ) : !list.data ? (
        <Skeleton height={320} />
      ) : list.data.rows.length === 0 ? (
        <EmptyState>
          <p>{hasFilters || filters.status ? 'No orders match these filters.' : 'No purchases yet. Paid orders from the website appear here.'}</p>
        </EmptyState>
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className={`adm-table${list.loading ? ' is-loading' : ''}`} aria-busy={list.loading}>
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Student</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">Date</th>
                </tr>
              </thead>
              <tbody className="adm-static-rows">
                {list.data.rows.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Order">
                      <Link className="adm-ord-number" to={`/admin/orders/${r.id}`}>
                        {r.orderNumber}
                      </Link>
                      <span className="adm-sub">{methodLabel(r.method)}</span>
                    </td>
                    <td data-label="Student">
                      <Link className="adm-enr-student" to={`/admin/students/${r.student.id}`}>
                        {studentName(r)}
                      </Link>
                      <span className="adm-sub">{r.student.email}</span>
                    </td>
                    <td data-label="Plan">{r.plan}</td>
                    <td data-label="Amount">
                      <span className="adm-ord-amount">{formatInr(r.amountPaise)}</span>
                    </td>
                    <td data-label="Status">
                      <StatusBadge tone={ORDER_STATUS_TONE[r.status]}>{ORDER_STATUS_LABEL[r.status]}</StatusBadge>
                    </td>
                    <td data-label="Date">
                      <time title={formatIst(r.paidAt ?? r.createdAt)}>{formatDate(r.paidAt ?? r.createdAt)}</time>
                      <span className="adm-sub">{r.paidAt ? 'paid' : 'started'}</span>
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

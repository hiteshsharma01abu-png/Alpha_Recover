import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../../../lib/api';
import { useAdminSession } from '../../auth/adminSessionContext';
import { StatusBadge } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import type { OrderDetail } from '../../lib/adminApi';
import { countryName, formatDate, formatInr, formatIst } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import { STATUS_LABEL, STATUS_TONE } from '../enrollments/enrollmentDisplay';
import { methodLabel, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, RECONCILE_MESSAGE } from './orderDisplay';
import '../students/Students.css';
import './Orders.css';

const message = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

const ACTION_LABEL: Record<string, string> = {
  'order.paid': 'Payment confirmed',
  'order.refund': 'Refunded',
  'order.reconcile': 'Re-checked with Razorpay',
  'order.verify_failed': 'Payment confirmation rejected (bad signature)',
};
const VIA_LABEL: Record<string, string> = { checkout: 'at checkout', webhook: 'by Razorpay notification', reconcile: 'by re-check', admin: 'from the admin panel' };

/** /admin/orders/:id — one order: payment, the access it granted, refund and re-check. */
export function OrderDetailPage() {
  const { id = '' } = useParams();
  const order = useResource(id, () => adminApi.orders.get(id));

  if (order.error && !order.data) {
    return (
      <div className="adm-student">
        <Link className="adm-back" to="/admin/orders">
          ← All orders
        </Link>
        {order.error.status === 404 ? (
          <EmptyState>
            <p>This order doesn&apos;t exist.</p>
          </EmptyState>
        ) : (
          <ErrorState message="The order could not be loaded." requestId={order.error.requestId} onRetry={order.reload} />
        )}
      </div>
    );
  }
  if (!order.data || order.data.id !== id) return <Skeleton height={420} />;
  return <OrderView key={order.data.id} o={order.data} reload={order.reload} />;
}

function OrderView({ o, reload }: { o: OrderDetail; reload: () => void }) {
  const { can, me } = useAdminSession();
  const [refunding, setRefunding] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const studentName = [o.student.firstName, o.student.lastName].filter(Boolean).join(' ');
  const canRefundRole = can('orders.refund');
  const canRecheck = can('orders.refund') && o.providerOrderId && ['created', 'failed', 'cancelled'].includes(o.status);
  const isSuperAdmin = me?.role === 'super_admin';

  const refund = () => {
    if (reason.trim().length < 3) return setError('Give a short reason (at least 3 characters).');
    setBusy(true);
    setError('');
    adminApi.orders
      .refund(o.id, reason.trim())
      .then((r) => {
        setRefunding(false);
        setReason('');
        setNotice(`Refunded ${formatInr(r.amountPaise)} (Razorpay ${r.refundId}, ${r.refundStatus}).${r.accessRevoked ? ' Course access has ended and the student has been emailed.' : ''}`);
        reload();
      })
      .catch((err: unknown) => setError(message(err, 'The refund could not be made.')))
      .finally(() => setBusy(false));
  };

  const recheck = () => {
    setBusy(true);
    setNotice('');
    adminApi.orders
      .reconcile(o.id)
      .then((r) => {
        setNotice(RECONCILE_MESSAGE[r.result]);
        reload();
      })
      .catch((err: unknown) => setNotice(message(err, 'Razorpay could not be reached. Try again in a minute.')))
      .finally(() => setBusy(false));
  };

  const windowText = o.refund.windowEndsAt
    ? o.refund.insideWindow
      ? `Inside the refund window (until ${formatIst(o.refund.windowEndsAt)}).`
      : `Outside the refund window (ended ${formatIst(o.refund.windowEndsAt)}). Only a Super Admin can refund.`
    : null;

  return (
    <div className="adm-student">
      <Link className="adm-back" to="/admin/orders">
        ← All orders
      </Link>

      <header className="adm-student-head">
        <div>
          <h2>{o.orderNumber}</h2>
          <p>
            {o.plan.name} · <Link to={`/admin/students/${o.student.id}`}>{studentName}</Link> · started {formatIst(o.createdAt)}
          </p>
          <span className="adm-badges">
            <StatusBadge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</StatusBadge>
            <span className="adm-ord-head-amount">{formatInr(o.amountPaise)}</span>
          </span>
        </div>
        {canRefundRole || canRecheck ? (
          <div className="adm-student-actions">
            {canRecheck ? (
              <button type="button" className="adm-btn" disabled={busy} onClick={recheck}>
                {busy ? 'Checking…' : 'Re-check with Razorpay'}
              </button>
            ) : null}
            {canRefundRole && o.status === 'paid' ? (
              <button
                type="button"
                className="adm-btn adm-btn-danger-outline"
                disabled={!o.refund.allowed}
                title={o.refund.allowed ? undefined : (o.refund.reason ?? undefined)}
                onClick={() => {
                  setError('');
                  setRefunding(true);
                }}
              >
                Refund {formatInr(o.amountPaise)}
              </button>
            ) : null}
            {canRefundRole && o.status === 'paid' && !o.refund.allowed && o.refund.reason ? <p className="adm-ord-refund-note">{o.refund.reason}</p> : null}
          </div>
        ) : null}
      </header>

      {notice ? (
        <p className="adm-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="adm-student-grid">
        <section className="adm-panel">
          <h3>Payment</h3>
          <dl className="adm-facts">
            <div>
              <dt>Amount</dt>
              <dd>{formatInr(o.amountPaise)}</dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>{o.paidAt ? formatIst(o.paidAt) : '—'}</dd>
            </div>
            <div>
              <dt>Method</dt>
              <dd>{methodLabel(o.payments.find((p) => p.status !== 'failed')?.method ?? o.payments[0]?.method ?? null)}</dd>
            </div>
            <div>
              <dt>Razorpay order</dt>
              <dd>{o.providerOrderId ? <code>{o.providerOrderId}</code> : '—'}</dd>
            </div>
          </dl>
          {o.status === 'paid' && windowText ? <p className="adm-ord-refund-note">{windowText}</p> : null}
        </section>

        <section className="adm-panel">
          <h3>Billing</h3>
          <dl className="adm-facts">
            <div>
              <dt>Name</dt>
              <dd>{o.billing.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${o.billing.email}`}>{o.billing.email}</a>
              </dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{o.billing.phone ? <a href={`tel:${o.billing.phone}`}>{o.billing.phone}</a> : '—'}</dd>
            </div>
            <div>
              <dt>Country</dt>
              <dd>{countryName(o.billing.country)}</dd>
            </div>
            <div>
              <dt>GSTIN</dt>
              <dd>{o.billing.gstin ?? '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="adm-panel adm-panel-wide">
          <h3>Payment attempts</h3>
          {o.payments.length ? (
            <ul className="adm-list">
              {o.payments.map((p) => (
                <li key={p.id}>
                  <span className="adm-list-row">
                    <strong>{formatInr(p.amountPaise)}</strong>
                    <StatusBadge tone={p.status === 'captured' ? 'success' : p.status === 'failed' ? 'danger' : p.status === 'authorized' ? 'warning' : 'muted'}>
                      {p.status === 'captured' ? 'Captured' : p.status === 'failed' ? 'Failed' : p.status === 'authorized' ? 'Authorised' : p.status === 'refunded' ? 'Refunded' : 'Part refunded'}
                    </StatusBadge>
                  </span>
                  <span className="adm-sub">
                    {methodLabel(p.method)} · <code>{p.providerPaymentId}</code> · {formatIst(p.createdAt)}
                    {p.refundedAt ? ` · refunded ${formatInr(p.refundedPaise)} on ${formatIst(p.refundedAt)}` : ''}
                    {p.errorDescription ? ` · ${p.errorDescription}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-muted">No payment attempts yet.</p>
          )}
        </section>

        <section className="adm-panel">
          <h3>Course access from this order</h3>
          {o.enrollment ? (
            <>
              <span className="adm-list-row">
                <strong>{o.plan.name}</strong>
                <StatusBadge tone={STATUS_TONE[o.enrollment.status]}>{STATUS_LABEL[o.enrollment.status]}</StatusBadge>
              </span>
              <p className="adm-sub">
                From {formatDate(o.enrollment.startsAt)} · {o.enrollment.expiresAt ? `until ${formatDate(o.enrollment.expiresAt)}` : 'lifetime access'}
                {o.enrollment.revokedReason ? ` · ended: ${o.enrollment.revokedReason}` : ''}
              </p>
            </>
          ) : (
            <p className="adm-muted">{o.status === 'paid' ? 'No access recorded. Use Re-check, or grant it from Enrollments.' : 'Granted once the order is paid.'}</p>
          )}
        </section>

        <section className="adm-panel">
          <h3>History</h3>
          {o.activity.length || o.webhookEvents.length ? (
            <ul className="adm-ord-timeline">
              {[
                ...o.activity.map((a) => ({
                  key: a.id,
                  at: a.createdAt,
                  text: `${ACTION_LABEL[a.action] ?? a.action}${typeof a.metadata?.via === 'string' ? ` ${VIA_LABEL[a.metadata.via] ?? ''}` : ''}${a.actorName ? ` · ${a.actorName}` : ''}${typeof a.metadata?.reason === 'string' ? ` · “${a.metadata.reason}”` : ''}`,
                })),
                ...o.webhookEvents.map((e) => ({ key: e.id, at: e.createdAt, text: `Razorpay notification: ${e.eventType} (${e.status}${e.error ? `: ${e.error}` : ''})` })),
              ]
                .sort((a, b) => b.at.localeCompare(a.at))
                .map((x) => (
                  <li key={x.key}>
                    <span>{x.text}</span>
                    <span className="adm-sub">{formatIst(x.at)}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="adm-muted">Nothing recorded yet.</p>
          )}
        </section>
      </div>

      <Dialog open={refunding} title={`Refund ${o.orderNumber}?`} confirmLabel={`Refund ${formatInr(o.amountPaise)}`} tone="danger" busy={busy} error={error} onConfirm={refund} onCancel={() => setRefunding(false)}>
        {windowText ? <p className={`adm-ord-window${o.refund.insideWindow ? ' is-inside' : ''}`}>{windowText}{!o.refund.insideWindow && isSuperAdmin ? ' You can refund as an exception.' : ''}</p> : null}
        <p>
          {formatInr(o.amountPaise)} goes back to {studentName}&apos;s original payment method through Razorpay (banks take 5–7 working days). Their {o.plan.name} access ends now, and they get an email. This
          can&apos;t be undone.
        </p>
        <label>
          Reason (kept in the activity log)
          <textarea rows={3} required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Asked within 3 days; duplicate payment" />
        </label>
      </Dialog>
    </div>
  );
}

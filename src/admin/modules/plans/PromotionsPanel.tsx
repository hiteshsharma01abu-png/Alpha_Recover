import { useState } from 'react';
import { ApiError } from '../../../lib/api';
import { useAdminSession } from '../../auth/adminSessionContext';
import { StatusBadge } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { adminApi } from '../../lib/adminApi';
import type { PlanDetail, Promotion } from '../../lib/adminApi';
import { formatInr, formatIst } from '../../lib/format';
import { PROMO_LABEL, PROMO_TONE, paiseToRupees, rupeesToPaise, toIstInput } from './planDisplay';

type Pending = { kind: 'edit'; promo: Promotion | null } | { kind: 'pause' | 'resume' | 'delete'; promo: Promotion } | null;

const errText = (err: unknown) => (err instanceof ApiError ? err.message : 'That didn’t work. Please try again.');

/** Sale windows for one plan. The running sale drives the price and the countdown on the website. */
export function PromotionsPanel({ plan, onChanged }: { plan: PlanDetail; onChanged: (notice: string) => void }) {
  const { can } = useAdminSession();
  const canEdit = can('plans.edit');
  const canDelete = can('plans.delete');
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    setPending(null);
    setError('');
  };
  const run = (task: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError('');
    task()
      .then(
        () => {
          close();
          onChanged(done);
        },
        (err: unknown) => setError(errText(err)),
      )
      .finally(() => setBusy(false));
  };

  return (
    <section className="adm-panel adm-panel-wide">
      <div className="adm-panel-head">
        <h3>Sales &amp; offers</h3>
        {canEdit ? (
          <button type="button" className="adm-btn" onClick={() => setPending({ kind: 'edit', promo: null })}>
            + New sale
          </button>
        ) : null}
      </div>
      {plan.promotions.length ? (
        <ul className="adm-list">
          {plan.promotions.map((p) => {
            const off = Math.round(((plan.pricePaise - p.salePricePaise) / plan.pricePaise) * 100);
            return (
              <li key={p.id}>
                <span className="adm-list-row">
                  <strong>{p.label}</strong>
                  <StatusBadge tone={PROMO_TONE[p.state]}>{PROMO_LABEL[p.state]}</StatusBadge>
                  {p.state !== 'ended' && (canEdit || canDelete) ? (
                    <span className="adm-list-actions">
                      {canEdit ? (
                        <>
                          <button type="button" className="adm-btn" onClick={() => setPending({ kind: 'edit', promo: p })}>
                            Edit
                          </button>
                          <button type="button" className="adm-btn" onClick={() => setPending({ kind: p.isActive ? 'pause' : 'resume', promo: p })}>
                            {p.isActive ? 'Pause' : 'Resume'}
                          </button>
                        </>
                      ) : null}
                      {canDelete ? (
                        <button type="button" className="adm-btn adm-btn-danger-outline" onClick={() => setPending({ kind: 'delete', promo: p })}>
                          Delete
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                </span>
                <span className="adm-sub">
                  {formatInr(p.salePricePaise)} ({off > 0 ? `${off}% off ${formatInr(plan.pricePaise)}` : 'not below the current price'}) · {formatIst(p.startsAt)} → {formatIst(p.endsAt)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="adm-muted">No sales yet. While a sale runs, the website shows its price, the struck-out regular price and a countdown to the end.</p>
      )}

      {pending?.kind === 'edit' ? <PromotionDialog plan={plan} promo={pending.promo} onClose={close} onDone={(t) => { close(); onChanged(t); }} /> : null}
      <Dialog
        open={pending?.kind === 'pause' || pending?.kind === 'resume'}
        title={`${pending?.kind === 'pause' ? 'Pause' : 'Resume'} ${pending?.promo?.label ?? ''}?`}
        confirmLabel={pending?.kind === 'pause' ? 'Pause sale' : 'Resume sale'}
        busy={busy}
        error={error}
        onCancel={close}
        onConfirm={() => {
          if (pending?.kind !== 'pause' && pending?.kind !== 'resume') return;
          const resume = pending.kind === 'resume';
          run(() => adminApi.plans.updatePromotion(pending.promo.id, { isActive: resume }), resume ? 'Sale resumed.' : 'Sale paused. The website shows the regular price.');
        }}
      >
        <p>
          {pending?.kind === 'pause'
            ? 'The website goes back to the regular price straight away. You can resume before the end date.'
            : 'The sale price applies again during its window (if no other sale overlaps).'}
        </p>
      </Dialog>
      <Dialog
        open={pending?.kind === 'delete'}
        title={`Delete ${pending?.promo?.label ?? ''}?`}
        confirmLabel="Delete sale"
        tone="danger"
        busy={busy}
        error={error}
        onCancel={close}
        onConfirm={() => pending?.kind === 'delete' && run(() => adminApi.plans.removePromotion(pending.promo.id), 'Sale deleted.')}
      >
        <p>It disappears from this list and stops applying. The activity log keeps a record.</p>
      </Dialog>
    </section>
  );
}

function PromotionDialog({ plan, promo, onClose, onDone }: { plan: PlanDetail; promo: Promotion | null; onClose: () => void; onDone: (text: string) => void }) {
  const [label, setLabel] = useState(promo?.label ?? '');
  const [price, setPrice] = useState(paiseToRupees(promo?.salePricePaise ?? null));
  const [startsAt, setStartsAt] = useState(promo ? toIstInput(promo.startsAt) : toIstInput(new Date().toISOString()));
  const [endsAt, setEndsAt] = useState(promo ? toIstInput(promo.endsAt) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const salePaise = rupeesToPaise(price);
  const off = salePaise !== null && salePaise < plan.pricePaise ? Math.round(((plan.pricePaise - salePaise) / plan.pricePaise) * 100) : null;

  const confirm = () => {
    if (salePaise === null) return setError('Enter the sale price in rupees, e.g. 3999.');
    if (!endsAt) return setError('Choose when the sale ends.');
    const body = { label, salePricePaise: salePaise, startsAt, endsAt };
    setBusy(true);
    setError('');
    (promo ? adminApi.plans.updatePromotion(promo.id, body) : adminApi.plans.addPromotion(plan.id, body))
      .then(
        () => onDone(promo ? 'Sale updated.' : 'Sale created.'),
        (err: unknown) => setError(errText(err)),
      )
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open title={promo ? 'Edit sale' : 'New sale'} confirmLabel={promo ? 'Save sale' : 'Create sale'} busy={busy} error={error} onConfirm={confirm} onCancel={onClose}>
      <label>
        Label (shown on the website)
        <input required minLength={2} maxLength={120} placeholder="e.g. Diwali Sale" value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <label>
        Sale price (₹) · regular {formatInr(plan.pricePaise)}
        <input inputMode="decimal" required value={price} onChange={(e) => setPrice(e.target.value)} />
        {off !== null ? <span className="adm-muted adm-small">{off}% off</span> : null}
      </label>
      <label>
        Starts (IST)
        <input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
      </label>
      <label>
        Ends (IST) · the countdown runs to this time
        <input type="datetime-local" required min={startsAt} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
      </label>
    </Dialog>
  );
}

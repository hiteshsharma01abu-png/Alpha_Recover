import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../../lib/api';
import { useAdminSession } from '../../auth/adminSessionContext';
import { StatusBadge } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import type { PlanDetail, PlanInput } from '../../lib/adminApi';
import { formatInr, formatIst } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import { PUBLISH_LABEL, PUBLISH_STATUSES, PUBLISH_TONE, paiseToRupees, rupeesToPaise } from './planDisplay';
import { PromotionsPanel } from './PromotionsPanel';
import './Plans.css';

type Feature = { key: number; text: string; mobile: boolean };

const EMPTY: PlanInput = {
  name: '',
  description: null,
  pricePaise: 0,
  compareAtPaise: null,
  features: [''],
  mobileFeatureOrder: null,
  grantsAllCourses: true,
  courseIds: [],
  accessDays: null,
  status: 'draft',
  sortOrder: 0,
};

/** /admin/plans/new and /admin/plans/:id — one form for both. */
export function PlanEditorPage() {
  const { id } = useParams();
  const plan = useResource(id ?? null, () => adminApi.plans.get(id!));

  if (!id) return <PlanForm key="new" plan={null} reload={() => undefined} />;
  if (plan.error && !plan.data) {
    return (
      <div>
        <Link className="adm-back" to="/admin/plans">
          ← All plans
        </Link>
        {plan.error.status === 404 ? (
          <EmptyState>
            <p>This plan doesn&apos;t exist or was deleted.</p>
          </EmptyState>
        ) : (
          <ErrorState message="The plan could not be loaded." requestId={plan.error.requestId} onRetry={plan.reload} />
        )}
      </div>
    );
  }
  if (!plan.data || plan.data.id !== id) return <Skeleton height={420} />;
  // Remount after each save so the form starts from the saved values.
  return <PlanForm key={`${plan.data.id}:${plan.data.updatedAt}`} plan={plan.data} reload={plan.reload} />;
}

let featureKey = 0;
const toFeatures = (p: PlanInput): Feature[] =>
  p.features.map((text, i) => ({ key: ++featureKey, text, mobile: p.mobileFeatureOrder === null || p.mobileFeatureOrder.includes(i) }));

function PlanForm({ plan, reload }: { plan: PlanDetail | null; reload: () => void }) {
  const { can } = useAdminSession();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = plan === null;
  const readOnly = isNew ? !can('plans.add') : !can('plans.edit');
  const initial = plan ?? EMPTY;
  const courses = useResource('plan-courses', adminApi.plans.courses);

  const [slug, setSlug] = useState('');
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? '');
  const [status, setStatus] = useState(initial.status);
  const [sortOrder, setSortOrder] = useState(String(initial.sortOrder));
  const [price, setPrice] = useState(paiseToRupees(isNew ? null : initial.pricePaise));
  const [compareAt, setCompareAt] = useState(paiseToRupees(initial.compareAtPaise));
  const [lifetime, setLifetime] = useState(initial.accessDays === null);
  const [days, setDays] = useState(initial.accessDays ? String(initial.accessDays) : '365');
  const [allCourses, setAllCourses] = useState(initial.grantsAllCourses);
  const [courseIds, setCourseIds] = useState<string[]>(initial.courseIds);
  const [features, setFeatures] = useState<Feature[]>(() => toFeatures(initial));
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState((location.state as { notice?: string } | null)?.notice ?? '');
  const [deleting, setDeleting] = useState(false);

  const moveFeature = (i: number, by: -1 | 1) =>
    setFeatures((list) => {
      const next = [...list];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });

  /** The form as API fields, or null (with errors shown) when a value can't be parsed. */
  function collect(): PlanInput | null {
    const local: Record<string, string> = {};
    const pricePaise = rupeesToPaise(price);
    if (pricePaise === null) local.pricePaise = 'Enter the price in rupees, e.g. 5999';
    const compareAtPaise = compareAt.trim() ? rupeesToPaise(compareAt) : null;
    if (compareAt.trim() && compareAtPaise === null) local.compareAtPaise = 'Enter an amount in rupees, or leave it empty';
    const accessDays = lifetime ? null : Number(days);
    if (!lifetime && !(Number.isInteger(accessDays) && accessDays! >= 1)) local.accessDays = 'Enter a number of days';
    const kept = features.filter((f) => f.text.trim());
    if (!kept.length) local.features = 'Add at least one feature';
    setErrors(local);
    if (Object.keys(local).length) return null;
    const mobile = kept.flatMap((f, i) => (f.mobile ? [i] : []));
    return {
      name,
      description: description.trim() || null,
      pricePaise: pricePaise!,
      compareAtPaise,
      features: kept.map((f) => f.text.trim()),
      mobileFeatureOrder: mobile.length === kept.length ? null : mobile,
      grantsAllCourses: allCourses,
      courseIds: allCourses ? [] : courseIds,
      accessDays,
      status,
      sortOrder: Number(sortOrder) || 0,
    };
  }

  const fail = (err: unknown) => {
    if (err instanceof ApiError && err.details.length) setErrors(Object.fromEntries(err.details.map((d) => [d.path.split('.')[0], d.message])));
    setError(err instanceof ApiError ? err.message : 'The plan could not be saved.');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    const values = collect();
    if (!values) return;
    setBusy(true);
    if (isNew) {
      adminApi.plans
        .create({ ...values, slug })
        .then((r) => navigate(`/admin/plans/${r.id}`, { replace: true, state: { notice: 'Plan created. Add a sale below if you want one.' } }), fail)
        .finally(() => setBusy(false));
      return;
    }
    // Send only what changed, so untouched fields (like a custom phone order) are never rewritten.
    const before: PlanInput = { ...plan, mobileFeatureOrder: plan.mobileFeatureOrder, courseIds: plan.grantsAllCourses ? [] : plan.courseIds };
    const diff = Object.fromEntries(Object.entries(values).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k as keyof PlanInput])));
    if (!Object.keys(diff).length) {
      setBusy(false);
      setNotice('Nothing changed.');
      return;
    }
    adminApi.plans
      .update(plan.id, diff)
      .then(() => {
        navigate('.', { replace: true, state: { notice: 'Plan saved. The website updates within a minute.' } });
        reload();
      }, fail)
      .finally(() => setBusy(false));
  };

  const field = (key: string, label: ReactNode, input: ReactNode, hint?: string) => (
    <label>
      {label}
      {input}
      {errors[key] ? <span className="adm-field-error">{errors[key]}</span> : hint ? <span className="adm-muted adm-small">{hint}</span> : null}
    </label>
  );

  return (
    <div className="adm-plan">
      <Link className="adm-back" to="/admin/plans">
        ← All plans
      </Link>
      <header className="adm-plan-head">
        <div>
          <h2>{isNew ? 'New plan' : plan.name}</h2>
          {plan ? (
            <p>
              <StatusBadge tone={PUBLISH_TONE[plan.status]}>{PUBLISH_LABEL[plan.status]}</StatusBadge> /{plan.slug} · {plan.enrollments.toLocaleString('en-IN')} enrollment{plan.enrollments === 1 ? '' : 's'}
            </p>
          ) : null}
        </div>
        {plan ? (
          <div className="adm-plan-price">
            <span className="adm-muted adm-small">Website price now</span>
            <strong>{formatInr(plan.price.effectivePricePaise)}</strong>
            {plan.price.comparePricePaise ? (
              <span className="adm-small">
                <s>{formatInr(plan.price.comparePricePaise)}</s> · {plan.price.discountPct}% off
              </span>
            ) : null}
            {plan.price.promotion ? <span className="adm-small">{plan.price.promotion.label} until {formatIst(plan.price.promotion.endsAt)}</span> : null}
          </div>
        ) : null}
      </header>

      {notice ? (
        <p className="adm-notice" role="status">
          {notice}
        </p>
      ) : null}
      {readOnly ? <p className="adm-muted">You can view this plan. Changing plans needs the Finance Manager or Admin role.</p> : null}

      <form onSubmit={submit} className="adm-plan-form">
        <fieldset disabled={readOnly || busy}>
          <div className="adm-student-grid">
            <section className="adm-panel">
              <h3>Basics</h3>
              <div className="adm-plan-fields">
                {field('name', 'Name', <input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />)}
                {isNew
                  ? field(
                      'slug',
                      'Slug (web address)',
                      <input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={64} placeholder="e.g. weekend-batch" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />,
                      "Lowercase letters, numbers and dashes. It can't be changed later.",
                    )
                  : null}
                {field('description', 'Description (optional)', <textarea rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />)}
                <div className="adm-plan-row">
                  {field(
                    'status',
                    'Status',
                    <select className="adm-select" value={status} onChange={(e) => setStatus(e.target.value as PlanInput['status'])}>
                      {PUBLISH_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {PUBLISH_LABEL[s]}
                        </option>
                      ))}
                    </select>,
                    status === 'published' ? 'Shown on the website' : 'Hidden from the website',
                  )}
                  {field('sortOrder', 'Order', <input type="number" min={0} max={1000} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />, 'Lower shows first')}
                </div>
              </div>
            </section>

            <section className="adm-panel">
              <h3>Price &amp; access</h3>
              <div className="adm-plan-fields">
                <div className="adm-plan-row">
                  {field('pricePaise', 'Regular price (₹)', <input inputMode="decimal" required value={price} onChange={(e) => setPrice(e.target.value)} />)}
                  {field('compareAtPaise', '"Was" price (₹, optional)', <input inputMode="decimal" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} />, 'Struck out when no sale runs')}
                </div>
                <div className="adm-plan-row">
                  <label className="adm-plan-check">
                    <input type="checkbox" checked={lifetime} onChange={(e) => setLifetime(e.target.checked)} />
                    Lifetime access
                  </label>
                  {lifetime ? null : field('accessDays', 'Access (days)', <input type="number" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} />)}
                </div>
                <div>
                  <label className="adm-plan-check">
                    <input type="checkbox" checked={allCourses} onChange={(e) => setAllCourses(e.target.checked)} />
                    Unlocks all courses (including future ones)
                  </label>
                  {allCourses ? null : (
                    <div className="adm-plan-courses">
                      {courses.data?.map((c) => (
                        <label key={c.id} className="adm-plan-check">
                          <input
                            type="checkbox"
                            checked={courseIds.includes(c.id)}
                            onChange={(e) => setCourseIds((ids) => (e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id)))}
                          />
                          {c.title}
                          {c.status === 'published' ? '' : ` (${c.status})`}
                        </label>
                      ))}
                      {errors.courseIds ? <span className="adm-field-error">{errors.courseIds}</span> : null}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="adm-panel adm-panel-wide">
              <div className="adm-panel-head">
                <h3>Features</h3>
                <span className="adm-muted adm-small">Tick “Phone” for the shorter list shown on small screens</span>
              </div>
              <ol className="adm-plan-features">
                {features.map((f, i) => (
                  <li key={f.key}>
                    <input
                      aria-label={`Feature ${i + 1}`}
                      maxLength={200}
                      value={f.text}
                      onChange={(e) => setFeatures((list) => list.map((x) => (x.key === f.key ? { ...x, text: e.target.value } : x)))}
                    />
                    <label className="adm-plan-check">
                      <input type="checkbox" checked={f.mobile} onChange={(e) => setFeatures((list) => list.map((x) => (x.key === f.key ? { ...x, mobile: e.target.checked } : x)))} />
                      Phone
                    </label>
                    {readOnly ? null : (
                      <span className="adm-plan-feature-actions">
                        <button type="button" className="adm-btn adm-btn-icon" aria-label="Move up" disabled={i === 0} onClick={() => moveFeature(i, -1)}>
                          ↑
                        </button>
                        <button type="button" className="adm-btn adm-btn-icon" aria-label="Move down" disabled={i === features.length - 1} onClick={() => moveFeature(i, 1)}>
                          ↓
                        </button>
                        <button type="button" className="adm-btn adm-btn-icon" aria-label="Remove" onClick={() => setFeatures((list) => list.filter((x) => x.key !== f.key))}>
                          ✕
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              {errors.features || errors.mobileFeatureOrder ? <span className="adm-field-error">{errors.features ?? errors.mobileFeatureOrder}</span> : null}
              {readOnly ? null : (
                <button type="button" className="adm-btn" disabled={features.length >= 30} onClick={() => setFeatures((list) => [...list, { key: ++featureKey, text: '', mobile: true }])}>
                  + Add feature
                </button>
              )}
            </section>
          </div>

          {error ? (
            <p className="adm-error" role="alert">
              {error}
            </p>
          ) : null}
          {readOnly ? null : (
            <div className="adm-plan-save">
              <button type="submit" className="adm-btn adm-btn-primary" disabled={busy}>
                {busy ? 'Saving…' : isNew ? 'Create plan' : 'Save changes'}
              </button>
            </div>
          )}
        </fieldset>
      </form>

      {plan ? (
        <>
          <div className="adm-student-grid adm-plan-after">
            <PromotionsPanel
              plan={plan}
              onChanged={(text) => {
                setNotice(text);
                reload();
              }}
            />
          </div>
          {can('plans.delete') && plan.enrollments === 0 ? (
            <div className="adm-plan-danger">
              <button type="button" className="adm-btn adm-btn-danger-outline" onClick={() => setDeleting(true)}>
                Delete plan
              </button>
            </div>
          ) : null}
          <Dialog
            open={deleting}
            title={`Delete ${plan.name}?`}
            confirmLabel="Delete plan"
            tone="danger"
            busy={busy}
            error={error}
            onCancel={() => setDeleting(false)}
            onConfirm={() => {
              setBusy(true);
              adminApi.plans
                .remove(plan.id)
                .then(() => navigate('/admin/plans', { replace: true }), fail)
                .finally(() => setBusy(false));
            }}
          >
            <p>Nobody is enrolled in it, so it can be removed. Its slug stays reserved.</p>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}

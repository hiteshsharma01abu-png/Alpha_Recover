import { useEffect, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { Dialog } from '../../components/Dialog';
import { adminApi } from '../../lib/adminApi';
import type { StudentRow } from '../../lib/adminApi';
import { formatDate } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import { istDay, todayIst } from './enrollmentDisplay';

export type StudentPick = { id: string; name: string; email: string };

const errText = (err: unknown) => (err instanceof ApiError ? err.message : 'That didn’t work. Please try again.');
const fullName = (s: { firstName: string; lastName: string | null }) => [s.firstName, s.lastName].filter(Boolean).join(' ');

/** Shared submit state for the dialogs below. */
function useSubmit(onDone: (text: string) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = (task: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError('');
    task().then(
      () => onDone(done),
      (err: unknown) => {
        setError(errText(err));
        setBusy(false);
      },
    );
  };
  return { busy, error, setError, run };
}

/** Finds a student by name, email or phone digits (needs students.view, which every granting role has). */
export function StudentSearch({ onPick }: { onPick: (s: StudentPick) => void }) {
  const [term, setTerm] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setQ(term.trim()), 300);
    return () => window.clearTimeout(t);
  }, [term]);
  const results = useResource(q.length >= 2 ? `students:${q}` : null, () => adminApi.students.list({ q, pageSize: '8' }));

  return (
    <div className="adm-enr-search">
      <label>
        Student
        <input type="search" autoFocus placeholder="Name, email or phone digits" value={term} onChange={(e) => setTerm(e.target.value)} />
      </label>
      {q.length >= 2 && results.data ? (
        results.data.rows.length ? (
          <ul className="adm-enr-results">
            {results.data.rows.map((s: StudentRow) => (
              <li key={s.id}>
                <button type="button" onClick={() => onPick({ id: s.id, name: fullName(s), email: s.email })}>
                  <strong>{fullName(s)}</strong>
                  <span>{s.email}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="adm-muted adm-small">No students match “{q}”.</p>
        )
      ) : null}
    </div>
  );
}

/** Manual / complimentary access. Pass `student` from a student's page; otherwise staff search for one. */
export function GrantDialog({ student: fixed, onClose, onDone }: { student?: StudentPick; onClose: () => void; onDone: (text: string) => void }) {
  const plans = useResource('enrollment-plans', adminApi.enrollments.plans);
  const [student, setStudent] = useState<StudentPick | null>(fixed ?? null);
  const [planId, setPlanId] = useState('');
  const [source, setSource] = useState<'manual' | 'complimentary'>('manual');
  const [access, setAccess] = useState<'plan' | 'lifetime' | 'date'>('plan');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const { busy, error, setError, run } = useSubmit(onDone);

  const plan = plans.data?.find((p) => p.id === (planId || plans.data?.[0]?.id));
  const planDefault = plan ? (plan.accessDays ? `${plan.accessDays} days (plan default)` : 'Lifetime (plan default)') : 'Plan default';

  const confirm = () => {
    if (!student) return setError('Choose a student first.');
    if (!plan) return setError('Choose a plan.');
    if (access === 'date' && !date) return setError('Choose an end date.');
    const expiresOn = access === 'plan' ? undefined : access === 'lifetime' ? null : date;
    run(() => adminApi.enrollments.grant({ userId: student.id, planId: plan.id, source, expiresOn, reason }), `${student.name} now has access to ${plan.name}.`);
  };

  return (
    <Dialog open title="Grant course access" confirmLabel="Grant access" busy={busy} error={error} onConfirm={confirm} onCancel={onClose}>
      {student ? (
        <div className="adm-enr-picked">
          <span>
            <strong>{student.name}</strong>
            <span className="adm-sub">{student.email}</span>
          </span>
          {fixed ? null : (
            <button type="button" className="adm-btn" onClick={() => setStudent(null)}>
              Change
            </button>
          )}
        </div>
      ) : (
        <StudentSearch onPick={setStudent} />
      )}
      <label>
        Plan
        <select value={plan?.id ?? ''} onChange={(e) => setPlanId(e.target.value)} disabled={!plans.data}>
          {plans.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.status === 'published' ? '' : ` (${p.status})`}
            </option>
          ))}
        </select>
      </label>
      <label>
        Type
        <select value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
          <option value="manual">Staff grant (e.g. paid offline)</option>
          <option value="complimentary">Complimentary (free)</option>
        </select>
      </label>
      <label>
        Access until
        <select value={access} onChange={(e) => setAccess(e.target.value as typeof access)}>
          <option value="plan">{planDefault}</option>
          <option value="lifetime">Lifetime</option>
          <option value="date">A specific date…</option>
        </select>
      </label>
      {access === 'date' ? (
        <label>
          End date (access ends at midnight IST)
          <input type="date" required min={todayIst()} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      ) : null}
      <label>
        Reason (kept in the activity log)
        <textarea rows={2} required minLength={3} maxLength={500} placeholder="e.g. Paid ₹5,999 cash at the office, receipt #102" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
    </Dialog>
  );
}

/** Extend or shorten an active enrollment. */
export function EndDateDialog({ enrollment, onClose, onDone }: { enrollment: { id: string; plan: string; expiresAt: string | null }; onClose: () => void; onDone: (text: string) => void }) {
  const [lifetime, setLifetime] = useState(enrollment.expiresAt === null);
  const [date, setDate] = useState(enrollment.expiresAt ? istDay(enrollment.expiresAt) : '');
  const { busy, error, setError, run } = useSubmit(onDone);

  const confirm = () => {
    if (!lifetime && !date) return setError('Choose an end date.');
    run(() => adminApi.enrollments.setEnd(enrollment.id, lifetime ? null : date), lifetime ? `${enrollment.plan}: lifetime access.` : `${enrollment.plan}: access until ${formatDate(`${date}T12:00:00+05:30`)}.`);
  };

  return (
    <Dialog open title="Change access end date" confirmLabel="Save" busy={busy} error={error} onConfirm={confirm} onCancel={onClose}>
      <p>
        {enrollment.plan} · currently {enrollment.expiresAt ? `until ${formatDate(enrollment.expiresAt)}` : 'lifetime access'}.
      </p>
      <label className="adm-enr-check">
        <input type="checkbox" checked={lifetime} onChange={(e) => setLifetime(e.target.checked)} />
        Lifetime access
      </label>
      {lifetime ? null : (
        <label>
          End date (access ends at midnight IST)
          <input type="date" required min={todayIst()} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      )}
    </Dialog>
  );
}

export function RevokeDialog({
  enrollment,
  onClose,
  onDone,
}: {
  enrollment: { id: string; plan: string; source: string; studentName: string };
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useSubmit(onDone);
  return (
    <Dialog
      open
      title={`Revoke ${enrollment.plan}?`}
      confirmLabel="Revoke access"
      tone="danger"
      busy={busy}
      error={error}
      onConfirm={() => run(() => adminApi.enrollments.revoke(enrollment.id, reason), `${enrollment.studentName} no longer has access to ${enrollment.plan}.`)}
      onCancel={onClose}
    >
      <p>{enrollment.studentName} loses access to the courses in this plan immediately. This can&apos;t be undone, but you can grant access again.</p>
      {enrollment.source === 'purchase' ? <p className="adm-enr-warn">This was a purchase. Revoking does not refund the payment.</p> : null}
      <label>
        Reason (kept in the activity log)
        <textarea rows={3} required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
    </Dialog>
  );
}

import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { REGISTER_COUNTRIES } from '../../../../shared/countries';
import { ApiError } from '../../../lib/api';
import { useAdminSession } from '../../auth/adminSessionContext';
import { StatusBadge } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import type { StudentDetail } from '../../lib/adminApi';
import { ago, countryName, formatDate, formatIst } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import './Students.css';

type Action = 'suspend' | 'unsuspend' | 'signout' | 'reset' | null;

const ENROLLMENT_TONE: Record<string, 'success' | 'muted' | 'danger'> = { active: 'success', expired: 'muted', revoked: 'danger' };
const SOURCE_LABEL: Record<string, string> = { purchase: 'Purchase', manual: 'Granted by staff', complimentary: 'Complimentary' };

const message = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

/** /admin/students/:id — profile, course access, certificates, devices, and support actions. */
export function StudentDetailPage() {
  const { id = '' } = useParams();
  const student = useResource(id, () => adminApi.students.get(id));

  if (student.error && !student.data) {
    return (
      <div className="adm-student">
        <Link className="adm-back" to="/admin/students">
          ← All students
        </Link>
        {student.error.status === 404 ? (
          <EmptyState>
            <p>This student doesn&apos;t exist (or the account belongs to a team member).</p>
          </EmptyState>
        ) : (
          <ErrorState message="The student could not be loaded." requestId={student.error.requestId} onRetry={student.reload} />
        )}
      </div>
    );
  }
  if (!student.data || student.data.id !== id) return <Skeleton height={420} />;
  return <StudentView key={student.data.id} s={student.data} reload={student.reload} />;
}

function StudentView({ s, reload }: { s: StudentDetail; reload: () => void }) {
  const { can } = useAdminSession();
  const canEdit = can('students.edit');
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);

  const run = (task: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError('');
    task()
      .then(
        () => {
          setAction(null);
          setReason('');
          setNotice(done);
          reload();
        },
        (err: unknown) => setError(message(err, 'That didn’t work. Please try again.')),
      )
      .finally(() => setBusy(false));
  };

  const confirm = () => {
    if (action === 'suspend') run(() => adminApi.students.suspend(s.id, reason), 'Account suspended and signed out everywhere.');
    if (action === 'unsuspend') run(() => adminApi.students.unsuspend(s.id), 'Account reactivated.');
    if (action === 'signout') run(() => adminApi.students.revokeSessions(s.id), 'Signed out of every device.');
    if (action === 'reset') run(() => adminApi.students.passwordReset(s.id), `Password reset link sent to ${s.email}.`);
  };

  const fullName = [s.firstName, s.lastName].filter(Boolean).join(' ');

  return (
    <div className="adm-student">
      <Link className="adm-back" to="/admin/students">
        ← All students
      </Link>

      <header className="adm-student-head">
        <span className="adm-avatar" aria-hidden>
          {s.firstName.charAt(0).toUpperCase()}
        </span>
        <div>
          <h2>{fullName}</h2>
          <p>
            {s.email} · joined {formatDate(s.createdAt)}
          </p>
          <span className="adm-badges">
            {s.status === 'suspended' ? <StatusBadge tone="danger">Suspended</StatusBadge> : <StatusBadge tone="success">Active</StatusBadge>}
            {s.emailVerified ? <StatusBadge tone="info">Email verified</StatusBadge> : <StatusBadge tone="warning">Email not verified</StatusBadge>}
          </span>
        </div>
        {canEdit ? (
          <div className="adm-student-actions">
            <button type="button" className="adm-btn" onClick={() => setEditing((v) => !v)}>
              {editing ? 'Close editor' : 'Edit profile'}
            </button>
            {s.status === 'active' ? (
              <button type="button" className="adm-btn" onClick={() => setAction('reset')}>
                Send password reset
              </button>
            ) : null}
            <button type="button" className="adm-btn" disabled={!s.sessions.length} onClick={() => setAction('signout')}>
              Sign out everywhere
            </button>
            {s.status === 'active' ? (
              <button type="button" className="adm-btn adm-btn-danger-outline" onClick={() => setAction('suspend')}>
                Suspend
              </button>
            ) : (
              <button type="button" className="adm-btn adm-btn-primary" onClick={() => setAction('unsuspend')}>
                Reactivate
              </button>
            )}
          </div>
        ) : null}
      </header>

      {notice ? (
        <p className="adm-notice" role="status">
          {notice}
        </p>
      ) : null}

      {editing ? (
        <ProfileForm
          s={s}
          onSaved={(changed) => {
            setEditing(false);
            setNotice(changed ? 'Profile updated.' : 'Nothing changed.');
            reload();
          }}
        />
      ) : null}

      <div className="adm-student-grid">
        <section className="adm-panel">
          <h3>Profile</h3>
          <dl className="adm-facts">
            <div>
              <dt>Phone</dt>
              <dd>{s.phone ? <a href={`tel:${s.phone}`}>{s.phone}</a> : '—'}</dd>
            </div>
            <div>
              <dt>Country</dt>
              <dd>{countryName(s.country)}</dd>
            </div>
            <div>
              <dt>Name on certificate</dt>
              <dd>{s.certificateName ?? <span className="adm-muted">Same as name</span>}</dd>
            </div>
            <div>
              <dt>WhatsApp updates</dt>
              <dd>{s.whatsappOptIn ? 'Opted in' : 'Not opted in'}</dd>
            </div>
            <div>
              <dt>Last sign-in</dt>
              <dd>{s.lastLoginAt ? <time title={formatIst(s.lastLoginAt)}>{ago(s.lastLoginAt)}</time> : 'Never'}</dd>
            </div>
          </dl>
        </section>

        <section className="adm-panel">
          <h3>Signed-in devices</h3>
          {s.sessions.length ? (
            <ul className="adm-list">
              {s.sessions.map((x) => (
                <li key={x.id}>
                  <strong>{x.device}</strong>
                  <span className="adm-sub">
                    Signed in {formatDate(x.signedInAt)} · active {ago(x.lastActiveAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-muted">Not signed in anywhere.</p>
          )}
        </section>

        <section className="adm-panel adm-panel-wide">
          <h3>Course access</h3>
          {s.enrollments.length ? (
            <ul className="adm-list">
              {s.enrollments.map((e) => (
                <li key={e.id}>
                  <span className="adm-list-row">
                    <strong>{e.plan}</strong>
                    <StatusBadge tone={ENROLLMENT_TONE[e.status] ?? 'muted'}>{e.status[0].toUpperCase() + e.status.slice(1)}</StatusBadge>
                  </span>
                  <span className="adm-sub">
                    {SOURCE_LABEL[e.source] ?? e.source} · from {formatDate(e.startsAt)} · {e.expiresAt ? `until ${formatDate(e.expiresAt)}` : 'lifetime access'}
                    {e.revokedReason ? ` · revoked: ${e.revokedReason}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-muted">No course access yet. Purchases (and staff grants) will appear here.</p>
          )}
        </section>

        <section className="adm-panel adm-panel-wide">
          <h3>Certificates</h3>
          {s.certificates.length ? (
            <ul className="adm-list">
              {s.certificates.map((x) => (
                <li key={x.id}>
                  <span className="adm-list-row">
                    <strong>{x.programTitle}</strong>
                    <StatusBadge tone={x.status === 'valid' ? 'success' : 'danger'}>{x.status === 'valid' ? 'Valid' : 'Revoked'}</StatusBadge>
                  </span>
                  <span className="adm-sub">
                    {x.code} · issued {formatDate(x.issuedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-muted">No certificates issued.</p>
          )}
        </section>
      </div>

      <Dialog
        open={action === 'suspend'}
        title={`Suspend ${s.firstName}?`}
        confirmLabel="Suspend account"
        tone="danger"
        busy={busy}
        error={error}
        onConfirm={confirm}
        onCancel={() => setAction(null)}
      >
        <p>They&apos;ll be signed out of every device and can&apos;t sign in until reactivated. Course access is kept.</p>
        <label>
          Reason (kept in the activity log)
          <textarea rows={3} required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      </Dialog>
      <Dialog open={action === 'unsuspend'} title={`Reactivate ${s.firstName}?`} confirmLabel="Reactivate" busy={busy} error={error} onConfirm={confirm} onCancel={() => setAction(null)}>
        <p>They&apos;ll be able to sign in again with their existing password.</p>
      </Dialog>
      <Dialog open={action === 'signout'} title="Sign out everywhere?" confirmLabel="Sign out all devices" busy={busy} error={error} onConfirm={confirm} onCancel={() => setAction(null)}>
        <p>
          Ends {s.sessions.length} active session{s.sessions.length === 1 ? '' : 's'}. {s.firstName} can sign in again straight away.
        </p>
      </Dialog>
      <Dialog open={action === 'reset'} title="Send a password reset link?" confirmLabel="Send link" busy={busy} error={error} onConfirm={confirm} onCancel={() => setAction(null)}>
        <p>
          We&apos;ll email {s.email} a link to choose a new password. It expires in 1 hour.
        </p>
      </Dialog>
    </div>
  );
}

function ProfileForm({ s, onSaved }: { s: StudentDetail; onSaved: (changed: boolean) => void }) {
  const [firstName, setFirstName] = useState(s.firstName);
  const [lastName, setLastName] = useState(s.lastName ?? '');
  const [certificateName, setCertificateName] = useState(s.certificateName ?? '');
  const [phone, setPhone] = useState(s.phone ?? '');
  const [country, setCountry] = useState(s.country);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError('');
    adminApi.students
      .update(s.id, { firstName, lastName: lastName || null, certificateName: certificateName || null, phone: phone || null, country })
      .then(
        (r) => onSaved(r.changed.length > 0),
        (err: unknown) => {
          if (err instanceof ApiError && err.details.length) setErrors(Object.fromEntries(err.details.map((d) => [d.path, d.message])));
          else setError(message(err, 'The profile could not be saved.'));
        },
      )
      .finally(() => setBusy(false));
  };

  const field = (name: string, label: string, input: ReactNode) => (
    <label>
      {label}
      {input}
      {errors[name] ? <span className="adm-field-error">{errors[name]}</span> : null}
    </label>
  );

  return (
    <form className="adm-panel adm-profile-form" onSubmit={submit}>
      <h3>Edit profile</h3>
      <div className="adm-form-grid">
        {field('firstName', 'First name', <input required maxLength={80} value={firstName} onChange={(e) => setFirstName(e.target.value)} />)}
        {field('lastName', 'Last name', <input maxLength={80} value={lastName} onChange={(e) => setLastName(e.target.value)} />)}
        {field('certificateName', 'Name on certificate', <input maxLength={160} value={certificateName} onChange={(e) => setCertificateName(e.target.value)} />)}
        {field('phone', 'Phone', <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />)}
        {field(
          'country',
          'Country',
          <select className="adm-select" value={country} onChange={(e) => setCountry(e.target.value)}>
            {REGISTER_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>,
        )}
      </div>
      <p className="adm-muted adm-small">Email can&apos;t be changed here: it&apos;s the sign-in identity.</p>
      {error ? (
        <p className="adm-error" role="alert">
          {error}
        </p>
      ) : null}
      <div>
        <button type="submit" className="adm-btn adm-btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

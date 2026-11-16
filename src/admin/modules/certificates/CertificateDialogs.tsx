import { useState } from 'react';
import { ApiError } from '../../../lib/api';
import { Dialog } from '../../components/Dialog';
import { adminApi } from '../../lib/adminApi';
import { useResource } from '../../lib/useResource';
import { StudentSearch, type StudentPick } from '../enrollments/EnrollmentDialogs';
import { todayIst } from '../enrollments/enrollmentDisplay';

const errText = (err: unknown) => (err instanceof ApiError ? err.message : 'That didn’t work. Please try again.');

function useSubmit(onDone: (text: string) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = <T,>(task: () => Promise<T>, done: (r: T) => string) => {
    setBusy(true);
    setError('');
    task().then(
      (r) => onDone(done(r)),
      (err: unknown) => {
        setError(errText(err));
        setBusy(false);
      },
    );
  };
  return { busy, error, setError, run };
}

/**
 * Manual issue. The program is picked from plans and courses (which links the certificate to them) or
 * typed freely for training that isn't in the catalogue, e.g. an offline batch.
 */
export function IssueCertificateDialog({ student: fixed, onClose, onDone }: { student?: StudentPick; onClose: () => void; onDone: (text: string) => void }) {
  const programs = useResource('certificate-programs', adminApi.certificates.programs);
  const [student, setStudent] = useState<StudentPick | null>(fixed ?? null);
  const [choice, setChoice] = useState('');
  const [custom, setCustom] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [issuedOn, setIssuedOn] = useState(todayIst());
  const { busy, error, setError, run } = useSubmit(onDone);

  const options = [
    ...(programs.data?.plans.map((p) => ({ value: `plan:${p.id}`, title: p.title, group: 'Plans' })) ?? []),
    ...(programs.data?.courses.map((c) => ({ value: `course:${c.id}`, title: c.title, group: 'Courses' })) ?? []),
  ];
  const picked = options.find((o) => o.value === choice);

  const confirm = () => {
    if (!student) return setError('Choose a student first.');
    const programTitle = choice === 'other' ? custom.trim() : picked?.title;
    if (!programTitle) return setError('Choose the program.');
    const [kind, id] = choice.split(':');
    run(
      () =>
        adminApi.certificates.issue({
          userId: student.id,
          programTitle,
          planId: kind === 'plan' ? id : null,
          courseId: kind === 'course' ? id : null,
          recipientName: recipientName.trim() || undefined,
          issuedOn,
        }),
      (r) => `Certificate ${r.code} issued to ${r.recipientName}.`,
    );
  };

  return (
    <Dialog open title="Issue a certificate" confirmLabel="Issue certificate" busy={busy} error={error} onConfirm={confirm} onCancel={onClose}>
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
        Program
        <select required value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">Choose…</option>
          {['Plans', 'Courses'].map((group) => (
            <optgroup key={group} label={group}>
              {options
                .filter((o) => o.group === group)
                .map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.title}
                  </option>
                ))}
            </optgroup>
          ))}
          <option value="other">Other (type it)…</option>
        </select>
      </label>
      {choice === 'other' ? (
        <label>
          Program title (printed on the certificate)
          <input required minLength={3} maxLength={200} placeholder="e.g. Weekend Firmware Workshop, Oct 2026" value={custom} onChange={(e) => setCustom(e.target.value)} />
        </label>
      ) : null}
      <label>
        Name to print (optional)
        <input maxLength={160} placeholder="Uses the student’s “name on certificate”" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
      </label>
      <label>
        Issue date
        <input type="date" required max={todayIst()} value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
      </label>
      <p className="adm-small">The certificate ID (AR-year-number) is assigned automatically. Anyone can check it on the website’s Verify page.</p>
    </Dialog>
  );
}

export function RenameCertificateDialog({ cert, onClose, onDone }: { cert: { id: string; code: string; recipientName: string }; onClose: () => void; onDone: (text: string) => void }) {
  const [name, setName] = useState(cert.recipientName);
  const { busy, error, run } = useSubmit(onDone);
  return (
    <Dialog
      open
      title={`Correct the name on ${cert.code}`}
      confirmLabel="Save name"
      busy={busy}
      error={error}
      onConfirm={() => run(() => adminApi.certificates.rename(cert.id, name), (r) => (r.changed ? `${cert.code} now reads “${name.trim()}”.` : 'Nothing changed.'))}
      onCancel={onClose}
    >
      <p>For spelling fixes. The certificate ID stays the same, so printed copies and links keep working.</p>
      <label>
        Name to print
        <input required minLength={2} maxLength={160} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
    </Dialog>
  );
}

export function RevokeCertificateDialog({ cert, onClose, onDone }: { cert: { id: string; code: string; recipientName: string }; onClose: () => void; onDone: (text: string) => void }) {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useSubmit(onDone);
  return (
    <Dialog
      open
      title={`Revoke ${cert.code}?`}
      confirmLabel="Revoke certificate"
      tone="danger"
      busy={busy}
      error={error}
      onConfirm={() => run(() => adminApi.certificates.revoke(cert.id, reason), () => `${cert.code} revoked. The Verify page now shows it as revoked.`)}
      onCancel={onClose}
    >
      <p>
        Anyone checking {cert.code} (issued to {cert.recipientName}) will see it as revoked. This can&apos;t be undone; issue a new certificate if needed.
      </p>
      <label>
        Reason (kept in the activity log; never shown publicly)
        <textarea rows={3} required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
    </Dialog>
  );
}

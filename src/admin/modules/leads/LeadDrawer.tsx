import { useState } from 'react';
import type { FormEvent } from 'react';
import { LEAD_NOTE_TYPES, LEAD_STATUSES } from '../../../../shared/leads';
import type { LeadStatus } from '../../../../shared/leads';
import { ApiError } from '../../../lib/api';
import { useAdminSession } from '../../auth/adminSessionContext';
import { Drawer, StatusBadge } from '../../components/DataTable';
import { ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import type { Assignee, LeadDetail, LeadNote } from '../../lib/adminApi';
import { useResource } from '../../lib/useResource';
import { STATUS_TONE, ago, formatIst, reasonLabel, sourceLabel, statusLabel, waDigits } from './leadDisplay';

const NOTE_LABELS: Record<LeadNote['type'], string> = {
  note: 'Note',
  call: 'Call',
  email: 'Email',
  whatsapp: 'WhatsApp',
  status_change: 'Status',
  assignment: 'Assignment',
};

function noteText(n: LeadNote) {
  if (n.type === 'status_change' && n.fromStatus && n.toStatus) return `${statusLabel(n.fromStatus)} → ${statusLabel(n.toStatus)}`;
  return n.body ?? '';
}

/** Lead detail on the right: contact actions, the message, status/assignee controls and the notes timeline. */
export function LeadDrawer({ id, assignees, onClose, onChanged }: { id: string | null; assignees: Assignee[]; onClose: () => void; onChanged: () => void }) {
  const lead = useResource(id, () => adminApi.leads.get(id!));
  const current = lead.data?.id === id ? lead.data : null;

  return (
    <Drawer open={id !== null} onClose={onClose} label="Lead details">
      {lead.error && !current ? (
        <ErrorState message={lead.error.status === 404 ? 'This lead no longer exists.' : 'The lead could not be loaded.'} requestId={lead.error.requestId} onRetry={lead.reload} />
      ) : !current ? (
        <Skeleton height={420} />
      ) : (
        <LeadDetails
          key={current.id}
          lead={current}
          assignees={assignees}
          onChanged={() => {
            lead.reload();
            onChanged();
          }}
        />
      )}
    </Drawer>
  );
}

function LeadDetails({ lead, assignees, onChanged }: { lead: LeadDetail; assignees: Assignee[]; onChanged: () => void }) {
  const { can } = useAdminSession();
  const canEdit = can('leads.edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [noteType, setNoteType] = useState('note');
  const [noteBody, setNoteBody] = useState('');

  const save = (body: { status?: LeadStatus; assignedTo?: string | null }) => {
    setSaving(true);
    setError('');
    adminApi.leads
      .update(lead.id, body)
      .then(onChanged, (err: unknown) => setError(err instanceof ApiError ? err.message : 'The change could not be saved.'))
      .finally(() => setSaving(false));
  };

  const addNote = (e: FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setSaving(true);
    setError('');
    adminApi.leads
      .addNote(lead.id, { type: noteType, body: noteBody.trim() })
      .then(
        () => {
          setNoteBody('');
          onChanged();
        },
        (err: unknown) => setError(err instanceof ApiError ? err.message : 'The note could not be saved.'),
      )
      .finally(() => setSaving(false));
  };

  // An assignee who has since lost access still shows, so the select never lies.
  const assigneeOptions = lead.assignee && !assignees.some((a) => a.id === lead.assignee!.id) ? [...assignees, { ...lead.assignee, role: 'student' as const, firstName: lead.assignee.firstName ?? 'Former staff' }] : assignees;
  const utm = lead.utm ? Object.entries(lead.utm) : [];

  return (
    <div className="adm-lead">
      <header className="adm-lead-head">
        <StatusBadge tone={STATUS_TONE[lead.status]}>{statusLabel(lead.status)}</StatusBadge>
        <h2>{lead.name ?? sourceLabel(lead.source)}</h2>
        <p>
          {sourceLabel(lead.source)} · <time dateTime={lead.createdAt}>{formatIst(lead.createdAt)}</time>
        </p>
      </header>

      <section className="adm-lead-contact" aria-label="Contact">
        {lead.phone ? (
          <>
            <a className="adm-btn" href={`tel:${lead.phone}`}>
              Call {lead.phone}
            </a>
            <a className="adm-btn" href={`https://wa.me/${waDigits(lead.phone)}`} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </>
        ) : null}
        {lead.email ? (
          <a className="adm-btn" href={`mailto:${lead.email}`}>
            Email {lead.email}
          </a>
        ) : null}
      </section>

      {canEdit ? (
        <section className="adm-lead-controls">
          <label>
            Status
            <select className="adm-select" value={lead.status} disabled={saving} onChange={(e) => save({ status: e.target.value as LeadStatus })}>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assigned to
            <select className="adm-select" value={lead.assignee?.id ?? ''} disabled={saving} onChange={(e) => save({ assignedTo: e.target.value || null })}>
              <option value="">Unassigned</option>
              {assigneeOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.firstName}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}
      {error ? (
        <p className="adm-error" role="alert">
          {error}
        </p>
      ) : null}

      <dl className="adm-lead-facts">
        <div>
          <dt>Reason</dt>
          <dd>{reasonLabel(lead.reason)}</dd>
        </div>
        <div>
          <dt>WhatsApp updates</dt>
          <dd>{lead.whatsappConsent ? 'Agreed' : 'Not agreed'}</dd>
        </div>
        {lead.pagePath ? (
          <div>
            <dt>Sent from</dt>
            <dd>{lead.pagePath}</dd>
          </div>
        ) : null}
        {utm.length ? (
          <div>
            <dt>Campaign</dt>
            <dd>{utm.map(([k, v]) => `${k.replace(/^utm_/, '')}: ${v}`).join(' · ')}</dd>
          </div>
        ) : null}
      </dl>

      {lead.message ? (
        <section>
          <h3>Message</h3>
          <p className="adm-lead-message">{lead.message}</p>
        </section>
      ) : null}

      <section>
        <h3>Follow-up</h3>
        {canEdit ? (
          <form className="adm-lead-note-form" onSubmit={addNote}>
            <label className="adm-skip" htmlFor="adm-note-body">
              New note
            </label>
            <textarea
              id="adm-note-body"
              rows={3}
              maxLength={5000}
              placeholder="What happened? e.g. Called, sent the course brochure on WhatsApp"
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
            />
            <div>
              <select className="adm-select" aria-label="Note type" value={noteType} onChange={(e) => setNoteType(e.target.value)}>
                {LEAD_NOTE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button type="submit" className="adm-btn adm-btn-primary" disabled={saving || !noteBody.trim()}>
                Add note
              </button>
            </div>
          </form>
        ) : null}
        {lead.notes.length ? (
          <ol className="adm-timeline">
            {lead.notes.map((n) => (
              <li key={n.id} className={n.type === 'status_change' || n.type === 'assignment' ? 'is-system' : undefined}>
                <p className="adm-timeline-meta">
                  <strong>{NOTE_LABELS[n.type]}</strong> · {n.author?.firstName ?? 'System'} ·{' '}
                  <time dateTime={n.createdAt} title={formatIst(n.createdAt)}>
                    {ago(n.createdAt)}
                  </time>
                </p>
                <p className="adm-timeline-body">{noteText(n)}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="adm-muted">No follow-up yet.</p>
        )}
      </section>
    </div>
  );
}

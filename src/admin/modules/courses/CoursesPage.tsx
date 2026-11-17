import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../../lib/api';
import { useAdminSession } from '../../auth/adminSessionContext';
import { StatusBadge } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import type { CourseRow } from '../../lib/adminApi';
import { useResource } from '../../lib/useResource';
import { slugify } from '../blog/blogDisplay';
import { PUBLISH_LABEL, PUBLISH_TONE } from '../plans/planDisplay';
import './Courses.css';

/** /admin/courses — training tracks in site order, with content health at a glance. */
export function CoursesPage() {
  const { can } = useAdminSession();
  const navigate = useNavigate();
  const list = useResource('courses', adminApi.courses.list);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const canEdit = can('courses.edit');

  const move = (rows: CourseRow[], i: number, by: -1 | 1) => {
    const next = [...rows];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    list.setData(next);
    setError('');
    adminApi.courses.reorder(next.map((r) => r.id)).catch((err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'The new order could not be saved.');
      list.reload();
    });
  };

  return (
    <div>
      <div className="adm-plans-bar">
        <p className="adm-muted">Tracks appear on the Training pages in this order. Lessons get their videos once video hosting (Bunny) is set up.</p>
        {can('courses.add') ? (
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => setCreating(true)}>
            + New track
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="adm-error" role="alert">
          {error}
        </p>
      ) : null}

      {list.error && !list.data ? (
        <ErrorState message="Courses could not be loaded." requestId={list.error.requestId} onRetry={list.reload} />
      ) : !list.data ? (
        <Skeleton height={320} />
      ) : list.data.length === 0 ? (
        <EmptyState>
          <p>No tracks yet. While none is published, the website shows its built-in catalogue.</p>
        </EmptyState>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Track</th>
                <th scope="col">Status</th>
                <th scope="col">Content</th>
                <th scope="col">Videos</th>
                {canEdit ? <th scope="col">Order</th> : null}
              </tr>
            </thead>
            <tbody>
              {list.data.map((c, i, rows) => (
                <tr
                  key={c.id}
                  tabIndex={0}
                  onClick={() => navigate(`/admin/courses/${c.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target === e.currentTarget) navigate(`/admin/courses/${c.id}`);
                  }}
                >
                  <td data-label="Track">
                    <strong>{c.title}</strong>
                    <span className="adm-sub">/training/{c.slug}</span>
                  </td>
                  <td data-label="Status">
                    <StatusBadge tone={PUBLISH_TONE[c.status]}>{PUBLISH_LABEL[c.status]}</StatusBadge>
                  </td>
                  <td data-label="Content">
                    {c.modules} module{c.modules === 1 ? '' : 's'} · {c.lessons.total} lesson{c.lessons.total === 1 ? '' : 's'}
                    <span className="adm-sub">
                      {c.lessons.published} published{c.lessons.preview ? ` · ${c.lessons.preview} free preview` : ''}
                    </span>
                  </td>
                  <td data-label="Videos">
                    {c.lessons.withVideo} / {c.lessons.total}
                    {c.lessons.total && c.lessons.withVideo < c.lessons.total ? <span className="adm-sub">{c.lessons.total - c.lessons.withVideo} coming soon</span> : null}
                  </td>
                  {canEdit ? (
                    <td data-label="Order" className="adm-td-actions">
                      <span className="adm-course-arrows">
                        <button
                          type="button"
                          className="adm-btn adm-btn-icon"
                          aria-label={`Move ${c.title} up`}
                          disabled={i === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            move(rows, i, -1);
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="adm-btn adm-btn-icon"
                          aria-label={`Move ${c.title} down`}
                          disabled={i === rows.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            move(rows, i, 1);
                          }}
                        >
                          ↓
                        </button>
                      </span>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating ? <NewCourseDialog onClose={() => setCreating(false)} onCreated={(id) => navigate(`/admin/courses/${id}`, { state: { notice: 'Track created as a draft. Add modules and lessons, then publish it.' } })} /> : null}
    </div>
  );
}

function NewCourseDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [touched, setTouched] = useState(false);
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog
      open
      title="New training track"
      confirmLabel="Create track"
      busy={busy}
      error={error}
      onCancel={onClose}
      onConfirm={() => {
        setBusy(true);
        setError('');
        adminApi.courses
          .create({ title, slug, summary, imageUrl: null, status: 'draft' })
          .then((r) => onCreated(r.id), (err: unknown) => setError(err instanceof ApiError ? err.message : 'The track could not be created.'))
          .finally(() => setBusy(false));
      }}
    >
      <label>
        Title
        <input
          required
          minLength={3}
          maxLength={160}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!touched) setSlug(slugify(e.target.value).slice(0, 64));
          }}
        />
      </label>
      <label>
        Web address: /training/…
        <input
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          maxLength={64}
          value={slug}
          onChange={(e) => {
            setTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
        />
      </label>
      <label>
        Summary
        <textarea required minLength={10} maxLength={2000} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </label>
      <p className="adm-small">Starts as a draft, hidden from the website. The web address can&apos;t be changed later.</p>
    </Dialog>
  );
}

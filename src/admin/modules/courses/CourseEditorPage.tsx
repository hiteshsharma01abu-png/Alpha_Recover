import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../../lib/api';
import { useAdminSession } from '../../auth/adminSessionContext';
import { StatusBadge } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import type { AdminLesson, AdminModule, CourseDetail, CourseInput, LessonInput, PublishStatus } from '../../lib/adminApi';
import { tusUpload } from '../../lib/tusUpload';
import { useResource } from '../../lib/useResource';
import { mmss, parseMmss } from '../demos/demoDisplay';
import { PUBLISH_LABEL, PUBLISH_STATUSES, PUBLISH_TONE } from '../plans/planDisplay';
import './Courses.css';

const errText = (err: unknown, fallback = 'That didn’t work. Please try again.') => (err instanceof ApiError ? err.message : fallback);
const IMAGE_URL = /^(\/assets\/[\w./-]+|https:\/\/[^\s"'<>]+)$/;

type Pending =
  | { kind: 'module'; module: AdminModule | null }
  | { kind: 'delete-module'; module: AdminModule }
  | { kind: 'lesson'; moduleId: string; lesson: AdminLesson | null }
  | { kind: 'delete-lesson'; lesson: AdminLesson }
  | { kind: 'delete-course' }
  | null;

/** /admin/courses/:id — track details and its outline (modules → lessons). */
export function CourseEditorPage() {
  const { id = '' } = useParams();
  const course = useResource(id, () => adminApi.courses.get(id));
  if (course.error && !course.data) {
    return (
      <div>
        <Link className="adm-back" to="/admin/courses">
          ← All tracks
        </Link>
        {course.error.status === 404 ? (
          <EmptyState>
            <p>This track doesn&apos;t exist or was deleted.</p>
          </EmptyState>
        ) : (
          <ErrorState message="The track could not be loaded." requestId={course.error.requestId} onRetry={course.reload} />
        )}
      </div>
    );
  }
  if (!course.data || course.data.id !== id) return <Skeleton height={480} />;
  return <CourseView c={course.data} reload={course.reload} setData={course.setData} />;
}

function CourseView({ c, reload, setData }: { c: CourseDetail; reload: () => void; setData: (d: CourseDetail) => void }) {
  const { can } = useAdminSession();
  const navigate = useNavigate();
  const location = useLocation();
  const canEdit = can('courses.edit');
  const canAdd = can('courses.add');
  const canDelete = can('courses.delete');
  const [notice, setNotice] = useState((location.state as { notice?: string } | null)?.notice ?? '');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set(c.modules.length <= 3 ? c.modules.map((m) => m.id) : []));

  const done = (text: string) => {
    setPending(null);
    setNotice(text);
    setError('');
    reload();
  };

  /** Sends the whole outline in its new order; shows it immediately and reloads if the save fails. */
  const saveOrder = (modules: AdminModule[]) => {
    setData({ ...c, modules });
    setError('');
    adminApi.courses
      .saveOrder(
        c.id,
        modules.map((m) => ({ id: m.id, lessonIds: m.lessons.map((l) => l.id) })),
      )
      .then(
        () => reload(),
        (err: unknown) => {
          setError(errText(err, 'The new order could not be saved.'));
          reload();
        },
      );
  };
  const swap = <T,>(list: T[], i: number, by: -1 | 1) => {
    const next = [...list];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    return next;
  };
  const moveModule = (i: number, by: -1 | 1) => saveOrder(swap(c.modules, i, by));
  const moveLesson = (mi: number, li: number, by: -1 | 1) => saveOrder(c.modules.map((m, k) => (k === mi ? { ...m, lessons: swap(m.lessons, li, by) } : m)));
  const moveLessonTo = (lesson: AdminLesson, fromIndex: number, toModuleId: string) => {
    const modules = c.modules.map((m, k) => {
      if (k === fromIndex) return { ...m, lessons: m.lessons.filter((l) => l.id !== lesson.id) };
      if (m.id === toModuleId) return { ...m, lessons: [...m.lessons, lesson] };
      return m;
    });
    setOpen((s) => new Set(s).add(toModuleId));
    saveOrder(modules);
  };

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const lessonCount = c.modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <div className="adm-course">
      <Link className="adm-back" to="/admin/courses">
        ← All tracks
      </Link>
      <header className="adm-plan-head">
        <div>
          <h2>{c.title}</h2>
          <p>
            <StatusBadge tone={PUBLISH_TONE[c.status]}>{PUBLISH_LABEL[c.status]}</StatusBadge> /training/{c.slug} · {c.modules.length} modules · {lessonCount} lessons
            {c.status === 'published' ? (
              <a href={`/training/${c.slug}`} target="_blank" rel="noreferrer">
                View on site ↗
              </a>
            ) : null}
          </p>
        </div>
      </header>
      {notice ? (
        <p className="adm-notice" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="adm-error" role="alert">
          {error}
        </p>
      ) : null}

      <CourseDetailsForm key={c.updatedAt} c={c} canEdit={canEdit} onSaved={(t) => done(t)} />

      <section className="adm-panel adm-course-outline">
        <div className="adm-panel-head">
          <h3>Outline</h3>
          <span className="adm-course-head-actions">
            <button type="button" className="adm-btn" onClick={() => setOpen(new Set(open.size ? [] : c.modules.map((m) => m.id)))}>
              {open.size ? 'Collapse all' : 'Expand all'}
            </button>
            {canAdd ? (
              <button type="button" className="adm-btn" onClick={() => setPending({ kind: 'module', module: null })}>
                + Module
              </button>
            ) : null}
          </span>
        </div>
        {c.modules.length === 0 ? <p className="adm-muted">No modules yet. Add one, then add its lessons.</p> : null}
        <ol className="adm-course-modules">
          {c.modules.map((m, mi) => (
            <li key={m.id} className="adm-course-module">
              <div className="adm-course-module-head">
                <button type="button" className="adm-course-toggle" aria-expanded={open.has(m.id)} onClick={() => toggle(m.id)}>
                  <span aria-hidden>{open.has(m.id) ? '▾' : '▸'}</span>
                  <strong>{m.title}</strong>
                  <span className="adm-muted adm-small">
                    {m.lessons.length} lesson{m.lessons.length === 1 ? '' : 's'}
                  </span>
                </button>
                {canEdit || canDelete ? (
                  <span className="adm-course-row-actions">
                    {canEdit ? (
                      <>
                        <button type="button" className="adm-btn adm-btn-icon" aria-label={`Move ${m.title} up`} disabled={mi === 0} onClick={() => moveModule(mi, -1)}>
                          ↑
                        </button>
                        <button type="button" className="adm-btn adm-btn-icon" aria-label={`Move ${m.title} down`} disabled={mi === c.modules.length - 1} onClick={() => moveModule(mi, 1)}>
                          ↓
                        </button>
                        <button type="button" className="adm-btn" onClick={() => setPending({ kind: 'module', module: m })}>
                          Rename
                        </button>
                      </>
                    ) : null}
                    {canDelete ? (
                      <button type="button" className="adm-btn adm-btn-danger-outline" onClick={() => setPending({ kind: 'delete-module', module: m })}>
                        Delete
                      </button>
                    ) : null}
                  </span>
                ) : null}
              </div>
              {open.has(m.id) ? (
                <>
                  <ol className="adm-course-lessons">
                    {m.lessons.map((l, li) => (
                      <li key={l.id}>
                        <span className="adm-course-lesson">
                          <span className="adm-course-lesson-title">
                            {l.title}
                            <span className="adm-badges">
                              {l.status !== 'published' ? <StatusBadge tone={PUBLISH_TONE[l.status]}>{PUBLISH_LABEL[l.status]}</StatusBadge> : null}
                              {l.isPreview ? <StatusBadge tone="info">Free preview</StatusBadge> : null}
                              {l.hasVideo ? <StatusBadge tone="success">Video</StatusBadge> : <StatusBadge tone="muted">No video</StatusBadge>}
                            </span>
                          </span>
                          <span className="adm-muted adm-small">{l.durationSeconds ? mmss(l.durationSeconds) : '—'}</span>
                        </span>
                        {canEdit || canDelete ? (
                          <span className="adm-course-row-actions">
                            {canEdit ? (
                              <>
                                <button type="button" className="adm-btn adm-btn-icon" aria-label={`Move ${l.title} up`} disabled={li === 0} onClick={() => moveLesson(mi, li, -1)}>
                                  ↑
                                </button>
                                <button type="button" className="adm-btn adm-btn-icon" aria-label={`Move ${l.title} down`} disabled={li === m.lessons.length - 1} onClick={() => moveLesson(mi, li, 1)}>
                                  ↓
                                </button>
                                {c.modules.length > 1 ? (
                                  <select className="adm-select" aria-label={`Move ${l.title} to another module`} value="" onChange={(e) => e.target.value && moveLessonTo(l, mi, e.target.value)}>
                                    <option value="">Move to…</option>
                                    {c.modules
                                      .filter((x) => x.id !== m.id)
                                      .map((x) => (
                                        <option key={x.id} value={x.id}>
                                          {x.title}
                                        </option>
                                      ))}
                                  </select>
                                ) : null}
                                <button type="button" className="adm-btn" onClick={() => setPending({ kind: 'lesson', moduleId: m.id, lesson: l })}>
                                  Edit
                                </button>
                              </>
                            ) : null}
                            {canDelete ? (
                              <button type="button" className="adm-btn adm-btn-icon adm-btn-danger-outline" aria-label={`Delete ${l.title}`} onClick={() => setPending({ kind: 'delete-lesson', lesson: l })}>
                                ✕
                              </button>
                            ) : null}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                  {canAdd ? (
                    <button type="button" className="adm-btn adm-course-add-lesson" onClick={() => setPending({ kind: 'lesson', moduleId: m.id, lesson: null })}>
                      + Lesson
                    </button>
                  ) : null}
                </>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {canDelete ? (
        <div className="adm-plan-danger">
          <button type="button" className="adm-btn adm-btn-danger-outline" onClick={() => setPending({ kind: 'delete-course' })}>
            Delete track
          </button>
        </div>
      ) : null}

      {pending?.kind === 'module' ? <ModuleDialog courseId={c.id} module={pending.module} onClose={() => setPending(null)} onDone={done} /> : null}
      {pending?.kind === 'lesson' ? <LessonDialog moduleId={pending.moduleId} lesson={pending.lesson} onClose={() => setPending(null)} onDone={done} /> : null}
      {pending?.kind === 'delete-module' ? (
        <ConfirmDialog
          title={`Delete module “${pending.module.title}”?`}
          body={pending.module.lessons.length ? 'Only empty modules can be deleted: move or delete its lessons first.' : 'It disappears from the track and the website.'}
          confirmLabel="Delete module"
          task={() => adminApi.courses.removeModule(pending.module.id)}
          onClose={() => setPending(null)}
          onDone={() => done('Module deleted.')}
        />
      ) : null}
      {pending?.kind === 'delete-lesson' ? (
        <ConfirmDialog
          title={`Delete lesson “${pending.lesson.title}”?`}
          body="It disappears from the track and the website. To hide it temporarily, set it to Draft instead."
          confirmLabel="Delete lesson"
          task={() => adminApi.courses.removeLesson(pending.lesson.id)}
          onClose={() => setPending(null)}
          onDone={() => done('Lesson deleted.')}
        />
      ) : null}
      {pending?.kind === 'delete-course' ? (
        <ConfirmDialog
          title={`Delete “${c.title}”?`}
          body={c.modules.length ? 'Only an empty track can be deleted. Set it to Archived to hide it, or delete its modules first.' : 'It disappears from the website and this list. Its web address stays reserved.'}
          confirmLabel="Delete track"
          task={() => adminApi.courses.remove(c.id)}
          onClose={() => setPending(null)}
          onDone={() => navigate('/admin/courses', { replace: true })}
        />
      ) : null}
    </div>
  );
}

function CourseDetailsForm({ c, canEdit, onSaved }: { c: CourseDetail; canEdit: boolean; onSaved: (text: string) => void }) {
  const [v, setV] = useState<CourseInput>({ title: c.title, summary: c.summary, imageUrl: c.imageUrl, status: c.status });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const changed = (Object.keys(v) as (keyof CourseInput)[]).filter((k) => (v[k] ?? '') !== (c[k] ?? ''));
  const image = v.imageUrl?.trim() ?? '';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = Object.fromEntries(changed.map((k) => [k, k === 'imageUrl' ? image || null : v[k]]));
    setBusy(true);
    setError('');
    adminApi.courses
      .update(c.id, body)
      .then(() => onSaved('Track saved. The website updates within 5 minutes.'), (err: unknown) => setError(errText(err)))
      .finally(() => setBusy(false));
  };

  return (
    <form className="adm-panel adm-course-details" onSubmit={submit}>
      <h3>Track details</h3>
      <fieldset disabled={!canEdit || busy}>
        <div className="adm-plan-fields">
          <div className="adm-plan-row">
            <label>
              Title
              <input required minLength={3} maxLength={160} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
            </label>
            <label>
              Status
              <select className="adm-select" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as PublishStatus })}>
                {PUBLISH_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PUBLISH_LABEL[s]}
                  </option>
                ))}
              </select>
              <span className="adm-muted adm-small">{v.status === 'published' ? 'Shown on the Training pages' : 'Hidden from the website'}</span>
            </label>
          </div>
          <label>
            Summary
            <textarea required minLength={10} maxLength={2000} rows={3} value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} />
          </label>
          <label>
            Image (optional)
            <input value={v.imageUrl ?? ''} placeholder="/assets/… or https://…" onChange={(e) => setV({ ...v, imageUrl: e.target.value })} />
          </label>
          {IMAGE_URL.test(image) ? <img className="adm-course-image" src={image} alt="" /> : null}
        </div>
      </fieldset>
      {error ? (
        <p className="adm-error" role="alert">
          {error}
        </p>
      ) : null}
      {canEdit ? (
        <div className="adm-plan-save">
          <button type="submit" className="adm-btn adm-btn-primary" disabled={busy || !changed.length}>
            {busy ? 'Saving…' : 'Save details'}
          </button>
        </div>
      ) : null}
    </form>
  );
}

function ModuleDialog({ courseId, module, onClose, onDone }: { courseId: string; module: AdminModule | null; onClose: () => void; onDone: (text: string) => void }) {
  const [title, setTitle] = useState(module?.title ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog
      open
      title={module ? 'Rename module' : 'New module'}
      confirmLabel={module ? 'Save' : 'Add module'}
      busy={busy}
      error={error}
      onCancel={onClose}
      onConfirm={() => {
        setBusy(true);
        setError('');
        (module ? adminApi.courses.renameModule(module.id, title) : adminApi.courses.addModule(courseId, title))
          .then(() => onDone(module ? 'Module renamed.' : 'Module added at the end.'), (err: unknown) => setError(errText(err)))
          .finally(() => setBusy(false));
      }}
    >
      <label>
        Module title
        <input required minLength={2} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
    </Dialog>
  );
}

function LessonDialog({ moduleId, lesson, onClose, onDone }: { moduleId: string; lesson: AdminLesson | null; onClose: () => void; onDone: (text: string) => void }) {
  const [title, setTitle] = useState(lesson?.title ?? '');
  const [description, setDescription] = useState(lesson?.description ?? '');
  const [duration, setDuration] = useState(lesson?.durationSeconds ? mmss(lesson.durationSeconds) : '');
  const [isPreview, setIsPreview] = useState(lesson?.isPreview ?? false);
  const [status, setStatus] = useState<PublishStatus>(lesson?.status ?? 'draft');
  const [hasVideo, setHasVideo] = useState(lesson?.hasVideo ?? false);
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError] = useState('');

  const confirm = () => {
    const durationSeconds = duration.trim() ? parseMmss(duration) : null;
    if (duration.trim() && durationSeconds === null) return setError('Length: use minutes:seconds, e.g. 12:34');
    const body: LessonInput = { title, description: description.trim() || null, durationSeconds, isPreview, status };
    setBusy(true);
    setError('');
    (lesson ? adminApi.courses.updateLesson(lesson.id, body) : adminApi.courses.addLesson(moduleId, body))
      .then(() => onDone(lesson ? 'Lesson saved.' : 'Lesson added at the end of the module.'), (err: unknown) => setError(errText(err)))
      .finally(() => setBusy(false));
  };

  const uploadVideo = (file: File | undefined) => {
    if (!lesson || !file) return;
    setBusy(true);
    setError('');
    setUploadPct(0);
    adminApi.courses
      .requestUploadUrl(title.trim() || lesson.title)
      .then(async (creds) => {
        await tusUpload({
          endpoint: creds.upload.endpoint,
          headers: creds.upload.headers,
          file,
          onProgress: (r) => setUploadPct(Math.round(r * 100)),
        });
        await adminApi.courses.attachLessonVideo(lesson.id, creds.videoId);
        setHasVideo(true);
        setUploadPct(null);
        onDone('Video uploaded and attached.');
      })
      .catch((err: unknown) => {
        setUploadPct(null);
        setError(errText(err, 'The video could not be uploaded.'));
      })
      .finally(() => setBusy(false));
  };

  const removeVideo = () => {
    if (!lesson) return;
    setBusy(true);
    setError('');
    adminApi.courses
      .clearLessonVideo(lesson.id)
      .then(() => {
        setHasVideo(false);
        onDone('Video removed from this lesson.');
      }, (err: unknown) => setError(errText(err)))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open title={lesson ? 'Edit lesson' : 'New lesson'} confirmLabel={lesson ? 'Save lesson' : 'Add lesson'} busy={busy} error={error} onCancel={onClose} onConfirm={confirm}>
      <label>
        Title
        <input required minLength={2} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
      </label>
      <label>
        Description (optional)
        <textarea rows={3} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
      </label>
      <label>
        Length (mm:ss, optional)
        <input inputMode="numeric" placeholder="12:34" value={duration} onChange={(e) => setDuration(e.target.value)} disabled={busy} />
      </label>
      <label>
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value as PublishStatus)} disabled={busy}>
          {PUBLISH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PUBLISH_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="adm-enr-check">
        <input type="checkbox" checked={isPreview} onChange={(e) => setIsPreview(e.target.checked)} disabled={busy} />
        Free preview (anyone can watch without enrolling)
      </label>
      {lesson ? (
        <div className="adm-course-video">
          <p className="adm-small">{hasVideo ? 'A video is attached. Students can play it when the lesson is published.' : 'No video yet: the player shows “coming soon”.'}</p>
          {uploadPct !== null ? (
            <div className="adm-course-video-progress" role="progressbar" aria-valuenow={uploadPct} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${uploadPct}%` }} />
              <em>Uploading… {uploadPct}%</em>
            </div>
          ) : null}
          <div className="adm-course-row-actions">
            <label className="adm-btn">
              {hasVideo ? 'Replace video' : 'Upload video'}
              <input
                type="file"
                accept="video/*"
                hidden
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  uploadVideo(file);
                }}
              />
            </label>
            {hasVideo ? (
              <button type="button" className="adm-btn" disabled={busy} onClick={removeVideo}>
                Remove video
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="adm-small">Save the lesson first, then open it again to upload a video.</p>
      )}
    </Dialog>
  );
}

function ConfirmDialog({ title, body, confirmLabel, task, onClose, onDone }: { title: string; body: string; confirmLabel: string; task: () => Promise<unknown>; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog
      open
      title={title}
      confirmLabel={confirmLabel}
      tone="danger"
      busy={busy}
      error={error}
      onCancel={onClose}
      onConfirm={() => {
        setBusy(true);
        setError('');
        task()
          .then(onDone, (err: unknown) => setError(errText(err)))
          .finally(() => setBusy(false));
      }}
    >
      <p>{body}</p>
    </Dialog>
  );
}

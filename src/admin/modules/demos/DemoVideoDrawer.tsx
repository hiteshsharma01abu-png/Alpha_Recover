import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { demoThumbFor } from '../../../lib/demoVideos';
import { ApiError } from '../../../lib/api';
import { useAdminSession } from '../../auth/adminSessionContext';
import { Drawer } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import type { AdminDemoVideo, DemoVideoInput } from '../../lib/adminApi';
import { formatDate } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import { PUBLISH_LABEL, PUBLISH_STATUSES } from '../plans/planDisplay';
import { CATEGORY_LABEL, LEVEL_LABEL, mmss, parseMmss } from './demoDisplay';

const EMPTY: DemoVideoInput = {
  title: '',
  tag: '',
  category: 'logical',
  level: 'beginner',
  description: '',
  tags: [],
  durationSeconds: 0,
  thumbnailUrl: null,
  status: 'draft',
  sortOrder: 0,
  isFeatured: false,
};

/** Editor on the right. `id === 'new'` opens an empty form. */
export function DemoVideoDrawer({ id, onClose, onSaved }: { id: string | null; onClose: () => void; onSaved: (notice: string, id?: string) => void }) {
  const isNew = id === 'new';
  const video = useResource(id && !isNew ? id : null, () => adminApi.demoVideos.get(id!));
  const current = video.data?.id === id ? video.data : null;

  return (
    <Drawer open={id !== null} onClose={onClose} label={isNew ? 'New demo video' : 'Demo video'}>
      {isNew ? (
        <DemoForm key="new" video={null} onSaved={onSaved} />
      ) : video.error && !current ? (
        <ErrorState message={video.error.status === 404 ? 'This video no longer exists.' : 'The video could not be loaded.'} requestId={video.error.requestId} onRetry={video.reload} />
      ) : !current ? (
        <Skeleton height={420} />
      ) : (
        <DemoForm
          key={`${current.id}:${current.updatedAt}`}
          video={current}
          onSaved={(text, next) => {
            if (next) video.reload();
            onSaved(text, next);
          }}
        />
      )}
    </Drawer>
  );
}

function DemoForm({ video, onSaved }: { video: AdminDemoVideo | null; onSaved: (notice: string, id?: string) => void }) {
  const { can } = useAdminSession();
  const isNew = video === null;
  const readOnly = isNew ? !can('demos.add') : !can('demos.edit');
  const initial = video ?? EMPTY;

  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState(initial.title);
  const [tag, setTag] = useState(initial.tag);
  const [category, setCategory] = useState(initial.category);
  const [level, setLevel] = useState(initial.level);
  const [duration, setDuration] = useState(initial.durationSeconds ? mmss(initial.durationSeconds) : '');
  const [description, setDescription] = useState(initial.description);
  const [tags, setTags] = useState(initial.tags.join(', '));
  const [thumbnailUrl, setThumbnailUrl] = useState(initial.thumbnailUrl ?? '');
  const [status, setStatus] = useState(initial.status);
  const [sortOrder, setSortOrder] = useState(String(initial.sortOrder));
  const [isFeatured, setIsFeatured] = useState(initial.isFeatured);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fail = (err: unknown) => {
    if (err instanceof ApiError && err.details.length) setErrors(Object.fromEntries(err.details.map((d) => [d.path.split('.')[0], d.message])));
    setError(err instanceof ApiError ? err.message : 'The video could not be saved.');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const durationSeconds = parseMmss(duration);
    if (durationSeconds === null) return setErrors({ durationSeconds: 'Use minutes:seconds, e.g. 12:34' });
    setErrors({});
    const values: DemoVideoInput = {
      title,
      tag,
      category,
      level,
      description,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      durationSeconds,
      thumbnailUrl: thumbnailUrl.trim() || null,
      status,
      sortOrder: Number(sortOrder) || 0,
      isFeatured: status === 'published' && isFeatured,
    };
    setBusy(true);
    if (isNew) {
      adminApi.demoVideos
        .create({ ...values, slug })
        .then((r) => onSaved(`“${title}” created.`, r.id), fail)
        .finally(() => setBusy(false));
      return;
    }
    const diff = Object.fromEntries(Object.entries(values).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(video[k as keyof DemoVideoInput])));
    if (!Object.keys(diff).length) {
      setBusy(false);
      setError('Nothing changed.');
      return;
    }
    adminApi.demoVideos
      .update(video.id, diff)
      .then(() => onSaved(`“${title}” saved. The website updates within two minutes.`, video.id), fail)
      .finally(() => setBusy(false));
  };

  const field = (key: string, label: ReactNode, input: ReactNode, hint?: string) => (
    <label>
      {label}
      {input}
      {errors[key] ? <span className="adm-field-error">{errors[key]}</span> : hint ? <span className="adm-muted adm-small">{hint}</span> : null}
    </label>
  );

  // Preview only what the API would accept, so half-typed or bogus URLs never load.
  const typed = thumbnailUrl.trim();
  const preview = demoThumbFor(video?.slug ?? slug, /^(\/assets\/[\w./-]+|https:\/\/[^\s"'<>]+)$/.test(typed) ? typed : null);

  return (
    <div className="adm-demo">
      <header className="adm-demo-head">
        <h2>{isNew ? 'New demo video' : video.title}</h2>
        {video ? (
          <p>
            /{video.slug} · {video.viewCount.toLocaleString('en-IN')} views{video.publishedAt ? ` · published ${formatDate(video.publishedAt)}` : ''}
          </p>
        ) : null}
      </header>
      <img className="adm-demo-preview" src={preview} alt="" />
      {video && !video.hasVideo ? <p className="adm-muted adm-small">No video file yet: the site shows this demo as “coming soon”. Uploads arrive with video hosting (Bunny).</p> : null}

      <form onSubmit={submit}>
        <fieldset className="adm-demo-form" disabled={readOnly || busy}>
          {field('title', 'Title', <input required minLength={3} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />)}
          {isNew
            ? field(
                'slug',
                'Slug (web address)',
                <input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={64} placeholder="e.g. ssd-firmware-rescue" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />,
                "Lowercase letters, numbers and dashes. It can't be changed later.",
              )
            : null}
          <div className="adm-demo-row">
            {field('tag', 'Card label', <input required minLength={2} maxLength={40} placeholder="e.g. Native Solution" value={tag} onChange={(e) => setTag(e.target.value)} />)}
            {field('durationSeconds', 'Length (mm:ss)', <input required inputMode="numeric" placeholder="12:34" value={duration} onChange={(e) => setDuration(e.target.value)} />)}
          </div>
          <div className="adm-demo-row">
            {field(
              'category',
              'Category',
              <select className="adm-select" value={category} onChange={(e) => setCategory(e.target.value as DemoVideoInput['category'])}>
                {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>,
            )}
            {field(
              'level',
              'Level',
              <select className="adm-select" value={level} onChange={(e) => setLevel(e.target.value as DemoVideoInput['level'])}>
                {Object.entries(LEVEL_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>,
            )}
          </div>
          {field('description', 'Description', <textarea required minLength={10} maxLength={2000} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />)}
          {field('tags', 'Tags (comma-separated)', <input value={tags} placeholder="SSD, Firmware" onChange={(e) => setTags(e.target.value)} />, 'Used by the search on the Demos page')}
          {field(
            'thumbnailUrl',
            'Thumbnail (optional)',
            <input value={thumbnailUrl} placeholder="/assets/… or https://…" onChange={(e) => setThumbnailUrl(e.target.value)} />,
            'Empty uses the built-in image for this video, or a generic one',
          )}
          <div className="adm-demo-row">
            {field(
              'status',
              'Status',
              <select className="adm-select" value={status} onChange={(e) => setStatus(e.target.value as DemoVideoInput['status'])}>
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
          <label className="adm-plan-check">
            <input type="checkbox" checked={status === 'published' && isFeatured} disabled={status !== 'published'} onChange={(e) => setIsFeatured(e.target.checked)} />
            Featured (the big video at the top of the Demos page; replaces the current one)
          </label>
          {errors.isFeatured ? <span className="adm-field-error">{errors.isFeatured}</span> : null}

          {error ? (
            <p className={error === 'Nothing changed.' ? 'adm-muted' : 'adm-error'} role="alert">
              {error}
            </p>
          ) : null}
          {readOnly ? null : (
            <div className="adm-demo-actions">
              {!isNew && can('demos.delete') ? (
                <button type="button" className="adm-btn adm-btn-danger-outline" onClick={() => setDeleting(true)}>
                  Delete
                </button>
              ) : null}
              <button type="submit" className="adm-btn adm-btn-primary">
                {busy ? 'Saving…' : isNew ? 'Create video' : 'Save changes'}
              </button>
            </div>
          )}
        </fieldset>
      </form>

      {video ? (
        <Dialog
          open={deleting}
          title={`Delete “${video.title}”?`}
          confirmLabel="Delete video"
          tone="danger"
          busy={busy}
          error={error}
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            setBusy(true);
            adminApi.demoVideos
              .remove(video.id)
              .then(() => onSaved(`“${video.title}” deleted.`), fail)
              .finally(() => setBusy(false));
          }}
        >
          <p>It disappears from the website and this list. Its view count and slug are kept on record.</p>
        </Dialog>
      ) : null}
    </div>
  );
}

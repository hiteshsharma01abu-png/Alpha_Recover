import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Markdown } from '../../../components/ui/Markdown';
import { ApiError } from '../../../lib/api';
import { useAdminSession } from '../../auth/adminSessionContext';
import { StatusBadge } from '../../components/DataTable';
import { Dialog } from '../../components/Dialog';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import type { BlogDetail, BlogInput } from '../../lib/adminApi';
import { formatIst } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import { toIstInput } from '../plans/planDisplay';
import { BLOG_STATE_LABEL, BLOG_STATE_TONE, slugify } from './blogDisplay';
import './Blog.css';

const EMPTY: BlogInput = { title: '', slug: '', excerpt: '', bodyMarkdown: '', coverImageUrl: null, seoTitle: null, seoDescription: null };
const IMAGE_URL = /^(\/assets\/[\w./-]+|https:\/\/[^\s"'<>]+)$/;

/** /admin/blog/new and /admin/blog/:id. */
export function BlogEditorPage() {
  const { id } = useParams();
  const post = useResource(id ?? null, () => adminApi.blog.get(id!));

  if (!id) return <BlogForm key="new" post={null} reload={() => undefined} />;
  if (post.error && !post.data) {
    return (
      <div>
        <Link className="adm-back" to="/admin/blog">
          ← All posts
        </Link>
        {post.error.status === 404 ? (
          <EmptyState>
            <p>This post doesn&apos;t exist or was deleted.</p>
          </EmptyState>
        ) : (
          <ErrorState message="The post could not be loaded." requestId={post.error.requestId} onRetry={post.reload} />
        )}
      </div>
    );
  }
  if (!post.data || post.data.id !== id) return <Skeleton height={480} />;
  return <BlogForm key={`${post.data.id}:${post.data.updatedAt}:${post.data.state}`} post={post.data} reload={post.reload} />;
}

type Pending = 'schedule' | 'unpublish' | 'delete' | null;

function BlogForm({ post, reload }: { post: BlogDetail | null; reload: () => void }) {
  const { can } = useAdminSession();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = post === null;
  const canWrite = isNew ? can('blog.add') : can('blog.edit');
  const canPublish = can('blog.publish');
  const initial: BlogInput = post ?? EMPTY;

  const [values, setValues] = useState<BlogInput>(initial);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [view, setView] = useState<'write' | 'preview'>('write');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState((location.state as { notice?: string } | null)?.notice ?? '');
  const [pending, setPending] = useState<Pending>(null);
  const [publishAt, setPublishAt] = useState(post?.publishedAt && post.state === 'scheduled' ? toIstInput(post.publishedAt) : '');

  const set = <K extends keyof BlogInput>(key: K, value: BlogInput[K]) => setValues((v) => ({ ...v, [key]: value }));
  const dirtyKeys = (Object.keys(values) as (keyof BlogInput)[]).filter((k) => (values[k] ?? '') !== (initial[k] ?? ''));
  const dirty = dirtyKeys.length > 0;

  const fail = (err: unknown) => {
    if (err instanceof ApiError && err.details.length) setErrors(Object.fromEntries(err.details.map((d) => [d.path.split('.')[0], d.message])));
    setError(err instanceof ApiError ? err.message : 'That didn’t work. Please try again.');
  };
  const begin = () => {
    setBusy(true);
    setErrors({});
    setError('');
    setNotice('');
  };
  /** After a change: reload, keeping a notice across the remount. */
  const done = (text: string, path = '.') => {
    navigate(path, { replace: true, state: { notice: text } });
    reload();
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    const body = { ...values, coverImageUrl: values.coverImageUrl?.trim() || null, seoTitle: values.seoTitle?.trim() || null, seoDescription: values.seoDescription?.trim() || null };
    begin();
    if (isNew) {
      adminApi.blog
        .create(body)
        .then((r) => navigate(`/admin/blog/${r.id}`, { replace: true, state: { notice: 'Draft saved. Publish it when it’s ready.' } }), fail)
        .finally(() => setBusy(false));
      return;
    }
    const diff = Object.fromEntries(dirtyKeys.map((k) => [k, body[k]]));
    adminApi.blog
      .update(post.id, diff)
      .then(() => done(post.state === 'published' ? 'Saved. The live post updates within 5 minutes.' : 'Saved.'), fail)
      .finally(() => setBusy(false));
  };

  const publish = (at?: string) => {
    if (!post) return;
    begin();
    adminApi.blog
      .publish(post.id, at)
      .then((r) => {
        setPending(null);
        done(r.state === 'scheduled' ? `Scheduled for ${formatIst(r.publishedAt)}.` : 'Published. It appears on the blog within 5 minutes.');
      }, fail)
      .finally(() => setBusy(false));
  };

  const cover = values.coverImageUrl?.trim() ?? '';
  const field = (key: keyof BlogInput, label: ReactNode, input: ReactNode, hint?: ReactNode) => (
    <label>
      {label}
      {input}
      {errors[key] ? <span className="adm-field-error">{errors[key]}</span> : hint ? <span className="adm-muted adm-small">{hint}</span> : null}
    </label>
  );
  const counter = (text: string | null, max: number) => `${(text ?? '').length} / ${max}`;

  return (
    <div className="adm-blog">
      <Link className="adm-back" to="/admin/blog">
        ← All posts
      </Link>
      <header className="adm-blog-head">
        <div>
          <h2>{isNew ? 'New post' : post.title}</h2>
          {post ? (
            <p>
              <StatusBadge tone={BLOG_STATE_TONE[post.state]}>{BLOG_STATE_LABEL[post.state]}</StatusBadge>
              {post.publishedAt && post.state !== 'draft' ? <span>{post.state === 'scheduled' ? 'Goes live' : 'Published'} {formatIst(post.publishedAt)}</span> : null}
              {post.author?.firstName ? <span>· by {post.author.firstName}</span> : null}
              {post.state === 'published' ? (
                <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer">
                  View on site ↗
                </a>
              ) : null}
            </p>
          ) : null}
        </div>
        {post && canPublish ? (
          <div className="adm-blog-publish">
            {post.state !== 'published' ? (
              <button type="button" className="adm-btn adm-btn-primary" disabled={busy || dirty} title={dirty ? 'Save your changes first' : undefined} onClick={() => publish()}>
                Publish now
              </button>
            ) : null}
            <button type="button" className="adm-btn" disabled={busy || dirty} onClick={() => setPending('schedule')}>
              {post.state === 'scheduled' ? 'Change time' : post.state === 'draft' ? 'Schedule…' : 'Change date'}
            </button>
            {post.state !== 'draft' ? (
              <button type="button" className="adm-btn adm-btn-danger-outline" disabled={busy} onClick={() => setPending('unpublish')}>
                Unpublish
              </button>
            ) : null}
            {dirty && post.state !== 'published' ? <span className="adm-muted adm-small">Save your changes before publishing.</span> : null}
          </div>
        ) : null}
      </header>

      {notice ? (
        <p className="adm-notice" role="status">
          {notice}
        </p>
      ) : null}
      {!canWrite ? <p className="adm-muted">You can read this post but not edit it.</p> : null}

      <form onSubmit={save}>
        <fieldset className="adm-blog-form" disabled={!canWrite || busy}>
          <div className="adm-panel adm-blog-fields">
            {field(
              'title',
              'Title',
              <input
                required
                minLength={3}
                maxLength={200}
                value={values.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setValues((v) => ({ ...v, title, slug: slugTouched ? v.slug : slugify(title) }));
                }}
              />,
            )}
            {field(
              'slug',
              'Web address',
              <span className="adm-blog-slug">
                <span aria-hidden>/blog/</span>
                <input
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  maxLength={120}
                  value={values.slug}
                  readOnly={post?.slugLocked}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set('slug', e.target.value.toLowerCase());
                  }}
                />
              </span>,
              post?.slugLocked ? 'Fixed: this post has been published, so links to it may exist.' : 'Filled in from the title; edit it if you like. It becomes fixed once published.',
            )}
            {field(
              'excerpt',
              'Summary',
              <textarea required minLength={20} maxLength={400} rows={3} value={values.excerpt} onChange={(e) => set('excerpt', e.target.value)} />,
              <>Shown on the blog list and in search results when no SEO description is set · {counter(values.excerpt, 400)}</>,
            )}
          </div>

          <div className="adm-panel adm-blog-body">
            <div className="adm-blog-tabs" role="tablist" aria-label="Editor view">
              <button type="button" role="tab" aria-selected={view === 'write'} onClick={() => setView('write')}>
                Write
              </button>
              <button type="button" role="tab" aria-selected={view === 'preview'} onClick={() => setView('preview')}>
                Preview
              </button>
              <span className="adm-muted adm-small">
                {(values.bodyMarkdown.match(/[\p{L}\p{N}]+/gu) ?? []).length.toLocaleString('en-IN')} words
              </span>
            </div>
            <div className={`adm-blog-split is-${view}`}>
              <label className="adm-blog-write">
                <textarea aria-label="Article (Markdown)" value={values.bodyMarkdown} rows={22} spellCheck onChange={(e) => set('bodyMarkdown', e.target.value)} placeholder={'## A heading\n\nA paragraph with **bold**, *italic* and a [link](https://example.com).\n\n- A list item'} />
                <span className="adm-muted adm-small">
                  Formatting: <code>## Heading</code> · <code>**bold**</code> · <code>*italic*</code> · <code>[text](https://…)</code> · <code>- list</code> · <code>&gt; quote</code>. HTML is shown as plain text.
                </span>
                {errors.bodyMarkdown ? <span className="adm-field-error">{errors.bodyMarkdown}</span> : null}
              </label>
              <div className="adm-blog-preview" aria-label="Preview">
                {values.bodyMarkdown.trim() ? <Markdown source={values.bodyMarkdown} /> : <p className="adm-muted">Nothing written yet.</p>}
              </div>
            </div>
          </div>

          <div className="adm-panel adm-blog-fields">
            <h3>Cover &amp; search engines</h3>
            {field(
              'coverImageUrl',
              'Cover image (optional)',
              <input value={values.coverImageUrl ?? ''} placeholder="/assets/… or https://…" onChange={(e) => set('coverImageUrl', e.target.value)} />,
              'Image uploads arrive with Bunny; for now use a site image path or an https link.',
            )}
            {IMAGE_URL.test(cover) ? <img className="adm-blog-cover" src={cover} alt="" /> : null}
            {field(
              'seoTitle',
              'SEO title (optional)',
              <input maxLength={70} value={values.seoTitle ?? ''} placeholder={values.title} onChange={(e) => set('seoTitle', e.target.value)} />,
              <>Browser tab and Google headline; the title is used if empty · {counter(values.seoTitle, 70)}</>,
            )}
            {field(
              'seoDescription',
              'SEO description (optional)',
              <textarea maxLength={160} rows={2} value={values.seoDescription ?? ''} placeholder={values.excerpt} onChange={(e) => set('seoDescription', e.target.value)} />,
              <>Google snippet; the summary is used if empty · {counter(values.seoDescription, 160)}</>,
            )}
          </div>

          {error ? (
            <p className="adm-error" role="alert">
              {error}
            </p>
          ) : null}
          {canWrite ? (
            <div className="adm-blog-save">
              {post && can('blog.delete') ? (
                <button type="button" className="adm-btn adm-btn-danger-outline" onClick={() => setPending('delete')}>
                  Delete post
                </button>
              ) : null}
              <span className="adm-muted adm-small">{dirty ? 'Unsaved changes' : isNew ? '' : 'All changes saved'}</span>
              <button type="submit" className="adm-btn adm-btn-primary" disabled={busy || (!dirty && !isNew)}>
                {busy ? 'Saving…' : isNew ? 'Save draft' : 'Save'}
              </button>
            </div>
          ) : null}
        </fieldset>
      </form>

      {post ? (
        <>
          <Dialog
            open={pending === 'schedule'}
            title={post.state === 'published' ? 'Change the publish date' : 'Schedule this post'}
            confirmLabel={post.state === 'published' ? 'Save date' : 'Schedule'}
            busy={busy}
            error={error}
            onCancel={() => setPending(null)}
            onConfirm={() => (publishAt ? publish(publishAt) : setError('Choose a date and time.'))}
          >
            <p>{post.state === 'published' ? 'The date shown on the post. A future date hides the post until then.' : 'The post goes live on the blog automatically at this time.'}</p>
            <label>
              Date and time (IST)
              <input type="datetime-local" required value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
            </label>
          </Dialog>
          <Dialog
            open={pending === 'unpublish'}
            title="Unpublish this post?"
            confirmLabel="Unpublish"
            tone="danger"
            busy={busy}
            error={error}
            onCancel={() => setPending(null)}
            onConfirm={() => {
              begin();
              adminApi.blog
                .unpublish(post.id)
                .then(() => {
                  setPending(null);
                  done('Unpublished. It leaves the blog within 5 minutes.');
                }, fail)
                .finally(() => setBusy(false));
            }}
          >
            <p>It goes back to draft and disappears from the blog. Its address stays reserved, so you can publish it again later.</p>
          </Dialog>
          <Dialog
            open={pending === 'delete'}
            title={`Delete “${post.title}”?`}
            confirmLabel="Delete post"
            tone="danger"
            busy={busy}
            error={error}
            onCancel={() => setPending(null)}
            onConfirm={() => {
              begin();
              adminApi.blog
                .remove(post.id)
                .then(() => navigate('/admin/blog', { replace: true }), fail)
                .finally(() => setBusy(false));
            }}
          >
            <p>It disappears from the blog and this list. The activity log keeps a record.</p>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}

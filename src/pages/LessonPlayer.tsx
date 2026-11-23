import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHero } from '../components/ui/PageHero';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { icons } from '../lib/icons';
import {
  getCourseOutline,
  getCourseProgress,
  getPlayback,
  lessonPath,
  certificateDownloadUrl,
  saveProgress,
  type CourseOutline,
  type EarnedCertificate,
  type CourseProgress,
  type OutlineLesson,
} from '../lib/learning';
import './LessonPlayer.css';

type Playback = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'error'; message: string };
type FlatLesson = OutlineLesson & { moduleSlug: string; moduleTitle: string };

const BUNNY_ORIGIN = 'https://iframe.mediadelivery.net';
const SAVE_EVERY_MS = 15_000;
const clock = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');

/** /learn/:courseSlug/:moduleSlug/:lessonSlug: one remount per course keeps the loaded state simple. */
export function LessonPlayer() {
  const { courseSlug = '' } = useParams();
  return <Player key={courseSlug} courseSlug={courseSlug} />;
}

function Player({ courseSlug }: { courseSlug: string }) {
  const { moduleSlug = '', lessonSlug = '' } = useParams();
  const auth = useAuth();
  const [outline, setOutline] = useState<CourseOutline | 'not-found' | 'unavailable' | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [playbacks, setPlaybacks] = useState<Record<string, Playback>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [earned, setEarned] = useState<EarnedCertificate | null>(null);

  useEffect(() => {
    let live = true;
    getCourseOutline(courseSlug)
      .then((c) => live && setOutline(c))
      .catch((err) => live && setOutline(err instanceof ApiError && err.status === 404 ? 'not-found' : 'unavailable'));
    return () => {
      live = false;
    };
  }, [courseSlug]);

  const userId = auth.user?.id;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    getCourseProgress(courseSlug)
      .then((p) => live && setProgress(p))
      .catch(() => live && setProgress(null));
    return () => {
      live = false;
    };
  }, [courseSlug, userId]);

  const course = typeof outline === 'object' ? outline : null;
  const flat: FlatLesson[] = course ? course.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleSlug: m.slug, moduleTitle: m.title }))) : [];
  const index = flat.findIndex((l) => l.moduleSlug === moduleSlug && l.slug === lessonSlug);
  const lesson = index >= 0 ? flat[index] : null;
  const myProgress = userId ? progress : null;
  const enrolled = Boolean(myProgress?.enrolled);
  const done = (l: OutlineLesson) => Boolean(myProgress?.lessons[l.id]?.completed);
  const isLocked = (l: OutlineLesson) => !l.isPreview && !enrolled;
  // While the session / progress is still loading we don't know yet whether a paid lesson is open.
  const accessKnown = auth.loaded && (!userId || progress !== null);
  const locked = lesson ? isLocked(lesson) : false;
  const canPlay = Boolean(lesson && lesson.hasVideo && accessKnown && !locked);
  const playback = lesson ? playbacks[lesson.id] : undefined;

  const lessonId = lesson?.id;
  useEffect(() => {
    if (!canPlay || !lessonId || playbacks[lessonId]) return;
    let live = true;
    getPlayback(lessonId)
      .then((p) => live && setPlaybacks((m) => ({ ...m, [lessonId]: { status: 'ready', url: p.embedUrl } })))
      .catch(
        (err) =>
          live &&
          setPlaybacks((m) => ({
            ...m,
            [lessonId]: { status: 'error', message: err instanceof ApiError ? err.message : 'The video could not be loaded. Please try again.' },
          })),
      );
    return () => {
      live = false;
    };
  }, [canPlay, lessonId, playbacks]);

  function applySaved(id: string, completedAt: string | null, courseProgressPct: number, positionSeconds?: number, certificate?: EarnedCertificate | null) {
    if (certificate) setEarned(certificate);
    setProgress((p) => {
      if (!p) return p;
      const before = p.lessons[id];
      const wasDone = Boolean(before?.completed);
      const nowDone = Boolean(completedAt);
      return {
        ...p,
        lessons: { ...p.lessons, [id]: { positionSeconds: positionSeconds ?? before?.positionSeconds ?? 0, completed: nowDone } },
        lessonsCompleted: p.lessonsCompleted + (nowDone === wasDone ? 0 : nowDone ? 1 : -1),
        progressPct: courseProgressPct,
      };
    });
  }

  async function toggleComplete() {
    if (!lesson) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await saveProgress(lesson.id, { completed: !done(lesson) });
      applySaved(lesson.id, res.completedAt, res.courseProgressPct, undefined, res.certificate);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (outline === null) return <div className="section container" aria-busy="true" />;
  if (outline === 'not-found' || (course && !lesson)) {
    return (
      <div className="section container lp-message">
        <h1>Lesson not found</h1>
        <p>This lesson may have moved or been removed.</p>
        <Link className="btn btn-primary" to={course ? `/training/${course.slug}` : '/training'}>
          Back to the course
        </Link>
      </div>
    );
  }
  if (outline === 'unavailable' || !course || !lesson) {
    return (
      <div className="section container lp-message">
        <h1>Lessons are unavailable right now</h1>
        <p>The training portal can&apos;t be reached at the moment. Please try again later.</p>
        <Link className="btn btn-primary" to={`/training/${courseSlug}`}>
          Back to the course
        </Link>
      </div>
    );
  }

  const prev = flat[index - 1];
  const next = flat[index + 1];
  const lessonDone = done(lesson);

  return (
    <div>
      <PageHero crumbs={[{ label: 'Training', to: '/training' }, { label: course.title, to: `/training/${course.slug}` }, { label: lesson.title }]} title={lesson.title} sub={`${lesson.moduleTitle} · Lesson ${index + 1} of ${flat.length}`} />
      <section className="section lp-section">
        <div className="container lp">
          {earned ? (
            <div className="lp-earned" role="status">
              <img src={icons.award} alt="" width={40} height={40} />
              <div>
                <strong>Congratulations! You&apos;ve earned your certificate.</strong>
                <span>
                  {earned.programTitle} · {earned.code}
                </span>
              </div>
              <div className="lp-earned-actions">
                <a className="btn btn-primary" href={certificateDownloadUrl(earned.code)} download>
                  Download PDF
                </a>
                <Link className="btn btn-ghost" to="/dashboard">
                  My Learning
                </Link>
              </div>
            </div>
          ) : null}
          <div className="lp-main">
            <div className="lp-stage">
              {!accessKnown ? (
                <div className="lp-panel" aria-busy="true" />
              ) : locked ? (
                <div className="lp-panel">
                  <img src={icons.lock} alt="" width={44} height={44} />
                  <h2>This lesson is part of the Professional Plan</h2>
                  <p>{userId ? 'Get the plan to unlock every lesson, with lifetime access.' : 'Log in if you already have the plan, or get it to unlock every lesson.'}</p>
                  <div className="lp-panel-actions">
                    <Link className="btn btn-primary" to="/pricing">
                      Get Professional Plan
                    </Link>
                    {!userId ? (
                      <Link className="btn btn-ghost" to="/account">
                        Log in
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : !lesson.hasVideo ? (
                <div className="lp-panel">
                  <img src={icons.monitorPlay} alt="" width={44} height={44} />
                  <h2>Video coming soon</h2>
                  <p>This lesson&apos;s video is being prepared. You can still mark it complete as you work through the course.</p>
                </div>
              ) : playback?.status === 'ready' ? (
                <BunnyFrame key={lesson.id} src={playback.url} title={lesson.title} lessonId={lesson.id} trackProgress={Boolean(userId)} onSaved={applySaved} />
              ) : playback?.status === 'error' ? (
                <div className="lp-panel">
                  <img src={icons.info} alt="" width={44} height={44} />
                  <h2>The video can&apos;t play right now</h2>
                  <p>{playback.message}</p>
                </div>
              ) : (
                <div className="lp-panel" aria-busy="true" />
              )}
            </div>

            <div className="lp-bar">
              {prev ? (
                <Link className="lp-nav" to={lessonPath(course.slug, prev.moduleSlug, prev.slug)}>
                  <img src={icons.chevronLeft} alt="" width={16} height={16} /> Previous
                </Link>
              ) : (
                <span />
              )}
              {userId && !locked && accessKnown ? (
                <button type="button" className={`lp-complete${lessonDone ? ' is-done' : ''}`} onClick={() => void toggleComplete()} disabled={saving} aria-pressed={lessonDone}>
                  {lessonDone ? '✓ Completed' : 'Mark as complete'}
                </button>
              ) : null}
              {next ? (
                <Link className="lp-nav" to={lessonPath(course.slug, next.moduleSlug, next.slug)}>
                  Next <img src={icons.chevronRight} alt="" width={16} height={16} />
                </Link>
              ) : (
                <span />
              )}
            </div>
            {saveError ? (
              <p className="form-error" role="alert">
                {saveError}
              </p>
            ) : null}
          </div>

          <aside className="lp-outline" aria-label="Course outline">
            {myProgress && enrolled ? (
              <div className="lp-progress">
                <span>
                  {myProgress.lessonsCompleted} of {myProgress.lessonsTotal} lessons complete
                </span>
                <span className="lp-progress-bar" role="progressbar" aria-valuenow={myProgress.progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress">
                  <span style={{ width: `${myProgress.progressPct}%` }} />
                </span>
              </div>
            ) : null}
            {course.modules.map((m) => (
              <div key={m.slug} className="lp-module">
                <h2>{m.title}</h2>
                <ol>
                  {m.lessons.map((l) => {
                    const current = l.id === lesson.id;
                    const state = done(l) ? 'done' : accessKnown && isLocked(l) ? 'locked' : 'open';
                    return (
                      <li key={l.id}>
                        <Link
                          to={lessonPath(course.slug, m.slug, l.slug)}
                          className={`lp-item is-${state}${current ? ' is-current' : ''}`}
                          aria-current={current ? 'page' : undefined}
                        >
                          <span className="lp-item-mark" aria-hidden>
                            {state === 'done' ? '✓' : state === 'locked' ? <img src={icons.lock} alt="" width={12} height={12} /> : null}
                          </span>
                          <span className="lp-item-title">{l.title}</span>
                          <span className="lp-item-meta">{l.isPreview && !enrolled ? 'Free preview' : clock(l.durationSeconds)}</span>
                          <span className="lp-sr">{state === 'done' ? ' (completed)' : state === 'locked' ? ' (locked)' : ''}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </aside>
        </div>
      </section>
    </div>
  );
}

/**
 * Bunny's player speaks the player.js postMessage protocol: subscribe to timeupdate / pause / ended
 * and save the position every 15 s, on pause, and completion at the end.
 * (Exercised once a Bunny library is configured; until then lessons show "coming soon".)
 */
function BunnyFrame({
  src,
  title,
  lessonId,
  trackProgress,
  onSaved,
}: {
  src: string;
  title: string;
  lessonId: string;
  trackProgress: boolean;
  onSaved: (id: string, completedAt: string | null, pct: number, positionSeconds?: number, certificate?: EarnedCertificate | null) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  });

  useEffect(() => {
    if (!trackProgress) return;
    let position = 0;
    let watched = 0;
    let lastSave = 0;
    const save = (body: Parameters<typeof saveProgress>[1]) =>
      saveProgress(lessonId, body)
        .then((r) => onSavedRef.current(lessonId, r.completedAt, r.courseProgressPct, body.positionSeconds, r.certificate))
        .catch(() => {});
    const send = (method: string, value?: string) =>
      frame.current?.contentWindow?.postMessage(JSON.stringify({ context: 'player.js', version: '0.0.11', method, value, listener: value }), BUNNY_ORIGIN);

    function onMessage(e: MessageEvent) {
      if (e.origin !== BUNNY_ORIGIN || e.source !== frame.current?.contentWindow) return;
      let msg: { context?: string; event?: string; value?: { seconds?: number } };
      try {
        msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (msg.context !== 'player.js') return;
      if (msg.event === 'ready') ['timeupdate', 'pause', 'ended'].forEach((ev) => send('addEventListener', ev));
      if (msg.event === 'timeupdate' && typeof msg.value?.seconds === 'number') {
        position = Math.floor(msg.value.seconds);
        watched = Math.max(watched, position);
        if (Date.now() - lastSave >= SAVE_EVERY_MS) {
          lastSave = Date.now();
          void save({ positionSeconds: position, watchedSeconds: watched });
        }
      }
      if (msg.event === 'pause') void save({ positionSeconds: position, watchedSeconds: watched });
      if (msg.event === 'ended') void save({ positionSeconds: 0, watchedSeconds: watched, completed: true });
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [lessonId, trackProgress]);

  return (
    <iframe
      ref={frame}
      className="lp-video"
      src={src}
      title={title}
      loading="lazy"
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
    />
  );
}

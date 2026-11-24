import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthTopBar, LearnerShell } from '../components/layout/LearnerShell';
import { useAuth } from '../lib/auth';
import { certificateDownloadUrl, getDashboard, lessonPath, type Dashboard as DashboardData } from '../lib/learning';
import { courseThumb, learnerAssets } from '../lib/learnerAssets';
import './Dashboard.css';

/** "2026-10-02T…" → "2 October 2026" */
const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

function continueLabel(dash: DashboardData): string {
  if (!dash.continue) return 'Continue Learning';
  if (dash.continue.positionSeconds > 0) return 'Resume Learning';
  if (dash.courses.some((c) => c.lessonsCompleted)) return 'Continue Learning';
  return 'Start Learning';
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = c - (clamped / 100) * c;
  return (
    <div className="dsh-ring" role="img" aria-label={`${clamped}% overall completion`}>
      <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden>
        <circle className="dsh-ring-track" cx="60" cy="60" r={r} />
        <circle
          className="dsh-ring-fill"
          cx="60"
          cy="60"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <span className="dsh-ring-label">
        <strong>{clamped}%</strong>
        <small>Complete</small>
      </span>
    </div>
  );
}

/** /dashboard: the signed-in student's courses, progress, "continue learning" and certificates. */
export function Dashboard() {
  const auth = useAuth();
  const userId = auth.user?.id;
  const [data, setData] = useState<{ for: string; value: DashboardData | 'error' } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    getDashboard()
      .then((d) => live && setData({ for: userId, value: d }))
      .catch(() => live && setData({ for: userId, value: 'error' }));
    return () => {
      live = false;
    };
  }, [userId]);

  const dash = auth.user && data?.for === auth.user.id ? data.value : null;
  const showUpgrade = !auth.user || dash === null || dash === 'error' ? true : !dash.hasActiveEnrollment;

  const stats = useMemo(() => {
    if (!dash || dash === 'error') {
      return { enrolled: 0, inProgress: 0, completed: 0, certificates: 0, ringPct: 0 };
    }
    const enrolled = dash.courses.length;
    const inProgress = dash.courses.filter((c) => c.progressPct > 0 && c.progressPct < 100).length;
    const completed = dash.courses.filter((c) => c.progressPct === 100).length;
    const certificates = dash.certificates.length;
    const lessonsTotal = dash.courses.reduce((n, c) => n + c.lessonsTotal, 0);
    const lessonsCompleted = dash.courses.reduce((n, c) => n + c.lessonsCompleted, 0);
    const ringPct = lessonsTotal ? Math.round((lessonsCompleted / lessonsTotal) * 100) : 0;
    return { enrolled, inProgress, completed, certificates, ringPct, lessonsTotal, lessonsCompleted };
  }, [dash]);

  if (!auth.loaded) {
    return (
      <div className="dsh-gate">
        <AuthTopBar />
        <div className="dsh-gate-body" aria-busy="true">
          <div className="dsh-loading" />
        </div>
      </div>
    );
  }

  if (!auth.user) {
    return (
      <div className="dsh-gate">
        <AuthTopBar />
        <section className="dsh-gate-body">
          <div className="dsh-empty account-glass">
            <h2>{auth.unavailable ? 'The training portal is unavailable right now' : 'Log in to see your courses'}</h2>
            <p>{auth.unavailable ? 'Please try again later.' : 'Your progress and certificates are saved to your account.'}</p>
            {!auth.unavailable ? (
              <Link className="btn btn-primary" to="/account">
                Log in
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <LearnerShell title="My Learning" showUpgrade={showUpgrade}>
      {dash === null ? (
        <div aria-busy="true" className="dsh-loading" />
      ) : dash === 'error' ? (
        <div className="dsh-empty account-glass">
          <h2>Your dashboard couldn&apos;t be loaded</h2>
          <p>Please refresh the page or try again in a moment.</p>
        </div>
      ) : !dash.courses.length ? (
        <div className="dsh-empty account-glass">
          <img src={learnerAssets.iconGraduation} alt="" width={52} height={52} />
          <h2>You don&apos;t have course access yet</h2>
          <p>Get the Professional Plan to unlock every training track, with lifetime access and updates.</p>
          <div className="dsh-actions">
            <Link className="btn btn-primary" to="/pricing">
              Get Professional Plan
            </Link>
            <Link className="btn btn-ghost" to="/training">
              Explore training
            </Link>
          </div>
        </div>
      ) : (
        <div className="dsh">
          <article className="dsh-hero account-glass">
            <div className="dsh-hero-copy">
              <p className="dsh-kicker">Welcome back</p>
              <h2>Welcome Back, {auth.user.firstName} 👋</h2>
              <p className="dsh-muted">
                {dash.continue
                  ? `Pick up “${dash.continue.lessonTitle}” where you left off.`
                  : 'Your courses, progress and certificates are ready.'}
              </p>
              {dash.continue ? (
                <Link
                  className="btn btn-primary dsh-hero-cta"
                  to={lessonPath(dash.continue.courseSlug, dash.continue.moduleSlug, dash.continue.lessonSlug)}
                >
                  {continueLabel(dash)} <span aria-hidden>→</span>
                </Link>
              ) : (
                <a className="btn btn-primary dsh-hero-cta" href="#courses">
                  View Courses <span aria-hidden>→</span>
                </a>
              )}
            </div>
            <img className="dsh-hero-art" src={learnerAssets.hardDrive} alt="" width={280} height={200} />
          </article>

          <div className="dsh-stats">
            <div className="dsh-stat account-glass">
              <img src={learnerAssets.iconCourses} alt="" width={22} height={22} />
              <div>
                <strong>{stats.enrolled}</strong>
                <span>Enrolled Courses</span>
              </div>
            </div>
            <div className="dsh-stat account-glass">
              <img src={learnerAssets.iconProgress} alt="" width={22} height={22} />
              <div>
                <strong>{stats.inProgress}</strong>
                <span>In Progress</span>
              </div>
            </div>
            <div className="dsh-stat account-glass">
              <img src={learnerAssets.iconCheck} alt="" width={22} height={22} />
              <div>
                <strong>{stats.completed}</strong>
                <span>Completed</span>
              </div>
            </div>
            <div className="dsh-stat account-glass">
              <img src={learnerAssets.iconCertificate} alt="" width={22} height={22} />
              <div>
                <strong>{stats.certificates}</strong>
                <span>Certificates</span>
              </div>
            </div>
          </div>

          <section id="courses" className="dsh-section">
            <div className="dsh-section-head">
              <h2 className="dsh-heading">My Courses</h2>
              <a className="dsh-view-all" href="#courses">
                View All
              </a>
            </div>
            <div className="dsh-grid">
              {dash.courses.map((c, i) => (
                <article key={c.slug} className="dsh-course account-glass">
                  <img className="dsh-course-thumb" src={courseThumb(i)} alt="" width={72} height={72} />
                  <div className="dsh-course-body">
                    <h3>
                      <Link to={`/training/${c.slug}`}>{c.title}</Link>
                    </h3>
                    <span
                      className="dsh-bar"
                      role="progressbar"
                      aria-valuenow={c.progressPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${c.title} progress`}
                    >
                      <span style={{ width: `${c.progressPct}%` }} />
                    </span>
                    <p className="dsh-muted">
                      {c.lessonsCompleted} of {c.lessonsTotal} lessons · {c.progressPct}%
                    </p>
                  </div>
                  {c.next ? (
                    <Link
                      className="dsh-play"
                      to={lessonPath(c.slug, c.next.moduleSlug, c.next.lessonSlug)}
                      aria-label={`${c.lessonsCompleted ? 'Continue' : 'Start'} ${c.title}`}
                    >
                      <img src={learnerAssets.iconPlay} alt="" width={22} height={22} />
                    </Link>
                  ) : (
                    <Link className="dsh-play" to={`/training/${c.slug}`} aria-label={`Review ${c.title}`}>
                      <img src={learnerAssets.iconCheck} alt="" width={22} height={22} />
                    </Link>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section id="progress" className="dsh-section dsh-progress-block account-glass">
            <h2 className="dsh-heading">My Progress</h2>
            <div className="dsh-progress-row">
              <ProgressRing pct={stats.ringPct} />
              <div className="dsh-progress-stats">
                <div>
                  <strong>{stats.inProgress}</strong>
                  <span>Courses In Progress</span>
                </div>
                <div>
                  <strong>{stats.completed}</strong>
                  <span>Courses Completed</span>
                </div>
                <div>
                  <strong>
                    {stats.lessonsCompleted ?? 0}/{stats.lessonsTotal ?? 0}
                  </strong>
                  <span>Lessons Completed</span>
                </div>
              </div>
            </div>
          </section>

          {(() => {
            const focus =
              dash.continue != null
                ? dash.courses.find((c) => c.slug === dash.continue!.courseSlug)
                : dash.courses.find((c) => c.progressPct > 0 && c.progressPct < 100) ?? dash.courses[0];
            if (!focus || focus.progressPct >= 100) return null;
            const remaining = Math.max(0, focus.lessonsTotal - focus.lessonsCompleted);
            return (
              <aside className="dsh-milestone account-glass">
                <img src={learnerAssets.iconTrophy} alt="" width={28} height={28} />
                <div className="dsh-milestone-copy">
                  <p className="dsh-kicker">Your Next Milestone</p>
                  <p>
                    Complete {remaining} more lesson{remaining === 1 ? '' : 's'} in <strong>{focus.title}</strong> toward
                    your certificate.
                  </p>
                  <span
                    className="dsh-bar"
                    role="progressbar"
                    aria-valuenow={focus.progressPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span style={{ width: `${focus.progressPct}%` }} />
                  </span>
                </div>
                <span className="dsh-milestone-pct">{focus.progressPct}%</span>
              </aside>
            );
          })()}

          <section id="certificates" className="dsh-section">
            <h2 className="dsh-heading">Certificates</h2>
            {dash.certificates.length ? (
              <ul className="dsh-certs">
                {dash.certificates.map((cert) => (
                  <li key={cert.code} className="account-glass">
                    <img src={learnerAssets.iconCertificate} alt="" width={28} height={28} />
                    <span>
                      <strong>{cert.programTitle}</strong>
                      <small>
                        {cert.code} · issued {longDate(cert.issuedAt)}
                      </small>
                    </span>
                    <span className="dsh-cert-actions">
                      <a className="btn btn-primary dsh-cert-download" href={certificateDownloadUrl(cert.code)} download>
                        Download PDF
                      </a>
                      <Link to={`/verify-certificate?code=${cert.code}`}>Verify</Link>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dsh-muted">Certificates appear here when you complete a training program.</p>
            )}
          </section>
        </div>
      )}
    </LearnerShell>
  );
}

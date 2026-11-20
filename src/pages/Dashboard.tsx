import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHero } from '../components/ui/PageHero';
import { useAuth } from '../lib/auth';
import { icons } from '../lib/icons';
import { getDashboard, lessonPath, type Dashboard as DashboardData } from '../lib/learning';
import './Dashboard.css';

/** "2026-10-02T…" → "2 October 2026" */
const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

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

  const hero = <PageHero crumbs={[{ label: 'My Learning' }]} title="My Learning" sub={auth.user ? `Hi ${auth.user.firstName}, pick up where you left off.` : 'Your courses, progress and certificates.'} />;

  if (!auth.loaded) return <div>{hero}<div className="section container" aria-busy="true" /></div>;
  if (!auth.user) {
    return (
      <div>
        {hero}
        <section className="section">
          <div className="container dsh-empty">
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

  const dash = data?.for === auth.user.id ? data.value : null;

  return (
    <div>
      {hero}
      <section className="section">
        <div className="container dsh">
          {dash === null ? (
            <div aria-busy="true" className="dsh-loading" />
          ) : dash === 'error' ? (
            <div className="dsh-empty">
              <h2>Your dashboard couldn&apos;t be loaded</h2>
              <p>Please refresh the page or try again in a moment.</p>
            </div>
          ) : !dash.courses.length ? (
            <div className="dsh-empty">
              <img src={icons.school} alt="" width={52} height={52} />
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
            <>
              {dash.continue ? (
                <article className="dsh-continue">
                  <img src={icons.play} alt="" width={40} height={40} />
                  <div>
                    <p className="dsh-kicker">Continue learning</p>
                    <h2>{dash.continue.lessonTitle}</h2>
                    <p className="dsh-muted">{dash.courses.find((c) => c.slug === dash.continue!.courseSlug)?.title}</p>
                  </div>
                  <Link className="btn btn-primary" to={lessonPath(dash.continue.courseSlug, dash.continue.moduleSlug, dash.continue.lessonSlug)}>
                    {dash.continue.positionSeconds > 0 ? 'Resume' : dash.courses.some((c) => c.lessonsCompleted) ? 'Continue' : 'Start'} <span aria-hidden>→</span>
                  </Link>
                </article>
              ) : null}

              <h2 className="dsh-heading">Your courses</h2>
              <div className="dsh-grid">
                {dash.courses.map((c) => (
                  <article key={c.slug} className="dsh-course">
                    <h3>
                      <Link to={`/training/${c.slug}`}>{c.title}</Link>
                    </h3>
                    <span className="dsh-bar" role="progressbar" aria-valuenow={c.progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.title} progress`}>
                      <span style={{ width: `${c.progressPct}%` }} />
                    </span>
                    <p className="dsh-muted">
                      {c.lessonsCompleted} of {c.lessonsTotal} lessons · {c.progressPct}%
                    </p>
                    {c.next ? (
                      <Link className="btn btn-ghost dsh-course-btn" to={lessonPath(c.slug, c.next.moduleSlug, c.next.lessonSlug)}>
                        {c.lessonsCompleted ? 'Continue' : 'Start'} <span aria-hidden>→</span>
                      </Link>
                    ) : (
                      <Link className="btn btn-ghost dsh-course-btn" to={`/training/${c.slug}`}>
                        ✓ Completed: review
                      </Link>
                    )}
                  </article>
                ))}
              </div>

              <h2 className="dsh-heading">Certificates</h2>
              {dash.certificates.length ? (
                <ul className="dsh-certs">
                  {dash.certificates.map((cert) => (
                    <li key={cert.code}>
                      <img src={icons.award} alt="" width={28} height={28} />
                      <span>
                        <strong>{cert.programTitle}</strong>
                        <small>
                          {cert.code} · issued {longDate(cert.issuedAt)}
                        </small>
                      </span>
                      <Link to={`/verify-certificate?code=${cert.code}`}>Verify</Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dsh-muted">Certificates appear here when you complete a training program.</p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

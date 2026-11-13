import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { LEAD_REASONS } from '../../../../shared/leads';
import { ApiError } from '../../../lib/api';
import { timeAgo } from '../../../lib/demoVideos';
import { useAdminSession } from '../../auth/adminSessionContext';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi, type DashboardData } from '../../lib/adminApi';
import './DashboardPage.css';

const inr = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);
const num = (n: number) => n.toLocaleString('en-IN');

function endsIn(iso: string) {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  return days ? `${days}d ${hours}h left` : `${hours}h left`;
}

function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'warn' | 'bad' }) {
  return (
    <article className={`adm-kpi${tone ? ` adm-kpi--${tone}` : ''}`}>
      <p className="adm-kpi-label">{label}</p>
      <p className="adm-kpi-value">{value}</p>
      {hint ? <p className="adm-kpi-hint">{hint}</p> : null}
    </article>
  );
}

/** /admin — role-aware overview (widgets the role can't open are never sent by the API). */
export function DashboardPage() {
  const { me } = useAdminSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);

  const fetchDashboard = useCallback(
    () =>
      adminApi.dashboard().then(
        (d) => {
          setData(d);
          setError(null);
        },
        (err: unknown) =>
          setError({ message: 'The dashboard could not be loaded.', requestId: err instanceof ApiError ? err.requestId : undefined }),
      ),
    [],
  );

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const retry = () => {
    setError(null);
    void fetchDashboard();
  };

  if (error) return <ErrorState message={error.message} requestId={error.requestId} onRetry={retry} />;

  return (
    <div className="adm-dash">
      <p className="adm-dash-hello">
        Welcome, {me?.user.firstName}. Here&apos;s today&apos;s picture.
      </p>

      {!data ? (
        <div className="adm-kpis">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="adm-kpis">
            {data.leads ? (
              <>
                <Kpi label="New leads" value={num(data.leads.new)} hint="Waiting for first contact" tone={data.leads.new ? 'warn' : undefined} />
                <Kpi label="Leads, last 7 days" value={num(data.leads.last7Days)} hint={`${num(data.leads.total)} in total`} />
              </>
            ) : null}
            {data.students ? <Kpi label="Students" value={num(data.students.total)} hint={`${num(data.students.last7Days)} joined this week`} /> : null}
            {data.pricing ? (
              <Kpi
                label={data.pricing.plan}
                value={inr(data.pricing.effectivePricePaise)}
                hint={data.pricing.promotion ? `${data.pricing.promotion.label} · ${endsIn(data.pricing.promotion.endsAt)}` : 'No sale running'}
              />
            ) : null}
            {data.content ? (
              <>
                <Kpi
                  label="Lessons with video"
                  value={`${num(data.content.lessonsWithVideo)} / ${num(data.content.lessons)}`}
                  hint={`${num(data.content.tracks)} published tracks`}
                  tone={data.content.lessonsWithVideo < data.content.lessons ? 'warn' : undefined}
                />
                <Kpi
                  label="Blog posts"
                  value={num(data.content.blogPosts)}
                  hint={data.content.blogPostsExcerptOnly ? `${data.content.blogPostsExcerptOnly} still only an excerpt` : 'All written'}
                  tone={data.content.blogPostsExcerptOnly ? 'warn' : undefined}
                />
              </>
            ) : null}
            {data.demoVideos ? <Kpi label="Demo video views" value={num(data.demoVideos.totalViews)} hint={`${data.demoVideos.published} videos`} /> : null}
            {data.email ? (
              <Kpi
                label="Email delivery"
                value={data.email.failed ? `${data.email.failed} failed` : 'Healthy'}
                hint={`${num(data.email.queued)} queued`}
                tone={data.email.failed ? 'bad' : undefined}
              />
            ) : null}
          </div>

          {data.leads ? (
            <section className="adm-card">
              <h2>Recent leads</h2>
              {data.leads.recent.length ? (
                <ul className="adm-recent">
                  {data.leads.recent.map((l) => (
                    <li key={l.id}>
                      <span>
                        <strong>{l.name ?? l.phone ?? 'Unknown'}</strong>
                        <small>
                          {l.source === 'callback' ? 'Callback request' : (LEAD_REASONS.find((r) => r.value === l.reason)?.label ?? 'Contact form')}
                        </small>
                      </span>
                      <span className={`adm-badge adm-badge--${l.status}`}>{l.status}</span>
                      <time dateTime={l.createdAt}>{timeAgo(l.createdAt)}</time>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState>No leads yet. They appear here when someone submits the contact or callback form.</EmptyState>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

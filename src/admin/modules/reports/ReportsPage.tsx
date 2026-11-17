import { useState } from 'react';
import { NavLink, Navigate, useLocation, useParams } from 'react-router-dom';
import { LEAD_REASONS, LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from '../../../../shared/leads';
import type { LeadStatus } from '../../../../shared/leads';
import { REPORT_ACCESS, REPORT_TYPES, type ReportInterval, type ReportType } from '../../../../shared/reports';
import { useAdminSession } from '../../auth/adminSessionContext';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import type { ReportData } from '../../lib/adminApi';
import { countryName } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import { useTableState } from '../../lib/useTableState';
import { CATEGORY_LABEL } from '../demos/demoDisplay';
import { SOURCE_LABEL } from '../enrollments/enrollmentDisplay';
import { BreakdownBars, ColumnChart } from './ColumnChart';
import './Reports.css';

const PRESETS: { id: string; label: string; days: number; interval: ReportInterval }[] = [
  { id: '7d', label: 'Last 7 days', days: 7, interval: 'day' },
  { id: '30d', label: 'Last 30 days', days: 30, interval: 'day' },
  { id: '90d', label: 'Last 90 days', days: 90, interval: 'week' },
  { id: '12m', label: 'Last 12 months', days: 365, interval: 'month' },
];
const RANGE_KEYS = ['preset', 'from', 'to', 'interval'] as const;

const todayIst = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const minusDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
const num = (n: number | undefined) => (n ?? 0).toLocaleString('en-IN');
const reasonLabel = (k: string) => LEAD_REASONS.find((r) => r.value === k)?.label ?? (k === 'unknown' ? 'Not given' : k);

/** /admin/reports[/:type] — read-only trends. Only tabs for modules the role can open are shown. */
export function ReportsPage() {
  const { can } = useAdminSession();
  const { type } = useParams();
  const allowed = REPORT_TYPES.filter((t) => REPORT_ACCESS[t].anyOf.some((p) => can(p)));
  if (!allowed.length) {
    return (
      <EmptyState>
        <p>There are no reports for your role yet. Revenue reports arrive with online payments.</p>
      </EmptyState>
    );
  }
  if (!type || !allowed.includes(type as ReportType)) return <Navigate to={`/admin/reports/${allowed[0]}`} replace />;
  return <Report key={type} type={type as ReportType} allowed={allowed} />;
}

function Report({ type, allowed }: { type: ReportType; allowed: ReportType[] }) {
  const { can } = useAdminSession();
  const { search } = useLocation();
  const table = useTableState(RANGE_KEYS);
  const v = table.values;
  const preset = PRESETS.find((p) => p.id === (v.preset ?? (v.from ? undefined : '30d')));
  const to = preset ? todayIst() : (v.to ?? todayIst());
  const from = preset ? minusDays(to, preset.days - 1) : (v.from ?? minusDays(to, 29));
  const interval = (v.interval as ReportInterval | undefined) ?? preset?.interval ?? 'day';
  const params = { from, to, interval };
  const report = useResource(`${type}:${JSON.stringify(params)}`, () => adminApi.reports.get(type, params));
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);
  const dated = type !== 'content';
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;

  return (
    <div>
      <nav className="adm-tabs" aria-label="Reports">
        {allowed.map((t) => (
          <NavLink key={t} to={`/admin/reports/${t}${search}`}>
            {REPORT_ACCESS[t].label}
          </NavLink>
        ))}
      </nav>

      <div className="adm-filters adm-report-controls">
        {dated ? (
          <>
            <label>
              Period
              <select
                className="adm-select"
                value={preset?.id ?? 'custom'}
                onChange={(e) =>
                  e.target.value === 'custom' ? table.update({ preset: undefined, from, to, interval }) : table.update({ preset: e.target.value, from: undefined, to: undefined, interval: undefined })
                }
              >
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
            </label>
            {!preset ? (
              <>
                <label>
                  From
                  <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} onBlur={() => customFrom && table.update({ from: customFrom })} />
                </label>
                <label>
                  To
                  <input type="date" value={customTo} min={customFrom} max={todayIst()} onChange={(e) => setCustomTo(e.target.value)} onBlur={() => customTo && table.update({ to: customTo })} />
                </label>
              </>
            ) : null}
            <label>
              Group by
              <select className="adm-select" value={interval} onChange={(e) => table.update({ interval: e.target.value }, { keepPage: true })}>
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </label>
          </>
        ) : null}
        {can('reports.export') ? (
          <div className="adm-filters-actions">
            <a className="adm-btn" href={adminApi.reports.exportUrl(type, dated ? params : {})} download>
              Export CSV
            </a>
          </div>
        ) : null}
      </div>
      {dated && interval === 'day' && days > 120 ? <p className="adm-muted adm-small">Tip: group by week or month for long periods; daily columns get very thin.</p> : null}

      {report.error && !report.data ? (
        <ErrorState message={report.error.status === 400 ? report.error.message : 'The report could not be loaded.'} requestId={report.error.requestId} onRetry={report.reload} />
      ) : !report.data ? (
        <Skeleton height={360} />
      ) : (
        <div className={report.loading ? 'adm-report is-loading' : 'adm-report'}>
          <ReportBody type={type} r={report.data} />
        </div>
      )}
    </div>
  );
}

function Tiles({ items }: { items: [string, string, string?][] }) {
  return (
    <div className="adm-report-tiles">
      {items.map(([label, value, hint]) => (
        <div key={label} className="adm-panel adm-report-tile">
          <span className="adm-muted adm-small">{label}</span>
          <strong>{value}</strong>
          {hint ? <span className="adm-muted adm-small">{hint}</span> : null}
        </div>
      ))}
    </div>
  );
}

function ReportBody({ type, r }: { type: ReportType; r: ReportData }) {
  const t = r.totals;
  const b = r.breakdowns;
  const chart = r.series && r.range ? <ColumnChart title={r.series.label} points={r.series.points} interval={r.range.interval} unit={type === 'leads' ? 'Leads' : type === 'students' ? 'Sign-ups' : 'Grants'} unitOne={type === 'leads' ? 'lead' : type === 'students' ? 'sign-up' : 'grant'} /> : null;

  if (type === 'leads') {
    return (
      <>
        <Tiles items={[['Leads', num(t.leads), 'spam excluded'], ['Converted', num(t.converted)], ['Conversion', `${t.conversionPct ?? 0}%`, 'converted ÷ leads'], ['Spam', num(t.spam)]]} />
        {chart}
        <div className="adm-report-grid">
          <BreakdownBars title="By source" items={b.source ?? []} label={(k) => LEAD_SOURCE_LABELS[k] ?? k} />
          <BreakdownBars title="By reason" items={b.reason ?? []} label={reasonLabel} />
          <BreakdownBars title="By status (now)" items={b.status ?? []} label={(k) => LEAD_STATUS_LABELS[k as LeadStatus] ?? k} note="Leads from this period, by their current status." />
        </div>
      </>
    );
  }
  if (type === 'students') {
    return (
      <>
        <Tiles items={[['New students', num(t.signups)], ['Email verified', num(t.verified)], ['Verified', `${t.verifiedPct ?? 0}%`]]} />
        {chart}
        <div className="adm-report-grid">
          <BreakdownBars title="By country" items={b.country ?? []} label={(k) => (k === 'other' ? 'Other countries' : countryName(k))} />
        </div>
      </>
    );
  }
  if (type === 'enrollments') {
    return (
      <>
        <Tiles items={[['Access granted', num(t.granted), 'in this period'], ['Revoked', num(t.revoked), 'in this period'], ['Active now', num(t.activeNow), 'today, all time']]} />
        {chart}
        <div className="adm-report-grid">
          <BreakdownBars title="Granted by type" items={b.source ?? []} label={(k) => SOURCE_LABEL[k as keyof typeof SOURCE_LABEL] ?? k} note="Purchases appear once online payments are live." />
        </div>
      </>
    );
  }
  return (
    <>
      {r.note ? <p className="adm-muted adm-small">{r.note}</p> : null}
      <Tiles
        items={[
          ...(t.demoViews !== undefined ? ([['Demo video views', num(t.demoViews), 'since launch']] as [string, string, string][]) : []),
          ...(t.publishedLessons !== undefined
            ? ([
                ['Lessons with video', `${num(t.lessonsWithVideo)} / ${num(t.publishedLessons)}`, 'published lessons'],
                ['Free previews', num(t.freePreviews)],
              ] as [string, string, string?][])
            : []),
        ]}
      />
      <div className="adm-report-grid">
        {b.demoViews ? <BreakdownBars title="Most-watched demo videos" items={b.demoViews} label={(k) => k} /> : null}
        {b.demoViewsByCategory ? <BreakdownBars title="Demo views by category" items={b.demoViewsByCategory} label={(k) => CATEGORY_LABEL[k as keyof typeof CATEGORY_LABEL] ?? k} /> : null}
        {b.lessonsWithVideo ? <BreakdownBars title="Lessons with video, per track" items={b.lessonsWithVideo} label={(k) => k} note="Videos are added once video hosting (Bunny) is set up." /> : null}
      </div>
    </>
  );
}

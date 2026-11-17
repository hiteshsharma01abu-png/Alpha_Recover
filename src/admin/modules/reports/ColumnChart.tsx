import { useState } from 'react';
import type { ReportInterval } from '../../../../shared/reports';

const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const month = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Bucket key (YYYY-MM-DD) → "2 Nov", "Week of 2 Nov", "Nov 2026". */
function bucketLabel(bucket: string, interval: ReportInterval, long = false) {
  const d = new Date(`${bucket}T00:00:00Z`);
  if (interval === 'month') return month.format(d);
  return interval === 'week' && long ? `Week of ${day.format(d)}` : day.format(d);
}

/** A clean axis top: 1, 2, 5 × 10ⁿ at or above the max. */
function niceMax(max: number) {
  if (max <= 4) return Math.max(max, 1);
  const p = 10 ** Math.floor(Math.log10(max));
  return [1, 2, 5, 10].map((m) => m * p).find((v) => v >= max)!;
}

/**
 * Single-series column chart (one hue, so no legend: the title names the series). Thin 4px-rounded
 * columns on one baseline, recessive axis, hover/focus tooltip per column, and a table view.
 */
export function ColumnChart({
  title,
  points,
  interval,
  unit,
  unitOne,
}: {
  title: string;
  points: { bucket: string; count: number }[];
  interval: ReportInterval;
  /** Column heading and plural, e.g. "Leads"; `unitOne` is the singular ("lead"). */
  unit: string;
  unitOne: string;
}) {
  const noun = (n: number) => (n === 1 ? unitOne : unit.toLowerCase());
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = niceMax(Math.max(0, ...points.map((p) => p.count)));
  const total = points.reduce((n, p) => n + p.count, 0);
  // Label at most ~8 columns along the bottom so the dates never collide.
  const every = Math.max(1, Math.ceil(points.length / 8));

  return (
    <figure className="adm-chart">
      <figcaption className="adm-chart-head">
        <span>
          <strong>{title}</strong>
          <span className="adm-muted adm-small">
            {' '}
            · {total.toLocaleString('en-IN')} in total, per {interval}
          </span>
        </span>
        <button type="button" className="adm-btn" onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Show chart' : 'Show as table'}
        </button>
      </figcaption>

      {asTable ? (
        <div className="adm-chart-table">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">{interval === 'week' ? 'Week starting' : interval === 'month' ? 'Month' : 'Day'}</th>
                <th scope="col">{unit}</th>
              </tr>
            </thead>
            <tbody className="adm-static-rows">
              {points.map((p) => (
                <tr key={p.bucket}>
                  <td data-label="Period">{bucketLabel(p.bucket, interval)}</td>
                  <td data-label={unit}>{p.count.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="adm-chart-plot" onMouseLeave={() => setActive(null)}>
          <div className="adm-chart-axis" aria-hidden>
            <span>{max.toLocaleString('en-IN')}</span>
            <span>{(max / 2) % 1 ? '' : (max / 2).toLocaleString('en-IN')}</span>
            <span>0</span>
          </div>
          <div className="adm-chart-area">
            <div className="adm-chart-grid" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <ol className="adm-chart-cols" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
              {points.map((p, i) => (
                <li
                  key={p.bucket}
                  tabIndex={0}
                  aria-label={`${bucketLabel(p.bucket, interval, true)}: ${p.count} ${noun(p.count)}`}
                  className={active === i ? 'is-active' : undefined}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  <span className="adm-chart-bar" style={{ height: p.count ? `max(${(p.count / max) * 100}%, 3px)` : 0 }} />
                  {active === i ? (
                    <span className={`adm-chart-tip${i > points.length * 0.7 ? ' is-left' : ''}`} role="tooltip">
                      <span className="adm-chart-tip-value">
                        <strong>{p.count.toLocaleString('en-IN')}</strong> {noun(p.count)}
                      </span>
                      <span>{bucketLabel(p.bucket, interval, true)}</span>
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            <div className="adm-chart-x" aria-hidden style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
              {points.map((p, i) => (
                <span key={p.bucket}>{i % every === 0 ? bucketLabel(p.bucket, interval) : ''}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}

/** Horizontal bars for a breakdown (one hue; text in text colours, value at the bar tip). */
export function BreakdownBars({ title, items, label, note }: { title: string; items: { key: string; count: number; of?: number }[]; label: (key: string) => string; note?: string }) {
  const max = Math.max(1, ...items.map((i) => i.of ?? i.count));
  return (
    <section className="adm-panel adm-breakdown">
      <h3>{title}</h3>
      {note ? <p className="adm-muted adm-small">{note}</p> : null}
      {items.length ? (
        <ul>
          {items.map((i) => (
            <li key={i.key}>
              <span className="adm-breakdown-label">{label(i.key)}</span>
              <span className="adm-breakdown-track" aria-hidden>
                <span className="adm-breakdown-bar" style={{ width: i.count ? `max(${(i.count / max) * 100}%, 3px)` : 0 }} />
              </span>
              <span className="adm-breakdown-value">
                {i.count.toLocaleString('en-IN')}
                {i.of !== undefined ? <span className="adm-muted"> / {i.of.toLocaleString('en-IN')}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="adm-muted">Nothing in this period.</p>
      )}
    </section>
  );
}

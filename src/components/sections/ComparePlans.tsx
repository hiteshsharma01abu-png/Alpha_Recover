import { comparePlans, compareGroups, type CompareValue } from '../../data/pricingCompare';
import { Reveal } from '../ui/Reveal';
import './ComparePlans.css';

function Value({ value }: { value: CompareValue }) {
  if (value === 'yes') {
    return (
      <span className="cmp-yes">
        <span className="cmp-check" aria-hidden />
        Included
      </span>
    );
  }
  if (value === 'soon') return <span className="cmp-soon">Coming soon</span>;
  return (
    <span className="cmp-no">
      <span aria-hidden>—</span>
      <span className="cmp-sr">Not included</span>
    </span>
  );
}

/**
 * Pricing "Compare Plans": a grid table on desktop/tablet (Professional column highlighted),
 * and one accordion per category on phones (<details>, so it works before hydration).
 */
export function ComparePlans() {
  return (
    <Reveal as="section" className="cmp" id="pricing-compare">
      <div className="container">
        <header className="cmp-head">
          <h2 id="cmp-title">Compare Plans</h2>
          <p>Choose the right learning path for your recovery journey.</p>
        </header>

        <div className="cmp-card">
          <div className="cmp-table" role="table" aria-labelledby="cmp-title">
            <span className="cmp-highlight" aria-hidden>
              <span className="cmp-popular">Most Popular</span>
            </span>

            <div className="cmp-row cmp-row-head" role="row">
              <span className="cmp-feature" role="columnheader">
                Feature
              </span>
              {comparePlans.map((p) => (
                <span key={p.key} className="cmp-cell" role="columnheader">
                  {p.label}
                </span>
              ))}
            </div>

            {compareGroups.map((g) => (
              <div key={g.id} className="cmp-group" role="rowgroup">
                <div className="cmp-row cmp-band" role="row">
                  <span className="cmp-band-label" role="rowheader">
                    <img src={g.icon} alt="" width={22} height={22} decoding="async" />
                    {g.label}
                  </span>
                </div>
                {g.rows.map((r) => (
                  <div key={r.label} className="cmp-row" role="row">
                    <span className="cmp-feature" role="rowheader">
                      <img src={r.icon} alt="" width={20} height={20} loading="lazy" decoding="async" />
                      {r.label}
                    </span>
                    {comparePlans.map((p) => (
                      <span key={p.key} className="cmp-cell" role="cell">
                        <Value value={r[p.key]} />
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="cmp-accordion">
            {compareGroups.map((g) => (
              <details key={g.id} className="cmp-acc">
                <summary>
                  <img src={g.mobileIcon} alt="" width={28} height={28} decoding="async" />
                  <span>{g.label.replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                  <svg className="cmp-chev" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                    <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <ul className="cmp-acc-list">
                  {g.rows.map((r) => (
                    <li key={r.label}>
                      <p className="cmp-acc-feature">
                        <img src={r.icon} alt="" width={18} height={18} loading="lazy" decoding="async" />
                        {r.label}
                      </p>
                      <dl className="cmp-acc-plans">
                        {comparePlans.map((p) => (
                          <div key={p.key} className={p.key === 'professional' ? 'is-popular' : undefined}>
                            <dt>{p.label}</dt>
                            <dd>
                              <Value value={r[p.key]} />
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

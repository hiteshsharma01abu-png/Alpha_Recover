import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  faqCategories,
  pricingFaqs,
  type FaqCategoryId,
} from '../../data/pricingPlans';
import './PricingFaq.css';

function renderAnswer(text: string) {
  const parts = text.split(/(\/refund-policy)/g);
  return parts.map((part, i) =>
    part === '/refund-policy' ? (
      <Link key={i} to="/refund-policy">
        refund policy
      </Link>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function PricingFaq() {
  const baseId = useId();
  const [category, setCategory] = useState<FaqCategoryId>('general');
  const [openId, setOpenId] = useState<string | null>(null);
  const items = pricingFaqs.filter((item) => item.category === category);

  useEffect(() => {
    if (!openId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenId(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  function onTab(next: FaqCategoryId) {
    setCategory(next);
    setOpenId(null);
  }

  return (
    <section className="pfq" aria-labelledby={`${baseId}-title`}>
      <div className="container pfq-shell">
        <header className="pfq-head">
          <p className="pfq-eyebrow">Have questions?</p>
          <h2 id={`${baseId}-title`}>Frequently Asked Questions</h2>
          <p>Everything you need to know before starting your data recovery training.</p>
        </header>

        <div className="pfq-tabs" role="tablist" aria-label="FAQ categories">
          {faqCategories.map((tab) => {
            const selected = tab.id === category;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`${baseId}-tab-${tab.id}`}
                className={`pfq-tab${selected ? ' is-active' : ''}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => onTab(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`${baseId}-panel-${category}`}
          aria-labelledby={`${baseId}-tab-${category}`}
          className="pfq-list"
        >
          {items.map((item) => {
            const panelId = `${baseId}-a-${item.id}`;
            const triggerId = `${baseId}-q-${item.id}`;
            const open = openId === item.id;
            return (
              <div key={item.id} className={`pfq-item${open ? ' is-open' : ''}`}>
                <button
                  type="button"
                  id={triggerId}
                  className="pfq-trigger"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenId(open ? null : item.id)}
                >
                  <span className="pfq-q">{item.question}</span>
                  <span className="pfq-icon" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2.5 4.25 6 7.75l3.5-3.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  className="pfq-panel"
                  hidden={!open}
                >
                  <p className="pfq-a">
                    {item.answer.includes('/refund-policy')
                      ? renderAnswer(item.answer)
                      : item.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

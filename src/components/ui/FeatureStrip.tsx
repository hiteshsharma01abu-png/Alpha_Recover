import type { CSSProperties } from 'react';
import type { FeatureItem } from '../../data/pageContent';
import './FeatureStrip.css';

/** Bordered row of icon + title (+ text) highlights at the bottom of inner pages. */
export function FeatureStrip({ items }: { items: FeatureItem[] }) {
  return (
    <ul className="fs" style={{ '--fs-cols': items.length } as CSSProperties}>
      {items.map((f) => (
        <li key={f.title} className="fs-item">
          <img src={f.icon} alt="" width={34} height={34} decoding="async" />
          <span>
            <strong>{f.title}</strong>
            {f.text ? <small>{f.text}</small> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

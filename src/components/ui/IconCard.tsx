import { Link } from 'react-router-dom';
import type { IconCardItem } from '../../data/pageContent';
import './IconCard.css';

/** Glass card with an icon tile, title, text and a mint pill link; laid out in `.ic-grid`. */
export function IconCard({ item }: { item: IconCardItem }) {
  return (
    <article className="ic">
      <span className="ic-tile" aria-hidden>
        <img src={item.icon} alt="" width={38} height={38} decoding="async" />
      </span>
      <div className="ic-body">
        <h2>{item.title}</h2>
        <p>{item.text}</p>
        <Link className="ic-cta" to={item.to}>
          {item.cta}
          <span className="ic-sr">: {item.title}</span>
          <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}

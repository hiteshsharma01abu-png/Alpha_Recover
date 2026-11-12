import { Link } from 'react-router-dom';
import { industries } from '../data/content';
import './SimplePages.css';

export function Industries() {
  return (
    <div>
      <div className="page-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <span>Industries</span>
          </div>
          <h1>Industries</h1>
        </div>
      </div>
      <section className="section">
        <div className="container grid-3">
          {industries.map((i) => (
            <article key={i.title} className="panel">
              <h2>{i.title}</h2>
              <p>{i.text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

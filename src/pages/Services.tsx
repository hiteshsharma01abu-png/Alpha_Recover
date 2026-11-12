import { Link } from 'react-router-dom';
import { services } from '../data/content';
import './SimplePages.css';

export function Services() {
  return (
    <div>
      <div className="page-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <span>Services</span>
          </div>
          <h1>Services</h1>
        </div>
      </div>
      <section className="section">
        <div className="container">
          <div className="list-grid">
            {services.map((s) => (
              <article key={s} className="panel list-item">
                <h2>{s}</h2>
                <p>Book a diagnosis or ask for remote assistance on WhatsApp.</p>
                <Link to="/contact">Request service</Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

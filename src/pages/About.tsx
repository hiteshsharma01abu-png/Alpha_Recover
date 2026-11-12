import { Link } from 'react-router-dom';
import { company } from '../data/content';
import './SimplePages.css';

export function About() {
  return (
    <div>
      <div className="page-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <span>About Us</span>
          </div>
          <h1>About Us</h1>
        </div>
      </div>
      <section className="section">
        <div className="container prose">
          <h2>About {company.name}</h2>
          <p>
            {company.name} is building a practical data recovery school and service desk from{' '}
            {company.address}. We train technicians on logical, electrical, mechanical, and
            firmware failures — then support them remotely when a live case gets stuck.
          </p>
          <h2>Services and training</h2>
          <p>
            Students get lifetime portal access, case study videos, and WhatsApp technical help.
            Clients get recovery for HDD, SSD, flash, mobile, CCTV/DVR, and encrypted volumes.
          </p>
          <h2>Why join</h2>
          <ul>
            <li>Training based on real bench cases, not slide-only theory</li>
            <li>Curriculum from basics to MRT-level firmware work</li>
            <li>Service backup when your shop needs advanced tooling</li>
            <li>Focus on safe imaging habits and client data privacy</li>
          </ul>
          <Link className="btn btn-primary" to="/contact">
            Talk to us
          </Link>
        </div>
      </section>
    </div>
  );
}

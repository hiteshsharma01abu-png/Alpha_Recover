import { Link } from 'react-router-dom';
import { ProfessionalPlanSection } from '../components/ProfessionalPlanSection';
import './SimplePages.css';

export function Pricing() {
  return (
    <div>
      <div className="page-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <span>Pricing</span>
          </div>
          <h1>Pricing</h1>
        </div>
      </div>
      <ProfessionalPlanSection buyMode="checkout" hideHead />
      <div className="container">
        <p className="note">
          One-time payment unlocks lifetime portal access and future course updates. Certificate
          issued after course completion criteria are met.
        </p>
      </div>
    </div>
  );
}

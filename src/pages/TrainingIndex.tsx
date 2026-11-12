import { Link } from 'react-router-dom';
import { ProTrainingSection } from '../components/sections/ProTrainingSection';
import { TrainingSolutionsSection } from '../components/sections/TrainingSolutionsSection';

export function TrainingIndex() {
  return (
    <div>
      <div className="page-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <span>Training</span>
          </div>
          <h1>Training</h1>
        </div>
      </div>
      <TrainingSolutionsSection hideHead />
      <ProTrainingSection />
    </div>
  );
}


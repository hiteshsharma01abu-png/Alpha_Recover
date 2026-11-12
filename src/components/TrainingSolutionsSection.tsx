import { Reveal } from './Reveal';
import { TrainingExplorer } from './TrainingExplorer';
import '../pages/Home.css';

type TrainingSolutionsSectionProps = {
  /** Hide the section title block (use on /training where page-hero already titles the page). */
  hideHead?: boolean;
};

export function TrainingSolutionsSection({ hideHead = false }: TrainingSolutionsSectionProps) {
  return (
    <Reveal as="section" className="section training-section">
      <div className="training-deco" aria-hidden />
      <div className="container">
        {!hideHead ? (
          <div className="training-head">
            <span className="training-accent-bar" aria-hidden />
            <h2>
              Training <em>solutions</em>
            </h2>
            <p>Browse the same curriculum depth — open a track, pick a module, scan every lesson.</p>
          </div>
        ) : (
          <p className="training-page-lead">
            Browse the same curriculum depth — open a track, pick a module, scan every lesson.
          </p>
        )}
        <TrainingExplorer />
      </div>
    </Reveal>
  );
}

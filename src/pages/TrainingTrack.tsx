import { Link, useParams } from 'react-router-dom';
import { useTrainingTracksState } from '../lib/catalog';
import './SimplePages.css';

export function TrainingTrack() {
  const { trackId } = useParams();
  const { tracks, settled } = useTrainingTracksState();
  const track = tracks.find((t) => t.id === trackId);

  // A track added after this build exists only in the API: wait for it before saying "not found".
  if (!track && !settled) return <div className="section container" aria-busy="true" />;

  if (!track) {
    return (
      <div className="section container">
        <h1>Track not found</h1>
        <Link to="/training">All training</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="page-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <Link to="/training">Training</Link>
            <span>/</span>
            <span>{track.title}</span>
          </div>
          <h1>{track.title}</h1>
          <p className="hero-sub">{track.summary}</p>
        </div>
      </div>
      <section className="section">
        <div className="container track-modules">
          {track.modules.map((mod) => (
            <article key={mod.id} className="panel">
              <h2>{mod.title}</h2>
              <ol className="lesson-ol">
                {mod.lessons.map((lesson, i) => (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      onClick={() =>
                        alert(
                          'Lesson player unlocks after purchase + auth. Video CMS comes with backend.',
                        )
                      }
                    >
                      <span>{String(i + 1).padStart(2, '0')}</span>
                      {lesson.title}
                    </button>
                  </li>
                ))}
              </ol>
            </article>
          ))}
          <div className="track-cta">
            <Link className="btn btn-primary" to="/pricing">
              Get Professional Plan
            </Link>
            <Link className="btn btn-ghost" to="/account">
              Login to portal
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

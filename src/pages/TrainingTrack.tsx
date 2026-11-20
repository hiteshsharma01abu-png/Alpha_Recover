import type { CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHero } from '../components/ui/PageHero';
import { heroArt, trackPage } from '../data/pageContent';
import { useTrainingTracksState } from '../lib/catalog';
import { icons } from '../lib/icons';
import './TrainingTrack.css';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

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

  const lessonCount = track.modules.reduce((sum, m) => sum + m.lessons.length, 0);

  return (
    <div>
      <PageHero crumbs={[{ label: 'Training', to: '/training' }, { label: track.title }]} title={track.title} sub={track.summary} art={heroArt.laptop}>
        <ul className="tt-chips">
          <li>
            <img src={icons.layers} alt="" width={18} height={18} />
            {plural(track.modules.length, 'Level')}
          </li>
          <li>
            <img src={icons.bookOpen} alt="" width={18} height={18} />
            {plural(lessonCount, 'Lesson')}
          </li>
          <li>
            <img src={icons.monitorPlay} alt="" width={18} height={18} />
            Hands-on Training
          </li>
        </ul>
      </PageHero>

      <section className="section">
        <div className="container tt">
          {track.modules.map((mod, mi) => (
            <article key={mod.id} className="tt-level">
              <header className="tt-level-head">
                <img src={mi === 0 ? icons.layers : icons.star} alt="" width={44} height={44} />
                <h2>{mod.title}</h2>
                <span className="tt-count">
                  <img src={icons.bookOpen} alt="" width={16} height={16} />
                  {plural(mod.lessons.length, 'Lesson')}
                </span>
              </header>
              <ol className="tt-lessons" style={{ '--tt-rows': Math.ceil(mod.lessons.length / 2) } as CSSProperties}>
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
                      <span className="tt-num">{String(i + 1).padStart(2, '0')}</span>
                      <span className="tt-title">{lesson.title}</span>
                      <img src={icons.chevronRight} alt="" width={16} height={16} />
                    </button>
                  </li>
                ))}
              </ol>
            </article>
          ))}

          <aside className="tt-cta">
            <img src={icons.school} alt="" width={52} height={52} />
            <div>
              <h2>{trackPage.ctaTitle}</h2>
              <p>{trackPage.ctaText}</p>
            </div>
            <div className="tt-cta-actions">
              <Link className="tt-btn tt-btn-mint" to="/pricing">
                Get Professional Plan <span aria-hidden>→</span>
              </Link>
              <Link className="tt-btn tt-btn-line" to="/account">
                <img src={icons.user} alt="" width={18} height={18} />
                Login to Portal
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

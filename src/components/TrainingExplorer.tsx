import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { trainingTracks } from '../data/content';
import { fallbackSectionImage, trainingTrackImages } from '../data/sectionMedia';
import './TrainingExplorer.css';

const MOBILE_SCROLL_MAX_WIDTH = 980;

const trackIcons: Record<string, ReactNode> = {
  logical: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
  electrical: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  ),
  mechanical: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
    </svg>
  ),
  'firmware-basic': (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M7 4h7l4 4v12H7V4Z" />
      <path d="M14 4v4h4M9 13h6M9 17h4" />
    </svg>
  ),
  mrt: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M8 10h2M12 10h2M16 10h2M8 14h8" />
    </svg>
  ),
  media: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="12" r="2.2" />
      <path d="m13 15 3-3 3 4" />
    </svg>
  ),
  electronics: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M14 4 8 13h5l-1 7 8-11h-5l-1-5Z" />
    </svg>
  ),
  basics: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 5.5h7.5A2.5 2.5 0 0 1 14 8v12.5H6.5A2.5 2.5 0 0 1 4 18V5.5Z" />
      <path d="M20 5.5h-7.5A2.5 2.5 0 0 0 10 8v12.5H17.5A2.5 2.5 0 0 0 20 18V5.5Z" />
    </svg>
  ),
  bitlocker: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </svg>
  ),
};

function lessonMinutes(index: number, title: string) {
  const base = 12 + ((index * 5 + title.length) % 21);
  return base;
}

export function TrainingExplorer() {
  const [openTrack, setOpenTrack] = useState(trainingTracks[0]?.id ?? '');
  const [openModule, setOpenModule] = useState(trainingTracks[0]?.modules[0]?.id ?? '');
  const selectedPanelRef = useRef<HTMLDivElement>(null);
  const track = trainingTracks.find((t) => t.id === openTrack) ?? trainingTracks[0];
  const mod = track?.modules.find((m) => m.id === openModule) ?? track?.modules[0];

  function selectTrack(trackId: string, moduleId: string) {
    setOpenTrack(trackId);
    setOpenModule(moduleId);

    const isMobile = window.matchMedia(`(max-width: ${MOBILE_SCROLL_MAX_WIDTH}px)`).matches;
    if (!isMobile) return;

    // Wait for React to paint the newly selected track, then scroll.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        selectedPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  return (
    <div className="tx">
      <aside className="tx-sidebar">
        <p className="tx-sidebar-label">Solutions for</p>
        <div className="tx-tracks">
          {trainingTracks.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tx-track ${t.id === track.id ? 'is-active' : ''}`}
              onClick={() => selectTrack(t.id, t.modules[0]?.id ?? '')}
            >
              <span className="tx-track-icon">{trackIcons[t.id] ?? trackIcons.logical}</span>
              <span className="tx-track-title">{t.title}</span>
              <span className="tx-track-chevron" aria-hidden>
                ›
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className="tx-panel" ref={selectedPanelRef} id="selected-track">
        <div className="tx-hero">
          <div className="tx-hero-copy">
            <span className="tx-badge">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <rect x="3" y="5" width="18" height="12" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              Selected track
            </span>
            <h3>{track.title}</h3>
            <p>{track.summary}</p>
            <div className="tx-actions">
              <Link className="tx-btn tx-btn-primary" to={`/training/${track.id}`}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
                  <path d="M8 6.5v11l9-5.5-9-5.5Z" />
                </svg>
                Open full track
                <span aria-hidden>›</span>
              </Link>
              <Link className="tx-btn tx-btn-outline" to={`/training/${track.id}`}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M4 5.5h7.5A2.5 2.5 0 0 1 14 8v12.5H6.5A2.5 2.5 0 0 1 4 18V5.5Z" />
                  <path d="M20 5.5h-7.5A2.5 2.5 0 0 0 10 8v12.5H17.5A2.5 2.5 0 0 0 20 18V5.5Z" />
                </svg>
                Start learning
                <span aria-hidden>›</span>
              </Link>
            </div>
          </div>

          <div className="tx-visual" aria-hidden>
            <img
              className="tx-visual-photo"
              src={trainingTrackImages[track.id] ?? fallbackSectionImage}
              alt=""
              width={1200}
              height={800}
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>

        <div className="tx-tabs" role="tablist">
          {track.modules.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={m.id === mod?.id}
              className={`tx-tab ${m.id === mod?.id ? 'is-active' : ''}`}
              onClick={() => setOpenModule(m.id)}
            >
              {m.id === mod?.id ? (
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                  <rect x="3" y="5" width="18" height="12" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                  <path d="M5 16 8.5 8l3 5 2.2-3.5L16.5 16" />
                  <path d="M4 18h16" />
                </svg>
              )}
              {m.title}
            </button>
          ))}
        </div>

        <ol className="tx-lessons">
          {mod?.lessons.map((lesson, i) => (
            <li key={lesson.id}>
              <Link to={`/training/${track.id}`} className="tx-lesson">
                <span className="tx-lesson-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="tx-lesson-title">{lesson.title}</span>
                <span className="tx-lesson-meta">
                  <span className="tx-play" aria-hidden>
                    ▶
                  </span>
                  {lessonMinutes(i, lesson.title)} min
                </span>
                <span className="tx-lesson-chevron" aria-hidden>
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

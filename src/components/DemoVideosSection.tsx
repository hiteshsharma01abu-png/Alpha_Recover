import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { demoVideos } from '../data/content';
import {
  demoCategoryIconSrc,
  demoPlayIconMint,
  demoVideoImages,
} from './demoVisuals';
import '../pages/Home.css';

type DemoVideosSectionProps = {
  limit?: number;
  showViewAll?: boolean;
  linkCards?: boolean;
};

function onPlay() {
  alert('Video player + CDN hosting will be wired with your backend choice.');
}

/**
 * Mobile: sticky sibling stack (same as pro-grid / solutions-stack).
 * Plain <section> — no Reveal transform / overflow so sticky can pin.
 */
export function DemoVideosSection({
  limit = 2,
  showViewAll = false,
  linkCards = false,
}: DemoVideosSectionProps) {
  const videos = demoVideos.slice(0, limit);

  return (
    <section className="section demos-section">
      <div className="demos-backdrop" aria-hidden>
        <div className="demos-glow demos-glow-tl" />
        <div className="demos-glow demos-glow-br" />
        <div className="demos-deco">
          <span className="demos-deco-dots demos-deco-dots-tr" />
        </div>
      </div>

      <div className="container demos-shell">
        <div className="demos-head">
          <div className="demos-head-copy">
            <span className="why-accent-bar" aria-hidden />
            <h2>
              Demo <em>Videos</em>
            </h2>
            <p>
              Preview real case workflows, troubleshooting, and recovery processes before you buy.
            </p>
          </div>
          {showViewAll ? (
            <Link className="demos-view-all" to="/demos">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
                <path d="M8 6.5v11l9-5.5-9-5.5Z" />
              </svg>
              View All Videos
              <span aria-hidden>›</span>
            </Link>
          ) : null}
        </div>

        <div
          className="demos-grid"
          style={{ '--stack-count': videos.length } as CSSProperties}
        >
          {videos.map((d, i) => {
            const iconSrc =
              demoCategoryIconSrc[d.tag] ?? demoCategoryIconSrc[d.category] ?? demoPlayIconMint;
            const inner = (
              <>
                <div className="dv-thumb">
                  <img
                    className="dv-art"
                    src={demoVideoImages[d.id]}
                    alt=""
                    width={1200}
                    height={675}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="dv-cat">
                    <img src={iconSrc} alt="" width={13} height={13} decoding="async" />
                    {d.tag}
                  </span>
                  <span className="dv-hd">HD 1080p</span>
                  <span className="dv-play" aria-hidden>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                      <path d="M8 6.5v11l9-5.5-9-5.5Z" />
                    </svg>
                  </span>
                  <span className="dv-duration">
                    <img
                      src="/icons/lucide__clock__ivory.svg"
                      alt=""
                      width={12}
                      height={12}
                      decoding="async"
                    />
                    {d.duration}
                  </span>
                </div>
                <div className="dv-body">
                  <h3>{d.title}</h3>
                  <div className="dv-footer">
                    <div className="dv-tags">
                      {d.tags.map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                    <span className="dv-arrow" aria-hidden>
                      ›
                    </span>
                  </div>
                </div>
              </>
            );

            const style = { '--stack-i': i } as CSSProperties;

            return linkCards ? (
              <Link key={d.id} to="/demos" className="dv-card" style={style}>
                {inner}
              </Link>
            ) : (
              <button
                key={d.id}
                type="button"
                className="dv-card"
                style={style}
                onClick={onPlay}
              >
                {inner}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

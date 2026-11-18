import { brandLogo } from '../../data/content';
import './BrandLogo.css';

/** The brand hexagon mark (on its deep-green tile, legible in both themes) + "Alpha Recover". */
export function BrandLogo({ tagline, size = 'md' }: { tagline?: string; size?: 'md' | 'lg' }) {
  return (
    <span className={`adm-logo adm-logo-${size}`}>
      <img className="adm-logo-mark" src={brandLogo.tile} alt="" width={200} height={200} />
      <span className="adm-logo-text">
        <strong>
          <span className="adm-logo-alpha">Alpha</span> <span className="adm-logo-recover">Recover</span>
        </strong>
        {tagline ? <small>{tagline}</small> : null}
      </span>
    </span>
  );
}

import './BrandLogo.css';

/** The site's logo (spinning platter mark + "Alpha Recover"), as in the public header and footer. */
export function BrandLogo({ tagline, size = 'md' }: { tagline?: string; size?: 'md' | 'lg' }) {
  return (
    <span className={`adm-logo adm-logo-${size}`}>
      <span className="adm-logo-mark" aria-hidden>
        <span className="adm-logo-ring" />
        <span className="adm-logo-hub" />
      </span>
      <span className="adm-logo-text">
        <strong>
          <span className="adm-logo-alpha">Alpha</span> <span className="adm-logo-recover">Recover</span>
        </strong>
        {tagline ? <small>{tagline}</small> : null}
      </span>
    </span>
  );
}

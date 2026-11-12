export function PageHddVisual() {
  return (
    <div className="pg-hdd" aria-hidden>
      <span className="pg-hdd-glow" />
      <span className="pg-hdd-ring" />
      <svg className="pg-hdd-svg" viewBox="0 0 320 260" fill="none">
        <defs>
          <linearGradient id="pgHddBody" x1="40" y1="30" x2="280" y2="230" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f8fafc" />
            <stop offset="1" stopColor="#123128" />
          </linearGradient>
          <linearGradient id="pgHddPlatter" x1="90" y1="70" x2="230" y2="200" gradientUnits="userSpaceOnUse">
            <stop stopColor="#123128" />
            <stop offset="0.45" stopColor="#123128" />
            <stop offset="1" stopColor="#d1d5db" />
          </linearGradient>
          <radialGradient id="pgHddCore" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(160 130) scale(22 16)">
            <stop stopColor="#F0EDE4" />
            <stop offset="1" stopColor="#4D7A73" />
          </radialGradient>
        </defs>
        <rect x="48" y="42" width="224" height="176" rx="18" fill="url(#pgHddBody)" stroke="#4D7A73" strokeWidth="2.5" />
        <ellipse cx="160" cy="130" rx="78" ry="54" fill="url(#pgHddPlatter)" stroke="#F0EDE4" strokeWidth="2.4" />
        <ellipse cx="160" cy="130" rx="56" ry="38" fill="none" stroke="#F0EDE4" strokeWidth="1.4" opacity="0.45" />
        <ellipse cx="160" cy="130" rx="36" ry="24" fill="#F0EDE4" stroke="#4D7A73" strokeWidth="1.6" />
        <ellipse cx="160" cy="130" rx="14" ry="10" fill="url(#pgHddCore)" />
        <path d="M160 130 L222 72" stroke="#F0EDE4" strokeWidth="7" strokeLinecap="round" />
        <circle cx="222" cy="72" r="11" fill="#4D7A73" stroke="#F0EDE4" strokeWidth="2" />
        <rect x="68" y="58" width="90" height="16" rx="4" fill="#123128" stroke="#F0EDE4" strokeWidth="1.6" />
        <path d="M78 66h28M114 66h24" stroke="#F0EDE4" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        <path d="M250 88c18 14 28 38 24 62" stroke="#F0EDE4" strokeWidth="1.6" opacity="0.45" strokeDasharray="5 5" />
        <path d="M70 188c22 16 52 24 84 20" stroke="#F0EDE4" strokeWidth="1.5" opacity="0.3" strokeDasharray="4 4" />
        <circle cx="258" cy="128" r="3" fill="#F0EDE4" opacity="0.7" />
        <circle cx="78" cy="156" r="2.5" fill="#F0EDE4" opacity="0.55" />
      </svg>
    </div>
  );
}

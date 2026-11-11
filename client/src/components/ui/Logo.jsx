export function LogoMark({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id="lg-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#93C5FD" />
          <stop offset=".45" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#EC4899" />
        </linearGradient>
        <linearGradient id="lg-r" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3B82F6" />
          <stop offset=".6" stopColor="#A78BFA" />
          <stop offset="1" stopColor="#F472B6" />
        </linearGradient>
        <filter id="lg-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g filter="url(#lg-glow)">
        <path d="M50 8 L80 86 H67 L50 38 L33 86 H20 Z" fill="url(#lg-a)" />
        <path d="M50 8 L56 24 L50 38 L44 24 Z" fill="#fff" opacity=".55" />
        <ellipse cx="50" cy="60" rx="44" ry="13" fill="none" stroke="url(#lg-r)" strokeWidth="3.4" transform="rotate(-20 50 60)" strokeDasharray="230 40" />
        <circle cx="88" cy="40" r="2.6" fill="#fff" />
      </g>
    </svg>
  );
}

export default function Logo({ compact = false }) {
  return (
    <div className="logo">
      <LogoMark size={compact ? 40 : 58} />
      {!compact && (
        <div className="logo-text">
          <span className="logo-title">ASAD<br />SOLVENCY</span>
          <span className="logo-tag">Every Problem Has a Way Forward.</span>
        </div>
      )}
    </div>
  );
}

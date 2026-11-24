/** Better Together mark: a day's progress ring with a spark in the middle. */
export function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} role="img" aria-label="Better Together">
      <defs>
        <linearGradient id="lg-bg" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#1d1936" />
          <stop offset="1" stopColor="#07070d" />
        </linearGradient>
        <radialGradient id="lg-glow" cx="0.5" cy="0.45" r="0.55">
          <stop offset="0" stopColor="#a89bff" stopOpacity="0.32" />
          <stop offset="1" stopColor="#a89bff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lg-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9ceff" />
          <stop offset="0.55" stopColor="#a89bff" />
          <stop offset="1" stopColor="#ff9eb5" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#lg-bg)" />
      <rect width="512" height="512" rx="116" fill="url(#lg-glow)" />
      <circle cx="256" cy="256" r="150" fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="44" />
      <circle cx="256" cy="256" r="150" fill="none" stroke="url(#lg-ring)" strokeWidth="44" strokeLinecap="round" strokeDasharray="760 1000" transform="rotate(-90 256 256)" />
      <path d="M256 186c7 44 26 63 70 70-44 7-63 26-70 70-7-44-26-63-70-70 44-7 63-26 70-70z" fill="#fff" />
    </svg>
  );
}

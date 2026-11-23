/** Better Together mark: two interlocking rings with a heart where they meet. */
export function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} role="img" aria-label="Better Together">
      <defs>
        <linearGradient id="lg-bg" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#1d1936" />
          <stop offset="1" stopColor="#07070d" />
        </linearGradient>
        <radialGradient id="lg-glow" cx="0.5" cy="0.45" r="0.55">
          <stop offset="0" stopColor="#a89bff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#a89bff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lg-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9ceff" />
          <stop offset="1" stopColor="#8e7bff" />
        </linearGradient>
        <linearGradient id="lg-b" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc4d3" />
          <stop offset="1" stopColor="#ff7fa2" />
        </linearGradient>
        <clipPath id="lg-over">
          <rect x="236" y="120" width="80" height="128" />
        </clipPath>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#lg-bg)" />
      <rect width="512" height="512" rx="116" fill="url(#lg-glow)" />
      <circle cx="206" cy="256" r="110" fill="none" stroke="url(#lg-a)" strokeWidth="40" />
      <circle cx="306" cy="256" r="110" fill="none" stroke="url(#lg-b)" strokeWidth="40" />
      <circle cx="206" cy="256" r="110" fill="none" stroke="url(#lg-a)" strokeWidth="40" clipPath="url(#lg-over)" />
      <path d="M256 296c-30-20-46-38-46-56 0-14 11-24 24-24 10 0 17 5 22 13 5-8 12-13 22-13 13 0 24 10 24 24 0 18-16 36-46 56z" fill="#fff" />
    </svg>
  );
}

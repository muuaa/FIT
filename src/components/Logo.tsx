/** Replete mark: four module arcs (train, fuel, hydrate, recover) closing around an R. */
export function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  const arcs = [
    ['#f5a524', -9],
    ['#34d399', -99],
    ['#22d3ee', -189],
    ['#a78bfa', -279],
  ] as const;
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} role="img" aria-label="Replete">
      <rect width="512" height="512" rx="116" fill="#111821" />
      <g fill="none" strokeWidth="34" strokeLinecap="round" transform="rotate(-90 256 256)">
        {arcs.map(([color, offset]) => (
          <circle
            key={color}
            cx="256"
            cy="256"
            r="164"
            stroke={color}
            pathLength={360}
            strokeDasharray="72 288"
            strokeDashoffset={offset}
          />
        ))}
      </g>
      <g fill="none" stroke="#f2f6fa" strokeWidth="38" strokeLinecap="round" strokeLinejoin="round">
        <path d="M208 340V172h58a46 46 0 0 1 0 92h-58" />
        <path d="M258 264l52 76" />
      </g>
    </svg>
  );
}

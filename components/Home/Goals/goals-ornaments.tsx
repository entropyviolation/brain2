/**
 * components/Home/Goals/goals-ornaments.tsx — drawn furniture for the Goals room
 *
 * Inline SVG only (no photographs): the eight-point star (designrefs 0119),
 * the compass rose with degree rings (0058, 0041, 0047), and the coverage
 * astrolabe dial for Direction in Life. Decorative pieces are aria-hidden.
 */

/** Eight-point star: four long rays over four short ones. */
export function GolStar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        d="M12 0 L13.6 10.4 L24 12 L13.6 13.6 L12 24 L10.4 13.6 L0 12 L10.4 10.4 Z"
        fill="currentColor"
      />
      <path
        d="M12 4.2 L13.1 10.9 L19.8 12 L13.1 13.1 L12 19.8 L10.9 13.1 L4.2 12 L10.9 10.9 Z"
        fill="currentColor"
        opacity="0.55"
        transform="rotate(45 12 12)"
      />
    </svg>
  )
}

/** Compass rose with graduated rings — the fascia's turning plate. */
export function GolRose({ className }: { className?: string }) {
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5)
  return (
    <svg className={className} viewBox="-100 -100 200 200" aria-hidden focusable="false">
      <g fill="none" stroke="currentColor">
        <circle r="96" strokeWidth="0.8" />
        <circle r="88" strokeWidth="0.5" />
        <circle r="62" strokeWidth="0.5" strokeDasharray="1.5 3" />
        <circle r="40" strokeWidth="0.6" />
        <circle r="14" strokeWidth="0.6" />
        {ticks.map((deg) => (
          <line
            key={deg}
            x1="0"
            y1={deg % 45 === 0 ? -78 : deg % 15 === 0 ? -83 : -86}
            x2="0"
            y2="-88"
            strokeWidth={deg % 45 === 0 ? 1 : 0.5}
            transform={`rotate(${deg})`}
          />
        ))}
        {[0, 30, 60, 90, 120, 150].map((deg) => (
          <line key={`m${deg}`} x1="0" y1="-96" x2="0" y2="96" strokeWidth="0.3" transform={`rotate(${deg})`} />
        ))}
      </g>
      <g fill="currentColor">
        <path d="M0 -76 L7 -7 L76 0 L7 7 L0 76 L-7 7 L-76 0 L-7 -7 Z" opacity="0.9" />
        <path d="M0 -50 L4 -4 L50 0 L4 4 L0 50 L-4 4 L-50 0 L-4 -4 Z" opacity="0.6" transform="rotate(45)" />
      </g>
      <circle r="3" fill="var(--g-night, #0b1020)" />
    </svg>
  )
}

/**
 * Astrolabe dial for coverage. The arc fills to `percent`; a small star rides
 * the end of the arc. `null` draws the empty dial.
 */
export function GolDial({ percent }: { percent: number | null }) {
  const p = percent === null ? 0 : Math.max(0, Math.min(100, percent))
  const angle = (p / 100) * 360
  return (
    <svg className="gol-dial-svg" viewBox="-60 -60 120 120" aria-hidden focusable="false">
      <circle r="56" className="gol-dial-rim" />
      <circle r="47" className="gol-dial-track" />
      <circle
        r="47"
        className="gol-dial-arc"
        pathLength={100}
        strokeDasharray={`${p} 100`}
        transform="rotate(-90)"
      />
      {Array.from({ length: 50 }, (_, i) => (
        <line
          key={i}
          className={i % 5 === 0 ? "gol-dial-tick is-major" : "gol-dial-tick"}
          x1="0"
          y1={i % 5 === 0 ? -56 : -54}
          x2="0"
          y2="-51"
          transform={`rotate(${i * 7.2})`}
        />
      ))}
      <circle r="38" className="gol-dial-inner" />
      {percent !== null && p > 0 && (
        <g transform={`rotate(${angle}) translate(0 -47)`}>
          <path className="gol-dial-star" d="M0 -6 L1.3 -1.3 L6 0 L1.3 1.3 L0 6 L-1.3 1.3 L-6 0 L-1.3 -1.3 Z" />
        </g>
      )}
    </svg>
  )
}

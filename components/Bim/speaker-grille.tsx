/**
 * components/Bim/speaker-grille.tsx — The console's little speaker
 *
 * A round field of drilled holes in the silver, each with a dark throat and a lit lower lip, like a Braun
 * radio's grille. Nothing glows or comes out of it, ever: no green, no bloom. It only dims when the
 * sound is off. Decorative: the mute key beside it is the control.
 */
"use client"


/** Hole centers on a hex grid inside a circle of radius 12 (viewBox 30 × 30). */
const HOLES: [number, number][] = (() => {
  const out: [number, number][] = []
  const pitch = 3.6
  for (let row = -4; row <= 4; row++) {
    const y = row * pitch * 0.866
    for (let col = -4; col <= 4; col++) {
      const x = col * pitch + (row % 2 ? pitch / 2 : 0)
      if (Math.hypot(x, y) <= 11.2) out.push([15 + x, 15 + y])
    }
  }
  return out
})()

export function SpeakerGrille({ on }: { on: boolean }) {
  return (
    <svg className={`bim-grille${on ? "" : " is-off"}`} viewBox="0 0 30 30" aria-hidden="true">
      <defs>
        <radialGradient id="bim-grille-hole" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#050607" />
          <stop offset="0.7" stopColor="#1c1f22" />
          <stop offset="1" stopColor="#3a3e42" />
        </radialGradient>
        <radialGradient id="bim-grille-dish" cx="0.4" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#f4f6f7" />
          <stop offset="0.65" stopColor="#d3d7da" />
          <stop offset="1" stopColor="#a9aeb2" />
        </radialGradient>
      </defs>
      {/* The pressed dish the holes sit in. */}
      <circle cx="15" cy="15" r="14" fill="url(#bim-grille-dish)" stroke="#8d9297" strokeWidth="0.6" />
      <circle cx="15" cy="15" r="13.2" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
      {HOLES.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y + 0.45} r="1.05" fill="rgba(255,255,255,0.85)" />
          <circle cx={x} cy={y} r="1.05" fill="url(#bim-grille-hole)" />
        </g>
      ))}
    </svg>
  )
}

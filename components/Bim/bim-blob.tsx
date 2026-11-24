/**
 * components/Bim/bim-blob.tsx — BIM's face: a little silver pixel blob (2026-11-24)
 *
 * A 22×18 sprite drawn as SVG rects, one per pixel, so it stays crisp. Idle, it bobs and blinks.
 * While BIM works (`thinking`) it bobs faster, its eyes glance up and side to side, and three
 * phosphor dots pop in over its head one by one. Motion is CSS (`bim-console.css`, `.bim-blob*`),
 * and stops under reduced motion.
 */

import type { ReactNode } from "react"

/** o outline · w highlight · l body · m shade · d deep shade. Eyes are drawn on top, apart. */
const BODY = [
  ".......oooooooo.......",
  ".....oowwwllllmoo.....",
  "....owwwllllllllmo....",
  "...owwwllllllllllmo...",
  "...olllllllllllllmo...",
  "..olllllllllllllllmo..",
  "..olllllllllllllllmo..",
  "..olllllllllllllllmo..",
  "..olllllllllllllllmo..",
  "ooollllllllllllllldooo",
  "owollllllllllllllldomo",
  "olollllllllllllllldomo",
  "oo.ollllllllllllldo.oo",
  "....oommmmmmmmmmoo....",
  "......oooooooooo......",
  ".....omwo....omwo.....",
  ".....oddo....oddo.....",
  "......oo......oo......"
]

const INK: Record<string, string> = { o: "#241f30", w: "#ffffff", l: "#e2e4e8", m: "#b3b8be", d: "#878c93" }

/** Each eye is 3×4 with a one-pixel glint low in the middle; shut, it is a 3×1 line. Left eye at x 6, right at x 13, top at y 5. */
const EYES_X = [6, 13]

function Pixels({ rows }: { rows: string[] }) {
  const out: ReactNode[] = []
  rows.forEach((row, y) => {
    // Runs of one colour become one rect.
    let x = 0
    while (x < row.length) {
      const ch = row[x]!
      let end = x + 1
      while (end < row.length && row[end] === ch) end++
      if (INK[ch]) out.push(<rect key={`${x}-${y}`} x={x} y={y} width={end - x} height={1} fill={INK[ch]} />)
      x = end
    }
  })
  return <>{out}</>
}

export function BimBlob({ thinking = false }: { thinking?: boolean }) {
  return (
    <svg className={`bim-blob${thinking ? " is-thinking" : ""}`} viewBox="0 -5 22 23" shapeRendering="crispEdges" aria-hidden="true">
      <g className="bim-blob-dots">
        <rect className="bim-blob-dot" x={14} y={-2} width={1} height={1} />
        <rect className="bim-blob-dot" x={16} y={-3} width={2} height={2} />
        <rect className="bim-blob-dot" x={19} y={-5} width={3} height={3} />
      </g>
      <g className="bim-blob-body">
        <Pixels rows={BODY} />
        <g className="bim-blob-eyes">
          <g className="bim-blob-open">
            {EYES_X.map((x) => (
              <g key={x}>
                <rect x={x} y={5} width={3} height={4} fill={INK.o} />
                <rect x={x + 1} y={7} width={1} height={1} fill="#ffffff" />
              </g>
            ))}
          </g>
          <g className="bim-blob-shut">
            {EYES_X.map((x) => (
              <rect key={x} x={x} y={7} width={3} height={1} fill={INK.o} />
            ))}
          </g>
        </g>
      </g>
    </svg>
  )
}

/**
 * components/Bim/bim-blob.tsx — BIM's face: a little silver pixel blob (2026-11-24)
 *
 * A 20×20 sprite drawn as SVG rects, one per pixel, so it stays crisp. Idle, it bobs and blinks.
 * While BIM works (`thinking`) it bobs faster, its eyes glance up and side to side, and three
 * phosphor dots pop in over its head one by one. Motion is CSS (`bim-console.css`, `.bim-blob*`),
 * and stops under reduced motion. With `still` (LLM off, or Ollama not answering) nothing moves, so a
 * frozen blob says no model is in the loop.
 */

import type { ReactNode } from "react"

/** o outline · w shine · l body · d shade. 20×20, after the reference sprite (2026-11-24). Eyes are drawn on top, apart. */
const BODY = [
  ".......oooooo.......",
  ".....oollllldoo.....",
  "....owwwwwlllddo....",
  "...owwwwwlllllddo...",
  "..ollllwlllllllddo..",
  "..ollllllllllllldo..",
  ".olllllllllllllldo..",
  ".ollllllllllllllddo.",
  ".ollllllllllllllddo.",
  ".ollllllllllllllddo.",
  ".olllllllllllllldlo.",
  ".olllllllllllllddllo",
  "oodlllllllllllldollo",
  "ololllllllllllddoldo",
  "ododdlllllllldddoodo",
  ".o.odddlllddddoowoo.",
  "....ooddddddooddo...",
  "...oddooooooodddo...",
  "...olddo....odldo...",
  "....ooo......ooo....",
]

const INK: Record<string, string> = { o: "#312642", w: "#fdfdfb", l: "#e0dfdf", d: "#8b8a89" }

/** Each eye is a 4×5 dark oval with two glints on the diagonal, exactly as the reference. Left at x 3, right at x 10, top at y 7. */
const EYE = [".oo.", "owoo", "oooo", "oowo", ".oo."]
/** Shut: a happy upturned arc, two rows. */
const EYE_SHUT = [".oo.", "o..o"]
const EYES_X = [3, 10]
const EYE_Y = 7

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

/** `still`: no model in the loop (LLM off, or Ollama not answering). Nothing moves; thinking just lights the dots. */
export function BimBlob({ thinking = false, still = false }: { thinking?: boolean; still?: boolean }) {
  return (
    <svg className={`bim-blob${thinking ? " is-thinking" : ""}${still ? " is-still" : ""}`} viewBox="0 -4 20 24" shapeRendering="crispEdges" aria-hidden="true">
      <g className="bim-blob-dots">
        <rect className="bim-blob-dot" x={13} y={-1} width={1} height={1} />
        <rect className="bim-blob-dot" x={15} y={-3} width={2} height={2} />
        <rect className="bim-blob-dot" x={18} y={-4} width={2} height={2} />
      </g>
      <g className="bim-blob-body">
        <Pixels rows={BODY} />
        <g className="bim-blob-eyes">
          <g className="bim-blob-open">
            {EYES_X.map((x) => (
              <g key={x} transform={`translate(${x} ${EYE_Y})`}>
                <Pixels rows={EYE} />
              </g>
            ))}
          </g>
          <g className="bim-blob-shut">
            {EYES_X.map((x) => (
              <g key={x} transform={`translate(${x} ${EYE_Y + 2})`}>
                <Pixels rows={EYE_SHUT} />
              </g>
            ))}
          </g>
        </g>
      </g>
    </svg>
  )
}

/**
 * components/Home/home-moon-sprite.tsx — 8-bit moon for the Home tile
 *
 * A 16×16 disk. Waxing lights the right. Craters stay put; a tiny face
 * shows only when the disk is near full. Stars blink in steps, like the pet.
 */
"use client"

const N = 16
const CRATERS = new Set(["5,4", "6,5", "9,6", "10,8", "6,9", "8,11", "11,10"])
const EYES = new Set(["6,7", "9,7"])
const SMILE = new Set(["7,10", "8,10"])

type Cell = "void" | "rim" | "lit" | "crater" | "shade" | "shade-crater" | "eye" | "smile"

const FILL: Record<Exclude<Cell, "void">, string> = {
  rim: "#14182a",
  lit: "#f4f1ea",
  crater: "#b7b3c2",
  shade: "#3c415c",
  "shade-crater": "#2a2e44",
  eye: "#243049",
  smile: "#243049",
}

function cellAt(col: number, row: number, cycle: number): Cell {
  const x = (col + 0.5 - 8) / 6.15
  const y = (row + 0.5 - 8) / 6.15
  const r2 = x * x + y * y
  if (r2 > 1.22) return "void"
  if (r2 > 0.9) return "rim"
  const z = Math.sqrt(Math.max(0, 1 - Math.min(r2, 1)))
  const ang = cycle * Math.PI * 2
  const lit = x * Math.sin(ang) + z * -Math.cos(ang) > 0.04
  const key = `${col},${row}`
  const faced = cycle > 0.4 && cycle < 0.6
  if (faced && lit && EYES.has(key)) return "eye"
  if (faced && lit && SMILE.has(key)) return "smile"
  if (CRATERS.has(key)) return lit ? "crater" : "shade-crater"
  return lit ? "lit" : "shade"
}

const STARS: { c: number; r: number; delay: string }[] = [
  { c: 1, r: 1, delay: "0s" },
  { c: 14, r: 2, delay: "-0.6s" },
  { c: 2, r: 14, delay: "-1.1s" },
]

export function PixelMoon({ cycle, detail = false }: { cycle: number; detail?: boolean }) {
  const rects: { key: string; x: number; y: number; fill: string; star?: string }[] = []
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      const kind = cellAt(col, row, cycle)
      if (kind === "void") continue
      rects.push({ key: `${col}-${row}`, x: col, y: row, fill: FILL[kind] })
    }
  }
  return (
    <svg
      className={detail ? "home-moon-px is-detail" : "home-moon-px"}
      viewBox="0 0 16 16"
      role="img"
      aria-label="Moon"
    >
      {STARS.map((star) => (
        <g key={`${star.c}-${star.r}`} className="home-moon-px-star" style={{ animationDelay: star.delay }}>
          <rect x={star.c} y={star.r} width="1" height="1" fill="#d7e4ff" />
          <rect x={star.c - 1} y={star.r} width="1" height="1" fill="#9eb6e8" />
          <rect x={star.c + 1} y={star.r} width="1" height="1" fill="#9eb6e8" />
          <rect x={star.c} y={star.r - 1} width="1" height="1" fill="#9eb6e8" />
          <rect x={star.c} y={star.r + 1} width="1" height="1" fill="#9eb6e8" />
        </g>
      ))}
      {rects.map((rect) => (
        <rect key={rect.key} x={rect.x} y={rect.y} width="1" height="1" fill={rect.fill} />
      ))}
    </svg>
  )
}

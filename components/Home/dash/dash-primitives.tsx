/**
 * components/Home/dash/dash-primitives.tsx — Parts of the Dash instrument cluster
 *
 * Drawn from a 1980s Oldsmobile vacuum-fluorescent cluster (cyan segment
 * digits with the unlit 8s still faintly visible, arcs of separate lit
 * segments, tiny engraved legends like FUEL and VOLTS) and a 2011 Prius
 * multi-display (white-blue LCD numerals, stair meters, a boxed P R N D
 * selector, thin line pictograms). Pure SVG and spans. No data, no stores:
 * the faces in `dash-faces.tsx` feed these.
 */
"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/* ---- Segment digits ---------------------------------------------------- */

/** a b c d e f g, the usual seven. */
const SEG_POINTS: Record<string, string> = {
  a: "1.4,0.4 8.6,0.4 7.3,1.9 2.7,1.9",
  b: "9.6,1.1 9.6,8.6 8.2,8.1 8.2,2.5",
  c: "9.6,9.4 9.6,16.9 8.2,15.5 8.2,9.9",
  d: "1.4,17.6 8.6,17.6 7.3,16.1 2.7,16.1",
  e: "0.4,9.4 1.8,9.9 1.8,15.5 0.4,16.9",
  f: "0.4,1.1 1.8,2.5 1.8,8.1 0.4,8.6",
  g: "1.3,9 2.6,8.25 7.4,8.25 8.7,9 7.4,9.75 2.6,9.75",
}

const SEG_ORDER = ["a", "b", "c", "d", "e", "f", "g"] as const

/** Glyphs a seven-segment tube can honestly draw. Anything else is a unit run. */
const SEG_GLYPH: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  "-": "g",
  "—": "g",
  " ": "",
  A: "abcefg",
  b: "cdefg",
  C: "adef",
  c: "deg",
  d: "bcdeg",
  E: "adefg",
  F: "aefg",
  H: "bcefg",
  h: "cefg",
  L: "def",
  n: "ceg",
  o: "cdeg",
  P: "abefg",
  r: "eg",
  t: "defg",
  U: "bcdef",
  u: "cde",
}

const DIGIT_W = 10
const DIGIT_GAP = 2.4
const PUNCT_W = 3

const SLASH_W = 6

function isPunct(ch: string) {
  return ch === ":" || ch === "." || ch === "/"
}

/** True when every character can be drawn by the segment tube. */
export function segDrawable(text: string): boolean {
  return [...text].every((ch) => ch in SEG_GLYPH || isPunct(ch))
}

/**
 * Seven-segment digits with the unlit segments left as a faint ghost, the way
 * a VFD tube shows `188` behind a `0`. `cells` pads on the left with ghost
 * digits so a reading keeps its width as it changes.
 */
export function SegDigits({
  value,
  cells,
  className,
  label,
}: {
  value: string
  cells?: number
  className?: string
  /** Spoken reading. Defaults to the value. */
  label?: string
}) {
  const chars = [...value]
  const digitCount = chars.filter((ch) => !isPunct(ch)).length
  const pad = cells && cells > digitCount ? cells - digitCount : 0
  const all = [...Array.from({ length: pad }, () => " "), ...chars]
  let x = 0
  const glyphs: ReactNode[] = []
  all.forEach((ch, i) => {
    if (isPunct(ch)) {
      if (ch === "/") {
        glyphs.push(<polygon key={i} className="dash-seg-on" points={`${x + 4.6},1 ${x + 5.8},1 ${x + 1.2},17 ${x},17`} />)
        x += SLASH_W
        return
      }
      glyphs.push(
        ch === ":" ? (
          <g key={i} className="dash-seg-on">
            <rect x={x + 0.6} y={5} width={1.8} height={1.8} />
            <rect x={x + 0.6} y={11.6} width={1.8} height={1.8} />
          </g>
        ) : (
          <rect key={i} className="dash-seg-on" x={x + 0.6} y={15.8} width={1.8} height={1.8} />
        ),
      )
      x += PUNCT_W
      return
    }
    const lit = SEG_GLYPH[ch] ?? ""
    glyphs.push(
      <g key={i} transform={`translate(${x} 0)`}>
        {SEG_ORDER.map((seg) => (
          <polygon key={seg} points={SEG_POINTS[seg]} className={lit.includes(seg) ? "dash-seg-on" : "dash-seg-off"} />
        ))}
      </g>,
    )
    x += DIGIT_W + DIGIT_GAP
  })
  const width = Math.max(1, x - DIGIT_GAP)
  return (
    <svg
      className={cn("dash-seg", className)}
      viewBox={`-0.5 -0.5 ${width + 1} 19`}
      role="img"
      aria-label={label ?? value}
      style={{ aspectRatio: `${width + 1} / 19` }}
    >
      {glyphs}
    </svg>
  )
}

/**
 * A reading such as `7h 12m`, `+12`, `72°` or `2h14`. Runs the tube can draw
 * become segment digits; the rest (units, degree marks) are small printed
 * legends beside them, as on a real cluster.
 */
export function DashReading({ text, className }: { text: string; className?: string }) {
  const runs: { seg: boolean; text: string }[] = []
  for (const ch of text) {
    const drawable = /[\d:./\-—]/.test(ch)
    const last = runs[runs.length - 1]
    if (last && last.seg === drawable) last.text += ch
    else runs.push({ seg: drawable, text: ch })
  }
  return (
    <span className={cn("dash-reading", className)} aria-label={text} role="img">
      {runs.map((run, i) =>
        run.seg ? (
          <SegDigits key={i} value={run.text} label="" />
        ) : (
          <span key={i} className="dash-unit" aria-hidden="true">
            {run.text.trim()}
          </span>
        ),
      )}
    </span>
  )
}

/* ---- Arcs --------------------------------------------------------------- */

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function segmentPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const p0 = polar(cx, cy, r1, a0)
  const p1 = polar(cx, cy, r1, a1)
  const p2 = polar(cx, cy, r0, a1)
  const p3 = polar(cx, cy, r0, a0)
  const large = a1 - a0 > 180 ? 1 : 0
  return [
    `M${p0.x.toFixed(2)} ${p0.y.toFixed(2)}`,
    `A${r1} ${r1} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `L${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `A${r0} ${r0} 0 ${large} 0 ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    "Z",
  ].join(" ")
}

/**
 * An arc of separate segments, lit from the start up to `value` (0–1). The
 * Oldsmobile FUEL and TEMP gauges: short fat blocks with a hairline gap,
 * `lo` and `hi` stamped at the two ends. `marker` lights one segment only,
 * for a position rather than an amount (the sun across the day).
 */
export function ArcGauge({
  value,
  segments = 12,
  from = -110,
  to = 110,
  lo,
  hi,
  marker = false,
  className,
  children,
}: {
  value: number
  segments?: number
  from?: number
  to?: number
  lo?: string
  hi?: string
  marker?: boolean
  className?: string
  /** Centered under the arc, usually a reading. */
  children?: ReactNode
}) {
  const v = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
  const lit = marker ? Math.min(segments - 1, Math.floor(v * segments)) : Math.round(v * segments)
  const step = (to - from) / segments
  const gap = Math.min(2.2, step * 0.22)
  const cx = 50
  const cy = 50
  const start = polar(cx, cy, 40, from)
  const end = polar(cx, cy, 40, to)
  return (
    <span className={cn("dash-arc", className)}>
      <svg viewBox="0 0 100 64" aria-hidden="true">
        {Array.from({ length: segments }, (_, i) => {
          const on = marker ? i === lit : i < lit
          return (
            <path
              key={i}
              d={segmentPath(cx, cy, 33, 45, from + i * step + gap / 2, from + (i + 1) * step - gap / 2)}
              className={on ? "dash-seg-on" : "dash-seg-off"}
            />
          )
        })}
        {lo ? (
          <text x={start.x} y={Math.min(63, start.y + 13)} className="dash-arc-end" textAnchor="middle">
            {lo}
          </text>
        ) : null}
        {hi ? (
          <text x={end.x} y={Math.min(63, end.y + 13)} className="dash-arc-end" textAnchor="middle">
            {hi}
          </text>
        ) : null}
      </svg>
      {children ? <span className="dash-arc-center">{children}</span> : null}
    </span>
  )
}

/* ---- Bars --------------------------------------------------------------- */

/** A row of separate blocks, lit left to right. The Oldsmobile RPM foot. */
export function BarMeter({
  value,
  segments = 10,
  className,
  label,
}: {
  value: number
  segments?: number
  className?: string
  label?: string
}) {
  const v = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
  const lit = Math.round(v * segments)
  return (
    <span className={cn("dash-bar", className)} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      {Array.from({ length: segments }, (_, i) => (
        <i key={i} className={i < lit ? "is-on" : undefined} />
      ))}
    </span>
  )
}

/**
 * The Prius fuel stair: short bars that grow wider as they climb. Lit from
 * the bottom up to `value`.
 */
export function StairMeter({ value, steps = 6, className }: { value: number; steps?: number; className?: string }) {
  const v = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
  const lit = Math.round(v * steps)
  return (
    <span className={cn("dash-stair", className)} aria-hidden="true">
      {Array.from({ length: steps }, (_, i) => {
        const rung = steps - 1 - i
        return <i key={rung} className={rung < lit ? "is-on" : undefined} style={{ width: `${40 + (60 * (rung + 1)) / steps}%` }} />
      })}
    </span>
  )
}

/* ---- Selector, lamp, legend -------------------------------------------- */

/**
 * The Prius P R N D column: every choice printed, the live one boxed. Not a
 * control on the face; it tells which mode the reading is in.
 */
export function DashSelector({
  options,
  active,
  className,
}: {
  options: readonly string[]
  active: string
  className?: string
}) {
  return (
    <span className={cn("dash-selector", className)} aria-label={`Showing ${active}`} role="img">
      {options.map((option) => (
        <b key={option} className={option === active ? "is-on" : undefined} aria-hidden="true">
          {option}
        </b>
      ))}
    </span>
  )
}

/** A small round indicator. Lit takes the copy's lamp color. */
export function DashLamp({ on = true, className }: { on?: boolean; className?: string }) {
  return <i className={cn("dash-lamp", on && "is-on", className)} aria-hidden="true" />
}

/** Words on the glass in the dot-matrix face (DotGothic16). */
export function DashWord({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span className={cn("dash-word", className)} title={title}>
      {children}
    </span>
  )
}

/* ---- Pictograms --------------------------------------------------------- */

export type DashPictoName =
  | "progress"
  | "rituals"
  | "points"
  | "award"
  | "pet"
  | "moon"
  | "flag"
  | "language"
  | "affirmation"
  | "sun"
  | "cloud"
  | "rain"
  | "next"
  | "lamp"
  | "harvest"
  | "inbox"
  | "flow"
  | "paint"
  | "tracking"
  | "night"
  | "sunset"
  | "budget"

/** One stroke weight, 16px box, square caps: Prius line icons. */
const PICTO: Record<DashPictoName, ReactNode> = {
  progress: <path d="M2 9l3.5 3.5L14 4" />,
  rituals: (
    <>
      <path d="M8 2c1.4 1.6 1.4 3 0 4-1.4-1-1.4-2.4 0-4z" />
      <path d="M5.5 7.5h5v6.5h-5z" />
    </>
  ),
  points: <path d="M9 1.5L3.5 9h4l-1 5.5L12.5 7h-4z" />,
  award: <path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" />,
  pet: (
    <>
      <path d="M3 6.5V3.5l2.5 2h5L13 3.5v3" />
      <path d="M3 6.5h10v6H3z" />
      <path d="M6 9h.01M10 9h.01" />
    </>
  ),
  moon: <path d="M10.5 2.2a6 6 0 1 0 3.3 9.8A5 5 0 0 1 10.5 2.2z" />,
  flag: (
    <>
      <path d="M3.5 14.5v-12" />
      <path d="M3.5 2.5h9l-2 3 2 3h-9" />
    </>
  ),
  language: (
    <>
      <path d="M2 3.5h7M5.5 2v1.5M3.5 3.5c.5 2.5 2.5 4.5 5 5.5M7.5 3.5c-.5 2.5-2.5 4.5-5 5.5" />
      <path d="M8.5 14l2.5-6 2.5 6M9.3 12.2h3.4" />
    </>
  ),
  affirmation: (
    <>
      <path d="M2.5 3.5h11v7h-6l-3 3v-3h-2z" />
    </>
  ),
  sun: (
    <>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
    </>
  ),
  cloud: <path d="M4.5 12.5h7.5a2.5 2.5 0 0 0 0-5 3.5 3.5 0 0 0-6.8-.8A2.9 2.9 0 0 0 4.5 12.5z" />,
  rain: (
    <>
      <path d="M4.5 9.5h7.5a2.5 2.5 0 0 0 0-5 3.5 3.5 0 0 0-6.8-.8A2.9 2.9 0 0 0 4.5 9.5z" />
      <path d="M5 11.5l-1 2.5M8.5 11.5l-1 2.5M12 11.5l-1 2.5" />
    </>
  ),
  next: <path d="M2.5 8h10M9 4.5L12.5 8 9 11.5" />,
  lamp: (
    <>
      <path d="M5.5 10.5a4 4 0 1 1 5 0v2h-5z" />
      <path d="M6.5 14.5h3" />
    </>
  ),
  harvest: <path d="M8 14.5V7M8 7c0-3 2-4.5 5-4.5 0 3-2 4.5-5 4.5zM8 10c0-2.4-1.6-3.6-4-3.6 0 2.4 1.6 3.6 4 3.6z" />,
  inbox: (
    <>
      <path d="M2.5 9.5l1.5-6h8l1.5 6v4h-11z" />
      <path d="M2.5 9.5h3.5l.8 1.5h2.4l.8-1.5h3.5" />
    </>
  ),
  flow: <path d="M1.5 6c2-2 4-2 6.5 0s4.5 2 6.5 0M1.5 10.5c2-2 4-2 6.5 0s4.5 2 6.5 0" />,
  paint: (
    <>
      <path d="M2.5 13.5h11M4 13.5V8h2.5v5.5M8.5 13.5V4.5H11v9" />
    </>
  ),
  tracking: (
    <>
      <path d="M8 14.5s-4.5-4.4-4.5-7.5a4.5 4.5 0 0 1 9 0c0 3.1-4.5 7.5-4.5 7.5z" />
      <circle cx="8" cy="7" r="1.5" />
    </>
  ),
  night: (
    <>
      <path d="M1.5 12.5V5M1.5 10h13v2.5M14.5 10V8a1.5 1.5 0 0 0-1.5-1.5H7v3.5" />
      <circle cx="4" cy="8" r="1.2" />
    </>
  ),
  sunset: (
    <>
      <path d="M1.5 12.5h13M4.5 12.5a3.5 3.5 0 0 1 7 0M8 3.5v3M5.8 6.2L8 8.5l2.2-2.3" />
    </>
  ),
  budget: (
    <>
      <path d="M1.5 4.5h13v8h-13zM1.5 7.5h13" />
      <path d="M10.5 10h2" />
    </>
  ),
}

export function DashPicto({ name, className }: { name: DashPictoName; className?: string }) {
  return (
    <svg className={cn("dash-picto", className)} viewBox="0 0 16 16" aria-hidden="true">
      {PICTO[name]}
    </svg>
  )
}

/* ---- Pixel pet and moon ------------------------------------------------- */

export type DashPetPose = "asleep" | "idle" | "pleased"

/**
 * The screen pet, redrawn as LCD pixels. Same body and the same three poses
 * as the Milled sprite in `home-screen-pet.tsx`.
 */
export function DashPet({ pose, night, className }: { pose: DashPetPose; night?: boolean; className?: string }) {
  const marks: [number, number, number, number][] =
    pose === "pleased"
      ? [[5, 8, 2, 1], [9, 8, 2, 1], [6, 7, 1, 1], [9, 7, 1, 1], [7, 10, 2, 1]]
      : pose === "asleep"
        ? [[5, 8, 2, 1], [9, 8, 2, 1]]
        : [[5, 7, 2, 2], [9, 7, 2, 2], [7, 10, 2, 1]]
  return (
    <svg className={cn("dash-pet", className)} viewBox="0 0 16 16" data-pose={pose} aria-hidden="true" shapeRendering="crispEdges">
      <g className="dash-pet-body">
        <rect x="4" y="6" width="8" height="6" />
        <rect x="5" y="5" width="6" height="1" />
        <rect x="4" y="4" width="2" height="2" />
        <rect x="10" y="4" width="2" height="2" />
        <rect x="5" y="12" width="2" height="2" />
        <rect x="9" y="12" width="2" height="2" />
      </g>
      <g className="dash-pet-mark">
        {marks.map(([x, y, w, h]) => (
          <rect key={`${x}:${y}`} x={x} y={y} width={w} height={h} />
        ))}
      </g>
      {pose === "asleep" ? (
        <g className="dash-pet-z">
          <rect x="13" y="3" width="1" height="1" />
          <rect x="14" y="2" width="1" height="1" />
          <rect x="14" y="5" width="1" height="1" />
        </g>
      ) : null}
      {night ? <rect className="dash-pet-z" x="1" y="1" width="2" height="2" /> : null}
    </svg>
  )
}

/** The moon as an outline with the lit part filled, like the Prius car outline. */
export function DashMoon({ litPath, className }: { litPath: string; className?: string }) {
  return (
    <svg className={cn("dash-moon", className)} viewBox="18 18 64 64" aria-hidden="true">
      <circle cx="50" cy="50" r="28" className="dash-moon-rim" />
      {litPath ? <path d={litPath} className="dash-moon-lit" /> : null}
    </svg>
  )
}

/* ---- Trace -------------------------------------------------------------- */

/**
 * A thin line over a period, the Prius consumption screen. The previous
 * value is a dotted rule. Purely a picture; the numbers are elsewhere.
 */
export function DashTrace({ values, previous, className }: { values: number[]; previous?: number; className?: string }) {
  const w = 100
  const h = 30
  const all = previous != null ? [...values, previous] : values
  const max = Math.max(...all, 0)
  const min = Math.min(...all, 0)
  const span = max - min || 1
  const y = (v: number) => 2 + (h - 4) * (1 - (v - min) / span)
  const x = (i: number) => (values.length <= 1 ? w / 2 : (i / (values.length - 1)) * w)
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")
  return (
    <svg className={cn("dash-trace", className)} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {previous != null ? (
        <line x1="0" x2={w} y1={y(previous)} y2={y(previous)} className="dash-trace-prev" vectorEffect="non-scaling-stroke" />
      ) : null}
      {line ? <path d={line} className="dash-trace-line" vectorEffect="non-scaling-stroke" /> : null}
    </svg>
  )
}

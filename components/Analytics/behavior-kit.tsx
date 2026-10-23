/**
 * components/Analytics/behavior-kit.tsx — Small plates for the Behavior views
 *
 * Shared by Reflection, To-do pulse, Reviews, Seasons and Overcommit. Plain
 * SVG and HTML so the view tests do not need a recharts mock. Ideas come from
 * Information is Beautiful (`docs/analytics/viz-inspiration.md`): mirror
 * split, evidence bubbles, quadrant scatter, sized squares, word tiles.
 * Skin comes from `behavior-views.css` and the house kit.
 */
"use client"

import { useId, useMemo, useState, type ReactNode } from "react"
import "./behavior-views.css"

/** Data fills for these views. Muted, distinct, readable on white wells. */
export const BEHAVIOR_FILL = {
  a: "#1a6b5c",
  b: "#c4622d",
  c: "#4a7eaa",
  d: "#b8860b",
  e: "#7a4a8c",
  quiet: "#9a9a9a",
} as const

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = values.slice().sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function round1(value: number): string {
  const r = Math.round(value * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/** Folded section. Long lists and help text start closed unless asked. */
export function Fold({
  title,
  count,
  defaultOpen = false,
  children,
  testId,
}: {
  title: ReactNode
  count?: number
  defaultOpen?: boolean
  children: ReactNode
  testId?: string
}) {
  return (
    <details className="an-fold" open={defaultOpen} data-testid={testId}>
      <summary>
        <span>{title}</span>
        {count != null ? <span className="an-n">{count}</span> : null}
      </summary>
      <div className="an-fold-body">{children}</div>
    </details>
  )
}

export function SearchField({
  value,
  onChange,
  label = "Search",
  placeholder = "Filter…",
}: {
  value: string
  onChange: (next: string) => void
  label?: string
  placeholder?: string
}) {
  const id = useId()
  return (
    <label className="an-studio-field an-bx-search" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  shown,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (next: number) => void
  shown?: string
}) {
  const id = useId()
  return (
    <label className="an-studio-field an-bx-range" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="an-n">{shown ?? value}</span>
    </label>
  )
}

/** Chip toggle row. `value` null means all. */
export function ChipFilter<T extends string>({
  options,
  value,
  onChange,
  allLabel = "All",
}: {
  options: { id: T; label: string; count?: number }[]
  value: T | null
  onChange: (next: T | null) => void
  allLabel?: string
}) {
  return (
    <div className="an-bx-chips" role="group">
      <button type="button" className="an-chip" aria-pressed={value === null} onClick={() => onChange(null)}>
        {allLabel}
      </button>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className="an-chip"
          aria-pressed={value === o.id}
          onClick={() => onChange(value === o.id ? null : o.id)}
        >
          {o.label}
          {o.count != null ? ` ${o.count}` : ""}
        </button>
      ))}
    </div>
  )
}

/** Show the first `step` rows, then a button for more. */
export function useShowMore<T>(rows: T[], step = 8) {
  const [limit, setLimit] = useState(step)
  const shown = rows.slice(0, limit)
  const rest = rows.length - shown.length
  const more =
    rest > 0 ? (
      <button type="button" className="an-chip an-bx-more" onClick={() => setLimit((l) => l + step * 2)}>
        Show {Math.min(rest, step * 2)} more of {rest}
      </button>
    ) : null
  return { shown, more }
}

export interface MirrorRow {
  id: string
  name: string
  left: number
  right: number
  note?: string
}

/** Mirror split: left bars grow left, right bars grow right, from one spine. */
export function MirrorSplit({
  rows,
  leftLabel,
  rightLabel,
  max,
  format = round1,
  onSelect,
}: {
  rows: MirrorRow[]
  leftLabel: string
  rightLabel: string
  max?: number
  format?: (v: number) => string
  onSelect?: (id: string) => void
}) {
  const domain = Math.max(max ?? 0, ...rows.flatMap((r) => [r.left, r.right]), 1)
  return (
    <div className="an-mirror" role="table" aria-label={`${leftLabel} against ${rightLabel}`}>
      <div className="an-mirror-head" role="row">
        <span role="columnheader">{leftLabel}</span>
        <span role="columnheader" />
        <span role="columnheader">{rightLabel}</span>
      </div>
      {rows.map((r) => {
        const diff = r.right - r.left
        const tone = diff > 0 ? "up" : diff < 0 ? "down" : "same"
        return (
          <div
            key={r.id}
            className="an-mirror-row"
            data-tone={tone}
            role="row"
            title={`${r.name}: ${leftLabel} ${format(r.left)} · ${rightLabel} ${format(r.right)} · Δ ${diff > 0 ? "+" : ""}${format(diff)}`}
            onClick={onSelect ? () => onSelect(r.id) : undefined}
          >
            <span className="an-mirror-side is-left" role="cell">
              <span className="an-mirror-val">{format(r.left)}</span>
              <span className="an-mirror-bar" style={{ width: `${(r.left / domain) * 100}%` }} />
            </span>
            <span className="an-mirror-name" role="cell">
              {r.name}
              {r.note ? <span className="an-n"> {r.note}</span> : null}
            </span>
            <span className="an-mirror-side is-right" role="cell">
              <span className="an-mirror-bar" style={{ width: `${(r.right / domain) * 100}%` }} />
              <span className="an-mirror-val">{format(r.right)}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

export interface BubblePoint {
  id: string
  x: number
  y: number
  /** Size weight; radius is scaled by √size. */
  size?: number
  label: string
  color?: string
}

/**
 * Evidence-bubble / quadrant scatter on a white well. Jitter keeps ties on
 * 0–10 scales visible. Corner labels name the quadrants when given.
 */
export function BubblePlot({
  points,
  xDomain,
  yDomain,
  xLabel,
  yLabel,
  refX,
  refY,
  corners,
  onSelect,
  height = 260,
}: {
  points: BubblePoint[]
  xDomain: [number, number]
  yDomain: [number, number]
  xLabel: string
  yLabel: string
  refX?: number | null
  refY?: number | null
  /** [top-left, top-right, bottom-left, bottom-right]. */
  corners?: [string, string, string, string]
  onSelect?: (id: string) => void
  height?: number
}) {
  const W = 560
  const H = height
  const pad = { l: 40, r: 14, t: 14, b: 34 }
  const [hover, setHover] = useState<string | null>(null)
  const sx = (v: number) => pad.l + ((v - xDomain[0]) / (xDomain[1] - xDomain[0] || 1)) * (W - pad.l - pad.r)
  const sy = (v: number) => H - pad.b - ((v - yDomain[0]) / (yDomain[1] - yDomain[0] || 1)) * (H - pad.t - pad.b)
  const maxSize = Math.max(1, ...points.map((p) => p.size ?? 1))
  const placed = useMemo(() => {
    const seen = new Map<string, number>()
    return points.map((p) => {
      const k = `${p.x}|${p.y}`
      const i = seen.get(k) ?? 0
      seen.set(k, i + 1)
      const angle = i * 2.399
      const spread = i === 0 ? 0 : 3 + Math.sqrt(i) * 3
      return {
        ...p,
        cx: sx(p.x) + Math.cos(angle) * spread,
        cy: sy(p.y) + Math.sin(angle) * spread,
        r: 4 + Math.sqrt((p.size ?? 1) / maxSize) * 12,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, xDomain[0], xDomain[1], yDomain[0], yDomain[1], maxSize, H])
  const ticks = (d: [number, number]) => {
    const span = d[1] - d[0]
    const step = span <= 10 ? (span <= 5 ? 1 : 2) : Math.ceil(span / 5)
    const out: number[] = []
    for (let v = d[0]; v <= d[1] + 1e-9; v += step) out.push(Math.round(v * 10) / 10)
    return out
  }
  const hovered = placed.find((p) => p.id === hover)
  return (
    <div className="an-plot-well an-bubble">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLabel} by ${xLabel}, ${points.length} points`}>
        {ticks(xDomain).map((v) => (
          <g key={`x${v}`}>
            <line x1={sx(v)} x2={sx(v)} y1={pad.t} y2={H - pad.b} className="an-bubble-grid" />
            <text x={sx(v)} y={H - pad.b + 14} textAnchor="middle" className="an-bubble-tick">
              {v}
            </text>
          </g>
        ))}
        {ticks(yDomain).map((v) => (
          <g key={`y${v}`}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(v)} y2={sy(v)} className="an-bubble-grid" />
            <text x={pad.l - 6} y={sy(v) + 4} textAnchor="end" className="an-bubble-tick">
              {v}
            </text>
          </g>
        ))}
        {refX != null && <line x1={sx(refX)} x2={sx(refX)} y1={pad.t} y2={H - pad.b} className="an-bubble-ref" />}
        {refY != null && <line x1={pad.l} x2={W - pad.r} y1={sy(refY)} y2={sy(refY)} className="an-bubble-ref" />}
        {corners && (
          <g className="an-bubble-corner">
            <text x={pad.l + 6} y={pad.t + 12}>
              {corners[0]}
            </text>
            <text x={W - pad.r - 6} y={pad.t + 12} textAnchor="end">
              {corners[1]}
            </text>
            <text x={pad.l + 6} y={H - pad.b - 6}>
              {corners[2]}
            </text>
            <text x={W - pad.r - 6} y={H - pad.b - 6} textAnchor="end">
              {corners[3]}
            </text>
          </g>
        )}
        <text x={(W + pad.l) / 2} y={H - 4} textAnchor="middle" className="an-bubble-axis">
          {xLabel} →
        </text>
        <text
          x={12}
          y={(H - pad.b) / 2}
          textAnchor="middle"
          className="an-bubble-axis"
          transform={`rotate(-90 12 ${(H - pad.b) / 2})`}
        >
          {yLabel} →
        </text>
        {placed.map((p) => (
          <circle
            key={p.id}
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            fill={p.color ?? BEHAVIOR_FILL.a}
            className={hover && hover !== p.id ? "an-bubble-dot is-dim" : "an-bubble-dot"}
            onMouseEnter={() => setHover(p.id)}
            onMouseLeave={() => setHover(null)}
            onClick={onSelect ? () => onSelect(p.id) : undefined}
          >
            <title>{p.label}</title>
          </circle>
        ))}
      </svg>
      <p className="an-canvas-hint an-bubble-read" aria-live="polite">
        {hovered ? hovered.label : "Hover a bubble to read it."}
      </p>
    </div>
  )
}

/** Sized squares: area ∝ value. Biggest first, wraps like a field of tiles. */
export function SizedSquares({
  items,
  unit,
  onSelect,
  maxPx = 96,
}: {
  items: {
    id: string
    label: string
    value: number
    color?: string
    note?: string
  }[]
  unit: string
  onSelect?: (id: string) => void
  maxPx?: number
}) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="an-squares">
      {items.map((i) => {
        const side = Math.max(14, Math.sqrt(i.value / max) * maxPx)
        return (
          <button
            key={i.id}
            type="button"
            className="an-square"
            title={`${i.label} · ${i.value} ${unit}${i.note ? ` · ${i.note}` : ""}`}
            onClick={onSelect ? () => onSelect(i.id) : undefined}
          >
            <span
              className="an-square-box"
              style={{
                width: side,
                height: side,
                background: i.color ?? BEHAVIOR_FILL.b,
              }}
            >
              {side >= 30 ? i.value : ""}
            </span>
            <span className="an-square-label">{i.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Word tiles: font size by frequency. */
export function WordTiles({ words }: { words: { word: string; count: number }[] }) {
  const max = Math.max(1, ...words.map((w) => w.count))
  return (
    <p className="an-words">
      {words.map((w) => (
        <span key={w.word} style={{ fontSize: `${11 + (w.count / max) * 13}px` }} title={`${w.word} × ${w.count}`}>
          {w.word}
          <sup>{w.count}</sup>
        </span>
      ))}
    </p>
  )
}

const STOP = new Set(
  "a an and are as at be but by for from had has have i i'm im in is it it's its just me my of on or so that the this to was were with you your am very really all more much our we they them there then than not no do did can will would could should get got being been out up about into over after before because what when which who how".split(
    " ",
  ),
)

/** Word counts for short free text, stop words dropped. */
export function topWords(texts: string[], limit = 30): { word: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const t of texts) {
    for (const raw of t.toLowerCase().split(/[^a-z0-9'’-]+/)) {
      const w = raw.replace(/^['’-]+|['’-]+$/g, "")
      if (w.length < 3 || STOP.has(w)) continue
      counts.set(w, (counts.get(w) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit)
}

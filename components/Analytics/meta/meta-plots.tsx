/**
 * components/Analytics/meta-plots.tsx — SVG plates shared by the Meta views
 *
 * ForestPlot (r with Fisher-z whiskers, area = n), Correlogram (r(k) bars with
 * the white-noise band), LogPeriodogram (power on a log period axis with the
 * week and month named), DivergingCell fill. Ink comes from the paper tokens;
 * fills stay data. Docs: `docs/analytics/meta-*.md`.
 */
"use client"

import { fisherInterval } from "./meta-math"
import "./analytics-meta.css"

/** Light-paper diverging ramp for r: teal up, brick down, paper at 0. */
export function divergingFill(r: number): { fill: string; ink: string } {
  const t = Math.min(1, Math.abs(r))
  const hue = r >= 0 ? 172 : 10
  const light = 94 - t * 52
  return { fill: `hsl(${hue} ${30 + t * 45}% ${light}%)`, ink: light < 58 ? "#ffffff" : "#14171c" }
}

/** Light-paper sequential ramp: zero is a faint wash, more is darker. */
export function sequentialFill(hue: number, t: number): string {
  const k = Math.max(0, Math.min(1, t))
  return `hsl(${hue} ${28 + k * 50}% ${90 - k * 56}%)`
}

export interface ForestRow {
  id: string
  label: string
  r: number
  n: number
  thin: boolean
}

export function ForestPlot({
  rows,
  floor,
  notice = 0.3,
  onPick,
  activeId,
}: {
  rows: readonly ForestRow[]
  floor: number
  /** |r| at or past this gets the shaded "worth noticing" band. */
  notice?: number
  onPick?: (id: string) => void
  activeId?: string | null
}) {
  const rowH = 26
  const padL = 190
  const padR = 64
  const w = 640
  const top = 22
  const h = top + rows.length * rowH + 22
  const innerW = w - padL - padR
  const x = (r: number) => padL + ((r + 1) / 2) * innerW
  const maxN = Math.max(...rows.map((r) => r.n), floor)
  const rad = (n: number) => 3 + Math.sqrt(n / maxN) * 8
  return (
    <svg className="an-meta-svg" viewBox={`0 0 ${w} ${h}`} role="group" aria-label="Forest plot of Pearson r with 95% intervals">
      <rect x={x(-1)} y={top - 6} width={x(-notice) - x(-1)} height={h - top - 10} className="an-meta-band" />
      <rect x={x(notice)} y={top - 6} width={x(1) - x(notice)} height={h - top - 10} className="an-meta-band" />
      {[-1, -0.5, 0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={top - 6} y2={h - 16} className={t === 0 ? "an-meta-axis" : "an-meta-grid"} />
          <text x={x(t)} y={h - 4} textAnchor="middle" className="an-meta-tick">
            {t > 0 ? `+${t}` : t}
          </text>
        </g>
      ))}
      <text x={x(-1)} y={10} className="an-meta-tick">inverse</text>
      <text x={x(1)} y={10} textAnchor="end" className="an-meta-tick">together</text>
      {rows.map((row, i) => {
        const cy = top + i * rowH + rowH / 2
        const ci = fisherInterval(row.r, row.n)
        const active = activeId === row.id
        const name = `${row.label}: r = ${row.r.toFixed(2)}, n = ${row.n}${ci ? `, 95% CI ${ci.lo.toFixed(2)} to ${ci.hi.toFixed(2)}` : ""}`
        return (
          <g
            key={row.id}
            className={`an-meta-row${active ? " is-active" : ""}${onPick ? " is-pickable" : ""}`}
            onClick={onPick ? () => onPick(row.id) : undefined}
            role={onPick ? "button" : undefined}
            tabIndex={onPick ? 0 : undefined}
            aria-pressed={onPick ? active : undefined}
            aria-label={name}
            onKeyDown={
              onPick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onPick(row.id)
                    }
                  }
                : undefined
            }
          >
            <title>{name}</title>
            <rect x={0} y={cy - rowH / 2} width={w} height={rowH} className="an-meta-hit" />
            <text x={padL - 10} y={cy + 4} textAnchor="end" className="an-meta-label">
              {row.label}
            </text>
            {ci ? <line x1={x(ci.lo)} x2={x(ci.hi)} y1={cy} y2={cy} className="an-meta-whisker" /> : null}
            <circle
              cx={x(row.r)}
              cy={cy}
              r={rad(row.n)}
              className={row.thin ? "an-meta-dot is-thin" : "an-meta-dot"}
              style={row.thin ? undefined : { fill: divergingFill(row.r).fill }}
            />
            <text x={w - padR + 8} y={cy + 4} className="an-meta-num">
              {row.r >= 0 ? "+" : ""}
              {row.r.toFixed(2)} · {row.n}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function Correlogram({
  bars,
  band,
  marks = [7],
}: {
  bars: readonly { k: number; r: number }[]
  band: number
  marks?: readonly number[]
}) {
  const w = 640
  const h = 170
  const pad = { l: 34, r: 10, t: 10, b: 24 }
  const innerW = w - pad.l - pad.r
  const innerH = h - pad.t - pad.b
  const y = (r: number) => pad.t + innerH / 2 - (r * innerH) / 2
  const slot = innerW / Math.max(bars.length, 1)
  return (
    <svg className="an-meta-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Autocorrelation by lag">
      <rect x={pad.l} y={y(band)} width={innerW} height={y(-band) - y(band)} className="an-meta-band" />
      {[-1, -0.5, 0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? "an-meta-axis" : "an-meta-grid"} />
          <text x={pad.l - 4} y={y(t) + 3} textAnchor="end" className="an-meta-tick">
            {t}
          </text>
        </g>
      ))}
      {bars.map((b, i) => {
        const cx = pad.l + i * slot + slot / 2
        const out = Math.abs(b.r) > band
        const marked = marks.some((m) => b.k % m === 0)
        return (
          <g key={b.k}>
            <title>{`lag ${b.k} d: r = ${b.r.toFixed(2)}${out ? " (outside the noise band)" : ""}`}</title>
            <rect
              x={cx - Math.max(1.5, slot * 0.32)}
              width={Math.max(3, slot * 0.64)}
              y={Math.min(y(b.r), y(0))}
              height={Math.abs(y(b.r) - y(0))}
              className={out ? "an-meta-bar is-out" : "an-meta-bar"}
            />
            {marked || i === 0 || i === bars.length - 1 ? (
              <text x={cx} y={h - 8} textAnchor="middle" className={marked ? "an-meta-tick is-named" : "an-meta-tick"}>
                {b.k}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

const NAMED_PERIODS = [
  { d: 2, label: "2 d" },
  { d: 3.5, label: "½ wk" },
  { d: 7, label: "week" },
  { d: 14, label: "2 wk" },
  { d: 28, label: "month" },
  { d: 91, label: "quarter" },
  { d: 365, label: "year" },
]

export function LogPeriodogram({
  bins,
}: {
  bins: readonly { period: number; power: number }[]
}) {
  const w = 640
  const h = 170
  const pad = { l: 10, r: 10, t: 18, b: 26 }
  const innerW = w - pad.l - pad.r
  const innerH = h - pad.t - pad.b
  const pMin = 2
  const pMax = Math.max(14, ...bins.map((b) => b.period))
  const x = (p: number) => pad.l + ((Math.log(p) - Math.log(pMin)) / (Math.log(pMax) - Math.log(pMin))) * innerW
  const maxPow = Math.max(...bins.map((b) => b.power), 1e-9)
  const y = (pw: number) => pad.t + innerH - (pw / maxPow) * innerH
  const peak = bins.reduce<{ period: number; power: number } | null>((best, b) => (!best || b.power > best.power ? b : best), null)
  return (
    <svg className="an-meta-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Periodogram on a log period axis">
      <line x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} className="an-meta-axis" />
      {NAMED_PERIODS.filter((m) => m.d >= pMin && m.d <= pMax).map((m) => (
        <g key={m.d}>
          <line x1={x(m.d)} x2={x(m.d)} y1={pad.t} y2={y(0)} className="an-meta-grid" />
          <text x={x(m.d)} y={h - 8} textAnchor="middle" className="an-meta-tick is-named">
            {m.label}
          </text>
        </g>
      ))}
      {bins
        .filter((b) => b.period >= pMin)
        .map((b) => (
          <g key={b.period}>
            <title>{`${b.period.toFixed(1)} d: power ${b.power.toFixed(1)}`}</title>
            <line x1={x(b.period)} x2={x(b.period)} y1={y(0)} y2={y(b.power)} className="an-meta-stem" />
            <circle cx={x(b.period)} cy={y(b.power)} r={2.4} className="an-meta-stem-dot" />
          </g>
        ))}
      {peak ? (
        <text
          x={x(peak.period)}
          y={Math.max(10, y(peak.power) - 6)}
          textAnchor={x(peak.period) > w - 60 ? "end" : x(peak.period) < 60 ? "start" : "middle"}
          className="an-meta-num"
        >
          {`peak ${peak.period.toFixed(1)} d`}
        </text>
      ) : null}
    </svg>
  )
}

/**
 * components/Analytics/studio-plots.tsx — Horizon, ridgeline, violin, alluvial,
 * beeswarm, slopegraph, UpSet, small multiples, Cleveland cycle, sparkline.
 *
 * Phosphor is for traces only. These canvases sit in Win95 wells on gray face.
 */
"use client"

import { ChartFrame } from "./chart-frame"
import { CanvasTitle, STUDIO_AXIS, STUDIO_EMPTY } from "./studio-kit"
import {
  WEEKDAY_SHORT,
  beeswarmOffsets,
  histogram,
  horizonBands,
  kernelDensityEstimate,
  layoutAlluvial,
  median,
  quantile,
  type AlluvialFlow,
  type SlopeRow,
  type UpsetRow,
} from "./studio-plot-stats"
import { hourLabel } from "./hour-day"

function linspace(min: number, max: number, n: number): number[] {
  if (n <= 1) return [min]
  const span = max - min || 1
  return Array.from({ length: n }, (_, i) => min + (span * i) / (n - 1))
}

export function HorizonChart({
  values,
  labels,
  empty,
  title,
  help,
}: {
  values: number[]
  labels?: string[]
  empty?: string
  title: string
  help: string
}) {
  if (values.length === 0) {
    return (
      <div>
        <CanvasTitle title={title} help={help} />
        <ChartFrame empty emptySentence={empty ?? "No series to fold."} />
      </div>
    )
  }
  const layers = horizonBands(values, 3, 100)
  const fills = ["#8fbfb0", "#3d8a78", "#0e4a40"]
  return (
    <div>
      <CanvasTitle title={title} help={help} />
      <div className="an-horizon" role="img" aria-label={title}>
        {values.map((v, i) => (
          <div
            key={labels?.[i] ?? i}
            className="an-horizon-col"
            title={`${labels?.[i] ?? i}: ${Math.round(v)}%`}
          >
            {layers.map((band, L) => (
              <span
                key={L}
                className="an-horizon-band"
                style={{ background: fills[L], opacity: band[i] }}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="an-canvas-hint">
        Three horizon layers of 0–33 / 33–66 / 66–100%. Darker overlap means a higher day.
      </p>
    </div>
  )
}

export function RidgelineChart({
  ridges,
  unit,
  empty,
  title,
  help,
}: {
  ridges: { label: string; values: number[] }[]
  unit?: string
  empty?: string
  title: string
  help: string
}) {
  const used = ridges.filter((r) => r.values.length > 0)
  if (used.length === 0) {
    return (
      <div>
        <CanvasTitle title={title} help={help} />
        <ChartFrame empty emptySentence={empty ?? "Nothing to ridge yet."} />
      </div>
    )
  }
  const all = used.flatMap((r) => r.values)
  const min = Math.min(...all)
  const max = Math.max(...all)
  const pad = Math.max(1, (max - min) * 0.12)
  const xs = linspace(min - pad, max + pad, 48)
  return (
    <div>
      <CanvasTitle title={title} help={help} />
      <div className="an-ridge" role="img" aria-label={title}>
        {ridges.map((ridge) => {
          const dens = kernelDensityEstimate(ridge.values, xs)
          const peak = Math.max(...dens, 1e-9)
          const d = dens
            .map((y, i) => {
              const x = (i / (xs.length - 1)) * 200
              const yy = 34 - (y / peak) * 28
              return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${yy.toFixed(1)}`
            })
            .join(" ")
          return (
            <div key={ridge.label} className="an-ridge-row">
              <span className="an-ridge-label">{ridge.label}</span>
              <svg className="an-ridge-svg" viewBox="0 0 200 36" preserveAspectRatio="none">
                <path d={`${d} L 200 34 L 0 34 Z`} fill="#3d6b99" opacity={ridge.values.length ? 0.55 : 0.12} />
                <path d={d} fill="none" stroke="#0a2a40" strokeWidth={1} />
              </svg>
            </div>
          )
        })}
      </div>
      <p className="an-quantile">
        n = {all.length}
        {unit ? ` · ${unit}` : ""} · Gaussian KDE, Silverman h. Empty weekdays stay a flat baseline.
      </p>
    </div>
  )
}

export function ViolinHistogram({
  values,
  unit = "m",
  empty,
  title,
  help,
}: {
  values: number[]
  unit?: string
  empty?: string
  title: string
  help: string
}) {
  if (values.length === 0) {
    return (
      <div>
        <CanvasTitle title={title} help={help} />
        <ChartFrame empty emptySentence={empty ?? "No blocks with duration."} />
      </div>
    )
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max(1, (max - min) * 0.08)
  const lo = min - pad
  const hi = max + pad
  const xs = linspace(lo, hi, 60)
  const dens = kernelDensityEstimate(values, xs)
  const dMax = Math.max(...dens, 1e-9)
  const bins = histogram(values)
  const bMax = Math.max(...bins.map((b) => b.count), 1)
  const q1 = quantile(values, 0.25)
  const q2 = median(values)
  const q3 = quantile(values, 0.75)
  const w = 400
  const h = 150
  const padL = 36
  const padR = 8
  const padT = 8
  const padB = 22
  const innerW = w - padL - padR
  const innerH = h - padT - padB
  const xAt = (v: number) => padL + ((v - lo) / (hi - lo || 1)) * innerW
  const violin = dens
    .map((y, i) => {
      const x = xAt(xs[i])
      const half = (y / dMax) * (innerH * 0.42)
      const cy = padT + innerH / 2
      return { x, y0: cy - half, y1: cy + half }
    })
  const top = violin.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y0.toFixed(1)}`).join(" ")
  const bot = [...violin].reverse().map((p) => `L ${p.x.toFixed(1)} ${p.y1.toFixed(1)}`).join(" ")
  return (
    <div>
      <CanvasTitle title={title} help={help} />
      <svg className="an-violin" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title}>
        {bins.map((bin, i) => {
          const x = xAt(bin.start)
          const bw = Math.max(1, xAt(bin.end) - x)
          const bh = (bin.count / bMax) * (innerH * 0.38)
          return (
            <rect
              key={i}
              x={x}
              y={padT + innerH - bh}
              width={bw}
              height={bh}
              fill="#9aa0a6"
              opacity={0.55}
            />
          )
        })}
        <path d={`${top} ${bot} Z`} fill="#1a4a6b" opacity={0.35} />
        <path d={top} fill="none" stroke="#0a2a40" strokeWidth={1.2} />
        <line x1={xAt(q2)} x2={xAt(q2)} y1={padT} y2={padT + innerH} stroke="#000" strokeWidth={1.4} />
        <line x1={xAt(q1)} x2={xAt(q3)} y1={padT + innerH / 2} y2={padT + innerH / 2} stroke="#000" strokeWidth={2} />
        <text x={4} y={h - 6} fill={STUDIO_AXIS} fontSize={9} fontFamily="Karla, sans-serif">
          {Math.round(min)}
          {unit}
        </text>
        <text x={w - padR} y={h - 6} fill={STUDIO_AXIS} fontSize={9} textAnchor="end" fontFamily="Karla, sans-serif">
          {Math.round(max)}
          {unit}
        </text>
      </svg>
      <p className="an-quantile">
        n = {values.length} · median {Math.round(q2)}
        {unit} · IQR {Math.round(q1)}–{Math.round(q3)}
        {unit}. Violin is Gaussian KDE; bars are Freedman–Diaconis bins. Thin n can look smoother than the sample.
      </p>
    </div>
  )
}

function alluvialPath(flow: AlluvialFlow, x0: number, x1: number): string {
  const c = x0 + (x1 - x0) * 0.45
  return [
    `M ${x0} ${flow.y0s}`,
    `C ${c} ${flow.y0s}, ${c} ${flow.y0t}, ${x1} ${flow.y0t}`,
    `L ${x1} ${flow.y1t}`,
    `C ${c} ${flow.y1t}, ${c} ${flow.y1s}, ${x0} ${flow.y1s}`,
    "Z",
  ].join(" ")
}

export function AlluvialChart({
  pens,
  cells,
  empty,
  title,
  help,
}: {
  pens: { id: string; name: string; color: string }[]
  cells: { fromId: string; toId: string; count: number }[]
  empty?: string
  title: string
  help: string
}) {
  const layout = layoutAlluvial(pens, cells, 200)
  if (layout.flows.length === 0) {
    return (
      <div>
        <CanvasTitle title={title} help={help} />
        <ChartFrame empty emptySentence={empty ?? "No pen changes to flow."} />
      </div>
    )
  }
  const w = 420
  const h = 230
  const x0 = 78
  const x1 = 340
  const colorOf = (id: string) => pens.find((p) => p.id === id)?.color ?? "#64748b"
  return (
    <div>
      <CanvasTitle title={title} help={help} />
      <svg className="an-alluvial" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title}>
        {layout.flows.map((f, i) => (
          <path
            key={`${f.fromId}-${f.toId}-${i}`}
            d={alluvialPath(f, x0, x1)}
            fill={colorOf(f.fromId)}
            opacity={0.45}
          >
            <title>{`${f.fromId} → ${f.toId}: ${f.count}`}</title>
          </path>
        ))}
        {layout.sources.map((n) => (
          <g key={`s-${n.id}`}>
            <rect x={x0 - 10} y={n.y0} width={10} height={Math.max(1, n.y1 - n.y0)} fill={n.color} />
            <text x={x0 - 14} y={(n.y0 + n.y1) / 2 + 3} textAnchor="end" fontSize={9} fill="#000" fontFamily="Karla, sans-serif">
              {n.name.slice(0, 10)}
            </text>
          </g>
        ))}
        {layout.targets.map((n) => (
          <g key={`t-${n.id}`}>
            <rect x={x1} y={n.y0} width={10} height={Math.max(1, n.y1 - n.y0)} fill={n.color} />
            <text x={x1 + 14} y={(n.y0 + n.y1) / 2 + 3} fontSize={9} fill="#000" fontFamily="Karla, sans-serif">
              {n.name.slice(0, 10)}
            </text>
          </g>
        ))}
      </svg>
      <p className="an-canvas-hint">
        Width is switch count, not duration. Same-pen continuation is omitted (see the Markov matrix).
      </p>
    </div>
  )
}

export function BeeswarmChart({
  values,
  unit = "d",
  empty,
  title,
  help,
}: {
  values: number[]
  unit?: string
  empty?: string
  title: string
  help: string
}) {
  if (values.length === 0) {
    return (
      <div>
        <CanvasTitle title={title} help={help} />
        <ChartFrame empty emptySentence={empty ?? "No ages to swarm."} />
      </div>
    )
  }
  const h = 140
  const w = 320
  const padT = 8
  const padB = 18
  const innerH = h - padT - padB
  const min = Math.min(...values)
  const max = Math.max(...values)
  const points = beeswarmOffsets(values, { height: innerH, radius: 4, min, max })
  const cx = w / 2
  return (
    <div>
      <CanvasTitle title={title} help={help} />
      <svg className="an-swarm" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title}>
        <line x1={cx} x2={cx} y1={padT} y2={padT + innerH} stroke={STUDIO_EMPTY} />
        {points.map((p) => (
          <circle
            key={p.i}
            cx={cx + p.x}
            cy={padT + innerH - p.y}
            r={3.2}
            fill="#1a4a6b"
            stroke="#000"
            strokeWidth={0.4}
          >
            <title>{`${p.value}${unit}`}</title>
          </circle>
        ))}
        <text x={8} y={padT + 8} fill="#000" fontSize={9} fontFamily="Karla, sans-serif">
          {Math.round(max)}
          {unit}
        </text>
        <text x={8} y={h - 4} fill="#000" fontSize={9} fontFamily="Karla, sans-serif">
          {Math.round(min)}
          {unit}
        </text>
      </svg>
      <p className="an-quantile">
        n = {values.length} · each dot is one open important item · median {Math.round(median(values))}
        {unit}.
      </p>
    </div>
  )
}

export function Slopegraph({
  rows,
  leftLabel,
  rightLabel,
  empty,
  title,
  help,
}: {
  rows: SlopeRow[]
  leftLabel: string
  rightLabel: string
  empty?: string
  title: string
  help: string
}) {
  if (rows.length === 0) {
    return (
      <div>
        <CanvasTitle title={title} help={help} />
        <ChartFrame empty emptySentence={empty ?? "No pairs to slope."} />
      </div>
    )
  }
  const h = Math.max(120, 18 * rows.length + 28)
  const w = 360
  const x0 = 110
  const x1 = 250
  return (
    <div>
      <CanvasTitle title={title} help={help} />
      <svg className="an-slope" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title}>
        <text x={x0} y={12} textAnchor="middle" fontSize={10} fontWeight={700} fill="#000" fontFamily="Karla, sans-serif">
          {leftLabel}
        </text>
        <text x={x1} y={12} textAnchor="middle" fontSize={10} fontWeight={700} fill="#000" fontFamily="Karla, sans-serif">
          {rightLabel}
        </text>
        {rows.map((row, i) => {
          const y = 28 + i * 18
          const rising = row.right > row.left + 0.5
          const falling = row.right < row.left - 0.5
          const stroke = rising ? "#0e4a40" : falling ? "#6b1a1a" : "#404040"
          return (
            <g key={row.id}>
              <text x={x0 - 8} y={y + 3} textAnchor="end" fontSize={10} fill="#000" fontFamily="Karla, sans-serif">
                {row.name.slice(0, 14)} {Math.round(row.left)}%
              </text>
              <line x1={x0} y1={y} x2={x1} y2={y} stroke={stroke} strokeWidth={1.4} />
              <text x={x1 + 8} y={y + 3} fontSize={10} fill="#000" fontFamily="Karla, sans-serif">
                {Math.round(row.right)}%
              </text>
            </g>
          )
        })}
      </svg>
      <p className="an-canvas-hint">Tufte slopegraph: left is weekday rate, right is weekend. Dark teal rises; maroon falls.</p>
    </div>
  )
}

export function UpsetChart({
  rows,
  universe,
  empty,
  title,
  help,
  onSelect,
}: {
  rows: UpsetRow[]
  universe: string[]
  empty?: string
  title: string
  help: string
  onSelect?: (ids: string[]) => void
}) {
  if (rows.length === 0 || universe.length === 0) {
    return (
      <div>
        <CanvasTitle title={title} help={help} />
        <ChartFrame empty emptySentence={empty ?? "No tag combinations yet."} />
      </div>
    )
  }
  const maxN = Math.max(...rows.map((r) => r.n), 1)
  const shown = rows.slice(0, 16)
  return (
    <div>
      <CanvasTitle title={title} help={help} />
      <div className="an-upset" role="img" aria-label={title}>
        <div>
          {shown.map((row) => (
            <button
              key={row.key}
              type="button"
              className="an-upset-row"
              title={`${row.tags.join(" ∩ ") || "∅"} · ${row.n} item${row.n === 1 ? "" : "s"}`}
              onClick={() => onSelect?.(row.ids)}
            >
              <span>{row.tags.join(" ∩ ")}</span>
              <span className="an-quantile">{row.n}</span>
              <span className="an-bar-track">
                <span className="an-upset-bar" style={{ width: `${(row.n / maxN) * 100}%`, display: "block" }} />
              </span>
            </button>
          ))}
        </div>
        <div>
          <div className="an-upset-row" style={{ fontWeight: 700 }}>
            <span />
            <span />
            <span className="an-upset-dots">
              {universe.slice(0, 8).map((tag) => (
                <span key={tag} className="an-upset-dot is-on" title={tag} />
              ))}
            </span>
          </div>
          {shown.map((row) => (
            <div key={`d-${row.key}`} className="an-upset-row">
              <span />
              <span />
              <span className="an-upset-dots">
                {universe.slice(0, 8).map((tag) => (
                  <span
                    key={tag}
                    className={row.tags.includes(tag) ? "an-upset-dot is-on" : "an-upset-dot"}
                    title={tag}
                  />
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="an-canvas-hint">
        UpSet: each row is one exact tag combination (not a superset). Click a row to open those items in Lists.
        Matrix columns are the {Math.min(8, universe.length)} most common tags.
      </p>
    </div>
  )
}

export function HourPenSmallMultiples({
  rows,
  empty,
  title,
  help,
}: {
  rows: { id: string; name: string; color: string; hours: number[]; total: number }[]
  empty?: string
  title: string
  help: string
}) {
  if (rows.length === 0) {
    return (
      <div>
        <CanvasTitle title={title} help={help} />
        <ChartFrame empty emptySentence={empty ?? "No pen hours to multiply."} />
      </div>
    )
  }
  const max = Math.max(...rows.flatMap((r) => r.hours), 1)
  return (
    <div>
      <CanvasTitle title={title} help={help} />
      <div className="an-small-mult">
        {rows.map((row) => (
          <div key={row.id} className="an-small-mult-card">
            <p className="an-small-mult-title" style={{ color: row.color }}>
              {row.name}
            </p>
            <div className="an-small-mult-hours" role="img" aria-label={`${row.name} by hour`}>
              {row.hours.map((m, hour) => (
                <span
                  key={hour}
                  className="an-small-mult-hour"
                  title={`${hourLabel(hour)}: ${Math.round(m)}m`}
                  style={{
                    height: `${Math.max(2, (m / max) * 100)}%`,
                    background: m <= 0 ? STUDIO_EMPTY : row.color,
                    opacity: m <= 0 ? 0.45 : 1,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="an-canvas-hint">Small multiples of hour-of-day occupancy. Same 24 columns, one well per pen. Empty hours stay gray, not zero-work green.</p>
    </div>
  )
}

export function CyclePlot({
  mean,
  empty,
  title,
  help,
}: {
  mean: number[][]
  empty?: string
  title: string
  help: string
}) {
  const max = Math.max(...mean.flat(), 0)
  if (max <= 0) {
    return (
      <div>
        <CanvasTitle title={title} help={help} />
        <ChartFrame empty emptySentence={empty ?? "No weekday × hour occupancy yet."} />
      </div>
    )
  }
  return (
    <div>
      <CanvasTitle title={title} help={help} />
      <div className="an-cycle-plot" role="img" aria-label={title}>
        {WEEKDAY_SHORT.map((label, wd) => (
          <div key={label} className="an-cycle-row">
            <span className="an-ridge-label">{label}</span>
            <div className="an-cycle-hours">
              {(mean[wd] ?? []).map((v, hour) => (
                <span
                  key={hour}
                  className="an-small-mult-hour"
                  title={`${label} ${hourLabel(hour)}: ${Math.round(v)}m mean`}
                  style={{
                    height: `${Math.max(2, (v / max) * 100)}%`,
                    background: v <= 0 ? STUDIO_EMPTY : "#1a6b5c",
                    opacity: v <= 0 ? 0.4 : 1,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="an-canvas-hint">
        Cleveland cycle plot: each row is a weekday, each column an hour, cell is mean occupancy across those weekdays
        in the window. A quiet Tuesday 3pm stays gray.
      </p>
    </div>
  )
}

export function StudioSpark({
  values,
  title,
}: {
  values: number[]
  title?: string
}) {
  if (values.length === 0) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const d = values
    .map((v, i) => {
      const x = values.length === 1 ? 50 : (i / (values.length - 1)) * 100
      const y = 26 - ((v - min) / span) * 22
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(" ")
  return (
    <svg className="an-spark" viewBox="0 0 100 28" preserveAspectRatio="none" role="img" aria-label={title ?? "sparkline"}>
      <path d={d} fill="none" stroke="#0a4a3c" strokeWidth={1.4} />
    </svg>
  )
}

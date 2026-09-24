/**
 * components/Analytics/studio-kit.tsx — Shared Analytics studio primitives
 *
 * Light instrument studio, honest findings, density calendars, hour×day heat,
 * pies, treemaps, and mosaics. Used by every Analytics view so the tab is one language.
 */
"use client"

import type { CSSProperties, ReactNode } from "react"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts"
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { hourLabel, type HourDayGrid } from "./hour-day"

export const STUDIO_GRID = "#808080"
export const STUDIO_AXIS = "#000000"
export const STUDIO_TICK = "#1a1a1a"
export const STUDIO_EMPTY = "#b0b0b0"
export const STUDIO_PHOSPHOR = "#3dff8a"
export const STUDIO_SCOPE = "#1a2a1e"
export const STUDIO_TOOLTIP = {
  background: "#c0c0c0",
  border: "1px solid #808080",
  fontSize: 12,
  color: "#000000",
}

export function FindingBlock({
  sentence,
  n,
  caveat,
}: {
  sentence: string
  n?: string
  caveat?: string
}) {
  return (
    <div className="an-finding-block">
      <p className="an-finding">{sentence}</p>
      {n ? <p className="an-n">{n}</p> : null}
      {caveat ? <p className="an-caveat">{caveat}</p> : null}
    </div>
  )
}

export function StudioReadout({
  label,
  value,
  note,
  tip,
}: {
  label: string
  value: string | number
  note?: string
  tip?: string
}) {
  return (
    <div className="an-readout" title={tip ?? note}>
      <p className="an-readout-label">{label}</p>
      <p className="an-readout-value">{value}</p>
      {note ? <p className="an-readout-note">{note}</p> : null}
    </div>
  )
}

/** Win95 13px well, 22px row — sit on the same baseline as `.an-chip`. */
export function StudioCheck({
  id,
  checked,
  onChange,
  children,
  title,
}: {
  id: string
  checked: boolean
  onChange: (next: boolean) => void
  children: ReactNode
  title?: string
}) {
  return (
    <label className="an-check" htmlFor={id} title={title}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  )
}

export function StudioHelp({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={250}>
      <UiTooltip>
        <TooltipTrigger asChild>
          <button type="button" className="an-help" aria-label={text}>
            ?
          </button>
        </TooltipTrigger>
        <TooltipContent className="an-tip max-w-sm">{text}</TooltipContent>
      </UiTooltip>
    </TooltipProvider>
  )
}

export function CanvasTitle({ title, help }: { title: string; help: string }) {
  return (
    <p className="an-canvas-title">
      {title}
      <StudioHelp text={help} />
    </p>
  )
}

export function StudioSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label className="an-studio-field">
      <span>{label}</span>
      <select value={value} aria-label={label} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  )
}

export function SliceMosaic({
  slices,
  max,
  onSelect,
  empty,
}: {
  slices: { id: string; name: string; color: string; minutes: number; label?: string }[]
  max: number
  onSelect?: (id: string) => void
  empty?: string
}) {
  if (slices.length === 0) {
    return empty ? <p className="an-chart-empty">{empty}</p> : null
  }
  const domain = Math.max(max, 1)
  return (
    <div className="an-mosaic">
      {slices.map((slice) => {
        const t = Math.min(1, slice.minutes / domain)
        const style: CSSProperties = {
          background: slice.color,
          opacity: 0.45 + t * 0.55,
          flex: `${Math.max(0.35, t) * 120} 1 ${Math.max(72, Math.round(t * 160))}px`,
        }
        const body = (
          <>
            <span className="an-mosaic-name">{slice.name}</span>
            <span className="an-mosaic-count">{slice.label ?? `${slice.minutes}m`}</span>
          </>
        )
        return onSelect ? (
          <button
            key={slice.id}
            type="button"
            className="an-mosaic-cell"
            style={style}
            aria-label={`Break down ${slice.name}`}
            title={`${slice.name}: ${slice.label ?? `${slice.minutes}m`}`}
            onClick={() => onSelect(slice.id)}
          >
            {body}
          </button>
        ) : (
          <div key={slice.id} className="an-mosaic-cell" style={style}>
            {body}
          </div>
        )
      })}
    </div>
  )
}

export function HourDayHeatmap({
  grid,
  hue = 188,
  title,
}: {
  grid: HourDayGrid
  hue?: number
  title?: string
}) {
  if (grid.dates.length === 0) return null
  return (
    <div className="an-hourday" role="img" aria-label={title ?? "Hour by day occupancy"}>
      <div className="an-hourday-hours" aria-hidden>
        <span />
        {grid.dates.map((date) => (
          <span key={date} className="an-hourday-tick">
            {date.slice(8)}
          </span>
        ))}
      </div>
      {Array.from({ length: 24 }, (_, hour) => (
        <div key={hour} className="an-hourday-row">
          <span className="an-hourday-label">{hour % 3 === 0 ? hourLabel(hour) : ""}</span>
          <div className="an-hourday-cells">
            {grid.dates.map((date, di) => {
              const value = grid.minutes[di]?.[hour] ?? 0
              const t = grid.max <= 0 ? 0 : value / grid.max
              const fill =
                value <= 0 ? "transparent" : `hsl(${hue} ${42 + t * 38}% ${14 + t * 46}%)`
              return (
                <span
                  key={`${date}-${hour}`}
                  className="an-hourday-cell"
                  title={`${date} ${hourLabel(hour)}: ${value}m`}
                  style={{ background: fill }}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function DensityCalendar({
  weeks,
  color,
}: {
  weeks: { key: string; value: number; out?: boolean }[][]
  color: (value: number) => string
}) {
  return (
    <div className="an-cal">
      {weeks.map((week, wi) => (
        <div key={wi} className="an-cal-col">
          {week.map((cell) => (
            <span
              key={cell.key}
              title={`${cell.key}: ${cell.out ? "—" : Math.round(cell.value)}`}
              className="an-cal-cell"
              style={{ background: cell.out ? "transparent" : color(cell.value) }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function StudioBars({
  rows,
  max,
  unit = "%",
}: {
  rows: { name: string; value: number }[]
  max: number
  unit?: string
}) {
  const domain = Math.max(max, 1)
  return (
    <div className="an-bars">
      {rows.map((row) => (
        <div key={row.name} className="an-bar-row">
          <span className="an-bar-name">{row.name}</span>
          <span className="an-bar-track">
            <span className="an-bar-fill" style={{ width: `${Math.min(100, (row.value / domain) * 100)}%` }} />
          </span>
          <span className="an-bar-val">
            {row.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  )
}

export function SlicePie({
  slices,
  onSelect,
  large,
}: {
  slices: { id: string; name: string; color: string; minutes: number; label?: string }[]
  onSelect?: (id: string) => void
  large?: boolean
}) {
  if (slices.length === 0) return null
  return (
    <div className={large ? "an-pie an-pie-lg" : "an-pie"} role="img" aria-label="Share of time as a pie">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="minutes"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={large ? 64 : 48}
            outerRadius={large ? 128 : 108}
            paddingAngle={1}
            label={false}
            onClick={(_, index) => {
              const slice = slices[index]
              if (slice && onSelect) onSelect(slice.id)
            }}
          >
            {slices.map((slice) => (
              <Cell key={slice.id} fill={slice.color} stroke="#c0c0c0" strokeWidth={1} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={STUDIO_TOOLTIP}
            formatter={(value: number, name: string) => [
              slices.find((s) => s.name === name)?.label ?? `${value}m`,
              name,
            ]}
          />
          <Legend formatter={(value: string) => {
            const slice = slices.find((s) => s.name === value)
            return slice ? `${slice.name}  ·  ${slice.label ?? `${slice.minutes}m`}` : value
          }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SliceTreemap({
  slices,
  onSelect,
}: {
  slices: { id: string; name: string; color: string; minutes: number; label?: string }[]
  onSelect?: (id: string) => void
}) {
  if (slices.length === 0) return null
  const total = slices.reduce((sum, slice) => sum + slice.minutes, 0) || 1
  return (
    <div className="an-treemap" role="list" aria-label="Sized by count">
      {slices.map((slice) => {
        const share = slice.minutes / total
        const style: CSSProperties = {
          flex: `${Math.max(share, 0.04) * 100} 1 ${Math.max(72, Math.round(share * 420))}px`,
          background: slice.color,
        }
        const body = (
          <>
            <span className="an-treemap-name">{slice.name}</span>
            <span className="an-treemap-count">{slice.label ?? String(slice.minutes)}</span>
          </>
        )
        return onSelect ? (
          <button
            key={slice.id}
            type="button"
            className="an-treemap-cell"
            style={style}
            title={`${slice.name}: ${slice.label ?? slice.minutes} · area is proportional to this count`}
            onClick={() => onSelect(slice.id)}
          >
            {body}
          </button>
        ) : (
          <div
            key={slice.id}
            className="an-treemap-cell"
            style={style}
            title={`${slice.name}: ${slice.label ?? slice.minutes}`}
          >
            {body}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Oscilloscope well: a polyline on a Tek-style 8×10 grid. Phosphor is the
 * series — the rest of the studio stays Win95 face gray.
 */
export function PhosphorTrace({
  points,
  title,
  unit,
}: {
  points: { x: string; y: number }[]
  title?: string
  unit?: string
}) {
  const w = 400
  const h = 140
  const pad = { l: 36, r: 8, t: 8, b: 22 }
  if (points.length === 0) {
    return (
      <div className="an-scope" role="img" aria-label={title ?? "empty trace"}>
        <p className="an-scope-empty">No series to sweep.</p>
      </div>
    )
  }
  const ys = points.map((p) => p.y)
  const yMin = Math.min(0, ...ys)
  const yMax = Math.max(...ys, yMin + 1e-6)
  const innerW = w - pad.l - pad.r
  const innerH = h - pad.t - pad.b
  const xAt = (i: number) => pad.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const yAt = (y: number) => pad.t + innerH - ((y - yMin) / (yMax - yMin)) * innerH
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.y).toFixed(1)}`).join(" ")
  const vLines = 10
  const hLines = 8
  return (
    <div className="an-scope" role="img" aria-label={title ?? "trace"}>
      <svg className="an-scope-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {Array.from({ length: vLines + 1 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={pad.l + (i / vLines) * innerW}
            x2={pad.l + (i / vLines) * innerW}
            y1={pad.t}
            y2={pad.t + innerH}
            stroke="#2a4a32"
            strokeWidth={i === 0 || i === vLines || i === 5 ? 1 : 0.4}
          />
        ))}
        {Array.from({ length: hLines + 1 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={pad.l}
            x2={pad.l + innerW}
            y1={pad.t + (i / hLines) * innerH}
            y2={pad.t + (i / hLines) * innerH}
            stroke="#2a4a32"
            strokeWidth={i === 0 || i === hLines || i === 4 ? 1 : 0.4}
          />
        ))}
        <path d={d} fill="none" stroke={STUDIO_PHOSPHOR} strokeWidth={1.6} />
        <text x={4} y={pad.t + 10} fill="#8fbf9a" fontSize={9} fontFamily="Karla, sans-serif">
          {yMax.toFixed(yMax >= 10 ? 0 : 2)}
          {unit ?? ""}
        </text>
        <text x={4} y={pad.t + innerH} fill="#8fbf9a" fontSize={9} fontFamily="Karla, sans-serif">
          {yMin.toFixed(yMin >= 10 || yMin === 0 ? 0 : 2)}
        </text>
        <text x={pad.l} y={h - 4} fill="#8fbf9a" fontSize={9} fontFamily="Karla, sans-serif">
          {points[0].x}
        </text>
        <text x={w - pad.r} y={h - 4} fill="#8fbf9a" fontSize={9} textAnchor="end" fontFamily="Karla, sans-serif">
          {points[points.length - 1].x}
        </text>
      </svg>
    </div>
  )
}

export function SplitBar({
  slices,
  onSelect,
  activeId,
}: {
  slices: { id: string; name: string; color: string; minutes: number; label?: string }[]
  onSelect?: (id: string) => void
  activeId?: string | null
}) {
  const total = slices.reduce((s, sl) => s + sl.minutes, 0) || 1
  return (
    <div className="an-split-bar" role="img" aria-label="Split of this pen">
      {slices.map((slice) => (
        <button
          key={slice.id}
          type="button"
          className={activeId === slice.id ? "an-split-seg is-active" : "an-split-seg"}
          style={{ background: slice.color, flex: `${Math.max(slice.minutes, 1)} 1 0` }}
          title={`${slice.name} · ${slice.label ?? `${slice.minutes}m`} (${((slice.minutes / total) * 100).toFixed(1)}%)`}
          aria-label={`List blocks for ${slice.name}`}
          onClick={() => onSelect?.(slice.id)}
        >
          <span className="an-split-seg-name">{slice.name}</span>
          <span className="an-split-seg-dur">{slice.label ?? `${slice.minutes}m`}</span>
        </button>
      ))}
    </div>
  )
}

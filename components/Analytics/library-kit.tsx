/**
 * components/Analytics/library-kit.tsx — Small plates shared by the Library views
 *
 * Search, slider, sortable ledger, quadrant grid, step heights. House skin
 * from `library-views.css`. Docs: `docs/analytics/library-*.md`.
 */
"use client"

import { useMemo, useState, type ReactNode } from "react"
import "./library-views.css"

export function LibSearch({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label: string
}) {
  return (
    <input
      type="search"
      className="lib-search"
      placeholder={label}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function LibSlider({
  label,
  value,
  min,
  max,
  onChange,
  suffix = "",
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  suffix?: string
}) {
  return (
    <label className="lib-slider">
      {label}
      <input type="range" min={min} max={Math.max(min, max)} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="tabular-nums">
        {value}
        {suffix}
      </span>
    </label>
  )
}

export function LibPlate({ title, note, tools, children }: { title: string; note?: string; tools?: ReactNode; children: ReactNode }) {
  return (
    <section className="lib-plate" aria-label={title}>
      <div className="lib-tools" style={{ justifyContent: "space-between" }}>
        <p className="lib-plate-title">{title}</p>
        {tools}
      </div>
      {note ? <p className="lib-plate-note">{note}</p> : null}
      {children}
    </section>
  )
}

export interface LedgerColumn<T> {
  key: string
  label: string
  value: (row: T) => number | string
  render?: (row: T) => ReactNode
  title?: string
}

/** Click a header to sort; click it again to flip. Rows open on click. */
export function LedgerTable<T extends { id: string }>({
  rows,
  columns,
  initialSort,
  onOpen,
  label,
}: {
  rows: T[]
  columns: LedgerColumn<T>[]
  initialSort: string
  onOpen?: (row: T) => void
  label: string
}) {
  const [sort, setSort] = useState(initialSort)
  const [desc, setDesc] = useState(true)
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort) ?? columns[0]
    return rows.slice().sort((a, b) => {
      const x = col.value(a)
      const y = col.value(b)
      const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))
      return desc ? -cmp : cmp
    })
  }, [rows, columns, sort, desc])
  return (
    <div className="lib-table-wrap">
      <table className="lib-table" aria-label={label}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" title={c.title}>
                <button
                  type="button"
                  aria-pressed={sort === c.key}
                  onClick={() => {
                    if (sort === c.key) setDesc(!desc)
                    else {
                      setSort(c.key)
                      setDesc(true)
                    }
                  }}
                >
                  {c.label}
                  {sort === c.key ? (desc ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.id} onClick={onOpen ? () => onOpen(row) : undefined}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : c.value(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Meter({ share }: { share: number }) {
  return (
    <span className="lib-meter" aria-hidden>
      <span style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }} />
    </span>
  )
}

export interface QuadCell {
  x: number
  y: number
  count: number
  ids: string[]
}

/**
 * Integer grid with a count bubble per cell (area ∝ count). Rows run high y
 * on top. `zone` names the corner for tinting.
 */
export function QuadrantGrid({
  cells,
  xs,
  ys,
  xLabel,
  yLabel,
  zone,
  onSelect,
}: {
  cells: QuadCell[]
  xs: { value: number; label: string }[]
  ys: { value: number; label: string }[]
  xLabel: string
  yLabel: string
  zone: (x: number, y: number) => string
  onSelect?: (ids: string[]) => void
}) {
  const max = Math.max(1, ...cells.map((c) => c.count))
  const at = new Map(cells.map((c) => [`${c.x}:${c.y}`, c]))
  const rowsTopDown = ys.slice().sort((a, b) => b.value - a.value)
  return (
    <div className="lib-quad" style={{ ["--cols" as string]: xs.length }} role="grid" aria-label={`${yLabel} by ${xLabel}`}>
      <span className="lib-quad-axis" style={{ gridColumn: `1 / span ${xs.length + 1}`, justifyContent: "flex-start", minHeight: 0 }}>
        ↑ {yLabel}
      </span>
      {rowsTopDown.map((y) => (
        <div key={y.value} role="row" style={{ display: "contents" }}>
          <span className="lib-quad-axis" role="rowheader">
            {y.label}
          </span>
          {xs.map((x) => {
            const cell = at.get(`${x.value}:${y.value}`)
            const n = cell?.count ?? 0
            const d = n ? 14 + Math.sqrt(n / max) * 30 : 0
            return (
              <button
                key={x.value}
                type="button"
                role="gridcell"
                className="lib-quad-cell"
                data-zone={zone(x.value, y.value)}
                disabled={!n}
                title={`${yLabel} ${y.label} · ${xLabel} ${x.label}: ${n} item${n === 1 ? "" : "s"}`}
                onClick={() => cell && onSelect?.(cell.ids)}
              >
                {n ? (
                  <span className="lib-quad-bubble" style={{ width: d, height: d }}>
                    {n}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      ))}
      <span aria-hidden />
      {xs.map((x) => (
        <span key={x.value} className="lib-quad-axis">
          {x.label}
        </span>
      ))}
      <span />
      <span className="lib-quad-axis" style={{ gridColumn: `2 / span ${xs.length}` }}>
        {xLabel} →
      </span>
    </div>
  )
}

/** Steps whose height is the count, with the change between each step named. */
export function StepHeights({
  steps,
  onSelect,
}: {
  steps: { id: string; name: string; color: string; count: number; note?: string; ids: string[] }[]
  onSelect?: (ids: string[]) => void
}) {
  const max = Math.max(1, ...steps.map((s) => s.count))
  return (
    <div className="lib-steps" role="list" aria-label="Stage steps">
      {steps.map((s, i) => {
        const prev = steps[i - 1]
        const delta = prev ? s.count - prev.count : 0
        return (
          <div key={s.id} style={{ display: "contents" }}>
            {prev ? (
              <span className="lib-step-drop" aria-hidden>
                {delta === 0 ? "=" : delta > 0 ? `+${delta}` : `${delta}`}
                <br />
                {prev.count ? `${Math.round((s.count / prev.count) * 100)}%` : "—"}
              </span>
            ) : null}
            <button
              type="button"
              role="listitem"
              className="lib-step"
              title={`${s.name}: ${s.count}${s.note ? ` · ${s.note}` : ""}`}
              onClick={() => s.ids.length && onSelect?.(s.ids)}
            >
              <span className="lib-step-label">
                <b>{s.count}</b>
                {s.name}
                {s.note ? <> · {s.note}</> : null}
              </span>
              <span className="lib-step-bar" style={{ height: `${(s.count / max) * 120}px`, background: s.color }} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—"
  return Number.isInteger(n) ? String(n) : n.toFixed(digits)
}

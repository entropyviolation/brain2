/**
 * components/Analytics/TransitionsView.tsx — Markov matrix of Tracking pen changes
 *
 * A transition is one block ending and the next (different) pen beginning on
 * the same day. P(j|i) = count(i→j) / count(i→·). Self-stays are skipped so
 * the matrix is about switches, not duration. Empty/thin frames stay honest.
 * Below the matrix: landing vs leaving (net flow, exit entropy) and A → B → A
 * return loops. Docs: `docs/analytics/time-transitions.md`.
 */
"use client"

import { Fragment, useMemo, useState } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { SAMPLE_FLOORS, isThinSample, thinWindowSentence } from "./analytics-range"
import { CanvasTitle, StudioReadout } from "./studio-kit"
import { AlluvialChart } from "./studio-plots"
import { penTransitionMatrix } from "./signal-stats"
import { NativeSelect } from "@/components/ui/native-select"
import { penDaySequences, penFlows, returnLoops } from "./time-flow-stats"
import "./time-flow.css"

type Order = "total" | "name"

export function TransitionsView() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const { dateKeys, label } = useAnalyticsRange()
  const [scopeId, setScopeId] = useState(scopes[0]?.id ?? "")
  const scope = scopes.find((s) => s.id === scopeId) ?? scopes[0]

  const matrix = useMemo(
    () => (scope ? penTransitionMatrix(entries, dateKeys, scope.id, scope.pens) : { pens: [], cells: [], n: 0 }),
    [entries, dateKeys, scope],
  )
  const [show, setShow] = useState<"p" | "count">("p")
  const [order, setOrder] = useState<Order>("total")
  const [minCount, setMinCount] = useState(1)
  const flows = useMemo(() => penFlows(matrix.pens, matrix.cells), [matrix])
  const pens = useMemo(() => {
    if (order === "name") return [...matrix.pens].sort((a, b) => a.name.localeCompare(b.name))
    const total = new Map(flows.map((f) => [f.id, f.outCount + f.inCount]))
    return [...matrix.pens].sort((a, b) => (total.get(b.id) ?? 0) - (total.get(a.id) ?? 0))
  }, [matrix.pens, flows, order])
  const loops = useMemo(
    () => (scope ? returnLoops(penDaySequences(entries, dateKeys, scope.id)) : { loops: [], windows: 0, rate: 0 }),
    [entries, dateKeys, scope],
  )
  const maxCount = Math.max(1, ...matrix.cells.map((c) => c.count))
  const nameOf = (id: string) => matrix.pens.find((p) => p.id === id)?.name ?? id
  const colorOf = (id: string) => matrix.pens.find((p) => p.id === id)?.color ?? "#64748b"
  const maxNet = Math.max(1, ...flows.map((f) => Math.abs(f.net)))
  const thin = isThinSample(matrix.n, SAMPLE_FLOORS.transitions)
  const hottest = useMemo(
    () => [...matrix.cells].sort((a, b) => b.count - a.count)[0],
    [matrix.cells],
  )

  if (!scope) {
    return (
      <div className="an-canvas an-stack" data-testid="transitions-view">
        <ChartFrame empty emptySentence="No tracking scopes yet." />
      </div>
    )
  }

  return (
    <div className="an-canvas an-stack" data-testid="transitions-view">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Transitions"
            help="Markov of pen changes: each cell is P(to | from) among switches only. Same-pen continuation is not a transition. Rows sum to 1. This is not a duration matrix."
          />
          <p className="an-canvas-kicker">{label} · {scope.name}</p>
        </div>
        <label className="an-studio-field">
          <span>Scope</span>
          <NativeSelect value={scope.id} aria-label="Tracking scope" onChange={(e) => setScopeId(e.target.value)}>
            {scopes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      </header>

      {matrix.n === 0 ? (
        <ChartFrame
          empty
          emptySentence={`No pen changes in ${scope.name} in ${label}. A transition needs two different pens back-to-back on the same day.`}
        />
      ) : thin ? (
        <ChartFrame thin thinSentence={thinWindowSentence(matrix.n, SAMPLE_FLOORS.transitions, label)} />
      ) : (
        <>
          <div className="an-readouts">
            <StudioReadout label="Switches" value={matrix.n} note="pen changes" tip="Count of i→j where i ≠ j." />
            <StudioReadout
              label="Pens in mix"
              value={matrix.pens.length}
              note="rows = columns"
            />
            <StudioReadout
              label="Most common"
              value={hottest ? `${hottest.fromName} → ${hottest.toName}` : "—"}
              note={hottest ? `${hottest.count}× · p=${hottest.p.toFixed(2)}` : ""}
              tip="Highest count cell. Probability is row-normalized, not the window share."
            />
          </div>
          <div className="tf-tools" role="group" aria-label="Matrix controls">
            <button type="button" className="an-chip" aria-pressed={show === "p"} onClick={() => setShow("p")}>
              P(to | from)
            </button>
            <button type="button" className="an-chip" aria-pressed={show === "count"} onClick={() => setShow("count")}>
              Count
            </button>
            <button type="button" className="an-chip" aria-pressed={order === "total"} onClick={() => setOrder("total")}>
              Busiest first
            </button>
            <button type="button" className="an-chip" aria-pressed={order === "name"} onClick={() => setOrder("name")}>
              A–Z
            </button>
            <label className="an-studio-field" title="Hide cells with fewer switches than this">
              <span>Min {minCount}×</span>
              <input
                type="range"
                min={1}
                max={maxCount}
                value={Math.min(minCount, maxCount)}
                aria-label="Minimum switches per cell"
                onChange={(e) => setMinCount(Number(e.target.value))}
              />
            </label>
          </div>
          <div
            className="an-matrix-wrap"
            style={{ ["--an-cols" as string]: String(pens.length + 1) }}
          >
            <div
              className="an-matrix"
              style={{ gridTemplateColumns: `repeat(${pens.length + 1}, minmax(44px, 1fr))` }}
              role="table"
              aria-label="Pen transition probabilities"
            >
              <span className="an-matrix-cell is-label" title="From \ to">
                from\to
              </span>
              {pens.map((p) => (
                <span key={`h-${p.id}`} className="an-matrix-cell is-label" title={p.name}>
                  {p.name}
                </span>
              ))}
              {pens.map((from) => (
                <Row key={from.id} from={from} pens={pens} cells={matrix.cells} show={show} minCount={minCount} />
              ))}
            </div>
          </div>
          <p className="an-canvas-hint">
            Shade follows P(to | from). Hover a cell for the raw count. The hatched diagonal is staying on the same
            pen, left out on purpose — duration lives on Tracking.
          </p>

          <section className="an-plate" aria-label="Landing and leaving">
            <CanvasTitle
              title="Where you land, where you leave"
              help="Net = switches into a pen minus switches out of it. Right of the line: a pen you land on and stay. Left: a pen you leave from. Predictability = 1 − H / log2(k−1), where H is the Shannon entropy of the next pen in bits and k is the number of pens. 100% means you always go to the same next pen."
            />
            <div className="tf-bars">
              {[...flows]
                .sort((a, b) => b.net - a.net)
                .map((f) => {
                  const w = (Math.abs(f.net) / maxNet) * 50
                  return (
                    <Fragment key={f.id}>
                      <span className="tf-name" title={nameOf(f.id)}>
                        {nameOf(f.id)}
                      </span>
                      <span
                        className="tf-track is-signed"
                        title={`${f.inCount} in · ${f.outCount} out · next-pen entropy ${f.exitBits.toFixed(2)} bits`}
                      >
                        <i style={{ left: f.net >= 0 ? "50%" : `${50 - w}%`, width: `${w}%`, background: colorOf(f.id) }} />
                      </span>
                      <span className="tf-val">
                        {f.net > 0 ? "+" : ""}
                        {f.net} · {f.predictability == null ? "—" : `${Math.round(f.predictability * 100)}%`}
                      </span>
                    </Fragment>
                  )
                })}
            </div>
            <p className="an-n">columns: net switches · next-pen predictability</p>
          </section>

          <section className="an-plate" aria-label="Return loops">
            <CanvasTitle
              title="Return loops"
              help="A loop is A → B → A on the same day: you left a pen and came straight back. Rate = loops ÷ every three-step window. A high rate reads as ping-pong between two things."
            />
            <div className="an-readouts">
              <StudioReadout
                label="Loop rate"
                value={`${Math.round(loops.rate * 100)}%`}
                note={`of ${loops.windows} three-step windows`}
              />
              <StudioReadout label="Loops" value={loops.loops.reduce((s, l) => s + l.count, 0)} note="A → B → A" />
            </div>
            {loops.loops.length === 0 ? (
              <p className="an-canvas-hint">No A → B → A returns in this window.</p>
            ) : (
              <div className="tf-bars">
                {loops.loops.slice(0, 8).map((l) => (
                  <Fragment key={`${l.aId}-${l.bId}`}>
                    <span className="tf-name" title={`${nameOf(l.aId)} → ${nameOf(l.bId)} → ${nameOf(l.aId)}`}>
                      {nameOf(l.aId)} ⇄ {nameOf(l.bId)}
                    </span>
                    <span className="tf-track">
                      <i style={{ width: `${(l.count / loops.loops[0].count) * 100}%`, background: colorOf(l.bId) }} />
                    </span>
                    <span className="tf-val">{l.count}×</span>
                  </Fragment>
                ))}
              </div>
            )}
          </section>

          <details className="tf-fold">
            <summary>
              Alluvial of switches <span className="an-n">ribbon = raw count</span>
            </summary>
          <AlluvialChart
            pens={matrix.pens}
            cells={matrix.cells}
            title="Alluvial of switches"
            help="Alluvial (Sankey family): left is the from-pen, right is the to-pen, ribbon width is raw switch count — not row-normalized p, not duration. Same-pen continuation is omitted, matching the matrix."
            empty={`No pen changes in ${scope.name} in ${label}.`}
          />
          </details>
        </>
      )}
    </div>
  )
}

function Row({
  from,
  pens,
  cells,
  show,
  minCount,
}: {
  from: { id: string; name: string }
  pens: { id: string; name: string }[]
  cells: { fromId: string; toId: string; p: number; count: number }[]
  show: "p" | "count"
  minCount: number
}) {
  return (
    <>
      <span className="an-matrix-cell is-label" title={from.name}>
        {from.name}
      </span>
      {pens.map((to) => {
        const found = cells.find((c) => c.fromId === from.id && c.toId === to.id)
        const cell = found && found.count >= minCount ? found : undefined
        const p = cell?.p ?? 0
        if (from.id === to.id) {
          return <span key={`${from.id}-${to.id}`} className="an-matrix-cell is-diag" title={`${from.name}: staying is not a switch`} />
        }
        const fill = p <= 0 ? "transparent" : `hsla(158, 55%, ${18 + p * 42}%, ${0.25 + p * 0.75})`
        return (
          <span
            key={`${from.id}-${to.id}`}
            className="an-matrix-cell"
            title={
              cell
                ? `${from.name} → ${to.name}: ${cell.count} switches · P=${p.toFixed(2)}`
                : `${from.name} → ${to.name}: none`
            }
            style={{ background: fill }}
          >
            {p > 0 ? (show === "p" ? p.toFixed(2) : cell?.count) : ""}
          </span>
        )
      })}
    </>
  )
}

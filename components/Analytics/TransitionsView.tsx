/**
 * components/Analytics/TransitionsView.tsx — Markov matrix of Tracking pen changes
 *
 * A transition is one block ending and the next (different) pen beginning on
 * the same day. P(j|i) = count(i→j) / count(i→·). Self-stays are skipped so
 * the matrix is about switches, not duration. Empty/thin frames stay honest.
 */
"use client"

import { useMemo, useState } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { SAMPLE_FLOORS, isThinSample, thinWindowSentence } from "./analytics-range"
import { CanvasTitle, StudioReadout } from "./studio-kit"
import { AlluvialChart } from "./studio-plots"
import { penTransitionMatrix } from "./signal-stats"

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
          <select value={scope.id} aria-label="Tracking scope" onChange={(e) => setScopeId(e.target.value)}>
            {scopes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
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
          <div
            className="an-matrix-wrap"
            style={{ ["--an-cols" as string]: String(matrix.pens.length + 1) }}
          >
            <div
              className="an-matrix"
              style={{ gridTemplateColumns: `repeat(${matrix.pens.length + 1}, minmax(44px, 1fr))` }}
              role="table"
              aria-label="Pen transition probabilities"
            >
              <span className="an-matrix-cell is-label" title="From \ to">
                from\to
              </span>
              {matrix.pens.map((p) => (
                <span key={`h-${p.id}`} className="an-matrix-cell is-label" title={p.name}>
                  {p.name.slice(0, 8)}
                </span>
              ))}
              {matrix.pens.map((from) => (
                <Row key={from.id} from={from} pens={matrix.pens} cells={matrix.cells} />
              ))}
            </div>
          </div>
          <p className="an-canvas-hint">
            Shade follows P(to | from). Hover a cell for the raw count. Self-transitions are omitted on
            purpose — duration lives on Tracking.
          </p>
          <AlluvialChart
            pens={matrix.pens}
            cells={matrix.cells}
            title="Alluvial of switches"
            help="Alluvial (Sankey family): left is the from-pen, right is the to-pen, ribbon width is raw switch count — not row-normalized p, not duration. Same-pen continuation is omitted, matching the matrix."
            empty={`No pen changes in ${scope.name} in ${label}.`}
          />
        </>
      )}
    </div>
  )
}

function Row({
  from,
  pens,
  cells,
}: {
  from: { id: string; name: string }
  pens: { id: string; name: string }[]
  cells: { fromId: string; toId: string; p: number; count: number }[]
}) {
  return (
    <>
      <span className="an-matrix-cell is-label" title={from.name}>
        {from.name.slice(0, 8)}
      </span>
      {pens.map((to) => {
        const cell = cells.find((c) => c.fromId === from.id && c.toId === to.id)
        const p = cell?.p ?? 0
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
            {p > 0 ? p.toFixed(2) : ""}
          </span>
        )
      })}
    </>
  )
}

/**
 * components/Home/ToDo/TaskCardStats.tsx — The root stat cards under the card title
 *
 * Estimate, Parts, Spent, Points, Progress. Each is a button that opens one
 * popover of detail (Esc or a click outside closes it and returns focus to the
 * card). Numbers are the ones `TaskCardBody` already computed; Progress holds
 * the completion math (`TreeMath`). In a sub-card they describe the root step.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { DashReading } from "../dash/dash-primitives"
import { TreeMath } from "@/components/steps/TreeMath"
import { splitStats, type TierSplit } from "@/lib/tree-math"
import { formatPercent } from "@/lib/step-progress"
import { effectiveDurationMinutes } from "@/lib/todo-steps"
import { STEP_TIERS, STEP_TIER_LABEL, STEP_TIER_SHORT } from "@/lib/step-tiers"
import type { StepTier, Subtask } from "@/lib/types"

export interface TaskCardStatsData {
  view: readonly Subtask[]
  tierOf: Map<string, StepTier>
  levels: TierSplit
  tier?: StepTier
  est: number
  ownEst?: number
  estLog?: { at: string; minutes: number }[]
  parts: number
  spent: number
  periodSpent: number
  periodLabel: string
  penPool?: number
  pts: { points: number; source: string }
  earned: number
  pointsVisible: boolean
  levelName: string
  levelPts: number
  onPick: (id: string) => void
}

const stamp = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—")
const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

function R({ k, children, hint }: { k: string; children: ReactNode; hint?: string }) {
  return (
    <div className="tcs-r" title={hint}>
      <span>{k}</span>
      <b>{children}</b>
    </div>
  )
}

function Bar({ value, max, over }: { value: number; max: number; over?: boolean }) {
  return (
    <span className={`tcs-bar${over ? " is-over" : ""}`} aria-hidden>
      <i style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }} />
    </span>
  )
}

export function TaskCardStats({ data: d }: { data: TaskCardStatsData }) {
  const [open, setOpen] = useState<string | null>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const stats = splitStats(d.view, d.tierOf)

  useEffect(() => {
    if (!open) return
    const close = (focus: boolean) => {
      setOpen(null)
      if (focus) wrap.current?.querySelector<HTMLElement>(`[data-stat="${open}"]`)?.focus()
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(true)
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && close(false)
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onDown)
    }
  }, [open])

  const own = d.ownEst ?? 0
  const unsplit = d.parts > 0 && d.est > d.parts ? d.est - d.parts : 0
  const fromParts = d.parts > own
  const log = d.estLog ?? []
  const parts = d.view.map((s) => ({ s, m: effectiveDurationMinutes(s.estimatedDuration, s.subtasks) }))
  const biggest = parts.reduce((a, b) => (b.m > a.m ? b : a), { s: undefined as Subtask | undefined, m: 0 })
  const left = d.est - d.spent
  const cards: { id: string; label: string; value: string; sub?: string; wide?: boolean; testId?: string; body: ReactNode }[] = [
    {
      id: "estimate",
      label: "Estimate",
      value: d.est ? `${d.est}m` : "—",
      sub: d.est ? (fromParts ? "from parts" : "own") : undefined,
      body: (
        <>
          <h4>Where {d.est}m comes from</h4>
          <p className="tcs-formula">est = max(own, Σ parts) = max({own}, {d.parts}) = <b>{d.est}m</b></p>
          <R k="Source">{!d.est ? "nothing set yet" : fromParts ? "the sum of the steps (larger than the own estimate)" : "the own estimate (parts are smaller or unset)"}</R>
          <R k="Own estimate">{own ? `${own}m` : "none set"}</R>
          <R k="Parts total">{d.parts}m across {d.view.length} {d.view.length === 1 ? "part" : "parts"}</R>
          <R k="Unsplit">{unsplit ? `${unsplit}m (${pct(unsplit, d.est)}) not split into steps` : "nothing"}</R>
          <h4>History of this estimate</h4>
          {log.length ? (
            <>
              <ul className="tcs-rows">
                {log.map((e, i) => (
                  <li key={e.at + i}>
                    <span>{stamp(e.at)}</span>
                    <b>{e.minutes}m</b>
                    <em>{i ? signed(e.minutes - log[i - 1].minutes) : "first"}</em>
                  </li>
                ))}
              </ul>
              <p className="is-quiet">
                {log.length} {log.length === 1 ? "value" : "values"} · first {log[0].minutes}m → now {log[log.length - 1].minutes}m ({log[0].minutes ? signed(Math.round(((log[log.length - 1].minutes - log[0].minutes) / log[0].minutes) * 100)) : "—"}%)
              </p>
            </>
          ) : (
            <p className="is-quiet">No changes logged yet. Each edit of an estimate is kept here.</p>
          )}
        </>
      ),
    },
    {
      id: "parts",
      label: "Parts",
      value: `${d.parts}m`,
      sub: `${d.view.length} ${d.view.length === 1 ? "part" : "parts"}`,
      body: (
        <>
          <h4>Top-level steps (click to select)</h4>
          {parts.length ? (
            <ul className="tcs-rows is-pick">
              {parts.map(({ s, m }) => (
                <li key={s.id}>
                  <button type="button" onClick={() => (d.onPick(s.id), setOpen(null))} title="Select this step in the detail panel">
                    <span>{s.description}</span>
                    <Bar value={m} max={biggest.m} />
                    <b>{m ? `${m}m` : "—"}</b>
                    <em>{pct(m, d.parts)}</em>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="is-quiet">No steps yet.</p>
          )}
          <p className="tcs-formula">Σ = {d.parts}m{parts.length ? ` · mean ${Math.round(d.parts / parts.length)}m` : ""}{biggest.s && biggest.m ? ` · largest “${biggest.s.description}” ${pct(biggest.m, d.parts)}` : ""}</p>
          {d.est && d.parts && d.est !== d.parts ? <R k="Against estimate">{d.est > d.parts ? `${d.est - d.parts}m of the estimate is unsplit` : `${d.parts - d.est}m over the own estimate`}</R> : null}
        </>
      ),
    },
    {
      id: "spent",
      label: "Spent",
      value: `${d.spent}m`,
      sub: d.est ? pct(d.spent, d.est) + " of est" : undefined,
      body: (
        <>
          <h4>Time on this task</h4>
          <Bar value={d.spent} max={d.est} over={d.est > 0 && d.spent > d.est} />
          <R k={`This ${d.periodLabel}`}>{d.periodSpent}m</R>
          <R k="All time">{d.spent}m</R>
          {d.penPool ? <R k="Pen overall" hint="Time on the linked pen that is not tagged to this task. Not counted.">{d.penPool}m, not tagged to this</R> : null}
          <h4>Pace against the estimate</h4>
          <p className="tcs-formula">spent / est = {d.spent} / {d.est} = <b>{d.est ? pct(d.spent, d.est) : "—"}</b></p>
          <R k={left >= 0 ? "Left" : "Over"}>{d.est ? `${Math.abs(left)}m` : "no estimate to pace against"}</R>
          <p className="is-quiet">Only blocks tagged with this task count as spent.</p>
        </>
      ),
    },
    {
      id: "points",
      label: "Points",
      value: String(d.pts.points),
      sub: d.pointsVisible ? `steps ${d.earned}` : undefined,
      testId: "task-card-points",
      body: (
        <>
          <h4>What finishing pays</h4>
          <p className="tcs-formula">
            on done {d.pts.points}{d.pointsVisible ? ` + steps ${d.earned}` : ""}{d.levelPts ? ` + level ${d.levelPts}` : ""} = <b>{d.pts.points + (d.pointsVisible ? d.earned : 0) + d.levelPts}</b>
          </p>
          <R k="On done">{d.pts.points}</R>
          {d.pointsVisible ? <R k="Steps earned">{d.earned}</R> : null}
          <R k="Level bonus">{d.levelPts ? `+${d.levelPts} (${d.levelName})` : "none yet"}</R>
          <R k="Rule">{d.pts.source === "override" ? "set on this task by hand" : "from the default rule for this kind of task"}</R>
        </>
      ),
    },
  ]
  if (stats.parts.length) {
    cards.push({
      id: "progress",
      label: "Progress",
      value: `${stats.done}/${stats.leaves} ends`,
      sub: `ρ ${formatPercent(stats.raw)} · σ ${formatPercent(stats.split)}`,
      wide: true,
      body: (
        <>
          <h4>Level by level</h4>
          <p className="tcs-formula" title="ρ: every end step weighs the same. σ: every top-level part weighs the same.">
            {STEP_TIERS.map((t) => `${STEP_TIER_LABEL[t]} (${STEP_TIER_SHORT[t]}) ${formatPercent(d.levels[t]?.split ?? null)}`).join(" · ")}
          </p>
          <TreeMath steps={d.view} tiers={d.tierOf} levels={d.levels} focus={d.tier} />
        </>
      ),
    })
  }

  return (
    <div className="tcs-stats" ref={wrap} role="group" aria-label="Task totals">
      {cards.map((c) => (
        <div key={c.id} className="tcs-stat-wrap">
          <button
            type="button"
            className="tcs-stat"
            data-stat={c.id}
            data-testid={c.testId}
            aria-expanded={open === c.id}
            aria-controls={`tcs-pop-${c.id}`}
            onClick={() => setOpen(open === c.id ? null : c.id)}
          >
            <span className="tcs-stat-label">{c.label}</span>
            <span className="tcs-stat-value">
              <DashReading text={c.value} />
            </span>
            <span className="tcs-stat-sub">{c.sub ?? " "}</span>
          </button>
          {open === c.id ? (
            <div id={`tcs-pop-${c.id}`} className={`tcs-stat-pop${c.wide ? " is-wide" : ""}`} role="group" aria-label={`${c.label} detail`}>
              {c.body}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

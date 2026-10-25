/**
 * components/Home/ToDo/TaskCardStats.tsx — The root stat cards under the card title
 *
 * Estimate, Parts, Spent, Points, Progress. Each is a button that opens one
 * popover of detail (Esc or a click outside closes it and returns focus to the
 * card). Numbers are the ones `TaskCardBody` already computed; Progress holds
 * the completion math (`TreeMath`). In a sub-card they describe the root step.
 */
"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { compactDuration } from "@/lib/time-entries"
import { DashReading } from "../dash/dash-primitives"
import { TreeMath } from "@/components/steps/TreeMath"
import { splitStats, type TierSplit } from "@/lib/tree-math"
import { formatPercent } from "@/lib/step-progress"
import { effectiveDurationMinutes } from "@/lib/todo-steps"
import { STEP_TIERS, STEP_TIER_LABEL, STEP_TIER_SHORT } from "@/lib/step-tiers"
import { tierEstimates } from "@/lib/task-card"
import type { StepTier, Subtask } from "@/lib/types"
import { SpentBlocks, type SpentBlocksScope } from "./SpentBlocks"
import type { ActualAccount } from "@/lib/tracked-time"

const TIER_PICKER_LABEL: Record<StepTier, string> = {
  min: "Bare minimum",
  goal: "Goal (B + G)",
  exceptional: "Exceptional (all)",
}

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
  /** Which blocks count as spent here; the Spent popover lists and edits them. */
  spentScope?: SpentBlocksScope
  /** Direct split of `spent`: minutes only here, then each part. */
  spentAccount?: ActualAccount
  /** "on this task only" or "on this step only". */
  spentOnly?: string
  periodLabel: string
  penPool?: number
  pts: { points: number; source: string }
  earned: number
  pointsVisible: boolean
  levelName: string
  levelPts: number
  onPick: (id: string) => void
  /** Selected cumulative estimate tier for the root task (min = B, goal = B+G, exceptional = all). */
  estimateTier?: StepTier
  onEstimateTierChange?: (tier: StepTier) => void
  /** Per-step spent minutes from time entries, used for running/original estimate calculations. */
  stepSpent?: ReadonlyMap<string, number>
  /** Whether the root task/step itself is completed. */
  rootCompleted?: boolean
}

const stamp = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—")

const UNIT_KEY = "brain2-task-card-time-unit"
export type TaskCardTimeUnit = "h" | "m"

const TimeUnitContext = createContext<{ unit: TaskCardTimeUnit; setUnit: (unit: TaskCardTimeUnit) => void } | null>(null)

/** Hours or minutes for every duration on the stat row. Default minutes. */
export function TaskCardTimeUnit({ children }: { children: ReactNode }) {
  const [unit, setUnitState] = useState<TaskCardTimeUnit>(() => {
    if (typeof window === "undefined") return "m"
    return window.localStorage.getItem(UNIT_KEY) === "h" ? "h" : "m"
  })
  const setUnit = (next: TaskCardTimeUnit) => {
    setUnitState(next)
    try {
      window.localStorage.setItem(UNIT_KEY, next)
    } catch {
      /* private mode */
    }
  }
  return <TimeUnitContext.Provider value={{ unit, setUnit }}>{children}</TimeUnitContext.Provider>
}

export function useTaskCardTimeUnit(): TaskCardTimeUnit {
  return useContext(TimeUnitContext)?.unit ?? "m"
}

/** Minutes read `325m`. Hours use `compactDuration`, including `0h45`. */
export function formatStatMinutes(minutes: number, unit: TaskCardTimeUnit): string {
  const n = Math.max(0, Math.round(minutes))
  return unit === "h" ? compactDuration(n, true) : `${n}m`
}

function R({ k, children, hint }: { k: string; children: ReactNode; hint?: string }) {
  return (
    <div className="tcs-r" title={hint}>
      <span>{k}</span>
      <b>{children}</b>
    </div>
  )
}

/**
 * One top-level part: estimate from `effectiveDurationMinutes`, spent from
 * `stepSpent` (or `actualDuration` when that is larger), left from what is
 * still open. A completed step has nothing left.
 */
function partLedger(step: Subtask, estimate: number, stepSpent?: ReadonlyMap<string, number>) {
  const spent = Math.max(0, Math.round(Math.max(stepSpent?.get(step.id) ?? 0, step.actualDuration ?? 0)))
  const done = step.completed === true
  const over = estimate > 0 && spent > estimate ? spent - estimate : 0
  const left = done || over > 0 || estimate <= 0 ? 0 : estimate - spent
  const fill = over > 0 ? 100 : estimate > 0 ? Math.min(100, (spent / estimate) * 100) : spent > 0 ? 100 : 0
  const tone = over > 0 ? "is-over" : done ? "is-done" : estimate <= 0 && spent <= 0 ? "is-empty" : ""
  return { spent, done, over, left, fill, tone }
}

export function TaskCardStats({ data: d }: { data: TaskCardStatsData }) {
  const [open, setOpen] = useState<string | null>(null)
  const [localEstTier, setLocalEstTier] = useState<StepTier>("exceptional")
  const wrap = useRef<HTMLDivElement>(null)
  const timeUnit = useContext(TimeUnitContext)
  const unit = timeUnit?.unit ?? "m"
  const dur = (n: number) => formatStatMinutes(n, unit)
  const signedDur = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${dur(Math.abs(n))}`
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

  const byTier = tierEstimates(d.view, d.ownEst, d.stepSpent, d.estLog, d.rootCompleted, d.spent)
  const activeEstTier = d.estimateTier ?? localEstTier
  const activeDetail = byTier[activeEstTier]
  const activeEst = activeEstTier === "exceptional" && activeDetail.estimate === 0 && d.est > 0 ? d.est : activeDetail.estimate
  const activeParts = activeEstTier === "exceptional" && activeDetail.parts === 0 && d.parts > 0 ? d.parts : activeDetail.parts

  const own = d.ownEst ?? 0
  const unsplit = activeParts > 0 && activeEst > activeParts ? activeEst - activeParts : 0
  const fromParts = activeParts > own
  const log = d.estLog ?? []
  const parts = d.view.map((s) => ({ s, m: effectiveDurationMinutes(s.estimatedDuration, s.subtasks) }))
  const biggest = parts.reduce((a, b) => (b.m > a.m ? b : a), { s: undefined as Subtask | undefined, m: 0 })
  const cards: { id: string; label: string; value: string; sub?: string; wide?: boolean; testId?: string; body: ReactNode }[] = [
    {
      id: "estimate",
      label: "Estimate",
      value: activeEst > 0 ? dur(activeEst) : "—",
      sub:
        activeEstTier !== "exceptional"
          ? `${STEP_TIER_SHORT[activeEstTier]} · ${dur(activeDetail.running)} run`
          : activeEst > 0
            ? fromParts
              ? "from parts"
              : "own"
            : undefined,
      wide: true,
      body: (
        <>
          <h4>Estimates by level (pick one to use)</h4>
          <div className="tcs-tier-ests" role="group" aria-label="Estimate level">
            {STEP_TIERS.map((t) => {
              const tierInfo = byTier[t]
              const isActive = activeEstTier === t
              return (
                <button
                  key={t}
                  type="button"
                  data-no95
                  className={`tcs-tier-est-btn is-${t}${isActive ? " is-active" : ""}`}
                  aria-pressed={isActive}
                  data-estimate-tier={t}
                  onClick={() => {
                    setLocalEstTier(t)
                    d.onEstimateTierChange?.(t)
                  }}
                >
                  <span className="tcs-tier-est-badge">{STEP_TIER_SHORT[t]}</span>
                  <span className="tcs-tier-est-label">{TIER_PICKER_LABEL[t]}</span>
                  <b className="tcs-tier-est-val">{dur(tierInfo.estimate)}</b>
                  <small className="tcs-tier-est-meta">
                    run {dur(tierInfo.running)} · orig {dur(tierInfo.original)}
                  </small>
                </button>
              )
            })}
          </div>
          <h4>Original vs. running ({STEP_TIER_SHORT[activeEstTier]})</h4>
          <div className="tcs-est-compare" aria-label="Original versus running estimate">
            <div className="tcs-est-fig" title="Before any steps were completed: sum of initial estimates, or actual duration at finish if never estimated">
              <span>Original</span>
              <b>{dur(activeDetail.original)}</b>
              <small>pre-completion baseline</small>
            </div>
            <div className="tcs-est-fig" title="Actual duration of completed steps where known, plus estimates for open or unknown steps">
              <span>Running</span>
              <b>{dur(activeDetail.running)}</b>
              <small>actuals done + open est</small>
            </div>
            <div
              className={`tcs-est-fig is-delta${activeDetail.running > activeDetail.original ? " is-over" : ""}`}
              title="Running minus the original estimate"
            >
              <span>Delta</span>
              <b>{signedDur(activeDetail.running - activeDetail.original)}</b>
              <small>
                {activeDetail.running === activeDetail.original
                  ? "same as the original"
                  : activeDetail.running < activeDetail.original
                    ? "under the original"
                    : "over the original"}
              </small>
            </div>
          </div>
          <h4>Where {dur(activeEst)} comes from</h4>
          <p className="tcs-formula">est = max(own, Σ parts) = max({dur(own)}, {dur(activeParts)}) = <b>{dur(activeEst)}</b></p>
          <R k="Source">{!activeEst ? "nothing set yet" : fromParts ? "the sum of the steps (larger than the own estimate)" : "the own estimate (parts are smaller or unset)"}</R>
          <R k="Own estimate">{own ? dur(own) : "none set"}</R>
          <R k="Parts total">{dur(activeParts)} across {d.view.length} {d.view.length === 1 ? "part" : "parts"}</R>
          <R k="Unsplit">{unsplit ? `${dur(unsplit)} (${pct(unsplit, activeEst)}) not split into steps` : "nothing"}</R>
          <h4>History of this estimate</h4>
          {log.length ? (
            <>
              <ul className="tcs-rows">
                {log.map((e, i) => (
                  <li key={e.at + i}>
                    <span>{stamp(e.at)}</span>
                    <b>{dur(e.minutes)}</b>
                    <em>{i ? signedDur(e.minutes - log[i - 1].minutes) : "first"}</em>
                  </li>
                ))}
              </ul>
              <p className="is-quiet">
                {log.length} {log.length === 1 ? "value" : "values"} · first {dur(log[0].minutes)} → now {dur(log[log.length - 1].minutes)} ({log[0].minutes ? `${Math.round(((log[log.length - 1].minutes - log[0].minutes) / log[0].minutes) * 100)}%` : "—"})
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
      value: dur(d.parts),
      sub: `${d.view.length} ${d.view.length === 1 ? "part" : "parts"}`,
      body: (
        <>
          <h4>Top-level steps (click to select)</h4>
          {parts.length ? (
            <ul className="tcs-rows is-pick is-parts">
              {parts.map(({ s, m }) => {
                const row = partLedger(s, m, d.stepSpent)
                return (
                  <li key={s.id}>
                    <button type="button" data-no95 onClick={() => (d.onPick(s.id), setOpen(null))} title="Select this step in the detail panel">
                      <span className="tcs-part-name">
                        <span>{s.description}</span>
                        {row.done ? <em>done</em> : null}
                      </span>
                      <b className="tcs-part-est">
                        <span>est</span>
                        {m ? dur(m) : "—"}
                      </b>
                      <span className={`tcs-split${row.tone ? ` ${row.tone}` : ""}`} aria-hidden>
                        <i style={{ width: `${row.fill}%` }} />
                      </span>
                      <span className="tcs-part-meta">
                        <em>spent {dur(row.spent)}</em>
                        <em>{row.over > 0 ? `${dur(row.over)} over` : m > 0 || row.done ? `left ${dur(row.left)}` : "left —"}</em>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="is-quiet">No steps yet.</p>
          )}
          <p className="tcs-formula">Σ = {dur(d.parts)}{parts.length ? ` · mean ${dur(Math.round(d.parts / parts.length))}` : ""}{biggest.s && biggest.m ? ` · largest “${biggest.s.description}” ${pct(biggest.m, d.parts)}` : ""}</p>
          {d.est && d.parts && d.est !== d.parts ? <R k="Against estimate">{d.est > d.parts ? `${dur(d.est - d.parts)} of the estimate is unsplit` : `${dur(d.parts - d.est)} over the own estimate`}</R> : null}
        </>
      ),
    },
    {
      id: "spent",
      label: "Spent",
      value: dur(d.spent),
      sub: d.est ? pct(d.spent, d.est) + " of est" : undefined,
      body: (
        <>
          <h4>Time on this task</h4>
          <p className="tcs-formula">
            {dur(d.spent)}{d.est ? ` · ${pct(d.spent, d.est)} of the ${dur(d.est)} estimate` : ""}
            {d.periodLabel ? ` · ${dur(d.periodSpent)} this ${d.periodLabel}` : ""}
          </p>
          {d.spentAccount && (d.spentAccount.unlabeled > 0 || d.spentAccount.children.length > 0) ? (
            <ul className="tcs-rows" aria-label="Where the minutes sit">
              {d.spentAccount.unlabeled > 0 ? (
                <li>
                  <span>{d.spentOnly ?? "on this task only"}</span>
                  <b>{dur(d.spentAccount.unlabeled)}</b>
                </li>
              ) : null}
              {d.spentAccount.children.map((child) => (
                <li key={child.id}>
                  <span>{d.spentScope?.names.get(child.id) ?? "a part"}</span>
                  <b>{dur(child.total)}</b>
                </li>
              ))}
            </ul>
          ) : null}
          {d.spentScope ? <SpentBlocks scope={d.spentScope} /> : null}
          {d.penPool ? <p className="is-quiet">The linked pen has {dur(d.penPool)} that is not this task.</p> : null}
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
      value: `${stats.done}/${stats.leaves}`,
      sub: `ends · ρ ${formatPercent(stats.raw)} · σ ${formatPercent(stats.split)}`,
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
    <>
    <div className="tcs-stats" ref={wrap} role="group" aria-label="Task totals">
      {cards.map((c) => (
        <div key={c.id} className="tcs-stat-wrap">
          <button
            type="button"
            className="tcs-stat"
            data-no95
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
            <div id={`tcs-pop-${c.id}`} className={`tcs-stat-pop${c.wide || c.id === "spent" ? " is-wide" : ""}`} role="group" aria-label={`${c.label} detail`}>
              {c.body}
            </div>
          ) : null}
        </div>
      ))}
    </div>
    <div className="tcs-unit" role="group" aria-label="Duration unit">
      <button type="button" aria-pressed={unit === "h"} aria-label="Hours" title="Show durations in hours" onClick={() => timeUnit?.setUnit("h")}>
        h
      </button>
      <button type="button" aria-pressed={unit === "m"} aria-label="Minutes" title="Show durations in minutes" onClick={() => timeUnit?.setUnit("m")}>
        m
      </button>
    </div>
    </>
  )
}

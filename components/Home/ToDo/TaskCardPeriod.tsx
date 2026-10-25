/**
 * components/Home/ToDo/TaskCardPeriod.tsx — "This day": how the task stands in the period
 *
 * Two Dash readouts (spent, left for the chosen level), flip-able marks, one
 * bar per level that sets the card's level when clicked, pushes in plain words,
 * and the sessions that held the task. Every row says what it means.
 */
"use client"

import { DashReading } from "../dash/dash-primitives"
import { formatStatMinutes, useTaskCardTimeUnit } from "./TaskCardStats"
import { STEP_TIERS, STEP_TIER_LABEL, STEP_TIER_SHORT } from "@/lib/step-tiers"
import { formatPercent } from "@/lib/step-progress"
import type { StepTier } from "@/lib/types"

export interface TaskCardPeriodProps {
  period: string
  required: boolean
  prioritized: boolean
  onToggleRequired: () => void
  onTogglePrioritized: () => void
  pushed: number
  pushesIn: number
  pushesOut: number
  periodMinutes: number
  allTimeMinutes: number
  penPool?: number
  level: StepTier
  reached: StepTier | "none"
  split: Partial<Record<StepTier, number | null>>
  remaining: number
  dayLeft: number
  sessions: { title: string; tier?: StepTier | "none" }[]
  attentionNote?: string
  /** `undefined` shows every level. */
  aimed?: StepTier
  onAim: (t: StepTier | undefined) => void
}

export function TaskCardPeriod(p: TaskCardPeriodProps) {
  const unit = useTaskCardTimeUnit()
  const dur = (n: number) => formatStatMinutes(n, unit)
  const over = p.remaining > p.dayLeft
  const rank = (t: StepTier | "none") => (t === "none" ? -1 : STEP_TIERS.indexOf(t))
  return (
    <section className="tcp" aria-label={`This ${p.period}`}>
      <h3>This {p.period}</h3>
      <p className="tcp-lede">How this task stands today. Tap a mark to flip it, tap a level to aim the card at it.</p>

      <div className="tcp-glass">
        <div className="tcp-pod" title={`Minutes painted on this task this ${p.period}, against all time`}>
          <span className="tcp-leg">Spent</span>
          <DashReading text={dur(p.periodMinutes)} />
          <span className="tcp-cap">of {dur(p.allTimeMinutes)} all time</span>
        </div>
        <div className={`tcp-pod${over ? " is-over" : ""}`} title={`Minutes still needed to reach ${STEP_TIER_LABEL[p.level]}, against the working time left today`}>
          <span className="tcp-leg">Left · {STEP_TIER_SHORT[p.level]}</span>
          <DashReading text={dur(p.remaining)} />
          <span className="tcp-cap">{over ? `only ${dur(p.dayLeft)} free today` : `${dur(p.dayLeft)} free today`}</span>
        </div>
      </div>

      <div className="tcp-marks" role="group" aria-label="Marks">
        <button type="button" aria-pressed={p.required} onClick={p.onToggleRequired} title="Required: this must happen this period. Tap to flip.">
          <i aria-hidden /> Required
        </button>
        <button type="button" aria-pressed={p.prioritized} onClick={p.onTogglePrioritized} title="Prioritized: do it before the rest. Tap to flip.">
          <i aria-hidden /> Prioritized
        </button>
      </div>

      <div className="tcp-levels" role="group" aria-label="Levels">
        {STEP_TIERS.map((t) => {
          const v = p.split[t]
          const hit = rank(p.reached) >= rank(t)
          return (
            <button key={t} type="button" className={`tcp-level is-${t}${p.aimed === t ? " is-aimed" : ""}${hit ? " is-hit" : ""}`} aria-pressed={p.aimed === t} onClick={() => p.onAim(p.aimed === t ? undefined : t)} title={`${STEP_TIER_LABEL[t]}: ${formatPercent(v ?? null)} done. Tap to show only what counts for it.`}>
              <span className="tcp-leg">{STEP_TIER_SHORT[t]}</span>
              <span className="tcp-meter" aria-hidden>
                {Array.from({ length: 10 }, (_, i) => (
                  <b key={i} className={(v ?? 0) * 10 > i ? "is-on" : undefined} />
                ))}
              </span>
              <span className="tcp-pct">{formatPercent(v ?? null)}</span>
              <span className="tcp-cap">{hit ? "reached" : STEP_TIER_LABEL[t]}</span>
            </button>
          )
        })}
      </div>

      <dl className="tcp-pushes">
        <div title="Times this task was pushed to a later day">
          <dt>pushed</dt>
          <dd>×{p.pushed}</dd>
          <small>moved later</small>
        </div>
        <div title="Pushed onto this period from another">
          <dt>in</dt>
          <dd>{p.pushesIn}</dd>
          <small>from other days</small>
        </div>
        <div title="Pushed out of this period to another">
          <dt>out</dt>
          <dd>{p.pushesOut}</dd>
          <small>to other days</small>
        </div>
      </dl>

      <p className="tcp-sessions">
        <span className="tcp-leg">Sessions</span>
        {p.sessions.length ? p.sessions.slice(-5).map((s, i) => <span key={i} className="tcp-chip">{s.title || "Session"}{s.tier && s.tier !== "none" ? ` · ${STEP_TIER_SHORT[s.tier]}` : ""}</span>) : <em>None yet. A planned session that holds this task shows here.</em>}
      </p>
      {p.penPool ? <p className="is-quiet">Pen overall {dur(p.penPool)}, not tagged to this task.</p> : null}
      {p.attentionNote ? <p className="is-quiet">{p.attentionNote}</p> : null}
    </section>
  )
}

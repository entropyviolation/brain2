"use client"

/**
 * A parked session: clock, line list, parking-lot stage, and Resume.
 */
import { useRef, useState } from "react"
import type { Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { useSessionPlanStore } from "@/lib/session-plan-store"
import {
  allLines,
  lineIsDone,
  lineLabel,
  lineSeconds,
  lineTarget,
  parkedLong,
  remainingSec,
  removeLine,
  resumeParked,
  type SessionPlan,
} from "@/lib/session-plan"
import { setTodoPrefs, useTodoPrefs } from "../todo-prefs"
import { ParkingLotModeKeys, ParkingLotStage } from "../parking-lot/ParkingLot"
import type { LotCar, LotScene } from "../parking-lot/types"
import { fmtClock, fmtMinutes } from "./format"
import { FutureNoteBanner } from "./future-note"
import { TIER_SHORT } from "./tiers"

function ParkedView({
  plan,
  tasks,
  onChange,
  onShelves,
}: {
  plan: SessionPlan
  tasks: Task[]
  onChange: (plan: SessionPlan) => void
  onShelves: () => void
}) {
  const now = new Date()
  const stale = parkedLong(plan, now)
  const remembered = allLines(plan).find(({ line }) => line.id === plan.activeLineId)?.line
  const { parkingLotMode } = useTodoPrefs()
  const open = useSessionPlanStore((s) => s.open)
  const sceneRef = useRef<LotScene | null>(null)
  const [leaving, setLeaving] = useState(false)
  const cars: LotCar[] = open
    .filter((p) => p.phase === "parked")
    .map((p) => {
      const lines = allLines(p)
      const at = lines.find(({ line }) => line.id === p.activeLineId) ?? lines[0]
      return { id: p.id, title: p.title, leftLabel: `${fmtClock(remainingSec(p, now))} left`, tier: at?.tier ?? "min" }
    })
  const resumeNow = (mode: "as-was" | "fresh") => onChange(resumeParked(plan, useTaskStore.getState().tasks, new Date(), mode))
  // A scene plays its resume motion first; Classic resumes at once.
  const resume = async (mode: "as-was" | "fresh") => {
    const scene = sceneRef.current
    if (!scene) return resumeNow(mode)
    if (leaving) return
    setLeaving(true)
    try {
      await scene.playResume(plan.id)
    } finally {
      setLeaving(false)
    }
    resumeNow(mode)
  }
  return (
    <div className={`todo-session-parked pl-skin-${parkingLotMode}`}>
      <ParkingLotModeKeys mode={parkingLotMode} onChange={(m) => setTodoPrefs({ parkingLotMode: m })} />
      {parkingLotMode !== "classic" ? (
        <ParkingLotStage
          mode={parkingLotMode}
          cars={cars}
          selectedId={plan.id}
          onPick={(id) => {
            // A pick mid-resume would show one session while the old one resumes.
            if (!leaving) useSessionPlanStore.getState().focus(id)
          }}
          sceneRef={sceneRef}
        />
      ) : null}
      <div className="pl-detail">
      <FutureNoteBanner note={plan.futureNote} />
      <p className="todo-session-parked-head">
        <span className="todo-session-clock is-paused">{fmtClock(remainingSec(plan, now))}</span>
        <span>
          left of {fmtMinutes(plan.durationMin)}
          {plan.parkedAt ? ` · parked ${new Date(plan.parkedAt).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
        </span>
      </p>
      {remembered ? <p className="todo-session-current-path">Was on: {lineLabel(remembered, tasks)}</p> : null}
      <ol className="todo-session-runlist">
        {allLines(plan).map(({ line, tier }) => {
          const gone = !tasks.some((t) => t.id === line.taskId) || (!!line.stepId && !lineTarget(line, tasks).step)
          const done = !gone && lineIsDone(line, tasks)
          return (
            <li key={line.id} className={`todo-session-runline is-${tier}${done ? " is-done" : ""}${gone ? " is-gone" : ""}${line.id === plan.activeLineId ? " is-current" : ""}`}>
              <span className="todo-session-mark" aria-hidden>
                {done ? "✓" : line.id === plan.activeLineId ? "●" : "○"}
              </span>
              <span className="todo-session-tiertag">{TIER_SHORT[tier]}</span>
              <span className="todo-session-runname">{gone ? "Deleted task" : lineLabel(line, tasks)}</span>
              {gone ? (
                <button type="button" className="todo-verb is-quiet" onClick={() => onChange(removeLine(plan, line.id))}>
                  Remove
                </button>
              ) : (
                <span className="todo-session-mins">
                  {fmtMinutes(lineSeconds(plan, line, now) / 60)} / {line.estMin ? fmtMinutes(line.estMin) : "–"}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      </div>
      <div className="todo-dialog-actions">
        <button type="button" className="todo-btn" onClick={onShelves}>
          Sessions
        </button>
        {stale ? (
          <>
            <span className="todo-session-reason">Parked over a day ago.</span>
            <button type="button" className="todo-btn" disabled={leaving} onClick={() => void resume("fresh")}>
              Fresh clock, same lines
            </button>
            <button type="button" className="todo-btn is-primary" disabled={leaving} onClick={() => void resume("as-was")}>
              Resume as was
            </button>
          </>
        ) : (
          <button type="button" className="todo-btn is-primary" disabled={leaving} onClick={() => void resume("as-was")}>
            Resume
          </button>
        )}
      </div>
    </div>
  )
}

export { ParkedView }

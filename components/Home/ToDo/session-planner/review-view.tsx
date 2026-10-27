"use client"

/**
 * Session outcomes, points, the Plan block (`source: "session"`), time logs, and archive.
 */
import { useState } from "react"
import type { Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { useSessionPlanStore } from "@/lib/session-plan-store"
import {
  allLines,
  closeSession,
  keptRefs,
  lineIsDone,
  lineLabel,
  ranMinutes,
  sessionTimeLogs,
  setLineOutcome,
  tierReached,
  type SessionLine,
  type SessionPlan,
  type SessionTier,
} from "@/lib/session-plan"
import { activeTierPoints } from "@/lib/completion-tiers"
import { usePointsStore } from "@/lib/points-store"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { placementFromDrop } from "@/lib/planned-actions"
import { formatLocalDateKey } from "@/lib/date-utils"
import { pushTask } from "@/lib/services/scheduling-service"
import { NativeSelect } from "@/components/ui/native-select"
import { putSession } from "./drafts"
import { fmtMinutes } from "./format"
import { FutureNoteInput } from "./future-note"
import { TIER_LABEL, TIER_SHORT } from "./tiers"

function ReviewView({ plan, tasks, onDone }: { plan: SessionPlan; tasks: Task[]; onDone: () => void }) {
  const setCurrent = (next: SessionPlan) => putSession(next)
  const archive = useSessionPlanStore((s) => s.archive)
  const [note, setNote] = useState(plan.note ?? "")
  const [futureNote, setFutureNote] = useState(plan.futureNote?.text ?? "")
  const amounts = activeTierPoints()
  const reached = tierReached(plan, tasks)
  const preview = closeSession(plan, tasks, { bareMin: amounts.bareMin, goal: amounts.goal, exceptional: amounts.exceptional })

  const save = () => {
    // An unfinished line with no choice made reads as "Keep for next session", as the menu shows.
    let decided = plan
    for (const { line } of allLines(plan)) {
      if (!line.outcome && !lineIsDone(line, tasks)) decided = setLineOutcome(decided, line.id, "keep")
    }
    const closed = closeSession(decided, tasks, { bareMin: amounts.bareMin, goal: amounts.goal, exceptional: amounts.exceptional }, note, futureNote)
    if (closed.points && closed.points > 0) {
      usePointsStore.getState().addPoints(`session:${closed.id}`, closed.points, `Session · ${closed.title} (${TIER_LABEL[reached as SessionTier] ?? "none"})`)
    }
    for (const { line } of allLines(closed)) {
      if (line.outcome === "push" && !lineIsDone(line, tasks)) pushTask(line.taskId, "day")
    }
    const ran = ranMinutes(closed)
    if (closed.startedAt && ran > 0) {
      const start = new Date(closed.startedAt)
      usePlannedActionStore.getState().addAction(
        placementFromDrop({
          date: formatLocalDateKey(start),
          hour: start.getHours(),
          minute: start.getMinutes(),
          durationMinutes: ran,
          source: "session",
          sourceId: closed.id,
          title: `Session · ${closed.title}`,
          notes: `${reached === "none" ? "No tier reached" : `${TIER_LABEL[reached as SessionTier]} reached`}${closed.note ? ` · ${closed.note}` : ""}`,
        }),
      )
    }
    writeSessionTimeLogs(closed)
    archive(closed, keptRefs(closed, tasks))
    onDone()
  }

  return (
    <div className="todo-session-review">
      <p className={`todo-session-reached is-${reached}`}>
        {reached === "none" ? "Bare minimum not reached yet." : `${TIER_LABEL[reached as SessionTier]} reached`}
        {preview.points ? ` · +${preview.points} points` : ""}
        {plan.startedAt ? ` · ran ${fmtMinutes(ranMinutes(plan))} of ${fmtMinutes(plan.durationMin)}` : ""}
      </p>
      <table className="todo-session-table">
        <thead>
          <tr>
            <th scope="col">Line</th>
            <th scope="col">Tier</th>
            <th scope="col">Est</th>
            <th scope="col">Actual</th>
            <th scope="col">Then</th>
          </tr>
        </thead>
        <tbody>
          {allLines(plan).map(({ line, tier }) => {
            const done = lineIsDone(line, tasks)
            const actual = (line.actualSec ?? 0) / 60
            const over = line.estMin && actual > line.estMin * 1.25
            return (
              <tr key={line.id} className={done ? "is-done" : undefined}>
                <td>{lineLabel(line, tasks)}</td>
                <td>{TIER_SHORT[tier]}</td>
                <td>{line.estMin ? fmtMinutes(line.estMin) : "–"}</td>
                <td className={over ? "is-over" : undefined}>{actual >= 1 ? fmtMinutes(actual) : "–"}</td>
                <td>
                  {done ? (
                    "done"
                  ) : (
                    <NativeSelect
                      aria-label={`What next for ${lineLabel(line, tasks)}`}
                      value={line.outcome ?? "keep"}
                      onChange={(e) => setCurrent(setLineOutcome(plan, line.id, e.target.value as SessionLine["outcome"]))}
                    >
                      <option value="keep">Keep for next session</option>
                      {line.stepId ? null : <option value="push">Push to tomorrow</option>}
                      <option value="leave">Leave</option>
                    </NativeSelect>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <label className="todo-session-note">
        <span>One line on how it went</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What helped, what got in the way" />
      </label>
      <label className="todo-session-note">
        <span>Note to tomorrow-you</span>
        <FutureNoteInput value={futureNote} onChange={setFutureNote} />
      </label>
      <div className="todo-dialog-actions">
        <button type="button" className="todo-btn" onClick={() => setCurrent({ ...plan, phase: "run", clock: plan.clock ? { ...plan.clock } : null })}>
          Back to the session
        </button>
        <button type="button" className="todo-btn is-primary" onClick={save}>
          Save session
        </button>
      </div>
    </div>
  )
}

/** Each line's minutes onto its task's `timeLogs`, less what the pen clock already logged. */
function writeSessionTimeLogs(plan: SessionPlan): void {
  const store = useTaskStore.getState()
  for (const { taskId, entry } of sessionTimeLogs(plan, store.tasks)) {
    const task = useTaskStore.getState().tasks.find((t) => t.id === taskId)
    if (task) store.updateTask({ ...task, timeLogs: [...(task.timeLogs ?? []), entry] })
  }
}

export { ReviewView }

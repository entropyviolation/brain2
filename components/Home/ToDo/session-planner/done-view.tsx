/**
 * Read-only review of a finished session, with Run again.
 */
import type { Task } from "@/lib/types"
import { allLines, lineLabel, ranMinutes, type SessionPlan } from "@/lib/session-plan"
import { fmtMinutes } from "./format"
import { FutureNoteBanner } from "./future-note"
import { TIER_LABEL, TIER_SHORT } from "./tiers"

/** A done session, read-only, with its review. */
function DoneView({ plan, tasks, onBack, onRunAgain }: { plan: SessionPlan; tasks: Task[]; onBack: () => void; onRunAgain: () => void }) {
  const reached = plan.reachedTier ?? "none"
  return (
    <div className="todo-session-review is-readonly">
      <p className={`todo-session-reached is-${reached}`}>
        {reached === "none" ? "No tier reached" : `${TIER_LABEL[reached]} reached`}
        {plan.points ? ` · +${plan.points} points` : ""}
        {plan.startedAt ? ` · ran ${fmtMinutes(ranMinutes(plan))} of ${fmtMinutes(plan.durationMin)}` : ""}
      </p>
      {plan.note ? <p className="todo-session-current-path">“{plan.note}”</p> : null}
      <FutureNoteBanner note={plan.futureNote} />
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
            const actual = (line.actualSec ?? 0) / 60
            return (
              <tr key={line.id} className={line.doneAt ? "is-done" : undefined}>
                <td>{lineLabel(line, tasks)}</td>
                <td>{TIER_SHORT[tier]}</td>
                <td>{line.estMin ? fmtMinutes(line.estMin) : "–"}</td>
                <td>{actual >= 1 ? fmtMinutes(actual) : "–"}</td>
                <td>{line.doneAt ? "done" : line.outcome === "push" ? "pushed" : line.outcome === "leave" ? "left" : "kept"}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="todo-dialog-actions">
        <button type="button" className="todo-btn" onClick={onBack}>
          Back to Sessions
        </button>
        <button type="button" className="todo-btn is-primary" onClick={onRunAgain}>
          Run again
        </button>
      </div>
    </div>
  )
}

export { DoneView }

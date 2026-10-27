/**
 * components/Home/Habits/habit-form/target.tsx — Target or Climb.
 *
 * One of the two fieldsets, both using `id="habit95-sec-target"`. Goal, time,
 * and count show Target. Incremental shows Climb. Time and count stay in the
 * fieldset gate even though the section key is only goal or climb.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import { clampCoverageThreshold, effectiveCoverageLink } from "@/lib/habit-completion-source"
import { TaskType, type IncrementalHabitData, type WeeklyTask } from "@/lib/types"

export function HabitFormTarget({
  task,
  setTask,
  listMeasure,
  setCoverageLocked,
  climb,
  setClimb,
}: {
  task: WeeklyTask
  setTask: Dispatch<SetStateAction<WeeklyTask>>
  listMeasure: { derived: boolean; target: number }
  setCoverageLocked: Dispatch<SetStateAction<boolean>>
  climb: IncrementalHabitData
  setClimb: (patch: Partial<IncrementalHabitData>) => void
}) {
  return (
    <>
      {(task.type === TaskType.GOAL || task.type === TaskType.TIME || task.type === TaskType.COUNT) && (
        <fieldset id="habit95-sec-target" tabIndex={-1} className="habit95-group habit95-sec-target">
          <legend>Target</legend>
          <div className="habit95-goal-grid">
            <div className="habit95-field">
              <label htmlFor="task-goal">Amount</label>
              <input
                id="task-goal"
                className="habit95-input"
                type="number"
                min="0"
                step="0.5"
                value={listMeasure.derived ? listMeasure.target : task.goal || ""}
                readOnly={listMeasure.derived}
                onChange={(e) => {
                  if (listMeasure.derived) return
                  const goal = Number.parseFloat(e.target.value) || 0
                  setTask((current) => {
                    const next = { ...current, goal }
                    // Amount is the same number as the coverage threshold when linked —
                    // keep coverageLink in sync so submit does not overwrite with the old %.
                    if (effectiveCoverageLink(current)) {
                      setCoverageLocked(true)
                      next.coverageLink = {
                        threshold: clampCoverageThreshold(goal),
                        enabled: true,
                      }
                      next.unit = current.unit || "%"
                    }
                    return next
                  })
                }}
                placeholder="10"
                required
              />
            </div>
            <div className="habit95-field">
              <label htmlFor="task-unit">Unit (optional)</label>
              <input
                id="task-unit"
                className="habit95-input"
                value={task.unit || ""}
                onChange={(e) => setTask({ ...task, unit: e.target.value })}
                placeholder="minutes, pages…"
              />
            </div>
          </div>
          <label className="habit95-check">
            <input
              type="checkbox"
              checked={!!task.showGoalBar}
              onChange={(e) => setTask({ ...task, showGoalBar: e.target.checked || undefined })}
            />
            Cell progress tube
          </label>
          {listMeasure.derived ? (
            <p className="habit95-hint">This amount is the list length. It follows the list.</p>
          ) : null}
          <p className="habit95-hint">A thin tube under the number, filled by how close the cell is to its amount.</p>
        </fieldset>
      )}

      {task.type === TaskType.INCREMENTAL && (
        <fieldset id="habit95-sec-target" tabIndex={-1} className="habit95-group habit95-sec-target">
          <legend>Climb</legend>
          <div className="habit95-types" role="radiogroup" aria-label="Climb cadence">
            <button
              type="button"
              className="habit95-choice"
              role="radio"
              aria-checked={climb.cadence === "weekly"}
              onClick={() => setClimb({ cadence: "weekly" })}
            >
              <span className="habit95-choice-name">Weekly +</span>
              <span className="habit95-choice-desc">Like a goal. Rises Monday after 4+ hits.</span>
            </button>
            <button
              type="button"
              className="habit95-choice"
              role="radio"
              aria-checked={climb.cadence === "daily"}
              onClick={() => setClimb({ cadence: "daily" })}
            >
              <span className="habit95-choice-name">Daily +</span>
              <span className="habit95-choice-desc">Log a score. Target = last score + increment.</span>
            </button>
          </div>
          <div className="habit95-goal-grid" style={{ marginTop: 8 }}>
            <div className="habit95-field">
              <label htmlFor="climb-start">Starting value</label>
              <input
                id="climb-start"
                className="habit95-input"
                type="number"
                value={climb.startValue}
                onChange={(e) => setClimb({ startValue: Number.parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="habit95-field">
              <label htmlFor="climb-increment">
                {climb.cadence === "daily" ? "Daily increment" : "Weekly increment"}
              </label>
              <input
                id="climb-increment"
                className="habit95-input"
                type="number"
                min="0"
                step="0.5"
                value={climb.increment}
                onChange={(e) => setClimb({ increment: Number.parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="habit95-field">
              <label htmlFor="climb-unit">Unit (optional)</label>
              <input
                id="climb-unit"
                className="habit95-input"
                value={climb.unit || ""}
                onChange={(e) => setClimb({ unit: e.target.value })}
                placeholder="minutes, rating…"
              />
            </div>
          </div>
          <p className="habit95-hint">
            {climb.cadence === "weekly"
              ? "Shown as a goal (e.g. 2 minutes). Next Monday the target rises only if you hit it on at least 4 days this week — overshooting a day does not count extra."
              : "Each day log your current score. That score becomes tomorrow’s base even if it dropped. Tomorrow’s target is last log + increment. A skipped day keeps the previous base. Week % is how far you climbed versus increment × 7."}
          </p>
        </fieldset>
      )}
    </>
  )
}

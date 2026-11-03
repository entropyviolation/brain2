/**
 * components/Home/Habits/habit-form/points-time-wording.tsx — Points, time, wording.
 *
 * Three sections, always mounted, returned as a fragment so each stays a
 * direct child of `.habit95-fields`. The points field still sets
 * `rewardTouched` before it writes the draft.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import { describeHabitTimeEstimate } from "@/lib/habit-time-estimate"
import { TaskType, type HabitTimeEstimate, type WeeklyTask } from "@/lib/types"

export function HabitFormPointsTimeWording({
  task,
  setTask,
  setRewardTouched,
  dailyFullMark,
  measuredInTime,
  timeEstimate,
  setTimeEstimate,
  setEstimateNA,
  usesRate,
}: {
  task: WeeklyTask
  setTask: Dispatch<SetStateAction<WeeklyTask>>
  setRewardTouched: Dispatch<SetStateAction<boolean>>
  dailyFullMark: number
  measuredInTime: boolean
  timeEstimate: HabitTimeEstimate
  setTimeEstimate: (patch: Partial<HabitTimeEstimate>) => void
  setEstimateNA: (na: boolean) => void
  usesRate: boolean
}) {
  return (
    <>
      <fieldset id="habit95-sec-points" tabIndex={-1} className="habit95-group habit95-sec-points">
        <legend>Points &amp; bonus</legend>
        <p className="habit95-hint">
          The number below is this habit&apos;s own points. A weekly, monthly, or season habit pays that number
          the first time its goal is met. A daily habit&apos;s ledger line is {dailyFullMark} × that day&apos;s
          completion ratio (Points rules), not this field. Day-wide bonuses live in Habits → Settings and in Points rules.
        </p>
        <div className="habit95-goal-grid">
          <div className="habit95-field">
            <label htmlFor="habit-reward">Completion points</label>
            <input
              id="habit-reward"
              className="habit95-input"
              type="number"
              min={0}
              step={1}
              aria-label="Completion points"
              value={task.rewardValue ?? 0}
              onChange={(e) => {
                setRewardTouched(true)
                setTask({
                  ...task,
                  rewardValue: Math.max(0, Number.parseInt(e.target.value, 10) || 0),
                })
              }}
            />
          </div>
          <div className="habit95-field">
            <label htmlFor="habit-bonus-note">Bonus formula</label>
            <input
              id="habit-bonus-note"
              className="habit95-input"
              readOnly
              value={
                (task.frequency || "daily") === "daily"
                  ? `${dailyFullMark} × day ratio`
                  : "Completion points when newly met"
              }
              aria-label="Bonus formula"
            />
          </div>
        </div>
      </fieldset>


      <fieldset id="habit95-sec-time" tabIndex={-1} className="habit95-group habit95-sec-time">
        <legend>Time estimate</legend>
        <p className="habit95-hint">
          Marking this habit done writes a row on your To&nbsp;Do list. Give it a length and that row carries a real
          time window — when you started, when you finished, how long it took — instead of a bare date.
        </p>

        {measuredInTime ? (
          <p className="habit95-hint">{describeHabitTimeEstimate(task)}</p>
        ) : (
          <>
            <label className="habit95-check">
              <input
                type="checkbox"
                checked={!!task.timeEstimateNA}
                onChange={(e) => setEstimateNA(e.target.checked)}
              />
              N/A
            </label>
            {task.timeEstimateNA ? (
              <p className="habit95-hint">No duration is stored. Grades and the plan treat this as no time estimate.</p>
            ) : (
              <>
                <div className="habit95-goal-grid">
                  {usesRate && (
                    <div className="habit95-field">
                      <label htmlFor="time-per-unit">Minutes per {task.unit?.trim() || "unit"}</label>
                      <input
                        id="time-per-unit"
                        className="habit95-input"
                        type="number"
                        min="0"
                        step="1"
                        value={timeEstimate.minutesPerUnit ?? ""}
                        onChange={(e) =>
                          setTimeEstimate({ minutesPerUnit: Number.parseFloat(e.target.value) || undefined })
                        }
                        placeholder="10"
                      />
                    </div>
                  )}
                  <div className="habit95-field">
                    <label htmlFor="time-flat">Minutes per completion</label>
                    <input
                      id="time-flat"
                      className="habit95-input"
                      type="number"
                      min="0"
                      step="1"
                      value={timeEstimate.minutes ?? ""}
                      onChange={(e) => setTimeEstimate({ minutes: Number.parseFloat(e.target.value) || undefined })}
                      placeholder={usesRate ? "fallback when nothing is logged" : "20"}
                    />
                  </div>
                </div>

                <label className="habit95-check">
                  <input
                    type="checkbox"
                    checked={timeEstimate.precision === "definite"}
                    onChange={(e) => setTimeEstimate({ precision: e.target.checked ? "definite" : "estimated" })}
                  />
                  This length is exact, not a guess
                </label>

                <p className="habit95-hint">{describeHabitTimeEstimate(task)}</p>
              </>
            )}
          </>
        )}
      </fieldset>

      <details id="habit95-sec-wording" tabIndex={-1} className="habit95-group habit95-details habit95-sec-wording">
        <summary>Done task wording</summary>
        <p className="habit95-hint">
          Optional. “read {"{value}"} pages” with 7 logged becomes “read 7 pages”, even when the goal is 3. Leave this
          blank to keep the habit name.
        </p>
        {task.type === TaskType.TEXT ? (
          <label className="habit95-check">
            <input
              type="checkbox"
              checked={!!task.doneTaskUseText}
              onChange={(e) => setTask((current) => ({ ...current, doneTaskUseText: e.target.checked || undefined }))}
            />
            Use the text entered
          </label>
        ) : null}
        <div className="habit95-field">
          <label htmlFor="done-task-phrase">Phrase</label>
          <input
            id="done-task-phrase"
            className="habit95-input"
            value={task.doneTaskPhrase ?? ""}
            placeholder="read {value} pages"
            onChange={(e) => setTask((current) => ({ ...current, doneTaskPhrase: e.target.value }))}
          />
        </div>
      </details>
    </>
  )
}

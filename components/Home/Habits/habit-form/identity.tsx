/**
 * components/Home/Habits/habit-form/identity.tsx — Opening blocks of the habit form.
 *
 * Neglect line, Priority, Name, Gem, Frequency, and Type. Returned as a
 * fragment so each block stays a direct child of `.habit95-fields`.
 * `rewardTouched` and `setType` stay in `TaskForm`.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import { Star } from "lucide-react"
import { HabitGemChooser } from "@/components/Home/Habits/gem-picker"
import { openHabitInLists } from "@/lib/habit-list-item"
import { pickRandomCatalogGem, resolveTaskGem } from "@/lib/habit-gems"
import { habitPeriodPointsKey, type HabitPeriodPointDefaults } from "@/lib/habit-points"
import { applyPermanentPriority, applyRitualPriority, priorityMarkPercent } from "@/lib/habit-priority"
import { normalizeTaskType } from "@/lib/habit-utils"
import type { ThemeColors } from "@/lib/theme-store"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { FREQUENCIES, HABIT_TYPES, reasoningUnderLogLine } from "./model"

export function HabitFormIdentity({
  neglectSentence,
  task,
  setTask,
  prioritizeHabit,
  ritualOn,
  ritualMultiplier,
  initialTask,
  setRitualOverride,
  onLeaveForItem,
  colors,
  setType,
  creating,
  rewardTouched,
  defaultHabitPoints,
}: {
  neglectSentence: string | null
  task: WeeklyTask
  setTask: Dispatch<SetStateAction<WeeklyTask>>
  prioritizeHabit: () => void
  ritualOn: boolean
  ritualMultiplier: number
  initialTask?: WeeklyTask | null
  setRitualOverride: Dispatch<SetStateAction<boolean | null>>
  onLeaveForItem?: () => void
  colors: ThemeColors
  setType: (value: TaskType) => void
  creating: boolean
  rewardTouched: boolean
  defaultHabitPoints: HabitPeriodPointDefaults
}) {
  return (
    <>
      {neglectSentence ? (
        <p className="habit95-neglect-line habit95-sec-neglect">{neglectSentence}</p>
      ) : null}
      <fieldset id="habit95-sec-priority" tabIndex={-1} className="habit95-group habit95-sec-priority">
        <legend>Priority</legend>
        <p className="habit95-hint">
          Prioritize habit refreshes a green star. It is bright the day it is refreshed and loses a
          tenth of its strength each calendar day after that. Permanent priority holds it at full
          strength. A fully empty week (or week/month) still auto-prioritizes the next period and compounds.
        </p>
        <div className="habit-priority-actions">
          <button type="button" className="habit95-btn" onClick={prioritizeHabit}>
            Prioritize habit
          </button>
          <Star
            className="habit-priority-star"
            aria-label={`Priority star ${priorityMarkPercent(task, new Date(), ritualOn)}%`}
            style={{ opacity: priorityMarkPercent(task, new Date(), ritualOn) / 100 }}
            fill="currentColor"
            stroke="currentColor"
          />
        </div>
        {(task.priorityLog?.length ?? 0) > 0 ? (
          <ol className="habit-priority-log">
            {(task.priorityLog ?? []).map((line, index) => ({ line, index })).reverse().map(({ line, index }) => {
              const why = reasoningUnderLogLine(task, index)
              return (
                <li key={`${task.priorityLog?.length ?? 0}-${index}`}>
                  {line}
                  {why ? <span className="habit-priority-why">{why}</span> : null}
                </li>
              )
            })}
          </ol>
        ) : null}
        <label className="habit95-check">
          <input
            type="checkbox"
            checked={!!task.priorityPermanent}
            onChange={(e) => setTask((current) => applyPermanentPriority(current, e.target.checked))}
          />
          Permanent priority
        </label>
        {initialTask ? (
          <label className="habit95-check">
            <input
              type="checkbox"
              checked={ritualOn}
              onChange={(e) => {
                const on = e.target.checked
                setRitualOverride(on)
                if (on) setTask((current) => applyRitualPriority(current, "day"))
              }}
            />
            Morning ritual
          </label>
        ) : null}
        {ritualOn ? (
          <p className="habit-priority-mark">
            MORNING RITUAL
            <span className="habit-priority-mult">×{ritualMultiplier}</span>
          </p>
        ) : null}
        <label className="habit95-check">
          <input
            type="checkbox"
            checked={!!task.priorityMuted}
            onChange={(e) => setTask({ ...task, priorityMuted: e.target.checked || undefined })}
          />
          Ignore neglect
        </label>
      </fieldset>
      <div id="habit95-sec-name" tabIndex={-1} className="habit95-field habit95-sec-name">
        <label htmlFor="task-name">Habit Name</label>
        <input
          id="task-name"
          className="habit95-input"
          value={task.name}
          onChange={(e) => setTask({ ...task, name: e.target.value })}
          placeholder="e.g. Stretch, 10 pages, no phone after 10"
          required
          autoFocus
        />
        {initialTask ? (
          <button
            type="button"
            className="habit95-btn"
            style={{ marginTop: 6, alignSelf: "flex-start" }}
            onClick={() => {
              const habit = { ...task, id: initialTask.id }
              openHabitInLists(habit)
              onLeaveForItem?.()
            }}
          >
            Open item in Lists
          </button>
        ) : null}
      </div>

      <fieldset id="habit95-sec-gem" tabIndex={-1} className="habit95-group habit95-sec-gem">
        <legend>Gem</legend>
        <p className="habit95-hint">Jewel on the row edit button. A random catalog stone is assigned; pick or upload to keep your own.</p>
        <HabitGemChooser
          value={task.gem}
          fallback={resolveTaskGem(task)}
          onChange={(gem) => setTask({ ...task, gem: gem || pickRandomCatalogGem() })}
          label="Habit gem"
        />
      </fieldset>

      <fieldset id="habit95-sec-freq" tabIndex={-1} className="habit95-group habit95-sec-freq">
        <legend>Frequency</legend>
        <div className="habit95-freq" role="radiogroup" aria-label="Frequency">
          {FREQUENCIES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className="habit95-choice"
              role="radio"
              aria-checked={task.frequency === value}
              onClick={() =>
                setTask((current) => ({
                  ...current,
                  frequency: value,
                  rewardValue:
                    creating && !rewardTouched
                      ? defaultHabitPoints[habitPeriodPointsKey(value)]
                      : current.rewardValue,
                }))
              }
            >
              <span className="habit95-choice-name">{label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset id="habit95-sec-type" tabIndex={-1} className="habit95-group habit95-sec-type">
        <legend>Habit Type</legend>
        <p className="habit95-hint">How you will mark it done.</p>
        <div className="habit95-types" role="radiogroup" aria-label="Habit Type">
          {HABIT_TYPES.map(({ value, name, desc, colorKey, Icon }) => (
            <button
              key={value}
              type="button"
              className="habit95-choice"
              role="radio"
              aria-checked={normalizeTaskType(task.type) === value}
              onClick={() => setType(value)}
            >
              <span className="habit95-choice-name">
                <Icon className="h-4 w-4" style={{ color: colors[colorKey] }} />
                {name}
              </span>
              <span className="habit95-choice-desc">{desc}</span>
            </button>
          ))}
        </div>
      </fieldset>
    </>
  )
}

/**
 * components/Home/Habits/habit-form/lift-and-connections.tsx — Lift and Connections.
 *
 * Two components. Each returns its fieldset or nothing. Lift is daily, any
 * type. Connections is daily yes/no. They are not wrapped together.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { NativeSelect } from "@/components/ui/native-select"
import { offsetToClock, parseBedtime, parseWakeTime } from "@/lib/sleep-log"
import { TaskType, type HabitListLink, type HabitLogExemption, type HabitSleepLink, type WeeklyTask } from "@/lib/types"

type SetFlag = Dispatch<SetStateAction<boolean>>
type SetTask = Dispatch<SetStateAction<WeeklyTask>>

export function HabitFormLift({
  task,
  setTask,
  setLogsLocked,
}: {
  task: WeeklyTask
  setTask: SetTask
  setLogsLocked: SetFlag
}) {
  if (task.frequency !== "daily") return null
  return (
        <fieldset id="habit95-sec-lift" tabIndex={-1} className="habit95-group habit95-sec-lift">
          <legend>Lift when a log says</legend>
          <p className="habit95-hint">
            An all-nighter is the morning of the night you stayed up. The evening before is the day that led into it.
            The morning of is that next morning. Clearing every block and saving keeps the preset from coming back.
          </p>
          {(task.logExemptions ?? []).map((block, index) => (
            <div className="habit95-brick" key={`${block.when}-${block.day}-${index}`}>
              <label className="habit95-field">
                Log
                <NativeSelect
                  aria-label="Log that lifts this habit"
                  value={block.when}
                  onChange={(e) => {
                    setLogsLocked(true)
                    const when = e.target.value as HabitLogExemption["when"]
                    setTask((current) => ({
                      ...current,
                      logExemptions: (current.logExemptions ?? []).map((row, i) => (i === index ? { ...row, when } : row)),
                    }))
                  }}
                >
                  <option value="all-nighter">All-nighter</option>
                </NativeSelect>
              </label>
              <label className="habit95-field">
                Lifts
                <NativeSelect
                  aria-label="Which day the log lifts"
                  value={block.day}
                  onChange={(e) => {
                    setLogsLocked(true)
                    const day = e.target.value as HabitLogExemption["day"]
                    setTask((current) => ({
                      ...current,
                      logExemptions: (current.logExemptions ?? []).map((row, i) => (i === index ? { ...row, day } : row)),
                    }))
                  }}
                >
                  <option value="evening-before">the evening before that night</option>
                  <option value="morning-of">the morning of that night</option>
                </NativeSelect>
              </label>
              <button
                type="button"
                className="habit95-btn"
                onClick={() => {
                  setLogsLocked(true)
                  setTask((current) => ({
                    ...current,
                    logExemptions: (current.logExemptions ?? []).filter((_, i) => i !== index),
                  }))
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="habit95-btn"
            style={{ marginTop: 6 }}
            onClick={() => {
              setLogsLocked(true)
              setTask((current) => ({
                ...current,
                logExemptions: [...(current.logExemptions ?? []), { when: "all-nighter", day: "evening-before" }],
              }))
            }}
          >
            Add a block
          </button>
        </fieldset>
  )
}

export function HabitFormConnections({
  task,
  setTask,
  setSleepLocked,
  setListLocked,
}: {
  task: WeeklyTask
  setTask: SetTask
  setSleepLocked: SetFlag
  setListLocked: SetFlag
}) {
  if (!(task.frequency === "daily" && task.type === TaskType.BOOLEAN)) return null
  return (
        <fieldset id="habit95-sec-links" tabIndex={-1} className="habit95-group habit95-sec-links">
          <legend>Connections</legend>
          <p className="habit95-hint">
            A connection checks this habit from something you already logged. You can still tick the cell yourself.
            The to-do block is the template: copy the count and the list name onto another habit to make the same kind of link.
          </p>
          {task.sleepLink && (
            <div className="habit95-brick">
              <label className="habit95-field">
                Clock
                <NativeSelect
                  aria-label="Sleep clock"
                  value={task.sleepLink.end}
                  onChange={(e) => {
                    setSleepLocked(true)
                    const end = e.target.value as HabitSleepLink["end"]
                    setTask((current) => ({
                      ...current,
                      sleepLink: current.sleepLink ? { ...current.sleepLink, end } : { end, beforeMinutes: end === "bed" ? -60 : 540 },
                    }))
                  }}
                >
                  <option value="bed">Bedtime</option>
                  <option value="wake">Wake</option>
                </NativeSelect>
              </label>
              <label className="habit95-field">
                At or before
                <ClockPicker
                  className="habit95-input"
                  aria-label="Clock threshold"
                  value={offsetToClock(task.sleepLink.beforeMinutes)}
                  onChange={(next) => {
                    setSleepLocked(true)
                    const parsed = task.sleepLink?.end === "wake" ? parseWakeTime(next) : parseBedtime(next)
                    if (parsed === undefined || !task.sleepLink) return
                    const end = task.sleepLink.end
                    setTask((current) => ({ ...current, sleepLink: { end, beforeMinutes: parsed } }))
                  }}
                />
              </label>
              <button
                type="button"
                className="habit95-btn"
                onClick={() => {
                  setSleepLocked(true)
                  setTask((current) => ({ ...current, sleepLink: null }))
                }}
              >
                Remove
              </button>
            </div>
          )}
          {task.listLink && (
            <div className="habit95-brick">
              <label className="habit95-field">
                Done
                <input
                  className="habit95-input"
                  type="number"
                  min={1}
                  aria-label="How many done items"
                  value={task.listLink.count}
                  onChange={(e) => {
                    setListLocked(true)
                    const count = Math.max(1, Number.parseInt(e.target.value, 10) || 1)
                    setTask((current) => ({
                      ...current,
                      listLink: { listName: current.listLink?.listName || "to do", count },
                    }))
                  }}
                />
              </label>
              <label className="habit95-field">
                From list
                <input
                  className="habit95-input"
                  aria-label="List name"
                  value={task.listLink.listName}
                  onChange={(e) => {
                    setListLocked(true)
                    const listName = e.target.value
                    setTask((current) => ({
                      ...current,
                      listLink: { listName, count: current.listLink?.count || 1 },
                    }))
                  }}
                />
              </label>
              <span className="habit95-hint">in Next Actions</span>
              <button
                type="button"
                className="habit95-btn"
                onClick={() => {
                  setListLocked(true)
                  setTask((current) => ({ ...current, listLink: null }))
                }}
              >
                Remove
              </button>
            </div>
          )}
          {!task.sleepLink && (
            <button
              type="button"
              className="habit95-btn"
              style={{ marginTop: 6 }}
              onClick={() => {
                setSleepLocked(true)
                setTask((current) => ({ ...current, sleepLink: { end: "bed", beforeMinutes: -60 } }))
              }}
            >
              Add a sleep clock
            </button>
          )}
          {!task.listLink && (
            <button
              type="button"
              className="habit95-btn"
              style={{ marginTop: 6 }}
              onClick={() => {
                setListLocked(true)
                setTask((current) => ({ ...current, listLink: { listName: "to do", count: 1 } satisfies HabitListLink }))
              }}
            >
              Add a to-do list connection
            </button>
          )}
        </fieldset>
  )
}

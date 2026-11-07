/**
 * components/Home/Habits/habit-detail-panels.tsx — The panels of a habit's double-click view
 *
 * `BreakdownPanel` lays the cell's number out by the item it was about ("Dune — 3 pages in 2
 * sessions", then each session's clock time), and says plainly what part of the number no log
 * explains. `EntryPanel` is the small form: how much, which item of the subject type. Both read
 * and write through `lib/habit-contributions.ts` / `lib/module-output-apply.ts`, so a page typed
 * here and a page read in Speed Read are the same kind of row. Read-only except the entry form.
 */
"use client"

import { useMemo, useState } from "react"
import { breakdownForCell, describeGroup } from "@/lib/habit-contributions"
import { connectFeed, habitTakesOutput } from "@/lib/habit-feeds"
import { applyModuleOutput } from "@/lib/module-output-apply"
import { describeAmount, localDayKey, measureDef } from "@/lib/module-output"
import { itemTitle, type TitledRecord } from "@/lib/item-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import type { TaskCompletion, WeeklyTask } from "@/lib/types"

export const ENTRY_MODULE_ID = "habit-entry"

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export function BreakdownPanel({
  task,
  measure,
  date,
  completion,
}: {
  task: WeeklyTask
  measure: string
  date: Date
  completion: TaskCompletion | undefined
}) {
  const items = useTaskStore((s) => s.tasks)
  const day = localDayKey(date.toISOString())
  const cell = typeof completion?.value === "number" ? completion.value : 0
  const view = useMemo(() => breakdownForCell(items, task.id, measure, day, cell), [items, task.id, measure, day, cell])
  const def = measureDef(measure)
  return (
    <section className="habit95-breakdown" aria-label={`${def?.unit[1] ?? measure} by ${def?.subjectType ?? "item"}`}>
      <p className="habit95-hint">
        {describeAmount(measure, cell)} on {day}
      </p>
      {view.groups.length === 0 ? (
        <p className="habit95-hint">Nothing logged by a module yet today. Pages read in Speed Read show up here by book.</p>
      ) : (
        <ul className="habit95-stat-readout">
          {view.groups.map((group) => (
            <li key={group.key} className="habit95-breakdown-row">
              <span>
                <b>{group.title}</b>
                <small className="habit95-breakdown-sessions">
                  {describeGroup(group, measure)}
                  {" · "}
                  {group.sessions.map((s) => `${s.amount} at ${clock(s.at)}`).join(", ")}
                </small>
              </span>
              <span>{group.amount}</span>
            </li>
          ))}
        </ul>
      )}
      {view.rest !== 0 ? (
        <ul className="habit95-stat-readout">
          <li>
            <span>{view.rest > 0 ? "Typed or from another source" : "Lowered by hand"}</span>
            <span>{view.rest}</span>
          </li>
        </ul>
      ) : null}
    </section>
  )
}

export function EntryPanel({ task, measure, subjectType, date }: { task: WeeklyTask; measure: string; subjectType?: string; date: Date }) {
  const items = useTaskStore((s) => s.tasks)
  const [amount, setAmount] = useState("")
  const [subject, setSubject] = useState("")
  const [note, setNote] = useState("")
  const options = useMemo(
    () => (subjectType ? items.filter((t) => t.type === subjectType).map((t) => itemTitle(t as unknown as TitledRecord)) : []),
    [items, subjectType],
  )
  const def = measureDef(measure)
  const n = Number(amount)
  const ready = Number.isFinite(n) && n > 0 && (!subjectType || subject.trim().length > 0)
  const submit = () => {
    if (!ready) return
    // The form is a module too: connect it once, so the same routing rule applies to it.
    const fresh = useHabitsStore.getState().tasks.find((t) => t.id === task.id) ?? task
    if (!habitTakesOutput(fresh, { moduleId: ENTRY_MODULE_ID, measure })) {
      useHabitsStore.getState().updateTask({ ...fresh, moduleFeeds: connectFeed(fresh, ENTRY_MODULE_ID, measure) })
    }
    const now = new Date()
    const same = localDayKey(now.toISOString()) === localDayKey(date.toISOString())
    const at = same ? now : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)
    const done = applyModuleOutput(
      {
        id: `${ENTRY_MODULE_ID}-${task.id}-${at.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
        moduleId: ENTRY_MODULE_ID,
        measure,
        amount: n,
        at: at.toISOString(),
        ...(subjectType ? { subject: { type: subjectType, title: subject.trim() } } : {}),
      },
      { undo: "step" },
    )
    setNote(done.ok ? done.line : done.errors.join("; "))
    if (done.ok) {
      setAmount("")
      setSubject("")
    }
  }
  return (
    <form
      className="habit95-entry"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      aria-label={`Log ${def?.unit[1] ?? measure}`}
    >
      <label className="habit95-entry-field">
        <span>{def ? def.unit[1] : measure}</span>
        <input type="number" min={0} step={def?.whole ? 1 : "any"} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={def?.unit[1] ?? measure} />
      </label>
      {subjectType ? (
        <label className="habit95-entry-field">
          <span>{subjectType}</span>
          <input list={`entry-${task.id}-${subjectType}`} value={subject} onChange={(e) => setSubject(e.target.value)} aria-label={subjectType} />
          <datalist id={`entry-${task.id}-${subjectType}`}>
            {options.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </label>
      ) : null}
      <button type="submit" className="habit95-btn" disabled={!ready}>
        Log
      </button>
      {note ? <p className="habit95-hint" role="status">{note}</p> : null}
    </form>
  )
}

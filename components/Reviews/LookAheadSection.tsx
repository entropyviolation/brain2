/**
 * components/Reviews/LookAheadSection.tsx — Morning and start rituals look ahead
 *
 * Three modes, one per step:
 * - `lists`: bigger to-do lists (this week and month for a morning; the next
 *   period up for a start ritual), most important first, each row with
 *   **Do today** / **Do this week** (moves it onto the ritual's own period).
 * - `due`: every open task due within `dueDays`, soonest first, with a countdown.
 * - `overdue`: every open task past its deadline, with **Do …** and **Missed**.
 * Helpers: `lib/ritual-due.ts`.
 */
"use client"

import { useMemo, useState } from "react"
import { CalendarPlus, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTaskStore } from "@/lib/task-store"
import { itemTitle } from "@/lib/item-utils"
import { scheduleFieldsForPeriod } from "@/lib/scheduling"
import { markMissedOpportunity } from "@/lib/services/completion-service"
import { countdown, dueWithin, importanceOf, overdue, periodList } from "@/lib/ritual-due"
import type { Task } from "@/lib/types"

export type LookAheadTarget = { period: "day" | "week" | "month" | "year"; key: string; label: string }
export type LookAheadList = { title: string; period: "week" | "month"; key: string }

function Row({
  task,
  now,
  target,
  pulled,
  onPull,
  onMissed,
}: {
  task: Task
  now: Date
  target: LookAheadTarget
  pulled: boolean
  onPull: () => void
  onMissed?: () => void
}) {
  const imp = importanceOf(task)
  return (
    <li className="la-row" data-pulled={pulled ? "true" : undefined}>
      <span className="la-title">{itemTitle(task)}</span>
      {imp > 0 ? <span className="la-imp" title="Importance">{imp}</span> : null}
      {task.deadline ? (
        <span className="la-count" data-late={new Date(task.deadline) < now ? "true" : undefined}>
          {countdown(task.deadline, now)}
        </span>
      ) : null}
      {pulled ? (
        <span className="la-done">On {target.label.toLowerCase()}</span>
      ) : (
        <span className="la-keys">
          <Button size="sm" variant="outline" className="h-7" onClick={onPull}>
            <CalendarPlus className="h-3.5 w-3.5 mr-1" />
            Do {target.label.toLowerCase()}
          </Button>
          {onMissed ? (
            <Button size="sm" variant="outline" className="h-7" onClick={onMissed}>
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Missed
            </Button>
          ) : null}
        </span>
      )}
    </li>
  )
}

export function LookAheadSection({
  mode,
  now,
  target,
  lists = [],
  dueDays = 7,
}: {
  mode: "lists" | "due" | "overdue"
  now: Date
  target: LookAheadTarget
  lists?: LookAheadList[]
  dueDays?: number
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const [pulled, setPulled] = useState<string[]>([])
  const [missed, setMissed] = useState<string[]>([])

  const pull = (task: Task) => {
    updateTask({ ...task, ...scheduleFieldsForPeriod(target.period, target.key) })
    setPulled((p) => [...p, task.id])
  }
  const miss = (task: Task) => {
    markMissedOpportunity(task.id)
    setMissed((m) => [...m, task.id])
  }

  // Rows stay put after Do today so the list does not jump under the pointer.
  const [frozen] = useState(() => new Map<string, string[]>())
  const freeze = (key: string, rows: Task[]) => {
    if (!frozen.has(key)) frozen.set(key, rows.map((t) => t.id))
    const ids = frozen.get(key)!
    return ids.map((id) => tasks.find((t) => t.id === id)).filter((t): t is Task => !!t && !missed.includes(t.id))
  }

  const sections = useMemo(() => {
    if (mode === "lists") {
      // The week lens already includes month work; each task shows once, in the first list it fits.
      const seen = new Set<string>()
      return lists.map((l) => {
        const rows = periodList(tasks, l.period, l.key, now).filter((t) => !seen.has(t.id))
        rows.forEach((t) => seen.add(t.id))
        return { title: l.title, rows }
      })
    }
    if (mode === "due") return [{ title: `Due within ${dueDays} days`, rows: dueWithin(tasks, now, dueDays) }]
    return [{ title: "Overdue", rows: overdue(tasks, now) }]
    // Rows are frozen on first render; later store changes only update each row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, now, dueDays])

  const lede =
    mode === "lists"
      ? `The bigger lists, most important first. Bring what matters onto ${target.label.toLowerCase()}.`
      : mode === "due"
        ? "Deadlines coming up. Anything that has to start now?"
        : "Past their deadline and still open. Do it, or let it go as missed."

  return (
    <section className="space-y-3">
      <p className="mr-lede">{lede}</p>
      {sections.map((sec) => {
        const rows = freeze(`${mode}:${sec.title}`, sec.rows)
        return (
          <div key={sec.title} className="space-y-1.5">
            <span className="mr-carry-label">
              {sec.title} ({rows.length})
            </span>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {mode === "overdue" ? "Nothing overdue." : mode === "due" ? "Nothing due soon." : "Nothing open here."}
              </p>
            ) : (
              <ul className="la-list">
                {rows.map((task) => (
                  <Row
                    key={task.id}
                    task={task}
                    now={now}
                    target={target}
                    pulled={pulled.includes(task.id)}
                    onPull={() => pull(task)}
                    onMissed={mode === "overdue" ? () => miss(task) : undefined}
                  />
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </section>
  )
}

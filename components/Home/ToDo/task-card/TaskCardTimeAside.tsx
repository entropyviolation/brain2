/**
 * components/Home/ToDo/task-card/TaskCardTimeAside.tsx — Time in the task card's side bar
 *
 * A short account of the same minutes as the Spent ledger: the total, the
 * minutes indicated only here, and each direct part. The block list stays
 * folded until it is opened, so the bar does not grow with every sitting.
 * Item detail's Time tab is a different editor and is not drawn here.
 *
 * One selected step: that step. Nothing selected on a sub-card: the sub-card
 * root. Nothing selected on the whole task: the task.
 *
 * _Last mapped: 2026-10-24_
 */
"use client"

import { useMemo, useState } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { formatStatMinutes, useTaskCardTimeUnit } from "../TaskCardStats"
import { placeSteps } from "@/lib/next-step"
import { stepActualAccount, taskActualAccount, taskActualSegments } from "@/lib/tracked-time"
import { flattenSteps } from "@/lib/todo-steps"
import type { Task } from "@/lib/types"
import { SpentBlocks } from "./SpentBlocks"

export function TaskCardTimeAside({
  task,
  focusStepId,
  onWrite,
}: {
  task: Task
  /** A step of this task. Omitted, the ledger is the whole task. */
  focusStepId?: string
  onWrite: (patch: Partial<Task>) => void
}) {
  const unit = useTaskCardTimeUnit()
  const dur = (n: number) => formatStatMinutes(n, unit)
  const entries = useTimeTrackingStore((s) => s.entries)
  const [open, setOpen] = useState(false)
  const focus = focusStepId ? flattenSteps(task.subtasks).find((step) => step.id === focusStepId) : undefined
  const names = useMemo(() => {
    const map = new Map<string, string>()
    for (const placed of placeSteps(task.subtasks)) {
      map.set(placed.step.id, [...placed.path.map((step) => step.description), placed.step.description].join(" › "))
    }
    return map
  }, [task.subtasks])
  const account = focusStepId ? stepActualAccount(task, focusStepId, entries) : taskActualAccount(task, entries)
  const stepIds = focus ? new Set(flattenSteps([focus]).map((step) => step.id)) : undefined
  const count = useMemo(() => {
    const rows = taskActualSegments(task, entries)
    return (stepIds ? rows.filter((row) => !!row.stepId && stepIds.has(row.stepId)) : rows).length
  }, [task, entries, stepIds])

  if (!account) return null
  return (
    <section className="tcs-time tcs-control-card" aria-label="Time">
      <h3>Time</h3>
      <p className="ipt-total">
        <strong>{dur(account.total)}</strong> {focus ? "on this step" : "tracked"}
      </p>
      {account.unlabeled > 0 || account.children.length > 0 ? (
        <ul className="ipt-actuals" aria-label="Where the actual minutes sit">
          {account.unlabeled > 0 ? (
            <li>
              {dur(account.unlabeled)} {focus ? "on this step only" : "on this task only"}
            </li>
          ) : null}
          {account.children.map((child) => (
            <li key={child.id}>
              {dur(child.total)} on {names.get(child.id) ?? "a part"}
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="task-card-key" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? "Hide the blocks" : `Show the blocks${count ? ` (${count})` : ""}`}
      </button>
      {open ? (
        <SpentBlocks
          scope={{
            taskId: task.id,
            stepIds,
            names,
            onPatch: onWrite,
          }}
        />
      ) : null}
    </section>
  )
}

/**
 * components/Home/Tracking/clock-task-panel.tsx — The task on the live pen clock
 *
 * One key on the Tracking pen strip and the focus bar. The shell now row
 * uses it only while the clock has no task yet. It puts a task on the clock
 * already running, shows which step is current, and can open that task or
 * step, add a step, finish a step, or finish the task and stop. Finishing
 * the task opens the completion reflection. The stop key does not: it ends
 * the session and opens the optional end-of-session reflection. The painted
 * block stays one block.
 */
"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { useTaskStore } from "@/lib/task-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { openItemDetailPopup } from "@/lib/points-ledger-nav"
import { ensureStepItem } from "@/lib/step-items"
import { isOperation } from "@/lib/operations"
import { findPlacedStep, placeSteps } from "@/lib/next-step"
import { activeNowObjectives } from "@/lib/now-objective"
import { tasksLinkedToPen } from "@/lib/task-clock"
import {
  addClockStep,
  assignTaskOnClock,
  completeClockStep,
  createTaskOnClock,
  finishClockTask,
  setClockStep,
} from "@/lib/task-clock"
import { useUnfinishedStop } from "@/components/Home/Tracking/save-unfinished-dialog"

export function ClockTaskButton() {
  const session = usePenColorSessionStore((s) => s.session)
  const tasks = useTaskStore((s) => s.tasks)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [stepName, setStepName] = useState("")
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const task = session?.taskId ? tasks.find((row) => row.id === session.taskId) : undefined
  const step = task && session?.stepId ? findPlacedStep(task.subtasks, session.stepId)?.step : undefined
  const unfinished = useUnfinishedStop(activeNowObjectives(session?.nowObjectives).length, (park) => {
    // Completing the task opens the completion reflection. Stop uses the session one.
    finishClockTask(park)
    setOpen(false)
  })

  const choices = useMemo(() => {
    if (!session) return []
    const openTasks = tasks.filter(
      (row) => !row.completed && !row.stepOf && !isOperation(row),
    )
    const linked = new Set(tasksLinkedToPen(openTasks, session.penId).map((row) => row.id))
    const ordered = [...openTasks.filter((row) => linked.has(row.id)), ...openTasks.filter((row) => !linked.has(row.id))]
    const needle = query.trim().toLowerCase()
    const matched = needle
      ? ordered.filter((row) => itemTitleOrUntitled(row).toLowerCase().includes(needle))
      : ordered.filter((row) => linked.has(row.id))
    return matched.slice(0, 8)
  }, [tasks, session, query])

  const steps = task ? placeSteps(task.subtasks) : []
  const exact = query.trim()
    ? tasks.some((row) => itemTitleOrUntitled(row).toLowerCase() === query.trim().toLowerCase())
    : true

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setBox(null)
      return
    }
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(360, Math.max(280, window.innerWidth - 16))
      let left = rect.left
      if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8)
      const below = rect.bottom + 6
      const maxTop = window.innerHeight - 440
      setBox({
        top: below > maxTop ? Math.max(8, rect.top - 420) : below,
        left,
        width,
      })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      if (target instanceof Element && target.closest("[data-testid=save-unfinished-dialog]")) return
      setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onPointer)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onPointer)
    }
  }, [open])

  if (!session) return null

  const taskLabel = task ? itemTitleOrUntitled(task) : ""
  const onStep = step ? step.description : "the whole task"

  const panel =
    open && box && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            className="trk-now-obj-pop trk-clock-task-pop b2-now"
            role="dialog"
            aria-label="Task on this clock"
            data-testid="clock-task-pop"
            style={{ top: box.top, left: box.left, width: box.width }}
          >
            <div className="trk-now-obj-pop-head">Task on this clock</div>
            {task ? (
              <div className="trk-clock-task-current">
                <button type="button" className="todo-cap" onClick={() => openItemDetailPopup(task.id)}>
                  Open {taskLabel}
                </button>
                <p className="trk-clock-task-on">
                  On <b>{onStep}</b>
                </p>
                {step ? (
                  <div className="trk-clock-task-actions">
                    <button
                      type="button"
                      className="todo-cap"
                      onClick={() => {
                        const id = ensureStepItem(task.id, step.id)
                        if (id) openItemDetailPopup(id)
                      }}
                    >
                      Open this step
                    </button>
                    {!step.completed ? (
                      <button type="button" className="todo-cap" onClick={() => completeClockStep(step.id)}>
                        Done with this step
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="trk-clock-task-on">No task on this clock yet. The minutes already running will count toward the one you pick.</p>
            )}

            <label className="trk-clock-task-find">
              <span>Task</span>
              <input
                className="trk-now-obj-add-field"
                aria-label="Find or create a task"
                value={query}
                placeholder="Find a task, or name a new one"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <ul className="trk-clock-task-choices" aria-label="Tasks">
              {choices.length === 0 ? (
                <li className="trk-pen-now-empty">
                  {query.trim() ? "No matching task." : "Type a name to find a task, or to create one."}
                </li>
              ) : null}
              {choices.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="todo-cap trk-clock-task-choice"
                    aria-current={row.id === task?.id ? "true" : undefined}
                    onClick={() => {
                      assignTaskOnClock(row.id)
                      setQuery("")
                    }}
                  >
                    {itemTitleOrUntitled(row)}
                  </button>
                </li>
              ))}
            </ul>
            {query.trim() && !exact ? (
              <button
                type="button"
                className="todo-cap is-primary"
                onClick={() => {
                  createTaskOnClock(query)
                  setQuery("")
                }}
              >
                Create “{query.trim()}”
              </button>
            ) : null}

            {task ? (
              <div className="trk-clock-task-steps">
                <div className="trk-now-obj-pop-head">Step</div>
                <button
                  type="button"
                  className={`todo-cap trk-clock-task-choice${step ? "" : " is-on"}`}
                  aria-current={step ? undefined : "step"}
                  onClick={() => setClockStep(undefined)}
                >
                  Whole task
                </button>
                <ul aria-label="Steps">
                  {steps.map((placed) => {
                    const current = placed.step.id === step?.id
                    return (
                      <li key={placed.step.id}>
                        <button
                          type="button"
                          className={`todo-cap trk-clock-task-choice${current ? " is-on" : ""}`}
                          aria-current={current ? "step" : undefined}
                          onClick={() => setClockStep(placed.step.id)}
                        >
                          {[...placed.path.map((item) => item.description), placed.step.description].join(" › ")}
                          {placed.step.completed ? " ✓" : ""}
                          {current ? " · now" : ""}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <div className="trk-clock-task-actions">
                  <input
                    className="trk-now-obj-add-field"
                    aria-label="New step"
                    value={stepName}
                    placeholder="New step"
                    onChange={(event) => setStepName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return
                      event.preventDefault()
                      if (!stepName.trim()) return
                      addClockStep(stepName)
                      setStepName("")
                    }}
                  />
                  <button
                    type="button"
                    className="todo-cap"
                    disabled={!stepName.trim()}
                    onClick={() => {
                      addClockStep(stepName)
                      setStepName("")
                    }}
                  >
                    Add step
                  </button>
                </div>
                <button type="button" className="todo-cap is-primary" onClick={unfinished.request}>
                  Done — complete task and stop
                </button>
              </div>
            ) : null}
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`todo-cap trk-now-obj-trigger trk-clock-task-trigger${open ? " open" : ""}${task ? " has-active" : ""}`}
        aria-expanded={open}
        aria-label={task ? `Task on this clock, ${taskLabel}` : "Put a task on this clock"}
        data-testid="clock-task-trigger"
        onClick={() => setOpen((value) => !value)}
      >
        Task
      </button>
      {panel}
      {unfinished.dialog}
    </>
  )
}

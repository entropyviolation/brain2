/**
 * components/Scheduler/SchedulerTaskItem.tsx — Draggable scheduler task row
 *
 * A single task used across every Scheduler tab. Orb first (Lists contract),
 * then bureaucratic title + counts. Drag/select/unschedule stay delegated.
 * Checkbox sits outside other controls; × is a sibling button (not nested), so
 * there is no button-inside-button.
 *
 * Period cells open item detail on click. The left-hand period lists open it
 * on double-click (`openOn`), so a drag gesture is not a second click that
 * dismisses the popup. × takes the task off this list. It does not delete it.
 */
"use client"

import { useRef, type ReactNode } from "react"
import type React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { iconFor } from "@/components/Icons"
import type { Task } from "@/lib/types"
import { itemTitle } from "@/lib/item-utils"

/** Grey keycap ×. Hover turns the plastic brick. The mark is a path so it sits in the middle of the face. */
export function SchedulerKeycapX({
  title,
  onClick,
}: {
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-no95=""
      className="sch-task-x"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden focusable="false">
        <path d="M3.15 3.15 L8.85 8.85 M8.85 3.15 L3.15 8.85" />
      </svg>
    </button>
  )
}

export function SchedulerTaskItem({
  task,
  color,
  selected = false,
  showCheckbox = false,
  showUnschedule = false,
  openOn = "click",
  onOpen,
  onToggleSelect,
  onUnschedule,
  onDragStart,
}: {
  task: Task
  color: string
  selected?: boolean
  showCheckbox?: boolean
  showUnschedule?: boolean
  /** Cells open on click. Period lists open on double-click. */
  openOn?: "click" | "double"
  onOpen?: () => void
  onToggleSelect?: (taskId: string) => void
  onUnschedule?: (taskId: string) => void
  onDragStart: (e: React.DragEvent, taskId: string) => void
}) {
  const lastPointerUp = useRef(0)
  const stop = (node: ReactNode) => (
    <div
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {node}
    </div>
  )

  return (
    <div
      className={`sch-task task-item${selected ? " is-selected" : ""}`}
      draggable
      onMouseUp={() => {
        lastPointerUp.current = Date.now()
      }}
      onDragStart={(e) => {
        // A second press that Chrome treats as a drag is still a double-click.
        if (openOn === "double" && Date.now() - lastPointerUp.current < 450) {
          e.preventDefault()
          onOpen?.()
          return
        }
        onDragStart(e, task.id)
      }}
      onClick={(e) => {
        if (openOn !== "click") return
        e.stopPropagation()
        onOpen?.()
      }}
      onDoubleClick={(e) => {
        if (openOn !== "double") return
        e.stopPropagation()
        onOpen?.()
      }}
      style={{ boxShadow: undefined, borderLeft: `3px solid ${color}` }}
    >
      {showCheckbox &&
        stop(
          <Checkbox
            data-no95=""
            className="sch-task-check"
            checked={selected}
            onCheckedChange={() => onToggleSelect?.(task.id)}
          />,
        )}
      <img src={iconFor(task.id, task.icon)} alt="" className="sch-task-orb" draggable={false} />
      <div className="sch-task-main">
        <p className="sch-task-title">{itemTitle(task)}</p>
        <div className="sch-task-meta">
          <span>{task.estimatedDuration ?? 0}m</span>
          <span>u{task.urgency ?? 0}</span>
          <span>i{task.importance ?? 0}</span>
        </div>
      </div>
      {showUnschedule && (
        <SchedulerKeycapX title="Unschedule" onClick={() => onUnschedule?.(task.id)} />
      )}
    </div>
  )
}

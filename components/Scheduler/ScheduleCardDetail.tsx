/**
 * components/Scheduler/ScheduleCardDetail.tsx — Schedule Card Detail View
 *
 * One period card, opened across the board to the right of the broader list.
 * Current cards list work at this grain, work assigned to a finer period, and
 * Undone history still open to triage. A past card is that Undone queue:
 * Push to the current period, Mark done, Dismiss, Missed, or Unschedule.
 * Rows already moved forward, pushed, dismissed, or missed stay off the list
 * until a toggle on that card shows them. The placement stays in the database.
 */
"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import type { Task } from "@/lib/types"
import { itemTitle } from "@/lib/item-utils"
import type { SchedulerTaskItemOpts } from "./PeriodFunnelTab"
import { SchedulerKeycapX } from "./SchedulerTaskItem"
import type { CardDetailRows } from "./schedule-card-detail"

export function ScheduleCardDetail({
  title,
  subtitle,
  rows,
  onClose,
  onDrop,
  renderTaskItem,
  onEstimate,
  onPush,
  onDismiss,
  onMiss,
  onDone,
  onUnschedule,
  grain,
  listName,
  onOpenList,
}: {
  title: string
  subtitle?: string
  rows: CardDetailRows
  onClose: () => void
  onDrop: (e: React.DragEvent) => void
  renderTaskItem: (task: Task, opts?: SchedulerTaskItemOpts) => React.ReactNode
  /** Writes `estimatedDuration`. The store logs it on `estimateLog` at this moment. */
  onEstimate?: (taskId: string, minutes: number) => void
  onPush?: (taskId: string) => void
  onDismiss?: (taskId: string) => void
  onMiss?: (taskId: string) => void
  onDone?: (taskId: string) => void
  onUnschedule?: (taskId: string) => void
  /** Grain of a past card, used for the Push label. */
  grain?: string
  /** Period To do list in Lists, such as `To do 8/31-9/6`. */
  listName?: string
  onOpenList?: () => void
}) {
  const [showHidden, setShowHidden] = useState({ moved: false, pushed: false, dismissed: false, missed: false })
  useEffect(() => {
    setShowHidden({ moved: false, pushed: false, dismissed: false, missed: false })
  }, [title])
  const hiddenRows = [
    ...(showHidden.moved ? rows.archive.moved.map((task) => ({ task, tag: "Moved" })) : []),
    ...(showHidden.pushed ? rows.archive.pushed.map((task) => ({ task, tag: "Pushed" })) : []),
    ...(showHidden.dismissed ? rows.archive.dismissed.map((task) => ({ task, tag: "Dismissed" })) : []),
    ...(showHidden.missed ? rows.archive.missed.map((task) => ({ task, tag: "Missed" })) : []),
  ]
  const empty = rows.here.length + rows.finer.length + rows.undone.length + hiddenRows.length === 0
  return (
    <section
      className="sch-card-detail"
      aria-label={`Schedule card ${title}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <header className="sch-card-detail-head">
        <div>
          <h2 className="sch-card-detail-title">{title}</h2>
          {subtitle && <p className="sch-hint">{subtitle}</p>}
        </div>
        <div className="sch-card-detail-actions">
          {listName && onOpenList && (
            <button
              type="button"
              className="sch-btn"
              title={`Open ${listName} in Lists`}
              aria-label={`Open ${listName} in Lists`}
              onClick={onOpenList}
            >
              Open list
            </button>
          )}
          <SchedulerKeycapX title="Close schedule card" onClick={onClose} />
        </div>
      </header>
      <div className="sch-card-detail-body">
        {empty && !rows.past && <p className="sch-vacant">Nothing on this card.</p>}
        {rows.past ? (
          <section className="sch-card-section">
            <h3 className="sch-card-section-title">
              Undone
              <span>{rows.undone.length + hiddenRows.length}</span>
            </h3>
            <p className="sch-hint">
              Still needs a decision here. A task already placed on a current or future day, week, or month stays in this period&apos;s record and stays off the list. Push, Mark done, Dismiss, Missed, and Unschedule clear a row. The placement stays.
            </p>
            <div className="sch-undone-toggles" role="group" aria-label="Hidden undone rows">
              <UndoneToggle label="Show moved forward" checked={showHidden.moved} onChange={(moved) => setShowHidden((prev) => ({ ...prev, moved }))} />
              <UndoneToggle label="Show pushed" checked={showHidden.pushed} onChange={(pushed) => setShowHidden((prev) => ({ ...prev, pushed }))} />
              <UndoneToggle label="Show dismissed" checked={showHidden.dismissed} onChange={(dismissed) => setShowHidden((prev) => ({ ...prev, dismissed }))} />
              <UndoneToggle label="Show missed opportunities" checked={showHidden.missed} onChange={(missed) => setShowHidden((prev) => ({ ...prev, missed }))} />
            </div>
            {rows.undone.length === 0 && hiddenRows.length === 0 && (
              <p className="sch-vacant">Nothing left to clear in this period.</p>
            )}
            {rows.undone.map((task) => (
              <div key={task.id} className="sch-card-detail-row">
                {renderTaskItem(task)}
                <EstimateField task={task} onCommit={onEstimate} />
                <div className="sch-card-actions">
                  <button type="button" className="sch-btn" onClick={() => onPush?.(task.id)}>
                    {grain ? `Push to this ${grain}` : "Push"}
                  </button>
                  <button type="button" className="sch-btn" onClick={() => onDone?.(task.id)}>
                    Mark done
                  </button>
                  <button type="button" className="sch-btn" onClick={() => onDismiss?.(task.id)}>
                    Dismiss
                  </button>
                  <button type="button" className="sch-btn" title="Hide this period as a missed opportunity. The record stays." onClick={() => onMiss?.(task.id)}>
                    Missed
                  </button>
                  <button type="button" className="sch-btn" onClick={() => onUnschedule?.(task.id)}>
                    Unschedule
                  </button>
                </div>
              </div>
            ))}
            {hiddenRows.map(({ task, tag }) => (
              <div key={`${tag}-${task.id}`} className="sch-card-detail-row">
                <span className="sch-undone-tag">{tag}</span>
                {renderTaskItem(task)}
                <EstimateField task={task} onCommit={onEstimate} />
              </div>
            ))}
          </section>
        ) : (
          <>
            <DetailSection title="At this period" hint="Assigned to this period, not to a finer one. The minutes field is your estimate. Enter saves it and moves to the next task.">
              {rows.here.map((task) => (
                <div key={task.id} className="sch-card-detail-row">
                  {renderTaskItem(task, { showUnschedule: true })}
                  <EstimateField task={task} onCommit={onEstimate} />
                </div>
              ))}
            </DetailSection>
            <DetailSection title="Finer period" hint="Inside this span, assigned to a more specific period.">
              {rows.finer.map((task) => (
                <div key={task.id} className="sch-card-detail-row">
                  {renderTaskItem(task, { showUnschedule: true })}
                  <EstimateField task={task} onCommit={onEstimate} />
                </div>
              ))}
            </DetailSection>
            <DetailSection title="Undone" hint="A past period inside this span, still open. Pushed, dismissed, missed, and already-moved rows leave this list and stay in the record.">
              {rows.undone.map((task) => (
                <div key={task.id} className="sch-card-detail-row">
                  {renderTaskItem(task)}
                  <EstimateField task={task} onCommit={onEstimate} />
                </div>
              ))}
            </DetailSection>
          </>
        )}
      </div>
    </section>
  )
}

/** Always-visible minutes. Enter saves and focuses the next field on this card. */
function EstimateField({
  task,
  onCommit,
}: {
  task: Task
  onCommit?: (taskId: string, minutes: number) => void
}) {
  const shown = task.estimatedDuration && task.estimatedDuration > 0 ? String(task.estimatedDuration) : ""
  const [value, setValue] = useState(shown)
  const skipBlur = useRef(false)
  useEffect(() => {
    setValue(shown)
  }, [task.id, shown])

  const commit = (raw: string) => {
    const text = raw.trim()
    if (text === "") return
    const minutes = Number(text)
    if (!Number.isFinite(minutes) || minutes < 0) return
    onCommit?.(task.id, Math.round(minutes))
  }

  return (
    <label className="sch-est">
      <input
        data-sch-est=""
        inputMode="numeric"
        aria-label={`Estimate for ${itemTitle(task)}`}
        value={value}
        onChange={(event) => setValue(event.target.value.replace(/[^\d]/g, ""))}
        onFocus={(event) => event.currentTarget.select()}
        onClick={(event) => event.stopPropagation()}
        onBlur={() => {
          if (skipBlur.current) {
            skipBlur.current = false
            return
          }
          commit(value)
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault()
            skipBlur.current = true
            setValue(shown)
            event.currentTarget.blur()
            return
          }
          if (event.key !== "Enter") return
          event.preventDefault()
          commit(value)
          const fields = [...document.querySelectorAll<HTMLInputElement>("[data-sch-est]")]
          const next = fields[fields.indexOf(event.currentTarget) + 1]
          if (next) {
            next.focus()
            next.select()
          }
        }}
      />
      <span>m</span>
    </label>
  )
}

function UndoneToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="sch-undone-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  )
}

function DetailSection({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  const list = Array.isArray(children) ? children : [children]
  const count = list.filter(Boolean).length
  if (count === 0) return null
  return (
    <section className="sch-card-section">
      <h3 className="sch-card-section-title">
        {title}
        <span>{count}</span>
      </h3>
      <p className="sch-hint">{hint}</p>
      {children}
    </section>
  )
}

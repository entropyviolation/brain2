/**
 * components/Scheduler/ScheduleCardDetail.tsx — Schedule Card Detail View
 *
 * One period card, opened across the board to the right of the broader list.
 * Current cards list work at this grain, work assigned to a finer period, and
 * Undone history still open to triage. A past card is that Undone queue:
 * Push to the current period, Mark done, Dismiss, or Unschedule.
 * The placement stays in the database.
 */
"use client"

import type React from "react"
import type { Task } from "@/lib/types"
import type { SchedulerTaskItemOpts } from "./PeriodFunnelTab"
import type { CardDetailRows } from "./schedule-card-detail"

export function ScheduleCardDetail({
  title,
  subtitle,
  rows,
  onClose,
  onDrop,
  renderTaskItem,
  onPush,
  onDismiss,
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
  onPush?: (taskId: string) => void
  onDismiss?: (taskId: string) => void
  onDone?: (taskId: string) => void
  onUnschedule?: (taskId: string) => void
  /** Grain of a past card, used for the Push label. */
  grain?: string
  /** Period To do list in Lists, such as `To do 8/31-9/6`. */
  listName?: string
  onOpenList?: () => void
}) {
  const empty = rows.here.length + rows.finer.length + rows.undone.length === 0
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
          <button type="button" className="sch-btn" aria-label="Close schedule card" onClick={onClose}>
            ×
          </button>
        </div>
      </header>
      <div className="sch-card-detail-body">
        {empty && <p className="sch-vacant">Nothing on this card.</p>}
        {rows.past ? (
          <DetailSection
            title="Undone"
            hint="Scheduled for this period and not finished. Push assigns the current period of this size. Mark done finishes it in this period and is the one action that takes it off the Undone list. Dismiss and Unschedule leave that list and clear this queue."
          >
            {rows.undone.map((task) => (
              <div key={task.id} className="sch-card-detail-row">
                {renderTaskItem(task)}
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
                  <button type="button" className="sch-btn" onClick={() => onUnschedule?.(task.id)}>
                    Unschedule
                  </button>
                </div>
              </div>
            ))}
          </DetailSection>
        ) : (
          <>
            <DetailSection title="At this period" hint="Assigned to this period, not to a finer one.">
              {rows.here.map((task) => (
                <div key={task.id}>{renderTaskItem(task, { showUnschedule: true })}</div>
              ))}
            </DetailSection>
            <DetailSection title="Finer period" hint="Inside this span, assigned to a more specific period.">
              {rows.finer.map((task) => (
                <div key={task.id}>{renderTaskItem(task, { showUnschedule: true })}</div>
              ))}
            </DetailSection>
            <DetailSection title="Undone" hint="A past period inside this span, still open. Pushed and dismissed rows leave this list and stay in the record.">
              {rows.undone.map((task) => (
                <div key={task.id}>{renderTaskItem(task)}</div>
              ))}
            </DetailSection>
          </>
        )}
      </div>
    </section>
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

/**
 * components/Home/ToDo/desk/todo-desk-status.tsx — Status bar under the window
 *
 * Period view, open count, and undone on a past day, week, or month.
 */
import { getPeriodNavLabel } from "../todo-utils"
import type { TodoDesk } from "./use-todo-desk"

export function TodoDeskStatus({
  desk,
  periodLabel,
  seasonLabel,
  activeRangeName,
  openCount,
  viewingPast,
  undoneCount,
}: {
  desk: TodoDesk
  periodLabel: string
  seasonLabel: string
  activeRangeName: string | undefined
  openCount: number
  viewingPast: boolean
  undoneCount: number
}) {
  return (
    <div
      className="todo-status"
      data-ui-name="Status bar"
      data-ui-help="Which period is open, and how many tasks are still open."
      data-ui-docs="components/Home/ToDo/README.md"
      data-ui-docs-anchor="instrument-layout"
    >
      <span>
        {desk.activeTodoTab === "other"
          ? `Other view · ${activeRangeName ? `before ${activeRangeName}` : "no range yet"}`
          : desk.periodTab === "quarter" ? `${periodLabel} · ${seasonLabel}` : `${periodLabel} · ${getPeriodNavLabel(desk.periodTab, desk.focusedDate)}`}
      </span>
      <span className="todo-status-count">
        {openCount} open{viewingPast ? ` · ${undoneCount} undone` : ""}
      </span>
    </div>
  )
}

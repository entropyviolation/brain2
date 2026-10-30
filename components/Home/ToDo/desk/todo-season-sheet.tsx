/**
 * components/Home/ToDo/desk/todo-season-sheet.tsx — Season list
 *
 * Required and Assigned for the quarter. Flex rows, not the period grid.
 * Help text here is the season's own copy.
 */
import { countInProgress } from "../todo-utils"
import { quarterLabel, seasonOfDate, seasonSlug } from "@/lib/seasons"
import {
  daysLeftLabel,
  formatComfortRatio,
  formatMinutesAsHours,
  formatWorkingHours,
} from "@/lib/todo-commitment"
import { TodoLoadPanel } from "../TodoLoadPanel"
import { TodoAssignedSearch } from "./todo-assigned-search"
import { renderSeasonRow } from "./todo-season-row"
import type { TodoDesk } from "./use-todo-desk"

export function TodoSeasonSheet({ desk }: { desk: TodoDesk }) {
  const season = desk.season
  if (!season) return null
  return (
    <div
      className="todo-sheet"
      data-season={seasonSlug(seasonOfDate(desk.focusedDate))}
      data-ui-name="Season list"
      data-ui-help="Open tasks already scheduled on a day, week, or month in this quarter."
      data-ui-docs="components/Home/ToDo/README.md"
      data-ui-docs-anchor="data"
    >
      <p className="todo-hint">Tasks scheduled on a day, week, or month in {quarterLabel(season.seasonKey)}.</p>
      {desk.loadOpen && (
      <TodoLoadPanel
        daysLeft={daysLeftLabel("quarter", desk.focusedDate)}
        estimate={formatMinutesAsHours(season.seasonEstimate.minutes)}
        estimateMinutes={season.seasonEstimate.minutes}
        unestimated={season.seasonEstimate.unestimated}
        included={season.seasonEstimate.included}
        scope={desk.estimateScope}
        onScopeChange={desk.setEstimateScope}
        hoursLeft={formatWorkingHours(season.seasonClockHours)}
        workingHours={formatWorkingHours(season.seasonHours)}
        workingHoursValue={season.seasonHours}
        comfortRatioText={formatComfortRatio(season.seasonRatio)}
        comfortRatioValue={season.seasonRatio}
        band={season.seasonBand}
        inProgress={countInProgress(desk.tasks)}
        wipLimit={desk.wipLimit}
      />
      )}
      <div className="todo-ledger">
        {season.seasonRequired.length > 0 && (
        <section
          className="todo-band is-required"
          role="region"
          aria-label="Required"
          data-ui-name="Required"
          data-ui-help="Marked required for this season."
          data-ui-docs="components/Home/ToDo/README.md"
          data-ui-docs-anchor="required-prioritized-assigned"
        >
          <h4 className="todo-list-title is-required">
            Required <span className="todo-list-count">{season.seasonRequired.length}</span>
          </h4>
          <ul className="todo-season-list">
            {season.seasonRequired.map((task) => renderSeasonRow(task, desk, season.seasonKey))}
          </ul>
        </section>
        )}
        <section
          className="todo-band is-assigned"
          role="region"
          aria-label="Assigned"
          data-ui-name="Assigned"
          data-ui-help="Everything else scheduled in this season. Prioritized rows lead."
          data-ui-docs="components/Home/ToDo/README.md"
          data-ui-docs-anchor="required-prioritized-assigned"
        >
          <div className="todo-assigned-bar">
            <h4 className="todo-list-title">
              Assigned <span className="todo-list-count">{season.seasonAssigned.length}</span>
            </h4>
            <TodoAssignedSearch
              value={desk.assignedQuery}
              onChange={(event) => desk.setAssignedQuery(event.target.value)}
            />
          </div>
          {season.seasonAssignedVisible.length === 0 ? (
            <p className="todo-empty-inline">
              {desk.assignedQuery.trim()
                ? "Nothing matches."
                : season.seasonRequired.length > 0
                  ? "Nothing else assigned."
                  : "Nothing scheduled in this season yet. Add a task to place it on this month, or the season's first month."}
            </p>
          ) : (
            <ul className="todo-season-list">
              {season.seasonAssignedVisible.map((task) => renderSeasonRow(task, desk, season.seasonKey))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

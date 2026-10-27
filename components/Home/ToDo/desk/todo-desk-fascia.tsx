/**
 * components/Home/ToDo/desk/todo-desk-fascia.tsx — Screen, keys, and Show tray
 *
 * Season ‹ › lives here. Day, week, and month use `TodoPeriodNav`. The formula
 * panel stays outside this element, between the fascia and the stage.
 */
import { orbFor } from "@/components/Icons"
import { shiftQuarter } from "@/lib/seasons"
import { openPeriodTodoList, periodTodoListName } from "@/lib/scheduled-lists-sync"
import { todoPeriodValue } from "../todo-utils"
import { DEFAULT_TODO_SORT_ORDER } from "../todo-utils"
import { AddTodoDialog } from "../AddTodoDialog"
import { TodoPeriodNav } from "../TodoPeriodNav"
import { TodoFilters, TodoSortKeys } from "../todo-filters"
import { TodoSettingsDialog } from "../TodoSettingsDialog"
import { TodoRangeNav } from "../TodoRangeSheet"
import { PaceSettings } from "../todo-pace"
import { setTodoPrefs } from "../todo-prefs"
import { SessionKey, SessionsKey } from "../SessionPlanner"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SPAN_KEYS, spanSubLabel } from "./todo-desk-constants"
import type { TodoDesk } from "./use-todo-desk"

export function TodoDeskFascia({
  desk,
  todoHeading,
  openCount,
  headerLoad,
  inProgressCount,
  seasonLabel,
  activeFilterCount,
  stripShown,
}: {
  desk: TodoDesk
  todoHeading: string
  openCount: number
  headerLoad: { text: string; angle: number; overCap: boolean } | null
  inProgressCount: number
  seasonLabel: string
  activeFilterCount: number
  stripShown: boolean
}) {
  const { activeTodoTab, periodTab, focusedDate, setFocusedDate, loadOpen, showTrayOpen, wipLimit } = desk
  return (
    <div
      className="todo-fascia"
      data-ui-name="To Do fascia"
      data-ui-help="Title, period nameplate, period keys, and Show / Sort / Pace."
      data-ui-docs="components/Home/ToDo/README.md"
      data-ui-docs-anchor="instrument-layout"
    >
      <div className="todo-fascia-row is-screen">
        <div className="todo-screen">
          <div className="todo-mark">
            <img src={orbFor("home-todo")} alt="" className="todo-title-orb" />
            <h2>{todoHeading}</h2>
            <span className="todo-mark-count" title="Open">{openCount}</span>
          </div>
          {headerLoad ? (
            <button
              type="button"
              data-no95
              className={`todo-load-readout${headerLoad.overCap ? " is-over-cap" : ""}`}
              aria-expanded={loadOpen}
              aria-label={`Load: ${headerLoad.text}. ${loadOpen ? "Hide" : "Show"} the load instrument`}
              title={loadOpen ? "Hide the load instrument" : "Time, comfort and scope"}
              onClick={() => setTodoPrefs({ loadOpen: !loadOpen })}
            >
              <svg className="todo-load-needle" viewBox="0 0 26 14" aria-hidden="true">
                <path d="M2 13 A11 11 0 0 1 24 13" fill="none" stroke="#3f9c74" strokeWidth="1.5" />
                <path d={`M13 13 L${(13 + Math.sin(headerLoad.angle) * 9).toFixed(1)} ${(13 - Math.cos(headerLoad.angle) * 9).toFixed(1)}`} stroke="#7dffc4" strokeWidth="1.6" />
                <circle cx="13" cy="13" r="1.6" fill="#7dffc4" />
              </svg>
              <span className="todo-load-readout-text">{headerLoad.text}</span>
              {headerLoad.overCap ? (
                <span className="todo-load-readout-wip" title={`${inProgressCount} in progress, over the soft cap of ${wipLimit}`}>
                  {inProgressCount} in progress
                </span>
              ) : null}
              <span className="todo-load-caret" aria-hidden>
                {loadOpen ? "▴" : "▾"}
              </span>
            </button>
          ) : null}
        </div>
        <TodoSettingsDialog
          paceSlot={
            <PaceSettings
              samples={desk.todoTime.samples}
              overrides={desk.todoTime.paceOverrides}
              ghosts={desk.todoTime.paceGhosts}
              scopes={desk.todoTime.scopes}
            />
          }
        />
      </div>
      <div className="todo-fascia-row is-keys">
        {activeTodoTab === "other" ? (
          <TodoRangeNav />
        ) : periodTab === "quarter" ? (
          <div
            className="todo-period-nav"
            data-ui-name="Period nameplate"
            data-ui-help="Moves the focused season."
            data-ui-docs="components/Home/ToDo/README.md"
            data-ui-docs-anchor="instrument-layout"
          >
            <button type="button" className="todo-btn" aria-label="Previous season" onClick={() => setFocusedDate(shiftQuarter(focusedDate, -1))}>
              ‹
            </button>
            <span>{seasonLabel}</span>
            <button type="button" className="todo-btn" aria-label="Next season" onClick={() => setFocusedDate(shiftQuarter(focusedDate, 1))}>
              ›
            </button>
          </div>
        ) : (
          <TodoPeriodNav
            period={periodTab}
            focusedDate={focusedDate}
            onFocusedDateChange={setFocusedDate}
          />
        )}
        <div className="todo-span">
          <span className="todo-span-legend" aria-hidden>
            Span
          </span>
          <TabsList
            className="todo-view-keys"
            data-ui-name="Period keys"
            data-ui-help="Day, week, month, season, and Other (your own named ranges). Each key shows the span it covers."
            data-ui-docs="components/Home/ToDo/README.md"
            data-ui-docs-anchor="data"
          >
            {SPAN_KEYS.map(({ value, word }) => (
              <TabsTrigger key={value} value={value} aria-label={word} className="todo-span-key">
                <span className="todo-span-lamp" aria-hidden />
                <span className="todo-span-word">{word}</span>
                <small className="todo-span-sub" aria-hidden>
                  {spanSubLabel(value, focusedDate)}
                </small>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <span className="todo-keys-grow" aria-hidden />
        <div className="todo-actions" role="group" aria-label="Task actions">
          {activeTodoTab !== "other" && (
            <AddTodoDialog
              onAdd={desk.handleAddTodo}
              searchExisting={desk.searchExistingTasks}
              onPickExisting={desk.pickExistingTask}
              onOpenPickList={() => desk.setSessionOpen("list")}
            />
          )}
          <span className="todo-actions-pair">
            <SessionKey onOpen={() => desk.setSessionOpen("session")} />
            <SessionsKey onOpen={() => desk.setSessionOpen("shelves")} />
          </span>
        </div>
        {stripShown && periodTab !== "quarter" && (
          <div className="todo-show-keys">
            <button
              type="button"
              data-no95
              className={`todo-cap is-mod todo-show-key${activeFilterCount > 0 ? " is-lit" : ""}`}
              aria-expanded={showTrayOpen}
              aria-controls="todo-show-tray"
              aria-label={`Show filters${activeFilterCount > 0 ? `, ${activeFilterCount} on` : ""}`}
              title="Filters: Available now, All tasks, Hide locked, Show next only, Tier, Status, Formula, Open list"
              onClick={() => setTodoPrefs({ showTrayOpen: !showTrayOpen })}
            >
              <span className="todo-show-lamp" aria-hidden />
              Show{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}
            </button>
            <TodoSortKeys
              period={periodTab}
              sortMode={desk.sortMode}
              onSortModeChange={(mode) => setTodoPrefs({ sortMode: mode, sortOrder: DEFAULT_TODO_SORT_ORDER[mode] })}
              sortOrder={desk.sortOrder}
              onSortOrderChange={(order) => setTodoPrefs({ sortOrder: order })}
            />
          </div>
        )}
      </div>
      {stripShown && periodTab !== "quarter" && (
        <div className="todo-fascia-tray" id="todo-show-tray" hidden={!showTrayOpen}>
          <TodoFilters
            period={periodTab}
            availableNow={desk.availableNow}
            onAvailableNowChange={(value) => setTodoPrefs({ availableNow: value })}
            showAllTasks={desk.showAllTasks}
            onShowAllTasksChange={(value) => setTodoPrefs({ showAllTasks: value })}
            statusFilter={desk.statusFilter}
            onStatusFilterChange={(value) => setTodoPrefs({ statusFilter: value })}
            onToggleFormula={() => desk.setShowFormula((v) => !v)}
            listName={periodTodoListName(periodTab, todoPeriodValue(periodTab, focusedDate))}
            onOpenList={() => openPeriodTodoList(periodTab, todoPeriodValue(periodTab, focusedDate))}
          />
        </div>
      )}
    </div>
  )
}

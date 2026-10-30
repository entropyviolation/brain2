/**
 * components/Home/ToDo/desk/todo-season-row.tsx — One season flex row
 *
 * Closed row plus a Flags lid and `TodoBreakdown`. Not `TodoTable`, and not
 * the task card.
 */
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { taskIsPrioritized, taskIsRequired } from "@/lib/todo-commitment"
import { flattenSteps } from "@/lib/todo-steps"
import { openStepItem } from "@/lib/step-item-stack"
import type { Task } from "@/lib/types"
import { TodoBreakdown, TodoDeleteButton, TodoLidSection } from "../TodoBreakdown"
import type { TodoDesk } from "./use-todo-desk"

export function renderSeasonRow(task: Task, desk: TodoDesk, seasonKey: string) {
  const prioritized = taskIsPrioritized(task, "quarter", seasonKey)
  const required = taskIsRequired(task, "quarter", seasonKey)
  const name = itemTitleOrUntitled(task)
  const stepCount = flattenSteps(task.subtasks).length
  const open = desk.openRowId === task.id
  return (
    <li key={task.id} className={`todo-season-row${open ? " is-open" : ""}`}>
      <div className="todo-row-closed">
        <button
          type="button"
          className="todo-row-nameplate"
          data-no95
          title={name}
          onClick={() => {
            desk.setSelectedRowId(task.id)
            desk.setOpenRowId(open ? null : task.id)
          }}
        >
          <span className="todo-row-name">{name}</span>
        </button>
        <div className="todo-row-verbs" role="toolbar" aria-label="Task actions">
          <TodoDeleteButton
            prompt={stepCount > 0 ? `Delete "${name}" and its ${stepCount} steps?` : `Delete "${name}"?`}
            onDelete={() => desk.handleDelete(task.id)}
          />
        </div>
      </div>
      {open ? (
        <div className="todo-lid">
          <TodoLidSection id="flags" label="Flags" layout="flags">
            <button
              type="button"
              className="todo-jewel is-required"
              aria-pressed={required}
              aria-label="Required"
              title="Required — you marked this one for this season"
              onClick={() => desk.handleCommitment(task.id, "quarter", "required")}
            >
              <span className="todo-jewel-glass" aria-hidden />
              <span className="todo-jewel-word">Required</span>
            </button>
            <button
              type="button"
              className="todo-jewel is-prioritized"
              aria-pressed={prioritized}
              aria-label="Prioritized"
              title="Prioritized — stays on Assigned, marked"
              onClick={() => desk.handleCommitment(task.id, "quarter", "prioritized")}
            >
              <span className="todo-jewel-glass" aria-hidden />
              <span className="todo-jewel-word">Prioritized</span>
            </button>
            <button type="button" className="todo-verb" onClick={() => desk.setSelectedTaskId(task.id)}>
              View
            </button>
          </TodoLidSection>
          <TodoBreakdown
            estimate={task.estimatedDuration}
            steps={task.subtasks}
            onEstimateChange={(minutes) => desk.handleEstimate(task.id, minutes)}
            onStepsChange={(subtasks) => desk.handleSteps(task.id, subtasks)}
            onOpenStep={(step) => openStepItem(task.id, step.id)}
            time={desk.todoTime.timeOf(task.id)}
          />
        </div>
      ) : null}
    </li>
  )
}

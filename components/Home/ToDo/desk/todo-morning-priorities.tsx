/**
 * components/Home/ToDo/desk/todo-morning-priorities.tsx — Day morning strip
 *
 * Tasks marked in today's morning review. A completed priority still gets the
 * visually hidden " (done)".
 */
import { itemTitleOrUntitled } from "@/lib/item-utils"
import type { Task } from "@/lib/types"

export function TodoMorningPriorities({
  morningTasks,
  onOpen,
}: {
  morningTasks: Task[]
  onOpen: (taskId: string) => void
}) {
  return (
    <div
      className="todo-morning-priorities"
      data-ui-name="Morning priorities"
      data-ui-help="Tasks marked in today's morning review."
      data-ui-docs="components/Home/ToDo/README.md"
    >
      <p className="todo-morning-label">Morning priorities</p>
      <ol className="todo-morning-list">
        {morningTasks.map((task) => (
          <li key={task.id} className={task.completed ? "is-done" : undefined}>
            <button type="button" className="todo-btn" onClick={() => onOpen(task.id)}>
              {itemTitleOrUntitled(task)}
            </button>
            {task.completed ? <span className="todo-visually-hidden"> (done)</span> : null}
          </li>
        ))}
      </ol>
    </div>
  )
}

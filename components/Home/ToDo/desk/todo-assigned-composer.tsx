/**
 * components/Home/ToDo/desk/todo-assigned-composer.tsx — Assigned foot composer
 *
 * Enter adds. Shift+Enter focuses the first step. A name that matches an open
 * row opens that row and does not create a second task.
 */
import type { Dispatch, SetStateAction } from "react"
import { NativeSelect } from "@/components/ui/native-select"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import type { Task, TodoItem } from "@/lib/types"
import { AddDoneDialog } from "../AddDoneDialog"
import { createScheduledTodoTask, type TodoPeriod } from "../todo-utils"

export function TodoAssignedComposer({
  period,
  focusedDate,
  tasks,
  addTask,
  required,
  visibleAssigned,
  composerName,
  setComposerName,
  composerTier,
  setComposerTier,
  setSelectedRowId,
  setOpenRowId,
  onAddDone,
}: {
  period: TodoPeriod
  focusedDate: Date
  tasks: Task[]
  addTask: (task: Task) => void
  required: TodoItem[]
  visibleAssigned: TodoItem[]
  composerName: string
  setComposerName: Dispatch<SetStateAction<string>>
  composerTier: TodoItem["tier"]
  setComposerTier: Dispatch<SetStateAction<TodoItem["tier"]>>
  setSelectedRowId: Dispatch<SetStateAction<string | null>>
  setOpenRowId: Dispatch<SetStateAction<string | null>>
  onAddDone: (description: string) => void
}) {
  const taskFor = (todoId: string) => tasks.find((task) => task.id === todoId)
  const composerMatch = composerName.trim()
    ? [...required, ...visibleAssigned].find(
        (todo) => itemTitleOrUntitled(taskFor(todo.taskId ?? todo.id) ?? todo).toLowerCase() === composerName.trim().toLowerCase(),
      )
    : undefined
  const submitComposer = (focusFirstStep: boolean) => {
    const description = composerName.trim()
    if (!description) return
    if (composerMatch) {
      setSelectedRowId(composerMatch.id)
      setOpenRowId(composerMatch.id)
      setComposerName("")
      return
    }
    const created = createScheduledTodoTask({
      description,
      tier: composerTier,
      period,
      date: focusedDate,
    })
    addTask(created)
    setComposerName("")
    if (focusFirstStep) {
      window.setTimeout(() => {
        setSelectedRowId(created.id)
        setOpenRowId(created.id)
      }, 0)
    }
  }
  return (
    <div
      className="todo-composer"
      data-ui-name="Assigned composer"
      data-ui-help="Adds a task on this period, or opens a name that already exists."
      data-ui-docs="components/Home/ToDo/README.md"
      data-ui-docs-anchor="required-prioritized-assigned"
    >
      <input
        type="text"
        className="todo-composer-name"
        value={composerName}
        placeholder="Add a task…"
        aria-label="Add a task"
        onChange={(e) => setComposerName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            submitComposer(e.shiftKey)
          }
        }}
      />
      <NativeSelect
        className="todo-nixie"
        aria-label="Composer tier"
        title={`Tier ${composerTier}`}
        value={composerTier}
        onChange={(e) => setComposerTier(e.target.value as TodoItem["tier"])}
      >
        {(["A+", "A", "A/B", "B", "C", "D"] as const).map((tier) => (
          <option key={tier} value={tier}>
            {tier}
          </option>
        ))}
      </NativeSelect>
      {composerMatch ? (
        <button
          type="button"
          className="todo-btn"
          onClick={() => {
            setSelectedRowId(composerMatch.id)
            setOpenRowId(composerMatch.id)
            setComposerName("")
          }}
        >
          Open existing
        </button>
      ) : null}
      <button
        type="button"
        className="todo-btn todo-composer-add"
        onClick={() => submitComposer(false)}
      >
        Add
      </button>
      {/* Log done lives here too, so it stays reachable while the Done well is hidden. */}
      <AddDoneDialog onAdd={onAddDone} />
    </div>
  )
}

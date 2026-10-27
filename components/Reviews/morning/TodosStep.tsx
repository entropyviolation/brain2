/**
 * components/Reviews/morning/TodosStep.tsx — To do for today.
 *
 * Lists today's tasks, new lines, Required today, and up to five priorities.
 */
import type { Dispatch, SetStateAction } from "react"
import { CommitmentMarkList } from "@/components/Reviews/CommitmentMarkList"
import { Label } from "@/components/ui/label"
import { itemTitle } from "@/lib/item-utils"
import type { Task } from "@/lib/types"
import { StringListEditor } from "./StringListEditor"

export function TodosStep({
  todaysTasks,
  newTodoLines,
  setNewTodoLines,
  requiredIds,
  setRequiredIds,
  priorityIds,
  togglePriority,
}: {
  todaysTasks: Task[]
  newTodoLines: string[]
  setNewTodoLines: (next: string[]) => void
  requiredIds: string[]
  setRequiredIds: Dispatch<SetStateAction<string[]>>
  priorityIds: string[]
  togglePriority: (id: string) => void
}) {
  return (
    <>
      <section className="space-y-2">
        {todaysTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">There is nothing on your to do list for today yet.</p>
        ) : (
          <>
            <p className="mr-lede">Here is what is on your to do list for the day:</p>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              {todaysTasks.map((t) => (
                <li key={t.id}>{itemTitle(t)}</li>
              ))}
            </ol>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Add any new items (notes: logged from text). Enter starts the next line. They join the list when you
          move on.
        </p>
        <StringListEditor values={newTodoLines} onChange={setNewTodoLines} placeholder="New to-do…" enterAdvances />
      </section>

      {todaysTasks.length > 0 && (
        <section className="space-y-2">
          <Label className="font-semibold text-sm">Required today</Label>
          <p className="text-xs text-muted-foreground">
            These sit on the Required list. Leave them unchecked to keep a task
            only assigned.
          </p>
          <CommitmentMarkList
            tasks={todaysTasks}
            requiredIds={requiredIds}
            marks="required"
            onToggle={(_kind, id) =>
              setRequiredIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
            }
          />
        </section>
      )}

      {todaysTasks.length > 0 && (
        <section className="space-y-2">
          <Label className="font-semibold text-sm">3–5 highest priorities</Label>
          <p className="text-xs text-muted-foreground">Pick up to five from today&apos;s list.</p>
          <CommitmentMarkList
            tasks={todaysTasks}
            requiredIds={requiredIds}
            prioritizedIds={priorityIds}
            marks="prioritized"
            onToggle={(_kind, id) => togglePriority(id)}
          />
        </section>
      )}
    </>
  )
}

/**
 * components/Home/ToDo/AddTodoDialog.tsx — "Add Task" dialog for the To-Do panel
 *
 * Collects a description and tier. Scheduled to the active period at the
 * focused date. Self-contained form state; emits a completed draft via `onAdd`.
 */
"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import type { TodoItem } from "@/lib/types"

export interface NewTodoDraft {
  description: string
  tier: TodoItem["tier"]
}

const emptyDraft = (): NewTodoDraft => ({
  description: "",
  tier: "A",
})

export function AddTodoDialog({ onAdd }: { onAdd: (draft: NewTodoDraft) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<NewTodoDraft>(emptyDraft)

  const submit = () => {
    if (!draft.description.trim()) return
    onAdd(draft)
    setDraft(emptyDraft())
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="todo-btn">
          Add Task
        </button>
      </DialogTrigger>
      <DialogContent className="todo95-dialog" hideClose aria-describedby={undefined}>
        <div className="todo-dialog-caption">
          <DialogTitle>Add New Task</DialogTitle>
        </div>
        <div className="todo-dialog-body">
          <label htmlFor="todo-description">Description</label>
          <input
            id="todo-description"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Task description"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />

          <label htmlFor="todo-tier">Tier</label>
          <select
            id="todo-tier"
            value={draft.tier}
            onChange={(e) => setDraft({ ...draft, tier: e.target.value as TodoItem["tier"] })}
          >
            <option value="A+">A+ (Critical)</option>
            <option value="A">A (High)</option>
            <option value="A/B">A/B (Medium-High)</option>
            <option value="B">B (Medium)</option>
            <option value="C">C (Low)</option>
            <option value="D">D (Very Low)</option>
          </select>

          <div className="todo-dialog-actions">
            <button type="button" className="todo-btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="todo-btn" onClick={submit}>
              Add Task
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

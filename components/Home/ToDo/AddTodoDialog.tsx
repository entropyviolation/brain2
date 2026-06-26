/**
 * components/Home/ToDo/AddTodoDialog.tsx — "Add Task" dialog for the To-Do panel
 *
 * Collects a description and tier for a new task. The task is scheduled to the
 * To-Do panel's active period (day/week/month) at the focused date — no specific
 * day is forced for week/month lists. Self-contained form state; emits a
 * completed draft via `onAdd`.
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"
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
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="todo-description">Description</Label>
            <Input
              id="todo-description"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Task description"
            />
          </div>

          <div>
            <Label htmlFor="todo-tier">Tier</Label>
            <Select value={draft.tier} onValueChange={(value) => setDraft({ ...draft, tier: value as TodoItem["tier"] })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A+">A+ (Critical)</SelectItem>
                <SelectItem value="A">A (High)</SelectItem>
                <SelectItem value="A/B">A/B (Medium-High)</SelectItem>
                <SelectItem value="B">B (Medium)</SelectItem>
                <SelectItem value="C">C (Low)</SelectItem>
                <SelectItem value="D">D (Very Low)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={submit} className="w-full">
            Add Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

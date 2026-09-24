/**
 * components/Home/ToDo/AddDoneDialog.tsx — Log unplanned completed work
 *
 * Adds a task that is already done (retroactive capture) for the focused period.
 */
"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export function AddDoneDialog({ onAdd, label = "Log done" }: { onAdd: (description: string) => void; label?: string }) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState("")

  const submit = () => {
    if (!description.trim()) return
    onAdd(description.trim())
    setDescription("")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="todo-btn">
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="todo95-dialog" hideClose aria-describedby={undefined}>
        <div className="todo-dialog-caption">
          <DialogTitle>Log completed work</DialogTitle>
        </div>
        <div className="todo-dialog-body">
          <p>Record something you finished that wasn&apos;t on the plan. Points are awarded automatically.</p>
          <label htmlFor="done-description">What did you do?</label>
          <input
            id="done-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Fixed the leaky faucet"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <div className="todo-dialog-actions">
            <button type="button" className="todo-btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="todo-btn" onClick={submit} disabled={!description.trim()}>
              Add to done list
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

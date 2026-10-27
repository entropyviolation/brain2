/**
 * components/inbox/dialogs/deadline-dialog.tsx
 * Set deadline dialog. One due day on the current selection.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { IsolatedInput } from "@/components/ui/isolated-text-field"

export function DeadlineDialog({
  batchMode,
  setBatchMode,
  batchTargets,
  batchDeadline,
  setBatchDeadline,
  applyBatchDeadline,
}: {
  batchMode: "list" | "deadline" | "merge-confirm" | "merge-plan" | "delete-confirm" | "select-n" | null
  setBatchMode: (mode: "list" | "deadline" | "merge-confirm" | "merge-plan" | "delete-confirm" | "select-n" | null) => void
  batchTargets: string[]
  batchDeadline: string
  setBatchDeadline: Dispatch<SetStateAction<string>>
  applyBatchDeadline: () => void
}) {
  return (
    <Dialog open={batchMode === "deadline"} onOpenChange={(next) => { if (!next) setBatchMode(null) }}>
      <DialogContent className="fm98-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set deadline</DialogTitle>
          <DialogDescription>
            Same due date on {batchTargets.length} idea{batchTargets.length === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>
        <Label htmlFor="inbox-batch-deadline">Deadline</Label>
        <IsolatedInput
          id="inbox-batch-deadline"
          type="date"
          value={batchDeadline}
          onLiveChange={setBatchDeadline}
          onCommit={setBatchDeadline}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setBatchMode(null)}>Cancel</Button>
          <Button onClick={applyBatchDeadline}>Apply</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

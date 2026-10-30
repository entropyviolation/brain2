/**
 * components/inbox/dialogs/delete-confirm-dialog.tsx
 * Are you sure? dialog for one row’s trash and for Delete.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { InboxPartition } from "@/lib/inbox-batch"
import { itemTitle } from "@/lib/item-utils"
import type { Task } from "@/lib/types"

export function DeleteConfirmDialog({
  batchMode,
  setBatchMode,
  deletePreview,
  partition,
  revisitTasks,
  pendingDeleteIds,
  setPendingDeleteIds,
  applyDeleteSelection,
}: {
  batchMode: "list" | "deadline" | "merge-confirm" | "merge-plan" | "delete-confirm" | "select-n" | null
  setBatchMode: (mode: "list" | "deadline" | "merge-confirm" | "merge-plan" | "delete-confirm" | "select-n" | null) => void
  deletePreview: Task[]
  partition: InboxPartition
  revisitTasks: Task[]
  pendingDeleteIds: string[]
  setPendingDeleteIds: Dispatch<SetStateAction<string[]>>
  applyDeleteSelection: () => void
}) {
  return (
    <Dialog
      open={batchMode === "delete-confirm"}
      onOpenChange={(next) => {
        if (!next) {
          setBatchMode(null)
          setPendingDeleteIds([])
        }
      }}
    >
      <DialogContent className="inbox-dialog fm98-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            Delete {deletePreview.length} idea{deletePreview.length === 1 ? "" : "s"} from{" "}
            {partition === "monkey" ? "Monkey brain" : "the Inbox"}?
            This cannot be undone from this dialog. Each idea still earns 1 point
            {partition === "inbox" &&
            revisitTasks.length > 0 &&
            revisitTasks.every((task) => pendingDeleteIds.includes(task.id))
              ? ", and clearing the Inbox earns 50 more"
              : ""}
            .
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-40 overflow-y-auto border px-2 py-1 text-sm">
          {deletePreview.map((task) => (
            <p key={task.id}>{itemTitle(task) || "Untitled"}</p>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setBatchMode(null)
              setPendingDeleteIds([])
            }}
          >
            Cancel
          </Button>
          <Button onClick={applyDeleteSelection} className="bg-[#000080] hover:bg-[#000060]">
            Yes, delete {deletePreview.length}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

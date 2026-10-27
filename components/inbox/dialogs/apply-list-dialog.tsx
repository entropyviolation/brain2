/**
 * components/inbox/dialogs/apply-list-dialog.tsx
 * Apply list dialog. Apply leaves the ideas here. Apply and clarify files them.
 */
"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ListPicker } from "@/components/Lists/list-picker"
import type { Dispatch, SetStateAction } from "react"

export function ApplyListDialog({
  batchMode,
  setBatchMode,
  batchTargets,
  batchListIds,
  setBatchListIds,
  applyBatchLists,
  applyBatchListsAndClarify,
}: {
  batchMode: "list" | "deadline" | "merge-confirm" | "merge-plan" | "delete-confirm" | "select-n" | null
  setBatchMode: (mode: "list" | "deadline" | "merge-confirm" | "merge-plan" | "delete-confirm" | "select-n" | null) => void
  batchTargets: string[]
  batchListIds: string[]
  setBatchListIds: Dispatch<SetStateAction<string[]>>
  applyBatchLists: () => void
  applyBatchListsAndClarify: () => void
}) {
  return (
    <Dialog open={batchMode === "list"} onOpenChange={(next) => { if (!next) setBatchMode(null) }}>
      <DialogContent className="fm98-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply list</DialogTitle>
          <DialogDescription>
            Add the chosen lists to {batchTargets.length} selected idea{batchTargets.length === 1 ? "" : "s"}. Apply leaves them here. Apply and clarify files them onto those lists and clears them from this pile. Search cleaning: all or all cleaning for that folder&apos;s All Items.
          </DialogDescription>
        </DialogHeader>
        <ListPicker selected={batchListIds} onChange={setBatchListIds} allowMultiToggle offerFolderAll />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setBatchMode(null)}>Cancel</Button>
          <Button variant="outline" onClick={applyBatchLists} disabled={batchListIds.length === 0}>Apply</Button>
          <Button onClick={applyBatchListsAndClarify} disabled={batchListIds.length === 0} className="bg-[#000080] hover:bg-[#000060]">
            Apply and clarify
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Select N dialog. Picks that many ideas at random from the rows in view, or the whole pile.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function SelectNDialog({
  batchMode,
  setBatchMode,
  actionPool,
  queryActive,
  selectCount,
  setSelectCount,
  applySelectN,
}: {
  batchMode: "list" | "deadline" | "merge-confirm" | "merge-plan" | "delete-confirm" | "select-n" | null
  setBatchMode: (mode: "list" | "deadline" | "merge-confirm" | "merge-plan" | "delete-confirm" | "select-n" | null) => void
  actionPool: { length: number }
  queryActive: boolean
  selectCount: string
  setSelectCount: Dispatch<SetStateAction<string>>
  applySelectN: () => void
}) {
  return (
    <Dialog
      open={batchMode === "select-n"}
      onOpenChange={(next) => {
        if (!next) setBatchMode(null)
      }}
    >
      <DialogContent className="inbox-dialog fm98-dialog sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Select N</DialogTitle>
          <DialogDescription>
            How many ideas? {actionPool.length} or fewer picks that many at random.{" "}
            {queryActive ? "More selects every idea in view." : "More selects the whole pile."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            applySelectN()
          }}
        >
          <input
            className="fm98-input w-full"
            inputMode="numeric"
            aria-label="How many ideas"
            value={selectCount}
            autoFocus
            onChange={(event) => setSelectCount(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setBatchMode(null)}>Cancel</Button>
            <Button type="submit">Select</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

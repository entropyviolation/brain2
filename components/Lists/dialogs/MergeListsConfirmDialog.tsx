"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export interface MergeListsConfirmDialogProps {
  open: boolean
  listNames: string[]
  onCancel: () => void
  onContinue: () => void
}

export function MergeListsConfirmDialog({ open, listNames, onCancel, onContinue }: MergeListsConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <DialogContent className="fm98-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Merge {listNames.length} lists?</DialogTitle>
          <DialogDescription>
            Combine {listNames.map((n) => `“${n}”`).join(", ")} into one list. You will choose the title, folders, and
            what to keep next. Items are kept by default. Extra list records are removed after the merge.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onContinue}>Continue</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

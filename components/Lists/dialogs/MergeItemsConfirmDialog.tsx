"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export interface MergeItemsConfirmDialogProps {
  open: boolean
  itemNames: string[]
  onCancel: () => void
  onContinue: () => void
}

export function MergeItemsConfirmDialog({ open, itemNames, onCancel, onContinue }: MergeItemsConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <DialogContent className="fm98-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Merge {itemNames.length} items?</DialogTitle>
          <DialogDescription>
            Combine {itemNames.map((n) => `“${n}”`).join(", ")} into one item. You will choose the title, lists, and
            what to keep next. Details are kept by default. Extra item records are removed after the merge.
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

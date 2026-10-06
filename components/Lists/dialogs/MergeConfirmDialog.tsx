"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export type MergeConfirmEntity = "items" | "lists"

export interface MergeConfirmDialogProps {
  open: boolean
  /** Controls title + the exact confirm copy for items vs lists. */
  entityLabel: MergeConfirmEntity
  names: string[]
  onCancel: () => void
  onContinue: () => void
}

function mergeConfirmDescription(entityLabel: MergeConfirmEntity, names: string[]): string {
  const joined = names.map((n) => `“${n}”`).join(", ")
  if (entityLabel === "items") {
    return `Combine ${joined} into one item. You will choose the title, lists, and what to keep next. Details are kept by default. Extra item records are removed after the merge.`
  }
  return `Combine ${joined} into one list. You will choose the title, folders, and what to keep next. Items are kept by default. Extra list records are removed after the merge.`
}

export function MergeConfirmDialog({
  open,
  entityLabel,
  names,
  onCancel,
  onContinue,
}: MergeConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <DialogContent className="fm98-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Merge {names.length} {entityLabel}?
          </DialogTitle>
          <DialogDescription>{mergeConfirmDescription(entityLabel, names)}</DialogDescription>
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

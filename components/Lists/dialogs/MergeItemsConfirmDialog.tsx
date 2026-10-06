"use client"

import { MergeConfirmDialog } from "./MergeConfirmDialog"

export interface MergeItemsConfirmDialogProps {
  open: boolean
  itemNames: string[]
  onCancel: () => void
  onContinue: () => void
}

export function MergeItemsConfirmDialog({ open, itemNames, onCancel, onContinue }: MergeItemsConfirmDialogProps) {
  return (
    <MergeConfirmDialog
      open={open}
      entityLabel="items"
      names={itemNames}
      onCancel={onCancel}
      onContinue={onContinue}
    />
  )
}

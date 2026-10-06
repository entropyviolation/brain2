"use client"

import { MergeConfirmDialog } from "./MergeConfirmDialog"

export interface MergeListsConfirmDialogProps {
  open: boolean
  listNames: string[]
  onCancel: () => void
  onContinue: () => void
}

export function MergeListsConfirmDialog({ open, listNames, onCancel, onContinue }: MergeListsConfirmDialogProps) {
  return (
    <MergeConfirmDialog
      open={open}
      entityLabel="lists"
      names={listNames}
      onCancel={onCancel}
      onContinue={onContinue}
    />
  )
}

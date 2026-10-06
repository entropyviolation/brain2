"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { DuplicateScope } from "@/lib/lists-duplicate"

export interface DuplicateSelectionDialogProps {
  open: boolean
  folderCount: number
  listCount: number
  /** Single-entity wording when opened from folder/list settings. */
  subjectLabel?: string
  onOpenChange: (open: boolean) => void
  onConfirm: (scope: DuplicateScope) => void
}

export function DuplicateSelectionDialog({
  open,
  folderCount,
  listCount,
  subjectLabel,
  onOpenChange,
  onConfirm,
}: DuplicateSelectionDialogProps) {
  const [scope, setScope] = useState<DuplicateScope>("settings")

  useEffect(() => {
    if (open) setScope("settings")
  }, [open])

  const total = folderCount + listCount
  const mixed = folderCount > 0 && listCount > 0
  const title = subjectLabel
    ? `Duplicate ${subjectLabel}`
    : total === 1 && folderCount === 1
      ? "Duplicate folder"
      : total === 1 && listCount === 1
        ? "Duplicate list"
        : "Duplicate selection"

  const settingsHint = mixed
    ? "Copy folder and list settings into new empty folders and lists. Names get a “copy” suffix."
    : folderCount > 0 && listCount === 0
      ? "Copy folder settings into a new empty folder. Names get a “copy” suffix."
      : "Copy list settings into a new empty list. Names get a “copy” suffix."

  const contentsHint = mixed
    ? "Also duplicate nested folders, lists inside those folders, and items on those lists as new records."
    : folderCount > 0 && listCount === 0
      ? "Also duplicate nested folders, lists in the folder, and their items as new records."
      : "Also duplicate the list’s items as new records."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="fm98-dialog sm:max-w-md"
        data-ui-name="Duplicate selection"
        data-ui-docs="components/Lists/README.md"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {subjectLabel
              ? `Choose how much of “${subjectLabel}” to copy.`
              : mixed
                ? `Duplicate ${folderCount} folder(s) and ${listCount} list(s). One choice applies to everything selected.`
                : folderCount > 0
                  ? `Duplicate ${folderCount} folder(s).`
                  : `Duplicate ${listCount} list(s).`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="flex items-start gap-2 rounded border p-2 cursor-pointer">
            <input
              type="radio"
              name="duplicate-scope"
              checked={scope === "settings"}
              onChange={() => setScope("settings")}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Settings only</span>
              <p className="text-xs text-muted-foreground mt-0.5">{settingsHint}</p>
            </span>
          </label>
          <label className="flex items-start gap-2 rounded border p-2 cursor-pointer">
            <input
              type="radio"
              name="duplicate-scope"
              checked={scope === "settings_and_contents"}
              onChange={() => setScope("settings_and_contents")}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Settings and contents</span>
              <p className="text-xs text-muted-foreground mt-0.5">{contentsHint}</p>
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={total === 0 && !subjectLabel}
              onClick={() => {
                onConfirm(scope)
                onOpenChange(false)
              }}
            >
              Duplicate
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

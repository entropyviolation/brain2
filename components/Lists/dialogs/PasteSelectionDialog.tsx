"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { PasteMode } from "@/lib/lists-clipboard"

export interface PasteSelectionDialogProps {
  open: boolean
  folderCount: number
  listCount: number
  /** When false, Same identity is unavailable (no destination folder, or folder-only clipboard). */
  sameEnabled: boolean
  sameDisabledReason?: string
  onOpenChange: (open: boolean) => void
  onConfirm: (mode: PasteMode) => void
}

export function PasteSelectionDialog({
  open,
  folderCount,
  listCount,
  sameEnabled,
  sameDisabledReason,
  onOpenChange,
  onConfirm,
}: PasteSelectionDialogProps) {
  const [mode, setMode] = useState<PasteMode>("copies")

  useEffect(() => {
    if (open) setMode(sameEnabled ? "copies" : "copies")
  }, [open, sameEnabled])

  const total = folderCount + listCount
  const mixed = folderCount > 0 && listCount > 0
  const title =
    total === 1 && folderCount === 1
      ? "Paste folder"
      : total === 1 && listCount === 1
        ? "Paste list"
        : "Paste selection"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="fm98-dialog sm:max-w-md"
        data-ui-name="Paste selection"
        data-ui-docs="components/Lists/README.md"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mixed
              ? `Paste ${folderCount} folder(s) and ${listCount} list(s).`
              : folderCount > 0
                ? `Paste ${folderCount} folder(s).`
                : `Paste ${listCount} list(s).`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="flex items-start gap-2 rounded border p-2 cursor-pointer">
            <input
              type="radio"
              name="paste-mode"
              checked={mode === "copies"}
              onChange={() => setMode("copies")}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Copies</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                New records with a “copy” name — settings and contents. Disconnected from the
                originals.
              </p>
            </span>
          </label>
          <label
            className={`flex items-start gap-2 rounded border p-2 ${sameEnabled ? "cursor-pointer" : "opacity-60"}`}
          >
            <input
              type="radio"
              name="paste-mode"
              checked={mode === "same"}
              disabled={!sameEnabled}
              onChange={() => setMode("same")}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Same lists / folders</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sameEnabled
                  ? folderCount > 0
                    ? "Add the same lists into this folder (multi-folder membership). Folders keep one parent and are not reparented."
                    : "Add the same lists into this folder. Connected details stay shared."
                  : sameDisabledReason ||
                    "Same identity needs a real destination folder and at least one list."}
              </p>
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={total === 0 || (mode === "same" && !sameEnabled)}
              onClick={() => {
                onConfirm(mode)
                onOpenChange(false)
              }}
            >
              Paste
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

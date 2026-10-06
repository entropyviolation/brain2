"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ListPlacementMode } from "@/lib/folder-selection"
import { parseBulkCreateNames } from "@/lib/lists-duplicate"
import { BulkNamesField, PlacementModeRadios, ScheduleableSwitch } from "./new-dialog-fields"

export interface NewFolderFields {
  name: string
  color: string
  scheduleable: boolean
}

export interface NewFolderDialogProps {
  open: boolean
  selectedCount: number
  onOpenChange: (open: boolean) => void
  onCreate: (fields: NewFolderFields) => void
  /** Bulk create: one folder per name, same color/scheduleable, current parent. */
  onBulkCreate?: (fields: Omit<NewFolderFields, "name"> & { names: string[] }) => void
  placementMode?: ListPlacementMode
  originIsAll?: boolean
  onPlacementModeChange?: (mode: ListPlacementMode) => void
}

export function NewFolderDialog({
  open,
  selectedCount,
  onOpenChange,
  onCreate,
  onBulkCreate,
  placementMode = "keep",
  originIsAll = false,
  onPlacementModeChange,
}: NewFolderDialogProps) {
  const [name, setName] = useState("")
  const [color, setColor] = useState("#3B82F6")
  const [scheduleable, setScheduleable] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkText, setBulkText] = useState("")

  useEffect(() => {
    if (!open) return
    setName("")
    setColor("#3B82F6")
    setScheduleable(false)
    setBulkMode(false)
    setBulkText("")
  }, [open])

  const bulkNames = parseBulkCreateNames(bulkText)
  // Selection filing only applies to single-create (same as before).
  const selectionActive = selectedCount > 0 && !bulkMode

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fm98-dialog" data-ui-name="New folder" data-ui-docs="components/Lists/README.md">
        <DialogHeader>
          <DialogTitle>{bulkMode ? "Bulk create folders" : "Create New Folder"}</DialogTitle>
          <DialogDescription>
            {bulkMode
              ? "One folder name per line. Empty lines are ignored. Folders are created in the current location."
              : selectedCount > 0
                ? originIsAll
                  ? "Name your folder. Selected lists stay in All and will also appear in this folder."
                  : placementMode === "move"
                    ? "Name your folder. Selected lists and folders will be moved into it."
                    : "Name your folder. Selected lists will also stay in the current folder."
                : "Name your folder and set its defaults. Lists created inside it inherit these settings."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {onBulkCreate && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={bulkMode}
                onChange={(e) => setBulkMode(e.target.checked)}
              />
              Bulk create folders
            </label>
          )}

          {bulkMode ? (
            <BulkNamesField
              id="folder-bulk-names"
              label="Folder names"
              placeholder={"Work\nHome\nArchive"}
              ariaLabel="Folder names, one per line"
              value={bulkText}
              onChange={setBulkText}
              names={bulkNames}
              entitySingular="folder"
            />
          ) : (
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input id="folder-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Work" />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="folder-color">Color</Label>
            <Input id="folder-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          <ScheduleableSwitch
            id="folder-scheduleable"
            checked={scheduleable}
            onCheckedChange={setScheduleable}
            description="Off unless you turn it on. New lists in this folder then start sent to the Scheduler. Dates on a list do not do this."
          />
          {selectionActive && onPlacementModeChange && (
            <PlacementModeRadios
              legend="Selected lists"
              radioName="new-folder-placement"
              mode={placementMode}
              onModeChange={onPlacementModeChange}
              keepLabel="Keep in the current folder and add here"
              moveLabel="Move out of the current folder"
              moveDisabled={originIsAll}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {bulkMode ? (
              <Button
                onClick={() => onBulkCreate?.({ names: bulkNames, color, scheduleable })}
                disabled={bulkNames.length === 0}
              >
                Create {bulkNames.length || ""} Folder{bulkNames.length === 1 ? "" : "s"}
              </Button>
            ) : (
              <Button onClick={() => onCreate({ name, color, scheduleable })} disabled={!name.trim()}>
                Create Folder
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

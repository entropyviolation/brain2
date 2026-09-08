"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CalendarClock } from "lucide-react"
import type { ListPlacementMode } from "@/lib/folder-selection"

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
  placementMode?: ListPlacementMode
  originIsAll?: boolean
  onPlacementModeChange?: (mode: ListPlacementMode) => void
}

export function NewFolderDialog({
  open,
  selectedCount,
  onOpenChange,
  onCreate,
  placementMode = "keep",
  originIsAll = false,
  onPlacementModeChange,
}: NewFolderDialogProps) {
  const [name, setName] = useState("")
  const [color, setColor] = useState("#3B82F6")
  const [scheduleable, setScheduleable] = useState(true)

  useEffect(() => {
    if (!open) return
    setName("")
    setColor("#3B82F6")
    setScheduleable(true)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fm98-dialog">
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription>
            {selectedCount > 0
              ? originIsAll
                ? "Name your folder. Selected lists stay in All and will also appear in this folder."
                : placementMode === "move"
                  ? "Name your folder. Selected lists and folders will be moved into it."
                  : "Name your folder. Selected lists will also stay in the current folder."
              : "Name your folder and set its defaults. Lists created inside it inherit these settings."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input id="folder-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Work" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="folder-color">Color</Label>
            <Input id="folder-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="folder-scheduleable" className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Scheduleable
              </Label>
              <p className="text-xs text-muted-foreground">Default for lists created inside this folder.</p>
            </div>
            <Switch id="folder-scheduleable" checked={scheduleable} onCheckedChange={setScheduleable} />
          </div>
          {selectedCount > 0 && onPlacementModeChange && (
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Selected lists</Label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="new-folder-placement"
                  checked={placementMode === "keep"}
                  onChange={() => onPlacementModeChange("keep")}
                />
                Keep in the current folder and add here
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="new-folder-placement"
                  checked={placementMode === "move"}
                  disabled={originIsAll}
                  onChange={() => onPlacementModeChange("move")}
                />
                Move out of the current folder
              </label>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => onCreate({ name, color, scheduleable })} disabled={!name.trim()}>
              Create Folder
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

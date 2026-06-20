"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CalendarClock } from "lucide-react"

export interface NewFolderDialogProps {
  open: boolean
  name: string
  color: string
  scheduleable: boolean
  selectedCount: number
  onOpenChange: (open: boolean) => void
  onNameChange: (v: string) => void
  onColorChange: (v: string) => void
  onScheduleableChange: (v: boolean) => void
  onCreate: () => void
}

export function NewFolderDialog({
  open,
  name,
  color,
  scheduleable,
  selectedCount,
  onOpenChange,
  onNameChange,
  onColorChange,
  onScheduleableChange,
  onCreate,
}: NewFolderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fm98-dialog">
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription>
            {selectedCount > 0
              ? "Name your folder and set its defaults. The selected lists will be added to it."
              : "Name your folder and set its defaults. Lists created inside it inherit these settings."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input id="folder-name" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g., Work" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="folder-color">Color</Label>
            <Input id="folder-color" type="color" value={color} onChange={(e) => onColorChange(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="folder-scheduleable" className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Scheduleable
              </Label>
              <p className="text-xs text-muted-foreground">Default for lists created inside this folder.</p>
            </div>
            <Switch id="folder-scheduleable" checked={scheduleable} onCheckedChange={onScheduleableChange} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onCreate} disabled={!name.trim()}>
              Create Folder
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

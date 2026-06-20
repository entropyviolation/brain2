"use client"

import type { CategoryFolder } from "@/lib/types"
import { LIST_TEMPLATES } from "@/components/Lists/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CalendarClock } from "lucide-react"

export interface NewListDialogProps {
  open: boolean
  currentFolder: CategoryFolder | null
  isHome: boolean
  name: string
  description: string
  color: string
  scheduleable: boolean
  template: string
  onOpenChange: (open: boolean) => void
  onNameChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onColorChange: (v: string) => void
  onScheduleableChange: (v: boolean) => void
  onTemplateChange: (v: string) => void
  onCreate: () => void
}

export function NewListDialog({
  open,
  currentFolder,
  isHome,
  name,
  description,
  color,
  scheduleable,
  template,
  onOpenChange,
  onNameChange,
  onDescriptionChange,
  onColorChange,
  onScheduleableChange,
  onTemplateChange,
  onCreate,
}: NewListDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fm98-dialog">
        <DialogHeader>
          <DialogTitle>Create New List</DialogTitle>
          <DialogDescription>
            {currentFolder
              ? `Create a new list inside "${currentFolder.name}". Settings are inherited from the folder by default.`
              : isHome
                ? "Create a new list (it will be pinned to Home)."
                : "Create a new list to organize your tasks."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">List Name</Label>
            <Input id="category-name" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g., Work Projects" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-description">Description (optional)</Label>
            <Input
              id="category-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Brief description of this list"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-color">Color</Label>
            <Input id="category-color" type="color" value={color} onChange={(e) => onColorChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-template">Item template</Label>
            <select
              id="category-template"
              className="w-full border rounded-md h-9 px-2 bg-background text-sm"
              value={template}
              onChange={(e) => onTemplateChange(e.target.value)}
            >
              {Object.entries(LIST_TEMPLATES).map(([key, t]) => (
                <option key={key} value={key}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Gives items in this list a starting set of attributes (e.g. price &amp; store, or author &amp; pages). Editable later.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="category-scheduleable" className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Scheduleable
              </Label>
              <p className="text-xs text-muted-foreground">Show items in this list in the Scheduler.</p>
            </div>
            <Switch id="category-scheduleable" checked={scheduleable} onCheckedChange={onScheduleableChange} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onCreate}>Create List</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

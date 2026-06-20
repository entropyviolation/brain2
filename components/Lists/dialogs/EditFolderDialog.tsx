"use client"

import type { CategoryFolder } from "@/lib/types"
import { FolderGlyph } from "@/components/Lists/lib/icon-utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Trash, CalendarClock, Settings, Star } from "lucide-react"

export interface EditFolderDialogProps {
  editingFolder: CategoryFolder | null
  onEditingFolderChange: (folder: CategoryFolder | null) => void
  homePinned: string[]
  toggleHomePin: (id: string) => void
  onOpenIconPicker: () => void
  onSave: () => void
  onDelete: () => void
}

export function EditFolderDialog({
  editingFolder,
  onEditingFolderChange,
  homePinned,
  toggleHomePin,
  onOpenIconPicker,
  onSave,
  onDelete,
}: EditFolderDialogProps) {
  if (!editingFolder) return null

  return (
    <Dialog open={!!editingFolder} onOpenChange={() => onEditingFolderChange(null)}>
      <DialogContent className="fm98-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Folder Settings
          </DialogTitle>
          <DialogDescription>
            Update this folder. New lists created inside it inherit these settings by default.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {editingFolder.icon ? (
              <img src={editingFolder.icon} alt="" className="w-12 h-12 object-contain border rounded-md p-1" />
            ) : (
              <FolderGlyph size={40} color={editingFolder.color || undefined} />
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onOpenIconPicker}>
                Change Icon
              </Button>
              {editingFolder.icon && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditingFolderChange({ ...editingFolder, icon: undefined })}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-folder-name">Folder Name</Label>
            <Input
              id="edit-folder-name"
              value={editingFolder.name}
              onChange={(e) => onEditingFolderChange({ ...editingFolder, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-folder-description">Description</Label>
            <Input
              id="edit-folder-description"
              value={editingFolder.description || ""}
              onChange={(e) => onEditingFolderChange({ ...editingFolder, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-folder-color">Color</Label>
            <Input
              id="edit-folder-color"
              type="color"
              value={editingFolder.color || "#3B82F6"}
              onChange={(e) => onEditingFolderChange({ ...editingFolder, color: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="edit-folder-scheduleable" className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Scheduleable
              </Label>
              <p className="text-xs text-muted-foreground">Default for lists created inside this folder.</p>
            </div>
            <Switch
              id="edit-folder-scheduleable"
              checked={editingFolder.scheduleable !== false}
              onCheckedChange={(checked) => onEditingFolderChange({ ...editingFolder, scheduleable: checked })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Show in Home
              </Label>
              <p className="text-xs text-muted-foreground">Pin this folder to your Home directory.</p>
            </div>
            <Switch
              checked={homePinned.includes(editingFolder.id)}
              onCheckedChange={() => toggleHomePin(editingFolder.id)}
            />
          </div>
          <div className="flex justify-between gap-2">
            <Button variant="destructive" onClick={onDelete}>
              <Trash className="h-4 w-4 mr-2" />
              Delete Folder
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onEditingFolderChange(null)}>
                Cancel
              </Button>
              <Button onClick={onSave}>Save Changes</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

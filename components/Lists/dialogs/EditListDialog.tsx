"use client"

import type { TaskCategory, CategoryFolder } from "@/lib/types"
import type { ListDisplay } from "@/lib/lists-ui-store"
import { categoryIsNextActions } from "@/lib/item-utils"
import { iconFor } from "@/components/Lists/lib/icon-utils"
import { AttributeSchemaEditor, AttributeValuesEditor } from "@/components/Lists/attribute-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Trash, CalendarClock, Settings, Star } from "lucide-react"

export interface EditListDialogProps {
  editingCategory: TaskCategory | null
  onEditingCategoryChange: (category: TaskCategory | null) => void
  folders: CategoryFolder[]
  homePinned: string[]
  listDisplay: Record<string, ListDisplay>
  setListDisplay: (id: string, d: ListDisplay) => void
  toggleHomePin: (id: string) => void
  onOpenIconPicker: () => void
  onSave: () => void
  onDelete: () => void
}

export function EditListDialog({
  editingCategory,
  onEditingCategoryChange,
  folders,
  homePinned,
  listDisplay,
  setListDisplay,
  toggleHomePin,
  onOpenIconPicker,
  onSave,
  onDelete,
}: EditListDialogProps) {
  if (!editingCategory) return null

  return (
    <Dialog open={!!editingCategory} onOpenChange={() => onEditingCategoryChange(null)}>
      <DialogContent className="fm98-dialog sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            List Settings
          </DialogTitle>
          <DialogDescription>Update the settings for this list.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="flex items-center gap-3">
            <img
              src={iconFor(editingCategory.id, editingCategory.icon)}
              alt=""
              className="w-12 h-12 object-contain border rounded-md p-1"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onOpenIconPicker}>
                Change Icon
              </Button>
              {editingCategory.icon && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditingCategoryChange({ ...editingCategory, icon: undefined })}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-category-name">List Name</Label>
            <Input
              id="edit-category-name"
              value={editingCategory.name}
              onChange={(e) => onEditingCategoryChange({ ...editingCategory, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-category-description">Description</Label>
            <Input
              id="edit-category-description"
              value={editingCategory.description || ""}
              onChange={(e) => onEditingCategoryChange({ ...editingCategory, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-category-color">Color</Label>
            <Input
              id="edit-category-color"
              type="color"
              value={editingCategory.color}
              onChange={(e) => onEditingCategoryChange({ ...editingCategory, color: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-item-label">Item name (singular)</Label>
            <Input
              id="edit-item-label"
              value={editingCategory.itemLabel || ""}
              onChange={(e) =>
                onEditingCategoryChange({ ...editingCategory, itemLabel: e.target.value || undefined })
              }
              placeholder={categoryIsNextActions(editingCategory.id, folders) ? "task" : "item"}
            />
            <p className="text-xs text-muted-foreground">
              Used in “Add …” buttons and labels. Next Actions lists default to “task”.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Item detail panels</Label>
            <div className="flex flex-wrap gap-2">
              {(["details", "scheduling", "dependencies", "subtasks", "analysis", "time"] as const).map((panel) => {
                const panels =
                  editingCategory.detailPanels || ["details", "scheduling", "dependencies", "subtasks", "analysis"]
                const on = panels.includes(panel)
                return (
                  <label key={panel} className="flex items-center gap-1 text-sm border rounded px-2 py-1">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        const next = on ? panels.filter((p) => p !== panel) : [...panels, panel]
                        onEditingCategoryChange({ ...editingCategory, detailPanels: next })
                      }}
                    />
                    {panel}
                  </label>
                )
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Display</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["default", "checklist", "icons", "table"] as ListDisplay[]).map((d) => (
                <label key={d} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="list-display"
                    checked={(listDisplay[editingCategory.id] || "default") === d}
                    onChange={() => setListDisplay(editingCategory.id, d)}
                  />
                  <span className="capitalize">{d === "table" ? "Details" : d}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Item attributes</Label>
            <p className="text-xs text-muted-foreground">
              Fields every item in this list can fill in (shown in the item's detail view).
            </p>
            <AttributeSchemaEditor
              value={editingCategory.itemAttributes || []}
              onChange={(defs) => onEditingCategoryChange({ ...editingCategory, itemAttributes: defs })}
            />
          </div>
          {(editingCategory.itemAttributes?.length ?? 0) > 0 && (
            <>
              <div className="space-y-2">
                <Label>Default values for new items</Label>
                <AttributeValuesEditor
                  definitions={editingCategory.itemAttributes || []}
                  values={editingCategory.defaultAttributeValues || {}}
                  onChange={(vals) => onEditingCategoryChange({ ...editingCategory, defaultAttributeValues: vals })}
                />
              </div>
              <div className="space-y-2">
                <Label>Table view columns</Label>
                <div className="flex flex-wrap gap-2">
                  {(editingCategory.itemAttributes || []).map((def) => {
                    const on = (
                      editingCategory.displayedAttributes || editingCategory.itemAttributes!.map((d) => d.id)
                    ).includes(def.id)
                    return (
                      <label key={def.id} className="flex items-center gap-1 text-sm border rounded px-2 py-1">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => {
                            const current =
                              editingCategory.displayedAttributes || editingCategory.itemAttributes!.map((d) => d.id)
                            const next = on ? current.filter((id) => id !== def.id) : [...current, def.id]
                            onEditingCategoryChange({ ...editingCategory, displayedAttributes: next })
                          }}
                        />
                        {def.name}
                      </label>
                    )
                  })}
                </div>
              </div>
            </>
          )}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="edit-category-scheduleable" className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Scheduleable
              </Label>
              <p className="text-xs text-muted-foreground">Show items in this list in the Scheduler.</p>
            </div>
            <Switch
              id="edit-category-scheduleable"
              checked={editingCategory.scheduleable !== false}
              onCheckedChange={(checked) => onEditingCategoryChange({ ...editingCategory, scheduleable: checked })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Show in Home
              </Label>
              <p className="text-xs text-muted-foreground">Pin this list to your Home directory.</p>
            </div>
            <Switch
              checked={homePinned.includes(editingCategory.id)}
              onCheckedChange={() => toggleHomePin(editingCategory.id)}
            />
          </div>
        </div>
        <div className="flex justify-between gap-2 pt-3 border-t shrink-0">
          <Button variant="destructive" onClick={onDelete}>
            <Trash className="h-4 w-4 mr-2" />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onEditingCategoryChange(null)}>
              Cancel
            </Button>
            <Button onClick={onSave}>Save Changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

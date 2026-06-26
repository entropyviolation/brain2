"use client"

import { useMemo, useState } from "react"
import type { List, Folder, ItemTypeDefinition, ListDisplayMode } from "@/lib/types"
import type { ListDisplay } from "@/lib/lists-ui-store"
import { listIsNextActions } from "@/lib/item-utils"
import { useItemTypeStore } from "@/lib/item-type-store"
import { iconFor } from "@/components/Lists/lib/icon-utils"
import { AttributeSchemaEditor, AttributeValuesEditor, listAttributeSchema } from "@/components/Lists/attribute-editor"
import { ListRulesEditor } from "@/components/Lists/dialogs/ListRulesEditor"
import { ItemTypeEditor } from "@/components/ItemTypes/ItemTypeEditor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Trash, CalendarClock, Settings, Star, Shapes, Pencil } from "lucide-react"

export interface EditListDialogProps {
  editingCategory: List | null
  onEditingCategoryChange: (category: List | null) => void
  folders: Folder[]
  homePinned: string[]
  listDisplay: Record<string, ListDisplay>
  setListDisplay: (id: string, d: ListDisplay) => void
  toggleHomePin: (id: string) => void
  onOpenIconPicker: () => void
  onSave: () => void
  onDelete: () => void
}

const ALL_DISPLAYS: ListDisplayMode[] = ["default", "checklist", "icons", "table", "spreadsheet", "kanban"]

function displayLabel(d: ListDisplayMode): string {
  if (d === "table") return "Details"
  return d[0].toUpperCase() + d.slice(1)
}

export function EditListDialog({
  editingCategory,
  onEditingCategoryChange,
  folders,
  homePinned,
  toggleHomePin,
  onOpenIconPicker,
  onSave,
  onDelete,
}: EditListDialogProps) {
  const types = useItemTypeStore((s) => s.types)
  const addType = useItemTypeStore((s) => s.addType)
  const updateType = useItemTypeStore((s) => s.updateType)

  const [typeEditorOpen, setTypeEditorOpen] = useState(false)
  // null = create new; a definition = edit that type.
  const [typeToEdit, setTypeToEdit] = useState<ItemTypeDefinition | null>(null)

  const selectedType = useMemo(
    () => (editingCategory?.itemTypeId ? types.find((t) => t.id === editingCategory.itemTypeId) ?? null : null),
    [types, editingCategory?.itemTypeId],
  )

  // The list's *composed* schema: its item type's attributes plus list-specific
  // extras. Drives the default-values editor and the table-column picker.
  const composedDefs = useMemo(
    () => (editingCategory ? listAttributeSchema(editingCategory, types) : []),
    [editingCategory, types],
  )

  if (!editingCategory) return null

  const enabledDisplays = editingCategory.enabledDisplays ?? ALL_DISPLAYS

  const toggleDisplay = (d: ListDisplayMode) => {
    const on = enabledDisplays.includes(d)
    const nextSet = on ? enabledDisplays.filter((x) => x !== d) : [...enabledDisplays, d]
    if (nextSet.length === 0) return // a list must offer at least one display
    const ordered = ALL_DISPLAYS.filter((x) => nextSet.includes(x))
    onEditingCategoryChange({
      ...editingCategory,
      // Store undefined when every mode is offered (the default) to keep data tidy.
      enabledDisplays: ordered.length === ALL_DISPLAYS.length ? undefined : ordered,
    })
  }

  const handleSaveType = (def: ItemTypeDefinition) => {
    if (types.some((t) => t.id === def.id)) updateType(def)
    else addType(def)
    // Selecting the just-created/edited type for this list.
    onEditingCategoryChange({ ...editingCategory, itemTypeId: def.id })
  }

  const displayIds =
    editingCategory.displayedAttributes && editingCategory.displayedAttributes.length > 0
      ? editingCategory.displayedAttributes
      : composedDefs.map((d) => d.id)

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
              placeholder={listIsNextActions(editingCategory.id, folders) ? "task" : "item"}
            />
            <p className="text-xs text-muted-foreground">
              Used in “Add …” buttons and labels. Next Actions lists default to “task”.
            </p>
          </div>

          {/* Item type — items in this list adopt this type's attributes + defaults. */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Shapes className="h-4 w-4" />
              Item type
            </Label>
            <p className="text-xs text-muted-foreground">
              Items added here are of this type and inherit its attributes, defaults, and rules. Add list-specific
              fields below.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={editingCategory.itemTypeId || "none"}
                onValueChange={(v) =>
                  onEditingCategoryChange({ ...editingCategory, itemTypeId: v === "none" ? undefined : v })
                }
              >
                <SelectTrigger className="h-8 flex-1 min-w-[160px]">
                  <SelectValue placeholder="No type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No type (generic items)</SelectItem>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id as string}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedType && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTypeToEdit(selectedType)
                    setTypeEditorOpen(true)
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  {selectedType.builtin ? "View" : "Edit"}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTypeToEdit(null)
                  setTypeEditorOpen(true)
                }}
              >
                New type…
              </Button>
            </div>
            {selectedType && (selectedType.attributes?.length ?? 0) > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Inherited from {selectedType.name}: {selectedType.attributes!.map((a) => a.name).join(", ")}
              </p>
            )}
          </div>

          {/* Display offerings — which view modes are selectable for this list. */}
          <div className="space-y-2">
            <Label>Display options offered</Label>
            <p className="text-xs text-muted-foreground">
              Choose which views are available from the toolbar for this list.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_DISPLAYS.map((d) => {
                const on = enabledDisplays.includes(d)
                return (
                  <label key={d} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={on} onChange={() => toggleDisplay(d)} />
                    <span>{displayLabel(d)}</span>
                  </label>
                )
              })}
            </div>
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
            <Label>{selectedType ? "List-specific attributes" : "Item attributes"}</Label>
            <p className="text-xs text-muted-foreground">
              {selectedType
                ? `Extra fields for items on this list only (added on top of the ${selectedType.name} type).`
                : "Fields every item in this list can fill in (shown in the item's detail view)."}
            </p>
            <AttributeSchemaEditor
              value={editingCategory.itemAttributes || []}
              onChange={(defs) => onEditingCategoryChange({ ...editingCategory, itemAttributes: defs })}
            />
          </div>

          {composedDefs.length > 0 && (
            <>
              <div className="space-y-2">
                <Label>Default values for new items</Label>
                <AttributeValuesEditor
                  definitions={composedDefs}
                  values={editingCategory.defaultAttributeValues || {}}
                  onChange={(vals) => onEditingCategoryChange({ ...editingCategory, defaultAttributeValues: vals })}
                />
              </div>
              <div className="space-y-2">
                <Label>Shown attributes</Label>
                <p className="text-xs text-muted-foreground">
                  Which attributes appear in this list's views (uncheck to hide without deleting).
                </p>
                <div className="flex flex-wrap gap-2">
                  {composedDefs.map((def) => {
                    const on = displayIds.includes(def.id)
                    return (
                      <label key={def.id} className="flex items-center gap-1 text-sm border rounded px-2 py-1">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => {
                            const current = displayIds
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
              <div className="space-y-2">
                <Label>Rules</Label>
                <p className="text-xs text-muted-foreground">
                  Automation that runs for items on this list (and follows the item into its other lists).
                </p>
                <ListRulesEditor
                  rules={editingCategory.rules || []}
                  defs={composedDefs}
                  onChange={(rules) =>
                    onEditingCategoryChange({ ...editingCategory, rules: rules.length ? rules : undefined })
                  }
                />
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

      <ItemTypeEditor
        open={typeEditorOpen}
        onOpenChange={setTypeEditorOpen}
        type={typeToEdit}
        existingIds={types.map((t) => t.id as string)}
        allTypes={types}
        onSave={handleSaveType}
      />
    </Dialog>
  )
}

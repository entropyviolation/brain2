"use client"

import type { TaskCategory } from "@/lib/types"
import type { CsvImportState } from "@/components/Lists/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export interface CsvImportDialogProps {
  csvImport: CsvImportState
  categories: TaskCategory[]
  onClose: () => void
  onImport: () => void
  onUpdate: (next: CsvImportState) => void
}

export function CsvImportDialog({ csvImport, categories, onClose, onImport, onUpdate }: CsvImportDialogProps) {
  return (
    <Dialog open={!!csvImport} onOpenChange={onClose}>
      <DialogContent className="fm98-dialog sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import “{csvImport.fileName}”</DialogTitle>
          <DialogDescription>
            {csvImport.rows.length} rows · {csvImport.headers.length} columns. Each column becomes an item attribute.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Import into</Label>
            <select
              className="w-full border rounded-md h-9 px-2 bg-background text-sm"
              value={csvImport.targetCategoryId}
              onChange={(e) => onUpdate({ ...csvImport, targetCategoryId: e.target.value })}
            >
              <option value="">➕ New list</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {csvImport.targetCategoryId === "" && (
            <div className="space-y-2">
              <Label>New list name</Label>
              <Input value={csvImport.listName} onChange={(e) => onUpdate({ ...csvImport, listName: e.target.value })} />
            </div>
          )}
          <div className="space-y-2">
            <Label>Item name column</Label>
            <select
              className="w-full border rounded-md h-9 px-2 bg-background text-sm"
              value={csvImport.nameCol}
              onChange={(e) => onUpdate({ ...csvImport, nameCol: Number(e.target.value) })}
            >
              {csvImport.headers.map((h, i) => (
                <option key={i} value={i}>
                  {h || `Column ${i + 1}`}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-muted-foreground">
            Attributes:{" "}
            {csvImport.headers
              .filter((_, i) => i !== csvImport.nameCol)
              .map((h) => h || "?")
              .join(", ") || "(none)"}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onImport}>Import {csvImport.rows.length} items</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * components/Lists/attributes/AttributeSettingsDialog.tsx — One-attribute popup
 *
 * Reuses `AttributeSchemaEditor` (the List Settings schema UI) for a single
 * column. Spreadsheet header **Attribute settings** opens this; it is not a
 * second editor.
 */
"use client"

import type { AttributeDefinition } from "@/lib/types"
import { AttributeSchemaEditor } from "./AttributeSchemaEditor"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function AttributeSettingsDialog({
  def,
  onClose,
  onChange,
}: {
  def: AttributeDefinition | null
  onClose: () => void
  onChange: (def: AttributeDefinition) => void
}) {
  if (!def) return null
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Attribute settings</DialogTitle>
          <DialogDescription>
            Name, type, and field options for this column — the same editor as List Settings.
          </DialogDescription>
        </DialogHeader>
        <AttributeSchemaEditor
          value={[def]}
          single
          onChange={(defs) => {
            if (defs[0]) onChange(defs[0])
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

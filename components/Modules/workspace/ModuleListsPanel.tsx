/**
 * components/Modules/workspace/ModuleListsPanel.tsx — Bound-list editor
 *
 * The in-workspace editor for a module definition's **bound lists**: each binding
 * gives a list (category) a logical `role` within the module, optionally pins an
 * item type, and can extend the list's attribute schema with module-specific
 * fields. Reuses the Lists `AttributeSchemaEditor` for the per-binding extension
 * schema so authoring feels identical to editing a list.
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react"
import type { AttributeDefinition, ModuleListBinding } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { AttributeSchemaEditor } from "@/components/Lists/attributes/AttributeSchemaEditor"

const SELECT_CLS =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"

export function ModuleListsPanel({
  lists,
  onChange,
}: {
  lists: ModuleListBinding[]
  onChange: (lists: ModuleListBinding[]) => void
}) {
  const categories = useTaskStore((s) => s.lists)
  const types = useItemTypeStore((s) => s.types)
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  const update = (idx: number, patch: Partial<ModuleListBinding>) =>
    onChange(lists.map((b, i) => (i === idx ? { ...b, ...patch } : b)))
  const remove = (idx: number) => onChange(lists.filter((_, i) => i !== idx))
  const add = () =>
    onChange([...lists, { role: `list-${lists.length + 1}`, categoryId: categories[0]?.id ?? "" }])

  return (
    <div className="space-y-3">
      {lists.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No bound lists yet. Bind one of your lists to give this module data to work with.
        </p>
      )}

      {lists.map((binding, idx) => {
        const extCount = binding.attributeExtensions?.length ?? 0
        return (
          <div key={idx} className="rounded-lg border p-3 space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[120px] space-y-1">
                <Label className="text-[10px]">Role</Label>
                <Input
                  aria-label={`Role ${idx + 1}`}
                  className="h-9"
                  value={binding.role}
                  onChange={(e) => update(idx, { role: e.target.value })}
                  placeholder="e.g. items"
                />
              </div>
              <div className="flex-1 min-w-[140px] space-y-1">
                <Label className="text-[10px]">List</Label>
                <select
                  aria-label={`List ${idx + 1}`}
                  className={SELECT_CLS}
                  value={binding.categoryId}
                  onChange={(e) => update(idx, { categoryId: e.target.value })}
                >
                  <option value="">Choose a list…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[140px] space-y-1">
                <Label className="text-[10px]">Item type (optional)</Label>
                <select
                  aria-label={`Item type ${idx + 1}`}
                  className={SELECT_CLS}
                  value={binding.itemTypeId ?? ""}
                  onChange={(e) => update(idx, { itemTypeId: e.target.value || undefined })}
                >
                  <option value="">Any type</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => remove(idx)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <Collapsible open={openIdx === idx} onOpenChange={(o) => setOpenIdx(o ? idx : null)}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="-ml-2 text-xs">
                  {openIdx === idx ? <ChevronDown className="mr-1 h-3.5 w-3.5" /> : <ChevronRight className="mr-1 h-3.5 w-3.5" />}
                  Module attributes{extCount > 0 ? ` (${extCount})` : ""}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Extra attributes layered onto this list when the module is instantiated.
                </p>
                <AttributeSchemaEditor
                  value={binding.attributeExtensions ?? []}
                  onChange={(defs: AttributeDefinition[]) => update(idx, { attributeExtensions: defs })}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>
        )
      })}

      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1 h-4 w-4" /> Bind a list
      </Button>
    </div>
  )
}

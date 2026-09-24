/**
 * components/spreadsheet/AddColumnDialog.tsx — Add a spreadsheet column
 *
 * 1. Attributes already on this list's items (searchable).
 * 2. Other known vault attributes.
 * 3. Optionally create a new attribute and assign it to every item on the list
 *    (schema membership so each row can hold a value; empty values are fine).
 */
"use client"

import { useMemo, useState } from "react"
import type { AttributeDefinition, List } from "@/lib/types"
import { slugId } from "@/components/Lists/attributes/helpers"
import { ATTRIBUTE_TYPE_LABELS } from "@/lib/attribute-utils"
import type { SheetColumnCandidate } from "@/lib/spreadsheet-catalog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const COLUMN_TYPES: { value: AttributeDefinition["type"]; label: string }[] = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes/No" },
  { value: "selection", label: "Selection" },
  { value: "datetime", label: "Date / time" },
  { value: "color", label: "Color" },
  { value: "link", label: "Link" },
  { value: "goal", label: "Goal x / y" },
  { value: "multistring", label: "Text list" },
  { value: "image", label: "Image" },
  { value: "formula", label: "Formula" },
]

export interface AddColumnDialogProps {
  category: List
  candidates: SheetColumnCandidate[]
  /** Column ids already shown (excluding name). */
  visibleIds: string[]
  onClose: () => void
  onPickExisting: (candidate: SheetColumnCandidate, assignToAll: boolean) => void
  onCreate: (def: AttributeDefinition, assignToAll: boolean) => void
}

export function AddColumnDialog({
  category,
  candidates,
  visibleIds,
  onClose,
  onPickExisting,
  onCreate,
}: AddColumnDialogProps) {
  const [query, setQuery] = useState("")
  const [assignToAll, setAssignToAll] = useState(true)
  const [name, setName] = useState("")
  const [type, setType] = useState<AttributeDefinition["type"]>("string")
  const [unit, setUnit] = useState("")
  const [options, setOptions] = useState("")
  const [formula, setFormula] = useState("")
  const [formatAs, setFormatAs] = useState<"number" | "currency" | "percent">("number")

  const visible = new Set(visibleIds)
  const q = query.trim().toLowerCase()
  const unused = useMemo(
    () =>
      candidates.filter((c) => {
        if (visible.has(c.id)) return false
        if (!q) return true
        return c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
      }),
    [candidates, visibleIds, q],
  )
  const onList = unused.filter((c) => c.onThisList)
  const others = unused.filter((c) => !c.onThisList)

  const saveNew = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const q = trimmed.toLowerCase()
    const match = candidates.find(
      (c) => c.source === "attribute" && (c.name.toLowerCase() === q || c.id === slugId(trimmed)),
    )
    if (match?.def) {
      onCreate(match.def, true)
      return
    }
    const existing = new Set((category.itemAttributes || []).map((a) => a.id))
    let id = slugId(trimmed)
    while (existing.has(id)) id = `${id}_${Math.random().toString(36).slice(2, 4)}`
    const def: AttributeDefinition = { id, name: trimmed, type }
    if (unit.trim()) def.unit = unit.trim()
    if (type === "selection") {
      def.optionSource = "manual"
      def.options = options
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    }
    if (type === "formula") {
      def.formula = formula.trim()
      def.formatAs = formatAs
    }
    onCreate(def, assignToAll)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add column</DialogTitle>
          <DialogDescription>
            Pick an attribute already on this list, one from the vault, or create a new field and assign it to every row.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto flex-1 pr-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search attributes…"
            aria-label="Search attributes to add"
          />
          <CandidateGroup
            title="On this list"
            empty="Every attribute on this list is already a column."
            candidates={onList}
            onPick={(c) => onPickExisting(c, assignToAll)}
          />
          <CandidateGroup
            title="Other attributes"
            empty={q ? "No other attributes match." : "No other attributes in the vault."}
            candidates={others}
            onPick={(c) => onPickExisting(c, assignToAll)}
          />

          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">Create a new attribute</p>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cost" autoFocus />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as AttributeDefinition["type"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLUMN_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {type === "number" && (
              <div className="space-y-1">
                <Label>Unit (optional)</Label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="$, min, kg…" />
              </div>
            )}
            {type === "selection" && (
              <div className="space-y-1">
                <Label>Options (comma-separated)</Label>
                <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Low, Medium, High" />
              </div>
            )}
            {type === "formula" && (
              <>
                <div className="space-y-1">
                  <Label>Expression</Label>
                  <Input
                    value={formula}
                    onChange={(e) => setFormula(e.target.value)}
                    placeholder="=price * qty"
                    className="font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Reference other columns by id. Functions: SUM, AVG, MIN, MAX.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label>Format</Label>
                  <Select value={formatAs} onValueChange={(v) => setFormatAs(v as "number" | "currency" | "percent")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="currency">Currency</SelectItem>
                      <SelectItem value="percent">Percent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <Button onClick={saveNew} disabled={!name.trim()} className="w-full">
              Add column
            </Button>
          </div>

          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={assignToAll}
              onChange={(e) => setAssignToAll(e.target.checked)}
              aria-label="Assign to every item on this list"
            />
            <span>
              Assign to every item on this list
              <span className="block text-xs text-muted-foreground">
                Adds the field to this list&apos;s schema so every row can hold a value. Empty cells are fine.
              </span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CandidateGroup({
  title,
  empty,
  candidates,
  onPick,
}: {
  title: string
  empty: string
  candidates: SheetColumnCandidate[]
  onPick: (c: SheetColumnCandidate) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1">{empty}</p>
      ) : (
        <ul className="max-h-32 overflow-auto rounded border divide-y">
          {candidates.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted/60 flex items-center justify-between gap-2"
                onClick={() => onPick(c)}
              >
                <span className="truncate">{c.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {ATTRIBUTE_TYPE_LABELS[c.type === "name" ? "string" : c.type] ?? c.type}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

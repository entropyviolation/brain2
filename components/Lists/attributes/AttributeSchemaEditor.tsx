/**
 * components/Lists/attributes/AttributeSchemaEditor.tsx — Attribute schema editor
 *
 * Lets a user define a list's attribute schema: add/remove/reorder attribute
 * definitions, set name/type, and edit per-type schema options (units, options,
 * datetime mode, reference scope, goal labels, …).
 */
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, ChevronUp, ChevronDown, Trophy } from "lucide-react"
import type { AttributeDefinition, AttributeType } from "@/lib/types"
import { ATTRIBUTE_TYPE_LABELS, SCHEMA_ATTRIBUTE_TYPES, normalizeAttributeType } from "@/lib/attribute-utils"
import { isValidFormula } from "@/lib/formula"
import { useTaskStore } from "@/lib/task-store"
import { hasCompletionTiers, withCompletionTiers } from "@/lib/completion-tiers"
import { effectiveDef, slugId } from "./helpers"

// Schema types offered in the editor. Extends the shared canonical list with the
// attachment types (file / multifile) — they need no extra schema configuration,
// so they fall through to the default (no type-specific fields) case below.
const EDITOR_ATTRIBUTE_TYPES: AttributeType[] = [...SCHEMA_ATTRIBUTE_TYPES, "file", "multifile"]

function TypeSpecificSchemaFields({
  def,
  onPatch,
}: {
  def: AttributeDefinition
  onPatch: (patch: Partial<AttributeDefinition>) => void
}) {
  const categories = useTaskStore((s) => s.lists)
  const type = normalizeAttributeType(def.type)

  switch (type) {
    case "boolean":
      return (
        <div className="w-28 space-y-1">
          <Label className="text-[10px]">Display</Label>
          <Select
            value={def.booleanDisplay || "checkbox"}
            onValueChange={(v) => onPatch({ booleanDisplay: v as "checkbox" | "switch" })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checkbox">Checkbox</SelectItem>
              <SelectItem value="switch">Toggle</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )
    case "number":
      return (
        <>
          <div className="w-20 space-y-1">
            <Label className="text-[10px]">Unit</Label>
            <Input value={def.unit || ""} onChange={(e) => onPatch({ unit: e.target.value })} className="h-8" placeholder="$" />
          </div>
          <label className="flex items-center gap-1 text-[10px] pb-1">
            <Checkbox checked={def.allowFloat !== false} onCheckedChange={(c) => onPatch({ allowFloat: !!c })} />
            Allow decimals
          </label>
        </>
      )
    case "datetime":
      return (
        <div className="w-28 space-y-1">
          <Label className="text-[10px]">Mode</Label>
          <Select
            value={def.datetimeMode || "date"}
            onValueChange={(v) => onPatch({ datetimeMode: v as "date" | "time" | "datetime" })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="time">Time</SelectItem>
              <SelectItem value="datetime">Date & time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )
    case "selection":
      return (
        <>
          <label className="flex items-center gap-1 text-[10px] pb-1">
            <Checkbox checked={!!def.allowMultiple} onCheckedChange={(c) => onPatch({ allowMultiple: !!c })} />
            Allow multiple
          </label>
          <div className="w-28 space-y-1">
            <Label className="text-[10px]">Options from</Label>
            <Select
              value={def.optionSource || "manual"}
              onValueChange={(v) => onPatch({ optionSource: v as "manual" | "list" })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual list</SelectItem>
                <SelectItem value="list">App list</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {def.optionSource === "list" ? (
            <div className="flex-1 min-w-[140px] space-y-1">
              <Label className="text-[10px]">Source list</Label>
              <Select value={def.optionListId || "none"} onValueChange={(v) => onPatch({ optionListId: v === "none" ? undefined : v })}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Choose list…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex-1 min-w-[140px] space-y-1">
              <Label className="text-[10px]">Options (comma-separated)</Label>
              <Input
                value={(def.options || []).join(", ")}
                onChange={(e) => onPatch({ options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                className="h-8"
              />
            </div>
          )}
        </>
      )
    case "list":
    case "item":
      return (
        <div className="flex-1 min-w-[140px] space-y-1">
          <Label className="text-[10px]">Scope list (optional)</Label>
          <Select value={def.refListId || "any"} onValueChange={(v) => onPatch({ refListId: v === "any" ? undefined : v })}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any list</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    case "goal":
      return (
        <div className="flex gap-2 min-w-[180px]">
          <div className="space-y-1">
            <Label className="text-[10px]">Current label</Label>
            <Input
              value={def.labels?.current || ""}
              placeholder="Actual"
              onChange={(e) => onPatch({ labels: { ...def.labels, current: e.target.value } })}
              className="h-8 w-24"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Target label</Label>
            <Input
              value={def.labels?.target || ""}
              placeholder="Goal"
              onChange={(e) => onPatch({ labels: { ...def.labels, target: e.target.value } })}
              className="h-8 w-24"
            />
          </div>
        </div>
      )
    case "formula": {
      const valid = isValidFormula(def.formula || "")
      return (
        <>
          <div className="flex-1 min-w-[180px] space-y-1">
            <Label className="text-[10px]">Expression</Label>
            <Input
              value={def.formula || ""}
              onChange={(e) => onPatch({ formula: e.target.value })}
              className={`h-8 font-mono text-xs ${valid ? "" : "border-destructive"}`}
              placeholder="=price * qty"
            />
          </div>
          <div className="w-24 space-y-1">
            <Label className="text-[10px]">Format</Label>
            <Select
              value={def.formatAs || "number"}
              onValueChange={(v) => onPatch({ formatAs: v as "number" | "currency" | "percent" })}
            >
              <SelectTrigger className="h-8">
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
      )
    }
    default:
      return null
  }
}

export function AttributeSchemaEditor({
  value,
  onChange,
}: {
  value: AttributeDefinition[]
  onChange: (defs: AttributeDefinition[]) => void
}) {
  const update = (idx: number, patch: Partial<AttributeDefinition>) => {
    onChange(value.map((d, i) => (i === idx ? { ...d, ...patch } : d)))
  }
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx))
  const move = (idx: number, dir: -1 | 1) => {
    const next = idx + dir
    if (next < 0 || next >= value.length) return
    const copy = [...value]
    ;[copy[idx], copy[next]] = [copy[next], copy[idx]]
    onChange(copy)
  }
  const add = () => onChange([...value, { id: `attr_${Date.now()}`, name: "New attribute", type: "string" }])
  const addTiers = () => onChange(withCompletionTiers(value))
  const tiersPresent = hasCompletionTiers(value)

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">No attributes. Items in this list use only a name.</p>
      )}
      {value.map((rawDef, idx) => {
        const def = effectiveDef(rawDef)
        return (
          <div key={def.id} className="flex flex-wrap items-end gap-2 border rounded-md p-2">
            <div className="flex flex-col gap-0.5 shrink-0">
              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => move(idx, -1)} title="Move up">
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === value.length - 1} onClick={() => move(idx, 1)} title="Move down">
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex-1 min-w-[120px] space-y-1">
              <Label className="text-[10px]">Name</Label>
              <Input
                value={def.name}
                onChange={(e) =>
                  update(idx, { name: e.target.value, id: def.id.startsWith("attr_") ? slugId(e.target.value) : def.id })
                }
                className="h-8"
              />
            </div>
            <div className="w-32 space-y-1">
              <Label className="text-[10px]">Type</Label>
              <Select value={def.type} onValueChange={(v) => update(idx, { type: v as AttributeType })}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDITOR_ATTRIBUTE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ATTRIBUTE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <TypeSpecificSchemaFields def={def} onPatch={(patch) => update(idx, patch)} />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(idx)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      })}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4 mr-1" />
          Add attribute
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={addTiers}
          disabled={tiersPresent}
          title={
            tiersPresent
              ? "This schema already has completion tiers."
              : "Add bare-minimum / goal / exceptional levels with a worked points formula."
          }
        >
          <Trophy className="h-4 w-4 mr-1" />
          {tiersPresent ? "Completion tiers added" : "Add completion tiers"}
        </Button>
      </div>
      {tiersPresent && (
        <p className="text-[11px] text-muted-foreground">
          Tiered rewards added. Set <span className="font-medium">Bare minimum</span>,{" "}
          <span className="font-medium">Goal</span>, and <span className="font-medium">Exceptional</span> thresholds; the{" "}
          <span className="font-medium">Points</span> formula scores each item automatically and awards those points on
          completion.
        </p>
      )}
    </div>
  )
}

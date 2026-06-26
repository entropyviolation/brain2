/**
 * components/Lists/attributes/AttributeValuesEditor.tsx — Attribute value editors
 *
 * `AttributeValuesEditor` edits values against a fixed schema (list-defined
 * attributes). `AdHocAttributesEditor` lets the user add/remove name/type/value
 * pairs on the fly (e.g. inbox "advanced" attributes).
 */
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import type { AttributeDefinition, AttributeType, AttributeValue } from "@/lib/types"
import { ATTRIBUTE_TYPE_LABELS, SCHEMA_ATTRIBUTE_TYPES } from "@/lib/attribute-utils"
import { hasCompletionTiers } from "@/lib/completion-tiers"
import { effectiveDef } from "./helpers"
import { AttributeValueField } from "./AttributeValueField"
import { CompletionTiersPanel } from "./CompletionTiersPanel"

export function AttributeValuesEditor({
  definitions,
  values,
  onChange,
}: {
  definitions: AttributeDefinition[]
  values: Record<string, AttributeValue>
  onChange: (values: Record<string, AttributeValue>) => void
}) {
  if (definitions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        This item's lists don't define any attributes yet. Add some in a list's settings.
      </p>
    )
  }
  const set = (id: string, v: AttributeValue) => onChange({ ...values, [id]: v })
  const showTiers = hasCompletionTiers(definitions)

  return (
    <div className="space-y-3">
      {showTiers && <CompletionTiersPanel definitions={definitions} values={values} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {definitions.map((rawDef) => {
          const def = effectiveDef(rawDef)
          const v = values[def.id]
          return (
            <div key={def.id} className="space-y-1">
              <Label className="text-xs font-medium">{def.name}</Label>
              <AttributeValueField
                def={def}
                value={v}
                onChange={(nv) => set(def.id, nv)}
                definitions={definitions}
                siblingValues={values}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Standalone editor for ad-hoc attribute pairs (e.g. inbox advanced). */
export function AdHocAttributesEditor({
  definitions,
  values,
  onDefinitionsChange,
  onValuesChange,
}: {
  definitions: AttributeDefinition[]
  values: Record<string, AttributeValue>
  onDefinitionsChange: (defs: AttributeDefinition[]) => void
  onValuesChange: (values: Record<string, AttributeValue>) => void
}) {
  const addPair = () => {
    const id = `attr_${Date.now()}`
    onDefinitionsChange([...definitions, { id, name: "Attribute", type: "string" }])
    onValuesChange({ ...values, [id]: "" })
  }

  const removePair = (id: string) => {
    onDefinitionsChange(definitions.filter((d) => d.id !== id))
    const next = { ...values }
    delete next[id]
    onValuesChange(next)
  }

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Custom attributes</Label>
        <Button variant="outline" size="sm" onClick={addPair}>
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
      {definitions.length === 0 && (
        <p className="text-xs text-muted-foreground">No custom attributes. Add name/value pairs for this item.</p>
      )}
      {definitions.map((def, idx) => (
        <div key={def.id} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start border rounded p-2">
          <Input
            value={def.name}
            placeholder="Name"
            onChange={(e) => {
              const name = e.target.value
              onDefinitionsChange(definitions.map((d, i) => (i === idx ? { ...d, name } : d)))
            }}
            className="h-8"
          />
          <Select
            value={def.type}
            onValueChange={(v) =>
              onDefinitionsChange(definitions.map((d, i) => (i === idx ? { ...d, type: v as AttributeType } : d)))
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHEMA_ATTRIBUTE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {ATTRIBUTE_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-1 items-start">
            <div className="flex-1">
              <AttributeValueField def={def} value={values[def.id]} onChange={(v) => onValuesChange({ ...values, [def.id]: v })} />
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removePair(def.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

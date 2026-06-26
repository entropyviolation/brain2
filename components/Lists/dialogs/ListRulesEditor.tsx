/**
 * components/Lists/dialogs/ListRulesEditor.tsx — Per-list automation rules
 *
 * A compact "When <condition> then set <field> = <value>" editor over a list's
 * *composed* attribute schema (its item type's attributes plus list-specific
 * extras). Rules are stored on `List.rules` and apply to an item across
 * all of its lists (see lib/item-types.ts `gatherItemRules`/`applyRules`), so a
 * "Books to Buy" rule like "when purchased = true, set owned = true" updates the
 * book everywhere.
 */
"use client"

import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import type {
  AttributeDefinition,
  AttributeValue,
  ItemRuleOperator,
  ItemRuleTrigger,
  ItemTypeRule,
} from "@/lib/types"
import { AttributeValueField } from "@/components/Lists/attributes/AttributeValueField"

const OPERATORS: { value: ItemRuleOperator; label: string }[] = [
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
  { value: "contains", label: "contains" },
  { value: "exists", label: "is set" },
  { value: "empty", label: "is empty" },
]

const TRIGGERS: { value: ItemRuleTrigger; label: string }[] = [
  { value: "update", label: "is edited" },
  { value: "create", label: "is created" },
  { value: "complete", label: "is completed" },
]

const NEEDS_VALUE = (op: ItemRuleOperator) => op !== "exists" && op !== "empty"

const TITLE_DEF: AttributeDefinition = { id: "title", name: "Title", type: "string" }

function defFor(field: string | undefined, defs: AttributeDefinition[]): AttributeDefinition {
  if (!field) return TITLE_DEF
  return defs.find((d) => d.id === field) ?? { id: field, name: field, type: "string" }
}

function FieldSelect({
  value,
  defs,
  placeholder,
  onChange,
}: {
  value: string | undefined
  defs: AttributeDefinition[]
  placeholder: string
  onChange: (field: string) => void
}) {
  return (
    <Select value={value || "__none"} onValueChange={(v) => onChange(v === "__none" ? "" : v)}>
      <SelectTrigger className="h-8 w-40">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">—</SelectItem>
        <SelectItem value="title">Title</SelectItem>
        {defs.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function RuleRow({
  rule,
  defs,
  onChange,
  onRemove,
}: {
  rule: ItemTypeRule
  defs: AttributeDefinition[]
  onChange: (next: ItemTypeRule) => void
  onRemove: () => void
}) {
  const when = rule.when ?? { field: "", operator: "eq" as ItemRuleOperator }
  // Only "setAttribute" is offered here; the action shape is narrowed below.
  const action = rule.action.kind === "setAttribute" ? rule.action : { kind: "setAttribute" as const, field: "", value: "" as AttributeValue }
  const whenDef = defFor(when.field, defs)
  const actionDef = defFor(action.field, defs)

  const patchWhen = (patch: Partial<NonNullable<ItemTypeRule["when"]>>) =>
    onChange({ ...rule, when: { ...when, ...patch } })
  const patchAction = (patch: Partial<typeof action>) =>
    onChange({ ...rule, action: { ...action, ...patch } })

  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">When item</span>
        <Select value={rule.trigger} onValueChange={(v) => onChange({ ...rule, trigger: v as ItemRuleTrigger })}>
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIGGERS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 ml-auto"
          onClick={onRemove}
          aria-label="Remove rule"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">and</span>
        <FieldSelect value={when.field} defs={defs} placeholder="field…" onChange={(field) => patchWhen({ field })} />
        <Select value={when.operator} onValueChange={(v) => patchWhen({ operator: v as ItemRuleOperator })}>
          <SelectTrigger className="h-8 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATORS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {NEEDS_VALUE(when.operator) && (
          <div className="min-w-[120px] flex-1">
            <AttributeValueField
              def={whenDef}
              value={when.value}
              onChange={(v) => patchWhen({ value: v })}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">then set</span>
        <FieldSelect value={action.field} defs={defs} placeholder="field…" onChange={(field) => patchAction({ field })} />
        <span className="text-xs text-muted-foreground">to</span>
        <div className="min-w-[120px] flex-1">
          <AttributeValueField def={actionDef} value={action.value} onChange={(v) => patchAction({ value: v })} />
        </div>
      </div>
    </div>
  )
}

export function ListRulesEditor({
  rules,
  defs,
  onChange,
}: {
  rules: ItemTypeRule[]
  defs: AttributeDefinition[]
  onChange: (rules: ItemTypeRule[]) => void
}) {
  const addRule = () =>
    onChange([
      ...rules,
      {
        id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: "Rule",
        trigger: "update",
        when: { field: "", operator: "eq" },
        action: { kind: "setAttribute", field: "", value: "" },
      },
    ])

  return (
    <div className="space-y-2">
      {rules.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No rules. Add automation like “when purchased is true, set owned to true”.
        </p>
      )}
      {rules.map((rule, idx) => (
        <RuleRow
          key={rule.id}
          rule={rule}
          defs={defs}
          onChange={(next) => onChange(rules.map((r, i) => (i === idx ? next : r)))}
          onRemove={() => onChange(rules.filter((_, i) => i !== idx))}
        />
      ))}
      <Button variant="outline" size="sm" onClick={addRule}>
        <Plus className="h-4 w-4 mr-1" />
        Add rule
      </Button>
    </div>
  )
}

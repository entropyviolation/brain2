/**
 * components/ItemTypes/ItemTypeEditor.tsx — Create / edit a user item type
 *
 * A dialog form over a single `ItemTypeDefinition`: name + labels, description,
 * color, the attribute schema, capabilities (which gate detail panels), detail
 * layout (cover / featured fields), and rules including implied actions.
 * System types (Task, Note, Operation, Item) are read-only; catalog types
 * (Book, Furniture, …) are editable and persist.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import type {
  AttributeDefinition,
  ItemDetailLayout,
  ItemDetailPanel,
  ItemRuleAction,
  ItemRuleCondition,
  ItemRuleOperator,
  ItemRuleTrigger,
  ItemTypeCapabilities,
  ItemTypeDefinition,
} from "@/lib/types"
import { AttributeSchemaEditor } from "@/components/Lists/attributes/AttributeSchemaEditor"
import { slugId } from "@/components/Lists/attributes/helpers"
import { ItemTypeItemsPanel } from "./ItemTypeItemsPanel"
import { ItemTypeSubtypesPanel } from "./ItemTypeSubtypesPanel"
import { DETAIL_PANEL_ORDER, isSystemItemType, typeAncestorChain } from "@/lib/item-types"
import { ITEM_TYPE_RECIPES } from "@/lib/item-type-recipes"
import { useHabitsStore } from "@/lib/habits-store"

const CAPABILITY_FIELDS: { key: keyof ItemTypeCapabilities; label: string }[] = [
  { key: "completable", label: "Completable" },
  { key: "scheduleable", label: "Scheduleable" },
  { key: "subtasks", label: "Subtasks" },
  { key: "deadline", label: "Deadline" },
  { key: "duration", label: "Duration" },
  { key: "points", label: "Points" },
  { key: "nextActions", label: "Next actions" },
  { key: "recurring", label: "Recurring" },
]

const RULE_TRIGGERS: ItemRuleTrigger[] = ["create", "update", "complete", "schedule", "validate"]

const RULE_OPERATORS: { value: ItemRuleOperator; label: string }[] = [
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
  { value: "contains", label: "contains" },
  { value: "exists", label: "is set" },
  { value: "empty", label: "is empty" },
  { value: "changed", label: "changed" },
  { value: "increased", label: "increased" },
  { value: "decreased", label: "decreased" },
]

type RuleActionKind = ItemRuleAction["kind"]
const RULE_ACTION_KINDS: { kind: RuleActionKind; label: string }[] = [
  { kind: "require", label: "Require field" },
  { kind: "block", label: "Block with message" },
  { kind: "setDefault", label: "Set default value" },
  { kind: "setAttribute", label: "Set attribute value" },
  { kind: "addTag", label: "Add tag" },
  { kind: "addToNextActions", label: "Add to Next Actions" },
  { kind: "logAction", label: "Log Done action" },
  { kind: "incrementHabit", label: "Increment habit" },
]

interface EditableRule {
  id: string
  name: string
  trigger: ItemRuleTrigger
  action: ItemRuleAction
  enabled?: boolean
  /** Preserved verbatim (gating condition isn't editable in this MVP UI). */
  when?: ItemRuleCondition
}

function blankAction(kind: RuleActionKind): ItemRuleAction {
  switch (kind) {
    case "require":
      return { kind: "require", field: "" }
    case "block":
      return { kind: "block", message: "" }
    case "setDefault":
      return { kind: "setDefault", field: "", value: "" }
    case "setAttribute":
      return { kind: "setAttribute", field: "", value: "" }
    case "addTag":
      return { kind: "addTag", tag: "" }
    case "addToNextActions":
      return { kind: "addToNextActions" }
    case "logAction":
      return { kind: "logAction", titleTemplate: "read {delta} pages of {title}", awardPoints: true }
    case "incrementHabit":
      return { kind: "incrementHabit", habitId: "", amount: "delta" }
  }
}

function RuleRow({
  rule,
  fieldOptions,
  readOnly,
  habitOptions,
  onChange,
  onRemove,
}: {
  rule: EditableRule
  fieldOptions: string[]
  readOnly: boolean
  habitOptions: { id: string; name: string }[]
  onChange: (next: EditableRule) => void
  onRemove: () => void
}) {
  const action = rule.action
  const patchAction = (patch: Partial<ItemRuleAction>) =>
    onChange({ ...rule, action: { ...action, ...patch } as ItemRuleAction })

  const fieldSelect = (value: string, onPick: (v: string) => void) => (
    <Select value={value || "__none"} onValueChange={(v) => onPick(v === "__none" ? "" : v)}>
      <SelectTrigger className="h-8 w-36">
        <SelectValue placeholder="Field…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">—</SelectItem>
        <SelectItem value="title">title</SelectItem>
        {fieldOptions.map((f) => (
          <SelectItem key={f} value={f}>
            {f}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={rule.name}
          disabled={readOnly}
          placeholder="Rule name"
          onChange={(e) => onChange({ ...rule, name: e.target.value })}
          className="h-8 flex-1 min-w-[120px]"
        />
        <Select
          value={rule.trigger}
          onValueChange={(v) => onChange({ ...rule, trigger: v as ItemRuleTrigger })}
          disabled={readOnly}
        >
          <SelectTrigger className="h-8 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RULE_TRIGGERS.map((t) => (
              <SelectItem key={t} value={t}>
                on {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!readOnly && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove} aria-label="Remove rule">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={action.kind}
          onValueChange={(v) => onChange({ ...rule, action: blankAction(v as RuleActionKind) })}
          disabled={readOnly}
        >
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RULE_ACTION_KINDS.map((a) => (
              <SelectItem key={a.kind} value={a.kind}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {action.kind === "require" && (
          <>
            {fieldSelect(action.field, (v) => patchAction({ field: v }))}
            <Input
              value={action.message ?? ""}
              disabled={readOnly}
              placeholder="Message (optional)"
              onChange={(e) => patchAction({ message: e.target.value })}
              className="h-8 flex-1 min-w-[120px]"
            />
          </>
        )}
        {action.kind === "block" && (
          <Input
            value={action.message}
            disabled={readOnly}
            placeholder="Block message"
            onChange={(e) => patchAction({ message: e.target.value })}
            className="h-8 flex-1 min-w-[120px]"
          />
        )}
        {(action.kind === "setDefault" || action.kind === "setAttribute") && (
          <>
            {fieldSelect(action.field, (v) => patchAction({ field: v }))}
            <Input
              value={typeof action.value === "string" ? action.value : String(action.value ?? "")}
              disabled={readOnly}
              placeholder="Value"
              onChange={(e) => patchAction({ value: e.target.value })}
              className="h-8 flex-1 min-w-[100px]"
            />
          </>
        )}
        {action.kind === "addTag" && (
          <Input
            value={action.tag}
            disabled={readOnly}
            placeholder="Tag"
            onChange={(e) => patchAction({ tag: e.target.value })}
            className="h-8 flex-1 min-w-[120px]"
          />
        )}
        {action.kind === "addToNextActions" && (
          <span className="text-xs text-muted-foreground">No options.</span>
        )}
        {action.kind === "logAction" && (
          <>
            <Input
              value={action.titleTemplate}
              disabled={readOnly}
              placeholder="read {delta} pages of {title}"
              onChange={(e) => patchAction({ titleTemplate: e.target.value })}
              className="h-8 flex-1 min-w-[160px]"
            />
            <label className="flex items-center gap-1 text-xs">
              <Checkbox
                checked={action.awardPoints !== false}
                disabled={readOnly}
                onCheckedChange={(c) => patchAction({ awardPoints: !!c })}
              />
              Points
            </label>
          </>
        )}
        {action.kind === "incrementHabit" && (
          <>
            <Select
              value={action.habitId || "__none"}
              onValueChange={(v) => patchAction({ habitId: v === "__none" ? "" : v })}
              disabled={readOnly}
            >
              <SelectTrigger className="h-8 w-52">
                <SelectValue placeholder="Habit…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {habitOptions.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={action.amount === "delta" ? "delta" : "fixed"}
              onValueChange={(v) => patchAction({ amount: v === "delta" ? "delta" : 1 })}
              disabled={readOnly}
            >
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delta">use delta</SelectItem>
                <SelectItem value="fixed">fixed</SelectItem>
              </SelectContent>
            </Select>
            {action.amount !== "delta" && (
              <Input
                type="number"
                value={String(action.amount)}
                disabled={readOnly}
                onChange={(e) => patchAction({ amount: Number(e.target.value) || 0 })}
                className="h-8 w-20"
              />
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">when</span>
        {fieldSelect(rule.when?.field ?? "", (field) =>
          onChange({
            ...rule,
            when: field ? { field, operator: rule.when?.operator ?? "eq", value: rule.when?.value } : undefined,
          }),
        )}
        <Select
          value={rule.when?.operator ?? "__none"}
          onValueChange={(v) => {
            if (v === "__none") {
              onChange({ ...rule, when: undefined })
              return
            }
            onChange({
              ...rule,
              when: { field: rule.when?.field ?? "", operator: v as ItemRuleOperator, value: rule.when?.value },
            })
          }}
          disabled={readOnly}
        >
          <SelectTrigger className="h-8 w-32">
            <SelectValue placeholder="always" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">always</SelectItem>
            {RULE_OPERATORS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {rule.when &&
          rule.when.operator !== "exists" &&
          rule.when.operator !== "empty" &&
          rule.when.operator !== "changed" &&
          rule.when.operator !== "increased" &&
          rule.when.operator !== "decreased" && (
            <Input
              value={rule.when.value === undefined || rule.when.value === null ? "" : String(rule.when.value)}
              disabled={readOnly}
              placeholder="value"
              onChange={(e) =>
                onChange({ ...rule, when: { ...rule.when!, value: e.target.value } })
              }
              className="h-8 w-28"
            />
          )}
      </div>
    </div>
  )
}

export function ItemTypeEditor({
  open,
  onOpenChange,
  type,
  existingIds,
  onSave,
  onOpenItem,
  onDelete,
  onNavigateType,
  allTypes = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The type to edit, or null/undefined to create a new one. */
  type?: ItemTypeDefinition | null
  /** Ids already in use (to prevent collisions when creating). */
  existingIds: string[]
  onSave: (type: ItemTypeDefinition) => void
  /** When set, items in the panel are clickable (e.g. open in item detail). */
  onOpenItem?: (itemId: string) => void
  /** Delete the type currently being viewed (user types only). */
  onDelete?: () => void
  /** Switch the editor to another type (e.g. parent or subtype). */
  onNavigateType?: (type: ItemTypeDefinition) => void
  /** Full registry — used for parent/subtype navigation and inheritance labels. */
  allTypes?: ItemTypeDefinition[]
}) {
  const [creatingSubtype, setCreatingSubtype] = useState(false)
  const isNew = !type || creatingSubtype
  const systemLocked = !!type && isSystemItemType(type) && !creatingSubtype
  const editingReadOnly = systemLocked

  const [name, setName] = useState("")
  const [pluralName, setPluralName] = useState("")
  const [itemLabel, setItemLabel] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState("#6366f1")
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([])
  const [capabilities, setCapabilities] = useState<ItemTypeCapabilities>({})
  const [rules, setRules] = useState<EditableRule[]>([])
  const [parentTypeId, setParentTypeId] = useState<string | undefined>(undefined)
  const [detailPanels, setDetailPanels] = useState<ItemDetailPanel[]>(["details"])
  const [detailLayout, setDetailLayout] = useState<ItemDetailLayout>({})
  const [hintsOpen, setHintsOpen] = useState(false)
  const habits = useHabitsStore((s) => s.tasks)
  const habitOptions = useMemo(() => habits.map((h) => ({ id: h.id, name: h.name })), [habits])

  const parentType = useMemo(() => {
    if (!parentTypeId) return undefined
    return allTypes.find((t) => t.id === parentTypeId)
  }, [allTypes, parentTypeId])

  const ancestorChain = useMemo(() => {
    if (!type || creatingSubtype) return parentType ? typeAncestorChain(parentType.id, allTypes) : []
    return typeAncestorChain(type.id, allTypes)
  }, [type, creatingSubtype, parentType, allTypes])

  // Re-seed local form state whenever a different type is opened.
  useEffect(() => {
    if (!open) {
      setCreatingSubtype(false)
      return
    }
    if (creatingSubtype && type) {
      setName("")
      setPluralName("")
      setItemLabel("")
      setDescription("")
      setColor(type.color ?? "#6366f1")
      setAttributes(type.attributes ? type.attributes.map((a) => ({ ...a })) : [])
      setCapabilities({ ...(type.capabilities ?? {}) })
      setRules(
        (type.rules ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          trigger: r.trigger,
          action: r.action,
          enabled: r.enabled,
          when: r.when,
        })),
      )
      setParentTypeId(type.id as string)
      setDetailPanels(type.detailPanels ? [...type.detailPanels] : ["details"])
      setDetailLayout({ ...(type.detailLayout ?? {}) })
      return
    }
    setName(type?.name ?? "")
    setPluralName(type?.pluralName ?? "")
    setItemLabel(type?.itemLabel ?? "")
    setDescription(type?.description ?? "")
    setColor(type?.color ?? "#6366f1")
    setAttributes(type?.attributes ? [...type.attributes] : [])
    setCapabilities({ ...(type?.capabilities ?? {}) })
    setRules(
      (type?.rules ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        trigger: r.trigger,
        action: r.action,
        enabled: r.enabled,
        when: r.when,
      })),
    )
    setParentTypeId(type?.parentTypeId as string | undefined)
    setDetailPanels(type?.detailPanels ? [...type.detailPanels] : ["details"])
    setDetailLayout({ ...(type?.detailLayout ?? {}) })
  }, [open, type, creatingSubtype])

  const fieldOptions = useMemo(() => attributes.map((a) => a.id).filter(Boolean), [attributes])

  const nameError = useMemo(() => {
    if (!name.trim()) return "Name is required."
    if (isNew) {
      const id = slugId(name)
      if (existingIds.includes(id)) return "A type with this name already exists."
    }
    return null
  }, [name, isNew, existingIds])

  const addRule = () =>
    setRules((rs) => [
      ...rs,
      {
        id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: "New rule",
        trigger: "update",
        action: blankAction("logAction"),
      },
    ])

  const applyRecipe = (recipe: (typeof ITEM_TYPE_RECIPES)[number]) => {
    const def = recipe.build()
    setName(def.name)
    setPluralName(def.pluralName ?? "")
    setItemLabel(def.itemLabel ?? "")
    setDescription(def.description ?? "")
    setColor(def.color ?? "#6366f1")
    setAttributes(def.attributes ? def.attributes.map((a) => ({ ...a })) : [])
    setCapabilities({ ...(def.capabilities ?? {}) })
    setDetailPanels(def.detailPanels ? [...def.detailPanels] : ["details"])
    setDetailLayout({ ...(def.detailLayout ?? {}) })
    setRules(
      (def.rules ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        trigger: r.trigger,
        action: r.action,
        enabled: r.enabled,
        when: r.when,
      })),
    )
  }

  const handleSave = () => {
    if (editingReadOnly || nameError) return
    const id = isNew ? slugId(name) : (type!.id as string)
    const def: ItemTypeDefinition = {
      id,
      name: name.trim(),
      builtin: creatingSubtype ? undefined : type?.builtin,
      parentTypeId: parentTypeId as ItemTypeDefinition["parentTypeId"],
      pluralName: pluralName.trim() || undefined,
      itemLabel: itemLabel.trim() || undefined,
      description: description.trim() || undefined,
      color,
      attributes,
      defaultAttributeValues: creatingSubtype ? undefined : type?.defaultAttributeValues,
      displayedAttributes: creatingSubtype ? undefined : type?.displayedAttributes,
      detailPanels: detailPanels.length ? detailPanels : ["details"],
      detailLayout:
        detailLayout.heroImageAttrId || (detailLayout.featuredAttributeIds?.length ?? 0) > 0
          ? detailLayout
          : undefined,
      capabilities,
      kind: creatingSubtype ? undefined : type?.kind,
      rules: rules.map((r) => ({
        id: r.id,
        name: r.name,
        trigger: r.trigger,
        action: r.action,
        enabled: r.enabled,
        when: r.when,
      })),
    }
    onSave(def)
    setCreatingSubtype(false)
    onOpenChange(false)
  }

  const title = creatingSubtype
    ? `New subtype of ${type?.name ?? "type"}`
    : isNew
      ? "New item type"
      : editingReadOnly
        ? `${type?.name} (system)`
        : `Edit ${type?.name}`

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setCreatingSubtype(false)
        onOpenChange(next)
      }}
    >
      <DialogContent className="flex h-[min(92vh,900px)] w-[calc(100%-2rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 space-y-1 border-b px-5 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {creatingSubtype
              ? `Inherits from ${type?.name}. Add fields and rules specific to this subtype.`
              : editingReadOnly
                ? "System types (Task, Note, Operation, Item) are hardcoded and can't be edited here."
                : isNew
                  ? "Define attributes, capabilities, detail layout, and implied-action rules."
                  : "View or edit this type's schema, detail view, behaviors, and items."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mx-auto w-full max-w-sm space-y-5">
            {!isNew && type && !creatingSubtype && onNavigateType && ancestorChain.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs">Inherits from</Label>
                <div className="flex flex-wrap gap-1">
                  {ancestorChain.slice(0, -1).map((ancestor) => (
                    <button
                      key={ancestor.id}
                      type="button"
                      className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
                      onClick={() => onNavigateType(ancestor)}
                    >
                      {ancestor.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {creatingSubtype && type && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Subtype of <span className="font-medium text-foreground">{type.name}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={name}
                  disabled={editingReadOnly}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9"
                />
                {nameError && <p className="text-[11px] text-destructive">{nameError}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Plural name</Label>
                <Input
                  value={pluralName}
                  disabled={editingReadOnly}
                  placeholder={name ? `${name}s` : "Plural"}
                  onChange={(e) => setPluralName(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Item label</Label>
                <Input
                  value={itemLabel}
                  disabled={editingReadOnly}
                  placeholder={name.toLowerCase() || "item"}
                  onChange={(e) => setItemLabel(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={color}
                    disabled={editingReadOnly}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-9 w-14 p-1"
                  />
                  <Input
                    value={color}
                    disabled={editingReadOnly}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-9 flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={description}
                disabled={editingReadOnly}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {isNew && !creatingSubtype && (
              <section className="space-y-2 rounded-md border p-3">
                <button
                  type="button"
                  className="text-sm font-semibold"
                  onClick={() => setHintsOpen((v) => !v)}
                >
                  Starter recipes & implied-action hints {hintsOpen ? "▾" : "▸"}
                </button>
                {hintsOpen && (
                  <div className="space-y-3">
                    {ITEM_TYPE_RECIPES.map((recipe) => (
                      <div key={recipe.id} className="space-y-1 rounded border p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{recipe.name}</span>
                          <Button type="button" variant="outline" size="sm" onClick={() => applyRecipe(recipe)}>
                            Use starter
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">{recipe.summary}</p>
                        <p className="text-[11px] text-muted-foreground">{recipe.hint}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Attributes</h4>
              {editingReadOnly ? (
                <p className="text-xs text-muted-foreground">
                  {attributes.length
                    ? attributes.map((a) => a.name).join(", ")
                    : "This built-in type has no extra attributes."}
                </p>
              ) : (
                <AttributeSchemaEditor value={attributes} onChange={setAttributes} />
              )}
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Capabilities</h4>
              <p className="text-xs text-muted-foreground">
                These gate the item-detail tabs. Uncheck Scheduleable to hide Scheduling. Task is the hardcoded
                work surface — other types opt into slices of it here.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CAPABILITY_FIELDS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={!!capabilities[key]}
                      disabled={editingReadOnly}
                      onCheckedChange={(c) => setCapabilities((caps) => ({ ...caps, [key]: !!c }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Detail panels</h4>
              <p className="text-xs text-muted-foreground">
                Tabs shown when this item is opened. Lists can add more or hide some.
              </p>
              <div className="flex flex-wrap gap-2">
                {DETAIL_PANEL_ORDER.map((panel) => {
                  const on = detailPanels.includes(panel)
                  return (
                    <label key={panel} className="flex items-center gap-1 text-sm border rounded px-2 py-1">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={editingReadOnly}
                        onChange={() => {
                          const next = on ? detailPanels.filter((p) => p !== panel) : [...detailPanels, panel]
                          setDetailPanels(next.length ? next : ["details"])
                        }}
                      />
                      {panel}
                    </label>
                  )
                })}
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Detail layout</h4>
              <div className="space-y-1">
                <Label className="text-xs">Hero image attribute</Label>
                <Select
                  value={detailLayout.heroImageAttrId || "__none"}
                  onValueChange={(v) =>
                    setDetailLayout((l) => ({ ...l, heroImageAttrId: v === "__none" ? undefined : v }))
                  }
                  disabled={editingReadOnly}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None</SelectItem>
                    {attributes
                      .filter((a) => a.type === "image" || a.type === "multiimage")
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {attributes.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Featured attributes</Label>
                  <div className="flex flex-wrap gap-2">
                    {attributes.map((a) => {
                      const on = (detailLayout.featuredAttributeIds ?? []).includes(a.id)
                      return (
                        <label key={a.id} className="flex items-center gap-1 text-sm border rounded px-2 py-1">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={editingReadOnly}
                            onChange={() => {
                              const current = detailLayout.featuredAttributeIds ?? []
                              const next = on ? current.filter((id) => id !== a.id) : [...current, a.id]
                              setDetailLayout((l) => ({ ...l, featuredAttributeIds: next }))
                            }}
                          />
                          {a.name}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">Rules</h4>
                {!editingReadOnly && (
                  <Button variant="outline" size="sm" onClick={addRule}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add rule
                  </Button>
                )}
              </div>
              {rules.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No rules. Example: on Update, when pagesRead increased, Log Done action
                  “read {"{delta}"} pages of {"{title}"}” and Increment a pages/day habit.
                </p>
              )}
              <div className="space-y-2">
                {rules.map((rule, idx) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    fieldOptions={fieldOptions}
                    readOnly={editingReadOnly}
                    habitOptions={habitOptions}
                    onChange={(next) => setRules((rs) => rs.map((r, i) => (i === idx ? next : r)))}
                    onRemove={() => setRules((rs) => rs.filter((_, i) => i !== idx))}
                  />
                ))}
              </div>
            </section>

            {!isNew && type && !creatingSubtype && (
              <>
                <ItemTypeSubtypesPanel typeId={type.id} onOpenType={onNavigateType} />
                <ItemTypeItemsPanel typeId={type.id} onOpenItem={onOpenItem} allTypes={allTypes} />
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t px-5 py-4">
          {!isNew && type && !creatingSubtype && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setCreatingSubtype(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Create subtype
            </Button>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              {onDelete && !editingReadOnly && !isNew && !creatingSubtype && (
                <Button variant="outline" className="text-destructive" onClick={onDelete}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  if (creatingSubtype) {
                    setCreatingSubtype(false)
                    return
                  }
                  onOpenChange(false)
                }}
              >
                {creatingSubtype ? "Back" : editingReadOnly ? "Close" : "Cancel"}
              </Button>
              {!editingReadOnly && (
                <Button onClick={handleSave} disabled={!!nameError}>
                  {isNew ? (creatingSubtype ? "Create subtype" : "Create type") : "Save changes"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

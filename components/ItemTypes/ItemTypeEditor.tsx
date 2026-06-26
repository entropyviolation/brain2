/**
 * components/ItemTypes/ItemTypeEditor.tsx — Create / edit a user item type
 *
 * A dialog form over a single `ItemTypeDefinition`: name + labels, description,
 * color, the attribute schema (reusing `AttributeSchemaEditor`), behavioral
 * capability flags, and declarative type-level rules (the existing `ItemRule*`
 * shapes). Built-in types open read-only; user types are fully editable and
 * saved through the item-type store by the parent (`ItemTypeList`).
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
  ItemRuleAction,
  ItemRuleCondition,
  ItemRuleTrigger,
  ItemTypeCapabilities,
  ItemTypeDefinition,
} from "@/lib/types"
import { AttributeSchemaEditor } from "@/components/Lists/attributes/AttributeSchemaEditor"
import { slugId } from "@/components/Lists/attributes/helpers"
import { ItemTypeItemsPanel } from "./ItemTypeItemsPanel"
import { ItemTypeSubtypesPanel } from "./ItemTypeSubtypesPanel"
import { typeAncestorChain } from "@/lib/item-types"

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

type RuleActionKind = ItemRuleAction["kind"]
const RULE_ACTION_KINDS: { kind: RuleActionKind; label: string }[] = [
  { kind: "require", label: "Require field" },
  { kind: "block", label: "Block with message" },
  { kind: "setDefault", label: "Set default value" },
  { kind: "setAttribute", label: "Set attribute value" },
  { kind: "addTag", label: "Add tag" },
  { kind: "addToNextActions", label: "Add to Next Actions" },
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
  }
}

function RuleRow({
  rule,
  fieldOptions,
  readOnly,
  onChange,
  onRemove,
}: {
  rule: EditableRule
  fieldOptions: string[]
  readOnly: boolean
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
  const editingReadOnly = !!type?.builtin && !creatingSubtype

  const [name, setName] = useState("")
  const [pluralName, setPluralName] = useState("")
  const [itemLabel, setItemLabel] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState("#6366f1")
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([])
  const [capabilities, setCapabilities] = useState<ItemTypeCapabilities>({})
  const [rules, setRules] = useState<EditableRule[]>([])
  const [parentTypeId, setParentTypeId] = useState<string | undefined>(undefined)

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
        trigger: "validate",
        action: blankAction("require"),
      },
    ])

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
      detailPanels: creatingSubtype ? undefined : type?.detailPanels,
      capabilities,
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
        ? `${type?.name} (built-in)`
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
                ? "Built-in types ship with the app and can't be edited."
                : isNew
                  ? "Define attributes, behaviors, and rules for items of this type."
                  : "View or edit this type's schema, behaviors, and items."}
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
                  No rules. Add validation or automation that runs on item lifecycle events.
                </p>
              )}
              <div className="space-y-2">
                {rules.map((rule, idx) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    fieldOptions={fieldOptions}
                    readOnly={editingReadOnly}
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

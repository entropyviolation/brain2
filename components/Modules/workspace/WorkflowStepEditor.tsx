/**
 * components/Modules/workspace/WorkflowStepEditor.tsx — Single-workflow editor
 *
 * The form that composes one serializable `WorkflowDefinition`: pick a **trigger**
 * (item create/update/complete, attribute change, manual button, schedule), add
 * gating **conditions** (`ItemRuleCondition`), and chain **actions** (every
 * `WorkflowAction` kind) as an ordered, drag-reorderable step list. The source of
 * truth is the JSON shape — there is no DSL. Used inside `WorkflowBuilder`.
 *
 * Uses native `<select>`/inputs (styled to the app) so the builder stays simple,
 * fully keyboard-accessible, and trivially testable without portal/pointer shims.
 */
"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GripVertical, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react"
import type {
  ItemRuleCondition,
  ItemRuleOperator,
  WorkflowAction,
  WorkflowDefinition,
  WorkflowTrigger,
} from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { useWorkflowsStore } from "@/lib/workflows-store"

const SELECT_CLS =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"

let editorCounter = 0
function freshId(prefix: string): string {
  editorCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${editorCounter.toString(36)}`
}

type TriggerKind = WorkflowTrigger["kind"]

const TRIGGER_LABELS: Record<TriggerKind, string> = {
  item: "When an item changes",
  attribute: "When an attribute changes",
  manual: "When I click a button",
  schedule: "On a schedule",
}

const ITEM_EVENTS: { value: "create" | "update" | "complete"; label: string }[] = [
  { value: "create", label: "is created" },
  { value: "update", label: "is updated" },
  { value: "complete", label: "is completed" },
]

const OPERATORS: { value: ItemRuleOperator; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "does not equal" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: "greater or equal" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "less or equal" },
  { value: "contains", label: "contains" },
  { value: "exists", label: "is set" },
  { value: "empty", label: "is empty" },
]

const ACTION_KINDS: { value: WorkflowAction["kind"]; label: string; help: string }[] = [
  { value: "setAttribute", label: "Set an attribute", help: "Write a value onto the item." },
  { value: "setDefault", label: "Set a default", help: "Fill an attribute only when it's empty." },
  { value: "addTag", label: "Add a tag", help: "Tag the item." },
  { value: "addToNextActions", label: "Add to Next Actions", help: "Promote an inbox item." },
  { value: "createItem", label: "Create an item", help: "Add a new item to a list." },
  { value: "link", label: "Link to another item", help: "Create a typed relationship." },
  { value: "setSchedule", label: "Schedule the item", help: "Place it on a date/time from attributes." },
  { value: "syncPlan", label: "Sync to Plan", help: "Push finalized, dated items into your Plan." },
  { value: "pickRandom", label: "Pick random items", help: "Sample items from a list into an attribute." },
  { value: "runWorkflow", label: "Run another workflow", help: "Chain a second workflow." },
  { value: "require", label: "Require a field", help: "Block unless a field is filled." },
  { value: "block", label: "Block with a message", help: "Stop the change with a reason." },
  { value: "throw", label: "Throw an error", help: "Abort and surface a message." },
]

/** A blank action object for a chosen kind (sensible, serializable defaults). */
function defaultAction(kind: WorkflowAction["kind"]): WorkflowAction {
  switch (kind) {
    case "setAttribute":
      return { kind, field: "", value: "" }
    case "setDefault":
      return { kind, field: "", value: "" }
    case "addTag":
      return { kind, tag: "" }
    case "addToNextActions":
      return { kind }
    case "createItem":
      return { kind, categoryId: "" }
    case "link":
      return { kind, relation: "related" }
    case "setSchedule":
      return { kind, dateAttrId: "" }
    case "syncPlan":
      return { kind }
    case "pickRandom":
      return { kind, storeInAttr: "", fromCategoryId: "", count: 1 }
    case "runWorkflow":
      return { kind, workflowId: "" }
    case "require":
      return { kind, field: "" }
    case "block":
      return { kind, message: "" }
    case "throw":
      return { kind, message: "" }
    default:
      return { kind: "addTag", tag: "" }
  }
}

function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const copy = [...list]
  const [moved] = copy.splice(from, 1)
  copy.splice(to, 0, moved)
  return copy
}

export function WorkflowStepEditor({
  initial,
  moduleId,
  onSave,
  onCancel,
}: {
  initial?: WorkflowDefinition
  moduleId?: string
  onSave: (def: WorkflowDefinition) => void
  onCancel: () => void
}) {
  const lists = useTaskStore((s) => s.lists)
  const allWorkflows = useWorkflowsStore((s) => s.workflows)

  const [name, setName] = useState(initial?.name ?? "")
  const [enabled, setEnabled] = useState(initial?.enabled !== false)
  const [triggerKind, setTriggerKind] = useState<TriggerKind>(initial?.trigger.kind ?? "item")
  const [itemEvent, setItemEvent] = useState<"create" | "update" | "complete">(
    initial?.trigger.kind === "item" && initial.trigger.event !== "schedule" && initial.trigger.event !== "validate"
      ? (initial.trigger.event as "create" | "update" | "complete")
      : "create",
  )
  const [attrId, setAttrId] = useState(initial?.trigger.kind === "attribute" ? initial.trigger.attrId : "")
  const [buttonLabel, setButtonLabel] = useState(
    initial?.trigger.kind === "manual" ? initial.trigger.buttonLabel ?? "" : "",
  )
  const [intervalMinutes, setIntervalMinutes] = useState(
    initial?.trigger.kind === "schedule" ? initial.trigger.intervalMinutes ?? 60 : 60,
  )
  const [scopeCategoryId, setScopeCategoryId] = useState(initial?.scope?.listIds?.[0] ?? "")
  const [conditions, setConditions] = useState<ItemRuleCondition[]>(initial?.conditions ?? [])
  const [actions, setActions] = useState<WorkflowAction[]>(initial?.actions ?? [])
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const otherWorkflows = useMemo(
    () => allWorkflows.filter((w) => w.id !== initial?.id),
    [allWorkflows, initial?.id],
  )

  const buildTrigger = (): WorkflowTrigger => {
    switch (triggerKind) {
      case "item":
        return { kind: "item", event: itemEvent }
      case "attribute":
        return { kind: "attribute", attrId, event: "change" }
      case "manual":
        return { kind: "manual", buttonLabel: buttonLabel.trim() || undefined }
      case "schedule":
        return { kind: "schedule", intervalMinutes: Math.max(1, intervalMinutes) }
    }
  }

  const save = () => {
    const def: WorkflowDefinition = {
      id: initial?.id ?? freshId("wf"),
      name: name.trim() || "Untitled workflow",
      moduleId: moduleId ?? initial?.moduleId,
      trigger: buildTrigger(),
      conditions: conditions.length > 0 ? conditions : undefined,
      actions,
      enabled,
      scope: scopeCategoryId ? { listIds: [scopeCategoryId] } : undefined,
    }
    onSave(def)
  }

  // ---- condition helpers ----
  const addCondition = () => setConditions((c) => [...c, { field: "", operator: "eq", value: "" }])
  const updateCondition = (i: number, patch: Partial<ItemRuleCondition>) =>
    setConditions((c) => c.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  const removeCondition = (i: number) => setConditions((c) => c.filter((_, idx) => idx !== i))

  // ---- action helpers ----
  const addAction = (kind: WorkflowAction["kind"]) => setActions((a) => [...a, defaultAction(kind)])
  const updateAction = (i: number, next: WorkflowAction) =>
    setActions((a) => a.map((x, idx) => (idx === i ? next : x)))
  const removeAction = (i: number) => setActions((a) => a.filter((_, idx) => idx !== i))
  const moveAction = (from: number, to: number) => setActions((a) => reorder(a, from, to))

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="wf-name">Workflow name</Label>
        <Input
          id="wf-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Auto-tag finalized bookings"
        />
      </div>

      {/* Trigger */}
      <section className="rounded-lg border p-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            1
          </span>
          <h4 className="text-sm font-semibold">Trigger</h4>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">When</Label>
          <select
            aria-label="Trigger"
            className={SELECT_CLS}
            value={triggerKind}
            onChange={(e) => setTriggerKind(e.target.value as TriggerKind)}
          >
            {(Object.keys(TRIGGER_LABELS) as TriggerKind[]).map((k) => (
              <option key={k} value={k}>
                {TRIGGER_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        {triggerKind === "item" && (
          <div className="space-y-2">
            <Label className="text-xs">Item event</Label>
            <select
              aria-label="Item event"
              className={SELECT_CLS}
              value={itemEvent}
              onChange={(e) => setItemEvent(e.target.value as "create" | "update" | "complete")}
            >
              {ITEM_EVENTS.map((o) => (
                <option key={o.value} value={o.value}>
                  An item {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {triggerKind === "attribute" && (
          <div className="space-y-2">
            <Label className="text-xs">Attribute id</Label>
            <Input
              aria-label="Attribute id"
              value={attrId}
              onChange={(e) => setAttrId(e.target.value)}
              placeholder="e.g. status"
            />
            <p className="text-[11px] text-muted-foreground">Fires when this attribute's value changes.</p>
          </div>
        )}
        {triggerKind === "manual" && (
          <div className="space-y-2">
            <Label className="text-xs">Button label</Label>
            <Input
              aria-label="Button label"
              value={buttonLabel}
              onChange={(e) => setButtonLabel(e.target.value)}
              placeholder="Run now"
            />
          </div>
        )}
        {triggerKind === "schedule" && (
          <div className="space-y-2">
            <Label className="text-xs">Every (minutes)</Label>
            <Input
              aria-label="Every (minutes)"
              type="number"
              min={1}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Number(e.target.value) || 1)}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label className="text-xs">Limit to list (optional)</Label>
          <select
            aria-label="Limit to list"
            className={SELECT_CLS}
            value={scopeCategoryId}
            onChange={(e) => setScopeCategoryId(e.target.value)}
          >
            <option value="">Any list</option>
            {lists.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Conditions */}
      <section className="rounded-lg border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              2
            </span>
            <h4 className="text-sm font-semibold">Conditions (optional)</h4>
          </div>
          <Button variant="outline" size="sm" onClick={addCondition}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add condition
          </Button>
        </div>
        {conditions.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Runs every time the trigger fires.</p>
        ) : (
          <div className="space-y-2">
            {conditions.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={`Condition field ${i + 1}`}
                  className="h-9 flex-1 min-w-[120px]"
                  value={c.field}
                  onChange={(e) => updateCondition(i, { field: e.target.value })}
                  placeholder="field / attribute id"
                />
                <select
                  aria-label={`Condition operator ${i + 1}`}
                  className={`${SELECT_CLS} w-40`}
                  value={c.operator}
                  onChange={(e) => updateCondition(i, { operator: e.target.value as ItemRuleOperator })}
                >
                  {OPERATORS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {c.operator !== "exists" && c.operator !== "empty" && (
                  <Input
                    aria-label={`Condition value ${i + 1}`}
                    className="h-9 flex-1 min-w-[100px]"
                    value={c.value == null ? "" : String(c.value)}
                    onChange={(e) => updateCondition(i, { value: e.target.value })}
                    placeholder="value"
                  />
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCondition(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Actions */}
      <section className="rounded-lg border p-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            3
          </span>
          <h4 className="text-sm font-semibold">Actions</h4>
        </div>
        {actions.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Add at least one action to run.</p>
        ) : (
          <ol className="space-y-2">
            {actions.map((a, i) => {
              const meta = ACTION_KINDS.find((k) => k.value === a.kind)
              return (
                <li
                  key={i}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null) moveAction(dragIndex, i)
                    setDragIndex(null)
                  }}
                  className="rounded-md border bg-card p-2 space-y-2"
                  data-testid={`action-${i}`}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Step {i + 1}</span>
                    <select
                      aria-label={`Action kind ${i + 1}`}
                      className={`${SELECT_CLS} flex-1`}
                      value={a.kind}
                      onChange={(e) => updateAction(i, defaultAction(e.target.value as WorkflowAction["kind"]))}
                    >
                      {ACTION_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={i === 0}
                      onClick={() => moveAction(i, i - 1)}
                      title="Move up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={i === actions.length - 1}
                      onClick={() => moveAction(i, i + 1)}
                      title="Move down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeAction(i)}
                      title="Remove step"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {meta && <p className="pl-6 text-[11px] text-muted-foreground">{meta.help}</p>}
                  <div className="pl-6">
                    <ActionFields
                      action={a}
                      index={i}
                      lists={lists}
                      workflows={otherWorkflows.map((w) => ({ id: w.id, name: w.name }))}
                      onChange={(next) => updateAction(i, next)}
                    />
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground">Add step:</span>
          <select
            aria-label="Add action"
            className={`${SELECT_CLS} w-56`}
            value=""
            onChange={(e) => {
              if (e.target.value) addAction(e.target.value as WorkflowAction["kind"])
            }}
          >
            <option value="">Choose an action…</option>
            {ACTION_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Enabled
      </label>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={save} disabled={actions.length === 0}>
          Save workflow
        </Button>
      </div>
    </div>
  )
}

function ActionFields({
  action,
  index,
  lists,
  workflows,
  onChange,
}: {
  action: WorkflowAction
  index: number
  lists: { id: string; name: string }[]
  workflows: { id: string; name: string }[]
  onChange: (next: WorkflowAction) => void
}) {
  const field = (label: string, value: string, set: (v: string) => void, placeholder?: string) => (
    <div className="space-y-1">
      <Label className="text-[10px]">{label}</Label>
      <Input
        aria-label={`${label} ${index + 1}`}
        className="h-8"
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )

  const categorySelect = (label: string, value: string, set: (v: string) => void) => (
    <div className="space-y-1">
      <Label className="text-[10px]">{label}</Label>
      <select aria-label={`${label} ${index + 1}`} className={`${SELECT_CLS} h-8`} value={value} onChange={(e) => set(e.target.value)}>
        <option value="">Choose a list…</option>
        {lists.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )

  switch (action.kind) {
    case "setAttribute":
    case "setDefault":
      return (
        <div className="grid grid-cols-2 gap-2">
          {field("Field / attribute id", action.field, (v) => onChange({ ...action, field: v }))}
          {field("Value", action.value == null ? "" : String(action.value), (v) => onChange({ ...action, value: v }))}
        </div>
      )
    case "addTag":
      return field("Tag", action.tag, (v) => onChange({ ...action, tag: v }), "e.g. urgent")
    case "addToNextActions":
    case "syncPlan":
      return null
    case "createItem":
      return (
        <div className="grid grid-cols-2 gap-2">
          {categorySelect("In list", action.categoryId, (v) => onChange({ ...action, categoryId: v }))}
          {field("Title from attribute (optional)", action.titleFrom ?? "", (v) =>
            onChange({ ...action, titleFrom: v || undefined }),
          )}
        </div>
      )
    case "link":
      return (
        <div className="grid grid-cols-2 gap-2">
          {field("Relation", action.relation, (v) => onChange({ ...action, relation: v }), "blocks / supports")}
          {field("Target id (optional)", action.targetId ?? "", (v) =>
            onChange({ ...action, targetId: v || undefined }),
          )}
          {field("…or target from attribute", action.targetFromAttr ?? "", (v) =>
            onChange({ ...action, targetFromAttr: v || undefined }),
          )}
        </div>
      )
    case "setSchedule":
      return (
        <div className="grid grid-cols-2 gap-2">
          {field("Date attribute id", action.dateAttrId, (v) => onChange({ ...action, dateAttrId: v }))}
          {field("Time attribute id (optional)", action.timeAttrId ?? "", (v) =>
            onChange({ ...action, timeAttrId: v || undefined }),
          )}
        </div>
      )
    case "pickRandom":
      return (
        <div className="grid grid-cols-3 gap-2">
          {categorySelect("From list", action.fromCategoryId, (v) => onChange({ ...action, fromCategoryId: v }))}
          {field("Store in attribute", action.storeInAttr, (v) => onChange({ ...action, storeInAttr: v }))}
          <div className="space-y-1">
            <Label className="text-[10px]">Count</Label>
            <Input
              aria-label={`Count ${index + 1}`}
              type="number"
              min={1}
              className="h-8"
              value={action.count}
              onChange={(e) => onChange({ ...action, count: Number(e.target.value) || 1 })}
            />
          </div>
        </div>
      )
    case "runWorkflow":
      return (
        <div className="space-y-1">
          <Label className="text-[10px]">Workflow to run</Label>
          <select
            aria-label={`Workflow to run ${index + 1}`}
            className={`${SELECT_CLS} h-8`}
            value={action.workflowId}
            onChange={(e) => onChange({ ...action, workflowId: e.target.value })}
          >
            <option value="">Choose a workflow…</option>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      )
    case "require":
      return (
        <div className="grid grid-cols-2 gap-2">
          {field("Required field", action.field, (v) => onChange({ ...action, field: v }))}
          {field("Message (optional)", action.message ?? "", (v) => onChange({ ...action, message: v || undefined }))}
        </div>
      )
    case "block":
    case "throw":
      return field("Message", action.message, (v) => onChange({ ...action, message: v }))
    default:
      return null
  }
}

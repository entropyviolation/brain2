/**
 * lib/workflow-engine.ts — Workflow rules engine (Module platform, Workstream B)
 *
 * The "rules ACT" layer of the Module platform: it runs declarative
 * `WorkflowDefinition`s (trigger → conditions → actions) when items mutate or a
 * user invokes a workflow manually. This is the second, separate layer from the
 * expression formulas in `lib/formula.ts` (which only compute values).
 *
 * Design:
 *   - **Pure core, injected effects.** The engine evaluates triggers/conditions
 *     itself, but every *side effect* (set attribute, create item, link, …) is
 *     delegated to a `WorkflowActionAdapter` passed in via the context. Stores
 *     are never imported here — `lib/services/item-mutation-service.ts` supplies
 *     a store-backed adapter. This keeps the engine deterministic and testable.
 *   - **Resilient.** A throwing action or workflow is caught and recorded as an
 *     error; one bad workflow can never crash the dispatch or the originating
 *     mutation.
 *   - **Bounded.** `runWorkflow` chains and cascading triggers are capped by
 *     `maxDepth` so workflows can't recurse forever.
 *
 * Condition evaluation reuses `evaluateCondition` from `lib/item-types.ts` so
 * authored rule conditions behave identically to item-type rules.
 */
import type {
  AttributeValue,
  ItemRuleCondition,
  WorkflowAction,
  WorkflowDefinition,
} from "@/lib/types"
import { evaluateCondition, type ItemLike } from "@/lib/item-types"

/** A normalized event the engine reacts to. Derived from `ItemMutationEvent`. */
export interface WorkflowEvent {
  /** Lifecycle / invocation kind. */
  trigger: "create" | "update" | "complete" | "manual" | "schedule"
  /** Affected item id (absent for a global manual/schedule trigger). */
  itemId?: string
  /** Previous snapshot (update/complete only). */
  before?: ItemLike
  /** Resulting snapshot — the item conditions/actions operate on. */
  after?: ItemLike
  /** Best-effort list of changed attribute ids (drives `attribute` triggers). */
  changedAttrs?: string[]
  /** Manual trigger: invoke this specific workflow id (optional). */
  workflowId?: string
}

/**
 * Store-backed side-effect surface. Every method is optional — a missing method
 * means that action is a no-op (still recorded in `effects`). The wiring service
 * provides a concrete adapter; tests can pass mocks/spies.
 */
export interface WorkflowActionAdapter {
  /** Read the current item by id (used to resolve attr values for actions). */
  getItem?: (id: string) => ItemLike | undefined
  setAttribute?: (itemId: string, field: string, value: AttributeValue) => void
  addTag?: (itemId: string, tag: string) => void
  addToNextActions?: (itemId: string) => void
  /** Create a new item in a list; returns the new item id (or undefined). */
  createItem?: (
    categoryId: string,
    defaults: Record<string, AttributeValue>,
    title?: string,
  ) => string | undefined
  link?: (sourceId: string, relation: string, targetId: string) => void
  setSchedule?: (itemId: string, date: AttributeValue, time?: AttributeValue) => void
  syncPlan?: () => void
  /** Pick `count` random item ids from a category. */
  pickRandom?: (fromCategoryId: string, count: number) => string[]
}

export interface WorkflowContext {
  /** Candidate workflow definitions (already loaded from the store). */
  workflows: WorkflowDefinition[]
  /** Side-effect adapter. Omit for a dry run (effects recorded, nothing applied). */
  adapter?: WorkflowActionAdapter
  /** Max chain depth (runWorkflow + cascades). Default 8. */
  maxDepth?: number
  /** Internal: current recursion depth (engine-managed). */
  depth?: number
}

export type WorkflowErrorKind = "throw" | "block" | "require" | "exception" | "depth"

export interface WorkflowError {
  workflowId: string
  kind: WorkflowErrorKind
  message: string
}

/** A recorded side effect (useful for tests + debugging/audit). */
export interface WorkflowEffect {
  workflowId: string
  action: WorkflowAction["kind"]
  itemId?: string
  detail?: Record<string, unknown>
}

export interface WorkflowRunResult {
  /** Ids of workflows that matched and ran (including chained). */
  ranWorkflows: string[]
  /** Validation / runtime errors collected during the run. */
  errors: WorkflowError[]
  /** True when a `throw`/`block`/failed-`require` surfaced — caller may abort. */
  blocked: boolean
  /** Ordered record of attempted side effects. */
  effects: WorkflowEffect[]
}

const DEFAULT_MAX_DEPTH = 8

/** Read an attribute (or top-level field) value from an item, attribute-first. */
function readField(item: ItemLike | undefined, field: string): AttributeValue | undefined {
  if (!item) return undefined
  if (item.attributes && field in item.attributes) return item.attributes[field]
  return item[field] as AttributeValue | undefined
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === "string") return value.trim() === ""
  if (Array.isArray(value)) return value.length === 0
  return false
}

/** Does this workflow's trigger match the incoming event? */
function triggerMatches(def: WorkflowDefinition, event: WorkflowEvent): boolean {
  const t = def.trigger
  switch (t.kind) {
    case "item":
      return (
        (event.trigger === "create" || event.trigger === "update" || event.trigger === "complete") &&
        t.event === event.trigger
      )
    case "attribute":
      // Fires on create/update when the watched attribute changed.
      return (
        (event.trigger === "update" || event.trigger === "create") &&
        (event.changedAttrs?.includes(t.attrId) ?? false)
      )
    case "manual":
      // Run when explicitly invoked (matching id) or when invoking all manuals.
      return event.trigger === "manual" && (!event.workflowId || event.workflowId === def.id)
    case "schedule":
      return event.trigger === "schedule"
    default:
      return false
  }
}

/** Does the workflow's `scope` admit this item? Missing scope ⇒ matches all. */
function scopeMatches(def: WorkflowDefinition, item: ItemLike | undefined): boolean {
  const scope = def.scope
  if (!scope) return true
  if (scope.listIds && scope.listIds.length > 0) {
    const cats = (item?.lists as string[] | undefined) ?? []
    if (!scope.listIds.some((c) => cats.includes(c))) return false
  }
  if (scope.itemTypeIds && scope.itemTypeIds.length > 0) {
    const type = (item?.type as string | undefined) ?? "task"
    if (!scope.itemTypeIds.includes(type)) return false
  }
  return true
}

function conditionsPass(item: ItemLike | undefined, conditions: ItemRuleCondition[] | undefined): boolean {
  if (!conditions || conditions.length === 0) return true
  const target: ItemLike = item ?? {}
  return conditions.every((c) => evaluateCondition(target, c))
}

/**
 * Dispatch all matching workflows for an event. Returns a structured result; it
 * never throws. Side effects are applied through `ctx.adapter` (when present).
 */
export function dispatchWorkflows(event: WorkflowEvent, ctx: WorkflowContext): WorkflowRunResult {
  const result: WorkflowRunResult = { ranWorkflows: [], errors: [], blocked: false, effects: [] }
  const maxDepth = ctx.maxDepth ?? DEFAULT_MAX_DEPTH
  const depth = ctx.depth ?? 0

  if (depth > maxDepth) {
    result.errors.push({
      workflowId: event.workflowId ?? "(chain)",
      kind: "depth",
      message: `Workflow chain exceeded max depth (${maxDepth}).`,
    })
    return result
  }

  const item = event.after ?? event.before ?? (event.itemId ? ctx.adapter?.getItem?.(event.itemId) : undefined)

  for (const def of ctx.workflows) {
    if (def.enabled === false) continue
    if (!triggerMatches(def, event)) continue
    if (!scopeMatches(def, item)) continue
    if (!conditionsPass(item, def.conditions)) continue

    try {
      runWorkflow(def, event, item, ctx, depth, result)
    } catch (err) {
      // A workflow that throws unexpectedly is contained, never fatal.
      result.errors.push({
        workflowId: def.id,
        kind: "exception",
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return result
}

function runWorkflow(
  def: WorkflowDefinition,
  event: WorkflowEvent,
  item: ItemLike | undefined,
  ctx: WorkflowContext,
  depth: number,
  result: WorkflowRunResult,
): void {
  result.ranWorkflows.push(def.id)
  const itemId = event.itemId ?? (item?.id as string | undefined)
  const adapter = ctx.adapter

  const record = (action: WorkflowAction["kind"], detail?: Record<string, unknown>) =>
    result.effects.push({ workflowId: def.id, action, itemId, detail })

  for (const action of def.actions) {
    try {
      switch (action.kind) {
        case "require": {
          if (isEmpty(readField(item, action.field))) {
            result.errors.push({
              workflowId: def.id,
              kind: "require",
              message: action.message ?? `${action.field} is required.`,
            })
            result.blocked = true
            return // stop this workflow on a failed requirement
          }
          break
        }
        case "block": {
          result.errors.push({ workflowId: def.id, kind: "block", message: action.message })
          result.blocked = true
          return
        }
        case "throw": {
          result.errors.push({ workflowId: def.id, kind: "throw", message: action.message })
          result.blocked = true
          return
        }
        case "setDefault": {
          if (isEmpty(readField(item, action.field))) {
            if (itemId) adapter?.setAttribute?.(itemId, action.field, action.value)
            applyLocal(item, action.field, action.value)
            record("setDefault", { field: action.field, value: action.value })
          }
          break
        }
        case "setAttribute": {
          if (itemId) adapter?.setAttribute?.(itemId, action.field, action.value)
          applyLocal(item, action.field, action.value)
          record("setAttribute", { field: action.field, value: action.value })
          break
        }
        case "addTag": {
          if (itemId) adapter?.addTag?.(itemId, action.tag)
          record("addTag", { tag: action.tag })
          break
        }
        case "addToNextActions": {
          if (itemId) adapter?.addToNextActions?.(itemId)
          record("addToNextActions")
          break
        }
        case "createItem": {
          const defaults = { ...(action.defaults ?? {}) }
          const title = action.titleFrom ? toText(readField(item, action.titleFrom)) : undefined
          const newId = adapter?.createItem?.(action.categoryId, defaults, title)
          record("createItem", { categoryId: action.categoryId, newId })
          break
        }
        case "link": {
          const targetId = action.targetId ?? (action.targetFromAttr ? toText(readField(item, action.targetFromAttr)) : undefined)
          if (itemId && targetId) adapter?.link?.(itemId, action.relation, targetId)
          record("link", { relation: action.relation, targetId })
          break
        }
        case "setSchedule": {
          const date = readField(item, action.dateAttrId)
          const time = action.timeAttrId ? readField(item, action.timeAttrId) : undefined
          if (itemId) adapter?.setSchedule?.(itemId, date ?? null, time ?? undefined)
          record("setSchedule", { date, time })
          break
        }
        case "syncPlan": {
          adapter?.syncPlan?.()
          record("syncPlan")
          break
        }
        case "pickRandom": {
          const picked = adapter?.pickRandom?.(action.fromCategoryId, action.count) ?? []
          if (itemId) adapter?.setAttribute?.(itemId, action.storeInAttr, picked)
          applyLocal(item, action.storeInAttr, picked)
          record("pickRandom", { fromCategoryId: action.fromCategoryId, count: action.count, picked })
          break
        }
        case "runWorkflow": {
          record("runWorkflow", { workflowId: action.workflowId })
          const sub = dispatchWorkflows(
            {
              trigger: "manual",
              workflowId: action.workflowId,
              itemId,
              after: item,
            },
            { ...ctx, depth: depth + 1 },
          )
          mergeResult(result, sub)
          if (sub.blocked) result.blocked = true
          break
        }
        default: {
          // Exhaustiveness guard: unknown action kinds are ignored safely.
          const _never: never = action
          void _never
        }
      }
    } catch (err) {
      // Resilience: a single failing action doesn't abort the whole workflow.
      result.errors.push({
        workflowId: def.id,
        kind: "exception",
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

/** Apply a value to the in-memory working item so later actions/conditions see it. */
function applyLocal(item: ItemLike | undefined, field: string, value: AttributeValue): void {
  if (!item) return
  if (item.attributes && field in item.attributes) {
    item.attributes[field] = value
  } else if (field in item) {
    item[field] = value
  } else {
    item.attributes = { ...(item.attributes ?? {}), [field]: value }
  }
}

function toText(value: AttributeValue | undefined): string | undefined {
  if (value == null) return undefined
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return undefined
}

function mergeResult(into: WorkflowRunResult, from: WorkflowRunResult): void {
  into.ranWorkflows.push(...from.ranWorkflows)
  into.errors.push(...from.errors)
  into.effects.push(...from.effects)
}

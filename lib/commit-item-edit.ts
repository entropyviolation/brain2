/**
 * lib/commit-item-edit.ts — Write door for new code
 *
 * `commitItemEdit` validates through `taskRepository`, persists with that
 * repository's existing `updateTask` path, and lets that path emit
 * `dispatchItemMutation` with the same open patch. History lines are written
 * by that `updateTask` (one line per changed field). ItemDetail save uses
 * `commitItemDraft` (patch from two snapshots) instead of `recordItemWrite`
 * + `updateTask`.
 *
 * It does not call `applyLinkedEffects`. A rename stays a rename: habit sync,
 * sleep, work-session stop, points, and undo run only when a caller asks for
 * them. Ingest finish sites call `applyLinkedEffects`; create stays on
 * `useTaskStore`.
 */
import { settleStepPoints } from "@/lib/step-points"
import { taskRepository } from "@/lib/data/task-repository"
import { type ItemActivityOrder } from "@/lib/item-activity"
import { syncTrackedHabits } from "@/lib/habit-tracking-sync"
import { syncSleepNight } from "@/lib/sleep-sync"
import { stopWorkingOnOperation } from "@/lib/operation-work-session"
import { serializeSnapshot } from "@/lib/unsaved-changes"
import type { AttributeValue, ItemRecord, Task } from "@/lib/types"

export type { ItemActivityOrder }

/** Known item fields and unknown attribute keys. Not a list of mutation kinds. */
export type ItemEditPatch = Record<string, unknown>

/**
 * Runtime mirror of `keyof Task`. Unknown patch keys fall through to
 * `attributes`. The checker fails if `Task` gains or loses a field.
 */
const TASK_FIELDS: Record<keyof Task, true> = {
  id: true,
  type: true,
  title: true,
  createdAt: true,
  attachedDate: true,
  tags: true,
  links: true,
  dismissedLinkSuggestions: true,
  attributes: true,
  itemAttributeDefinitions: true,
  textListIds: true,
  attributeLabels: true,
  hiddenDetailPanels: true,
  shownDetailPanels: true,
  hiddenShellTabs: true,
  hiddenAttributeIds: true,
  body: true,
  description: true,
  stage: true,
  monkeyBrain: true,
  captureOrigin: true,
  completed: true,
  completedDate: true,
  startedAt: true,
  estimates: true,
  timeRough: true,
  status: true,
  missedAt: true,
  missReason: true,
  lists: true,
  listMembershipExclusions: true,
  estimatedDuration: true,
  estimateLog: true,
  actualDuration: true,
  durationCertainty: true,
  startCertainty: true,
  cognitiveLoad: true,
  urgency: true,
  importance: true,
  dependencies: true,
  context: true,
  entropy: true,
  rewardValue: true,
  allowPartialCompletion: true,
  minimumChunkSize: true,
  scheduleable: true,
  deadline: true,
  why: true,
  consequences: true,
  scheduledDate: true,
  scheduledTime: true,
  reminder: true,
  scheduledWeek: true,
  scheduledMonth: true,
  scheduledYear: true,
  autoPush: true,
  schedulePlacements: true,
  daysPushed: true,
  weeksPushed: true,
  monthsPushed: true,
  hiddenFromTodo: true,
  todoMarks: true,
  loggedAction: true,
  notes: true,
  parentTaskId: true,
  pointsOverride: true,
  stepPoints: true,
  resourceIds: true,
  awaitIds: true,
  tierReached: true,
  subtasks: true,
  isSummary: true,
  parallelGroup: true,
  riskFlag: true,
  pertEstimate: true,
  definitionOfDone: true,
  completionReview: true,
  dayRatings: true,
  resistanceReadings: true,
  completedChunks: true,
  taskDescription: true,
  schedulingConstraints: true,
  isRepeated: true,
  repeatSettings: true,
  icon: true,
  timeLogs: true,
  contributesToObjectiveIds: true,
  contributesToGoalIds: true,
  sentAtByList: true,
  personPipelines: true,
  personProfile: true,
  noteLog: true,
  resources: true,
  savedLink: true,
  completedCertainty: true,
  timeNegligible: true,
  listRuleAddedIds: true,
  listAddedAt: true,
  penLinks: true,
  stepOf: true,
  priorityLog: true,
  priorityRefreshedOn: true,
}

const ORDERS = new Set<ItemActivityOrder>(["observed", "recorded", "derived", "inferred"])

function isTaskField(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(TASK_FIELDS, key)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)
}

function namedOrder(order: ItemActivityOrder | undefined): ItemActivityOrder | undefined {
  if (order && ORDERS.has(order)) return order
  return undefined
}

/** Place known fields on the item. Anything else joins `attributes`. */
export function applyItemEditPatch(item: Task, patch: ItemEditPatch): Task {
  const next: Task = { ...item }
  let attributes = item.attributes ? { ...item.attributes } : undefined
  let attributesDirty = false

  const bag = (): Record<string, AttributeValue> => {
    if (!attributes) attributes = {}
    attributesDirty = true
    return attributes
  }

  for (const [key, value] of Object.entries(patch)) {
    if (key === "id") continue
    if (key === "attributes") {
      if (!isPlainRecord(value)) continue
      const target = bag()
      for (const [attrKey, attrValue] of Object.entries(value)) {
        target[attrKey] = attrValue as AttributeValue
      }
      continue
    }
    if (isTaskField(key)) {
      ;(next as unknown as Record<string, unknown>)[key] = value
      continue
    }
    bag()[key] = value as AttributeValue
  }

  if (attributesDirty) next.attributes = attributes
  next.id = item.id
  return next
}

/**
 * Validate, persist, and log one item edit.
 *
 * The repository update is what calls `dispatchItemMutation`. Passing `patch`
 * puts that same bag on the event so listeners see the keys, not a sentence.
 * A second dispatch would run workflows twice, so this function does not emit
 * another event. History lines come from `updateTask`, one per field that
 * actually changed, with this call's source and order.
 */
/**
 * Patch of keys that differ between two item snapshots. Used by ItemDetail
 * save so the draft becomes one `commitItemEdit` instead of
 * `recordItemWrite` + `updateTask`.
 */
export function itemEditPatchBetween(before: Task, after: Task): ItemEditPatch {
  const patch: ItemEditPatch = {}
  const beforeRec = before as unknown as Record<string, unknown>
  const afterRec = after as unknown as Record<string, unknown>
  const keys = new Set([...Object.keys(beforeRec), ...Object.keys(afterRec)])
  for (const key of keys) {
    if (key === "id") continue
    if (serializeSnapshot(beforeRec[key]) === serializeSnapshot(afterRec[key])) continue
    patch[key] = afterRec[key]
  }
  return patch
}

export function commitItemEdit(
  itemId: string,
  patch: ItemEditPatch,
  source: string,
  order?: ItemActivityOrder,
): ItemRecord {
  const before = taskRepository.getById(itemId)
  if (!before) throw new Error(`commitItemEdit: no item ${itemId}`)

  const merged = applyItemEditPatch(before, patch)
  const tagged = namedOrder(order)
  taskRepository.update(merged, patch, tagged ? { source, order: tagged } : { source })
  // Phase 12: a step ticked or unticked in item detail pays or takes back its step points.
  if ("subtasks" in patch) settleStepPoints({ id: before.id, description: before.description, stepPoints: merged.stepPoints }, before.subtasks, merged.subtasks)

  return taskRepository.getById(itemId) ?? merged
}

/**
 * Persist a full draft through `commitItemEdit`. No-op when nothing changed.
 * Returns the stored item (or `after` when the patch was empty).
 */
export function commitItemDraft(before: Task, after: Task, source: string, order?: ItemActivityOrder): ItemRecord {
  const patch = itemEditPatchBetween(before, after)
  if (Object.keys(patch).length === 0) return after
  return commitItemEdit(after.id, patch, source, order)
}

export type LinkedEffectsRequest =
  | { kind: "habit"; dateKeys?: string[] }
  | { kind: "night"; date: string; now?: Date }
  | { kind: "session"; now?: Date }

/**
 * Opt-in cross-store ripple. Each kind calls the function that already owns
 * that finish. Nothing here is new work, and `commitItemEdit` does not call it.
 *
 * - `habit` → `syncTrackedHabits`
 * - `night` → `syncSleepNight` (tracking, done row, habit sync)
 * - `session` → `stopWorkingOnOperation` (undo, done rows, habit sync, points)
 */
export function applyLinkedEffects(request: LinkedEffectsRequest): void {
  switch (request.kind) {
    case "habit":
      syncTrackedHabits(request.dateKeys)
      return
    case "night":
      syncSleepNight(request.date, request.now)
      return
    case "session":
      stopWorkingOnOperation(request.now)
      return
  }
}

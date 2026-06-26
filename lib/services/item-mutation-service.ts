/**
 * lib/services/item-mutation-service.ts — Workflow engine wiring (Workstream B)
 *
 * Connects the dependency-free dispatch seam in `lib/workflow-hooks.ts` (which
 * `lib/task-store.ts` already calls on create/update/complete — we do NOT edit
 * the store) to the workflow engine + store:
 *
 *   task-store → dispatchItemMutation → [this dispatcher] → dispatchWorkflows
 *
 * `initWorkflowEngine()` registers a dispatcher that loads the relevant
 * workflows from `useWorkflowsStore`, builds a store-backed action adapter over
 * `taskRepository`, and forwards a normalized event into the engine. It is
 * **idempotent** (safe to call repeatedly) and provides `teardownWorkflowEngine`
 * for tests. The coordinator wires `initWorkflowEngine()` into app startup in
 * the integration phase — it is intentionally NOT auto-invoked here.
 */
import type { Task, WorkflowDefinition } from "@/lib/types"
import {
  registerItemMutationDispatcher,
  type ItemMutationEvent,
} from "@/lib/workflow-hooks"
import {
  dispatchWorkflows,
  type WorkflowActionAdapter,
  type WorkflowEvent,
  type WorkflowRunResult,
} from "@/lib/workflow-engine"
import type { ItemLike } from "@/lib/item-types"
import { taskRepository, type TaskRepository } from "@/lib/data/task-repository"
import { useWorkflowsStore } from "@/lib/workflows-store"

export interface InitWorkflowEngineOptions {
  /** Override the action adapter (tests). Defaults to a `taskRepository` adapter. */
  adapter?: WorkflowActionAdapter
  /** Override workflow selection (tests). Defaults to the workflows store by scope. */
  getWorkflows?: (event: ItemMutationEvent) => WorkflowDefinition[]
  /** Max engine chain depth. Default 8. */
  maxDepth?: number
  /** Repository used by the default adapter (tests can inject one). */
  repo?: TaskRepository
}

// Guard against re-entrant cascades: a workflow that mutates the item re-enters
// the store, which dispatches again. We bound the nesting so cascades terminate.
const REENTRANCY_CAP = 8
let installed = false
let dispatchDepth = 0

/** Build the store-backed side-effect adapter over the task repository. */
export function createTaskRepositoryAdapter(repo: TaskRepository = taskRepository): WorkflowActionAdapter {
  return {
    getItem: (id) => repo.getById(id) as unknown as ItemLike | undefined,

    setAttribute: (id, field, value) => {
      const t = repo.getById(id)
      if (!t) return
      // Mirror item-types `setField`: known top-level field vs flexible attribute.
      if (field !== "attributes" && field in t) {
        repo.update({ ...t, [field]: value } as Task)
      } else {
        repo.update({ ...t, attributes: { ...(t.attributes ?? {}), [field]: value } })
      }
    },

    addTag: (id, tag) => {
      const t = repo.getById(id)
      if (!t) return
      const tags = Array.isArray(t.tags) ? [...t.tags] : []
      if (!tags.includes(tag)) repo.update({ ...t, tags: [...tags, tag] })
    },

    addToNextActions: (id) => {
      const t = repo.getById(id)
      if (!t) return
      if (t.stage === "inbox") repo.update({ ...t, stage: "clarified" })
    },

    createItem: (categoryId, defaults, title) => {
      const id = `wf-item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      const label = title ?? "New item"
      const task: Task = {
        id,
        description: label,
        title: label,
        stage: "list",
        createdAt: new Date(),
        completed: false,
        lists: [categoryId],
        attributes: { ...defaults },
      }
      repo.add(task)
      return id
    },

    link: (sourceId, relation, targetId) => {
      repo.addLink(sourceId, relation, targetId)
    },

    setSchedule: (id, date, time) => {
      const t = repo.getById(id)
      if (!t) return
      const scheduledDate =
        date instanceof Date ? date : date != null && date !== "" ? new Date(String(date)) : undefined
      repo.update({
        ...t,
        scheduledDate: scheduledDate && !Number.isNaN(scheduledDate.getTime()) ? scheduledDate : t.scheduledDate,
        scheduledTime: time != null ? String(time) : t.scheduledTime,
      })
    },

    // Plan sync is a module-level concern owned elsewhere; expose a stub so the
    // action is a recorded no-op until the integration phase wires it through.
    syncPlan: () => {},

    pickRandom: (fromCategoryId, count) => {
      const pool = repo.find((t) => (t.lists ?? []).includes(fromCategoryId))
      // Fisher–Yates-ish shuffle is overkill here; a stable sample is sufficient.
      const shuffled = [...pool].sort(() => Math.random() - 0.5)
      return shuffled.slice(0, Math.max(0, count)).map((t) => t.id)
    },
  }
}

/** Default workflow selection: scope-filtered workflows from the store. */
function selectWorkflows(event: ItemMutationEvent): WorkflowDefinition[] {
  const item = event.after ?? event.before
  const listIds = (item?.lists as string[] | undefined) ?? []
  const itemTypeId = (item?.type as string | undefined) ?? "task"
  return useWorkflowsStore.getState().getByScope({ listIds, itemTypeId })
}

/** Map a store `ItemMutationEvent` onto the engine's `WorkflowEvent`. */
function toWorkflowEvent(event: ItemMutationEvent): WorkflowEvent {
  return {
    trigger: event.trigger,
    itemId: event.itemId,
    before: event.before as unknown as ItemLike | undefined,
    after: event.after as unknown as ItemLike | undefined,
    changedAttrs: event.changedAttrs,
  }
}

/**
 * Register the workflow-engine dispatcher. Idempotent: repeat calls are no-ops
 * until `teardownWorkflowEngine()` runs. Side-effecting actions are routed
 * through a `taskRepository`-backed adapter; a throwing workflow is contained by
 * the engine and never breaks the originating mutation.
 */
export function initWorkflowEngine(opts: InitWorkflowEngineOptions = {}): void {
  if (installed) return
  installed = true

  const adapter = opts.adapter ?? createTaskRepositoryAdapter(opts.repo)
  const maxDepth = opts.maxDepth ?? 8
  const getWorkflows = opts.getWorkflows ?? selectWorkflows

  registerItemMutationDispatcher((event) => {
    if (dispatchDepth >= REENTRANCY_CAP) return
    dispatchDepth += 1
    try {
      const workflows = getWorkflows(event)
      if (workflows.length === 0) return
      dispatchWorkflows(toWorkflowEvent(event), { workflows, adapter, maxDepth })
    } finally {
      dispatchDepth -= 1
    }
  })
}

/** Unregister the dispatcher and reset state (idempotent; used by tests). */
export function teardownWorkflowEngine(): void {
  registerItemMutationDispatcher(null)
  installed = false
  dispatchDepth = 0
}

/** True when the engine dispatcher is currently registered. */
export function isWorkflowEngineInstalled(): boolean {
  return installed
}

/**
 * Run a workflow manually (e.g. a "manual" trigger button). Loads workflows from
 * the store, builds the default adapter, and invokes the engine directly. Returns
 * the structured run result so the caller can surface errors / blocked state.
 */
export function runWorkflowManually(
  workflowId: string,
  itemId?: string,
  opts: InitWorkflowEngineOptions = {},
): WorkflowRunResult {
  const adapter = opts.adapter ?? createTaskRepositoryAdapter(opts.repo)
  const maxDepth = opts.maxDepth ?? 8
  const workflows = useWorkflowsStore.getState().workflows
  const item = itemId ? (taskRepository.getById(itemId) as unknown as ItemLike | undefined) : undefined
  return dispatchWorkflows(
    { trigger: "manual", workflowId, itemId, after: item },
    { workflows, adapter, maxDepth },
  )
}

/**
 * lib/workflows-store.ts — Persisted workflow definitions (Module platform)
 *
 * The source of truth for user-authored `WorkflowDefinition`s that the workflow
 * engine (`lib/workflow-engine.ts`) runs on item mutations / manual invocation.
 * Mirrors the Zustand + `persist` pattern of `lib/modules-store.ts`; persisted
 * to localStorage under `cogs-workflows-store` (target: MongoDB `workflows`).
 *
 * The store is intentionally a plain CRUD + query surface: it holds the
 * definitions and answers "which workflows apply to this list / type?" so the
 * wiring service can hand a filtered set to the engine. It never imports the
 * engine (keeps the dependency direction one-way and cycle-free).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { WorkflowDefinition } from "@/lib/types"

/** Query for selecting workflows relevant to an item / list / type. */
export interface WorkflowScopeQuery {
  categoryId?: string
  listIds?: string[]
  itemTypeId?: string
  moduleId?: string
}

interface WorkflowsState {
  workflows: WorkflowDefinition[]
  /** Add a definition, generating an id when one isn't supplied. Returns the id. */
  addWorkflow: (def: Omit<WorkflowDefinition, "id"> & { id?: string }) => string
  /** Add a fully-formed definition (idempotent on id; templates supply ids). */
  addWorkflowDefinition: (def: WorkflowDefinition) => void
  updateWorkflow: (id: string, patch: Partial<WorkflowDefinition>) => void
  removeWorkflow: (id: string) => void
  /** Toggle a workflow on/off without deleting it. */
  setEnabled: (id: string, enabled: boolean) => void
  getWorkflow: (id: string) => WorkflowDefinition | undefined
  /** All workflows belonging to a module. */
  getForModule: (moduleId: string) => WorkflowDefinition[]
  /**
   * Workflows whose `scope` admits the query. A workflow with no scope (or no
   * scoped dimension) matches everything; a scoped dimension must intersect the
   * query to match. `enabled === false` workflows are excluded.
   */
  getByScope: (query: WorkflowScopeQuery) => WorkflowDefinition[]
  /** Replace the whole set (import / restore). */
  setWorkflows: (workflows: WorkflowDefinition[]) => void
}

let counter = 0
function nextId(): string {
  counter += 1
  return `wf-${Date.now().toString(36)}-${counter.toString(36)}`
}

/** Does a workflow's scope admit the given query? Missing scope ⇒ matches all. */
export function workflowMatchesScope(def: WorkflowDefinition, query: WorkflowScopeQuery): boolean {
  if (query.moduleId && def.moduleId !== query.moduleId) return false
  const scope = def.scope
  if (!scope) return true

  if (scope.listIds && scope.listIds.length > 0) {
    const wanted = query.listIds ?? (query.categoryId ? [query.categoryId] : [])
    // No category in the query ⇒ don't exclude on category grounds.
    if (wanted.length > 0 && !scope.listIds.some((c) => wanted.includes(c))) return false
  }
  if (scope.itemTypeIds && scope.itemTypeIds.length > 0) {
    if (query.itemTypeId && !scope.itemTypeIds.includes(query.itemTypeId)) return false
  }
  return true
}

export const useWorkflowsStore = create<WorkflowsState>()(
  persist(
    (set, get) => ({
      workflows: [],

      addWorkflow: (def) => {
        const id = def.id ?? nextId()
        const full: WorkflowDefinition = { ...def, id }
        set((state) =>
          state.workflows.some((w) => w.id === id) ? state : { workflows: [...state.workflows, full] },
        )
        return id
      },

      addWorkflowDefinition: (def) =>
        set((state) =>
          state.workflows.some((w) => w.id === def.id) ? state : { workflows: [...state.workflows, def] },
        ),

      updateWorkflow: (id, patch) =>
        set((state) => ({
          workflows: state.workflows.map((w) => (w.id === id ? { ...w, ...patch, id: w.id } : w)),
        })),

      removeWorkflow: (id) => set((state) => ({ workflows: state.workflows.filter((w) => w.id !== id) })),

      setEnabled: (id, enabled) =>
        set((state) => ({
          workflows: state.workflows.map((w) => (w.id === id ? { ...w, enabled } : w)),
        })),

      getWorkflow: (id) => get().workflows.find((w) => w.id === id),

      getForModule: (moduleId) => get().workflows.filter((w) => w.moduleId === moduleId),

      getByScope: (query) =>
        get().workflows.filter((w) => w.enabled !== false && workflowMatchesScope(w, query)),

      setWorkflows: (workflows) => set(() => ({ workflows })),
    }),
    { name: "cogs-workflows-store", version: 1 },
  ),
)

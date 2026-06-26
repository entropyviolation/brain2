/**
 * lib/module-definitions.ts — Authored module definitions (Module platform)
 *
 * The source of truth for user-authored `ModuleDefinition`s — the serializable
 * "blueprint" of a module (bound lists + roles, presentation views, attached
 * workflows, plan-sync, print toggle). A definition is *design-time* data; it
 * gets **instantiated** into a runnable `ModuleInstance` (in `lib/modules-store`)
 * the user actually opens, with its workflows registered in `lib/workflows-store`.
 *
 * Mirrors the Zustand + `persist` pattern of `lib/modules-store.ts`; persisted to
 * localStorage under `cogs-module-definitions` (target: MongoDB `moduleDefs`).
 *
 * Pure helpers (`createEmptyDefinition`, `definitionToInstance`,
 * `serializeModuleDefinition`, `parseModuleDefinition`) are unit-testable and
 * touch no stores. The side-effecting `instantiateDefinition` commits to the
 * task / modules / workflows stores and returns the new instance id.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ModuleDefinition, WorkflowDefinition } from "@/lib/types"
import { useModulesStore, type ModuleInstance } from "@/lib/modules-store"
import { useWorkflowsStore } from "@/lib/workflows-store"
import { useTaskStore } from "@/lib/task-store"

let counter = 0
function nextId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`
}

/** A blank, ready-to-edit module definition (no lists/views/workflows yet). */
export function createEmptyDefinition(name = "New module"): ModuleDefinition {
  return {
    id: nextId("moddef"),
    name,
    description: "",
    lists: [],
    views: [],
    workflows: [],
  }
}

/**
 * Map a design-time `ModuleDefinition` onto a runnable `ModuleInstance`. Pure:
 * generates a fresh instance id (unless one is supplied) and copies the views,
 * plan-sync, and print toggle across. Workflows are registered separately (they
 * live in `useWorkflowsStore`, not on the instance).
 */
export function definitionToInstance(def: ModuleDefinition, id?: string): ModuleInstance {
  return {
    id: id ?? nextId("mod"),
    type: "workspace",
    kind: "workspace",
    title: def.name,
    description: def.description,
    icon: def.icon,
    config: {},
    views: def.views.map((v) => ({ ...v })),
    enablePrint: def.enablePrint,
    planSync: def.planSync ? { ...def.planSync } : undefined,
    // Track provenance so a popped-out / re-opened instance can find its source.
    templateId: def.id,
  }
}

interface ModuleDefinitionsState {
  definitions: ModuleDefinition[]
  /** Add a definition, generating an id when one isn't supplied. Returns the id. */
  addDefinition: (def: Omit<ModuleDefinition, "id"> & { id?: string }) => string
  /** Add a fully-formed definition (idempotent on id; imports supply ids). */
  addModuleDefinition: (def: ModuleDefinition) => void
  updateDefinition: (id: string, patch: Partial<ModuleDefinition>) => void
  removeDefinition: (id: string) => void
  getDefinition: (id: string) => ModuleDefinition | undefined
  /** Replace the whole set (import / restore). */
  setDefinitions: (definitions: ModuleDefinition[]) => void
}

export const useModuleDefinitionsStore = create<ModuleDefinitionsState>()(
  persist(
    (set, get) => ({
      definitions: [],

      addDefinition: (def) => {
        const id = def.id ?? nextId("moddef")
        const full: ModuleDefinition = { ...def, id }
        set((state) =>
          state.definitions.some((d) => d.id === id)
            ? state
            : { definitions: [...state.definitions, full] },
        )
        return id
      },

      addModuleDefinition: (def) =>
        set((state) =>
          state.definitions.some((d) => d.id === def.id)
            ? state
            : { definitions: [...state.definitions, def] },
        ),

      updateDefinition: (id, patch) =>
        set((state) => ({
          definitions: state.definitions.map((d) => (d.id === id ? { ...d, ...patch, id: d.id } : d)),
        })),

      removeDefinition: (id) =>
        set((state) => ({ definitions: state.definitions.filter((d) => d.id !== id) })),

      getDefinition: (id) => get().definitions.find((d) => d.id === id),

      setDefinitions: (definitions) => set(() => ({ definitions })),
    }),
    { name: "cogs-module-definitions", version: 1 },
  ),
)

/**
 * Instantiate a stored definition into a runnable module:
 *   1. layer each binding's `attributeExtensions` onto the bound list's schema
 *      (additive, deduped by attribute id) so module-specific fields are real;
 *   2. add a `ModuleInstance` (its workspace) to `useModulesStore`;
 *   3. register fresh copies of the definition's workflows in `useWorkflowsStore`,
 *      scoped to the new instance (`moduleId`) with newly-minted ids so repeated
 *      instantiations don't collide.
 * Returns the new instance id, or `undefined` when the definition is unknown.
 */
export function instantiateDefinition(definitionId: string): string | undefined {
  const def = useModuleDefinitionsStore.getState().getDefinition(definitionId)
  if (!def) return undefined

  const instance = definitionToInstance(def)

  // 1. Apply per-binding attribute extensions to the bound categories.
  const taskStore = useTaskStore.getState()
  for (const binding of def.lists) {
    const additions = binding.attributeExtensions ?? []
    if (additions.length === 0) continue
    const cat = taskStore.lists.find((c) => c.id === binding.categoryId)
    if (!cat) continue
    const existing = cat.itemAttributes ?? []
    const existingIds = new Set(existing.map((a) => a.id))
    const fresh = additions.filter((a) => !existingIds.has(a.id))
    if (fresh.length > 0) {
      taskStore.updateList({ ...cat, itemAttributes: [...existing, ...fresh] })
    }
  }

  // 2. Commit the workspace instance.
  useModulesStore.getState().addModuleInstance(instance)

  // 3. Register the attached workflows against the new instance.
  const wfStore = useWorkflowsStore.getState()
  for (const wf of def.workflows) {
    const copy: WorkflowDefinition = { ...wf, id: nextId("wf"), moduleId: instance.id }
    wfStore.addWorkflowDefinition(copy)
  }

  return instance.id
}

// ---------------------------------------------------------------------------
// JSON export / import (round-trippable; no functions in stored JSON)
// ---------------------------------------------------------------------------

/** Serialize a single module definition to a pretty JSON string. */
export function serializeModuleDefinition(def: ModuleDefinition): string {
  return JSON.stringify(def, null, 2)
}

/**
 * Parse a module-definition JSON string back into a `ModuleDefinition`. Accepts
 * either a bare definition or an `{ definition }` envelope (see `lib/data/backup`).
 * Fills in the array fields defensively so a partial blob still instantiates.
 */
export function parseModuleDefinition(json: string): ModuleDefinition {
  const data = JSON.parse(json)
  const raw = (data && typeof data === "object" && "definition" in data ? data.definition : data) as
    | Partial<ModuleDefinition>
    | undefined
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || typeof raw.name !== "string") {
    throw new Error("Invalid module definition JSON")
  }
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    icon: raw.icon,
    lists: Array.isArray(raw.lists) ? raw.lists : [],
    views: Array.isArray(raw.views) ? raw.views : [],
    workflows: Array.isArray(raw.workflows) ? raw.workflows : [],
    planSync: raw.planSync,
    enablePrint: raw.enablePrint,
  }
}

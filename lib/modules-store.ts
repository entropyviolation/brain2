/**
 * lib/modules-store.ts — User-composed "Modules" dashboard
 *
 * Persists the user's pinned modules: small, configurable widgets that draw on
 * data from across the app (especially Lists) and present it in a chosen way —
 * a reading-list explorer, a writing-assignment generator, a cleaning picker, a
 * list summary, or an analytics stat. Each module is `{ id, type, title,
 * config }`; the Modules panel renders them and lets the user add/remove/
 * reconfigure.
 *
 * Storage: localStorage today; target MongoDB `modules` collection (§3).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type ModuleType =
  | "list-explorer"
  | "writing-prompt"
  | "list-summary"
  | "analytics-stat"
  | "random-task"
  | "rules"

// A single cause→effect rule evaluated against an item's attribute value.
export type RuleOperator = ">" | ">=" | "<" | "<=" | "=" | "contains" | "is empty" | "is set"

export interface AttrRule {
  id: string
  attrId: string // AttributeDefinition.id to test
  op: RuleOperator
  value?: string // comparison value (number/text as string)
  label: string // shown when the rule matches (the "effect")
  color: string // badge color
}

export interface ModuleConfig {
  categoryId?: string // for list-explorer / list-summary / random-task / writing-prompt / rules source
  stat?: string // for analytics-stat
  framing?: string // optional verb/label, e.g. "Clean", "Read"
  pickCount?: number // list-explorer: how many random items to surface (default 1)
  rules?: AttrRule[] // for the rules module
}

export interface ModuleInstance {
  id: string
  type: ModuleType
  title: string
  config: ModuleConfig
}

interface ModulesState {
  modules: ModuleInstance[]
  addModule: (m: Omit<ModuleInstance, "id">) => void
  removeModule: (id: string) => void
  updateModule: (id: string, patch: Partial<ModuleInstance>) => void
}

const defaultModules = (): ModuleInstance[] => [
  { id: "mod-points", type: "analytics-stat", title: "Points this week", config: { stat: "points-week" } },
  { id: "mod-write", type: "writing-prompt", title: "Writing Assignment Generator", config: {} },
  { id: "mod-random", type: "random-task", title: "What should I do now?", config: {} },
]

export const useModulesStore = create<ModulesState>()(
  persist(
    (set) => ({
      modules: defaultModules(),
      addModule: (m) => set((state) => ({ modules: [...state.modules, { ...m, id: `mod-${Date.now()}` }] })),
      removeModule: (id) => set((state) => ({ modules: state.modules.filter((m) => m.id !== id) })),
      updateModule: (id, patch) =>
        set((state) => ({ modules: state.modules.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
    }),
    { name: "cogs-modules-store", version: 1 },
  ),
)

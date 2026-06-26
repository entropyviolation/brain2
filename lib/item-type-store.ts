/**
 * lib/item-type-store.ts — Registry of item types (spec §5)
 *
 * Holds the built-in types (e.g. "task") plus any user-defined types ("Book",
 * "Friend", …). This is the second-brain extensibility seam: a type is a named
 * category of items with attributes, rules, and behaviors (`ItemTypeDefinition`).
 *
 * Built-in types are always present (re-seeded on load) and cannot be deleted;
 * user types are persisted. Storage: localStorage today; target MongoDB
 * `itemTypes` collection (docs/SPEC_MAPPING.md §3).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ItemTypeDefinition } from "@/lib/types"
import { getBuiltinItemTypes, getItemType } from "@/lib/item-types"
import { withSecondBrainTypes } from "@/lib/second-brain-types"
import { withBookType } from "@/lib/book-types"
import { withFlightType } from "@/lib/flight-types"

/** Merge built-ins with user types; built-ins win on id and come first. */
function withBuiltins(userTypes: ItemTypeDefinition[]): ItemTypeDefinition[] {
  const builtins = getBuiltinItemTypes()
  const builtinIds = new Set(builtins.map((t) => t.id))
  return [...builtins, ...userTypes.filter((t) => !builtinIds.has(t.id))]
}

interface ItemTypeState {
  /** All types (built-in + user). Always includes the built-ins. */
  types: ItemTypeDefinition[]
  addType: (type: ItemTypeDefinition) => void
  updateType: (type: ItemTypeDefinition) => void
  deleteType: (id: string) => void
  getType: (id: string | undefined) => ItemTypeDefinition
  setTypes: (types: ItemTypeDefinition[]) => void
  resetTypes: () => void
  /** "Set up second brain": register the Source + Belief types (idempotent). */
  seedSecondBrainTypes: () => void
  /** Ensure the built-in Book type is registered (idempotent; additive). */
  seedBookType: () => void
  /** Ensure the built-in Flight type is registered (idempotent; additive). */
  seedFlightType: () => void
}

export const useItemTypeStore = create<ItemTypeState>()(
  persist(
    (set, get) => ({
      types: getBuiltinItemTypes(),

      addType: (type) =>
        set((state) => {
          if (state.types.some((t) => t.id === type.id)) return state
          return { types: [...state.types, type] }
        }),

      updateType: (type) =>
        set((state) => ({
          types: state.types.map((t) => (t.id === type.id ? { ...t, ...type } : t)),
        })),

      deleteType: (id) =>
        set((state) => {
          const target = state.types.find((t) => t.id === id)
          if (!target || target.builtin) return state
          return { types: state.types.filter((t) => t.id !== id) }
        }),

      getType: (id) => getItemType(get().types, id),

      setTypes: (types) => set({ types: withBuiltins(types) }),
      resetTypes: () => set({ types: getBuiltinItemTypes() }),

      // Seed the second-brain Source + Belief types if not already present.
      // Additive and idempotent: existing types (built-in or user) are kept.
      seedSecondBrainTypes: () =>
        set((state) => {
          const next = withSecondBrainTypes(state.types)
          return next === state.types ? state : { types: next }
        }),

      // Book/Flight ship as built-ins (re-seeded by `withBuiltins`), so these
      // are normally no-ops; exposed as a stable, idempotent API for downstream
      // features that want to guarantee the type's presence explicitly.
      seedBookType: () =>
        set((state) => {
          const next = withBookType(state.types)
          return next === state.types ? state : { types: next }
        }),

      seedFlightType: () =>
        set((state) => {
          const next = withFlightType(state.types)
          return next === state.types ? state : { types: next }
        }),
    }),
    {
      name: "cogs-item-types-store",
      version: 1,
      // Re-seed built-ins on hydrate so they survive even if persisted state
      // predates a new built-in type or had them stripped.
      onRehydrateStorage: () => (state) => {
        if (state) state.types = withBuiltins(state.types ?? [])
      },
    },
  ),
)

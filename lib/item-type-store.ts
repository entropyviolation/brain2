/**
 * lib/item-type-store.ts — Registry of item types (spec §5)
 *
 * Holds the built-in types (e.g. "task") plus any user-defined types ("Book",
 * "Friend", …). This is the second-brain extensibility seam: a type is a named
 * category of items with attributes, rules, and behaviors (`ItemTypeDefinition`).
 *
 * Catalog types (Book, Furniture, …) are seeded once; user edits persist.
 * System types (Task, Item, Note, Operation) are always re-seeded from code
 * and cannot be deleted. Persist v2 migrates older snapshots through
 * `mergeTypeRegistry` (Zustand requires `migrate` when `version` changes).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import type { ItemTypeDefinition } from "@/lib/types"
import { getBuiltinItemTypes, getItemType, mergeTypeRegistry } from "@/lib/item-types"
import { withSecondBrainTypes } from "@/lib/second-brain-types"
import { withBookType } from "@/lib/book-types"
import { withFlightType } from "@/lib/flight-types"

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

/** Persist bump: system types always re-seed; catalog + user types keep stored edits. */
export const ITEM_TYPE_STORE_PERSIST_VERSION = 2

/** v0/v1 snapshots had no migrate; without this Zustand drops the blob. */
export function migrateItemTypeState(persisted: unknown, _version: number): Pick<ItemTypeState, "types"> {
  const prev = persisted && typeof persisted === "object" ? (persisted as { types?: unknown }) : {}
  const types = Array.isArray(prev.types) ? (prev.types as ItemTypeDefinition[]) : []
  return { types: mergeTypeRegistry(types) }
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

      setTypes: (types) => set({ types: mergeTypeRegistry(types) }),
      resetTypes: () => set({ types: getBuiltinItemTypes() }),

      // Seed the second-brain Source + Belief types if not already present.
      // Additive and idempotent: existing types (built-in or user) are kept.
      seedSecondBrainTypes: () =>
        set((state) => {
          const next = withSecondBrainTypes(state.types)
          return next === state.types ? state : { types: next }
        }),

      // Catalog Book/Flight: insert the seed only if missing (edits persist).
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
      name: persistKey("item-types-store"),
      version: ITEM_TYPE_STORE_PERSIST_VERSION,
      storage: createCogsJSONStorage(),
      migrate: migrateItemTypeState,
      // System types always come from code; catalog types keep persisted edits.
      onRehydrateStorage: () => (state) => {
        if (state) state.types = mergeTypeRegistry(state.types ?? [])
      },
    },
  ),
)

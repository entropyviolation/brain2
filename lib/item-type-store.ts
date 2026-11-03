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
import { withSecondBrainTypes, withSourceIdentifierAttributes } from "@/lib/second-brain-types"
import { withBookType } from "@/lib/book-types"
import { withFlightType } from "@/lib/flight-types"
import { withFilmType } from "@/lib/film-types"
import type { RelationDef } from "@/lib/links"
import { cleanRules, type RelationRule } from "@/lib/graph/relation-rules"
import { pickOverridable, registerCustomRelations, registerRelationOverrides } from "@/lib/relation-registry"

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
  /** Ensure the catalog Film type is registered (idempotent; additive). */
  seedFilmType: () => void
  /** Custom link relations (vocabulary, not item data: writes are immediate). */
  relations: RelationDef[]
  /** Add new defs; ids already present are skipped. */
  addRelations: (defs: RelationDef[]) => void
  updateRelation: (def: RelationDef) => void
  /** Archive instead of delete so old links keep a label. */
  archiveRelation: (id: string) => void
  /**
   * Person overrides on any relation, built-ins included: parent, traits,
   * reciprocity, phrases, description only (`OVERRIDABLE_RELATION_KEYS`).
   */
  relationOverrides: Record<string, Partial<RelationDef>>
  /** Merge a patch into one relation's override. Non-overridable keys are dropped. */
  setRelationOverride: (id: string, patch: Partial<RelationDef>) => void
  clearRelationOverride: (id: string) => void
  /** Chain rules (L3.1). Derive on read; never write links. */
  relationRules: RelationRule[]
  addRule: (rule: RelationRule) => void
  updateRule: (rule: RelationRule) => void
  toggleRule: (id: string) => void
  removeRule: (id: string) => void
  /** Read `id` as `targetId` (L2.3). Archives it; links keep their id. */
  mergeRelation: (id: string, targetId: string) => void
  /** Undo a merge. */
  unmergeRelation: (id: string) => void
}

/**
 * Persist bump: system types always re-seed; catalog + user types keep stored
 * edits. v3 (LINKS_REDESIGN L1.4) adds `relationOverrides` and carries
 * `relations` through the migrate.
 */
export const ITEM_TYPE_STORE_PERSIST_VERSION = 3

type MigratedItemTypeState = Pick<ItemTypeState, "types" | "relations" | "relationOverrides"> & {
  relationRules?: RelationRule[]
}

/**
 * v0/v1 snapshots had no migrate; without this Zustand drops the blob. Every
 * bump must carry the vocabulary, or a migrate silently drops it: other
 * persisted fields are kept as they are.
 */
export function migrateItemTypeState(persisted: unknown, _version: number): MigratedItemTypeState {
  const prev = persisted && typeof persisted === "object" ? (persisted as Record<string, unknown>) : {}
  const types = Array.isArray(prev.types) ? (prev.types as ItemTypeDefinition[]) : []
  const out: MigratedItemTypeState = {
    ...prev,
    types: mergeTypeRegistry(types),
    relations: cleanRelations(prev.relations),
    relationOverrides: cleanRelationOverrides(prev.relationOverrides),
  }
  const rules = cleanRelationRules(prev.relationRules)
  if (rules) out.relationRules = rules
  else delete out.relationRules
  return out
}

function cleanRelations(value: unknown): RelationDef[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (r): r is RelationDef =>
      !!r && typeof r === "object" && typeof r.id === "string" && typeof r.label === "string" && typeof r.inverse === "string",
  )
}

function cleanRelationOverrides(value: unknown): Record<string, Partial<RelationDef>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const out: Record<string, Partial<RelationDef>> = {}
  for (const [id, patch] of Object.entries(value as Record<string, unknown>)) {
    const clean = pickOverridable(patch as Partial<RelationDef>)
    if (Object.keys(clean).length) out[id] = clean
  }
  return out
}

function cleanRelationRules(value: unknown): RelationRule[] | undefined {
  if (!Array.isArray(value)) return undefined
  return cleanRules(value)
}

export const useItemTypeStore = create<ItemTypeState>()(
  persist(
    (set, get) => ({
      types: getBuiltinItemTypes(),
      relations: [],
      relationOverrides: {},
      relationRules: [],

      addRule: (rule) => set((state) => (state.relationRules.some((r) => r.id === rule.id) ? state : { relationRules: [...state.relationRules, rule] })),
      updateRule: (rule) => set((state) => ({ relationRules: state.relationRules.map((r) => (r.id === rule.id ? rule : r)) })),
      toggleRule: (id) => set((state) => ({ relationRules: state.relationRules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) })),
      removeRule: (id) => set((state) => ({ relationRules: state.relationRules.filter((r) => r.id !== id) })),

      mergeRelation: (id, targetId) =>
        set((state) => {
          if (id === targetId || !state.relations.some((r) => r.id === id)) return state
          return { relations: state.relations.map((r) => (r.id === id ? { ...r, aliasOf: targetId, archived: true as const } : r)) }
        }),
      unmergeRelation: (id) =>
        set((state) => ({
          relations: state.relations.map((r) => {
            if (r.id !== id) return r
            const { aliasOf: _a, archived: _b, ...rest } = r
            return rest
          }),
        })),

      setRelationOverride: (id, patch) =>
        set((state) => {
          const merged = pickOverridable({ ...state.relationOverrides[id], ...patch })
          const next = { ...state.relationOverrides }
          if (Object.keys(merged).length) next[id] = merged
          else delete next[id]
          return { relationOverrides: next }
        }),

      clearRelationOverride: (id) =>
        set((state) => {
          if (!(id in state.relationOverrides)) return state
          const next = { ...state.relationOverrides }
          delete next[id]
          return { relationOverrides: next }
        }),

      addRelations: (defs) =>
        set((state) => {
          const have = new Set(state.relations.map((r) => r.id))
          const fresh = defs.filter((d) => !have.has(d.id)).map((d) => ({ ...d, custom: true as const }))
          return fresh.length ? { relations: [...state.relations, ...fresh] } : state
        }),

      updateRelation: (def) =>
        set((state) => ({
          relations: state.relations.map((r) => (r.id === def.id ? { ...r, ...def, custom: true as const } : r)),
        })),

      archiveRelation: (id) =>
        set((state) => ({
          relations: state.relations.map((r) => (r.id === id ? { ...r, archived: true as const } : r)),
        })),

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

      seedFilmType: () =>
        set((state) => {
          const next = withFilmType(state.types)
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
        if (state) {
          state.types = withSourceIdentifierAttributes(mergeTypeRegistry(state.types ?? []))
          state.relations = cleanRelations(state.relations)
          state.relationOverrides = cleanRelationOverrides(state.relationOverrides)
          state.relationRules = cleanRules(state.relationRules)
          registerCustomRelations(state.relations)
          registerRelationOverrides(state.relationOverrides)
        }
      },
    },
  ),
)

// Keep the pure registry in step with every store change (and backup restore).
useItemTypeStore.subscribe((state, prev) => {
  if (state.relations !== prev.relations) registerCustomRelations(state.relations ?? [])
  if (state.relationOverrides !== prev.relationOverrides) registerRelationOverrides(state.relationOverrides ?? {})
})

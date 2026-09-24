/**
 * lib/vault-coverage.test.ts — Every vault is accounted for
 *
 * The 2026-09-21 losses (the friend gallery emptied, Goals and Reviews open to
 * a thin dump) all had the same shape: a store shipped, nobody added it to the
 * shrink guard, and `vaultRecordCount` silently returned `null` for it. Silence
 * is the bug. These tests turn it into a failure:
 *
 * 1. Every store in `BACKUP_STORES` is either record-guarded or listed here as
 *    pref-only, with a reason.
 * 2. Every guarded vault really counts its own live state — a mistyped field
 *    name counts nothing, which is indistinguishable from having no guard.
 */
import { describe, expect, it } from "vitest"
import { BACKUP_STORES } from "@/lib/data/backup"
import { persistKey } from "@/lib/storage-keys"
import { useTaskStore } from "@/lib/task-store"
import { useEventStore } from "@/lib/event-store"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { useGoalsStore } from "@/lib/goals-store"
import { useHabitsStore } from "@/lib/habits-store"
import { usePointsStore } from "@/lib/points-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { useModulesStore } from "@/lib/modules-store"
import { useModuleDefinitionsStore } from "@/lib/module-definitions"
import { useWorkflowsStore } from "@/lib/workflows-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useMetricsStore } from "@/lib/metrics-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useSleepStore } from "@/lib/sleep-store"
import { useRegretStore } from "@/lib/regret-store"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"

const { SHRINK_PROTECTED, VAULT_RECORD_FIELDS, vaultRecordCount } = require("./vault-guard.js") as {
  SHRINK_PROTECTED: Set<string>
  VAULT_RECORD_FIELDS: Record<string, { arrays?: string[]; maps?: string[]; log?: boolean }>
  vaultRecordCount: (name: string, value: string) => number | null
}

/** `brain2-goals-store` and `cogs-goals-store` are the same vault. */
function vaultId(name: string): string {
  return name.startsWith("brain2-") ? `cogs-${name.slice(7)}` : name
}

/**
 * Vaults that hold settings, not rows. Each empties on purpose, so a shrink
 * guard would refuse the user's own edit. `USER_PREF_KEYS` in `vault-guard.js`
 * protects the individual prefs instead.
 */
const PREF_ONLY_VAULTS: Record<string, string> = {
  "cogs-theme-store": "window gray, plate, hues — appearanceRev decides these",
  "cogs-user-settings": "one settings object",
  "cogs-lists-ui": "window layout and filters; Deselect all empties them on purpose",
  "cogs-screentime-prefs": "app allow/deny lists the user curates",
  "cogs-work-session": "one in-flight session, cleared when it ends",
  "cogs-pen-color-session": "one in-flight pen-color timer, cleared when it ends",
  "cogs-ingest-store": "trimmed event log; pendingByChat drains as clarifications are answered",
  "cogs-home-widgets": "overview tile order; reset is allowed to restore the default set",
  "cogs-home-weather": "one place object for the Home weather instrument",
  "cogs-home-days-until": "one countdown date and label for the Days Until tile",
  "cogs-sun-times": "astronomy cache; a reset is allowed to empty it, and backup still keeps the history",
  "cogs-ui-names": "overlay mode string",
}

/** Live default state, shaped like the persisted blob the guard reads. */
const GUARDED_STORE_STATE: Record<string, () => unknown> = {
  "cogs-task-storage": () => useTaskStore.getState(),
  "cogs-event-storage": () => useEventStore.getState(),
  "cogs-planned-actions": () => usePlannedActionStore.getState(),
  "cogs-goals-store": () => useGoalsStore.getState(),
  "cogs-habits-store": () => useHabitsStore.getState(),
  "cogs-reviews-store": () => useReviewsStore.getState(),
  "cogs-modules-store": () => useModulesStore.getState(),
  "cogs-module-definitions": () => useModuleDefinitionsStore.getState(),
  "cogs-workflows-store": () => useWorkflowsStore.getState(),
  "cogs-item-types-store": () => useItemTypeStore.getState(),
  "cogs-metrics-store": () => useMetricsStore.getState(),
  "cogs-timegrid-store": () => useTimeTrackingStore.getState(),
  "cogs-sleep-store": () => useSleepStore.getState(),
  "cogs-baby-animals-store": () => useBabyAnimalsStore.getState(),
  "points-store": () => usePointsStore.getState(),
  "regret-store": () => useRegretStore.getState(),
}

describe("vault coverage", () => {
  it("guards or declares every persisted store", () => {
    const unaccounted = BACKUP_STORES.map((store) => vaultId(store.key)).filter(
      (id) => !SHRINK_PROTECTED.has(id) && !(id in PREF_ONLY_VAULTS),
    )
    expect(
      unaccounted,
      `Add these to VAULT_RECORD_FIELDS in lib/vault-guard.js (they hold rows) ` +
        `or to PREF_ONLY_VAULTS here with a reason (they hold settings): ${unaccounted.join(", ")}`,
    ).toEqual([])
  })

  it("does not guard a vault that no longer ships", () => {
    const shipped = new Set([...BACKUP_STORES.map((s) => vaultId(s.key)), vaultId(persistKey("tracking-day-notes"))])
    for (const id of SHRINK_PROTECTED) expect(shipped, `${id} is guarded but not in BACKUP_STORES`).toContain(id)
  })

  it("counts records in each guarded vault's own state", () => {
    for (const id of Object.keys(VAULT_RECORD_FIELDS)) {
      if (id === "cogs-tracking-day-notes") continue // bare date→note map, no store
      const read = GUARDED_STORE_STATE[id]
      expect(read, `${id} is guarded but has no live state here`).toBeTypeOf("function")
      const spec = VAULT_RECORD_FIELDS[id]
      const state = JSON.parse(JSON.stringify({ state: read() })).state as Record<string, unknown>
      // Per field, not just the total: one good field would hide a typo in the rest.
      for (const field of spec.arrays ?? []) {
        expect(Array.isArray(state[field]), `${id}.${field} is not an array in the live store`).toBe(true)
      }
      for (const field of spec.maps ?? []) {
        const map = state[field]
        expect(!!map && typeof map === "object" && !Array.isArray(map), `${id}.${field} is not a map`).toBe(true)
      }
      const count = vaultRecordCount(id, JSON.stringify({ state: read() }))
      expect(count, `${id} counts nothing — check the field names in VAULT_RECORD_FIELDS`).toBeTypeOf("number")
    }
  })
})

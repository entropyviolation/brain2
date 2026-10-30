/**
 * lib/bim-flow/store-snapshot.ts — Read the live stores into a `VaultSnapshot`
 *
 * Read only. The flow lab takes one snapshot per run, so a run sees the vault
 * as it stood when Run was pressed. `loadHubVault` is the fallback for a
 * window whose stores are empty.
 */
"use client"

import { useHabitsStore } from "@/lib/habits-store"
import type { TelegramFeedRow } from "@/lib/ingest/telegram-feed"
import { itemTitle } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { Task } from "@/lib/types"
import { skipListIdsFor, type VaultSnapshot } from "./vault-search"

export function snapshotFromStores(): VaultSnapshot {
  const { tasks, lists } = useTaskStore.getState()
  const habits = useHabitsStore.getState().tasks
  const scopes = useTimeTrackingStore.getState().scopes
  const plainLists = lists.map((l) => ({ id: l.id, name: l.name }))
  return {
    items: tasks
      .map((t) => ({ id: t.id, title: itemTitle(t), type: t.type, listIds: t.lists ?? [] }))
      .filter((t) => t.title),
    lists: plainLists,
    habits: habits.map((h) => ({ id: h.id, title: h.name })),
    scopes: scopes.map((s) => ({ id: s.id, name: s.name, pens: s.pens.map((p) => ({ id: p.id, name: p.name })) })),
    skipListIds: skipListIdsFor(plainLists),
  }
}

interface HubItems {
  items?: Record<string, string>
}

function hubState(items: Record<string, string>, key: string): Record<string, unknown> | null {
  try {
    const raw = items[`brain2-${key}`] ?? items[`cogs-${key}`] ?? items[key]
    return raw ? ((JSON.parse(raw) as { state?: Record<string, unknown> }).state ?? null) : null
  } catch {
    return null
  }
}

/**
 * Read `/api/persist` without touching the stores, for a window whose own
 * storage holds no vault (a plain browser tab; only Electron pulls the hub).
 * Returns null when the hub does not answer.
 */
export async function loadHubVault(): Promise<{ snap: VaultSnapshot; feed: TelegramFeedRow[] } | null> {
  try {
    const res = await fetch("/api/persist")
    if (!res.ok) return null
    const items = ((await res.json()) as HubItems).items ?? {}
    const task = hubState(items, "task-storage") as { tasks?: Task[]; lists?: { id: string; name: string }[] } | null
    const habits = (hubState(items, "habits-store")?.tasks ?? []) as { id: string; name: string }[]
    const scopes = (hubState(items, "timegrid-store")?.scopes ?? []) as { id: string; name: string; pens: { id: string; name: string }[] }[]
    const feed = (hubState(items, "telegram-feed")?.rows ?? []) as TelegramFeedRow[]
    const lists = (task?.lists ?? []).map((l) => ({ id: l.id, name: l.name }))
    return {
      feed,
      snap: {
        items: (task?.tasks ?? [])
          .map((t) => ({ id: t.id, title: itemTitle(t), type: t.type, listIds: t.lists ?? [] }))
          .filter((t) => t.title),
        lists,
        habits: habits.map((h) => ({ id: h.id, title: h.name })),
        scopes: scopes.map((s) => ({ id: s.id, name: s.name, pens: (s.pens ?? []).map((p) => ({ id: p.id, name: p.name })) })),
        skipListIds: skipListIdsFor(lists),
      },
    }
  } catch {
    return null
  }
}

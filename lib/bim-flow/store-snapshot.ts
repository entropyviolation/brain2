/**
 * lib/bim-flow/store-snapshot.ts — Read the live stores into a `VaultSnapshot`
 *
 * Read only. The flow lab takes one snapshot per run, so a run sees the vault
 * as it stood when Run was pressed. `loadHubVault` is the fallback for a
 * window whose stores are empty.
 */
"use client"

import { useHabitsStore } from "@/lib/habits-store"
import { useHealthImportStore } from "@/lib/phone-sync/health-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { buildDatasets } from "./datasets"
import type { TelegramFeedRow } from "@/lib/ingest/telegram-feed"
import { itemTitle } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { OperationReview } from "@/lib/reviews-store"
import type { PeriodReview, Task, WeeklyData, WeeklyTask } from "@/lib/types"
import { useTelegramFeedStore } from "@/lib/ingest/telegram-feed-store"
import { skipListIdsFor, type HistoryEntry, type VaultHistory, type VaultSnapshot } from "./vault-search"

interface RawScope { id: string; name: string; pens: { id: string; name: string }[] }
interface RawEntry {
  date: string
  scopeId: string
  penId: string
  startMin: number
  endMin: number
  title?: string
  notes?: string
  kind?: string
  precision?: string
  clockCertainty?: string
  generatedBy?: unknown
}

/** What happened and when, from the timegrid entries, the BIM feed, log items, and day notes. */
export function buildHistory(input: {
  entries: RawEntry[]
  scopes: RawScope[]
  feed: { at: string; text: string }[]
  tasks: { type?: string; title?: string; createdAt?: unknown }[]
  dayNotes: Record<string, string>
  health?: VaultHistory["health"]
}): VaultHistory {
  const pens = new Map<string, string>()
  const scopeNames: Record<string, string> = {}
  for (const s of input.scopes) {
    scopeNames[s.id] = s.name
    for (const p of s.pens) pens.set(`${s.id}:${p.id}`, p.name)
  }
  const entries: HistoryEntry[] = input.entries.map((e) => ({
    date: e.date,
    scope: e.scopeId,
    pen: pens.get(`${e.scopeId}:${e.penId}`) ?? e.penId,
    startMin: e.startMin,
    endMin: e.endMin,
    text: [e.title, e.notes].filter(Boolean).join(" · "),
    confirmed: !(e.precision === "estimated" || e.generatedBy || e.clockCertainty === "unknown" || e.clockCertainty === "estimated"),
    instant: e.kind === "instant",
    source: (e.generatedBy as { kind?: string } | undefined)?.kind,
  }))
  return {
    entries,
    scopeNames,
    feed: input.feed.filter((f) => f.text.trim()).map((f) => ({ at: f.at, text: f.text })),
    logs: input.tasks
      .filter((t) => t.type === "log" && t.title && t.createdAt)
      .map((t) => ({ at: new Date(t.createdAt as string).toISOString(), text: t.title! })),
    dayNotes: Object.entries(input.dayNotes).map(([date, text]) => ({ date, text })),
    health: input.health,
  }
}

/** Items of type person with every name they go by. */
export function buildPeople(tasks: Task[]): NonNullable<VaultSnapshot["people"]> {
  return tasks
    .filter((t) => t.type === "person")
    .map((t) => {
      const prof = (t as unknown as { personProfile?: { fullName?: string; nicknames?: string[]; phones?: string[]; emails?: string[] } }).personProfile
      return { id: t.id, title: itemTitle(t), names: [itemTitle(t), prof?.fullName ?? "", ...(prof?.nicknames ?? [])].filter(Boolean), handles: [...(prof?.phones ?? []), ...(prof?.emails ?? [])] }
    })
}

export function snapshotFromStores(): VaultSnapshot {
  const { tasks, lists } = useTaskStore.getState()
  const habits = useHabitsStore.getState().tasks
  const tt = useTimeTrackingStore.getState() as unknown as { scopes: RawScope[]; entries: RawEntry[]; dayNotes?: Record<string, string> }
  const scopes = tt.scopes
  const habitState = useHabitsStore.getState()
  const reviewState = useReviewsStore.getState()
  const plainLists = lists.map((l) => ({ id: l.id, name: l.name }))
  const history = buildHistory({
    entries: tt.entries ?? [],
    scopes: tt.scopes,
    feed: useTelegramFeedStore.getState().rows,
    tasks: tasks as unknown as { type?: string; title?: string; createdAt?: unknown }[],
    dayNotes: tt.dayNotes ?? {},
    health: useHealthImportStore.getState().days,
  })
  return {
    items: tasks
      .map((t) => ({ id: t.id, title: itemTitle(t), type: t.type, listIds: t.lists ?? [] }))
      .filter((t) => t.title),
    lists: plainLists,
    habits: habits.map((h) => ({ id: h.id, title: h.name })),
    scopes: scopes.map((s) => ({ id: s.id, name: s.name, pens: s.pens.map((p) => ({ id: p.id, name: p.name })) })),
    skipListIds: skipListIdsFor(plainLists),
    people: buildPeople(tasks),
    history,
    datasets: buildDatasets({
      tasks,
      habits: habitState.tasks,
      weeklyData: habitState.weeklyData,
      weeklyHabitData: habitState.weeklyHabitData,
      monthlyHabitData: habitState.monthlyHabitData,
      quarterlyHabitData: habitState.quarterlyHabitData,
      reviews: reviewState.reviews,
      operationReviews: reviewState.operationReviews,
      history,
      now: new Date(),
    }),
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
    const tg = hubState(items, "timegrid-store")
    const scopes = (tg?.scopes ?? []) as { id: string; name: string; pens: { id: string; name: string }[] }[]
    const feed = (hubState(items, "telegram-feed")?.rows ?? []) as TelegramFeedRow[]
    const lists = (task?.lists ?? []).map((l) => ({ id: l.id, name: l.name }))
    const habitStore = hubState(items, "habits-store")
    const reviewStore = hubState(items, "reviews-store")
    const history = buildHistory({
      entries: (tg?.entries ?? []) as RawEntry[],
      scopes,
      feed,
      tasks: (task?.tasks ?? []) as unknown as { type?: string; title?: string; createdAt?: unknown }[],
      dayNotes: (tg?.dayNotes ?? {}) as Record<string, string>,
    })
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
        people: buildPeople(task?.tasks ?? []),
        history,
        datasets: buildDatasets({
          tasks: (task?.tasks ?? []) as Task[],
          habits: habits as unknown as WeeklyTask[],
          weeklyData: habitStore?.weeklyData as WeeklyData | undefined,
          weeklyHabitData: habitStore?.weeklyHabitData as WeeklyData | undefined,
          monthlyHabitData: habitStore?.monthlyHabitData as WeeklyData | undefined,
          quarterlyHabitData: habitStore?.quarterlyHabitData as WeeklyData | undefined,
          reviews: (reviewStore?.reviews ?? []) as PeriodReview[],
          operationReviews: (reviewStore?.operationReviews ?? []) as OperationReview[],
          history,
          now: new Date(),
        }),
      },
    }
  } catch {
    return null
  }
}

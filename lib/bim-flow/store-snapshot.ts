/**
 * lib/bim-flow/store-snapshot.ts — Read the live stores into a `VaultSnapshot`
 *
 * Read only. The flow lab takes one snapshot per run, so a run sees the vault
 * as it stood when Run was pressed. `loadHubVault` is the fallback for a
 * window whose stores are empty.
 */
"use client"

import { toLocalCalendarDate } from "@/lib/date-utils"
import { useEventStore } from "@/lib/event-store"
import { withHolidays } from "@/lib/holidays"
import { useHabitsStore } from "@/lib/habits-store"
import { useHealthImportStore } from "@/lib/phone-sync/health-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { withoutSecrets } from "@/lib/secrets"
import { secretsShown } from "@/lib/secrets-store"
import { buildDatasets } from "./datasets"
import type { TelegramFeedRow } from "@/lib/ingest/telegram-feed"
import { itemTitle } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { OperationReview } from "@/lib/reviews-store"
import type { PeriodReview, Task, WeeklyData, WeeklyTask } from "@/lib/types"
import { useOvercomeStore } from "@/lib/overcome-bimby/store"
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
  secret?: boolean
}

interface RawEvent {
  title: string
  date: Date | string
  startTime?: string
  isAllDay?: boolean
}

function localIso(date: Date | string): string {
  const d = toLocalCalendarDate(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** What happened and when, from the timegrid entries, the BIM feed, log items, day notes, and Plan events. */
export function buildHistory(input: {
  entries: RawEntry[]
  scopes: RawScope[]
  feed: { at: string; text: string }[]
  tasks: { type?: string; title?: string; createdAt?: unknown }[]
  dayNotes: Record<string, string>
  health?: VaultHistory["health"]
  events?: RawEvent[]
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
    events: (input.events ?? [])
      .filter((e) => e.title?.trim() && e.date)
      .map((e) => ({
        date: localIso(e.date),
        title: e.title.trim(),
        ...(e.isAllDay ? { allDay: true } : e.startTime ? { time: e.startTime } : {}),
      })),
    health: input.health,
  }
}

/** Day notes minus the ones marked secret, unless `includeSecrets`. */
export function visibleDayNotes(notes: Record<string, string>, secretDates: Record<string, true> | undefined, includeSecrets: boolean): Record<string, string> {
  if (includeSecrets || !secretDates) return notes
  return Object.fromEntries(Object.entries(notes).filter(([date]) => !secretDates[date]))
}

/** Phone numbers and emails of secret people, so their texts stay out too. */
export function secretHandles(tasks: Task[]): string[] {
  return tasks
    .filter((t) => t.type === "person" && t.secret === true)
    .flatMap((t) => {
      const prof = (t as unknown as { personProfile?: { phones?: string[]; emails?: string[] } }).personProfile
      return [...(prof?.phones ?? []), ...(prof?.emails ?? [])]
    })
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

/**
 * Secret items are left out unless `includeSecrets` is true. Default: whether
 * the person unlocked secrets and switched them on for chat.
 */
export function snapshotFromStores(includeSecrets: boolean = secretsShown("chat")): VaultSnapshot {
  const { tasks: allTasks, lists } = useTaskStore.getState()
  const tasks = withoutSecrets(allTasks, includeSecrets)
  const habits = useHabitsStore.getState().tasks
  const tt = useTimeTrackingStore.getState() as unknown as { scopes: RawScope[]; entries: RawEntry[]; dayNotes?: Record<string, string>; secretDayNotes?: Record<string, true> }
  const scopes = tt.scopes
  const habitState = useHabitsStore.getState()
  const reviewState = useReviewsStore.getState()
  const plainLists = lists.map((l) => ({ id: l.id, name: l.name }))
  const history = buildHistory({
    entries: withoutSecrets(tt.entries ?? [], includeSecrets),
    scopes: tt.scopes,
    feed: useTelegramFeedStore.getState().rows,
    tasks: tasks as unknown as { type?: string; title?: string; createdAt?: unknown }[],
    dayNotes: visibleDayNotes(tt.dayNotes ?? {}, tt.secretDayNotes, includeSecrets),
    health: useHealthImportStore.getState().days,
    events: withHolidays(useEventStore.getState().events),
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
    secretHandles: includeSecrets ? [] : secretHandles(allTasks),
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
      overcomeLog: useOvercomeStore.getState().log,
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
 * The vault from a persist dump (`/api/persist`, or `data/shared-persist.json` on disk), read only.
 * No store is touched, so tests can run the flows on the person's real vault.
 */
export function snapshotFromPersistItems(items: Record<string, string>, now = new Date(), includeSecrets = false): { snap: VaultSnapshot; feed: TelegramFeedRow[] } {
  const rawTask = hubState(items, "task-storage") as { tasks?: Task[]; lists?: { id: string; name: string }[] } | null
  const task = rawTask && { ...rawTask, tasks: withoutSecrets(rawTask.tasks ?? [], includeSecrets) }
  const habits = (hubState(items, "habits-store")?.tasks ?? []) as { id: string; name: string }[]
  const tg = hubState(items, "timegrid-store")
  const scopes = (tg?.scopes ?? []) as { id: string; name: string; pens: { id: string; name: string }[] }[]
  const feed = (hubState(items, "telegram-feed")?.rows ?? []) as TelegramFeedRow[]
  const lists = (task?.lists ?? []).map((l) => ({ id: l.id, name: l.name }))
  const habitStore = hubState(items, "habits-store")
  const reviewStore = hubState(items, "reviews-store")
  const history = buildHistory({
    entries: withoutSecrets((tg?.entries ?? []) as RawEntry[], includeSecrets),
    scopes,
    feed,
    tasks: (task?.tasks ?? []) as unknown as { type?: string; title?: string; createdAt?: unknown }[],
    dayNotes: visibleDayNotes((tg?.dayNotes ?? {}) as Record<string, string>, tg?.secretDayNotes as Record<string, true> | undefined, includeSecrets),
    events: (hubState(items, "event-storage")?.events ?? []) as RawEvent[],
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
      secretHandles: includeSecrets ? [] : secretHandles(rawTask?.tasks ?? []),
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
        overcomeLog: useOvercomeStore.getState().log,
        now,
      }),
    },
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
    return snapshotFromPersistItems(((await res.json()) as HubItems).items ?? {})
  } catch {
    return null
  }
}

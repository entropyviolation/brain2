/**
 * lib/habit-keyword-sync.ts — Count stored BIM messages into a keyword habit
 *
 * Reads the ingest log and text-pipeline instants the bot already wrote.
 * Does not open a second bot. Each dated hit is counted in the period that
 * contains its timestamp. A hit with no timestamp is not applied to any period.
 * A logged minutes/hours phrase also paints the prior span on the habit’s
 * activity (`lib/habit-logged-span.ts`). The same message in the same minute
 * paints once. List length, grace, and by-hand cells are left alone.
 * When the habit has no tracking link, the summed amount is written on
 * `value` so the cell shows it (9 toward a goal of 15). A tracking link
 * already turns those painted minutes into `value`, so this sync does not
 * add them a second time.
 */
"use client"

import { useEffect } from "react"
import { isRestoring, withoutUndo } from "@/lib/action-history"
import { formatLocalDateKey, formatLocalMonthKey, getWeekString } from "@/lib/date-utils"
import { habitWriteIsQuiet, useHabitsStore } from "@/lib/habits-store"
import { periodWindowsForFrequency } from "@/lib/habit-period-windows"
import { activeTrackingLink, convertTrackedMinutes } from "@/lib/habit-tracking"
import { trackedMinutesForTagsInRange, type TrackedTimeSource } from "@/lib/tracked-time"
import { planLoggedSpan, type LoggedSpanPlan } from "@/lib/habit-logged-span"
import { sanitizeKeywordSource } from "@/lib/habit-keyword-source"
import {
  applyKeywordToCompletion,
  evaluateKeywordPeriod,
  isLoggedSpanStamp,
  keywordCompletionPatch,
  keywordPhrases,
  rememberKeywordReceipts,
  storedKeywordMessages,
  type KeywordHit,
} from "@/lib/habit-keyword-source"
import { currentPeriodRange } from "@/lib/list-sent"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { quarterKey } from "@/lib/seasons"
import { startHydratedStoreSync, type HydratedStoreSyncSlot } from "@/lib/start-hydrated-store-sync"
import { PEN_PALETTE, useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { HabitKeywordSource, TaskCompletion, WeeklyData, WeeklyTask } from "@/lib/types"

function sourceFor(task: WeeklyTask): HabitKeywordSource | null {
  if (!task.completionSources?.includes("keywords")) return null
  const row = task.completionPipelines?.find((item) => item.kind === "keywords")
  return sanitizeKeywordSource(row?.keyword)
}

function bucketFor(task: WeeklyTask, state: ReturnType<typeof useHabitsStore.getState>): WeeklyData {
  const freq = task.frequency || "daily"
  if (freq === "monthly") return state.monthlyHabitData
  if (freq === "quarterly") return state.quarterlyHabitData
  if (freq === "weekly") return state.weeklyHabitData
  return state.weeklyData
}

function periodKeyFor(task: WeeklyTask, rangeStart: Date): string {
  const freq = task.frequency || "daily"
  if (freq === "weekly") return getWeekString(rangeStart)
  if (freq === "monthly") return formatLocalMonthKey(rangeStart)
  if (freq === "quarterly") return quarterKey(rangeStart)
  return formatLocalDateKey(rangeStart)
}

function writePeriod(task: WeeklyTask, anchor: Date, next: TaskCompletion): void {
  const habits = useHabitsStore.getState()
  const freq = task.frequency || "daily"
  if (freq === "monthly") habits.updateMonthlyHabitCompletion(task.id, anchor, next)
  else if (freq === "quarterly") habits.updateQuarterlyHabitCompletion(task.id, anchor, next)
  else if (freq === "weekly") habits.updateWeeklyHabitCompletion(task.id, anchor, next)
  else habits.updateCompletion(task.id, anchor, next)
}

function sameKeywordCell(previous: TaskCompletion | undefined, next: TaskCompletion): boolean {
  if (!previous) return false
  return (
    previous.keywordUse === next.keywordUse &&
    previous.keywordAfter === next.keywordAfter &&
    previous.keywordHitCount === next.keywordHitCount &&
    previous.keywordLogged === next.keywordLogged &&
    previous.keywordValue === next.keywordValue &&
    previous.value === next.value &&
    previous.goal === next.goal &&
    JSON.stringify(previous.keywordSlots ?? null) === JSON.stringify(next.keywordSlots ?? null)
  )
}

/**
 * The cell number the grid prints is `value`. A tracking link fills that from
 * the span this sync just painted, so adding the phrase again would count the
 * minutes twice. With no link, and no hand-typed number, the phrase sum is
 * the number on the cell.
 */
function withLoggedAmount(
  task: WeeklyTask,
  previous: TaskCompletion | undefined,
  next: TaskCompletion,
  amount: number | null,
): TaskCompletion {
  if (amount == null) return next
  if (activeTrackingLink(task)) return next
  if (previous?.handCompleted !== undefined || previous?.manualValue !== undefined) return next
  return { ...next, value: amount, goal: task.goal ?? next.goal ?? previous?.goal }
}

function penForPlan(plan: LoggedSpanPlan): string | null {
  const store = useTimeTrackingStore.getState()
  const scope =
    store.scopes.find((row) => row.id === plan.scopeId) ??
    store.scopes.find((row) => row.id === "activity") ??
    store.scopes[0]
  if (!scope) return null
  if (plan.penId) {
    const linked = scope.pens.find((pen) => pen.id === plan.penId)
    if (linked) return linked.id
  }
  const named = scope.pens.find((pen) => pen.name.trim().toLowerCase() === plan.penName.trim().toLowerCase())
  if (named) return named.id
  return store.addPen(scope.id, {
    name: plan.penName,
    color: PEN_PALETTE[scope.pens.length % PEN_PALETTE.length] ?? PEN_PALETTE[0],
    tags: plan.tagIds,
  })
}

/**
 * Paint each new duration hit. Returns every local date a duration phrase
 * covers, including ones already painted, so the tracking link can be
 * re-applied without waiting for the grid subscription.
 */
function ensureLoggedSpans(task: WeeklyTask, hits: readonly KeywordHit[], pattern: string): string[] {
  const tracking = useTimeTrackingStore.getState()
  const dates = new Set<string>()
  for (const hit of hits) {
    if (!hit.at || !hit.text?.trim()) continue
    const plan = planLoggedSpan({
      habit: task,
      pattern,
      text: hit.text,
      at: hit.at,
      scopes: tracking.scopes,
      tags: tracking.tags,
    })
    if (!plan) continue
    dates.add(plan.date)
    const already = useTimeTrackingStore.getState().entries.some(
      (entry) => entry.generatedBy?.kind === "text" && isLoggedSpanStamp(entry.generatedBy.id) && entry.generatedBy.id === plan.stamp,
    )
    if (already) continue
    const penId = penForPlan(plan)
    if (!penId) continue
    const before = new Set(useTimeTrackingStore.getState().entries.map((entry) => entry.id))
    useTimeTrackingStore.getState().paintMinutes(
      plan.date,
      plan.scopeId,
      plan.startMin,
      plan.endMin,
      penId,
      undefined,
      plan.stamp,
      plan.endAssumed ? "estimated" : undefined,
      {
        title: plan.title,
        notes: plan.notes,
        tagIds: plan.tagIds.length ? plan.tagIds : undefined,
        ...(plan.endAssumed ? { clockCertainty: "estimated" as const } : {}),
      },
    )
    const created = useTimeTrackingStore
      .getState()
      .entries.filter(
        (entry) => entry.penId === penId && (!before.has(entry.id) || entry.spanId === plan.stamp),
      )
    for (const entry of created) {
      useTimeTrackingStore.getState().updateEntry(entry.id, {
        generatedBy: { kind: "text", id: plan.stamp },
        title: plan.title,
        notes: plan.notes,
        ...(plan.tagIds.length ? { tagIds: plan.tagIds } : {}),
        ...(plan.endAssumed ? { precision: "estimated" as const, clockCertainty: "estimated" as const } : {}),
      })
    }
  }
  return [...dates]
}

/** Push painted tag minutes onto this habit. No-op without a tracking link. */
function creditTrackedSpans(task: WeeklyTask, dateKeys: string[]): void {
  const link = activeTrackingLink(task)
  if (!link || !dateKeys.length) return
  const state = useTimeTrackingStore.getState()
  const source: TrackedTimeSource = { scopes: state.scopes, entries: state.entries ?? [] }
  const apply = useHabitsStore.getState().applyTrackedValue
  for (const { anchor, keys } of periodWindowsForFrequency(task.frequency, dateKeys)) {
    const minutes = trackedMinutesForTagsInRange(source, keys, link.tagIds)
    apply(task.id, anchor, convertTrackedMinutes(minutes, link.unit))
  }
}

let syncing = false

export function syncKeywordHabits(now = new Date()): void {
  if (syncing || isRestoring()) return
  syncing = true
  try {
    withoutUndo(() => {
      const habits = useHabitsStore.getState().tasks
      const parents = habits.filter((task) => sourceFor(task))
      if (!parents.length) return
      const messages = storedKeywordMessages(
        useIngestStore.getState().events,
        useTimeTrackingStore.getState().entries,
      )
      for (const parent of parents) {
        const source = sourceFor(parent)
        if (!source) continue
        const phrases = keywordPhrases(parent)
        const receipts = rememberKeywordReceipts(parent.keywordReceipts, messages, phrases, source)
        if (receipts !== parent.keywordReceipts) {
          useHabitsStore.getState().updateTask({ ...parent, keywordReceipts: receipts })
        }
        const hits: KeywordHit[] = [...(receipts ?? []), ...messages]
        if (source.use === "logged" && source.pattern) {
          creditTrackedSpans(parent, ensureLoggedSpans(parent, hits, source.pattern))
        }
        const ranges = new Map<string, { start: Date; end: Date }>()
        const current = currentPeriodRange(parent.frequency, now)
        ranges.set(periodKeyFor(parent, current.start), current)
        for (const hit of hits) {
          if (!hit.at) continue
          const instant = new Date(hit.at)
          if (!Number.isFinite(instant.getTime())) continue
          const range = currentPeriodRange(parent.frequency, instant)
          ranges.set(periodKeyFor(parent, range.start), range)
        }
        for (const range of ranges.values()) {
          const result = evaluateKeywordPeriod({
            hits,
            phrases,
            use: source.use,
            count: source.count,
            pattern: source.pattern,
            start: range.start,
            end: range.end,
          })
          const quiet = result.count === 0 && !result.observed
          const key = periodKeyFor(parent, range.start)
          const previous = bucketFor(parent, useHabitsStore.getState())[key]?.[parent.id]
          const hadKeyword =
            previous?.keywordUse != null || previous?.keywordLogged != null || previous?.keywordHitCount != null
          if (quiet && !hadKeyword) continue
          const next = withLoggedAmount(
            parent,
            previous,
            applyKeywordToCompletion(previous, keywordCompletionPatch(result, source)),
            source.use === "logged" ? result.amount : null,
          )
          if (sameKeywordCell(previous, next)) continue
          writePeriod(parent, range.start, next)
        }
      }
    })
  } finally {
    syncing = false
  }
}

const keywordSyncSlot: HydratedStoreSyncSlot = { stopper: null }

export function startKeywordSync(): () => void {
  return startHydratedStoreSync({
    slot: keywordSyncSlot,
    persists: [useHabitsStore.persist, useIngestStore.persist, useTimeTrackingStore.persist],
    onReady: () => {
      const unIngest = useIngestStore.subscribe((state, prev) => {
        if (isRestoring()) return
        if (state.events !== prev.events) syncKeywordHabits()
      })
      const unEntries = useTimeTrackingStore.subscribe((state, prev) => {
        if (isRestoring()) return
        if (state.entries !== prev.entries) syncKeywordHabits()
      })
      const unHabits = useHabitsStore.subscribe((state, prev) => {
        if (isRestoring() || habitWriteIsQuiet()) return
        if (state.tasks !== prev.tasks) syncKeywordHabits()
      })
      syncKeywordHabits()
      return () => {
        unIngest()
        unEntries()
        unHabits()
      }
    },
  })
}

export function useKeywordSync(): void {
  useEffect(() => {
    startKeywordSync()
  }, [])
}

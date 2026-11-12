/**
 * lib/pharmacy-sync.ts — Bottles follow Tracking and the linked habit
 *
 * Two readers, both idempotent through the ledger in `pharmacy-store.ts`:
 * - Intake lines (`intake:` / `nfc:` / the Take button). An instant on the
 *   Intake pen whose title names a bottle takes that many doses. Deleting the
 *   line gives them back.
 * - A daily habit linked to a bottle. Marking it done draws `habitPer` units
 *   (a count habit draws that for each counted unit). Unmarking gives them back.
 *   Doses an Intake line already took that day are not taken twice.
 * Nothing before the item was added (or the habit linked) is ever drawn.
 */
"use client"

import { useEffect } from "react"
import { isRestoring } from "@/lib/action-history"
import { runSync } from "@/lib/defer-sync"
import { habitWriteIsQuiet, useHabitsStore } from "@/lib/habits-store"
import { habitUnits, itemForIntakeTitle, type PharmacyItem } from "@/lib/pharmacy-math"
import { habitKey, usePharmacyStore } from "@/lib/pharmacy-store"
import { startHydratedStoreSync, type HydratedStoreSyncSlot } from "@/lib/start-hydrated-store-sync"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { TimeEntry } from "@/lib/time-entries"
import type { WeeklyData } from "@/lib/types"

export const intakeKey = (entryId: string): string => `intake:${entryId}`

function isIntake(entry: TimeEntry): boolean {
  return entry.kind === "instant" && (entry.eventKind?.startsWith("intake") === true || entry.intakeClass != null) && Boolean(entry.title)
}

/** Draw one Intake entry from the bottle its title names. Returns the item it drew from. */
export function drawIntakeEntry(entry: TimeEntry, forceItemId?: string, doses?: number): PharmacyItem | null {
  const store = usePharmacyStore.getState()
  const key = intakeKey(entry.id)
  const title = entry.title ?? ""
  const named = itemForIntakeTitle(title, store.items)
  const forced = forceItemId ? store.items.find((row) => row.id === forceItemId) : undefined
  const item = forced ?? (named && entry.date >= named.item.addedOn ? named.item : null)
  if (!item) {
    if (store.ledger[key]) store.refund(key)
    return null
  }
  const count = doses ?? named?.doses ?? 1
  store.draw(item.id, key, count * item.perDose, entry.date, entry.logSource === "nfc" ? "nfc" : "intake")
  return item
}

function reconcileDay(item: PharmacyItem, date: string, weeklyData: WeeklyData): void {
  if (!item.habitId || !item.habitSince || date < item.habitSince) return
  const task = useHabitsStore.getState().tasks.find((row) => row.id === item.habitId)
  if (!task || (task.frequency && task.frequency !== "daily")) return
  const raw = habitUnits(task, weeklyData[date]?.[item.habitId], item.habitPer)
  usePharmacyStore.getState().reconcileHabit(item.id, item.habitId, date, raw)
}

/** Days a linked habit might owe: its cells since the link, plus days it already drew on. */
function habitDays(item: PharmacyItem, weeklyData: WeeklyData, prev?: WeeklyData): string[] {
  if (!item.habitId || !item.habitSince) return []
  const days = new Set<string>()
  for (const date of Object.keys(weeklyData)) {
    if (date < item.habitSince) continue
    if (prev && prev[date]?.[item.habitId] === weeklyData[date]?.[item.habitId]) continue
    days.add(date)
  }
  if (prev) {
    for (const date of Object.keys(prev)) {
      if (date >= item.habitSince && prev[date]?.[item.habitId] !== weeklyData[date]?.[item.habitId]) days.add(date)
    }
  }
  const ledger = usePharmacyStore.getState().ledger
  for (const [key, row] of Object.entries(ledger)) {
    if (row.itemId === item.id && key.startsWith(`habit:${item.habitId}:`) && (!prev || prev[row.date]?.[item.habitId] !== weeklyData[row.date]?.[item.habitId])) {
      days.add(row.date)
    }
  }
  return [...days]
}

export function syncPharmacyHabits(prev?: WeeklyData): void {
  const weeklyData = useHabitsStore.getState().weeklyData
  for (const item of usePharmacyStore.getState().items) {
    for (const date of habitDays(item, weeklyData, prev)) reconcileDay(item, date, weeklyData)
  }
}

/** Walk Intake entries. `prev` limits the walk to what changed since. Entries that vanished give their doses back. */
export function syncPharmacyIntake(entries: readonly TimeEntry[], prev?: readonly TimeEntry[]): void {
  const store = usePharmacyStore.getState()
  if (!store.items.length && !Object.keys(store.ledger).length) return
  const before = prev ? new Map(prev.map((row) => [row.id, row])) : null
  const now = new Set<string>()
  const touched = new Map<string, Set<string>>()
  const touch = (itemId: string, date: string) => {
    const set = touched.get(itemId) ?? new Set<string>()
    set.add(date)
    touched.set(itemId, set)
  }
  for (const entry of entries) {
    now.add(entry.id)
    if (!isIntake(entry)) continue
    if (before && before.get(entry.id) === entry) continue
    const priorItem = usePharmacyStore.getState().ledger[intakeKey(entry.id)]
    const item = drawIntakeEntry(entry)
    if (item) touch(item.id, entry.date)
    if (priorItem) touch(priorItem.itemId, priorItem.date)
  }
  if (!before) {
    for (const key of Object.keys(usePharmacyStore.getState().ledger)) {
      if (!key.startsWith("intake:") || now.has(key.slice("intake:".length))) continue
      const row = usePharmacyStore.getState().ledger[key]
      usePharmacyStore.getState().refund(key)
      touch(row.itemId, row.date)
    }
  }
  if (before) {
    for (const id of before.keys()) {
      if (now.has(id)) continue
      const row = usePharmacyStore.getState().ledger[intakeKey(id)]
      if (!row) continue
      usePharmacyStore.getState().refund(intakeKey(id))
      touch(row.itemId, row.date)
    }
  }
  // An Intake dose may already cover the habit's dose for that day.
  const weeklyData = useHabitsStore.getState().weeklyData
  for (const [itemId, dates] of touched) {
    const item = usePharmacyStore.getState().items.find((row) => row.id === itemId)
    if (!item) continue
    for (const date of dates) reconcileDay(item, date, weeklyData)
  }
}

/** What decides which doses a bottle takes. A count change is not part of it. */
function matchSignature(items: readonly PharmacyItem[]): string {
  return items
    .map((row) => [row.id, row.name, row.aliases.join("|"), row.perDose, row.habitId ?? "", row.habitPer, row.habitSince ?? ""].join("~"))
    .join("\n")
}

const slot: HydratedStoreSyncSlot = { stopper: null }

export function startPharmacySync(): () => void {
  return startHydratedStoreSync({
    slot,
    persists: [usePharmacyStore.persist, useHabitsStore.persist, useTimeTrackingStore.persist],
    onReady: () => {
      const unEntries = useTimeTrackingStore.subscribe((state, prev) => {
        if (isRestoring()) return
        if (state.entries !== prev.entries) runSync(() => syncPharmacyIntake(state.entries, prev.entries))
      })
      const unHabits = useHabitsStore.subscribe((state, prev) => {
        if (isRestoring() || habitWriteIsQuiet()) return
        if (state.weeklyData !== prev.weeklyData) runSync(() => syncPharmacyHabits(prev.weeklyData))
      })
      // A new link or a new bottle catches up on today without waiting for a cell to change.
      const unItems = usePharmacyStore.subscribe((state, prev) => {
        if (isRestoring()) return
        if (state.items === prev.items || matchSignature(state.items) === matchSignature(prev.items)) return
        runSync(() => {
          syncPharmacyIntake(useTimeTrackingStore.getState().entries)
          syncPharmacyHabits()
        })
      })
      syncPharmacyIntake(useTimeTrackingStore.getState().entries)
      syncPharmacyHabits()
      return () => {
        unEntries()
        unHabits()
        unItems()
      }
    },
  })
}

export function usePharmacySync(): void {
  useEffect(() => {
    startPharmacySync()
  }, [])
}

export { habitKey }

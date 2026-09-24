/**
 * lib/sleep-sync.ts — Keeping a night and its consequences in step, both ways
 *
 * The sleep log records a *statement*: "I fell asleep at 11:30 and woke at 7."
 * This module is the only place that turns that statement into consequences —
 * painted Tracking blocks, and a Done row for the morning. Keeping the two apart
 * means a correction three days later simply re-runs this and lands in the same
 * place, with no double counting and no drift.
 *
 * The correction can also arrive from the other end. A derived block is an
 * ordinary block: the user can drag it, split it or delete it, and doing so is a
 * perfectly clear way of saying "actually I got up at 8". `reconcileNightFromGrid`
 * carries that back into the log, so the tracker and Analytics can never end up
 * describing the same night differently. See `useSleepSync` for the latch that
 * keeps the two directions from chasing each other. Do not mount it inside the
 * block editor — re-deriving every night on click lagged the dialog and minted
 * new Sleep ids so Sleep blocks would not stay open.
 *
 * ## What gets derived
 *
 * - **Tracking blocks** on the Sleep pen, split at midnight by
 *   `sleepIntervals`, and stamped `generatedBy: { kind: "sleep", id: <night> }`.
 *   Re-deriving removes only blocks bearing that stamp, so time the user painted
 *   by hand is never collected as collateral.
 * - **Habit minutes**, for free: the Sleep pen carries the Sleep tag, so a habit
 *   linked to that tag picks the minutes up through the normal tag path
 *   (`lib/habit-tracking-sync.ts`). Nothing sleep-specific is needed there.
 * - **A Done row** for the morning, with a deterministic id, so the night shows
 *   up in To-Do Done and Analytics counts like any other completed thing. A
 *   remembered time is flagged `estimated` via `lib/estimated-values.ts`, the
 *   same machinery the review uses to ask "was this right?".
 *
 * Only this module imports the sleep store *and* the tracking/task stores, so
 * neither side depends on the other — the same arrangement as
 * `lib/habit-tracking-sync.ts`.
 */
"use client"

import { useEffect } from "react"
import { useSleepStore } from "@/lib/sleep-store"
import { useTimeTrackingStore, type TrackPen, type TrackScope } from "@/lib/time-tracking-store"
import { mergeAdjacent, type TimeEntry } from "@/lib/time-entries"
import {
  MINUTES_PER_DAY,
  SLEEP_TAG_ID,
  formatSleepDuration,
  isNightEstimated,
  nextDateKey,
  nightDateKeys,
  offsetToLabel,
  sleepIntervals,
  sleepMinutes,
  typicalSleepWindow,
  type SleepNight,
  type TypicalSleepWindow,
} from "@/lib/sleep-log"
import { nightFromGeneratedBlocks, resolveNights } from "@/lib/sleep-inference"
import { recentDateKeys } from "@/lib/tracking-summary"
import type { SleepEvidence } from "@/lib/completion-window"
import { syncTrackedHabits } from "@/lib/habit-tracking-sync"
import { taskRepository } from "@/lib/data/task-repository"
import { LOGGED_ACTION_TYPE_ID } from "@/lib/item-types"
import { makeEstimate } from "@/lib/estimated-values"
import { parseLocalDate } from "@/lib/date-utils"
import type { FieldEstimate } from "@/lib/types"

export { SLEEP_TAG_ID } from "@/lib/sleep-log"

const rid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export function sleepDoneLogId(date: string): string {
  return `sleep-night-${date}`
}

/**
 * Where derived sleep should be painted.
 *
 * Prefer a pen already carrying the Sleep tag so the habit link keeps working
 * whatever the pen is called; fall back to the seeded `act-sleep`, then to any
 * pen named "Sleep". Returns `null` when the user has deleted all of them, in
 * which case the log still records the night — it just has nothing to paint on.
 */
export function findSleepPen(scopes: TrackScope[]): { scope: TrackScope; pen: TrackPen } | null {
  for (const scope of scopes) {
    const tagged = scope.pens.find((p) => p.tags?.includes(SLEEP_TAG_ID))
    if (tagged) return { scope, pen: tagged }
  }
  for (const scope of scopes) {
    const seeded = scope.pens.find((p) => p.id === "act-sleep" || p.name.trim().toLowerCase() === "sleep")
    if (seeded) return { scope, pen: seeded }
  }
  return null
}

/** Blocks this night should produce, given where sleep is painted. */
export function deriveSleepEntries(
  night: SleepNight,
  scopeId: string,
  penId: string,
  makeId: () => string = () => rid("te"),
): TimeEntry[] {
  return sleepIntervals(night).map((interval) => ({
    id: makeId(),
    date: interval.date,
    scopeId,
    penId,
    startMin: interval.startMin,
    endMin: interval.endMin,
    generatedBy: { kind: "sleep" as const, id: night.date },
    // Without the pen's own tag, a renamed or retagged pen would silently stop
    // feeding sleep habits; pinning it to the block keeps the meaning.
    tagIds: [SLEEP_TAG_ID],
  }))
}

/**
 * Replace one night's derived blocks inside an entry list.
 *
 * Pure so the reconciliation is testable without stores. Hand-painted blocks
 * overlapping the night are left exactly as they are: two records may disagree
 * about the same minutes, and the honest thing is to show both rather than
 * silently delete whichever was written second.
 */
export function applySleepEntries(
  entries: TimeEntry[],
  night: SleepNight,
  scopeId: string,
  penId: string,
  makeId: () => string = () => rid("te"),
): TimeEntry[] {
  const existing = entries.filter((e) => e.generatedBy?.kind === "sleep" && e.generatedBy.id === night.date)
  const intervals = sleepIntervals(night)
  const sameShape =
    intervals.length === existing.length &&
    intervals.every((interval) =>
      existing.some(
        (e) =>
          e.date === interval.date &&
          e.startMin === interval.startMin &&
          e.endMin === interval.endMin &&
          e.scopeId === scopeId &&
          e.penId === penId,
      ),
    )
  // Re-deriving an unchanged night must not mint new ids — the block editor
  // keys off id, and a click that syncs would otherwise close the dialog.
  if (sameShape) return entries

  const derived = deriveSleepEntries(night, scopeId, penId, makeId)
  const withoutThisNight = entries.filter((e) => !(e.generatedBy?.kind === "sleep" && e.generatedBy.id === night.date))
  const stamped = derived.map((d) => {
    const prev = existing.find((e) => e.date === d.date && e.startMin === d.startMin && e.endMin === d.endMin)
    return prev ? { ...d, id: prev.id } : d
  })
  let next = [...withoutThisNight, ...stamped]
  for (const date of new Set(stamped.map((d) => d.date))) {
    next = mergeAdjacent(next, date, scopeId)
  }
  return next
}

/** Drop every block a night produced — used when the night is cleared. */
export function removeSleepEntries(entries: TimeEntry[], date: string): TimeEntry[] {
  return entries.filter((e) => !(e.generatedBy?.kind === "sleep" && e.generatedBy.id === date))
}

/**
 * Write the Done row for a finished night, or remove it when the night no longer
 * has two ends. The id is derived from the date, so this is idempotent.
 */
function syncSleepDoneRow(night: SleepNight, now: Date): void {
  const id = sleepDoneLogId(night.date)
  const minutes = sleepMinutes(night)
  const existing = taskRepository.getById(id)

  if (minutes === null) {
    if (existing) taskRepository.remove(id)
    return
  }

  const morning = parseLocalDate(night.date)
  if (!morning) return
  const wokeAt = new Date(morning.getTime() + (night.wokeMin as number) * 60_000)
  const sleptAt = new Date(morning.getTime() + (night.sleptMin as number) * 60_000)
  const estimated = isNightEstimated(night)
  const basis = `logged in Tracking: asleep ${offsetToLabel(night.sleptMin as number)}, awake ${offsetToLabel(
    night.wokeMin as number,
  )}`

  // A remembered night is an estimate the review can ask about; a night read off
  // a clock is not, and flagging it would train the user to dismiss the prompt.
  const estimates: FieldEstimate[] = estimated
    ? (["completedDate", "startedAt", "actualDuration"] as const).map((field) =>
        makeEstimate(field, "logged", basis, now),
      )
    : []

  const fields = {
    description: `Slept ${formatSleepDuration(minutes)}`,
    title: `Slept ${formatSleepDuration(minutes)}`,
    completedDate: wokeAt,
    startedAt: sleptAt,
    scheduledDate: wokeAt,
    actualDuration: minutes,
    estimatedDuration: minutes,
    estimates,
  }

  if (existing) {
    taskRepository.update({ ...existing, ...fields })
    return
  }

  taskRepository.add({
    id,
    type: LOGGED_ACTION_TYPE_ID,
    loggedAction: true,
    stage: "completed",
    status: "done",
    createdAt: wokeAt,
    completed: true,
    lists: [],
    tags: ["sleep"],
    links: [],
    rewardValue: 0,
    attributes: { sleepNight: night.date },
    ...fields,
  })
}

/**
 * Re-derive everything that follows from one night. Safe to call repeatedly —
 * that is the whole point of the `generatedBy` stamp and the deterministic row id.
 */
export function syncSleepNight(date: string, now = new Date()): void {
  const night = useSleepStore.getState().nights[date]
  const tracking = useTimeTrackingStore.getState()
  const target = findSleepPen(tracking.scopes)

  if (!night || sleepMinutes(night) === null) {
    setDerivedEntries(removeSleepEntries(tracking.entries, date))
    if (night) syncSleepDoneRow(night, now)
    else taskRepository.remove(sleepDoneLogId(date))
    syncTrackedHabits(nightSpan(date))
    return
  }

  if (target) {
    const next = applySleepEntries(tracking.entries, night, target.scope.id, target.pen.id)
    if (next !== tracking.entries) setDerivedEntries(next)
  }
  syncSleepDoneRow(night, now)
  syncTrackedHabits(nightDateKeys(night))
}

/**
 * True while this module is writing one side from the other.
 *
 * The log derives blocks and edited blocks correct the log, so without a latch
 * the two would answer each other forever. Every write goes through here, and
 * the listeners below stand down while one is in flight.
 *
 * `useSleepSync` also paints already-hydrated nights when a sleep-aware view
 * mounts. Persist hydrates the log and the grid independently; if the listener
 * attaches after both have landed, Analytics still sees the hours and the Time
 * Grid does not — unless we re-derive once both vaults are ready.
 */
let deriving = false

function setDerivedEntries(entries: TimeEntry[]): void {
  deriving = true
  try {
    useTimeTrackingStore.setState({ entries })
  } finally {
    deriving = false
  }
}

/** Test-only: write the grid without the subscriber treating it as an erase. */
export function replaceEntriesForTests(entries: TimeEntry[]): void {
  setDerivedEntries(entries)
}

/**
 * Take the grid's word for a night the log already claims.
 *
 * A derived block is not a read-only artifact: dragging one to 8 AM is the
 * plainest way to say "I got up at 8", and before this the edit was reverted the
 * next time anything touched the log — the tracker showed one thing and
 * Analytics reported another. Now the correction travels back, so the log, the
 * grid, the Done row and the Sleep tab cannot disagree about a night.
 *
 * Only nights the log *generated* are reconciled, and only when their blocks
 * existed a moment ago — so a user with no Sleep pen, whose nights were never
 * painted, can never have the log emptied by a grid that was always silent.
 *
 * Confidence is left alone. Whether a time is estimated is a claim about how
 * well it is remembered, and moving a block says nothing about that either way.
 *
 * @returns whether the log changed.
 */
export function reconcileNightFromGrid(date: string, now = new Date()): boolean {
  const store = useSleepStore.getState()
  const night = store.nights[date]
  if (!night) return false

  const painted = nightFromGeneratedBlocks(useTimeTrackingStore.getState().entries, date)

  if (!painted) {
    // Nothing to read *because there is nowhere to paint* is not the user
    // erasing a night. Deleting the Sleep pen takes its blocks with it, and that
    // says something about the pen, not about last Tuesday.
    if (!findSleepPen(useTimeTrackingStore.getState().scopes)) return false
    // Every block this night produced is gone: the night was erased from the
    // grid, and the log follows rather than resurrecting it on the next edit.
    writeBack(() => store.clearNight(date))
    taskRepository.remove(sleepDoneLogId(date))
    syncTrackedHabits(nightSpan(date))
    return true
  }

  if (painted.sleptMin === night.sleptMin && painted.wokeMin === night.wokeMin) return false

  const corrected: SleepNight = { ...night, ...painted, updatedAt: new Date(now).toISOString() }
  writeBack(() => useSleepStore.setState({ nights: { ...store.nights, [date]: corrected } }))
  syncSleepDoneRow(corrected, now)
  syncTrackedHabits(nightSpan(date))
  return true
}

/** Write to the log without the log's own listener deriving blocks back out. */
function writeBack(change: () => void): void {
  deriving = true
  try {
    change()
  } finally {
    deriving = false
  }
}

/** Nights that currently have derived blocks on the grid. */
function generatedNightIds(entries: TimeEntry[]): Set<string> {
  const ids = new Set<string>()
  for (const entry of entries) {
    if (entry.generatedBy?.kind === "sleep") ids.add(entry.generatedBy.id)
  }
  return ids
}

/** Both calendar days a night can touch, whether or not it currently does. */
function nightSpan(date: string): string[] {
  return nightDateKeys({ date })
}

/** How far back to look for a routine when a specific night is unknown. */
const TYPICAL_WINDOW_DAYS = 30

/**
 * The night that ended on `dateKey`, from the best source available.
 *
 * Order of preference, strongest evidence first: what the user stated, then what
 * they painted on the grid (`lib/sleep-inference.ts`). Nothing is invented — a
 * night no one has anything to say about comes back `undefined`.
 */
export function resolvedNight(dateKey: string): SleepNight | undefined {
  const { nights } = useSleepStore.getState()
  const { scopes, entries } = useTimeTrackingStore.getState()
  return resolveNights(nights, { scopes, entries }, [dateKey])[dateKey]
}

/**
 * The user's routine over the last month, for standing in where a specific night
 * is unknown. Logged and painted nights both count.
 */
export function typicalNight(today = new Date()): TypicalSleepWindow | undefined {
  const { nights } = useSleepStore.getState()
  const { scopes, entries } = useTimeTrackingStore.getState()
  const keys = recentDateKeys(TYPICAL_WINDOW_DAYS, today)
  return typicalSleepWindow(resolveNights(nights, { scopes, entries }, keys), keys)
}

/**
 * The waking hours of a calendar day, for `lib/completion-window.ts`.
 *
 * Two different nights bound one day: the one that *ended* that morning gives the
 * wake time, and the one that started that evening — keyed to the next morning —
 * gives the bedtime. Reading both is what lets a completion be placed inside the
 * hours the user was actually up.
 *
 * Each end degrades on its own: a stated time, else one read off the grid, else
 * the user's own median for the last month. Falling back to the routine is what
 * keeps a back-filled Tuesday from being anchored to a factory-default 9 PM when
 * the app has a month of evidence that this person goes to bed at 1 AM. Nothing
 * is returned at all when there is no evidence of any kind.
 */
export function awakeWindowFor(
  dateKey: string,
  today = new Date(),
): { wake?: number; bed?: number; source?: SleepEvidence } | undefined {
  const morning = resolvedNight(dateKey)
  const evening = resolvedNight(nextDateKey(dateKey))
  const typical = typicalNight(today)

  const wake = morning?.wokeMin ?? typical?.wake
  // A bedtime is stored relative to the *next* morning, so shift it back onto
  // this day: -30 (11:30 PM) becomes 1410, and 45 (00:45) becomes 1485.
  const bedOffset = evening?.sleptMin ?? typical?.bedtime
  const bed = bedOffset === undefined ? undefined : bedOffset + MINUTES_PER_DAY

  if (wake === undefined && bed === undefined) return undefined
  return { wake, bed, source: evidenceFor(evening, bedOffset !== undefined) }
}

/** How firmly the bedtime half of the window is known. */
function evidenceFor(evening: SleepNight | undefined, hasBed: boolean): SleepEvidence | undefined {
  if (!hasBed) return undefined
  if (evening?.sleptMin === undefined) return "typical"
  return evening.source === "tracked" || evening.source === "mixed" ? "tracked" : "logged"
}

/** Re-derive every logged night — for restores and migrations. */
export function syncAllSleepNights(now = new Date()): void {
  for (const date of Object.keys(useSleepStore.getState().nights)) syncSleepNight(date, now)
}

let started = false
let paintedLoggedNights = false

type PersistGate = {
  hasHydrated?: () => boolean
  onFinishHydration?: (fn: () => void) => () => void
}

/**
 * Run `fn` once the store's persisted snapshot is in memory — or immediately
 * when there is no persist layer (tests, first paint of a default state).
 *
 * Logged nights live in `cogs-sleep-store`. Derived Sleep blocks live in
 * `cogs-timegrid-store`. Those two hydrate independently. If the listener below
 * is attached *after* both have already landed, it never sees a change, and the
 * Time Grid stays blank while Analytics → Sleep (which reads the log) still
 * shows the hours. Waiting for both, then calling `syncAllSleepNights`, is what
 * closes that gap. Applying sleep onto the grid *before* tracking hydrates
 * would be overwritten by the vault and look the same.
 */
function afterPersistHydrated(persist: PersistGate | undefined, fn: () => void): () => void {
  if (!persist?.hasHydrated || persist.hasHydrated()) {
    fn()
    return () => {}
  }
  return persist.onFinishHydration?.(fn) ?? (() => {})
}

/**
 * Keep the log and the grid in step, in **both** directions, for as long as a
 * sleep-aware view is mounted. Process-wide singleton, like
 * `useHabitTrackingSync`.
 *
 * - Log changed → re-derive that night's blocks, Done row and habit minutes.
 * - Blocks changed → take the grid's word for the nights it just redescribed.
 * - View mounted after both vaults hydrated → paint nights that were already
 *   in the log, so Tracking cannot lag Analytics.
 *
 * The `deriving` latch keeps one from triggering the other; both directions are
 * idempotent, so a write that changes nothing stops there.
 */
export function useSleepSync(): void {
  useEffect(() => {
    let cancelled = false
    let sleepReady = false
    let trackReady = false
    const paintLogged = () => {
      if (cancelled || !sleepReady || !trackReady) return
      // Remounts (Time Grid, Morning Review) must not re-derive every night.
      // A first hydrate, or a log that never made it onto the grid, still
      // paints. Dialogs do not call this hook.
      if (paintedLoggedNights) {
        const nights = useSleepStore.getState().nights
        const ids = generatedNightIds(useTimeTrackingStore.getState().entries)
        const missing = Object.keys(nights).some((key) => {
          const night = nights[key]
          return Boolean(night && sleepMinutes(night) !== null && !ids.has(key))
        })
        if (!missing) return
      }
      paintedLoggedNights = true
      syncAllSleepNights()
    }
    const unSleep = afterPersistHydrated(useSleepStore.persist, () => {
      sleepReady = true
      paintLogged()
    })
    const unTrack = afterPersistHydrated(useTimeTrackingStore.persist, () => {
      trackReady = true
      paintLogged()
    })

    if (!started) {
      started = true

      useSleepStore.subscribe((state, previous) => {
        if (deriving || state.nights === previous.nights) return
        const keys = new Set([...Object.keys(state.nights), ...Object.keys(previous.nights)])
        for (const key of keys) {
          if (state.nights[key] !== previous.nights[key]) syncSleepNight(key)
        }
      })

      useTimeTrackingStore.subscribe((state, previous) => {
        if (deriving || state.entries === previous.entries) return
        // Nights whose blocks existed a moment ago are the ones a user could have
        // just edited or deleted; a night that appears out of nowhere is this
        // module's own work and has nothing to say back.
        for (const date of generatedNightIds(previous.entries)) reconcileNightFromGrid(date)
      })
    }

    return () => {
      cancelled = true
      unSleep()
      unTrack()
    }
  }, [])
}

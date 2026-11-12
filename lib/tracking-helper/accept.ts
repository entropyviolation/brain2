/**
 * lib/tracking-helper/accept.ts — Write the Helper's blocks to Tracking, as one undo step
 *
 * Each block paints an Activity entry, and a Location entry over the same span when the block has a
 * place. Both are stamped `generatedBy: { kind: "llm", id: "tracking-helper:<id>" }` and
 * `createdBy.surface = "tracking-helper"`, so they can be found and swept, and they may overlap other
 * LLM blocks the way BIM's accepted blocks do. Notes start "Created from Tracking helper". An edge the
 * person called a guess is stored `estimated`, so the grid hatches it. Time the person painted by hand
 * refuses the block unless `force` is set (the card offers "Add anyway"); then it is layered on top and
 * Tracking's overlap handling takes over. A block over midnight is written as one entry per day.
 */
"use client"

import { runAsAction } from "@/lib/action-history"
import { deferSyncs } from "@/lib/defer-sync"
import { briefOf } from "@/lib/habit-helper/accept"
import { activeTrackingLink, supportsTrackingLink } from "@/lib/habit-tracking"
import { useHabitsStore } from "@/lib/habits-store"
import { dayPieces } from "@/lib/bim-flow/accept"
import { ensureActivityPen } from "@/lib/ingest/apply-activity-span"
import { ensureLocationPen } from "@/lib/ingest/apply-discrete-event"
import { registerItemWriteSurface, withItemWriteSource } from "@/lib/item-write-source"
import type { TimeEntry } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { clockText } from "./clock"
import { matchPen } from "./places"
import type { CountHabit } from "./count"
import type { HistoryRow, HelperContext, ProposedBlock } from "./types"

export const HELPER_SURFACE = "tracking-helper"
registerItemWriteSurface({ id: HELPER_SURFACE, label: "Tracking Helper" })

const ACTIVITY = "activity"
const LOCATION = "location"

const isoOf = (day: string, min: number) => {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y!, m! - 1, d!, 0, min).toISOString()
}

export const isHelperBlock = (e: Pick<TimeEntry, "generatedBy">) => e.generatedBy?.kind === "llm" && e.generatedBy.id.startsWith("tracking-helper:")

/** The pens and recent history the Helper reads to match names and learn places. */
export function buildContext(now = new Date(), days = 180): HelperContext {
  const { scopes, entries } = useTimeTrackingStore.getState()
  const name = new Map<string, string>()
  for (const s of scopes) for (const p of s.pens) name.set(p.id, p.name)
  const pensOf = (id: string) => scopes.find((s) => s.id === id)?.pens.map((p) => ({ id: p.id, name: p.name })) ?? []
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days).toISOString().slice(0, 10)
  const history: HistoryRow[] = entries
    .filter((e) => (e.scopeId === ACTIVITY || e.scopeId === LOCATION) && e.kind !== "instant" && e.endMin > e.startMin && e.date >= since)
    .map((e) => ({ date: e.date, scopeId: e.scopeId, pen: name.get(e.penId) ?? "", startMin: e.startMin, endMin: e.endMin }))
  return { now, activityPens: pensOf(ACTIVITY), locationPens: pensOf(LOCATION), history, habits: countHabits() }
}

/** Daily habits as `count.ts` reads them: words from the name, keywords and the tags that fill them. */
function countHabits(): CountHabit[] {
  const { tasks } = useHabitsStore.getState()
  const tags = useTimeTrackingStore.getState().tags ?? []
  const tagName = (id: string) => tags.find((t) => t.id === id)?.name
  return tasks
    .filter((t) => (t.frequency || "daily") === "daily")
    .map((t) => ({ brief: briefOf(t, {}, tagName), tagIds: activeTrackingLink(t)?.tagIds ?? [], linkable: supportsTrackingLink(t) }))
}

/**
 * Tag ids for one block: the tags the person named (made if new) plus the habit's Tracking tags, so the
 * habit's existing sync credits the minutes. A habit with no link yet gets one, on a tag named for it.
 * Returns the ids to put on the block's `tagIds`, and a line for the notes.
 */
function tagIdsFor(b: ProposedBlock): { ids: string[]; note: string } {
  const tt = useTimeTrackingStore.getState()
  const ids = new Set<string>()
  for (const name of b.tags ?? []) {
    const id = tt.addTag(name)
    if (id) ids.add(id)
  }
  let note = ""
  if (b.habit) {
    const hs = useHabitsStore.getState()
    const task = hs.tasks.find((t) => t.id === b.habit!.id)
    if (task && supportsTrackingLink(task)) {
      let link = activeTrackingLink(task)
      if (!link) {
        const tagId = useTimeTrackingStore.getState().addTag(task.name)
        if (tagId) hs.updateTask({ ...task, trackingLink: { ...(task.trackingLink ?? { unit: "minutes", mode: "add" as const }), tagIds: [...new Set([...(task.trackingLink?.tagIds ?? []), tagId])], enabled: true } })
        link = tagId ? { tagIds: [tagId] } : undefined
      }
      for (const id of link?.tagIds ?? []) ids.add(id)
      note = `Counts for the habit “${task.name}”.`
    }
  }
  return { ids: [...ids], note }
}

const pieces = (b: ProposedBlock) => (b.startMin === null || b.endMin === null ? [] : dayPieces(isoOf(b.day, b.startMin), isoOf(b.day, b.endMin)))

/** Activity the person painted by hand that this block would sit on. */
export function conflictsOf(b: ProposedBlock, entries: TimeEntry[]): TimeEntry[] {
  const ps = pieces(b)
  return entries.filter((e) => e.scopeId === ACTIVITY && e.kind !== "instant" && e.generatedBy?.kind !== "llm" && ps.some((p) => e.date === p.date && e.startMin < p.endMin && e.endMin > p.startMin))
}

function notesOf(b: ProposedBlock, extra = ""): string {
  const edge = (min: number, cert: string, chained?: boolean, open?: boolean) => `${clockText(min)}${cert === "estimated" ? " (est)" : ""}${chained ? " (from the next/previous block)" : ""}${open ? " (not given)" : ""}`
  return [
    "Created from Tracking helper.",
    b.with ? `With ${b.with}.` : "",
    b.mood ? `Felt ${b.mood}.` : "",
    b.notes,
    extra,
    `Said: “${b.from}”`,
    `Start ${edge(b.startMin!, b.startCert, b.startChained, b.openStart)}; end ${edge(b.endMin!, b.endCert, b.endChained, b.openEnd)}.`,
    b.place?.source === "assumed" ? `Place ${b.place.name} assumed, not said.` : b.place?.source === "learned" ? `Place ${b.place.name} learned from past days.` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export interface HelperAccepted {
  ok: boolean
  wrote: number
  /** Blocks left unwritten, with why. */
  refused: { id: string; why: string }[]
  message: string
}

export function acceptBlocks(blocks: ProposedBlock[], opts: { force?: boolean } = {}): HelperAccepted {
  const entries = useTimeTrackingStore.getState().entries
  const refused: HelperAccepted["refused"] = []
  const todo: ProposedBlock[] = []
  for (const b of blocks) {
    if (b.startMin === null || b.endMin === null || b.endMin <= b.startMin) refused.push({ id: b.id, why: "NEEDS A START AND END" })
    else if (!opts.force && conflictsOf(b, entries).length) refused.push({ id: b.id, why: "OVER TIME YOU PAINTED" })
    else todo.push(b)
  }
  if (!todo.length) return { ok: false, wrote: 0, refused, message: refused[0]?.why ?? "NOTHING TO ADD" }
  let wrote = 0
  try {
    // Habit and pen syncs run after the next paint, not inside the write, so the screen never waits on them.
    deferSyncs(() => runAsAction(`Tracking Helper: add ${todo.length} block${todo.length === 1 ? "" : "s"}`, () => {
      withItemWriteSource({ surface: HELPER_SURFACE }, () => {
        const store = useTimeTrackingStore.getState()
        const scopes = store.scopes
        const add: Omit<TimeEntry, "id">[] = []
        for (const b of todo) {
          const actPens = scopes.find((s) => s.id === ACTIVITY)?.pens ?? []
          const penId = matchPen(b.activity, actPens)?.id ?? ensureActivityPen(b.activity)
          const counts = tagIdsFor(b)
          const placePen = b.place ? matchPen(b.place.name, scopes.find((s) => s.id === LOCATION)?.pens ?? [])?.id || ensureLocationPen(b.place.name) : ""
          for (const p of pieces(b)) {
            const base = { date: p.date, startMin: p.startMin, endMin: p.endMin, ...(b.startCert === "estimated" ? { startCertainty: "estimated" as const } : {}), ...(b.endCert === "estimated" ? { endCertainty: "estimated" as const } : {}) }
            add.push({ ...base, scopeId: ACTIVITY, penId, ...(counts.ids.length ? { tagIds: counts.ids } : {}), notes: notesOf(b, counts.note), generatedBy: { kind: "llm", id: `${HELPER_SURFACE}:${b.id}` } })
            if (placePen) add.push({ ...base, scopeId: LOCATION, penId: placePen, notes: "Created from Tracking helper.", generatedBy: { kind: "llm", id: `${HELPER_SURFACE}:${b.id}:place` } })
          }
          wrote += 1
        }
        useTimeTrackingStore.getState().layerEntries(add)
      })
    }))
  } catch (err) {
    return { ok: false, wrote: 0, refused, message: `FAILED: ${err instanceof Error ? err.message.toUpperCase() : "ERROR"}` }
  }
  return { ok: true, wrote, refused, message: `ADDED ${wrote} BLOCK${wrote === 1 ? "" : "S"}${refused.length ? ` · ${refused.length} NOT ADDED` : ""}` }
}

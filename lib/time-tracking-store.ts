/**
 * lib/time-tracking-store.ts — TimeGrid-style life tracker
 *
 * A color-grid tracker modeled after the Brain2 "TimeGrid": the day is split into
 * fixed-length slots (default 15 min → 96 slots) and the user paints each slot
 * with a "pen". Pens are grouped into independent *scopes* (e.g. Activity,
 * Location, Mood) so the same minute can be tagged along several dimensions, each
 * viewed/edited separately. This replaces the old free-text cognitive-state log
 * as the primary capture surface (it is what the header "Tracking" button and the
 * Home "Tracking" tab render).
 *
 * Persisted to localStorage under `cogs-timegrid-store`. Target: MongoDB
 * `timeIntervals` collection (see docs/SPEC_MAPPING.md §3).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export const SLOT_MINUTES = 15
export const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES // 96

export interface TrackPen {
  id: string
  name: string
  color: string
}

export interface TrackScope {
  id: string
  name: string
  pens: TrackPen[]
}

// data[YYYY-MM-DD][scopeId] = array (length SLOTS_PER_DAY) of penId | null
type DayData = Record<string, Record<string, (string | null)[]>>

export interface TimeBlockDetail {
  date: string
  scopeId: string
  penId: string
  startSlot: number
  endSlot: number
  notes?: string
  /** Activity-specific detail (e.g. book title, project name). */
  title?: string
  pages?: number
  project?: string
  books?: string
}

interface TimeTrackingState {
  scopes: TrackScope[]
  data: DayData
  blockDetails: TimeBlockDetail[]
  activeScopeId: string
  selectedPenId: string | null

  setActiveScope: (id: string) => void
  setSelectedPen: (id: string | null) => void

  addScope: (name: string) => void
  removeScope: (id: string) => void
  renameScope: (id: string, name: string) => void

  addPen: (scopeId: string, pen: Omit<TrackPen, "id">) => void
  updatePen: (scopeId: string, pen: TrackPen) => void
  removePen: (scopeId: string, penId: string) => void

  paintRange: (date: string, scopeId: string, from: number, to: number, penId: string | null) => void
  paintSlot: (date: string, scopeId: string, slot: number, penId: string | null) => void
  clearDay: (date: string, scopeId: string) => void
  getDay: (date: string, scopeId: string) => (string | null)[]

  setBlockDetail: (detail: TimeBlockDetail) => void
  getBlockDetail: (date: string, scopeId: string, penId: string, startSlot: number, endSlot: number) => TimeBlockDetail | undefined
}

const rid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

const defaultScopes = (): TrackScope[] => [
  {
    id: "activity",
    name: "Activity",
    pens: [
      { id: "act-work", name: "Work", color: "#2563eb" },
      { id: "act-rest", name: "Rest", color: "#10b981" },
      { id: "act-exercise", name: "Exercise", color: "#f59e0b" },
      { id: "act-social", name: "Social", color: "#ec4899" },
      { id: "act-chores", name: "Chores", color: "#8b5cf6" },
      { id: "act-sleep", name: "Sleep", color: "#1e293b" },
    ],
  },
  {
    id: "location",
    name: "Location",
    pens: [
      { id: "loc-home", name: "Home", color: "#16a34a" },
      { id: "loc-work", name: "Work", color: "#0ea5e9" },
      { id: "loc-out", name: "Outside", color: "#f97316" },
      { id: "loc-transit", name: "Transit", color: "#a855f7" },
    ],
  },
  {
    id: "mood",
    name: "Mood",
    pens: [
      { id: "mood-great", name: "Great", color: "#22c55e" },
      { id: "mood-good", name: "Good", color: "#84cc16" },
      { id: "mood-meh", name: "Meh", color: "#eab308" },
      { id: "mood-low", name: "Low", color: "#ef4444" },
    ],
  },
]

const emptyDay = (): (string | null)[] => new Array(SLOTS_PER_DAY).fill(null)

function findBlockRange(slots: (string | null)[], slot: number): { start: number; end: number; penId: string } | null {
  const penId = slots[slot]
  if (!penId) return null
  let start = slot
  let end = slot
  while (start > 0 && slots[start - 1] === penId) start--
  while (end < SLOTS_PER_DAY - 1 && slots[end + 1] === penId) end++
  return { start, end, penId }
}

function detailKey(b: TimeBlockDetail) {
  return `${b.date}|${b.scopeId}|${b.penId}|${b.startSlot}|${b.endSlot}`
}

function findDetailCoveringSlot(
  blockDetails: TimeBlockDetail[],
  date: string,
  scopeId: string,
  slots: (string | null)[],
  slot: number,
): TimeBlockDetail | undefined {
  const penId = slots[slot]
  if (!penId) return undefined
  const range = findBlockRange(slots, slot)
  if (!range) return undefined
  return blockDetails.find(
    (b) =>
      b.date === date &&
      b.scopeId === scopeId &&
      b.penId === penId &&
      b.startSlot <= range.end &&
      b.endSlot >= range.start,
  )
}

function largestContiguousRun(slots: (string | null)[], penId: string, within: { start: number; end: number }) {
  const segments: { start: number; end: number }[] = []
  let start = -1
  for (let i = within.start; i <= within.end; i++) {
    if (slots[i] === penId) {
      if (start < 0) start = i
    } else if (start >= 0) {
      segments.push({ start, end: i - 1 })
      start = -1
    }
  }
  if (start >= 0) segments.push({ start, end: within.end })
  if (segments.length === 0) return null
  return segments.sort((a, b) => b.end - b.start - (a.end - a.start))[0]
}

function migrateDetailsAfterSlotPaint(
  blockDetails: TimeBlockDetail[],
  date: string,
  scopeId: string,
  slot: number,
  oldSlots: (string | null)[],
  newSlots: (string | null)[],
  newPenId: string | null,
): TimeBlockDetail[] {
  const oldDetail = findDetailCoveringSlot(blockDetails, date, scopeId, oldSlots, slot)
  let next = [...blockDetails]

  if (oldDetail) {
    const penId = oldDetail.penId
    next = next.filter((b) => detailKey(b) !== detailKey(oldDetail))

    if (newPenId === penId) {
      const expanded = findBlockRange(newSlots, slot)
      if (expanded) {
        next.push({ ...oldDetail, startSlot: expanded.start, endSlot: expanded.end })
      }
    } else {
      const remnant = largestContiguousRun(newSlots, penId, {
        start: oldDetail.startSlot,
        end: oldDetail.endSlot,
      })
      if (remnant) {
        next.push({ ...oldDetail, startSlot: remnant.start, endSlot: remnant.end })
      }
    }
    return next
  }

  if (newPenId) {
    const merged = findBlockRange(newSlots, slot)
    if (!merged) return next

    const nearbyDetail = blockDetails.find(
      (b) =>
        b.date === date &&
        b.scopeId === scopeId &&
        b.penId === newPenId &&
        b.startSlot <= merged.end + 1 &&
        b.endSlot >= merged.start - 1,
    )
    if (nearbyDetail) {
      next = next.filter((b) => detailKey(b) !== detailKey(nearbyDetail))
      next.push({ ...nearbyDetail, startSlot: merged.start, endSlot: merged.end })
    }
  }

  return next
}

export const useTimeTrackingStore = create<TimeTrackingState>()(
  persist(
    (set, get) => ({
      scopes: defaultScopes(),
      data: {},
      blockDetails: [],
      activeScopeId: "activity",
      selectedPenId: null,

      setActiveScope: (id) => {
        const scope = get().scopes.find((s) => s.id === id)
        set({ activeScopeId: id, selectedPenId: scope?.pens[0]?.id ?? null })
      },
      setSelectedPen: (id) => set({ selectedPenId: id }),

      addScope: (name) =>
        set((state) => {
          const penId = rid("pen")
          const scope: TrackScope = {
            id: rid("scope"),
            name,
            pens: [{ id: penId, name: "Default", color: "#6366f1" }],
          }
          return { scopes: [...state.scopes, scope], activeScopeId: scope.id, selectedPenId: penId }
        }),
      removeScope: (id) =>
        set((state) => ({
          scopes: state.scopes.filter((s) => s.id !== id),
          activeScopeId: state.activeScopeId === id ? state.scopes[0]?.id ?? "" : state.activeScopeId,
        })),
      renameScope: (id, name) =>
        set((state) => ({ scopes: state.scopes.map((s) => (s.id === id ? { ...s, name } : s)) })),

      addPen: (scopeId, pen) =>
        set((state) => ({
          scopes: state.scopes.map((s) =>
            s.id === scopeId ? { ...s, pens: [...s.pens, { ...pen, id: rid("pen") }] } : s,
          ),
        })),
      updatePen: (scopeId, pen) =>
        set((state) => ({
          scopes: state.scopes.map((s) =>
            s.id === scopeId ? { ...s, pens: s.pens.map((p) => (p.id === pen.id ? pen : p)) } : s,
          ),
        })),
      removePen: (scopeId, penId) =>
        set((state) => {
          const nextData: DayData = { ...state.data }
          for (const date of Object.keys(nextData)) {
            const day = { ...nextData[date] }
            for (const sid of Object.keys(day)) {
              day[sid] = day[sid].map((pid) => (pid === penId ? null : pid))
            }
            nextData[date] = day
          }
          return {
            scopes: state.scopes.map((s) =>
              s.id === scopeId ? { ...s, pens: s.pens.filter((p) => p.id !== penId) } : s,
            ),
            data: nextData,
            blockDetails: state.blockDetails.filter((b) => b.penId !== penId),
            selectedPenId: state.selectedPenId === penId ? null : state.selectedPenId,
          }
        }),

      paintRange: (date, scopeId, from, to, penId) =>
        set((state) => {
          const lo = Math.max(0, Math.min(from, to))
          const hi = Math.min(SLOTS_PER_DAY - 1, Math.max(from, to))
          const day = { ...(state.data[date] || {}) }
          const slots = [...(day[scopeId] || emptyDay())]
          for (let i = lo; i <= hi; i++) slots[i] = penId
          day[scopeId] = slots
          return { data: { ...state.data, [date]: day } }
        }),

      paintSlot: (date, scopeId, slot, penId) =>
        set((state) => {
          if (slot < 0 || slot >= SLOTS_PER_DAY) return state
          const day = { ...(state.data[date] || {}) }
          const oldSlots = [...(day[scopeId] || emptyDay())]
          const newSlots = [...oldSlots]
          newSlots[slot] = penId
          day[scopeId] = newSlots
          const blockDetails = migrateDetailsAfterSlotPaint(
            state.blockDetails,
            date,
            scopeId,
            slot,
            oldSlots,
            newSlots,
            penId,
          )
          return { data: { ...state.data, [date]: day }, blockDetails }
        }),
      clearDay: (date, scopeId) =>
        set((state) => {
          const day = { ...(state.data[date] || {}) }
          day[scopeId] = emptyDay()
          return { data: { ...state.data, [date]: day } }
        }),
      getDay: (date, scopeId) => get().data[date]?.[scopeId] || emptyDay(),

      setBlockDetail: (detail) =>
        set((state) => {
          const filtered = state.blockDetails.filter((b) => detailKey(b) !== detailKey(detail))
          return { blockDetails: [...filtered, detail] }
        }),

      getBlockDetail: (date, scopeId, penId, startSlot, endSlot) =>
        get().blockDetails.find(
          (b) =>
            b.date === date &&
            b.scopeId === scopeId &&
            b.penId === penId &&
            b.startSlot === startSlot &&
            b.endSlot === endSlot,
        ),
    }),
    { name: "cogs-timegrid-store", version: 2 },
  ),
)

// ---- helpers ----------------------------------------------------------------

export function slotToLabel(slot: number): string {
  const mins = slot * SLOT_MINUTES
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const period = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`
}

export function timeStringToSlot(value: string): number | null {
  // value like "13:30"
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return Math.floor((h * 60 + min) / SLOT_MINUTES)
}

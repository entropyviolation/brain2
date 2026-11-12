/**
 * lib/pharmacy-store.ts — Bottles on hand, and what took from them
 *
 * Storage: `brain2-pharmacy` (persist v1). An item is a bottle with a count.
 * Every draw has a source key (`intake:{entryId}`, `habit:{habitId}:{date}`,
 * `hand:{id}`). The ledger remembers what each key took, so writing the same
 * key twice takes it once, a smaller value gives units back, and deleting the
 * source refunds it. That is what lets an NFC scan, an Intake line, and a
 * linked habit all report one dose without taking it three times.
 * A habit draws only what the Intake lines of that day did not already take.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { formatLocalDateKey } from "@/lib/date-utils"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import {
  newPharmacyId,
  pharmacyAmount,
  sanitizePharmacyItem,
  type PharmacyItem,
  type PharmacyLedgerRow,
  type PharmacyLogRow,
  type PharmacySource,
} from "@/lib/pharmacy-math"
import { persistKey } from "@/lib/storage-keys"

export const PHARMACY_STORAGE_KEY = persistKey("pharmacy")
const LOG_CAP = 400

export type PharmacyDraft = Partial<PharmacyItem> & { name: string }

interface PharmacyState {
  items: PharmacyItem[]
  ledger: Record<string, PharmacyLedgerRow>
  log: PharmacyLogRow[]
  addItem: (draft: PharmacyDraft, now?: Date) => PharmacyItem | null
  updateItem: (id: string, patch: Partial<PharmacyItem>) => void
  removeItem: (id: string) => void
  /** Hand fix: the bottle holds this many now. */
  setCount: (id: string, count: number, now?: Date) => void
  /** A full bottle again, or `add` more on top of what is there. */
  refill: (id: string, add?: number, now?: Date) => void
  /** Idempotent. The key takes `units` in total, however many times this runs. */
  draw: (itemId: string, key: string, units: number, date: string, source: PharmacySource, now?: Date) => void
  /** Give a key's units back and forget it. */
  refund: (key: string, now?: Date) => void
  /** Habit cell worth `rawUnits`, less what Intake lines of that day already took. */
  reconcileHabit: (itemId: string, habitId: string, date: string, rawUnits: number, now?: Date) => void
}

function logRow(itemId: string, delta: number, source: PharmacySource, now: Date, note?: string): PharmacyLogRow {
  return { id: newPharmacyId("rxlog"), itemId, at: now.toISOString(), delta, source, ...(note ? { note } : {}) }
}

function appendLog(log: PharmacyLogRow[], rows: PharmacyLogRow[]): PharmacyLogRow[] {
  const next = [...log, ...rows.filter((row) => row.delta !== 0)]
  return next.length > LOG_CAP ? next.slice(next.length - LOG_CAP) : next
}

/** Units the Intake and NFC keys of one item took on one day. */
export function intakeUnitsOn(ledger: Record<string, PharmacyLedgerRow>, itemId: string, date: string): number {
  let total = 0
  for (const [key, row] of Object.entries(ledger)) {
    if (row.itemId === itemId && row.date === date && !key.startsWith("habit:")) total += row.units
  }
  return total
}

export function habitKey(habitId: string, date: string): string {
  return `habit:${habitId}:${date}`
}

export function sanitizePharmacy(raw: unknown, today = formatLocalDateKey(new Date())): Pick<PharmacyState, "items" | "ledger" | "log"> {
  const source = (raw && typeof raw === "object" ? raw : {}) as Partial<PharmacyState>
  const items: PharmacyItem[] = []
  for (const row of Array.isArray(source.items) ? source.items : []) {
    const clean = sanitizePharmacyItem(row, today)
    if (clean && !items.some((item) => item.id === clean.id)) items.push(clean)
  }
  const ledger: Record<string, PharmacyLedgerRow> = {}
  if (source.ledger && typeof source.ledger === "object") {
    for (const [key, row] of Object.entries(source.ledger)) {
      const units = pharmacyAmount(row?.units, 0)
      if (!row || units <= 0 || !items.some((item) => item.id === row.itemId)) continue
      ledger[key] = { itemId: row.itemId, units, date: String(row.date ?? ""), source: row.source ?? "hand" }
    }
  }
  const log = (Array.isArray(source.log) ? source.log : []).filter(
    (row): row is PharmacyLogRow =>
      Boolean(row) && typeof row.itemId === "string" && typeof row.at === "string" && Number.isFinite(row.delta),
  )
  return { items, ledger, log: log.slice(-LOG_CAP) }
}

export const usePharmacyStore = create<PharmacyState>()(
  persist(
    (set, get) => ({
      items: [],
      ledger: {},
      log: [],

      addItem: (draft, now = new Date()) => {
        const clean = sanitizePharmacyItem({ ...draft, id: draft.id ?? newPharmacyId("rx") }, formatLocalDateKey(now))
        if (!clean) return null
        set((state) => ({ items: [...state.items.filter((row) => row.id !== clean.id), clean] }))
        return clean
      },

      updateItem: (id, patch) =>
        set((state) => {
          const prev = state.items.find((row) => row.id === id)
          if (!prev) return state
          const today = formatLocalDateKey(new Date())
          const linkChanged = "habitId" in patch && patch.habitId !== prev.habitId
          const clean = sanitizePharmacyItem(
            {
              ...prev,
              ...patch,
              id,
              addedOn: prev.addedOn,
              habitSince: linkChanged ? today : (patch.habitSince ?? prev.habitSince),
            },
            today,
          )
          if (!clean) return state
          const ledger = { ...state.ledger }
          // Taking a habit off removes nothing already taken, but its future days stop.
          if (linkChanged && prev.habitId) {
            for (const [key, row] of Object.entries(ledger)) {
              if (row.itemId === id && key.startsWith("habit:")) delete ledger[key]
            }
          }
          return { items: state.items.map((row) => (row.id === id ? clean : row)), ledger }
        }),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((row) => row.id !== id),
          ledger: Object.fromEntries(Object.entries(state.ledger).filter(([, row]) => row.itemId !== id)),
          log: state.log.filter((row) => row.itemId !== id),
        })),

      setCount: (id, count, now = new Date()) =>
        set((state) => {
          const prev = state.items.find((row) => row.id === id)
          if (!prev) return state
          const next = pharmacyAmount(count, prev.count)
          return {
            items: state.items.map((row) => (row.id === id ? { ...row, count: next } : row)),
            log: appendLog(state.log, [logRow(id, next - prev.count, "fix", now)]),
          }
        }),

      refill: (id, add, now = new Date()) =>
        set((state) => {
          const prev = state.items.find((row) => row.id === id)
          if (!prev) return state
          const next = add != null ? prev.count + pharmacyAmount(add, 0) : Math.max(prev.count, prev.capacity)
          const capacity = Math.max(prev.capacity, next)
          return {
            items: state.items.map((row) => (row.id === id ? { ...row, count: next, capacity } : row)),
            log: appendLog(state.log, [logRow(id, next - prev.count, "refill", now)]),
          }
        }),

      draw: (itemId, key, units, date, source, now = new Date()) =>
        set((state) => {
          const item = state.items.find((row) => row.id === itemId)
          if (!item) return state
          const want = pharmacyAmount(units, 0)
          const prior = state.ledger[key]
          const ledger = { ...state.ledger }
          let items = state.items
          const rows: PharmacyLogRow[] = []
          // A key that moved to another item gives the first one its units back.
          if (prior && prior.itemId !== itemId) {
            const old = state.items.find((row) => row.id === prior.itemId)
            if (old) {
              items = items.map((row) => (row.id === old.id ? { ...row, count: row.count + prior.units } : row))
              rows.push(logRow(old.id, prior.units, prior.source, now, "moved"))
            }
          }
          const already = prior && prior.itemId === itemId ? prior.units : 0
          const change = want - already
          if (want > 0) ledger[key] = { itemId, units: want, date, source }
          else delete ledger[key]
          if (change === 0 && rows.length === 0) return state
          const current = items.find((row) => row.id === itemId)!
          const nextCount = Math.max(0, current.count - change)
          items = items.map((row) => (row.id === itemId ? { ...row, count: nextCount } : row))
          rows.push(logRow(itemId, nextCount - current.count, source, now))
          return { items, ledger, log: appendLog(state.log, rows) }
        }),

      refund: (key, now = new Date()) => {
        const prior = get().ledger[key]
        if (!prior) return
        set((state) => {
          const ledger = { ...state.ledger }
          delete ledger[key]
          const item = state.items.find((row) => row.id === prior.itemId)
          if (!item) return { ledger }
          return {
            ledger,
            items: state.items.map((row) => (row.id === item.id ? { ...row, count: row.count + prior.units } : row)),
            log: appendLog(state.log, [logRow(item.id, prior.units, prior.source, now, "given back")]),
          }
        })
      },

      reconcileHabit: (itemId, habitId, date, rawUnits, now = new Date()) => {
        const state = get()
        const taken = intakeUnitsOn(state.ledger, itemId, date)
        const net = Math.max(0, rawUnits - taken)
        const key = habitKey(habitId, date)
        if (net <= 0 && !state.ledger[key]) return
        state.draw(itemId, key, net, date, "habit", now)
      },
    }),
    {
      name: PHARMACY_STORAGE_KEY,
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ items: state.items, ledger: state.ledger, log: state.log }),
      merge: (persisted, current) => ({ ...current, ...sanitizePharmacy(persisted) }),
    },
  ),
)

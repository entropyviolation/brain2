/**
 * lib/overcome-bimby/store.ts — LOG: the resistance log, kept across reloads
 *
 * Append-only. An entry is the person's words, what was heard, and which tactics were offered. Later the person marks which one
 * they tried and whether they started; the picker reads that to rank tactics next time. Nothing else is written anywhere.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage, registerPersistRehydrator } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import type { Outcome, Reading, ResistanceEntry } from "./types"

const MAX_ENTRIES = 500

interface OvercomeState {
  log: ResistanceEntry[]
  add: (said: string, reading: Reading, offered: string[], now?: Date) => string
  mark: (id: string, tacticId: string, outcome: Outcome, now?: Date) => void
}

export const useOvercomeStore = create<OvercomeState>()(
  persist(
    (set) => ({
      log: [],
      add: (said, reading, offered, now = new Date()) => {
        const id = `rs-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
        set((s) => ({ log: [...s.log, { id, at: now.toISOString(), said, reading, offered }].slice(-MAX_ENTRIES) }))
        return id
      },
      mark: (id, tacticId, outcome, now = new Date()) =>
        set((s) => ({ log: s.log.map((e) => (e.id === id ? { ...e, tried: { tacticId, outcome, at: now.toISOString() } } : e)) })),
    }),
    { name: persistKey("overcome-bimby-log"), storage: createCogsJSONStorage(), partialize: (s) => ({ log: s.log }), version: 1 },
  ),
)

registerPersistRehydrator(persistKey("overcome-bimby-log"), () => useOvercomeStore.persist.rehydrate())

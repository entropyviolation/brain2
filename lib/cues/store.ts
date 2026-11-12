/**
 * lib/cues/store.ts — The cues the person has asked for
 *
 * In the vault (`brain2-cues`), so the phone and the Mac hold the same ones. A cue is never deleted by a
 * fire: it stays until the person says it is used or no longer wanted (`done`), and can be dropped outright.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { registerPhoneWindowStore } from "@/lib/phone-window"
import { persistKey } from "@/lib/storage-keys"
import type { Cue } from "./cue"

export const CUES_STORAGE_KEY = persistKey("cues")

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `cue_${crypto.randomUUID()}`
  return `cue_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function cleanCue(raw: unknown): Cue | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Partial<Cue>
  const fact = String(r.fact ?? "").trim()
  const clauses = Array.isArray(r.clauses) ? r.clauses.filter((c): c is string[] => Array.isArray(c) && c.length > 0 && c.every((w) => typeof w === "string")) : []
  if (!fact || !clauses.length || typeof r.id !== "string") return null
  return {
    id: r.id,
    at: String(r.at ?? new Date().toISOString()),
    fact,
    when: String(r.when ?? "").trim(),
    clauses,
    fires: typeof r.fires === "number" && r.fires > 0 ? Math.floor(r.fires) : 0,
    ...(typeof r.firedAt === "number" ? { firedAt: r.firedAt } : {}),
    ...(typeof r.doneAt === "string" ? { doneAt: r.doneAt } : {}),
    ...(typeof r.perkId === "string" ? { perkId: r.perkId } : {}),
  }
}

interface CueState {
  cues: Cue[]
  add: (draft: Pick<Cue, "fact" | "when" | "clauses"> & { perkId?: string }, now?: Date) => Cue
  fired: (ids: string[], nowMs: number) => void
  done: (id: string, now?: Date) => void
  reopen: (id: string) => void
  drop: (id: string) => void
}

export const useCueStore = create<CueState>()(
  persist(
    (set, get) => ({
      cues: [],
      add: (draft, now = new Date()) => {
        const cue: Cue = { id: newId(), at: now.toISOString(), fact: draft.fact, when: draft.when, clauses: draft.clauses, fires: 0, ...(draft.perkId ? { perkId: draft.perkId } : {}) }
        set({ cues: [...get().cues, cue] })
        return cue
      },
      fired: (ids, nowMs) => set({ cues: get().cues.map((c) => (ids.includes(c.id) ? { ...c, firedAt: nowMs, fires: c.fires + 1 } : c)) }),
      done: (id, now = new Date()) => set({ cues: get().cues.map((c) => (c.id === id ? { ...c, doneAt: now.toISOString() } : c)) }),
      reopen: (id) =>
        set({
          cues: get().cues.map((c) => {
            if (c.id !== id) return c
            const { doneAt: _gone, ...rest } = c
            return rest
          }),
        }),
      drop: (id) => set({ cues: get().cues.filter((c) => c.id !== id) }),
    }),
    {
      name: CUES_STORAGE_KEY,
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (s) => ({ cues: s.cues }),
      merge: (persisted, current) => {
        const rows = (persisted as { cues?: unknown } | null | undefined)?.cues
        const cues = Array.isArray(rows) ? rows.map(cleanCue).filter((c): c is Cue => c !== null) : []
        return { ...current, cues }
      },
    },
  ),
)

registerPhoneWindowStore(useCueStore)

/** Cues still wanted, newest first. */
export function openCues(): Cue[] {
  return useCueStore.getState().cues.filter((c) => !c.doneAt).reverse()
}

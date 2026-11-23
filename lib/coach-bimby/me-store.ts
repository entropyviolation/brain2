/**
 * lib/coach-bimby/me-store.ts — What BIM knows about you, and the coach's switches
 *
 * One vault-backed store, so the desktop, the iPhone and the always-on hub (`scripts/phone-hub.ts`) read the same
 * memory. A note is one short sentence about you: who you are, what you want, a goal, a need, a like, a dislike,
 * a person in your life. `said` notes are your own words; `learned` notes were pulled out of a chat line by a model
 * (`learn.ts`) and are shown as such. The coach's switches are the morning brief and the evening check-in on
 * Telegram (`tick.ts`).
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"

export const ME_KINDS = ["who", "want", "goal", "need", "like", "dislike", "person", "note"] as const
export type MeKind = (typeof ME_KINDS)[number]

export interface MeNote {
  id: string
  kind: MeKind
  text: string
  /** Epoch ms. */
  at: number
  source: "said" | "learned"
}

export interface CoachPrefs {
  /** Morning brief and evening check-in on Telegram. Default on. */
  on: boolean
  /** Local "HH:mm". */
  morning: string
  evening: string
  morningOn: boolean
  eveningOn: boolean
  /** Local day key ("YYYY-MM-DD") the last brief / check-in went out on. */
  lastMorning?: string
  lastEvening?: string
}

export const DEFAULT_COACH_PREFS: CoachPrefs = { on: true, morning: "09:00", evening: "21:30", morningOn: true, eveningOn: true }

/** Most notes kept. The oldest learned ones go first. */
export const MAX_ME_NOTES = 200

interface MeState {
  notes: MeNote[]
  prefs: CoachPrefs
  addNote: (note: Omit<MeNote, "id" | "at"> & { at?: number }) => MeNote | null
  removeNote: (id: string) => void
  setPrefs: (patch: Partial<CoachPrefs>) => void
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()

/** True when `a` and `b` say the same thing: equal once tidied, or one holds the other and is most of it. */
export function sameNote(a: string, b: string): boolean {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return false
  if (x === y) return true
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  return long.includes(short) && short.length >= long.length * 0.7
}

export const useMeStore = create<MeState>()(
  persist(
    (set, get) => ({
      notes: [],
      prefs: { ...DEFAULT_COACH_PREFS },
      addNote: (draft) => {
        const text = draft.text.trim().replace(/\s+/g, " ").replace(/[.!]+$/, "")
        if (text.length < 3) return null
        const notes = get().notes
        const dup = notes.find((n) => sameNote(n.text, text))
        if (dup) {
          // Said in your own words wins over a learned copy.
          if (draft.source === "said" && dup.source === "learned") {
            const upgraded = { ...dup, text, kind: draft.kind, source: "said" as const }
            set({ notes: notes.map((n) => (n.id === dup.id ? upgraded : n)) })
            return upgraded
          }
          return dup
        }
        const at = draft.at ?? Date.now()
        const note: MeNote = { id: `me-${at.toString(36)}-${Math.random().toString(36).slice(2, 6)}`, kind: draft.kind, text, at, source: draft.source }
        let next = [...notes, note]
        while (next.length > MAX_ME_NOTES) {
          const drop = next.findIndex((n) => n.source === "learned")
          next = next.filter((_, i) => i !== (drop >= 0 ? drop : 0))
        }
        set({ notes: next })
        return note
      },
      removeNote: (id) => set({ notes: get().notes.filter((n) => n.id !== id) }),
      setPrefs: (patch) => set({ prefs: { ...get().prefs, ...patch } }),
    }),
    {
      name: persistKey("coach-me"),
      version: 1,
      storage: createCogsJSONStorage(),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<MeState>
        return { ...current, notes: Array.isArray(p.notes) ? p.notes : [], prefs: { ...DEFAULT_COACH_PREFS, ...(p.prefs ?? {}) } }
      },
    },
  ),
)

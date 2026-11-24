/**
 * lib/geniuses/store.ts — The geniuses, their memory, the council minutes, and the prompt overrides, kept across reloads
 *
 * Persisted under `persistKey("geniuses")`, version 1, in the full backup. It writes nothing outside itself: notes,
 * talks and meetings live here; any write to an item, a goal or a habit goes through that store's own action, after you
 * accept a card (`docs/GENIUSES.md` "Listening and recording").
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage, registerPersistRehydrator } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import type { PromptOverrides, PromptPair } from "./prompts"
import {
  clip,
  LINE_MAX,
  MAX_ACTIVE,
  MAX_MEETINGS,
  MAX_NOTES,
  MAX_TALK_LINES,
  MAX_TALKS,
  sanitizeGenius,
  sanitizeGeniuses,
  sanitizeMeetings,
  sanitizeTalks,
} from "./sanitize"
import { starterGeniuses } from "./starters"
import { PROMPT_IDS, type CouncilMeeting, type Genius, type GeniusNoteAbout, type GeniusStatus, type GeniusTalk, type PromptId, type TalkLine } from "./types"

const rid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export const GENIUSES_KEY = persistKey("geniuses")

type Persisted = {
  geniuses: Genius[]
  talks: GeniusTalk[]
  meetings: CouncilMeeting[]
  prompts: PromptOverrides
}

interface GeniusesState extends Persisted {
  addGenius: (g: Partial<Genius> & Pick<Genius, "name">) => string
  updateGenius: (id: string, patch: Partial<Omit<Genius, "id" | "notes">>) => void
  removeGenius: (id: string) => void
  /** Active is refused past `MAX_ACTIVE`; returns false then. */
  setStatus: (id: string, status: GeniusStatus) => boolean
  addNote: (geniusId: string, said: string, about?: GeniusNoteAbout, source?: "you" | "picked-up") => string | null
  removeNote: (geniusId: string, noteId: string) => void
  startTalk: (geniusId: string, task: string, taskId?: string | null) => string
  addTalkLine: (talkId: string, line: Omit<TalkLine, "at"> & { at?: string }) => void
  endTalk: (talkId: string, outcome: GeniusTalk["outcome"]) => void
  removeTalk: (talkId: string) => void
  addMeeting: (m: Omit<CouncilMeeting, "id" | "at"> & { at?: string }) => string
  updateMeeting: (id: string, patch: Partial<Omit<CouncilMeeting, "id">>) => void
  removeMeeting: (id: string) => void
  setPrompt: (id: PromptId, part: keyof PromptPair, text: string) => void
  resetPrompt: (id: PromptId) => void
  /** Put back any starter that is missing. Existing geniuses are left alone. */
  restoreStarters: () => void
}

export function sanitizePrompts(raw: unknown): PromptOverrides {
  const out: PromptOverrides = {}
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  for (const id of PROMPT_IDS) {
    const p = o[id] && typeof o[id] === "object" ? (o[id] as Record<string, unknown>) : null
    if (!p) continue
    const pair: Partial<PromptPair> = {}
    if (typeof p.system === "string" && p.system.trim()) pair.system = p.system.slice(0, 8000)
    if (typeof p.user === "string" && p.user.trim()) pair.user = p.user.slice(0, 8000)
    if (pair.system || pair.user) out[id] = pair
  }
  return out
}

export function sanitizeGeniusesState(raw: unknown): Persisted {
  const s = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const geniuses = Array.isArray(s.geniuses) ? sanitizeGeniuses(s.geniuses) : starterGeniuses()
  const known = new Set(geniuses.map((g) => g.id))
  return {
    geniuses,
    talks: sanitizeTalks(s.talks).filter((t) => known.has(t.geniusId)),
    meetings: sanitizeMeetings(s.meetings),
    prompts: sanitizePrompts(s.prompts),
  }
}

const activeCount = (gs: Genius[]) => gs.filter((g) => g.status === "active").length

export const useGeniusesStore = create<GeniusesState>()(
  persist(
    (set, get) => ({
      geniuses: starterGeniuses(),
      talks: [],
      meetings: [],
      prompts: {},
      addGenius: (input) => {
        const id = clip(input.id, 80) || rid("genius")
        const status: GeniusStatus = activeCount(get().geniuses) >= MAX_ACTIVE ? "resting" : input.status ?? "active"
        const g = sanitizeGenius({ origin: "goal", ...input, id, status, notes: [], createdAt: new Date().toISOString() })
        if (!g || get().geniuses.some((x) => x.id === id)) return id
        set((s) => ({ geniuses: [...s.geniuses, g] }))
        return id
      },
      updateGenius: (id, patch) =>
        set((s) => ({
          geniuses: s.geniuses.map((g) => {
            if (g.id !== id) return g
            const next = sanitizeGenius({ ...g, ...patch, id, notes: g.notes })
            return next ?? g
          }),
        })),
      removeGenius: (id) => set((s) => ({ geniuses: s.geniuses.filter((g) => g.id !== id), talks: s.talks.filter((t) => t.geniusId !== id) })),
      setStatus: (id, status) => {
        const gs = get().geniuses
        const g = gs.find((x) => x.id === id)
        if (!g) return false
        if (status === "active" && g.status !== "active" && activeCount(gs) >= MAX_ACTIVE) return false
        set((s) => ({ geniuses: s.geniuses.map((x) => (x.id === id ? { ...x, status } : x)) }))
        return true
      },
      addNote: (geniusId, said, about = null, source = "you") => {
        const text = clip(said, LINE_MAX)
        if (!text) return null
        const id = rid("gn")
        set((s) => ({
          geniuses: s.geniuses.map((g) => (g.id === geniusId ? { ...g, notes: [...g.notes, { id, at: new Date().toISOString(), said: text, about, source }].slice(-MAX_NOTES) } : g)),
        }))
        return id
      },
      removeNote: (geniusId, noteId) =>
        set((s) => ({ geniuses: s.geniuses.map((g) => (g.id === geniusId ? { ...g, notes: g.notes.filter((n) => n.id !== noteId) } : g)) })),
      startTalk: (geniusId, task, taskId = null) => {
        const id = rid("gt")
        const talk: GeniusTalk = { id, geniusId, startedAt: new Date().toISOString(), task: clip(task, LINE_MAX) || "this", taskId, lines: [], outcome: "open" }
        set((s) => ({ talks: [...s.talks, talk].slice(-MAX_TALKS) }))
        return id
      },
      addTalkLine: (talkId, line) => {
        const text = clip(line.text, LINE_MAX)
        if (!text) return
        const row: TalkLine = { ...line, text, at: line.at ?? new Date().toISOString() }
        set((s) => ({ talks: s.talks.map((t) => (t.id === talkId ? { ...t, lines: [...t.lines, row].slice(-MAX_TALK_LINES) } : t)) }))
      },
      endTalk: (talkId, outcome) => set((s) => ({ talks: s.talks.map((t) => (t.id === talkId ? { ...t, outcome } : t)) })),
      removeTalk: (talkId) => set((s) => ({ talks: s.talks.filter((t) => t.id !== talkId) })),
      addMeeting: (m) => {
        const id = rid("gc")
        const row = sanitizeMeetings([{ ...m, id, at: m.at ?? new Date().toISOString() }])[0]
        if (row) set((s) => ({ meetings: [...s.meetings, row].slice(-MAX_MEETINGS) }))
        return id
      },
      updateMeeting: (id, patch) =>
        set((s) => ({ meetings: s.meetings.map((m) => (m.id === id ? sanitizeMeetings([{ ...m, ...patch, id }])[0] ?? m : m)) })),
      removeMeeting: (id) => set((s) => ({ meetings: s.meetings.filter((m) => m.id !== id) })),
      setPrompt: (id, part, text) => set((s) => ({ prompts: sanitizePrompts({ ...s.prompts, [id]: { ...s.prompts[id], [part]: text } }) })),
      resetPrompt: (id) =>
        set((s) => {
          const next = { ...s.prompts }
          delete next[id]
          return { prompts: next }
        }),
      restoreStarters: () =>
        set((s) => {
          const have = new Set(s.geniuses.map((g) => g.id))
          const missing = starterGeniuses().filter((g) => !have.has(g.id))
          return missing.length ? { geniuses: sanitizeGeniuses([...s.geniuses, ...missing]) } : {}
        }),
    }),
    {
      name: GENIUSES_KEY,
      storage: createCogsJSONStorage(),
      version: 1,
      partialize: (s): Persisted => ({ geniuses: s.geniuses, talks: s.talks, meetings: s.meetings, prompts: s.prompts }),
      merge: (persisted, current) => ({ ...current, ...sanitizeGeniusesState(persisted) }),
    },
  ),
)

registerPersistRehydrator(GENIUSES_KEY, () => useGeniusesStore.persist.rehydrate())

/**
 * lib/habit-helper/store.ts — The Habit Helper's chat: lines, the changes each proposes, what was decided
 *
 * Per device, in `localStorage` (`habithelper-chat-v1`), outside the vault. A helper line carries its
 * proposals (each `accepted` or `dismissed`, or still open) and its asks (a clause two habits fit; the
 * person picks one, then code computes the proposal). Opening the chat once a day lists today's unmet
 * habits with a nudge each and asks the first why-question; each answer asks the next, at most
 * `flow.ask.maxQuestions` a day. Nothing reaches the habits until Accept.
 */
"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { dateKey } from "@/lib/tracking-helper/clock"
import { applyProposals, buildContext } from "./accept"
import { computeItem, editProposal } from "./compute"
import { loadFlow } from "./flow"
import { nudges, whyQueue } from "./history"
import { runHabitHelper, type PendingWhy } from "./run"
import type { Tagged } from "./tags"
import type { Ask, HabitRoute, Proposal, TraceStage } from "./types"

export type Decision = "accepted" | "dismissed"

export interface HelperLine {
  id: string
  who: "you" | "helper"
  text: string
  at: string
  route?: HabitRoute
  proposals?: Proposal[]
  decided?: Record<string, Decision>
  asks?: Ask[]
  /** Ask id → the habit picked. */
  chosen?: Record<string, string>
  /** Kept so an ask can be computed after the pick. */
  tagged?: Pick<Tagged, "tags" | "clauses">
  /** This line is a why-question. */
  why?: PendingWhy
  /** Open the Reasons view on this habit. */
  reasonsFor?: string
  model?: string
  ms?: number
  trace?: TraceStage[]
}

interface HelperState {
  lines: HelperLine[]
  busy: boolean
  pending: PendingWhy | null
  /** Why-questions asked, with the day they were asked on. */
  asked: { habitId: string; day: string; on: string }[]
  /** The day the opening nudges were last shown. */
  greetedOn: string | null
  open: () => void
  send: (text: string) => Promise<void>
  edit: (lineId: string, proposalId: string, raw: string) => void
  accept: (lineId: string, ids?: string[]) => string
  dismiss: (lineId: string, proposalId: string) => void
  choose: (lineId: string, askId: string, habitId: string) => void
  clear: () => void
}

let seq = 0
const newId = () => `hh-${Date.now().toString(36)}-${++seq}`
const MAX_LINES = 60
/** Open habits listed on open; the most specific nudges come first. */
const OPEN_SHOWN = 6
const nowIso = () => new Date().toISOString()

export const openProposals = (l: HelperLine) => (l.proposals ?? []).filter((p) => !l.decided?.[p.id])
export const openAsks = (l: HelperLine) => (l.asks ?? []).filter((a) => !l.chosen?.[a.id])

/** The next why-question as a helper line, or null when today's are used up or none is due. */
function nextWhy(state: Pick<HelperState, "asked">): { line: HelperLine; pending: PendingWhy; asked: HelperState["asked"] } | null {
  const flow = loadFlow()
  const today = dateKey(new Date())
  const todays = state.asked.filter((a) => a.on === today)
  if (todays.length >= flow.ask.maxQuestions) return null
  const q = whyQueue(buildContext(), flow, todays)[0]
  if (!q) return null
  const pending = { habitId: q.habitId, day: q.day }
  return { line: { id: newId(), who: "helper", text: `${q.text} (Your words are saved as written. “skip” passes.)`, at: nowIso(), why: pending }, pending, asked: [...state.asked.filter((a) => a.on === today), { ...pending, on: today }] }
}

export const useHabitHelper = create<HelperState>()(
  persist(
    (set, get) => ({
      lines: [],
      busy: false,
      pending: null,
      asked: [],
      greetedOn: null,

      open: () => {
        const today = dateKey(new Date())
        if (get().greetedOn === today) return
        const list = nudges(buildContext())
        const shown = list.slice(0, OPEN_SHOWN)
        const rest = list.length - shown.length
        const text = list.length
          ? `Still open today (${list.length}):\n${shown.map((n) => `• ${n.habit}: ${n.text}`).join("\n")}${rest ? `\n…and ${rest} more. Ask “what's left today?” for all of them.` : ""}`
          : "Every daily habit is done or marked for today."
        const greet: HelperLine = { id: newId(), who: "helper", text, at: nowIso(), route: "nudge" }
        const why = get().pending ? null : nextWhy(get())
        set((s) => ({ greetedOn: today, lines: [...s.lines, greet, ...(why ? [why.line] : [])].slice(-MAX_LINES), ...(why ? { pending: why.pending, asked: why.asked } : {}) }))
      },

      send: async (raw) => {
        const text = raw.trim()
        if (!text || get().busy) return
        set((s) => ({ busy: true, lines: [...s.lines, { id: newId(), who: "you" as const, text, at: nowIso() }].slice(-MAX_LINES) }))
        const t0 = Date.now()
        try {
          const flow = loadFlow()
          const crew = await chatCrew().catch(() => null)
          const ladder = flow.match.ladder.length ? flow.match.ladder : crew?.extract ?? []
          const ctx = buildContext()
          const run = await runHabitHelper({ text, flow, ctx, call: crew ? ollamaCall(crew.main) : null, ladder, pending: get().pending })
          const line: HelperLine = {
            id: newId(),
            who: "helper",
            text: run.reply,
            at: nowIso(),
            route: run.route,
            proposals: run.proposals,
            decided: {},
            asks: run.asks,
            chosen: {},
            ...(run.asks.length ? { tagged: { tags: run.tags, clauses: (run.trace.find((t) => t.stage === "tag")?.output as Tagged | undefined)?.clauses ?? [] } } : {}),
            ...(run.reasonsFor ? { reasonsFor: run.reasonsFor } : {}),
            model: run.model,
            ms: Date.now() - t0,
            trace: run.trace,
          }
          const answered = run.route === "answer"
          const after = answered ? { ...get(), pending: null } : get()
          const why = answered ? nextWhy(after) : null
          set((s) => ({
            busy: false,
            lines: [...s.lines, line, ...(why ? [why.line] : [])].slice(-MAX_LINES),
            ...(answered ? { pending: why?.pending ?? null } : {}),
            ...(why ? { asked: why.asked } : {}),
          }))
        } catch (err) {
          set((s) => ({ busy: false, lines: [...s.lines, { id: newId(), who: "helper" as const, text: `That failed: ${err instanceof Error ? err.message : "error"}.`, at: nowIso() }].slice(-MAX_LINES) }))
        }
      },

      edit: (lineId, proposalId, raw) =>
        set((s) => ({ lines: s.lines.map((l) => (l.id === lineId ? { ...l, proposals: l.proposals?.map((p) => (p.id === proposalId ? editProposal(p, raw) : p)) } : l)) })),

      accept: (lineId, ids) => {
        const line = get().lines.find((l) => l.id === lineId)
        if (!line) return ""
        const pick = openProposals(line).filter((p) => !ids || ids.includes(p.id))
        const result = applyProposals(pick)
        set((s) => ({ lines: s.lines.map((l) => (l.id === lineId ? { ...l, decided: { ...l.decided, ...Object.fromEntries(result.wrote.map((id) => [id, "accepted" as const])) } } : l)) }))
        return result.message
      },

      dismiss: (lineId, proposalId) => set((s) => ({ lines: s.lines.map((l) => (l.id === lineId ? { ...l, decided: { ...l.decided, [proposalId]: "dismissed" as const } } : l)) })),

      choose: (lineId, askId, habitId) => {
        const line = get().lines.find((l) => l.id === lineId)
        const ask = line?.asks?.find((a) => a.id === askId)
        if (!line || !ask || !line.tagged) return
        const p = computeItem({ ...ask.item, habit: habitId }, { ...line.tagged, marked: "" }, buildContext())
        set((s) => ({
          lines: s.lines.map((l) =>
            l.id === lineId
              ? { ...l, chosen: { ...l.chosen, [askId]: habitId }, proposals: typeof p === "string" ? l.proposals : [...(l.proposals ?? []).filter((x) => x.id !== p.id), p], text: typeof p === "string" && p ? `${l.text}\n${p}` : l.text }
              : l,
          ),
        }))
      },

      clear: () => set({ lines: [], pending: null, greetedOn: null }),
    }),
    {
      name: "habithelper-chat-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lines: s.lines.map(({ trace: _t, ...l }) => l), pending: s.pending, asked: s.asked, greetedOn: s.greetedOn }),
    },
  ),
)

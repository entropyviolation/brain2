/**
 * lib/tracking-helper/store.ts — The Helper's chat: lines, the blocks each one proposes, what was decided
 *
 * Per device, in `localStorage` (`trackinghelper-chat-v1`), outside the vault. A helper line carries its
 * proposed blocks; each block is `added`, `dismissed` or `replaced` (a later correction took its place)
 * or still open. Editing a card changes the block in place. Nothing is written to Tracking until Add.
 */
"use client"

import { wantsTrack } from "@/lib/wire-bimby/plan"
import { tryWire } from "@/lib/wire-bimby/run"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { loadBank } from "@/lib/skills/bank"
import type { Reaction } from "@/lib/skills/experience"
import { recordReaction } from "@/lib/skills/learn"
import { TRACKING_HELPER_SKILLS } from "@/lib/skills/seeds"
import { acceptBlocks, buildContext } from "./accept"
import { loadFlow } from "./flow"
import { helperBlueprint } from "@/lib/agents/adapters/tracking-helper"
import { infoText, isInfoRequest } from "@/lib/agents/info"
import { HELPER_AGENT_ID, reactionOfCorrection, reactionOfDismiss, reactionsOfAdd } from "./learn"
import { QUESTION_REPLY, runHelper } from "./run"
import type { HelperRoute, ProposedBlock, TraceStage } from "./types"

export type Decision = "added" | "dismissed" | "replaced"

export interface HelperLine {
  id: string
  who: "you" | "helper"
  text: string
  at: string
  route?: HelperRoute
  blocks?: ProposedBlock[]
  decided?: Record<string, Decision>
  /** The account these blocks were read from, so a correction can re-read it. */
  account?: string
  model?: string
  ms?: number
  note?: string
  trace?: TraceStage[]
  /** The blocks as the Helper proposed them, so what the person changed before Add can be learned from. */
  proposed?: ProposedBlock[]
  /** Ids of the learned skills that were in the prompt (`lib/skills/`). */
  skillsUsed?: string[]
  /** A standing instruction ("whenever I speed read, track it on a pen") read into a plan card (`lib/wire-bimby`). */
  wireId?: string
  /** The words came from BIM chat ("send this to tracking bimby: …"), so the Inbox shows a waiting notice until they are decided. */
  fromBim?: boolean
}

/** Learn from the person's reaction to a line's blocks. Credit goes to the skills once per block, on its first reaction. */
function learn(reactions: Reaction[][]): void {
  for (const group of reactions) group.forEach((r, i) => recordReaction(i === 0 ? r : { ...r, skillsUsed: [] }, TRACKING_HELPER_SKILLS))
}

const reactionBase = (line: HelperLine) => ({ input: line.account ?? line.text, skillsUsed: line.skillsUsed ?? [] })

interface HelperState {
  lines: HelperLine[]
  busy: boolean
  /** Block ids being written right now. Not persisted. The card shows a loading bar for these. */
  adding: Record<string, true>
  /** The last Add message per block (shown on its card, kept if the person navigates away and back). Not persisted. */
  msgs: Record<string, string>
  send: (text: string, opts?: { fromBim?: boolean }) => Promise<void>
  edit: (lineId: string, blockId: string, patch: Partial<ProposedBlock>) => void
  /** Starts the write and returns at once; the write runs after the next paint, in the store, so leaving the screen does not stop it. Resolves with the message. */
  add: (lineId: string, blockIds?: string[], force?: boolean) => Promise<string>
  dismiss: (lineId: string, blockId: string) => void
  clear: () => void
}

let seq = 0
const newId = () => `th-${Date.now().toString(36)}-${++seq}`
const MAX_LINES = 40

const openBlocks = (l: HelperLine) => (l.blocks ?? []).filter((b) => !l.decided?.[b.id])

export const useTrackingHelper = create<HelperState>()(
  persist(
    (set, get) => ({
      lines: [],
      busy: false,
      adding: {},
      msgs: {},

      send: async (raw, opts) => {
        const text = raw.trim()
        if (!text || get().busy) return
        const at = new Date().toISOString()
        set((s) => ({ busy: true, lines: [...s.lines, { id: newId(), who: "you" as const, text, at }].slice(-MAX_LINES) }))
        const t0 = Date.now()
        // "info" is answered from the Blueprint and runs nothing else.
        if (isInfoRequest(text)) {
          set((s) => ({ busy: false, lines: [...s.lines, { id: newId(), who: "helper" as const, text: infoText(helperBlueprint(), { href: "/lab/tracking-helper" }), at: new Date().toISOString(), ms: Date.now() - t0 }].slice(-MAX_LINES) }))
          return
        }
        // A standing instruction about a module's time is not an account of a day: it becomes a checked plan card.
        const standing = wantsTrack(text) ? tryWire(text, new Date()) : null
        if (standing) {
          set((s) => ({ busy: false, lines: [...s.lines, { id: newId(), who: "helper" as const, text: standing.text, at: new Date().toISOString(), wireId: standing.wireId, ms: Date.now() - t0 }].slice(-MAX_LINES) }))
          return
        }
        try {
          const pendingLine = [...get().lines].reverse().find((l) => l.who === "helper" && openBlocks(l).length && l.account)
          const flow = loadFlow()
          const crew = await chatCrew().catch(() => null)
          const ladder = flow.wire.ladder.length ? flow.wire.ladder : crew?.extract ?? []
          // The shipped seeds restate WIRE_SYSTEM, so only skills learned on this device ride in the prompt.
          const bank = loadBank(HELPER_AGENT_ID, TRACKING_HELPER_SKILLS)
          const learned = { ...bank, skills: bank.skills.filter((s) => s.source !== "hand") }
          const run = await runHelper({ text, flow, ctx: buildContext(), call: crew ? ollamaCall(crew.main) : null, ladder, pending: pendingLine?.account ?? null, bank: learned })
          const found = run.blocks.length
          const note =
            run.route === "question"
              ? QUESTION_REPLY
              : [
                  found ? `Timeblocks detected: ${found}` : "I could not find a time to anchor anything to. Say when it happened, even roughly.",
                  run.unplaced.length ? `No time given for: ${run.unplaced.join(", ")}.` : "",
                  run.fallback ? `(Rules only: ${run.fallback}.)` : "",
                ]
                  .filter(Boolean)
                  .join(" ")
          const line: HelperLine = { id: newId(), who: "helper", text: note, at: new Date().toISOString(), route: run.route, blocks: run.blocks, decided: {}, ...(opts?.fromBim ? { fromBim: true } : {}), account: run.route === "question" ? undefined : run.text, model: run.model, ms: Date.now() - t0, trace: run.trace, proposed: run.blocks, skillsUsed: run.skillsUsed }
          if (run.route === "revise" && pendingLine) {
            const base = { ...reactionBase(pendingLine), skillsUsed: pendingLine.skillsUsed ?? [] }
            learn(openBlocks(pendingLine).map((b) => [reactionOfCorrection(b, text, base)]))
          }
          set((s) => ({
            busy: false,
            lines: [
              ...s.lines.map((l) => (run.route === "revise" && l.id === pendingLine?.id ? { ...l, decided: { ...l.decided, ...Object.fromEntries(openBlocks(l).map((b) => [b.id, "replaced" as const])) } } : l)),
              line,
            ].slice(-MAX_LINES),
          }))
        } catch (err) {
          set((s) => ({ busy: false, lines: [...s.lines, { id: newId(), who: "helper" as const, text: `That failed: ${err instanceof Error ? err.message : "error"}.`, at: new Date().toISOString() }].slice(-MAX_LINES) }))
        }
      },

      edit: (lineId, blockId, patch) =>
        set((s) => ({ lines: s.lines.map((l) => (l.id === lineId ? { ...l, blocks: l.blocks?.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) } : l)) })),

      add: async (lineId, blockIds, force) => {
        const line = get().lines.find((l) => l.id === lineId)
        if (!line) return ""
        const pick = openBlocks(line).filter((b) => !blockIds || blockIds.includes(b.id)).filter((b) => !get().adding[b.id])
        if (!pick.length) return ""
        const mark = (on: boolean) => set((s) => {
          const adding = { ...s.adding }
          for (const b of pick) on ? (adding[b.id] = true) : delete adding[b.id]
          return { adding }
        })
        mark(true)
        // Let the loading bar paint before the write starts. The write and the syncs it wakes then run
        // without the screen waiting, and a card that is no longer mounted does not stop them.
        await new Promise<void>((resolve) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(() => setTimeout(resolve, 0)) : setTimeout(resolve, 0)))
        let message = ""
        try {
          const result = acceptBlocks(pick, { force })
          const refused = new Set(result.refused.map((r) => r.id))
          const wrote = pick.filter((b) => !refused.has(b.id))
          const was = new Map((line.proposed ?? []).map((b) => [b.id, b]))
          learn(wrote.flatMap((b) => (was.has(b.id) ? [reactionsOfAdd(was.get(b.id)!, b, reactionBase(line))] : [])))
          message = result.message + (result.refused.length ? ` (${result.refused.map((r) => r.why).join(", ")})` : "")
          set((s) => ({
            msgs: { ...s.msgs, ...Object.fromEntries(pick.map((b) => [b.id, message])) },
            lines: s.lines.map((l) => (l.id === lineId ? { ...l, decided: { ...l.decided, ...Object.fromEntries(wrote.map((b) => [b.id, "added" as const])) } } : l)),
          }))
        } catch (err) {
          message = `FAILED: ${err instanceof Error ? err.message.toUpperCase() : "ERROR"}`
          set((s) => ({ msgs: { ...s.msgs, ...Object.fromEntries(pick.map((b) => [b.id, message])) } }))
        } finally {
          mark(false)
        }
        return message
      },

      dismiss: (lineId, blockId) => {
        const line = get().lines.find((l) => l.id === lineId)
        const block = line?.blocks?.find((b) => b.id === blockId)
        if (line && block && !line.decided?.[blockId]) learn([[reactionOfDismiss(block, reactionBase(line))]])
        set((s) => ({ lines: s.lines.map((l) => (l.id === lineId ? { ...l, decided: { ...l.decided, [blockId]: "dismissed" as const } } : l)) }))
      },

      clear: () => set({ lines: [] }),
    }),
    {
      name: "trackinghelper-chat-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lines: s.lines.map(({ trace: _t, ...l }) => l) }),
    },
  ),
)

export { openBlocks }

/** Proposed blocks sent from BIM chat that still wait for Add or dismiss. */
export function awaitingFromBim(lines: HelperLine[]): number {
  return lines.reduce((n, l) => (l.fromBim ? n + openBlocks(l).length : n), 0)
}

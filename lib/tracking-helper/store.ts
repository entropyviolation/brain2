/**
 * lib/tracking-helper/store.ts — The Helper's chat: lines, the blocks each one proposes, what was decided
 *
 * Per device, in `localStorage` (`trackinghelper-chat-v1`), outside the vault. A helper line carries its
 * proposed blocks; each block is `added`, `dismissed` or `replaced` (a later correction took its place)
 * or still open. Editing a card changes the block in place. Nothing is written to Tracking until Add.
 */
"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { acceptBlocks, buildContext } from "./accept"
import { loadFlow } from "./flow"
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
}

interface HelperState {
  lines: HelperLine[]
  busy: boolean
  send: (text: string) => Promise<void>
  edit: (lineId: string, blockId: string, patch: Partial<ProposedBlock>) => void
  add: (lineId: string, blockIds?: string[], force?: boolean) => string
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

      send: async (raw) => {
        const text = raw.trim()
        if (!text || get().busy) return
        const at = new Date().toISOString()
        set((s) => ({ busy: true, lines: [...s.lines, { id: newId(), who: "you" as const, text, at }].slice(-MAX_LINES) }))
        const t0 = Date.now()
        try {
          const pendingLine = [...get().lines].reverse().find((l) => l.who === "helper" && openBlocks(l).length && l.account)
          const flow = loadFlow()
          const crew = await chatCrew().catch(() => null)
          const ladder = flow.wire.ladder.length ? flow.wire.ladder : crew?.extract ?? []
          const run = await runHelper({ text, flow, ctx: buildContext(), call: crew ? ollamaCall(crew.main) : null, ladder, pending: pendingLine?.account ?? null })
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
          const line: HelperLine = { id: newId(), who: "helper", text: note, at: new Date().toISOString(), route: run.route, blocks: run.blocks, decided: {}, account: run.route === "question" ? undefined : run.text, model: run.model, ms: Date.now() - t0, trace: run.trace }
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

      add: (lineId, blockIds, force) => {
        const line = get().lines.find((l) => l.id === lineId)
        if (!line) return ""
        const pick = openBlocks(line).filter((b) => !blockIds || blockIds.includes(b.id))
        const result = acceptBlocks(pick, { force })
        const refused = new Set(result.refused.map((r) => r.id))
        const wrote = pick.filter((b) => !refused.has(b.id))
        set((s) => ({ lines: s.lines.map((l) => (l.id === lineId ? { ...l, decided: { ...l.decided, ...Object.fromEntries(wrote.map((b) => [b.id, "added" as const])) } } : l)) }))
        return result.message + (result.refused.length ? ` (${result.refused.map((r) => r.why).join(", ")})` : "")
      },

      dismiss: (lineId, blockId) => set((s) => ({ lines: s.lines.map((l) => (l.id === lineId ? { ...l, decided: { ...l.decided, [blockId]: "dismissed" as const } } : l)) })),

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

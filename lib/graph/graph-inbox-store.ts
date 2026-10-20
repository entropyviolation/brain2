/**
 * lib/graph/graph-inbox-store.ts — The proposal inbox (`brain2-graph-inbox`,
 * LINKS_REDESIGN §6.5, §11.1, L8.1). A queue, not a graph: a proposal is
 * not an edge until the person accepts it. Capped at 500 open; oldest
 * dismissed rows are pruned first. Full backup carries the key.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import type { GraphProposal } from "@/lib/graph/proposal-schema"

export const INBOX_OPEN_CAP = 500
const KEEP_CLOSED = 200

interface GraphInboxState {
  proposals: GraphProposal[]
  addProposals: (rows: GraphProposal[]) => number
  setStatus: (id: string, status: GraphProposal["status"]) => void
  clearClosed: () => void
}

export function capInbox(rows: GraphProposal[]): GraphProposal[] {
  const open = rows.filter((p) => p.status === "open").slice(-INBOX_OPEN_CAP)
  const closed = rows.filter((p) => p.status !== "open")
  closed.sort((a, b) => (a.status === b.status ? 0 : a.status === "dismissed" ? -1 : 1) || a.createdAt.localeCompare(b.createdAt))
  return [...closed.slice(Math.max(0, closed.length - KEEP_CLOSED)), ...open]
}

export const useGraphInboxStore = create<GraphInboxState>()(
  persist(
    (set, get) => ({
      proposals: [],
      addProposals: (rows) => {
        const have = new Set(get().proposals.filter((p) => p.kind === "link").map((p) => `${p.sourceId}|${p.relation}|${p.targetId}`))
        const fresh = rows.filter((p) => p.kind !== "link" || !have.has(`${p.sourceId}|${p.relation}|${p.targetId}`))
        if (fresh.length) set({ proposals: capInbox([...get().proposals, ...fresh]) })
        return fresh.length
      },
      setStatus: (id, status) => set({ proposals: get().proposals.map((p) => (p.id === id ? { ...p, status } : p)) }),
      clearClosed: () => set({ proposals: get().proposals.filter((p) => p.status === "open") }),
    }),
    { name: persistKey("graph-inbox"), version: 1, storage: createCogsJSONStorage() },
  ),
)

/** Open link proposals touching one item (shelf source `proposal`). */
export function openProposalsFor(rows: readonly GraphProposal[], itemId: string): GraphProposal[] {
  return rows.filter((p) => p.status === "open" && p.kind === "link" && (p.sourceId === itemId || p.targetId === itemId))
}

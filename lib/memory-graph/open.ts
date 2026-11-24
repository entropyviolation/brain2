/**
 * lib/memory-graph/open.ts — Open BIM's GRAPH tab on any item, from anywhere
 *
 * `openBimGraph(itemId)` sets the graph's center and asks the BIM key to open the console on GRAPH.
 * The console reads `useBimGraphFocus`; `bim-key.tsx` hears the window event and opens.
 */
import { create } from "zustand"

export const BIM_GRAPH_OPEN_EVENT = "brain2:bim-graph-open"

type Focus = {
  /** An item id, or null for BIM's own memory (the hub). */
  centerId: string | null
  /** Bumped on every request, so the console switches to GRAPH even when the center is unchanged. */
  asked: number
  setCenter: (id: string | null) => void
}

export const useBimGraphFocus = create<Focus>((set) => ({
  centerId: null,
  asked: 0,
  setCenter: (centerId) => set({ centerId }),
}))

/** Open BIM chat on the GRAPH tab, centered on this item (null: BIM's memory). */
export function openBimGraph(itemId: string | null): void {
  useBimGraphFocus.setState((s) => ({ centerId: itemId, asked: s.asked + 1 }))
  if (typeof window !== "undefined") window.dispatchEvent(new Event(BIM_GRAPH_OPEN_EVENT))
}

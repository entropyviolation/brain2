/**
 * lib/report-bimby/reply-target.ts — The card change a BIM chat line is a reply to
 *
 * Tapping a change on a card (Report, Stream or Social) marks it here. The compose well shows it, and the next
 * line you send carries it (`useBimChatStore.send` → `sendToBim({ about })`), so BIM reads that line as a reply to
 * that change (`card-reply.ts`). In memory: a reload forgets it. Sending clears it.
 */
import { create } from "zustand"

export interface CardRef {
  planId: string
  effectId: string
  /** What the well and your line show: "BIRTHDAY · Nico's birthday". */
  label: string
}

export const useReplyTarget = create<{ target: CardRef | null; set: (t: CardRef | null) => void }>()((set) => ({
  target: null,
  set: (target) => set({ target }),
}))

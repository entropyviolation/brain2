/**
 * lib/doc-selection/doc-out-links.ts — where a document's highlighted text went
 *
 * Each time a Docs selection is sent somewhere (a list, an item's notes, the
 * tracking log, Quick Add, BIM Chat) one small record is kept per document.
 * The record names the target and keeps the text, so a doc can show "what I
 * pulled out of this". It does not own the copy: the target keeps its own
 * text and nothing here is read back to change it. Planned: a sidebar in the
 * editor that lists a document's records and jumps to the target.
 */
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { persistKey } from "@/lib/storage-keys"

export type DocOutKind = "quick-add" | "bim-chat" | "list-item" | "item-note" | "log"

export interface DocOutLink {
  id: string
  docId: string
  kind: DocOutKind
  /** The highlighted text, as sent. */
  text: string
  /** Task id of the new list item or the item that got the note. */
  targetId?: string
  /** Readable name of the target at send time (list name, item title, "Tracking log"). */
  targetLabel?: string
  at: string
}

const PER_DOC_CAP = 200

interface State {
  links: DocOutLink[]
  record: (link: Omit<DocOutLink, "id" | "at">) => DocOutLink
  forDoc: (docId: string) => DocOutLink[]
  forgetDoc: (docId: string) => void
}

export const useDocOutLinks = create<State>()(
  persist(
    (set, get) => ({
      links: [],
      record: (link) => {
        const made: DocOutLink = {
          ...link,
          id: `dol_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          at: new Date().toISOString(),
        }
        set((s) => {
          const mine = s.links.filter((l) => l.docId === link.docId)
          const drop = mine.length >= PER_DOC_CAP ? new Set(mine.slice(0, mine.length - PER_DOC_CAP + 1).map((l) => l.id)) : null
          return { links: [...s.links.filter((l) => !drop?.has(l.id)), made] }
        })
        return made
      },
      forDoc: (docId) => get().links.filter((l) => l.docId === docId),
      forgetDoc: (docId) => set((s) => ({ links: s.links.filter((l) => l.docId !== docId) })),
    }),
    {
      name: persistKey("docOutLinks"),
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ links: s.links }),
    },
  ),
)

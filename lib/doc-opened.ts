/**
 * lib/doc-opened.ts — when each Docs document was last opened
 *
 * One ISO time per doc id, on this device. Kept out of the item itself so
 * opening a doc is not an edit: no `docsUpdatedAt` bump, no History row, no
 * sync write. Read by the Docs info sheet (`components/Docs/DocInfoDialog.tsx`).
 */
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { persistKey } from "@/lib/storage-keys"

interface State {
  openedAt: Record<string, string>
  /** Stamp now; returns the previous open, or null if none was recorded. */
  markOpened: (docId: string) => Date | null
  forget: (docId: string) => void
}

function parse(raw: string | undefined): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

export const useDocOpened = create<State>()(
  persist(
    (set, get) => ({
      openedAt: {},
      markOpened: (docId) => {
        const prev = parse(get().openedAt[docId])
        set((s) => ({ openedAt: { ...s.openedAt, [docId]: new Date().toISOString() } }))
        return prev
      },
      forget: (docId) =>
        set((s) => {
          const next = { ...s.openedAt }
          delete next[docId]
          return { openedAt: next }
        }),
    }),
    {
      name: persistKey("docOpenedAt"),
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ openedAt: s.openedAt }),
    },
  ),
)

/**
 * lib/graph/links-view-store.ts — Per-viewer Links tab settings
 * (`brain2-links-view`): the **with derived** switch and muted suggestion
 * sources. Kept out of `user-settings-store` so that store's migrate stays
 * untouched; full backup carries the key.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"

interface LinksViewState {
  withDerived: boolean
  setWithDerived: (on: boolean) => void
  mutedSources: string[]
  toggleMuted: (source: string) => void
}

export const useLinksViewStore = create<LinksViewState>()(
  persist(
    (set, get) => ({
      withDerived: false,
      setWithDerived: (withDerived) => set({ withDerived }),
      mutedSources: [],
      toggleMuted: (source) => {
        const muted = get().mutedSources
        set({ mutedSources: muted.includes(source) ? muted.filter((s) => s !== source) : [...muted, source] })
      },
    }),
    { name: persistKey("links-view"), version: 1, storage: createCogsJSONStorage() },
  ),
)

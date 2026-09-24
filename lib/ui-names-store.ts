/**
 * lib/ui-names-store.ts — Overlay mode machine (`data-ui-mode`)
 *
 * Names is the first overlay: outline `[data-ui-name]` seams and float a
 * nameplate on hover. Persist a string union so Help / Inspect can join later
 * without changing the blob shape. Mutually exclusive — turning Names on
 * replaces any other mode; turning it off writes `"off"`. Included in the
 * Settings full backup, same as home layout. Storage: `brain2-ui-names`.
 *
 * DOM contract (Help/Inspect reads these; no TypeScript catalog):
 * `data-ui-name` human noun; `data-ui-help` optional one-liner (Names hover
 * only); `data-ui-docs` repo path to the colocated README already kept current;
 * `data-ui-docs-anchor` optional heading slug. New major panel or popup: stamp
 * these in the same step as the README update. The nameplate portals to
 * `document.body` (z-index 310) so hover labels sit above Radix dialogs.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"

/** `"help"` / `"inspect"` join this union later; unknown values fall to off. */
export const UI_MODES = ["off", "names"] as const
export type UiMode = (typeof UI_MODES)[number]
export type UiOverlayMode = Exclude<UiMode, "off">

export function parseUiMode(value: unknown): UiMode {
  return (UI_MODES as readonly string[]).includes(value as string) ? (value as UiMode) : "off"
}

interface UiNamesState {
  mode: UiMode
  setMode: (mode: UiMode) => void
  /** If `next` is already on, go off; otherwise replace the current mode. */
  toggle: (next: UiOverlayMode) => void
}

export const useUiNamesStore = create<UiNamesState>()(
  persist(
    (set) => ({
      mode: "off",
      setMode: (mode) => set({ mode: parseUiMode(mode) }),
      toggle: (next) =>
        set((state) => ({
          mode: state.mode === next ? "off" : next,
        })),
    }),
    {
      name: persistKey("ui-names"),
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ mode: state.mode }),
      merge: (persisted, current) => {
        const raw = (persisted ?? {}) as Partial<Pick<UiNamesState, "mode">>
        return {
          ...current,
          mode: parseUiMode(raw.mode),
        }
      },
    },
  ),
)

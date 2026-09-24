/**
 * lib/use-persist-hydrated.ts — Wait for a Zustand persist snapshot
 *
 * Habits (and Lists) must not paint seed defaults as if they were the vault.
 * `useSyncExternalStore` keeps SSR on "not yet" and the client on the real flag.
 */
"use client"

import { useSyncExternalStore } from "react"

type PersistGate = {
  hasHydrated: () => boolean
  onFinishHydration: (cb: () => void) => () => void
}

export function usePersistHydrated(persist: PersistGate): boolean {
  return useSyncExternalStore(
    (onChange) => persist.onFinishHydration(onChange),
    () => persist.hasHydrated(),
    () => false,
  )
}

/** Run `fn` once the snapshot is in memory — or immediately when already hydrated. */
export function afterPersistHydrated(
  persist: { hasHydrated?: () => boolean; onFinishHydration?: (fn: () => void) => () => void } | undefined,
  fn: () => void,
): () => void {
  if (!persist?.hasHydrated || persist.hasHydrated()) {
    fn()
    return () => {}
  }
  return persist.onFinishHydration?.(fn) ?? (() => {})
}

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

/** Stores that have hydrated once this session. */
const painted = new WeakSet<PersistGate>()

/**
 * True once the store has hydrated, and it stays true. A later `rehydrate()`
 * (a hub pull, a phone reload) sets the flag false while it re-reads, and the
 * rows already in memory are still the vault, so they stay on screen instead
 * of flashing "Loading habits…".
 */
export function persistHydratedSnapshot(persist: PersistGate): boolean {
  if (painted.has(persist)) return true
  if (!persist.hasHydrated()) return false
  painted.add(persist)
  return true
}

export function usePersistHydrated(persist: PersistGate): boolean {
  return useSyncExternalStore(
    (onChange) => persist.onFinishHydration(onChange),
    () => persistHydratedSnapshot(persist),
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

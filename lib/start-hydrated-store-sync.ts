/**
 * lib/start-hydrated-store-sync.ts — Singleton persist-then-subscribe boot
 *
 * Habit sync modules wait for one or more Zustand persist snapshots, then
 * subscribe once. Idempotent start; returns a stopper for tests. Domain math
 * stays in each sync file — this only owns the bootstrap shape.
 */
import { afterPersistHydrated } from "./use-persist-hydrated"

type PersistGate = {
  hasHydrated?: () => boolean
  onFinishHydration?: (fn: () => void) => () => void
} | undefined

export type HydratedStoreSyncSlot = {
  stopper: (() => void) | null
}

/**
 * If `slot.stopper` is already set, return it. Otherwise chain `persists`
 * through `afterPersistHydrated`, call `onReady` once (it returns unsubscribe),
 * and stash a stopper that cancels waiters + the subscription.
 */
export function startHydratedStoreSync(options: {
  slot: HydratedStoreSyncSlot
  persists: PersistGate[]
  onReady: () => () => void
}): () => void {
  if (options.slot.stopper) return options.slot.stopper

  let stopped = false
  const waiters: Array<() => void> = []
  let unsubscribe: (() => void) | null = null

  const boot = () => {
    if (stopped || unsubscribe) return
    const stop = options.onReady()
    unsubscribe = () => {
      stop()
      unsubscribe = null
    }
  }

  const arm = (index: number) => {
    if (index >= options.persists.length) {
      boot()
      return
    }
    waiters.push(
      afterPersistHydrated(options.persists[index], () => {
        arm(index + 1)
      }),
    )
  }
  arm(0)

  options.slot.stopper = () => {
    stopped = true
    for (const stop of waiters) stop()
    unsubscribe?.()
    options.slot.stopper = null
  }
  return options.slot.stopper
}

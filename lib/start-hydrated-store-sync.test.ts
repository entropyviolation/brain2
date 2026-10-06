import { describe, expect, it, vi } from "vitest"
import { startHydratedStoreSync, type HydratedStoreSyncSlot } from "./start-hydrated-store-sync"

function gate(hydrated: boolean) {
  const listeners = new Set<() => void>()
  return {
    hasHydrated: () => hydrated,
    onFinishHydration: (fn: () => void) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    finish: () => {
      hydrated = true
      for (const fn of [...listeners]) fn()
    },
  }
}

describe("startHydratedStoreSync", () => {
  it("is idempotent — second start reuses the stopper and does not re-boot", () => {
    const slot: HydratedStoreSyncSlot = { stopper: null }
    const onReady = vi.fn(() => vi.fn())
    const a = startHydratedStoreSync({
      slot,
      persists: [{ hasHydrated: () => true }],
      onReady,
    })
    const b = startHydratedStoreSync({
      slot,
      persists: [{ hasHydrated: () => true }],
      onReady,
    })
    expect(a).toBe(b)
    expect(onReady).toHaveBeenCalledTimes(1)
    a()
    expect(slot.stopper).toBeNull()
  })

  it("waits for every persist gate before onReady", () => {
    const slot: HydratedStoreSyncSlot = { stopper: null }
    const first = gate(false)
    const second = gate(false)
    const onReady = vi.fn(() => vi.fn())
    startHydratedStoreSync({
      slot,
      persists: [first, second],
      onReady,
    })
    expect(onReady).not.toHaveBeenCalled()
    first.finish()
    expect(onReady).not.toHaveBeenCalled()
    second.finish()
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it("stopper cancels pending hydration and the subscription", () => {
    const slot: HydratedStoreSyncSlot = { stopper: null }
    const pending = gate(false)
    const unsub = vi.fn()
    const stop = startHydratedStoreSync({
      slot,
      persists: [pending],
      onReady: () => unsub,
    })
    stop()
    pending.finish()
    expect(unsub).not.toHaveBeenCalled()
    expect(slot.stopper).toBeNull()
  })
})

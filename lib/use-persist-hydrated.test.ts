import { describe, expect, it, vi } from "vitest"
import { afterPersistHydrated } from "./use-persist-hydrated"

describe("afterPersistHydrated", () => {
  it("runs immediately when the store is already hydrated", () => {
    const fn = vi.fn()
    const stop = afterPersistHydrated(
      { hasHydrated: () => true, onFinishHydration: () => () => {} },
      fn,
    )
    expect(fn).toHaveBeenCalledTimes(1)
    stop()
  })

  it("waits for onFinishHydration when the vault has not landed", () => {
    const fn = vi.fn()
    let listener: (() => void) | undefined
    const stop = afterPersistHydrated(
      {
        hasHydrated: () => false,
        onFinishHydration: (cb) => {
          listener = cb
          return () => {
            listener = undefined
          }
        },
      },
      fn,
    )
    expect(fn).not.toHaveBeenCalled()
    listener?.()
    expect(fn).toHaveBeenCalledTimes(1)
    stop()
  })
})

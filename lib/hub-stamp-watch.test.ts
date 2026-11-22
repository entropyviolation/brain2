import { afterEach, describe, expect, it, vi } from "vitest"
import { untilInputQuiet } from "@/lib/hub-stamp-watch"

describe("untilInputQuiet", () => {
  afterEach(() => vi.useRealTimers())

  it("waits until no key came for the quiet window", async () => {
    vi.useFakeTimers()
    let done = false
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }))
    const wait = untilInputQuiet(2_000).then(() => {
      done = true
    })
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "b" }))
    await vi.advanceTimersByTimeAsync(1_500)
    expect(done).toBe(false)
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "c" }))
    await vi.advanceTimersByTimeAsync(1_900)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    await wait
    expect(done).toBe(true)
  })
})

import { afterEach, describe, expect, it, vi } from "vitest"
import { advanceConfirmedOffset } from "./confirm-updates"
import { createChatQueue } from "./chat-queue"
import { createDeferredAlbum } from "./deferred-album"

describe("advanceConfirmedOffset", () => {
  it("moves the offset only through writes that finished", () => {
    const ordered = [10, 11, 12]
    expect(advanceConfirmedOffset(10, ordered, new Set([10, 11]))).toBe(12)
    expect(advanceConfirmedOffset(10, ordered, new Set([10, 12]))).toBe(11)
    expect(advanceConfirmedOffset(10, ordered, new Set())).toBe(10)
  })
})

describe("createDeferredAlbum", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("resolves album updates only after the merged apply finishes", async () => {
    vi.useFakeTimers()
    const applied: string[] = []
    let release: (() => void) | undefined
    const album = createDeferredAlbum<{ text: string; mediaGroupId?: string; telegramUpdateId: number }>(
      (merged) =>
        new Promise((resolve) => {
          applied.push(merged.text)
          release = resolve
        }),
      1100,
    )

    let firstDone = false
    let secondDone = false
    const first = album.push({ text: "", mediaGroupId: "g", telegramUpdateId: 1 }).then(() => {
      firstDone = true
    })
    const second = album.push({ text: "milk", mediaGroupId: "g", telegramUpdateId: 2 }).then(() => {
      secondDone = true
    })

    await vi.advanceTimersByTimeAsync(1100)
    expect(applied).toEqual(["milk"])
    expect(firstDone).toBe(false)
    expect(secondDone).toBe(false)

    release?.()
    await first
    await second
    expect(firstDone).toBe(true)
    expect(secondDone).toBe(true)
  })

  it("rejects the album when the write fails, before any confirm", async () => {
    vi.useFakeTimers()
    const album = createDeferredAlbum(async () => {
      throw new Error("flush failed")
    }, 1100)
    const pending = album.push({ text: "a", mediaGroupId: "g", telegramUpdateId: 4 })
    const assertion = expect(pending).rejects.toThrow(/flush failed/)
    await vi.advanceTimersByTimeAsync(1100)
    await assertion
  })
})

describe("createChatQueue", () => {
  it("runs one chat in order and lets the next message go after a failure", async () => {
    const enqueue = createChatQueue()
    const order: string[] = []
    const first = enqueue("9", async () => {
      order.push("a")
      throw new Error("write failed")
    })
    const second = enqueue("9", async () => {
      order.push("b")
      return "ok"
    })
    await expect(first).rejects.toThrow(/write failed/)
    await expect(second).resolves.toBe("ok")
    expect(order).toEqual(["a", "b"])
  })
})

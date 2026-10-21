import { describe, expect, it } from "vitest"
import { HUB_POLL_FAST_MS, HUB_POLL_IDLE_MS, nextHubPollDelay } from "./useMessageIngest"

describe("nextHubPollDelay", () => {
  it("polls fast after messages and backs off when the queue is empty", () => {
    expect(nextHubPollDelay(true)).toBe(HUB_POLL_FAST_MS)
    expect(nextHubPollDelay(false)).toBe(HUB_POLL_IDLE_MS)
    expect(HUB_POLL_IDLE_MS).toBeGreaterThan(HUB_POLL_FAST_MS)
  })
})

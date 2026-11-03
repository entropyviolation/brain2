/**
 * components/Mobile/hub/MobileHub.test.tsx — Hub rows render, recheck every 15 s, and leave no timer behind
 */
import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  status: { ok: true, hasData: true } as { ok: boolean; hasData: boolean },
  outbox: 0,
  loads: 0,
}))

vi.mock("@/components/Mobile/MobilePullCard", () => ({ MobilePullCard: () => null }))
vi.mock("@/components/Mobile/location/MobileLocationCard", () => ({ MobileLocationCard: () => null }))
vi.mock("@/components/Mobile/health/MobileHealthCard", () => ({ MobileHealthCard: () => null }))
vi.mock("@/components/Mobile/nfc/MobileNfcCard", () => ({ MobileNfcCard: () => null }))
vi.mock("@/lib/mobile-sync", () => ({
  fetchMobileSyncStatus: vi.fn(async () => state.status),
  loadBundledHubUrl: async () => "http://192.168.0.150:3000",
  readMobileSyncUrl: () => "",
}))
vi.mock("@/lib/phone-window", () => ({
  engagePhoneWindow: () => {},
  getPhoneWindowSnapshot: () => ({ status: "live", detail: null }),
  getPhoneWindowReport: async () => ({ hubUrl: "http://192.168.0.150:3000", loadedAt: Date.now(), outbox: state.outbox }),
  loadPhoneWindow: async () => {
    state.loads += 1
    return "live"
  },
  subscribePhoneWindow: () => () => {},
  registerPhoneWindowStore: () => {},
}))

import { fetchMobileSyncStatus } from "@/lib/mobile-sync"
import { MobileHub } from "./MobileHub"

async function flush() {
  for (let i = 0; i < 5; i++) await act(async () => {})
}

describe("MobileHub", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    state.status = { ok: true, hasData: true }
    state.outbox = 0
    state.loads = 0
    vi.mocked(fetchMobileSyncStatus).mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it("shows a row per link and the summary off the phone", async () => {
    render(<MobileHub />)
    await flush()
    const rows = screen.getByRole("list", { name: "Phone link status" })
    expect(rows.querySelectorAll("li")).toHaveLength(6)
    expect(rows.querySelector('[data-tone="ok"]')?.textContent).toMatch(/Mac data/)
    expect(screen.getByRole("status")).toHaveTextContent("Everything is hooked up.")
  })

  it("rechecks every 15 s and picks up a new outbox count", async () => {
    render(<MobileHub />)
    await flush()
    const before = vi.mocked(fetchMobileSyncStatus).mock.calls.length
    state.outbox = 2
    await act(async () => {
      vi.advanceTimersByTime(15000)
    })
    await flush()
    expect(vi.mocked(fetchMobileSyncStatus).mock.calls.length).toBe(before + 1)
    expect(screen.getByRole("status")).toHaveTextContent("1 to look at: Phone edits.")
  })

  it("leaves no recheck or ping timer running after it closes", async () => {
    const { unmount } = render(<MobileHub />)
    await flush()
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})

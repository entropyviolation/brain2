/**
 * components/Settings/ScreenTimePanel.test.tsx — Heading, default URL, Sync now
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ScreenTimePanel } from "./ScreenTimePanel"

vi.mock("@/lib/screentime/prefs", () => ({
  DEFAULT_SCREENTIME_PREFS: {
    url: "http://127.0.0.1:5600",
    lookbackDays: 14,
    minDurationSec: 15,
    storeWindowTitles: false,
  },
  loadScreenTimePrefs: () => ({
    url: "http://127.0.0.1:5600",
    lookbackDays: 14,
    minDurationSec: 15,
    storeWindowTitles: false,
  }),
  saveScreenTimePrefs: vi.fn(),
}))

vi.mock("@/lib/screentime/sync", () => ({
  fetchScreenTime: vi.fn(async () => ({ ok: false })),
  syncScreenTime: vi.fn(async () => ({
    ok: true,
    days: 14,
    blocks: 0,
    windowEvents: 0,
    note: "ActivityWatch is reachable but has no recorded windows yet. It only stores time from when the watchers run — it cannot import Apple Screen Time or anything from before install. Keep it running, then Sync now after using the Mac.",
  })),
  describeScreenTimeSync: () =>
    "ActivityWatch is reachable but has no recorded windows yet. It only stores time from when the watchers run — it cannot import Apple Screen Time or anything from before install. Keep it running, then Sync now after using the Mac.",
}))

describe("ScreenTimePanel", () => {
  it("renders heading, default URL, and Sync now", () => {
    render(<ScreenTimePanel />)
    expect(screen.getByRole("heading", { name: "Screen Time" })).toBeInTheDocument()
    expect(screen.getByDisplayValue("http://127.0.0.1:5600")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sync now" })).toBeInTheDocument()
    expect(screen.getByText(/cannot import Apple Screen Time/)).toBeInTheDocument()
    expect(screen.getByText(/iPhone Screen Time/)).toBeInTheDocument()
  })

  it("does not dress an empty success as a failure", async () => {
    const user = userEvent.setup()
    render(<ScreenTimePanel />)
    await user.click(screen.getByRole("button", { name: "Sync now" }))
    expect(await screen.findByText(/no recorded windows yet/)).toBeInTheDocument()
    expect(screen.queryByText(/0 block/)).toBeNull()
  })
})

/**
 * components/Analytics/InstagramView.test.tsx
 */
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { InstagramStatus } from "@/lib/instagram-report"
import { INSTAGRAM_EXPORT_REMINDER_SEEDED_KEY, instagramExportReminderOn } from "@/lib/instagram-export-reminder"
import { resetAllStores } from "@/tests/test-utils"
import { InstagramView } from "./InstagramView"

const base: InstagramStatus = {
  hasReport: true,
  current: {
    buildId: "2026-10-23T00-00-00-000Z",
    exportName: "instagram-_entropyviolation_-2026-10-22-vn7ORB66",
    exportDate: "2026-10-22",
    builtAt: "2026-10-23T00:00:00.000Z",
    ffmpeg: true,
  },
  lastError: null,
  running: false,
  deps: { python: "/py", pythonFound: true, scriptsFound: true, missingModules: [], ffmpeg: "/ffmpeg", ok: true },
  watching: ["/Users/me/Downloads"],
  handle: "entropyviolation",
  reportBase: "brain2-ig://report/",
}

function installBridge(status: InstagramStatus) {
  const bridge = {
    status: vi.fn(async () => status),
    scan: vi.fn(async () => status),
    saveUi: vi.fn(async () => true),
    pickFolder: vi.fn(async () => status),
    onChange: vi.fn(() => () => {}),
  }
  ;(window as unknown as { desktop: unknown }).desktop = { instagram: bridge }
  return bridge
}

afterEach(() => {
  delete (window as unknown as { desktop?: unknown }).desktop
})

describe("InstagramView", () => {
  it("hosts the built report in a frame with export date and last updated", async () => {
    installBridge(base)
    render(<InstagramView />)
    const frame = (await screen.findByTitle("Instagram report")) as HTMLIFrameElement
    expect(frame.getAttribute("src")).toBe("brain2-ig://report/report.html")
    expect(screen.getByText("Export").parentElement?.textContent).toMatch(/Oct 22, 2026/)
    expect(screen.getByText("Last updated")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Check now" })).toBeInTheDocument()
  })

  it("says so in one sentence, with steps, when there is no export yet", async () => {
    installBridge({ ...base, hasReport: false, current: null })
    render(<InstagramView />)
    expect(await screen.findByText("No Instagram export has been read yet. To get one:")).toBeInTheDocument()
    expect(screen.getByText(/All time, JSON, and all information/)).toBeInTheDocument()
    expect(screen.queryByTitle("Instagram report")).toBeNull()
  })

  it("keeps the previous report on screen and shows the error", async () => {
    installBridge({
      ...base,
      lastError: { at: "2026-10-24T00:00:00.000Z", step: "analyze", message: "analyze.py failed.", stderr: "Traceback" },
    })
    render(<InstagramView />)
    expect(await screen.findByText(/The last run failed at/)).toBeInTheDocument()
    expect(screen.getByText(/still the Oct 22, 2026 export/)).toBeInTheDocument()
    expect(screen.getByTitle("Instagram report")).toBeInTheDocument()
  })

  it("says a Drive photo was left behind when the report still updated", async () => {
    installBridge({ ...base, current: { ...base.current!, skipped: 1 } })
    render(<InstagramView />)
    expect(await screen.findByText(/1 file in Google Drive could not be downloaded/)).toBeInTheDocument()
  })

  it("saves ig-* changes the report posts, and ignores other windows", async () => {
    const bridge = installBridge(base)
    render(<InstagramView />)
    const frame = (await screen.findByTitle("Instagram report")) as HTMLIFrameElement
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { brain2Instagram: "state", key: "ig-hide-cols", value: '["dm"]' },
          source: frame.contentWindow,
        }),
      )
      window.dispatchEvent(
        new MessageEvent("message", { data: { brain2Instagram: "state", key: "ig-photos", value: "true" }, source: window }),
      )
    })
    expect(bridge.saveUi).toHaveBeenCalledTimes(1)
    expect(bridge.saveUi).toHaveBeenCalledWith("ig-hide-cols", '["dm"]')
  })

  it("brings settings over from the standalone report", async () => {
    const bridge = installBridge(base)
    render(<InstagramView />)
    await screen.findByTitle("Instagram report")
    fireEvent.change(screen.getByPlaceholderText(/ig-hide-cols/), {
      target: { value: '{"ig-photos":"true","ig-hide-cols":"[\\"dm\\"]","other":"1"}' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Bring over" }))
    })
    expect(bridge.saveUi).toHaveBeenCalledWith("ig-photos", "true")
    expect(bridge.saveUi).toHaveBeenCalledWith("ig-hide-cols", '["dm"]')
    expect(screen.getByText(/Brought over 2 settings/)).toBeInTheDocument()
  })

  it("seeds the monthly export reminder once and lets it be turned off", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 9, 23, 15, 0))
    resetAllStores()
    window.localStorage.removeItem(INSTAGRAM_EXPORT_REMINDER_SEEDED_KEY)
    installBridge(base)
    render(<InstagramView />)
    const off = await screen.findByRole("button", { name: "Turn off" })
    expect(instagramExportReminderOn()).toBe(true)
    // One month after the Oct 22 export, at 10:00.
    expect(screen.getByText("Reminder").parentElement?.textContent).toMatch(/Nov 22 · 10:00 AM/)
    fireEvent.click(off)
    expect(instagramExportReminderOn()).toBe(false)
    expect(await screen.findByRole("button", { name: "Remind me monthly" })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it("lists unsent and edited messages from the archive when opened", async () => {
    const bridge = installBridge(base) as ReturnType<typeof installBridge> & { removed: () => Promise<unknown> }
    bridge.removed = vi.fn(async () => ({
      exports: 2,
      rows: [
        { thread: "sam_1", title: "sam", participants: [], sender: "sam", ts: Date.UTC(2026, 9, 21), content: "something I will unsend", lastSeen: "2026-10-22", removedSince: "2026-10-23", kind: "removed" },
      ],
    }))
    render(<InstagramView />)
    const panel = await screen.findByTestId("instagram-removed")
    ;(panel as HTMLDetailsElement).open = true
    fireEvent(panel, new Event("toggle"))
    expect(await screen.findByText("something I will unsend")).toBeInTheDocument()
    expect(panel.textContent).toMatch(/Unsent or deleted, last in the Oct 22, 2026 export, gone by Oct 23, 2026/)
  })
})

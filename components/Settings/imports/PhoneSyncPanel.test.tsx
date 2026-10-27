/**
 * components/Settings/PhoneSyncPanel.test.tsx — Source rows and the on/off switch
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { PhoneSyncPanel } from "./PhoneSyncPanel"

describe("PhoneSyncPanel", () => {
  it("lists texts as on and health as not built", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ok: true,
          runs: [{ source: "messages", startedAt: 1, finishedAt: 2, read: 4, written: 1, skipped: 3 }],
          enabled: {},
        }),
      })),
    )
    render(<PhoneSyncPanel />)
    expect(await screen.findByRole("heading", { name: "Phone sync" })).toBeInTheDocument()
    expect(screen.getByText("Texts")).toBeInTheDocument()
    expect(screen.getByText(/read 4, wrote 1, skipped 3/)).toBeInTheDocument()
    expect(screen.getByText("Health")).toBeInTheDocument()
    expect(screen.getAllByText("Not built yet").length).toBeGreaterThan(0)
    const ons = screen.getAllByRole("button", { name: "On" })
    expect(ons).toHaveLength(3)
    expect(ons[0]).toHaveAttribute("aria-pressed", "true")
    vi.unstubAllGlobals()
  })

  it("turns calls off", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return { ok: true, json: async () => ({ ok: true, enabled: { calls: false } }) }
      }
      return { ok: true, json: async () => ({ ok: true, runs: [], enabled: {} }) }
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<PhoneSyncPanel />)
    const user = userEvent.setup()
    const buttons = await screen.findAllByRole("button", { name: "On" })
    await user.click(buttons[1])
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/phone-sync/enabled",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ source: "calls", on: false }) }),
    )
    expect(await screen.findByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "false")
    vi.unstubAllGlobals()
  })
})

import { describe, it, expect, beforeEach, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { resetAllStores } from "@/tests/test-utils"
import { useBimChatStore } from "@/lib/ingest/bim-chat"
import { BIM_PING } from "@/lib/ingest/bim"
import { BimPhoneScreen } from "@/components/Bim/phone/bim-phone"
import { BimConsole, clock } from "@/components/Bim/console/bim-console"
import { BimKey, BIM_CHAT_OPEN_KEY } from "@/components/Bim/bim-key"

describe("BIM Chat screens", () => {
  beforeEach(() => {
    resetAllStores()
    useBimChatStore.setState({ lines: [], busy: false })
  })

  it("phone terminal sends a line and shows BIM's reply", async () => {
    render(<BimPhoneScreen />)
    fireEvent.change(screen.getByLabelText("Message BIM"), { target: { value: "ping" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    await waitFor(() => expect(screen.getByText(BIM_PING)).toBeTruthy())
    expect(screen.getByText("ping")).toBeTruthy()
  })

  it("console digit taps a numbered answer, and planned tabs say so", async () => {
    useBimChatStore.setState({
      lines: [{ id: "q", at: new Date().toISOString(), who: "bim", text: "Which?", choices: [{ label: "Milk", text: "1" }, { label: "Eggs", text: "2" }] }],
      busy: false,
    })
    render(<BimConsole open onOpenChange={() => {}} />)
    expect(screen.queryByRole("button", { name: "CLR" })).toBeNull()
    fireEvent.keyDown(screen.getByLabelText("Message BIM"), { key: "2" })
    await waitFor(() => expect(screen.getAllByText("2").length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole("button", { name: /^graph/ }))
    expect(screen.getByText(/PLANNED — NOT CONNECTED YET/)).toBeTruthy()
  })

  it("console stamp is the time today and adds the date on another day", () => {
    const now = new Date(2026, 10, 10, 15, 0)
    const today = clock(new Date(2026, 10, 10, 9, 5).toISOString(), now)
    expect(today).not.toContain("·")
    expect(clock(new Date(2026, 10, 9, 9, 5).toISOString(), now)).toBe(`${new Date(2026, 10, 9).toLocaleDateString([], { month: "short", day: "numeric" })} · ${today}`)
    expect(clock(new Date(2025, 10, 9, 9, 5).toISOString(), now)).toContain("2025")
  })

  it("console Enter sends", async () => {
    render(<BimConsole open onOpenChange={() => {}} />)
    const box = screen.getByLabelText("Message BIM")
    fireEvent.change(box, { target: { value: "ping" } })
    fireEvent.keyDown(box, { key: "Enter" })
    await waitFor(() => expect(screen.getByText(BIM_PING)).toBeTruthy())
  })

  it("phone bar key comes back open after a relaunch, until it is closed", async () => {
    localStorage.removeItem(BIM_CHAT_OPEN_KEY)
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
    try {
      const first = render(<BimKey phoneBar="k" />)
      fireEvent.click(screen.getByRole("button", { name: "BIM Chat" }))
      await waitFor(() => expect(screen.getByLabelText("Message BIM")).toBeTruthy())
      expect(localStorage.getItem(BIM_CHAT_OPEN_KEY)).toBe("1")
      first.unmount()

      render(<BimKey phoneBar="k" />)
      await waitFor(() => expect(screen.getByLabelText("Message BIM")).toBeTruthy())
      fireEvent.click(screen.getByRole("button", { name: "Close BIM Chat" }))
      expect(localStorage.getItem(BIM_CHAT_OPEN_KEY)).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

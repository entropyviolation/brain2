import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { LogActivityDialog, LogActivityLatch } from "./log-activity-dialog"
import { ClockTime, nowTimeString } from "./now-time-button"

beforeEach(() => {
  resetAllStores()
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-06-20T15:47:00"))
})

afterEach(() => {
  vi.useRealTimers()
})

function renderLog() {
  render(
    <div className="trk95">
      <LogActivityDialog
        dateKey="2026-06-20"
        scopeId="activity"
        defaultStartMin={9 * 60}
        defaultEndMin={10 * 60}
        onClose={() => {}}
      />
    </div>,
  )
}

function openClock(index: number) {
  fireEvent.click(screen.getAllByRole("button", { name: "Open clock" })[index])
}

describe("nowTimeString", () => {
  it("formats hours and minutes from the given clock", () => {
    expect(nowTimeString(new Date("2026-06-20T15:47:00"))).toBe("15:47")
    expect(nowTimeString(new Date("2026-06-20T00:05:00"))).toBe("00:05")
  })
})

describe("ClockTime", () => {
  it("keeps Now inside the open clock", () => {
    render(
      <div className="trk95">
        <label htmlFor="t">Start</label>
        <ClockTime id="t" label="Start" time="09:00" onTime={() => {}} />
      </div>,
    )
    expect(screen.queryByRole("button", { name: "Now" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Open clock" }))
    const panel = screen.getByRole("group", { name: "Choose time" })
    expect(panel).toContainElement(screen.getByRole("button", { name: "Now" }))
  })
})

describe("LogActivityDialog right now", () => {
  it("stamps start and end to the current time without changing the date", () => {
    renderLog()
    const dialog = screen.getByRole("dialog")
    fireEvent.click(screen.getAllByRole("button", { name: "Date" })[0])
    const startDate = screen.getByLabelText("Start date")

    openClock(0)
    fireEvent.click(screen.getByRole("button", { name: "Now" }))
    fireEvent.keyDown(screen.getByLabelText("Start"), { key: "Enter" })
    expect(screen.getByLabelText("Start")).toHaveValue("15:47")

    openClock(1)
    fireEvent.click(screen.getByRole("button", { name: "Now" }))
    expect(screen.getByLabelText("End")).toHaveValue("15:47")
    expect(startDate).toHaveValue("2026-06-20")
    expect(dialog).toBeInTheDocument()
  })

  it("stamps the discrete-event time to right now", () => {
    renderLog()
    fireEvent.click(screen.getByRole("switch", { name: "Discrete event" }))
    openClock(0)
    fireEvent.click(screen.getByRole("button", { name: "Now" }))
    expect(screen.getByLabelText("When")).toHaveValue("15:47")
  })

  it("does not put Now beside an idle clock", () => {
    renderLog()
    expect(screen.queryByRole("button", { name: "Now" })).not.toBeInTheDocument()
  })

  it("opens from the grid latch", () => {
    render(
      <div className="trk95">
        <LogActivityLatch dateKey="2026-06-20" />
      </div>,
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Log activity/ }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByLabelText("Start")).toBeInTheDocument()
  })

  it("a minute click sets the start time and does not fall through the dialog", () => {
    renderLog()
    const dialog = screen.getByRole("dialog")
    openClock(0)
    const layer = screen.getByTestId("clock-picker-layer")
    const panel = screen.getByRole("group", { name: "Choose time" })
    expect(layer.style.pointerEvents).not.toBe("none")
    expect(panel.style.pointerEvents).not.toBe("none")
    expect(Number(panel.style.zIndex)).toBeGreaterThan(51)
    expect(Number(layer.style.zIndex)).toBeGreaterThan(51)
    fireEvent.click(screen.getByRole("button", { name: "Minute 01" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
    expect(screen.getByLabelText("Start")).toHaveValue("09:01")
    expect(screen.getByRole("dialog")).toBe(dialog)
  })

  it("a click outside the clock leaves the start time and the dialog", () => {
    renderLog()
    const dialog = screen.getByRole("dialog")
    openClock(0)
    fireEvent.click(screen.getByRole("button", { name: "Minute 01" }))
    fireEvent.pointerDown(screen.getByTestId("clock-picker-backdrop"))
    expect(screen.queryByRole("group", { name: "Choose time" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Start")).toHaveValue("09:00")
    expect(screen.getByRole("dialog")).toBe(dialog)
  })
})

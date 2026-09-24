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

describe("nowTimeString", () => {
  it("formats hours and minutes from the given clock", () => {
    expect(nowTimeString(new Date("2026-06-20T15:47:00"))).toBe("15:47")
    expect(nowTimeString(new Date("2026-06-20T00:05:00"))).toBe("00:05")
  })
})

describe("ClockTime", () => {
  it("hides right now until the time field is live", () => {
    render(
      <div className="trk95">
        <label htmlFor="t">Start</label>
        <ClockTime id="t" label="Start" time="09:00" onTime={() => {}} />
      </div>,
    )
    expect(screen.queryByRole("button", { name: /right now/i })).not.toBeInTheDocument()
    fireEvent.focus(screen.getByLabelText("Start"))
    expect(screen.getByRole("button", { name: "Set start to right now" })).toBeInTheDocument()
  })
})

describe("LogActivityDialog right now", () => {
  it("stamps start and end to the current time without changing the date", () => {
    renderLog()
    const dialog = screen.getByRole("dialog")
    fireEvent.click(screen.getAllByRole("button", { name: "Date" })[0])
    const startDate = screen.getByLabelText("Start date")

    fireEvent.focus(screen.getByLabelText("Start"))
    fireEvent.click(screen.getByRole("button", { name: "Set start to right now" }))
    expect(screen.getByLabelText("Start")).toHaveValue("15:47")

    fireEvent.focus(screen.getByLabelText("End"))
    fireEvent.click(screen.getByRole("button", { name: "Set end to right now" }))
    expect(screen.getByLabelText("End")).toHaveValue("15:47")
    expect(startDate).toHaveValue("2026-06-20")
    expect(dialog).toBeInTheDocument()
  })

  it("stamps the discrete-event time to right now", () => {
    renderLog()
    fireEvent.click(screen.getByRole("switch", { name: "Discrete event" }))
    fireEvent.focus(screen.getByLabelText("When"))
    fireEvent.click(screen.getByRole("button", { name: "Set when to right now" }))
    expect(screen.getByLabelText("When")).toHaveValue("15:47")
  })

  it("does not clutter idle clocks", () => {
    renderLog()
    expect(screen.queryByRole("button", { name: /right now/i })).not.toBeInTheDocument()
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

  it("hides the latch after the clock loses focus", () => {
    renderLog()
    const start = screen.getByLabelText("Start")
    const end = screen.getByLabelText("End")
    fireEvent.focus(start)
    expect(screen.getByRole("button", { name: "Set start to right now" })).toBeInTheDocument()
    fireEvent.blur(start, { relatedTarget: end })
    fireEvent.focus(end)
    expect(screen.queryByRole("button", { name: "Set start to right now" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Set end to right now" })).toBeInTheDocument()
  })
})

/**
 * components/Modules/workspace/module-view-bodies.timer.test.tsx
 *
 * Timer complete → focus-timer-log helpers. Helpers are mocked so this file
 * never writes a store or persist key.
 */
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  appendFocusTimerTimeLogs,
  completeFocusTimer,
  focusTimerPickOptions,
} from "@/lib/focus-timer-log"
import { Timer } from "./module-view-bodies"

vi.mock("@/lib/focus-timer-log", () => ({
  completeFocusTimer: vi.fn(),
  appendFocusTimerTimeLogs: vi.fn(),
  focusTimerPickOptions: vi.fn(() => []),
}))

describe("Timer focus log", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(completeFocusTimer).mockReset()
    vi.mocked(appendFocusTimerTimeLogs).mockReset()
    vi.mocked(focusTimerPickOptions).mockReturnValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("logs to Working Now when the countdown completes", () => {
    vi.mocked(completeFocusTimer).mockReturnValue({
      taskId: "op_1",
      logs: [{ id: "x", date: "2026-06-20", durationMinutes: 1 }],
      needsPick: false,
    })
    render(<Timer minutes={1} />)
    fireEvent.click(screen.getByRole("button", { name: "Start" }))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(completeFocusTimer).toHaveBeenCalledWith(1)
    expect(screen.getByText("Logged 1 min to Working Now")).toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "Log focus session" })).not.toBeInTheDocument()
  })

  it("prompts which item when Working Now is idle", () => {
    vi.mocked(completeFocusTimer).mockReturnValue({
      taskId: null,
      logs: null,
      needsPick: true,
    })
    vi.mocked(focusTimerPickOptions).mockReturnValue([{ id: "t_open", title: "Write intro" }])
    vi.mocked(appendFocusTimerTimeLogs).mockReturnValue([
      { id: "x", date: "2026-06-20", durationMinutes: 1 },
    ])
    render(<Timer minutes={1} />)
    fireEvent.click(screen.getByRole("button", { name: "Start" }))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByRole("dialog", { name: "Log focus session" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Log" }))
    expect(appendFocusTimerTimeLogs).toHaveBeenCalledWith({ taskId: "t_open", durationMinutes: 1 })
    expect(screen.getByText("Logged 1 min to Write intro")).toBeInTheDocument()
  })

  it("Skip is one click and writes nothing", () => {
    vi.mocked(completeFocusTimer).mockReturnValue({
      taskId: null,
      logs: null,
      needsPick: true,
    })
    vi.mocked(focusTimerPickOptions).mockReturnValue([{ id: "t_open", title: "Write intro" }])
    render(<Timer minutes={1} />)
    fireEvent.click(screen.getByRole("button", { name: "Start" }))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    expect(appendFocusTimerTimeLogs).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog", { name: "Log focus session" })).not.toBeInTheDocument()
  })
})

/**
 * PlanTextLog — submit-stamped day/week/month plan entries
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getPlanEntries, getPlanTextViewMode, getStoredPlanText } from "@/lib/plan-text"
import { PlanTextLog } from "./plan-text-log"

function at(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0)
}

describe("PlanTextLog", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(at(2026, 9, 20, 21))
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it("submits a stamped entry and stacks newer ones on top", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<PlanTextLog period="day" periodKey="2026-09-21" placeholder="Write your day plan" />)

    await user.type(screen.getByPlaceholderText(/Write your day plan/i), "work really hard on BRAIN2")
    expect(getPlanEntries("day", "2026-09-21")).toHaveLength(0)

    await user.click(screen.getByRole("button", { name: /Submit plan/i }))
    expect(screen.getByText("work really hard on BRAIN2")).toBeInTheDocument()
    expect(screen.getByRole("listitem")).toHaveTextContent("9/20 9pm")
    expect(getPlanEntries("day", "2026-09-21")[0]?.text).toBe("work really hard on BRAIN2")
    expect(screen.getByPlaceholderText(/Write your day plan/i)).toHaveValue("")

    vi.setSystemTime(at(2026, 9, 21, 7))
    await user.type(screen.getByPlaceholderText(/Write your day plan/i), "go on a walk")
    await user.click(screen.getByRole("button", { name: /Submit plan/i }))

    const items = screen.getAllByRole("listitem")
    expect(items[0]).toHaveTextContent("9/21 7am")
    expect(items[0]).toHaveTextContent("go on a walk")
    expect(items[1]).toHaveTextContent("9/20 9pm")
  })

  it("switches to bulk copy text and latest-only", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<PlanTextLog period="week" periodKey="2026-W38" placeholder="Write your week plan" />)

    await user.type(screen.getByPlaceholderText(/Write your week plan/i), "first")
    await user.click(screen.getByRole("button", { name: /Submit plan/i }))
    vi.setSystemTime(at(2026, 9, 21, 11))
    await user.type(screen.getByPlaceholderText(/Write your week plan/i), "second")
    await user.click(screen.getByRole("button", { name: /Submit plan/i }))

    await user.click(screen.getByRole("tab", { name: "Bulk" }))
    expect(getPlanTextViewMode()).toBe("bulk")
    const bulk = screen.getByLabelText(/All plan entries, copy only/i)
    expect(bulk).toHaveAttribute("readOnly")
    expect(bulk).toHaveAttribute("data-ui-name", "Plan bulk")
    expect(bulk).toHaveValue(getStoredPlanText("week", "2026-W38"))

    await user.click(screen.getByRole("tab", { name: "Latest" }))
    expect(screen.getByText("second")).toBeInTheDocument()
    expect(screen.queryByText("first")).not.toBeInTheDocument()
  })

  it("reloads submitted month entries after a remount", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { unmount } = render(
      <PlanTextLog period="month" periodKey="2026-09" placeholder="Write your month plan" />,
    )
    await user.type(screen.getByPlaceholderText(/Write your month plan/i), "Focus on shipping")
    await user.click(screen.getByRole("button", { name: /Submit plan/i }))
    unmount()

    render(<PlanTextLog period="month" periodKey="2026-09" placeholder="Write your month plan" />)
    expect(screen.getByText("Focus on shipping")).toBeInTheDocument()
  })

  it("keeps unsubmitted month plaintext after a remount", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    localStorage.setItem("monthPlan-2026-09", "")
    const { unmount } = render(
      <PlanTextLog period="month" periodKey="2026-09" placeholder="Write your month plan" />,
    )
    await user.type(screen.getByPlaceholderText(/Write your month plan/i), "not submitted yet")
    unmount()

    render(<PlanTextLog period="month" periodKey="2026-09" placeholder="Write your month plan" />)
    expect(screen.getByPlaceholderText(/Write your month plan/i)).toHaveValue("not submitted yet")
  })

  it("reloads submitted week and day entries after a remount", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const week = render(<PlanTextLog period="week" periodKey="2026-W38" placeholder="Write your week plan" />)
    await user.type(screen.getByPlaceholderText(/Write your week plan/i), "week focus")
    await user.click(screen.getByRole("button", { name: /Submit plan/i }))
    week.unmount()
    const weekAgain = render(<PlanTextLog period="week" periodKey="2026-W38" placeholder="Write your week plan" />)
    expect(screen.getByText("week focus")).toBeInTheDocument()
    weekAgain.unmount()

    const day = render(<PlanTextLog period="day" periodKey="2026-09-21" placeholder="Write your day plan" />)
    await user.type(screen.getByPlaceholderText(/Write your day plan/i), "day focus")
    await user.click(screen.getByRole("button", { name: /Submit plan/i }))
    day.unmount()
    render(<PlanTextLog period="day" periodKey="2026-09-21" placeholder="Write your day plan" />)
    expect(screen.getByText("day focus")).toBeInTheDocument()
  })

  it("does not let past entries be edited from the list", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<PlanTextLog period="month" periodKey="2026-09" placeholder="Write your month plan" />)
    await user.type(screen.getByPlaceholderText(/Write your month plan/i), "Focus on shipping")
    await user.click(screen.getByRole("button", { name: /Submit plan/i }))

    expect(screen.getByText("Focus on shipping").tagName).toBe("PRE")
    expect(screen.queryByDisplayValue("Focus on shipping")).not.toBeInTheDocument()
  })

  it("stamps Month Plan on the log root so Names is not the outer Plan window", () => {
    render(<PlanTextLog period="month" periodKey="2026-09" placeholder="Write your month plan" />)
    const root = document.querySelector(".append-log")
    expect(root).toHaveAttribute("data-ui-name", "Month Plan")
    expect(root).toHaveAttribute(
      "data-ui-help",
      "Monthly written plan log. Submit stamps an entry — not the calendar and not the event chips.",
    )
    expect(root).toHaveAttribute("data-ui-docs", "components/Home/Plan/README.md")
    expect(root).toHaveAttribute("data-ui-docs-anchor", "month")
    expect(document.querySelector(".append-log-history")).toHaveAttribute("data-ui-name", "Plan log")
  })
})

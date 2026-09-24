import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { format } from "date-fns"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { PlanPanel } from "./plan-panel"

vi.mock("./month-view", () => ({
  MonthView: ({ onOpenDay }: { onOpenDay: (date: Date) => void }) => (
    <button type="button" data-testid="month-view" onClick={() => onOpenDay(new Date("2026-06-15T12:00:00"))}>
      Month View
    </button>
  ),
}))

vi.mock("./week-view", () => ({
  WeekView: () => <div data-testid="week-view">Week View</div>,
}))

vi.mock("./day-view", () => ({
  DayView: () => <div data-testid="day-view">Day View</div>,
}))

vi.mock("./event-dialog", () => ({
  EventDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="event-dialog">Event Dialog</div> : null),
}))

vi.mock("./settings-dialog", () => ({
  SettingsDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="plan-settings">Plan Settings</div> : null),
}))

vi.mock("./planned-action-dialog", () => ({
  PlannedActionDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="plan-dialog">Plan Dialog</div> : null),
}))

vi.mock("./paste-events-dialog", () => ({
  PasteEventsDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="paste-events-dialog">Paste Events Dialog</div> : null,
}))

vi.mock("@/components/ItemDetail/ItemDetailPopup", () => ({
  TaskDetailPopup: () => null,
}))

describe("PlanPanel", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("renders plan window caption and default month view", () => {
    render(<PlanPanel currentDate={new Date("2026-06-20T12:00:00")} />)
    expect(screen.getByRole("heading", { name: /Plan/ })).toBeInTheDocument()
    expect(screen.queryByText(/Schedule and organize your time with elegance/i)).not.toBeInTheDocument()
    expect(screen.getByTestId("month-view")).toBeInTheDocument()
  })

  it("opens event dialog when Add Event is clicked", async () => {
    const user = userEvent.setup()
    render(<PlanPanel currentDate={new Date("2026-06-20T12:00:00")} />)

    await user.click(screen.getByRole("button", { name: /Add Event/i }))
    expect(screen.getByTestId("event-dialog")).toBeInTheDocument()
  })

  it("opens planned-action dialog when Add Plan is clicked", async () => {
    const user = userEvent.setup()
    render(<PlanPanel currentDate={new Date("2026-06-20T12:00:00")} />)

    await user.click(screen.getByRole("button", { name: /Add Plan/i }))
    expect(screen.getByTestId("plan-dialog")).toBeInTheDocument()
    expect(screen.queryByTestId("event-dialog")).not.toBeInTheDocument()
  })

  it("opens paste events dialog when Paste Events is clicked", async () => {
    const user = userEvent.setup()
    render(<PlanPanel currentDate={new Date("2026-06-20T12:00:00")} />)

    await user.click(screen.getByRole("button", { name: /Paste Events/i }))
    expect(screen.getByTestId("paste-events-dialog")).toBeInTheDocument()
  })

  it("switches to Day view for the date when a month cell opens a day", async () => {
    const user = userEvent.setup()
    const setCurrentDate = vi.fn()
    render(
      <PlanPanel currentDate={new Date("2026-06-20T12:00:00")} setCurrentDate={setCurrentDate} />,
    )

    await user.click(screen.getByTestId("month-view"))
    expect(setCurrentDate).toHaveBeenCalledTimes(1)
    expect(format(setCurrentDate.mock.calls[0][0] as Date, "yyyy-MM-dd")).toBe("2026-06-15")
    expect(screen.getByRole("tab", { name: "Day" })).toHaveAttribute("data-state", "active")
    expect(screen.getByTestId("day-view")).toBeInTheDocument()
    expect(screen.queryByTestId("event-dialog")).not.toBeInTheDocument()
  })

  it("defaults to gray Plan chrome and persists the Dark latch", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<PlanPanel currentDate={new Date("2026-06-20T12:00:00")} />)
    const root = document.querySelector(".plan95")
    expect(root).toHaveAttribute("data-plan-dark", "false")
    const toggle = screen.getByRole("button", { name: "Dark" })
    expect(toggle).toHaveAttribute("id", "plan-dark-mode")
    expect(toggle).toHaveAttribute("aria-pressed", "false")
    expect(document.getElementById("plan-chrome-toggles")).toContainElement(toggle)

    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-pressed", "true")
    expect(root).toHaveAttribute("data-plan-dark", "true")
    expect(localStorage.getItem("brain2-plan-dark")).toBe("1")
    expect(screen.getByRole("button", { name: "light mode" })).toBe(toggle)

    unmount()
    render(<PlanPanel currentDate={new Date("2026-06-20T12:00:00")} />)
    await waitFor(() => {
      expect(document.querySelector(".plan95")).toHaveAttribute("data-plan-dark", "true")
    })
    expect(screen.getByRole("button", { name: "light mode" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("button", { name: "Dark" })).not.toBeInTheDocument()
  })

  it("defaults gem and trinket mode off and persists it beside Dark", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<PlanPanel currentDate={new Date("2026-06-20T12:00:00")} />)
    const toggle = screen.getByRole("button", { name: "Gem and trinket" })
    expect(toggle).toHaveAttribute("id", "plan-gem-mode")
    expect(toggle).toHaveAttribute("aria-pressed", "false")
    expect(document.getElementById("plan-chrome-toggles")).toContainElement(toggle)

    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-pressed", "true")
    expect(localStorage.getItem("brain2-plan-gem-mode")).toBe("1")
    expect(screen.getByRole("button", { name: "no gem no trinket" })).toBe(toggle)

    unmount()
    render(<PlanPanel currentDate={new Date("2026-06-20T12:00:00")} />)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "no gem no trinket" })).toHaveAttribute(
        "aria-pressed",
        "true",
      )
    })
    expect(screen.queryByRole("button", { name: "Gem and trinket" })).not.toBeInTheDocument()
  })

  it("lets Dark and Gem latches stay on independently", async () => {
    const user = userEvent.setup()
    render(<PlanPanel currentDate={new Date("2026-06-20T12:00:00")} />)
    const row = document.getElementById("plan-chrome-toggles")
    const dark = screen.getByRole("button", { name: "Dark" })
    const gem = screen.getByRole("button", { name: "Gem and trinket" })
    expect(row).toContainElement(dark)
    expect(row).toContainElement(gem)

    await user.click(dark)
    await user.click(gem)
    expect(screen.getByRole("button", { name: "light mode" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "no gem no trinket" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(document.querySelector(".plan95")).toHaveAttribute("data-plan-dark", "true")

    await user.click(screen.getByRole("button", { name: "light mode" }))
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("button", { name: "no gem no trinket" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(document.querySelector(".plan95")).toHaveAttribute("data-plan-dark", "false")
  })
})

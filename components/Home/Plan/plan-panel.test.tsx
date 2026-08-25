import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { PlanPanel } from "./plan-panel"

vi.mock("./month-view", () => ({
  MonthView: () => <div data-testid="month-view">Month View</div>,
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

vi.mock("./paste-events-dialog", () => ({
  PasteEventsDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="paste-events-dialog">Paste Events Dialog</div> : null,
}))

vi.mock("@/components/task-detail-popup", () => ({
  TaskDetailPopup: () => null,
}))

describe("PlanPanel", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("renders plan header and default month view", () => {
    render(<PlanPanel currentDate={new Date("2026-06-20T12:00:00")} />)
    expect(screen.getByText("Plan")).toBeInTheDocument()
    expect(screen.getByTestId("month-view")).toBeInTheDocument()
  })

  it("opens event dialog when Add Event is clicked", async () => {
    const user = userEvent.setup()
    render(<PlanPanel currentDate={new Date("2026-06-20T12:00:00")} />)

    await user.click(screen.getByRole("button", { name: /Add Event/i }))
    expect(screen.getByTestId("event-dialog")).toBeInTheDocument()
  })

  it("opens paste events dialog when Paste Events is clicked", async () => {
    const user = userEvent.setup()
    render(<PlanPanel currentDate={new Date("2026-06-20T12:00:00")} />)

    await user.click(screen.getByRole("button", { name: /Paste Events/i }))
    expect(screen.getByTestId("paste-events-dialog")).toBeInTheDocument()
  })
})

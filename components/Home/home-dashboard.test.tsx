/**
 * HomeDashboard — container behavior tests.
 */
import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { format } from "date-fns"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { HomeDashboard } from "./home-dashboard"
import { msUntilLocalMidnight } from "@/lib/use-current-date"
import { APP_NAV_KEYS, writeStoredDate } from "@/lib/app-navigation"

vi.mock("@/components/Home/Habits/habit-tracker", () => ({
  WeeklyTaskTracker: ({ currentDate }: { currentDate?: Date }) => (
    <div data-testid="panel-habits">Habits {currentDate?.toISOString()}</div>
  ),
}))

vi.mock("@/components/Home/Plan/plan-panel", () => ({
  PlanPanel: ({ currentDate }: { currentDate?: Date }) => (
    <div data-testid="panel-plan">Plan {currentDate?.toISOString()}</div>
  ),
}))

vi.mock("@/components/Home/ToDo/todo-panel", () => ({
  TodoPanel: () => <div data-testid="panel-todo">To Do panel</div>,
}))

vi.mock("@/components/Home/Goals/goals-tracker", () => ({
  GoalsTracker: () => <div data-testid="panel-goals">Goals panel</div>,
}))

vi.mock("@/components/Home/Tracking/time-grid", () => ({
  TimeGrid: () => <div data-testid="panel-time-grid">Time Grid panel</div>,
}))

vi.mock("@/components/Home/Tracking/actual-day-view", () => ({
  ActualDayView: ({ currentDate }: { currentDate?: Date }) => (
    <div data-testid="panel-day-log">Day Log {currentDate?.toISOString()}</div>
  ),
}))

vi.mock("@/components/Home/Tracking/working-now-strip", () => ({
  WorkingNowStrip: () => <div data-testid="working-now-strip">Working on this now</div>,
}))

const overviewSpy = vi.fn(({ currentDate }: { currentDate: Date }) => (
  <div data-testid="home-overview">Overview {format(currentDate, "yyyy-MM-dd")}</div>
))

vi.mock("@/components/Home/home-overview", () => ({
  HomeOverview: (props: { currentDate: Date }) => overviewSpy(props),
}))

describe("HomeDashboard", () => {
  const fixedNow = new Date("2026-06-20T14:30:00")

  beforeEach(() => {
    resetLocalStorage()
    overviewSpy.mockClear()
  })

  describe("layout and header", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(fixedNow)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("renders the date card with weekday, month/day, and year", () => {
      render(<HomeDashboard />)
      expect(screen.getByText(format(fixedNow, "EEEE"))).toBeInTheDocument()
      expect(screen.getByText(format(fixedNow, "MMMM d"))).toBeInTheDocument()
      expect(screen.getByText(format(fixedNow, "yyyy"))).toBeInTheDocument()
    })

    it("keeps the weekday plate on the clock when another day is selected", () => {
      writeStoredDate(APP_NAV_KEYS.homeDate, new Date(2026, 0, 2))
      render(<HomeDashboard />)
      expect(screen.getByText("Saturday")).toBeInTheDocument()
      expect(screen.getByText("June 20")).toBeInTheDocument()
      expect(screen.queryByText("Friday")).not.toBeInTheDocument()
      const passed = overviewSpy.mock.calls.at(-1)?.[0].currentDate as Date
      expect(format(passed, "yyyy-MM-dd")).toBe("2026-01-02")
    })

    it("passes the selected day to the shared overview strip", () => {
      render(<HomeDashboard />)
      expect(overviewSpy).toHaveBeenCalledWith(
        expect.objectContaining({ currentDate: fixedNow }),
      )
      expect(screen.getByTestId("home-overview")).toBeInTheDocument()
    })

    it("wraps Habits in the metal console", () => {
      const { container } = render(<HomeDashboard />)
      expect(container.querySelector(".hab95")).toBeTruthy()
      expect(container.querySelector(".hab-na")).toBeTruthy()
    })

    it("shows the overview strip slot", () => {
      render(<HomeDashboard />)
      expect(screen.getByTestId("home-overview")).toBeInTheDocument()
    })
  })

  describe("Needs Attention", () => {
    it("is collapsed by default", () => {
      render(<HomeDashboard />)
      expect(screen.getByRole("button", { name: /Needs Attention/ })).toHaveAttribute("aria-expanded", "false")
    })

    it("persists collapsed state across remount", async () => {
      const user = userEvent.setup()
      const { unmount } = render(<HomeDashboard />)
      const toggle = screen.getByRole("button", { name: /Needs Attention/ })
      await user.click(toggle)
      expect(toggle).toHaveAttribute("aria-expanded", "true")
      expect(localStorage.getItem("cogs-home-needs-attention")).toBe("expanded")
      unmount()

      render(<HomeDashboard />)
      expect(screen.getByRole("button", { name: /Needs Attention/ })).toHaveAttribute("aria-expanded", "true")
    })
  })

  describe("main sub-tabs", () => {
    it("renders all five main tab triggers", () => {
      render(<HomeDashboard />)
      const tabs = within(screen.getByRole("tablist", { name: "Home view" })).getAllByRole("tab")
      expect(tabs.map((t) => t.textContent)).toEqual(["Habits", "Plan", "To Do", "Goals", "Tracking"])
    })

    it("defaults to the Habits tab", () => {
      render(<HomeDashboard />)
      expect(screen.getByRole("tab", { name: "Habits" })).toHaveAttribute("data-state", "active")
      expect(screen.getByTestId("panel-habits")).toBeVisible()
    })

    it("persists active tab to localStorage", async () => {
      const user = userEvent.setup()
      render(<HomeDashboard />)
      await user.click(screen.getByRole("tab", { name: "Goals" }))
      expect(localStorage.getItem("cogs-home-tab")).toBe("goals")
    })

    it("restores active tab from localStorage", () => {
      localStorage.setItem("cogs-home-tab", "todo")
      render(<HomeDashboard />)
      expect(screen.getByRole("tab", { name: "To Do" })).toHaveAttribute("data-state", "active")
      expect(screen.getByTestId("panel-todo")).toBeVisible()
    })

    it("switches visible panel when each main tab is clicked", async () => {
      const user = userEvent.setup()
      render(<HomeDashboard />)

      for (const { label, testId } of [
        { label: "Plan", testId: "panel-plan" },
        { label: "To Do", testId: "panel-todo" },
        { label: "Goals", testId: "panel-goals" },
        { label: "Tracking", testId: "panel-time-grid" },
        { label: "Habits", testId: "panel-habits" },
      ]) {
        await user.click(screen.getByRole("tab", { name: label }))
        expect(screen.getByTestId(testId)).toBeVisible()
      }
    })

    it("unwraps the Habits metal console on Plan but keeps the overview strip", async () => {
      const user = userEvent.setup()
      const { container } = render(<HomeDashboard />)
      expect(container.querySelector(".hab95")).toBeTruthy()
      expect(screen.getByTestId("home-overview")).toBeInTheDocument()
      await user.click(screen.getByRole("tab", { name: "Plan" }))
      expect(container.querySelector(".hab95")).toBeNull()
      expect(container.querySelector(".hab-na")).toBeNull()
      expect(screen.getByTestId("home-overview")).toBeInTheDocument()
    })

    it("keeps one overview strip on every Home sub-tab", async () => {
      const user = userEvent.setup()
      render(<HomeDashboard />)
      for (const label of ["Plan", "To Do", "Goals", "Tracking", "Habits"]) {
        await user.click(screen.getByRole("tab", { name: label }))
        expect(screen.getByTestId("home-overview")).toBeInTheDocument()
      }
      expect(overviewSpy.mock.calls.length).toBeGreaterThanOrEqual(5)
    })
  })

  describe("Tracking nested sub-tabs", () => {
    it("persists nested tracking tab", async () => {
      const user = userEvent.setup()
      render(<HomeDashboard />)
      await user.click(screen.getByRole("tab", { name: "Tracking" }))
      await user.click(screen.getByRole("tab", { name: "Day Log" }))
      expect(localStorage.getItem("cogs-home-tracking-tab")).toBe("daylog")
    })

    it("restores nested tracking tab from localStorage", async () => {
      localStorage.setItem("cogs-home-tab", "tracking")
      localStorage.setItem("cogs-home-tracking-tab", "daylog")
      render(<HomeDashboard />)
      expect(screen.getByRole("tab", { name: "Day Log" })).toHaveAttribute("data-state", "active")
      expect(screen.getByTestId("panel-day-log")).toBeVisible()
    })

    it("uses the same view-changer chrome as Habits Daily / Weekly / Monthly", async () => {
      const user = userEvent.setup()
      render(<HomeDashboard />)
      await user.click(screen.getByRole("tab", { name: "Tracking" }))
      const changer = document.querySelector(".trk95 .hab-view-changer")
      expect(changer).toBeTruthy()
      expect(within(changer as HTMLElement).getByRole("tablist", { name: "Tracking view" })).toBeInTheDocument()
      expect(within(changer as HTMLElement).getByRole("tab", { name: "Time Grid" })).toBeInTheDocument()
      expect(within(changer as HTMLElement).getByRole("tab", { name: "Activity Log" })).toBeInTheDocument()
      expect(within(changer as HTMLElement).getByRole("tab", { name: "Day Log" })).toBeInTheDocument()
    })

    it("stacks view modes under the pen tray and above the time grid", async () => {
      const user = userEvent.setup()
      render(<HomeDashboard />)
      await user.click(screen.getByRole("tab", { name: "Tracking" }))
      const stack = document.querySelector(".trk-chrome-stack")
      const tray = stack?.querySelector(".trk-pen-tools-row")
      const mode = stack?.querySelector(".trk-mode-bar")
      const desktop = stack?.querySelector(".trk-desktop")
      expect(tray).toBeTruthy()
      expect(mode).toBeTruthy()
      expect(desktop).toBeTruthy()
      expect(tray!.compareDocumentPosition(mode!) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
      expect(mode!.compareDocumentPosition(desktop!) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
      expect(mode!.closest(".trk-pen-tray")).toBeNull()
      const rail = stack?.querySelector(".trk-grid-rail")
      const log = rail && within(rail as HTMLElement).getByRole("button", { name: /Log activity/ })
      expect(log).toBeTruthy()
      expect(log!.closest(".trk-toolbar-row")).toBeNull()
      expect(log!.closest(".trk-mode-bar")).toBeNull()
      expect(tray!.compareDocumentPosition(log!) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
      expect(log!.compareDocumentPosition(desktop!) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
      expect(screen.getByRole("toolbar", { name: "Tracking view modes" })).toBeInTheDocument()
      expect(screen.getByTestId("panel-time-grid")).toBeVisible()
      expect(screen.getAllByRole("button", { name: "Log activity" })).toHaveLength(1)
    })

    it("keeps a single Log activity on Activity Log inside .trk-period, not the grid rail", async () => {
      const user = userEvent.setup()
      render(<HomeDashboard />)
      await user.click(screen.getByRole("tab", { name: "Tracking" }))
      await user.click(screen.getByRole("tab", { name: "Activity Log" }))
      expect(screen.getAllByRole("button", { name: "Log activity" })).toHaveLength(1)
      const stack = document.querySelector(".trk-chrome-stack")
      const rail = stack?.querySelector(".trk-grid-rail")
      expect(rail).toBeNull()
      expect(screen.getByRole("button", { name: "Log activity" }).closest(".trk-period")).toBeTruthy()
    })

    it("keeps Log activity on the grid rail for Day Log", async () => {
      const user = userEvent.setup()
      render(<HomeDashboard />)
      await user.click(screen.getByRole("tab", { name: "Tracking" }))
      await user.click(screen.getByRole("tab", { name: "Day Log" }))
      const stack = document.querySelector(".trk-chrome-stack")
      const rail = stack?.querySelector(".trk-grid-rail")
      expect(rail).toBeTruthy()
      expect(within(rail as HTMLElement).getAllByRole("button", { name: "Log activity" })).toHaveLength(1)
    })

    it("keeps day notes under every tracking view (legend always; textbox after Expand)", async () => {
      const user = userEvent.setup()
      render(<HomeDashboard />)
      await user.click(screen.getByRole("tab", { name: "Tracking" }))
      expect(screen.getByText("Day notes")).toBeInTheDocument()
      expect(screen.queryByRole("textbox", { name: /Notes for / })).not.toBeInTheDocument()
      const notes = document.querySelector("#trk-day-notes") as HTMLElement
      await user.click(within(notes).getByRole("button", { name: "Expand" }))
      expect(screen.getByRole("textbox", { name: /Notes for / })).toBeVisible()
      await user.click(screen.getByRole("tab", { name: "Activity Log" }))
      expect(screen.getByText("Day notes")).toBeInTheDocument()
      expect(screen.getByRole("textbox", { name: /Notes for / })).toBeVisible()
      await user.click(screen.getByRole("tab", { name: "Day Log" }))
      expect(screen.getByText("Day notes")).toBeInTheDocument()
      expect(screen.getByRole("textbox", { name: /Notes for / })).toBeVisible()
    })

    it("places the working-now module under the view changer and before the chrome stack", async () => {
      const user = userEvent.setup()
      render(<HomeDashboard />)
      await user.click(screen.getByRole("tab", { name: "Tracking" }))
      const stack = document.querySelector(".trk-chrome-stack")
      const now = document.querySelector(".trk95 .trk-now-module")
      const notes = stack?.querySelector(".trk-notes")
      const desktop = stack?.querySelector(".trk-desktop")
      const changer = document.querySelector(".trk95 .hab-view-changer")
      expect(now).toBeTruthy()
      expect(notes).toBeTruthy()
      expect(desktop).toBeTruthy()
      expect(changer).toBeTruthy()
      expect(stack).toBeTruthy()
      expect(screen.getByTestId("working-now-strip")).toBeVisible()
      expect(stack!.contains(now)).toBe(false)
      expect(changer!.compareDocumentPosition(now!) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
      expect(now!.compareDocumentPosition(stack!) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
      expect(now!.compareDocumentPosition(desktop!) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
      expect(desktop!.compareDocumentPosition(notes!) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
      expect(now!.nextElementSibling).toBe(stack)
    })

    it("does not render the Sleep this day / Fell asleep / Woke up form", async () => {
      const user = userEvent.setup()
      render(<HomeDashboard />)
      await user.click(screen.getByRole("tab", { name: "Tracking" }))
      expect(screen.queryByText("Sleep this day")).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Fell asleep")).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Woke up")).not.toBeInTheDocument()
      expect(screen.queryByRole("region", { name: "Sleep log" })).not.toBeInTheDocument()
    })
  })

  describe("date rollover", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 5, 20, 23, 59, 0))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("updates header date at local midnight", async () => {
      const beforeMidnight = new Date(2026, 5, 20, 23, 59, 0)
      const afterMidnight = new Date(2026, 5, 21, 0, 0, 1)

      render(<HomeDashboard />)
      expect(screen.getByText(format(beforeMidnight, "EEEE"))).toBeInTheDocument()
      expect(screen.getByText(format(beforeMidnight, "MMMM d"))).toBeInTheDocument()

      await act(async () => {
        vi.advanceTimersByTime(msUntilLocalMidnight(beforeMidnight) + 1)
      })

      expect(screen.getByText(format(afterMidnight, "EEEE"))).toBeInTheDocument()
      expect(screen.getByText(format(afterMidnight, "MMMM d"))).toBeInTheDocument()
    })
  })
})

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { localDayKey, useReviewsStore } from "@/lib/reviews-store"
import { TaskType } from "@/lib/types"
import { WeeklyTaskTracker } from "./habit-tracker"
import { plasmaClipWidth } from "./noble-gas-tube"
import { appendPlanEntry, getPlanEntries } from "@/lib/plan-text"
import { formatLocalDateKey } from "@/lib/date-utils"

vi.mock("@/components/Home/Habits/task-grid", () => ({
  TaskGrid: () => <div data-testid="task-grid">Task Grid</div>,
}))

vi.mock("@/components/Home/Habits/period-habit-list", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/Home/Habits/period-habit-list")>()
  return {
    ...actual,
  PeriodHabitList: ({ periods }: { periods?: { key: string }[] }) => (
    <div data-testid="period-habit-list" data-columns={periods?.length ?? 0}>
      Period Habit List
    </div>
  ),
  }
})

vi.mock("@/components/Home/Habits/daily-task-form-dialog", () => ({
  TaskFormDialog: () => null,
}))

vi.mock("@/components/Home/Habits/settings-dialog", () => ({
  SettingsDialog: () => null,
}))

vi.mock("@/components/Home/Habits/week-navigation", () => ({
  WeekNavigation: () => <div data-testid="week-navigation">Week Navigation</div>,
}))

describe("WeeklyTaskTracker", () => {
  beforeEach(() => {
    resetAllStores()
    useHabitsStore.getState().setTasks([
      { id: "d1", name: "Daily habit", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" },
      { id: "w1", name: "Weekly habit", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "weekly" },
    ])
  })

  it("renders habit tabs and daily grid by default", () => {
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    expect(screen.getByRole("heading", { name: "Habits" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Daily \(1\)/ })).toBeInTheDocument()
    expect(screen.getByTestId("task-grid")).toBeInTheDocument()
    expect(screen.getByTestId("week-navigation")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /New habit/i })).toBeInTheDocument()
    expect(screen.getByText("Week grade")).toBeInTheDocument()
    expect(screen.getByText("Perfect output")).toBeInTheDocument()
    expect(screen.getByText("Good days")).toBeInTheDocument()
    expect(screen.getByText("Streak")).toBeInTheDocument()
    expect(screen.getByText("Last 30")).toBeInTheDocument()
    expect(screen.getByText("Willpower gems")).toBeInTheDocument()
    const desk = document.querySelector(".hab-desk")
    expect(desk?.querySelector(":scope > .hab-sheet > .hab-well")).toBeTruthy()
    expect(desk?.querySelector(":scope > .hab-control-panel")).toBeTruthy()
    expect(desk?.querySelector(".hab-well .hab-control-panel")).toBeNull()
    const rail = document.querySelector(".hab-control-panel")
    expect(rail?.querySelector(".hab-control-stack")).toBeTruthy()
    expect(rail?.textContent).toMatch(/Week grade/)
    expect(rail?.textContent).toMatch(/Perfect output/)
    expect(rail?.textContent).toMatch(/Good days/)
    expect(rail?.textContent).toMatch(/Streak/)
    expect(rail?.textContent).toMatch(/New habit/)
    expect([...rail!.querySelectorAll(".hab-control-band")].map((el) => el.getAttribute("data-band"))).toEqual([
      "meters",
      "sheet",
      "lamps",
    ])
    const stack = rail?.querySelector(":scope > .hab-control-stack")
    const neu = rail?.querySelector(":scope > .hab-control-new")
    const gems = rail?.querySelector(":scope > .hab-willpower-gems")
    expect(stack && neu && gems).toBeTruthy()
    expect(stack!.compareDocumentPosition(neu!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(neu!.compareDocumentPosition(gems!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(rail?.querySelector('[role="switch"]')).toBeTruthy()
    expect(screen.queryByText("Sort Habits")).not.toBeInTheDocument()
    expect(document.querySelector(".hab-control-panel")?.textContent).not.toMatch(/Sort/)
    expect(document.querySelector(".hab-sheet > .hab-priority")).toBeTruthy()
    expect(document.querySelector(".hab-well .hab-priority")).toBeNull()
    expect(screen.getByRole("button", { name: "Sort" })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Highlight priorities" })).toHaveAttribute("aria-checked", "false")
    expect(screen.getByRole("switch", { name: "Streaks and multipliers" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("switch", { name: "Heatmap View" })).toHaveAttribute("aria-checked", "false")
    expect(screen.getByRole("switch", { name: "Day View" })).toHaveAttribute("aria-checked", "false")
    expect(screen.getByRole("switch", { name: "Hide Done" })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Hide Done" })).toHaveAttribute("aria-label", "Hide Done")
    expect(screen.getByRole("button", { name: "Exemption wand" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("switch", { name: "Loading Bar" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("switch", { name: "Small LEDs" })).toHaveAttribute("aria-checked", "true")
    const heat = screen.getByRole("switch", { name: "Heatmap View" })
    const day = screen.getByRole("switch", { name: "Day View" })
    const hide = screen.getByRole("switch", { name: "Hide Done" })
    const load = screen.getByRole("switch", { name: "Loading Bar" })
    const small = screen.getByRole("switch", { name: "Small LEDs" })
    expect(heat.compareDocumentPosition(day) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(day.compareDocumentPosition(hide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(hide.compareDocumentPosition(load) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(load.compareDocumentPosition(small) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Daily view" })).not.toBeInTheDocument()
    expect(screen.queryByRole("switch", { name: /Sort by priority/ })).not.toBeInTheDocument()
    expect(document.querySelector(".hab-head-utils")?.textContent).not.toMatch(/New habit/)
    expect(document.querySelector(".hab-head")?.querySelector('[role="tablist"]')).toBeNull()
    const changer = document.querySelector(".hab-view-changer")
    expect(changer?.textContent).toMatch(/Daily/)
    expect(changer?.textContent).toMatch(/Weekly/)
    expect(changer?.textContent).toMatch(/Monthly/)
  })

  it("puts the priority bar in the grid pane and drops the morning prose list", () => {
    const day = localDayKey(new Date("2026-06-20T12:00:00"))
    useReviewsStore.getState().saveMorningReview(day, { priorityHabitIds: ["d1"] })
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    expect(screen.queryByText("Morning habit priorities")).not.toBeInTheDocument()
    const desk = document.querySelector(".hab-desk")
    expect(desk?.children).toHaveLength(2)
    expect(desk?.querySelector(":scope > .hab-sheet > .hab-priority")).toBeTruthy()
    expect(desk?.querySelector(":scope > .hab-sheet > .hab-well .hab-priority")).toBeNull()
    expect(desk?.querySelector(":scope > .hab-control-panel")).toBeTruthy()
    expect(screen.getByText("Priority")).toBeInTheDocument()
  })

  it("switches the checklist to heatmap view from the sidebar rocker", async () => {
    const user = userEvent.setup()
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    await user.click(screen.getByRole("switch", { name: "Heatmap View" }))
    expect(screen.getByRole("switch", { name: "Heatmap View" })).toHaveAttribute("aria-checked", "true")
    expect(screen.queryByTestId("task-grid")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Habit heatmap")).toBeInTheDocument()
    expect(document.querySelector(".hab-control-panel .hab-control-stack")).toBeTruthy()
  })

  it("persists Day View, Loading Bar, Small LEDs, and Hide Completed Today from the Daily control panel", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    expect(useHabitsStore.getState().habitDayView).toBe(false)
    expect(useHabitsStore.getState().percentLoadingBar).toBe(true)
    expect(useHabitsStore.getState().habitSmallLeds).toBe(true)
    expect(useHabitsStore.getState().hideCompletedToday).toBe(false)
    await user.click(screen.getByRole("switch", { name: "Day View" }))
    expect(useHabitsStore.getState().habitDayView).toBe(true)
    await user.click(screen.getByRole("switch", { name: "Loading Bar" }))
    expect(useHabitsStore.getState().percentLoadingBar).toBe(false)
    await user.click(screen.getByRole("switch", { name: "Small LEDs" }))
    expect(useHabitsStore.getState().habitSmallLeds).toBe(false)
    await user.click(screen.getByRole("switch", { name: "Hide Done" }))
    expect(useHabitsStore.getState().hideCompletedToday).toBe(true)
    unmount()
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    expect(screen.getByRole("switch", { name: "Hide Done" })).toHaveAttribute("aria-checked", "true")
    expect(useHabitsStore.getState().hideCompletedToday).toBe(true)
  })

  it("persists each sort mode from the priority bar", async () => {
    const user = userEvent.setup()
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    const labels = {
      alphabetical: "Alphabetical",
      created: "Date created",
      priority: "Priority",
      weeklyCompletion: "Weekly completion %",
      default: "Default",
    } as const
    for (const mode of ["alphabetical", "created", "priority", "weeklyCompletion", "default"] as const) {
      await user.click(screen.getByRole("button", { name: "Sort" }))
      await user.click(screen.getByRole("option", { name: labels[mode] }))
      expect(useHabitsStore.getState().habitSortMode).toBe(mode)
      expect(useHabitsStore.getState().sortHabitsByPriorityFlag).toBe(mode === "priority")
    }
    await user.click(screen.getByRole("button", { name: "Sort ascending" }))
    expect(useHabitsStore.getState().habitSortDirection).toBe("desc")
    await user.click(screen.getByRole("button", { name: "Sort descending" }))
    expect(useHabitsStore.getState().habitSortDirection).toBe("asc")
  })

  it("names period completion on week, month, and season", async () => {
    const user = userEvent.setup()
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    await user.click(screen.getByRole("button", { name: "Sort" }))
    expect(screen.getByRole("option", { name: "Weekly completion %" })).toBeInTheDocument()
    await user.keyboard("{Escape}")
    await user.click(screen.getByRole("switch", { name: "Day View" }))
    await user.click(screen.getByRole("button", { name: "Sort" }))
    expect(screen.getByRole("option", { name: "Weekly completion %" })).toBeInTheDocument()
    await user.keyboard("{Escape}")
    await user.click(screen.getByRole("tab", { name: /Weekly \(/ }))
    await user.click(screen.getByRole("button", { name: "Sort" }))
    expect(screen.getByRole("option", { name: "Period completion %" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Monthly completion %" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Season completion %" })).not.toBeInTheDocument()
    await user.keyboard("{Escape}")
    await user.click(screen.getByRole("tab", { name: /Monthly \(/ }))
    await user.click(screen.getByRole("button", { name: "Sort" }))
    expect(screen.getByRole("option", { name: "Period completion %" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Alphabetical" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Weekly completion %" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Monthly completion %" })).not.toBeInTheDocument()
    await user.keyboard("{Escape}")
    await user.click(screen.getByRole("tab", { name: /Season \(/ }))
    await user.click(screen.getByRole("button", { name: "Sort" }))
    expect(screen.getByRole("option", { name: "Period completion %" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Season completion %" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: /Weekly/ })).not.toBeInTheDocument()
  })

  it("switches to weekly tab content when clicked", async () => {
    const user = userEvent.setup()
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)

    await user.click(screen.getByRole("tab", { name: /Weekly \(1\)/ }))
    expect(screen.getByTestId("period-habit-list")).toBeInTheDocument()
    expect(screen.getByText("Span grade")).toBeInTheDocument()
    expect(screen.getByText("Perfect output")).toBeInTheDocument()
    expect(screen.queryByText("Good days")).not.toBeInTheDocument()
    expect(screen.getByText("Good weeks")).toBeInTheDocument()
    expect(screen.getByText("Last 12")).toBeInTheDocument()
    expect(screen.queryByRole("switch", { name: "Heatmap View" })).not.toBeInTheDocument()
    expect(screen.queryByRole("switch", { name: "Day View" })).not.toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Loading Bar" })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Small LEDs" })).toBeInTheDocument()
    expect(screen.queryByText("Sort Habits")).not.toBeInTheDocument()
    expect(document.querySelector(".hab-sheet > .hab-priority")).toBeTruthy()
    expect(document.querySelector(".hab-well .hab-priority")).toBeNull()
    expect(document.querySelector(".hab-control-panel")?.textContent).not.toMatch(/Sort/)
    expect(screen.getByRole("switch", { name: "Hide Done" })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Hide Done and Missed" })).toHaveAttribute(
      "aria-label",
      "Hide Done and Missed",
    )
    expect(document.querySelector(".hab-head-utils")?.textContent).not.toMatch(/New habit/)
    expect(document.querySelector(".hab-control-panel .hab-control-stack")).toBeTruthy()
    expect(document.querySelector(".hab-view-changer")?.textContent).toMatch(/Weekly/)
    const rail = document.querySelector(".hab-control-panel")
    const stack = rail?.querySelector(".hab-control-stack")
    const plate = rail?.querySelector(".hab-willpower-gems")
    expect(stack && plate && (stack.compareDocumentPosition(plate) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy()
  })

  it("opens a grade breakdown when Week grade is clicked", async () => {
    const user = userEvent.setup()
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    await user.click(screen.getByRole("button", { name: /Week grade/ }))
    expect(screen.getByRole("dialog", { name: /Week grade/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Daily perfect threshold/i)).toBeInTheDocument()
    expect(screen.getByText(/each daily habit is worth 50/i)).toBeInTheDocument()
    expect(screen.getByText(/\+50 if that day.s raw score is at or above 80%/i)).toBeInTheDocument()
    expect(screen.getByText(/\+100 if either/i)).toBeInTheDocument()
  })

  it("opens an output grade breakdown when Perfect output is clicked", async () => {
    const user = userEvent.setup()
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    await user.click(screen.getByRole("button", { name: /Perfect output/ }))
    expect(screen.getByRole("dialog", { name: /Perfect output/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Output perfect threshold/i)).toBeInTheDocument()
  })

  it("opens Good days separately from grade metrics", async () => {
    const user = userEvent.setup()
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    await user.click(screen.getByRole("button", { name: /^Streak/ }))
    expect(screen.getByRole("dialog", { name: /Good days/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Completion to feel accomplished/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Accomplishment bonus/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Daily perfect threshold/i)).not.toBeInTheDocument()
  })

  it("hides Good days when switching off the Daily tab", async () => {
    const user = userEvent.setup()
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    await user.click(screen.getByRole("tab", { name: /Weekly \(1\)/ }))
    expect(screen.queryByText("Good days")).not.toBeInTheDocument()
    expect(screen.getByText("Good weeks")).toBeInTheDocument()
    expect(screen.queryByText("Week grade")).not.toBeInTheDocument()
  })

  it("aligns good-day streak wells as a compact column pair in grade phosphor", () => {
    render(
      <div className="hab95">
        <WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />
      </div>,
    )
    const shell = document.querySelector(".hab95")
    expect(shell).toBeTruthy()
    expect(getComputedStyle(shell!).getPropertyValue("--hab-crt-green").trim()).toBe("#7dffc4")
    expect(getComputedStyle(shell!).getPropertyValue("--hab-crt-glow").trim()).toBe(
      "0 0 3px var(--hab-crt-green)",
    )
    const wells = document.querySelectorAll(".hab-control-streak .habit-good-days-stat strong")
    expect(wells).toHaveLength(2)
    for (const well of wells) {
      const style = getComputedStyle(well)
      expect(style.display).toBe("flex")
      expect(style.alignItems).toBe("center")
      expect(style.height).toBe("26px")
      expect(style.minHeight).toBe("26px")
      expect(style.color === "var(--hab-crt-green)" || style.color === "rgb(125, 255, 196)").toBe(true)
    }
    expect(getComputedStyle(wells[0]).height).toBe(getComputedStyle(wells[1]).height)
  })

  it("clips noble-gas plasma to the week and output percents", () => {
    const day = new Date("2026-09-20T12:00:00")
    vi.useFakeTimers()
    vi.setSystemTime(day)
    useHabitsStore.getState().updateCompletion("d1", day, { completed: true })
    render(<WeeklyTaskTracker currentDate={day} />)
    const week = screen.getByRole("progressbar", { name: "Week grade" })
    const output = screen.getByRole("progressbar", { name: "Perfect output" })
    expect(week).toHaveAttribute("data-gas", "argon")
    expect(output).toHaveAttribute("data-gas", "xenon")
    const weekPct = parseFloat(week.style.getPropertyValue("--hab-plasma"))
    const outPct = parseFloat(output.style.getPropertyValue("--hab-plasma"))
    expect(weekPct).toBeGreaterThan(0)
    expect(outPct).toBeGreaterThan(0)
    const weekClip = week.querySelector("[data-testid='hab-gas-plasma-clip']")
    const outClip = output.querySelector("[data-testid='hab-gas-plasma-clip']")
    expect(Number(weekClip?.getAttribute("width"))).toBeCloseTo(plasmaClipWidth(weekPct), 5)
    expect(Number(outClip?.getAttribute("width"))).toBeCloseTo(plasmaClipWidth(outPct), 5)
    vi.useRealTimers()
  })

  it("still paints week and output tubes when Home calendar date is outside the visible week", () => {
    const weekDay = new Date("2026-09-22T12:00:00")
    const planPast = new Date("2026-08-05T12:00:00")
    vi.useFakeTimers()
    vi.setSystemTime(weekDay)
    useHabitsStore.getState().updateCompletion("d1", weekDay, { completed: true })
    render(<WeeklyTaskTracker currentDate={planPast} />)
    const week = screen.getByRole("progressbar", { name: "Week grade" })
    const output = screen.getByRole("progressbar", { name: "Perfect output" })
    expect(parseFloat(week.style.getPropertyValue("--hab-plasma"))).toBeGreaterThan(0)
    expect(parseFloat(output.style.getPropertyValue("--hab-plasma"))).toBeGreaterThan(0)
    vi.useRealTimers()
  })

  it("paints live tubes from persisted per-grade hues", () => {
    const day = new Date("2026-09-20T12:00:00")
    vi.useFakeTimers()
    vi.setSystemTime(day)
    useHabitsStore.getState().setGradeTubeColor("#ff8800")
    useHabitsStore.getState().setOutputGradeTubeColor("#1122aa")
    useHabitsStore.getState().updateCompletion("d1", day, { completed: true })
    render(<WeeklyTaskTracker currentDate={day} />)
    expect(screen.getByRole("progressbar", { name: "Week grade" })).toHaveAttribute(
      "data-hue",
      "#ff8800",
    )
    expect(screen.getByRole("progressbar", { name: "Perfect output" })).toHaveAttribute(
      "data-hue",
      "#1122aa",
    )
    vi.useRealTimers()
  })

  it("does not paint the seed grid before persist hydrates", () => {
    vi.spyOn(useHabitsStore.persist, "hasHydrated").mockReturnValue(false)
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    expect(screen.queryByTestId("task-grid")).not.toBeInTheDocument()
    expect(screen.getByText("Loading habits…")).toBeInTheDocument()
    expect(screen.queryByText("No habits yet. Add one to get started.")).not.toBeInTheDocument()
    vi.restoreAllMocks()
  })

  it("puts Missed op wand under Exemption wand and keeps the hide rocker off", async () => {
    const user = userEvent.setup()
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    const wands = document.querySelectorAll(".hab-control-toggles .hab-wand")
    expect(wands[0]).toHaveAttribute("data-ui-name", "Exemption wand")
    expect(wands[1]).toHaveAttribute("data-ui-name", "Missed op wand")
    const hideToday = screen.getByRole("switch", { name: "Hide Done" })
    const hideBoth = screen.getByRole("switch", { name: "Hide Done and Missed" })
    expect(hideBoth).toHaveClass("hab-rocker")
    expect(hideBoth).toHaveAttribute("aria-checked", "false")
    expect(hideToday.compareDocumentPosition(hideBoth) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Missed op wand" }))
    expect(screen.getByRole("button", { name: "Missed op wand on" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Exemption wand" })).toHaveAttribute("aria-pressed", "false")
    await user.click(screen.getByRole("button", { name: "Exemption wand" }))
    expect(screen.getByRole("button", { name: "Exemption wand on" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Missed op wand" })).toHaveAttribute("aria-pressed", "false")
    await user.click(hideBoth)
    expect(useHabitsStore.getState().hideCompletedAndMissed).toBe(true)
    expect(useHabitsStore.getState().hideCompletedToday).toBe(false)
  })

  it("opens the shared day plan log from Day View", async () => {
    const user = userEvent.setup()
    const day = new Date("2026-06-20T12:00:00")
    const dayKey = formatLocalDateKey(day)
    appendPlanEntry("day", dayKey, "orchard")
    render(<WeeklyTaskTracker currentDate={day} />)
    expect(screen.queryByRole("button", { name: "Submit plan" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("switch", { name: "Day View" }))
    expect(screen.getByRole("button", { name: "Submit plan" })).toBeInTheDocument()
    expect(screen.getByText("orchard")).toBeInTheDocument()
    expect(getPlanEntries("day", dayKey).map((entry) => entry.text)).toEqual(["orchard"])
  })

  it("Week View collapses to one column without changing habitWeekWindow", async () => {
    const user = userEvent.setup()
    useHabitsStore.setState({ habitWeekWindow: "fourWeeks" })
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    await user.click(screen.getByRole("tab", { name: /Weekly \(1\)/ }))
    const sheet = screen.getByTestId("period-habit-list")
    expect(Number(sheet.getAttribute("data-columns"))).toBeGreaterThan(1)
    expect(screen.queryByRole("button", { name: "Submit plan" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("switch", { name: "Week View" }))
    expect(useHabitsStore.getState().habitWeekView).toBe(true)
    expect(useHabitsStore.getState().habitWeekWindow).toBe("fourWeeks")
    expect(screen.getByTestId("period-habit-list")).toHaveAttribute("data-columns", "1")
    expect(screen.getByRole("button", { name: "Submit plan" })).toBeInTheDocument()
    await user.click(screen.getByRole("switch", { name: "Week View" }))
    expect(useHabitsStore.getState().habitWeekView).toBe(false)
    expect(useHabitsStore.getState().habitWeekWindow).toBe("fourWeeks")
    expect(Number(screen.getByTestId("period-habit-list").getAttribute("data-columns"))).toBeGreaterThan(1)
    expect(screen.queryByRole("button", { name: "Submit plan" })).not.toBeInTheDocument()
  })
})

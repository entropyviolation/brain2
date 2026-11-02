/** components/Home/Habits/phone/habits-phone-week.test.tsx */
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { addCalendarDays, formatLocalDateKey } from "@/lib/date-utils"
import { isOnCurrentPeriod } from "@/components/Home/Habits/period/habits-period-cursor"
import { WeeklyTaskTracker } from "../habit-tracker"
import {
  cellChangeSourceLabel,
  phoneCellBrightness,
  phoneCellHistory,
  phoneHabitLabel,
  phoneNavLens,
  phonePausedOn,
  phoneVisibleHabits,
} from "./habits-phone-week"

const originalMatchMedia = window.matchMedia

function setPhoneMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query === "(max-width: 767px)",
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

const goal: WeeklyTask = { id: "g1", name: "Exercise", type: TaskType.GOAL, goal: 5, frequency: "daily" }
const lamp: WeeklyTask = { id: "l1", name: "Vitamin D", type: TaskType.BOOLEAN, frequency: "daily" }

describe("phone week math", () => {
  it("lights a partial square in proportion: 2 of 5 is 0.4", () => {
    const day = new Date(2026, 10, 1)
    expect(phoneCellBrightness(goal, { value: 2, goal: 5 }, {}, day, true)).toBeCloseTo(0.4)
    expect(phoneCellBrightness(goal, { value: 9, goal: 5 }, {}, day, true)).toBe(1)
    expect(phoneCellBrightness(goal, undefined, {}, day, true)).toBe(0)
    expect(phoneCellBrightness(lamp, { completed: true }, {}, day, true)).toBe(1)
    const weekly = { ...goal, frequency: "weekly" as const }
    expect(phoneCellBrightness(weekly, { value: 2, goal: 5 }, {}, day, false)).toBeCloseTo(0.4)
  })

  it("labels a row with the shorthand, else the name", () => {
    expect(phoneHabitLabel({ name: "read 5 pages", shorthandName: "read" })).toBe("read")
    expect(phoneHabitLabel({ name: "read 5 pages", shorthandName: "   " })).toBe("read 5 pages")
    expect(phoneHabitLabel({ name: "read 5 pages" })).toBe("read 5 pages")
  })

  it("moves the chevrons by day on the Daily list and by week on the Week sheet", () => {
    expect(phoneNavLens("daily", false, false)).toBe("day")
    expect(phoneNavLens("daily", true, false)).toBe("week")
    expect(phoneNavLens("daily", false, true)).toBe("week")
    expect(phoneNavLens("weekly", false, false)).toBe("week")
    expect(phoneNavLens("monthly", true, false)).toBe("month")
    expect(phoneNavLens("quarterly", false, false)).toBe("season")
  })

  it("knows when the view is on the current period", () => {
    const today = new Date(2026, 10, 1, 9)
    expect(isOnCurrentPeriod(new Date(2026, 10, 1), "day", today)).toBe(true)
    expect(isOnCurrentPeriod(new Date(2026, 9, 31), "day", today)).toBe(false)
    expect(isOnCurrentPeriod(new Date(2026, 9, 27), "week", today)).toBe(true)
    expect(isOnCurrentPeriod(new Date(2026, 9, 20), "week", today)).toBe(false)
    expect(isOnCurrentPeriod(new Date(2026, 10, 20), "month", today)).toBe(true)
    expect(isOnCurrentPeriod(new Date(2026, 6, 1), "season", today)).toBe(false)
  })

  it("hides habits paused today unless Show paused is on", () => {
    const paused = { ...goal, pauses: [{ from: "2026-10-20" }] }
    const ended = { ...lamp, pauses: [{ from: "2026-10-01", to: "2026-10-05" }] }
    expect(phonePausedOn(paused, "2026-11-01")).toBe(true)
    expect(phonePausedOn(ended, "2026-10-05")).toBe(true)
    expect(phonePausedOn(ended, "2026-10-06")).toBe(false)
    expect(phoneVisibleHabits([paused, ended], "2026-11-01", false)).toEqual([ended])
    expect(phoneVisibleHabits([paused, ended], "2026-11-01", true)).toEqual([paused, ended])
  })

  it("lists cell history newest first in plain words", () => {
    const history = phoneCellHistory({
      value: 3,
      changes: [
        { at: "2026-11-01T08:00:00.000Z", source: "manual-desktop", from: null, to: 1 },
        { at: "2026-11-01T09:00:00.000Z", source: "manual-ios", from: 1, to: 3 },
      ],
    })
    expect(history.map((change) => change.to)).toEqual([3, 1])
    expect(cellChangeSourceLabel("manual-ios")).toBe("Manual · iPhone")
    expect(cellChangeSourceLabel("manual-desktop")).toBe("Manual · desktop")
    expect(cellChangeSourceLabel("llm-suggestion")).toBe("Suggested by helper")
    expect(cellChangeSourceLabel("auto-tracking")).toBe("From Tracking")
    expect(cellChangeSourceLabel("auto-link")).toBe("From link")
    expect(cellChangeSourceLabel("wand")).toBe("Wand")
  })
})

describe("phone habits shell", () => {
  beforeEach(() => {
    setPhoneMedia()
    resetAllStores()
  })
  afterEach(() => {
    Object.defineProperty(window, "matchMedia", { writable: true, configurable: true, value: originalMatchMedia })
  })

  it("keeps a lamp row to the gem, the name, and the LED, with no source line", () => {
    const today = new Date()
    const key = formatLocalDateKey(today)
    useHabitsStore.getState().setTasks([lamp, goal])
    useHabitsStore.getState().setHabitDayView(true)
    useHabitsStore.getState().updateCompletion("g1", today, { value: 2, goal: 5 })
    render(<WeeklyTaskTracker currentDate={today} />)
    const lampRow = document.querySelector('[data-habit-id="l1"]') as HTMLElement
    expect(within(lampRow).queryByText(/\d \/ 1/)).toBeNull()
    expect(lampRow.querySelector(".hab-phone-detail")).toBeNull()
    const goalRow = document.querySelector('[data-habit-id="g1"]') as HTMLElement
    expect(within(goalRow).getByText("2 / 5")).toBeInTheDocument()
    expect(goalRow.querySelector(".habit-detail-source")).toBeNull()
    expect(screen.queryByText("By hand")).toBeNull()
    expect(useHabitsStore.getState().weeklyData[key]?.g1?.value).toBe(2)
  })

  it("steps one day with the chevrons and hides Today on today", async () => {
    const today = new Date()
    useHabitsStore.getState().setTasks([lamp])
    const user = userEvent.setup()
    render(<WeeklyTaskTracker currentDate={today} />)
    const list = () => screen.getByTestId("habits-phone-list")
    expect(list().getAttribute("data-period")).toBe(formatLocalDateKey(today))
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull()

    await user.click(screen.getByRole("button", { name: "Previous day" }))
    await waitFor(() => {
      expect(list().getAttribute("data-period")).toBe(formatLocalDateKey(addCalendarDays(today, -1)))
    })
    await user.click(screen.getByRole("button", { name: "Today" }))
    await waitFor(() => {
      expect(list().getAttribute("data-period")).toBe(formatLocalDateKey(today))
    })
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull()

    await user.click(screen.getByRole("button", { name: "Next day" }))
    await waitFor(() => {
      expect(list().getAttribute("data-period")).toBe(formatLocalDateKey(addCalendarDays(today, 1)))
    })
  })

  it("opens no popup for a lamp square and a value plus history for a goal square", async () => {
    const today = new Date()
    useHabitsStore.getState().setTasks([lamp, { ...goal, shorthandName: "gym" }])
    useHabitsStore.getState().updateCompletion("g1", today, { value: 2, goal: 5 })
    const user = userEvent.setup()
    render(<WeeklyTaskTracker currentDate={today} />)
    await user.click(screen.getByRole("button", { name: "Week" }))
    const grid = screen.getByRole("grid", { name: "Daily grid" })
    expect(within(grid).getByText("gym")).toBeInTheDocument()
    expect(within(grid).getAllByRole("columnheader")).toHaveLength(7)

    const lampCells = grid.querySelectorAll('[data-habit-id="l1"] [role="gridcell"]')
    expect(lampCells).toHaveLength(7)
    expect(grid.querySelector('[data-habit-id="l1"] button')).toBeNull()
    await user.click(lampCells[0] as HTMLElement)
    expect(screen.queryByRole("dialog")).toBeNull()

    const todayCell = within(grid).getByRole("button", { name: /^gym · .* · 40%$/ })
    expect((todayCell as HTMLElement).style.getPropertyValue("--wk-lit")).toBe("0.4")
    await user.click(todayCell)
    const sheet = screen.getByRole("dialog", { name: /Exercise/ })
    expect(within(sheet).getByRole("textbox", { name: /Exercise .* value/ })).toHaveValue("2")
    expect(within(sheet).getByText("No history yet")).toBeInTheDocument()
    await user.click(within(sheet).getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})

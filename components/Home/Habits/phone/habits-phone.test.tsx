/** components/Home/Habits/phone/habits-phone.test.tsx */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { TaskType } from "@/lib/types"
import { formatLocalDateKey } from "@/lib/date-utils"
import { WeeklyTaskTracker } from "../habit-tracker"
import { stepPeriodIndex } from "./habits-phone"

const originalMatchMedia = window.matchMedia

function setPhoneMedia(phone: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: phone && query === "(max-width: 767px)",
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

describe("Habits phone", () => {
  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    })
  })

  it("steps within the window and marks the edge", () => {
    expect(stepPeriodIndex(2, 7, 1)).toEqual({ index: 3, edge: false })
    expect(stepPeriodIndex(0, 7, -1)).toEqual({ index: 6, edge: true })
    expect(stepPeriodIndex(6, 7, 1)).toEqual({ index: 0, edge: true })
    expect(stepPeriodIndex(0, 1, 1)).toEqual({ index: 0, edge: true })
  })

  it("keeps the desktop console when the viewport is wide", () => {
    setPhoneMedia(false)
    resetAllStores()
    useHabitsStore.getState().setTasks([
      { id: "d1", name: "Daily habit", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" },
    ])
    render(<WeeklyTaskTracker currentDate={new Date(2026, 5, 20, 12)} />)
    expect(screen.queryByTestId("habits-phone")).not.toBeInTheDocument()
    expect(document.querySelector(".hab-frame")).toBeTruthy()
    expect(document.querySelector(".hab-desk")).toBeTruthy()
    expect(screen.getByRole("tab", { name: /Daily/ })).toBeInTheDocument()
  })

  it("mounts the phone page under 767px and keeps the habit writes", async () => {
    setPhoneMedia(true)
    resetAllStores()
    useHabitsStore.getState().setTasks([
      { id: "d1", name: "Daily habit", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" },
      { id: "w1", name: "Weekly habit", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "weekly" },
    ])
    const user = userEvent.setup()
    const day = new Date(2026, 5, 20, 12)
    render(<WeeklyTaskTracker currentDate={day} />)

    expect(screen.getByTestId("habits-phone")).toBeInTheDocument()
    expect(document.querySelector(".hab-frame")).toBeNull()
    expect(document.querySelector(".hab-desk")).toBeNull()
    expect(screen.getByRole("tab", { name: /Daily \(1\)/ })).toHaveAttribute("aria-selected", "true")
    const settings = screen.getByRole("button", { name: "Settings" })
    expect(settings).toHaveClass("hab-phone-gear")
    expect(settings.querySelector("img")).toHaveAttribute("src", "/ui/settings-gear.png")
    expect(screen.getByRole("button", { name: "New habit" })).toHaveClass("hab-phone-key")
    expect(screen.getByRole("tab", { name: /Daily \(1\)/ })).toHaveClass("hab-phone-key")
    expect(screen.getByRole("button", { name: "Previous Week" })).toBeInTheDocument()
    expect(screen.getByText("Daily habit")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Daily habit span" })).not.toBeInTheDocument()
    expect(screen.getByTestId("habits-phone-day-tube")).toBeInTheDocument()
    expect(screen.getByText("Week grade")).toBeInTheDocument()
    expect(screen.getByText("Perfect output")).toBeInTheDocument()

    await user.click(screen.getByRole("checkbox", { name: /Daily habit/ }))
    const key = formatLocalDateKey(day)
    await waitFor(() => {
      expect(useHabitsStore.getState().weeklyData[key]?.d1?.completed).toBe(true)
    })

    const list = screen.getByTestId("habits-phone-list")
    expect(list.getAttribute("data-period")).toBe(key)
    fireEvent.pointerDown(list, { pointerId: 1, clientX: 220, clientY: 30 })
    fireEvent.pointerMove(list, { pointerId: 1, clientX: 40, clientY: 32 })
    fireEvent.pointerUp(list, { pointerId: 1, clientX: 40, clientY: 34 })
    await waitFor(() => {
      expect(screen.getByTestId("habits-phone-list").getAttribute("data-period")).toBe(formatLocalDateKey(new Date(2026, 5, 21)))
    })

    await user.click(screen.getByRole("button", { name: "Tools" }))
    expect(screen.getByRole("dialog", { name: "Habits tools" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Exemption wand" })).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Willpower gems" }))
    expect(document.querySelector(".hab-phone-sheet.is-gems .hab-willpower-gems")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Close tools" }))
    await user.click(screen.getByRole("button", { name: "Week" }))
    expect(document.querySelector(".habit-grid")).toBeTruthy()
    expect(screen.queryByTestId("habits-phone-list")).not.toBeInTheDocument()
    expect(screen.queryByTestId("habits-phone-day-tube")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Tools" }))
    await user.click(screen.getByRole("tab", { name: "Controls" }))
    await user.click(screen.getByRole("switch", { name: "Heatmap View" }))
    await user.click(screen.getByRole("button", { name: "Close tools" }))
    expect(document.querySelector(".habit-heat")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Daily habit week" })).toBeInTheDocument()
    expect(screen.queryByTestId("habits-phone-day-tube")).not.toBeInTheDocument()
  })

  it("opens a note sheet for a text habit and writes the same cell", async () => {
    setPhoneMedia(true)
    resetAllStores()
    useHabitsStore.getState().setTasks([
      { id: "t1", name: "Note habit", type: TaskType.TEXT, rewardValue: 10, frequency: "daily" },
    ])
    const user = userEvent.setup()
    const day = new Date(2026, 5, 20, 12)
    render(<WeeklyTaskTracker currentDate={day} />)
    await user.click(screen.getByRole("button", { name: /Edit Note habit/ }))
    const box = screen.getByRole("textbox", { name: /Note habit/ })
    await user.type(box, "hi")
    await waitFor(() => {
      expect(useHabitsStore.getState().weeklyData[formatLocalDateKey(day)]?.t1?.text).toBe("hi")
    })
    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})

import { fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "@/lib/operation-types"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetTrackingViewPrefs } from "./tracking-view-prefs"
import { TrackingDesk } from "./tracking-desk"

const today = new Date(2026, 5, 20, 12, 0, 0)
const yesterday = new Date(2026, 5, 19, 12, 0, 0)
const stepped = new Date(2026, 5, 18, 12, 0, 0)
const todayKey = formatLocalDateKey(today)
const yesterdayKey = formatLocalDateKey(yesterday)
const steppedKey = formatLocalDateKey(stepped)

function renderDesk(currentDate: Date) {
  return render(<TrackingDesk currentDate={currentDate} setCurrentDate={() => {}} />)
}

describe("TrackingDesk", () => {
  beforeEach(() => {
    resetAllStores()
    resetTrackingViewPrefs()
    vi.useFakeTimers()
    vi.setSystemTime(today)
    useTimeTrackingStore.getState().setSelectedPen("act-work")
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("logs the rail dialog onto the desk day after the cursor moves", () => {
    const { rerender } = renderDesk(today)
    rerender(<TrackingDesk currentDate={yesterday} setCurrentDate={() => {}} />)

    fireEvent.click(screen.getByRole("button", { name: "Log activity" }))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).queryByLabelText("Start date")).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Date" })[0])
    expect(within(dialog).getByLabelText("Start date")).toHaveValue(yesterdayKey)
    fireEvent.click(within(dialog).getByRole("button", { name: "Log block" }))

    const entries = useTimeTrackingStore.getState().entries
    expect(entries).toEqual(expect.arrayContaining([expect.objectContaining({ date: yesterdayKey })]))
    expect(entries.some((entry) => entry.date === todayKey)).toBe(false)

    fireEvent.click(screen.getByRole("tab", { name: "Day Log" }))
    rerender(<TrackingDesk currentDate={stepped} setCurrentDate={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }))
    const again = screen.getByRole("dialog")
    fireEvent.click(within(again).getAllByRole("button", { name: "Date" })[0])
    expect(within(again).getByLabelText("Start date")).toHaveValue(steppedKey)
    fireEvent.click(within(again).getByRole("button", { name: "Log block" }))
    expect(useTimeTrackingStore.getState().entries).toEqual(
      expect.arrayContaining([expect.objectContaining({ date: steppedKey })]),
    )

    fireEvent.click(screen.getByRole("tab", { name: "Activity Log" }))
    expect(screen.getAllByRole("button", { name: "Log activity" })).toHaveLength(1)
  })

  it("keeps four view keys together and hides the pen desk on Tracking log", () => {
    useTaskStore.getState().addTask({
      id: "op-clean",
      description: "clean house",
      type: OPERATION_TYPE_ID,
      stage: "clarified",
      createdAt: today,
      completed: false,
      lists: [],
      attributes: { [OPERATION_ATTR.stage]: "active" },
      links: [],
    })
    renderDesk(today)
    const keys = document.querySelector(".trk-view-keys")
    expect(keys).toBeTruthy()
    const tabs = within(keys as HTMLElement).getAllByRole("tab")
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Time Grid",
      "Activity Log",
      "Day Log",
      "Tracking log",
    ])

    expect(document.querySelector("[data-ui-name='Tracking control panel']")).toBeTruthy()
    expect(screen.getByLabelText("Search pen colors")).toBeInTheDocument()
    expect(screen.getByLabelText("Search pens")).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Sort pens" })).toBeInTheDocument()
    expect(screen.getByRole("toolbar", { name: "Tracking view modes" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Paint tools" })).toBeInTheDocument()
    expect(screen.getByText("Day summary")).toBeInTheDocument()
    expect(screen.getByLabelText("Operation to work on")).toBeInTheDocument()

    const logTab = within(keys as HTMLElement).getByRole("tab", { name: "Tracking log" })
    fireEvent.mouseDown(logTab, { button: 0, ctrlKey: false })
    expect(logTab).toHaveAttribute("aria-selected", "true")
    expect(screen.getByTestId("tracking-log-view")).toBeInTheDocument()
    expect(document.querySelector("[data-ui-name='Tracking control panel']")).toBeNull()
    expect(screen.queryByLabelText("Search pen colors")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Search pens")).not.toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Sort pens" })).not.toBeInTheDocument()
    expect(screen.queryByRole("toolbar", { name: "Tracking view modes" })).not.toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Paint tools" })).not.toBeInTheDocument()
    expect(screen.getByText("Day summary")).toBeInTheDocument()
    expect(screen.getByLabelText("Operation to work on")).toBeInTheDocument()
    expect(within(keys as HTMLElement).getByRole("tab", { name: "Time Grid" })).toBeInTheDocument()

    fireEvent.mouseDown(within(keys as HTMLElement).getByRole("tab", { name: "Activity Log" }), {
      button: 0,
      ctrlKey: false,
    })
    expect(document.querySelector("[data-ui-name='Tracking control panel']")).toBeTruthy()
    expect(screen.getByLabelText("Search pens")).toBeInTheDocument()

    fireEvent.mouseDown(within(keys as HTMLElement).getByRole("tab", { name: "Day Log" }), {
      button: 0,
      ctrlKey: false,
    })
    expect(document.querySelector("[data-ui-name='Tracking control panel']")).toBeTruthy()
    expect(screen.getByLabelText("Search pen colors")).toBeInTheDocument()

    fireEvent.mouseDown(within(keys as HTMLElement).getByRole("tab", { name: "Time Grid" }), {
      button: 0,
      ctrlKey: false,
    })
    expect(document.querySelector("[data-ui-name='Tracking control panel']")).toBeTruthy()
    expect(screen.getByRole("toolbar", { name: "Tracking view modes" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Paint tools" })).toBeInTheDocument()
  })

  it("opens Tracking settings from the gear beside the view keys", () => {
    renderDesk(today)
    const keys = document.querySelector(".trk-view-keys") as HTMLElement
    const gear = screen.getByRole("button", { name: "Tracking settings" })
    expect(keys.nextElementSibling).toBe(gear)
    expect(keys.contains(gear)).toBe(false)
    expect(within(keys).queryByRole("button", { name: "Tracking settings" })).not.toBeInTheDocument()

    fireEvent.click(gear)
    const dialog = screen.getByRole("dialog")
    const notes = within(dialog).getByTestId("tracking-command-notes").textContent ?? ""
    expect(notes).toMatch(/went outside/)
    expect(notes).toMatch(/ralphs/)
    expect(notes).toMatch(/cleaning/)
    expect(notes).toMatch(/1:00 p\.m\./)
    expect(notes).toMatch(/July 4, 2026/)
    expect(notes).toMatch(/log keywords/)
    expect(notes).toMatch(/log categories/)
    expect(notes).toMatch(/intake food/)
    expect(notes).toMatch(/thought process/)
    expect(notes).toMatch(/tp:/)
    expect(within(dialog).getByLabelText("New log keyword")).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))

    const logTab = within(keys).getByRole("tab", { name: "Tracking log" })
    fireEvent.mouseDown(logTab, { button: 0, ctrlKey: false })
    const gearAgain = screen.getByRole("button", { name: "Tracking settings" })
    expect(keys.nextElementSibling).toBe(gearAgain)
    expect(screen.queryByTestId("log-keywords")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("New log keyword")).not.toBeInTheDocument()
    fireEvent.click(gearAgain)
    expect(within(screen.getByRole("dialog")).getByLabelText("New log keyword")).toBeInTheDocument()
  })
})

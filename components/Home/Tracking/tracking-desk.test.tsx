import { fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
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
})

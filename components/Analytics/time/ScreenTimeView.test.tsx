/**
 * components/Analytics/ScreenTimeView.test.tsx
 */
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { ScreenTimeView } from "./ScreenTimeView"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useAnalyticsRangeStore } from "./analytics-range-store"

vi.mock("@/lib/screentime/prefs", () => ({
  loadScreenTimePrefs: () => ({
    url: "http://127.0.0.1:5600",
    lookbackDays: 14,
    minDurationSec: 15,
    storeWindowTitles: false,
    lastSuccessAt: "2026-09-21T12:00:00.000Z",
  }),
}))

beforeEach(() => {
  resetAllStores()
  useAnalyticsRangeStore.setState({ days: 30, hydrated: true })
})

describe("ScreenTimeView", () => {
  it("keeps an empty sentence when Screen Time is unpainted", () => {
    useTimeTrackingStore.setState({
      scopes: [
        ...useTimeTrackingStore.getState().scopes,
        { id: "screentime", name: "Screen Time", pens: [{ id: "st-app", name: "Safari", color: "#f59e0b" }] },
      ],
    })
    render(<ScreenTimeView />)
    expect(screen.getByTestId("screentime-view")).toBeInTheDocument()
    expect(screen.getByText(/Nothing painted in Screen Time/)).toBeInTheDocument()
  })

  it("reports active minutes and last sync after paint", () => {
    useTimeTrackingStore.setState({
      scopes: [
        ...useTimeTrackingStore.getState().scopes.filter((s) => s.id !== "screentime"),
        { id: "screentime", name: "Screen Time", pens: [{ id: "st-app", name: "Safari", color: "#f59e0b" }] },
      ],
    })
    const day = formatLocalDateKey(new Date())
    useTimeTrackingStore.getState().paintMinutes(day, "screentime", 540, 600, "st-app")
    render(<ScreenTimeView />)
    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(screen.getByText("Untracked")).toBeInTheDocument()
  })
})

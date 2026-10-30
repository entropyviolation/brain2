/**
 * components/Home/Tracking/phone/tracking-phone.test.tsx
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TrackingDesk } from "../tracking-desk"
import { TRACKING_PHONE_QUERY } from "./use-tracking-phone"

const day = new Date(2026, 5, 20, 12, 0, 0)
const originalMatchMedia = window.matchMedia

function setViewport(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query === TRACKING_PHONE_QUERY,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

describe("Tracking phone gate", () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia
    resetAllStores()
  })

  it("keeps the desk at a wide viewport", () => {
    setViewport(false)
    render(<TrackingDesk currentDate={day} setCurrentDate={() => {}} />)
    expect(document.querySelector("[data-tracking-layout='phone']")).toBeNull()
    expect(document.querySelector(".trk-desk")).toBeTruthy()
    expect(document.querySelector(".trk-fascia")).toBeTruthy()
  })

  it("mounts the phone tree under 768px and keeps the four views", () => {
    setViewport(true)
    const setCurrentDate = vi.fn()
    render(<TrackingDesk currentDate={day} setCurrentDate={setCurrentDate} />)
    expect(document.querySelector(".trk-desk")).toBeNull()
    expect(document.querySelector("[data-tracking-layout='phone']")).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Time Grid" })).toHaveAttribute("data-state", "active")
    expect(screen.getByRole("tab", { name: "Activity Log" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Day Log" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Tracking log" })).toBeTruthy()
    expect(screen.getByTestId("phone-day-plot")).toBeTruthy()
    expect(document.querySelector(".trk-phone-cells .trk-cell")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Today" })).toHaveClass("trk-phone-key")
    expect(screen.getByRole("button", { name: "Draw" })).toHaveClass("trk-phone-key")

    fireEvent.click(screen.getByRole("button", { name: "Next day" }))
    expect(setCurrentDate).toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Week" }))
    expect(document.querySelector(".trk-week-plot")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Tracking settings" }))
    expect(screen.getByRole("dialog", { name: "Tracking settings" })).toBeTruthy()
  })

  it("opens pen search from Draw when Draw is already selected, and can make a pen", () => {
    setViewport(true)
    useTimeTrackingStore.getState().setSelectedPen("ERASE")
    render(<TrackingDesk currentDate={day} setCurrentDate={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "Draw" }))
    expect(screen.queryByRole("dialog", { name: "Pens" })).toBeNull()
    expect(useTimeTrackingStore.getState().selectedPenId).not.toBe("ERASE")

    fireEvent.click(screen.getByRole("button", { name: "Draw" }))
    expect(screen.getByRole("dialog", { name: "Pens" })).toBeTruthy()
    expect(screen.getByLabelText("Search pens")).toBeTruthy()
    fireEvent.change(screen.getByLabelText("New pen name"), { target: { value: "Field notes" } })
    fireEvent.click(screen.getByRole("button", { name: "+ New pen" }))
    const scopeId = useTimeTrackingStore.getState().activeScopeId
    const scope = useTimeTrackingStore.getState().scopes.find((item) => item.id === scopeId)
    expect(scope?.pens.some((pen) => pen.name === "Field notes")).toBe(true)
    expect(useTimeTrackingStore.getState().selectedPenId).toBeTruthy()
    expect(screen.getByRole("dialog", { name: "Pens" })).toBeTruthy()
  })

  it("paints a minute cell the way the desk grid does", () => {
    setViewport(true)
    useTimeTrackingStore.getState().setSelectedPen("act-work")
    render(<TrackingDesk currentDate={day} setCurrentDate={() => {}} />)
    const cell = document.querySelector('[data-minute="600"]') as HTMLElement
    expect(cell?.className).toContain("trk-cell")
    fireEvent.mouseDown(cell)
    fireEvent.mouseUp(window)
    expect(useTimeTrackingStore.getState().entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: "2026-06-20", startMin: 600, penId: "act-work" }),
      ]),
    )
  })
})

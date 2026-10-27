import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { TrackingDesk } from "./tracking-desk"
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

    fireEvent.click(screen.getByRole("button", { name: "Next day" }))
    expect(setCurrentDate).toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Week" }))
    expect(document.querySelector(".trk-week-plot")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Tracking settings" }))
    expect(screen.getByRole("dialog", { name: "Tracking settings" })).toBeTruthy()
  })
})

import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TimeGrid } from "./time-grid"
import { PenModeDeck } from "./pen-mode-bar"
import { getTrackingViewPrefs, resetTrackingViewPrefs } from "./tracking-view-prefs"

const WEDNESDAY = new Date(2026, 8, 16, 12, 0, 0)

function renderDesk() {
  return render(<TimeGrid showPalette={false} desk deck={<PenModeDeck ghostLeds />} currentDate={WEDNESDAY} setCurrentDate={() => {}} />)
}

const instruments = () => document.querySelector(".trk-instruments") as HTMLElement
const screenBay = () => document.querySelector(".trk-center-bay") as HTMLElement

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(WEDNESDAY)
  resetAllStores()
  localStorage.clear()
  resetTrackingViewPrefs()
  useTimeTrackingStore.getState().setActiveScope("activity")
  useTimeTrackingStore.getState().setSelectedPen("act-work")
})

afterEach(() => {
  vi.useRealTimers()
})

describe("Time Grid desk", () => {
  it("turns TIME / DIV between day, week, and infinite from the knob's printed marks", () => {
    renderDesk()
    const panel = instruments()
    expect(within(panel).getByRole("button", { name: "day" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(within(panel).getByRole("button", { name: "week" }))
    expect(useTimeTrackingStore.getState().gridSpan).toBe("week")
    expect(within(panel).getByRole("slider", { name: "Time grid span" })).toHaveAttribute("aria-valuetext", "WEEK")
    fireEvent.click(within(panel).getByRole("button", { name: "Infinite scroll" }))
    expect(useTimeTrackingStore.getState().infiniteScroll).toBe(true)
    fireEvent.click(within(panel).getByRole("button", { name: "day" }))
    expect(useTimeTrackingStore.getState().infiniteScroll).toBe(false)
    expect(useTimeTrackingStore.getState().gridSpan).toBe("day")
  })

  it("steps the CELL knob with the arrow keys, and swaps it for the week steps in Week", () => {
    useTimeTrackingStore.getState().setGridStep(5)
    renderDesk()
    const cell = within(instruments()).getByRole("slider", { name: "Cell size" })
    expect(cell).toHaveAttribute("aria-valuenow", "5")
    fireEvent.keyDown(cell, { key: "ArrowRight" })
    expect(useTimeTrackingStore.getState().gridStep).toBe(10)

    fireEvent.click(within(instruments()).getByRole("button", { name: "week" }))
    const week = within(instruments()).getByRole("slider", { name: "Week cell size" })
    expect(week).toHaveAttribute("aria-valuenow", "30")
    fireEvent.keyDown(week, { key: "ArrowLeft" })
    expect(useTimeTrackingStore.getState().weekStep).toBe(15)
    expect(useTimeTrackingStore.getState().gridStep).toBe(10)
  })

  it("interlocks the tool push-keys and arms Fill in the tool well", () => {
    renderDesk()
    const tools = within(instruments()).getByRole("group", { name: "Paint tools" })
    expect(within(tools).getByRole("button", { name: "Draw" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(within(tools).getByRole("button", { name: "Erase" }))
    expect(within(tools).getByRole("button", { name: "Erase" })).toHaveAttribute("aria-pressed", "true")
    expect(within(tools).getByRole("button", { name: "Draw" })).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(within(tools).getByRole("button", { name: "Draw" }))
    expect(useTimeTrackingStore.getState().selectedPenId).toBe("act-work")

    // Day: the Fill fields live in the instrument well, not on the screen.
    expect(screenBay().querySelector(".trk-fill-range")).toBeNull()
    fireEvent.click(within(tools).getByRole("button", { name: "Fill" }))
    expect(within(tools).getByRole("button", { name: "Fill" })).toHaveAttribute("aria-pressed", "true")
    expect(within(tools).getByRole("button", { name: "Draw" })).toHaveAttribute("aria-pressed", "false")
    const well = instruments().querySelector(".trk-instrument-detail") as HTMLElement
    expect(well).toHaveTextContent(/Fill with Work/)
    expect(within(well).getAllByRole("button", { name: /^Fill/ }).length).toBeGreaterThan(0)
  })

  it("puts the week's Fill row into the instrument well when Fill is armed", () => {
    useTimeTrackingStore.setState({ gridSpan: "week" })
    renderDesk()
    expect(document.querySelector(".trk-fill-row")).toBeNull()
    fireEvent.click(within(instruments()).getByRole("button", { name: "Fill" }))
    const well = instruments().querySelector(".trk-instrument-detail") as HTMLElement
    const row = well.querySelector(".trk-fill-row") as HTMLElement
    expect(row).toBeTruthy()
    expect(screenBay().contains(row)).toBe(false)

    fireEvent.click(within(row).getByRole("button", { name: "Mon–Fri" }))
    fireEvent.change(within(row).getByLabelText("From"), { target: { value: "09:00" } })
    fireEvent.change(within(row).getByLabelText("To"), { target: { value: "10:00" } })
    fireEvent.click(within(row).getByRole("button", { name: /^Fill 5 days with Work$/ }))
    const painted = useTimeTrackingStore.getState().entries.filter((e) => e.penId === "act-work" && e.startMin === 540)
    expect(painted).toHaveLength(5)
  })

  it("shows the week on glass with a meter per day and CRT readouts, and flips to paper per time base", () => {
    useTimeTrackingStore.getState().paintMinutes("2026-09-14", "activity", 0, 720, "act-work")
    useTimeTrackingStore.setState({ gridSpan: "week" })
    renderDesk()
    const bezel = screenBay().querySelector(".trk-screen-bezel") as HTMLElement
    expect(bezel).toHaveAttribute("data-face", "glass")
    const meters = screen.getAllByRole("meter")
    expect(meters).toHaveLength(7)
    expect(meters[0]).toHaveAttribute("aria-valuenow", "50")
    expect(screenBay()).toHaveTextContent("Of week")
    expect(screenBay()).toHaveTextContent("1/7")
    // The repeated day-totals row under the screen is gone.
    expect(screenBay().querySelector(".trk-week-plot ~ .trk-ribbon-legend")).toBeNull()

    const face = within(instruments()).getByRole("radiogroup", { name: "SCREEN" })
    fireEvent.click(within(face).getByRole("radio", { name: "PAPER" }))
    expect(screenBay().querySelector(".trk-screen-bezel")).toHaveAttribute("data-face", "paper")
    expect(getTrackingViewPrefs().screenFace).toEqual({ day: "paper", week: "paper", infinite: "glass" })

    // Day keeps its own face (paper by default).
    fireEvent.click(within(instruments()).getByRole("button", { name: "day" }))
    expect(screenBay().querySelector(".trk-screen-bezel")).toHaveAttribute("data-face", "paper")
  })

  it("lights ghost LEDs under other view keys and clears them from GHOST", () => {
    renderDesk()
    const deck = screen.getByRole("toolbar", { name: "Tracking view modes" })
    fireEvent.click(within(deck).getByRole("button", { name: "Ghost Location" }))
    fireEvent.click(within(deck).getByRole("button", { name: "Ghost Mood" }))
    expect(getTrackingViewPrefs().superimposeMultiByScope).toEqual({ activity: ["location", "mood"] })
    expect(within(deck).getByRole("button", { name: "Ghost Location" })).toHaveAttribute("aria-pressed", "true")
    expect(document.querySelector(".trk-grid")).toHaveAttribute("data-superimpose", "location mood")
    fireEvent.click(within(deck).getByRole("button", { name: "Clear ghosts" }))
    expect(getTrackingViewPrefs().superimposeMultiByScope).toEqual({})
    expect(within(deck).getByRole("button", { name: "Ghost Activity" })).toBeDisabled()
  })

  it("latches the flag push-keys independently", () => {
    renderDesk()
    const flags = within(instruments()).getByRole("group", { name: "Flags" })
    expect(within(flags).getByRole("button", { name: "Multi" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(within(flags).getByRole("button", { name: "Hide log flags" }))
    fireEvent.click(within(flags).getByRole("button", { name: "Hide sun lines" }))
    expect(getTrackingViewPrefs()).toMatchObject({ hideLogFlags: true, hideSunLines: true, superimposeMulti: true })
    fireEvent.click(within(flags).getByRole("button", { name: "Advanced" }))
    expect(getTrackingViewPrefs().superimposeAdvanced).toBe(true)
    fireEvent.click(within(flags).getByRole("button", { name: "Multi" }))
    expect(getTrackingViewPrefs().superimposeMulti).toBe(false)
  })

  it("lets a screw be backed out, and a plate on one screw come off without disturbing the controls", () => {
    renderDesk()
    const panel = instruments()
    const screw = (corner: string) => panel.querySelector(`.trk-screw[data-corner="${corner}"]`) as HTMLElement
    for (let i = 0; i < 4; i++) fireEvent.click(screw("bl"))
    expect(screw("bl")).toHaveClass("is-loose")
    fireEvent.click(screw("bl"))
    expect(screw("bl")).toBeNull()
    expect(panel).not.toHaveClass("is-bare")
    for (let i = 0; i < 5; i++) fireEvent.click(screw("br"))
    for (let i = 0; i < 5; i++) act(() => fireEvent.click(screw("tl")))
    expect(panel).toHaveClass("is-bare")
    expect(panel.querySelector(".trk-faceplate")).toBeNull()
    // Every control still works on the bare chassis.
    fireEvent.click(within(panel).getByRole("button", { name: "Erase" }))
    expect(within(panel).getByRole("button", { name: "Erase" })).toHaveAttribute("aria-pressed", "true")
  })
})

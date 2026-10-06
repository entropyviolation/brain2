import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import {
  getTrackingViewPrefs,
  resetTrackingViewPrefs,
  TRACKING_FILL_CLOCK_LABELS,
} from "./tracking-view-prefs"
import { TrackingViewSettingsDialog } from "./tracking-view-settings-dialog"

beforeEach(() => {
  resetAllStores()
  resetTrackingViewPrefs()
})

describe("TrackingViewSettingsDialog pen well", () => {
  it("does not offer a pen-tray photograph", () => {
    render(<TrackingViewSettingsDialog scopeId="activity" onClose={() => {}} />)
    expect(screen.queryByRole("radiogroup", { name: "Pen tray photograph" })).not.toBeInTheDocument()
    expect(screen.queryByRole("radio", { name: "Cat traces" })).not.toBeInTheDocument()
  })
})

describe("TrackingViewSettingsDialog layout and fill clocks", () => {
  it("scrolls the body so the title and OK stay put", () => {
    render(<TrackingViewSettingsDialog scopeId="activity" onClose={() => {}} />)
    const dialog = document.querySelector(".trk-view-settings") as HTMLElement
    const body = document.querySelector(".trk-dialog-body") as HTMLElement
    const actions = document.querySelector(".trk-dialog-actions") as HTMLElement
    expect(dialog).toBeTruthy()
    expect(body).toBeTruthy()
    expect(actions).toBeTruthy()
    expect(body.contains(actions)).toBe(false)
    expect(dialog.contains(actions)).toBe(true)
    expect(getComputedStyle(dialog).overflow).toBe("hidden")
    expect(getComputedStyle(dialog).maxHeight).toMatch(/90vh|720px/)
    expect(getComputedStyle(body).overflowY).toBe("auto")
  })

  it("labels fill bounds as clock hours and still writes the same pref keys", () => {
    render(<TrackingViewSettingsDialog scopeId="activity" onClose={() => {}} />)
    expect(screen.queryByLabelText("Day from")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Week from")).not.toBeInTheDocument()

    const dayStarts = screen.getByLabelText(TRACKING_FILL_CLOCK_LABELS.fillFrom)
    const dayEnds = screen.getByLabelText(TRACKING_FILL_CLOCK_LABELS.fillTo)
    const weekStarts = screen.getByLabelText(TRACKING_FILL_CLOCK_LABELS.weekFillFrom)
    const weekEnds = screen.getByLabelText(TRACKING_FILL_CLOCK_LABELS.weekFillTo)
    expect(dayStarts).toHaveAttribute("type", "time")
    expect(dayEnds).toHaveAttribute("type", "time")
    expect(weekStarts).toHaveAttribute("type", "time")
    expect(weekEnds).toHaveAttribute("type", "time")
    expect(dayStarts).toHaveValue("09:00")
    expect(dayEnds).toHaveValue("10:00")
    expect(weekStarts).toHaveValue("09:00")
    expect(weekEnds).toHaveValue("17:00")

    fireEvent.change(dayStarts, { target: { value: "08:15" } })
    fireEvent.change(dayEnds, { target: { value: "11:45" } })
    fireEvent.change(weekStarts, { target: { value: "07:00" } })
    fireEvent.change(weekEnds, { target: { value: "18:30" } })
    expect(getTrackingViewPrefs()).toMatchObject({
      fillFrom: "08:15",
      fillTo: "11:45",
      weekFillFrom: "07:00",
      weekFillTo: "18:30",
    })
  })

  it("does not offer a second superimpose control", () => {
    render(<TrackingViewSettingsDialog scopeId="activity" onClose={() => {}} />)
    expect(screen.queryByText("Superimpose")).not.toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Superimposed view" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Off" })).not.toBeInTheDocument()
    expect(getTrackingViewPrefs().superimposeByScope).toEqual({})
  })
})

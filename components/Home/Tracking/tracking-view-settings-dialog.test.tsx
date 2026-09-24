import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { PEN_TRAY_IDS, PEN_TRAY_META } from "./pen-tray-bg"
import {
  getTrackingViewPrefs,
  resetTrackingViewPrefs,
  setTrackingViewPrefs,
  TRACKING_FILL_CLOCK_LABELS,
} from "./tracking-view-prefs"
import { TrackingViewSettingsDialog } from "./tracking-view-settings-dialog"

beforeEach(() => {
  resetAllStores()
  resetTrackingViewPrefs()
})

describe("TrackingViewSettingsDialog pen tray picker", () => {
  it("lists every curated tray and defaults to Cat traces, not velvet", () => {
    render(<TrackingViewSettingsDialog scopeId="activity" onClose={() => {}} />)
    const group = screen.getByRole("radiogroup", { name: "Pen tray photograph" })
    const options = screen.getAllByRole("radio")
    expect(options).toHaveLength(PEN_TRAY_IDS.length)
    expect(PEN_TRAY_IDS).not.toContain("velvet")
    expect(screen.queryByRole("radio", { name: /velvet/i })).not.toBeInTheDocument()
    for (const id of PEN_TRAY_IDS) {
      expect(screen.getByRole("radio", { name: PEN_TRAY_META[id].label })).toBeInTheDocument()
    }
    expect(screen.getByRole("radio", { name: "Cat traces" })).toHaveAttribute("aria-checked", "true")
    expect(group.querySelectorAll("[aria-checked='true']")).toHaveLength(1)
  })

  it("persists a thumbnail pick onto tracking-view-prefs", () => {
    render(<TrackingViewSettingsDialog scopeId="activity" onClose={() => {}} />)
    fireEvent.click(screen.getByRole("radio", { name: "Pewter" }))
    expect(getTrackingViewPrefs().penTray).toBe("pewter")
    expect(screen.getByRole("radio", { name: "Pewter" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("radio", { name: "Cat traces" })).toHaveAttribute("aria-checked", "false")
  })

  it("shows the saved tray as pressed", () => {
    setTrackingViewPrefs({ penTray: "xray" })
    render(<TrackingViewSettingsDialog scopeId="activity" onClose={() => {}} />)
    expect(screen.getByRole("radio", { name: "X-ray" })).toHaveAttribute("aria-checked", "true")
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
})

/**
 * components/Home/Tracking/settings/tracking-view-settings-dialog.test.tsx
 */
import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import {
  getTrackingViewPrefs,
  resetTrackingViewPrefs,
  TRACKING_FILL_CLOCK_LABELS,
} from "../tracking-view-prefs"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { useLogKeywordsStore } from "@/lib/log-keywords-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TrackingSettingsDialog, TrackingViewSettingsDialog } from "./tracking-view-settings-dialog"

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
    render(<TrackingViewSettingsDialog scopeId="activity" initialSection="grid" onClose={() => {}} />)
    expect(screen.queryByLabelText("Day from")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Week from")).not.toBeInTheDocument()

    const dayStarts = screen.getByLabelText(TRACKING_FILL_CLOCK_LABELS.fillFrom)
    const dayEnds = screen.getByLabelText(TRACKING_FILL_CLOCK_LABELS.fillTo)
    const weekStarts = screen.getByLabelText(TRACKING_FILL_CLOCK_LABELS.weekFillFrom)
    const weekEnds = screen.getByLabelText(TRACKING_FILL_CLOCK_LABELS.weekFillTo)
    expect(dayStarts).toHaveAttribute("role", "combobox")
    expect(dayEnds).toHaveAttribute("role", "combobox")
    expect(weekStarts).toHaveAttribute("role", "combobox")
    expect(weekEnds).toHaveAttribute("role", "combobox")
    expect(dayStarts).not.toHaveAttribute("type", "time")
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
    render(<TrackingViewSettingsDialog scopeId="activity" initialSection="grid" onClose={() => {}} />)
    expect(screen.queryByText("Superimpose")).not.toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Superimposed view" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Off" })).not.toBeInTheDocument()
    expect(getTrackingViewPrefs().superimposeByScope).toEqual({})
  })
})

describe("Tracking settings sheet", () => {
  it("is one sheet for the whole tab, with a bay per view", () => {
    render(<TrackingSettingsDialog onClose={() => {}} />)
    expect(screen.getByRole("heading", { name: "Tracking settings" })).toBeInTheDocument()
    expect(screen.queryByText(/View settings ·/)).not.toBeInTheDocument()
    const rail = screen.getByRole("navigation", { name: "Tracking settings sections" })
    for (const name of ["General", "Time Grid", "Activity Log", "Day Log", "Tracking log", "BIM commands"]) {
      expect(within(rail).getByRole("button", { name: new RegExp(name) })).toBeInTheDocument()
    }
    expect(within(rail).getByRole("button", { name: /General/ })).toHaveAttribute("aria-current", "page")
  })

  it("keeps cell size off the sheet", () => {
    render(<TrackingSettingsDialog initialSection="grid" onClose={() => {}} />)
    expect(screen.queryByText("Cell size")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "15m" })).not.toBeInTheDocument()
  })

  it("writes per-view defaults", () => {
    render(<TrackingSettingsDialog initialSection="activity" onClose={() => {}} />)
    fireEvent.click(within(screen.getByRole("group", { name: "Shortest gap listed" })).getByRole("button", { name: "Off" }))
    expect(getTrackingViewPrefs().activityGapMinutes).toBe(0)
    fireEvent.click(screen.getByRole("button", { name: /Tracking log/ }))
    fireEvent.click(within(screen.getByRole("group", { name: "Composer opens on" })).getByRole("button", { name: "Intake" }))
    fireEvent.click(within(screen.getByRole("group", { name: "Week layout" })).getByRole("button", { name: "Shelves" }))
    fireEvent.click(screen.getByLabelText("Show the logged flag"))
    expect(getTrackingViewPrefs()).toMatchObject({ logDefaultMode: "intake", logFlagOnAdd: false, logWeekLayout: "shelves" })
    fireEvent.click(screen.getByRole("button", { name: /Day Log/ }))
    fireEvent.click(within(screen.getByRole("group", { name: "Day Log opens on" })).getByRole("button", { name: "Week" }))
    expect(getTrackingViewPrefs().dayLogSpan).toBe("week")
  })

  it("labels the bot guide and lists the commands a person added", () => {
    useLogKeywordsStore.getState().addKeyword("went outside")
    render(<TrackingSettingsDialog initialSection="bim" onClose={() => {}} />)
    expect(screen.getByText("BIM commands (Telegram bot)")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Log an event" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: /Your commands/ }))
    expect(screen.getByTestId("log-keywords")).toBeInTheDocument()
    expect(screen.getByLabelText("Edit went outside")).toHaveValue("went outside")
    expect(screen.getByRole("region", { name: "Event triggers" })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Shortcut word"), { target: { value: "shop" } })
    fireEvent.change(screen.getByLabelText("Shortcut expands to"), { target: { value: "groc" } })
    fireEvent.click(within(screen.getByRole("region", { name: "Shortcuts" })).getByRole("button", { name: "Add" }))
    expect(useIngestStore.getState().shortcuts.shop).toBe("groc")
  })

  it("opens the pen gallery and finds a pen across views", () => {
    render(<TrackingSettingsDialog onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "Open pen gallery" }))
    expect(screen.getByRole("heading", { name: "Pen gallery" })).toBeInTheDocument()
    const first = useTimeTrackingStore.getState().scopes.find((scope) => scope.pens.length)!.pens[0]!
    fireEvent.change(screen.getByLabelText("Search pens"), { target: { value: first.name } })
    fireEvent.click(screen.getAllByRole("button", { name: new RegExp(first.name) })[0]!)
    fireEvent.change(screen.getByLabelText("Pen name"), { target: { value: `${first.name} renamed` } })
    fireEvent.blur(screen.getByLabelText("Pen name"))
    const renamed = useTimeTrackingStore
      .getState()
      .scopes.flatMap((scope) => scope.pens)
      .find((pen) => pen.id === first.id)
    expect(renamed?.name).toBe(`${first.name} renamed`)
  })
})

import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { SuperimposeBar } from "./superimpose-bar"
import { getTrackingViewPrefs, resetTrackingViewPrefs } from "./tracking-view-prefs"

beforeEach(() => {
  resetAllStores()
  resetTrackingViewPrefs()
})

describe("SuperimposeBar", () => {
  it("edits only the view you are standing on", () => {
    render(<SuperimposeBar />)
    const bar = screen.getByRole("toolbar", { name: "Superimpose" })
    expect(bar).toHaveClass("trk-super-bar")
    expect(within(bar).queryByRole("button", { name: /^Activity$/ })).toBeNull()
    expect(within(bar).getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(within(bar).getByRole("button", { name: /^Location$/ }))
    expect(getTrackingViewPrefs().superimposeByScope).toEqual({ activity: "location" })
    expect(within(bar).getByRole("button", { name: /^Location$/ })).toHaveAttribute("aria-pressed", "true")
    expect(within(bar).getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "false")

    act(() => {
      useTimeTrackingStore.getState().setActiveScope("company")
    })
    expect(within(bar).getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "true")
    expect(within(bar).queryByRole("button", { name: /^Company$/ })).toBeNull()
    expect(getTrackingViewPrefs().superimposeByScope).toEqual({ activity: "location" })

    fireEvent.click(within(bar).getByRole("button", { name: /^Mood$/ }))
    expect(getTrackingViewPrefs().superimposeByScope).toEqual({ activity: "location", company: "mood" })

    act(() => {
      useTimeTrackingStore.getState().setActiveScope("activity")
    })
    expect(within(bar).getByRole("button", { name: /^Location$/ })).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(within(bar).getByRole("button", { name: "Off" }))
    expect(getTrackingViewPrefs().superimposeByScope).toEqual({ company: "mood" })
  })
})

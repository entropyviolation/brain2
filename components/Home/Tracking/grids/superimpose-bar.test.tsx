/**
 * components/Home/Tracking/grids/superimpose-bar.test.tsx
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { SuperimposeBar } from "./superimpose-bar"
import { getTrackingViewPrefs, resetTrackingViewPrefs, setTrackingViewPrefs } from "../tracking-view-prefs"

beforeEach(() => {
  resetAllStores()
  resetTrackingViewPrefs()
})

describe("SuperimposeBar", () => {
  it("edits only the view you are standing on", () => {
    setTrackingViewPrefs({ superimposeMulti: false })
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

  it("toggles log flags under a HIDE label without touching the overlay", () => {
    render(<SuperimposeBar />)
    const hide = screen.getByRole("group", { name: "Hide on the grid" })
    expect(within(hide).getByText("Hide")).toBeInTheDocument()
    const key = within(hide).getByRole("button", { name: "Log flags" })
    expect(key).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(key)
    expect(getTrackingViewPrefs().hideLogFlags).toBe(true)
    expect(key).toHaveAttribute("aria-pressed", "true")
    expect(getTrackingViewPrefs().superimposeByScope).toEqual({})
    fireEvent.click(key)
    expect(getTrackingViewPrefs().hideLogFlags).toBe(false)
  })

  it("toggles sunrise / sunset lines with the sun key", () => {
    render(<SuperimposeBar />)
    const key = screen.getByRole("button", { name: "Sunrise and sunset lines" })
    expect(key).toHaveAttribute("aria-pressed", "false")
    expect(key.querySelector("svg")).toBeTruthy()
    fireEvent.click(key)
    expect(getTrackingViewPrefs().hideSunLines).toBe(true)
    expect(key).toHaveAttribute("aria-pressed", "true")
    expect(getTrackingViewPrefs().hideLogFlags).toBe(false)
  })

  it("multi toggles several ghosts on and off instead of switching", () => {
    setTrackingViewPrefs({ superimposeMulti: false })
    render(<SuperimposeBar />)
    const bar = screen.getByRole("toolbar", { name: "Superimpose" })
    fireEvent.click(within(bar).getByRole("button", { name: /^Location$/ }))
    fireEvent.click(within(bar).getByRole("checkbox", { name: "multi" }))
    expect(getTrackingViewPrefs().superimposeMulti).toBe(true)
    // Seeded from the single ghost.
    expect(getTrackingViewPrefs().superimposeMultiByScope).toEqual({ activity: ["location"] })

    fireEvent.click(within(bar).getByRole("button", { name: /^Mood$/ }))
    expect(getTrackingViewPrefs().superimposeMultiByScope).toEqual({ activity: ["location", "mood"] })
    expect(within(bar).getByRole("button", { name: /^Location$/ })).toHaveAttribute("aria-pressed", "true")
    expect(within(bar).getByRole("button", { name: /^Mood$/ })).toHaveAttribute("aria-pressed", "true")
    expect(within(bar).getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "false")

    fireEvent.click(within(bar).getByRole("button", { name: /^Location$/ }))
    expect(getTrackingViewPrefs().superimposeMultiByScope).toEqual({ activity: ["mood"] })
    expect(within(bar).getByRole("button", { name: /^Location$/ })).toHaveAttribute("aria-pressed", "false")

    fireEvent.click(within(bar).getByRole("button", { name: "Off" }))
    expect(getTrackingViewPrefs().superimposeMultiByScope).toEqual({})

    // Leaving multi returns to the untouched single ghost.
    fireEvent.click(within(bar).getByRole("checkbox", { name: "multi" }))
    expect(getTrackingViewPrefs().superimposeByScope).toEqual({ activity: "location" })
    expect(within(bar).getByRole("button", { name: /^Location$/ })).toHaveAttribute("aria-pressed", "true")
  })

  it("advanced shows one opacity slider per active ghost", () => {
    render(<SuperimposeBar />)
    const bar = screen.getByRole("toolbar", { name: "Superimpose" })
    expect(within(bar).getByRole("checkbox", { name: "multi" })).toBeChecked()
    fireEvent.click(within(bar).getByRole("button", { name: /^Location$/ }))
    fireEvent.click(within(bar).getByRole("button", { name: /^Mood$/ }))
    expect(screen.queryByRole("group", { name: "Ghost opacity" })).toBeNull()

    fireEvent.click(within(bar).getByRole("checkbox", { name: "advanced" }))
    const sliders = within(screen.getByRole("group", { name: "Ghost opacity" })).getAllByRole("slider")
    expect(sliders).toHaveLength(2)
    expect(sliders[0]).toHaveValue("32")
    fireEvent.change(screen.getByRole("slider", { name: "Mood ghost opacity" }), { target: { value: "70" } })
    expect(getTrackingViewPrefs().superimposeOpacity).toEqual({ mood: 0.7 })
  })

  it("puts multi and advanced right after the ghost keys, before the HIDE keys", () => {
    render(<SuperimposeBar />)
    const keys = screen.getByRole("group", { name: "Superimposed view" })
    const multi = screen.getByRole("checkbox", { name: "multi" })
    const advanced = screen.getByRole("checkbox", { name: "advanced" })
    const hide = screen.getByRole("group", { name: "Hide on the grid" })
    expect(keys.compareDocumentPosition(multi) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(multi.compareDocumentPosition(advanced) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(advanced.compareDocumentPosition(hide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

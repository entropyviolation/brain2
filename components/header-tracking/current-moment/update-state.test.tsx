import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { subscribePenSettings } from "@/components/Home/Tracking/open-pen-settings"
import { appendBlockNote } from "@/lib/tracking-presence"
import { UpdateState } from "./update-state"
import type { ScopeStatusLane } from "@/lib/tracking-presence"

function lane(partial: Partial<ScopeStatusLane> & Pick<ScopeStatusLane, "scopeId" | "scopeName" | "name">): ScopeStatusLane {
  return { kind: "last", estimated: false, loggedAt: null, ...partial }
}

describe("UpdateState", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("selects and clears a detail, then stores the switch on Update", async () => {
    const user = userEvent.setup()
    const now = new Date()
    const today = formatLocalDateKey(now)
    const min = now.getHours() * 60 + now.getMinutes()
    const start = Math.max(0, min - 20)
    const living = useTimeTrackingStore.getState().addVariant("location", "loc-home", "Living Room")
    const bedroom = useTimeTrackingStore.getState().addVariant("location", "loc-home", "Bedroom")
    useTimeTrackingStore.getState().paintMinutes(today, "location", start, Math.min(24 * 60, min + 15), "loc-home", [living])

    render(
      <UpdateState
        lane={lane({ scopeId: "location", scopeName: "Location", name: "Home" })}
        today={today}
        nowName="Home"
        onName={() => {}}
      />,
    )

    const room = screen.getByRole("button", { name: "Living Room" })
    const bed = screen.getByRole("button", { name: "Bedroom" })
    expect(room).toHaveAttribute("aria-pressed", "false")
    await user.click(bed)
    expect(bed).toHaveAttribute("aria-pressed", "true")
    expect(room).toHaveAttribute("aria-pressed", "false")
    await user.click(bed)
    expect(bed).toHaveAttribute("aria-pressed", "false")
    await user.click(bed)
    await user.click(screen.getByRole("button", { name: "Update" }))

    const blocks = useTimeTrackingStore
      .getState()
      .entries.filter((entry) => entry.date === today && entry.scopeId === "location")
      .sort((a, b) => a.startMin - b.startMin)
    expect(blocks.some((entry) => entry.penId === "loc-home" && entry.variantIds?.includes(bedroom) && entry.startMin === min)).toBe(true)
    if (start < min) {
      expect(blocks.some((entry) => entry.variantIds?.includes(living) && entry.startMin < min)).toBe(true)
    }
  })

  it("writes a filled note on Add for now and keeps an older note when the field is blank", async () => {
    const user = userEvent.setup()
    const now = new Date()
    const today = formatLocalDateKey(now)
    const min = now.getHours() * 60 + now.getMinutes()
    const start = Math.max(0, min - 25)
    useTimeTrackingStore.getState().paintMinutes(today, "location", start, Math.max(start + 1, min - 4), "loc-home", undefined, undefined, undefined, {
      notes: "sofa",
    })
    render(
      <UpdateState
        lane={lane({ scopeId: "location", scopeName: "Location", name: "Home" })}
        today={today}
        nowName="Home"
        onName={() => {}}
      />,
    )
    const notes = screen.getByRole("textbox", { name: "Notes for this block" })
    await user.click(screen.getByRole("button", { name: "Update" }))
    expect(notes).toHaveValue("")
    if (min >= 5) {
      expect(
        useTimeTrackingStore.getState().entries.some((entry) => entry.scopeId === "location" && entry.notes === "sofa"),
      ).toBe(true)
    }

    await user.type(notes, "kitchen")
    await user.click(screen.getByRole("button", { name: "Add for now" }))
    expect(notes).toHaveValue("")
    const line = appendBlockNote(undefined, "kitchen", now)
    expect(
      useTimeTrackingStore.getState().entries.some((entry) => entry.startMin === min && entry.notes === line),
    ).toBe(true)
    if (min >= 5) {
      expect(useTimeTrackingStore.getState().entries.some((entry) => entry.notes === "sofa")).toBe(true)
    }
  })

  it("collapses the recent sequence and opens a block on double-click", async () => {
    const user = userEvent.setup()
    const now = new Date()
    const today = formatLocalDateKey(now)
    const min = now.getHours() * 60 + now.getMinutes()
    const early = Math.max(0, min - 50)
    useTimeTrackingStore.getState().paintMinutes(today, "mood", early, early + 10, "mood-meh")
    useTimeTrackingStore.getState().paintMinutes(today, "mood", early + 20, early + 30, "mood-good")
    render(
      <UpdateState
        lane={lane({ scopeId: "mood", scopeName: "Mood", name: "Good" })}
        today={today}
        nowName="Good"
        onName={() => {}}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Recent sequence" }))
    const recent = screen.getByRole("list", { name: "Recent values" })
    expect(within(recent).getByText("Meh")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Hide recent" }))
    expect(screen.queryByRole("list", { name: "Recent values" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Show recent" }))
    await user.click(screen.getByRole("button", { name: "Recent sequence" }))
    expect(screen.queryByRole("list", { name: "Recent values" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Recent sequence" }))
    await user.dblClick(screen.getByText("Meh"))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("opens pen settings from the color dot", async () => {
    const user = userEvent.setup()
    const opened: { scopeId: string; penId: string }[] = []
    const stop = subscribePenSettings((target) => opened.push(target))
    render(
      <UpdateState
        lane={lane({ scopeId: "location", scopeName: "Location", name: "Home" })}
        today="2026-10-25"
        nowName="Home"
        onName={() => {}}
      />,
    )
    await user.dblClick(screen.getByLabelText("Pen color for Home"))
    expect(opened).toEqual([{ scopeId: "location", penId: "loc-home" }])
    stop()
  })
})

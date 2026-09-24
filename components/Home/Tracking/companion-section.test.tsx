import { render, screen, fireEvent } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { entriesForDay } from "@/lib/time-entries"
import { EntryDialog } from "./entry-dialog"

const KEY = "2026-09-17"

/** Ian's House, 1–5pm — the BBQ. */
function paintIan(startMin = 780, endMin = 1020) {
  const store = useTimeTrackingStore.getState()
  const penId = store.addPen("location", { name: "Ian's House", color: "#0f0" })
  store.paintMinutes(KEY, "location", startMin, endMin, penId)
  return {
    penId,
    entry: useTimeTrackingStore.getState().entriesFor(KEY, "location")[0],
  }
}

const activityOn = (date = KEY) => entriesForDay(useTimeTrackingStore.getState().entries, date, "activity")
const locationPen = (penId: string) =>
  useTimeTrackingStore.getState().scopes.find((s) => s.id === "location")?.pens.find((p) => p.id === penId)

beforeEach(() => {
  resetAllStores()
})

describe("Also happening", () => {
  it("reports what each other scope says about the window", () => {
    const { entry } = paintIan()
    useTimeTrackingStore.getState().paintMinutes(KEY, "activity", 780, 840, "act-work")

    render(<EntryDialog entry={entry} onClose={() => {}} />)

    expect(screen.getByText("Also happening")).toBeInTheDocument()
    expect(screen.getByText(/3h of 4h still blank/)).toBeInTheDocument()
    expect(screen.getByText(/1h of this block/)).toBeInTheDocument()
    // Mood and Company have nothing at all for these minutes.
    expect(screen.getAllByText("nothing here yet").length).toBeGreaterThanOrEqual(2)
  })

  it("attaches an activity across the block's window in one click", () => {
    const { entry } = paintIan()
    render(<EntryDialog entry={entry} onClose={() => {}} />)

    fireEvent.click(screen.getByRole("button", { name: /Attach activity/ }))
    fireEvent.click(screen.getByRole("button", { name: "Social" }))

    expect(activityOn()).toHaveLength(1)
    expect(activityOn()[0]).toMatchObject({ penId: "act-social", startMin: 780, endMin: 1020 })
  })

  it("fills around time the other scope already has, never over it", () => {
    const { entry } = paintIan()
    useTimeTrackingStore.getState().paintMinutes(KEY, "activity", 780, 840, "act-work")

    render(<EntryDialog entry={entry} onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /Attach activity/ }))
    fireEvent.click(screen.getByRole("button", { name: "Social" }))

    expect(activityOn().map((e) => [e.penId, e.startMin, e.endMin])).toEqual([
      ["act-work", 780, 840],
      ["act-social", 840, 1020],
    ])
  })

  it("annotates the attached block with who was there, without leaving the dialog", () => {
    const { entry } = paintIan()
    useTimeTrackingStore.getState().addVariant("activity", "act-social", "Elijah")

    render(<EntryDialog entry={entry} onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /Attach activity/ }))
    fireEvent.click(screen.getByRole("button", { name: "Social" }))
    fireEvent.click(screen.getByRole("button", { name: "Elijah" }))

    const elijah = useTimeTrackingStore
      .getState()
      .scopes.find((s) => s.id === "activity")
      ?.pens.find((p) => p.id === "act-social")
      ?.variants?.[0]
    expect(activityOn()[0].variantIds).toEqual([elijah?.id])
  })

  it("creates a new name on the spot and attaches it to the party", () => {
    const { entry } = paintIan()
    render(<EntryDialog entry={entry} onClose={() => {}} />)

    fireEvent.click(screen.getByRole("button", { name: /Attach activity/ }))
    fireEvent.click(screen.getByRole("button", { name: "Social" }))

    // "Add option" is the companion row's creator; the Location pen's own is
    // "Add detail", since Ian's House has no variant label.
    fireEvent.click(screen.getByRole("button", { name: "Add option" }))
    fireEvent.change(screen.getByPlaceholderText("Who with?"), { target: { value: "Rebecca" } })
    fireEvent.keyDown(screen.getByPlaceholderText("Who with?"), { key: "Enter" })

    const social = useTimeTrackingStore
      .getState()
      .scopes.find((s) => s.id === "activity")
      ?.pens.find((p) => p.id === "act-social")
    expect(social?.variants?.map((v) => v.name)).toEqual(["Rebecca"])
    expect(activityOn()[0].variantIds).toEqual([social?.variants?.[0].id])
  })

  it("keeps a one-off attachment a one-off — no rule is written", () => {
    const { entry, penId } = paintIan()
    render(<EntryDialog entry={entry} onClose={() => {}} />)

    fireEvent.click(screen.getByRole("button", { name: /Attach activity/ }))
    fireEvent.click(screen.getByRole("button", { name: "Social" }))

    expect(locationPen(penId)?.links).toBeUndefined()
  })

  it("promotes a pairing to a standing rule that fires on later strokes", () => {
    const { entry, penId } = paintIan()
    render(<EntryDialog entry={entry} onClose={() => {}} />)

    fireEvent.click(screen.getByRole("button", { name: /Attach activity/ }))
    fireEvent.click(screen.getByRole("button", { name: "Social" }))
    fireEvent.click(screen.getByRole("button", { name: /Make it always/ }))

    expect(locationPen(penId)?.links).toEqual([{ scopeId: "activity", penId: "act-social", variantIds: undefined }])

    // A later afternoon at Ian's now paints Social by itself.
    useTimeTrackingStore.getState().paintMinutes("2026-09-24", "location", 600, 660, penId)
    expect(activityOn("2026-09-24")).toHaveLength(1)
    expect(activityOn("2026-09-24")[0]).toMatchObject({ penId: "act-social", startMin: 600, endMin: 660 })
  })

  it("drops the rule again when un-pinned", () => {
    const { entry, penId } = paintIan()
    useTimeTrackingStore.getState().setPenLinks("location", penId, [{ scopeId: "activity", penId: "act-social" }])
    useTimeTrackingStore.getState().paintMinutes(KEY, "activity", 780, 1020, "act-social")

    render(<EntryDialog entry={entry} onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /^Always/ }))

    expect(locationPen(penId)?.links).toBeUndefined()
  })

  it("suggests the pen this one is usually painted with", () => {
    const store = useTimeTrackingStore.getState()
    const penId = store.addPen("location", { name: "Ian's House", color: "#0f0" })
    store.paintMinutes("2026-09-10", "location", 780, 1020, penId)
    store.paintMinutes("2026-09-10", "activity", 780, 1020, "act-social")
    store.paintMinutes(KEY, "location", 780, 1020, penId)
    const entry = useTimeTrackingStore.getState().entriesFor(KEY, "location")[0]

    render(<EntryDialog entry={entry} onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /Attach Social — your usual pairing/ }))

    expect(activityOn()[0]).toMatchObject({ penId: "act-social", startMin: 780, endMin: 1020 })
  })

  it("waits for unsaved times to be saved before attaching", () => {
    const { entry } = paintIan()
    render(<EntryDialog entry={entry} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "14:00" } })

    expect(screen.getByText(/Save the new start and end first/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Attach activity/ })).not.toBeInTheDocument()
  })
})

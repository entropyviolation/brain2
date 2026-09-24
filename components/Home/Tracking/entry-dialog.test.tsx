import { render, screen, fireEvent } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { trackedMinutesForTags } from "@/lib/tracked-time"
import { EntryDialog } from "./entry-dialog"

const KEY = "2026-09-17"

function paint(startMin = 540, endMin = 600, penId = "act-work", variantIds?: string[]) {
  useTimeTrackingStore.getState().paintMinutes(KEY, "activity", startMin, endMin, penId, variantIds)
  return useTimeTrackingStore.getState().entriesFor(KEY, "activity")[0]
}

const reload = (id: string) => useTimeTrackingStore.getState().entries.find((e) => e.id === id)

beforeEach(() => {
  resetAllStores()
})

describe("EntryDialog", () => {
  it("shows the block's window, duration and tags", () => {
    render(<EntryDialog entry={paint()} onClose={() => {}} />)
    expect(screen.getByText(/Work · 9:00 AM – 10:00 AM/)).toBeInTheDocument()
    expect(screen.getByText(/1h in Activity/)).toBeInTheDocument()
    expect(screen.getByText(/Work always counts as Work/)).toBeInTheDocument()
  })

  it("retimes a block", () => {
    const entry = paint()
    render(<EntryDialog entry={entry} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "09:30" } })
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "11:15" } })
    fireEvent.click(screen.getByRole("button", { name: "Save block" }))

    expect(reload(entry.id)).toMatchObject({ startMin: 570, endMin: 675 })
  })

  it("treats an end of midnight as the end of the day", () => {
    const entry = paint(1380, 1410)
    render(<EntryDialog entry={entry} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText("End"), { target: { value: "00:00" } })
    fireEvent.click(screen.getByRole("button", { name: "Save block" }))

    expect(reload(entry.id)?.endMin).toBe(1440)
  })

  it("shows only the pens already on the block until add pen color", () => {
    const entry = paint()
    render(<EntryDialog entry={entry} onClose={() => {}} />)

    const onBlock = screen.getByRole("group", { name: "Pens on this block" })
    expect(onBlock).toHaveTextContent("Work")
    expect(screen.queryByRole("button", { name: "Rest" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Chores" })).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Search pens")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("New pen name")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Add a secondary pen")).not.toBeInTheDocument()
  })

  it("reveals the full pen library after add pen color", () => {
    render(<EntryDialog entry={paint()} onClose={() => {}} />)

    fireEvent.click(screen.getByRole("button", { name: "add pen color" }))

    expect(screen.getByLabelText("Search pens")).toBeInTheDocument()
    expect(screen.getByLabelText("New pen name")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Rest" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Chores" })).toBeInTheDocument()
    expect(screen.getByLabelText("Add a secondary pen")).toBeInTheDocument()
  })

  it("switches the pen from the library", () => {
    const entry = paint()
    render(<EntryDialog entry={entry} onClose={() => {}} />)

    fireEvent.click(screen.getByRole("button", { name: "add pen color" }))
    fireEvent.click(screen.getByRole("button", { name: "Rest" }))
    fireEvent.click(screen.getByRole("button", { name: "Save block" }))

    expect(reload(entry.id)?.penId).toBe("act-rest")
  })

  it("shows a secondary already on the block without opening the library", () => {
    const entry = paint()
    useTimeTrackingStore.getState().updateEntry(entry.id, { secondaryPenIds: ["act-chores"] })
    const withAlso = reload(entry.id)!
    render(<EntryDialog entry={withAlso} onClose={() => {}} />)

    const onBlock = screen.getByRole("group", { name: "Pens on this block" })
    expect(onBlock).toHaveTextContent("Work")
    expect(onBlock).toHaveTextContent("Chores")
    expect(screen.queryByLabelText("Search pens")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Rest" })).not.toBeInTheDocument()
  })

  it("ticks two variants on the same block", () => {
    const store = useTimeTrackingStore.getState()
    const elijah = store.addVariant("activity", "act-social", "Elijah")
    const rebecca = store.addVariant("activity", "act-social", "Rebecca")
    const entry = paint(540, 600, "act-social")

    render(<EntryDialog entry={entry} onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "Elijah" }))
    fireEvent.click(screen.getByRole("button", { name: "Rebecca" }))
    fireEvent.click(screen.getByRole("button", { name: "Save block" }))

    expect(reload(entry.id)?.variantIds).toEqual([elijah, rebecca].sort())
  })

  it("saves a secondary pen whose tags still count", () => {
    const entry = paint()
    render(<EntryDialog entry={entry} onClose={() => {}} />)

    fireEvent.click(screen.getByRole("button", { name: "add pen color" }))
    fireEvent.change(screen.getByLabelText("Add a secondary pen"), { target: { value: "chores" } })
    const chores = screen.getAllByRole("button", { name: "Chores" })
    fireEvent.click(chores[chores.length - 1])
    fireEvent.click(screen.getByRole("button", { name: "Save block" }))

    expect(reload(entry.id)?.secondaryPenIds).toEqual(["act-chores"])
    const { scopes, entries } = useTimeTrackingStore.getState()
    expect(trackedMinutesForTags({ scopes, entries }, KEY, ["tag-cleaning"])).toBe(60)
  })

  it("saves notes and activity detail", () => {
    const entry = paint()
    render(<EntryDialog entry={entry} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Shipped tracking" } })
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "went long" } })
    fireEvent.click(screen.getByRole("button", { name: "Save block" }))

    expect(reload(entry.id)).toMatchObject({ title: "Shipped tracking", notes: "went long" })
  })

  it("splits a block in half", () => {
    const entry = paint()
    render(<EntryDialog entry={entry} onClose={() => {}} />)

    fireEvent.click(screen.getByRole("button", { name: "Split block" }))

    expect(
      useTimeTrackingStore.getState().entriesFor(KEY, "activity").map((e) => [e.startMin, e.endMin]),
    ).toEqual([
      [540, 570],
      [570, 600],
    ])
    const halves = useTimeTrackingStore.getState().entriesFor(KEY, "activity")
    expect(halves[0].splitAfter).toBe(true)
  })

  it("splits a block at a typed minute", () => {
    const entry = paint(540, 660)
    render(<EntryDialog entry={entry} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText("Split at"), { target: { value: "10:00" } })
    fireEvent.click(screen.getByRole("button", { name: "Split block" }))
    expect(
      useTimeTrackingStore.getState().entriesFor(KEY, "activity").map((e) => [e.startMin, e.endMin]),
    ).toEqual([
      [540, 600],
      [600, 660],
    ])
  })

  it("labels sleep blocks with fell asleep and woke up", () => {
    const entry = paint(0, 420, "act-sleep")
    useTimeTrackingStore.getState().updateEntry(entry.id, { generatedBy: { kind: "sleep", id: KEY } })
    const sleep = reload(entry.id)!
    render(<EntryDialog entry={sleep} onClose={() => {}} />)
    expect(screen.getByLabelText("Fell asleep")).toBeInTheDocument()
    expect(screen.getByLabelText("Woke up")).toBeInTheDocument()
  })

  it("keeps date pickers optional and defaults them to the block's calendar day", () => {
    render(<EntryDialog entry={paint()} onClose={() => {}} />)
    expect(screen.queryByLabelText("Start date")).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole("button", { name: "Date" })[0])
    expect(screen.getByLabelText("Start date")).toHaveValue(KEY)
  })

  it("deletes a block", () => {
    render(<EntryDialog entry={paint()} onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "Delete block" }))
    expect(useTimeTrackingStore.getState().entriesFor(KEY, "activity")).toHaveLength(0)
  })
})

// Four hours of "San Diego Zoo" logged as a *location*, which were also four
// hours of walking. Both facts have to survive, and the exercise habit has to
// see the minutes even though the Location pen carries no tags.
describe("EntryDialog — tagging one block across scopes", () => {
  function paintZoo() {
    const store = useTimeTrackingStore.getState()
    const penId = store.addPen("location", { name: "San Diego Zoo", color: "#f59e0b" })
    store.paintMinutes(KEY, "location", 600, 840, penId)
    return { entry: useTimeTrackingStore.getState().entriesFor(KEY, "location")[0], penId }
  }

  it("adds Exercise to the block without touching the pen", () => {
    const { entry, penId } = paintZoo()
    render(<EntryDialog entry={entry} onClose={() => {}} />)

    fireEvent.click(screen.getByRole("button", { name: "Tag: Exercise" }))
    fireEvent.click(screen.getByRole("button", { name: "Save block" }))

    const saved = reload(entry.id)
    expect(saved?.tagIds).toEqual(["tag-exercise"])

    const scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === "location")
    expect(scope?.pens.find((p) => p.id === penId)?.tags ?? []).toEqual([])
  })

  it("feeds the cross-scope tag total, so the time counts as exercise", () => {
    const { entry } = paintZoo()
    render(<EntryDialog entry={entry} onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "Tag: Exercise" }))
    fireEvent.click(screen.getByRole("button", { name: "Save block" }))

    const { scopes, entries } = useTimeTrackingStore.getState()
    expect(trackedMinutesForTags({ scopes, entries }, KEY, ["tag-exercise"])).toBe(240)
  })

  it("can promote a block tag to the pen so every zoo visit counts", () => {
    const { entry, penId } = paintZoo()
    render(<EntryDialog entry={entry} onClose={() => {}} />)

    fireEvent.click(screen.getByRole("button", { name: "Tag: Exercise" }))
    fireEvent.click(screen.getByRole("button", { name: /Always tag San Diego Zoo as Exercise/ }))

    const scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === "location")
    expect(scope?.pens.find((p) => p.id === penId)?.tags).toEqual(["tag-exercise"])
  })

  it("creates a brand-new tag from the block editor", () => {
    const { entry } = paintZoo()
    render(<EntryDialog entry={entry} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText("New tag for this block"), { target: { value: "Outdoors" } })
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }))
    fireEvent.click(screen.getByRole("button", { name: "Save block" }))

    const { tags } = useTimeTrackingStore.getState()
    const outdoors = tags.find((t) => t.name === "Outdoors")
    expect(outdoors).toBeDefined()
    expect(reload(entry.id)?.tagIds).toEqual([outdoors!.id])
  })

  it("marks a block as assumed", () => {
    const entry = paint()
    render(<EntryDialog entry={entry} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText("Assumed / reconstructed"))
    fireEvent.click(screen.getByRole("button", { name: "Save block" }))
    expect(reload(entry.id)?.precision).toBe("estimated")
  })
})

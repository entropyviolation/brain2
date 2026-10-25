import { render, screen, fireEvent, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { trackedMinutesForTags } from "@/lib/tracked-time"
import { moodPenColor } from "@/lib/mood-reading"
import { EntryDialog } from "./entry-dialog"
import { peekTimegridReveal, resetTimegridReveal } from "./timegrid-reveal"
import { APP_NAV_KEYS, APP_TABS, readStoredTab } from "@/lib/app-navigation"

const KEY = "2026-09-17"

function paint(startMin = 540, endMin = 600, penId = "act-work", variantIds?: string[]) {
  useTimeTrackingStore.getState().paintMinutes(KEY, "activity", startMin, endMin, penId, variantIds)
  return useTimeTrackingStore.getState().entriesFor(KEY, "activity")[0]
}

function paintMood() {
  useTimeTrackingStore.getState().paintMinutes(KEY, "mood", 540, 600, "mood-meh")
  return useTimeTrackingStore.getState().entriesFor(KEY, "mood")[0]!
}

const reload = (id: string) => useTimeTrackingStore.getState().entries.find((e) => e.id === id)

/** Radix attaches the outside-pointer listener on the next tick. */
async function entryOverlay() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  const overlay = document.querySelector("div.fixed.inset-0")
  expect(overlay).toBeTruthy()
  return overlay as Element
}

beforeEach(() => {
  resetAllStores()
  resetTimegridReveal()
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

  it("shows only the pens already on the block until you search", () => {
    const entry = paint()
    render(<EntryDialog entry={entry} onClose={() => {}} />)

    const onBlock = screen.getByRole("group", { name: "Pens on this block" })
    expect(onBlock).toHaveTextContent("Work")
    expect(screen.queryByRole("list", { name: "Pen results" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Add a pen")).toBeInTheDocument()
  })

  it("switches the primary pen from the one search field", () => {
    const entry = paint()
    render(<EntryDialog entry={entry} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText("Add a pen"), { target: { value: "rest" } })
    fireEvent.click(screen.getByRole("button", { name: "Use Rest as primary" }))
    fireEvent.click(screen.getByRole("button", { name: "Save block" }))

    expect(reload(entry.id)?.penId).toBe("act-rest")
    expect(reload(entry.id)?.secondaryPenIds ?? []).toEqual(["act-work"])
  })

  it("shows a secondary already on the block as a chip", () => {
    const entry = paint()
    useTimeTrackingStore.getState().updateEntry(entry.id, { secondaryPenIds: ["act-chores"] })
    const withAlso = reload(entry.id)!
    render(<EntryDialog entry={withAlso} onClose={() => {}} />)

    const onBlock = screen.getByRole("group", { name: "Pens on this block" })
    expect(onBlock).toHaveTextContent("Work")
    expect(onBlock).toHaveTextContent("Chores")
    expect(onBlock).not.toHaveTextContent(/also/i)
    expect(screen.getByRole("button", { name: "Make Chores primary" })).toBeInTheDocument()
  })

  it("names the people on a Company block as a group, with each as detail", () => {
    const store = useTimeTrackingStore.getState()
    const dom = store.addPen("company", { name: "Dom", color: "#1e3a8a" })
    const ian = store.addPen("company", { name: "Ian", color: "#b91c1c" })
    store.paintMinutes(KEY, "company", 540, 600, dom)
    const block = useTimeTrackingStore.getState().entriesFor(KEY, "company")[0]!
    store.updateEntry(block.id, { secondaryPenIds: [ian] })
    render(<EntryDialog entry={reload(block.id)!} onClose={() => {}} />)

    fireEvent.click(screen.getByRole("button", { name: "Name this group…" }))
    fireEvent.change(screen.getByLabelText("Group name"), { target: { value: "Margo Sinclair band" } })
    fireEvent.click(screen.getByRole("button", { name: "Save group" }))
    fireEvent.click(screen.getByRole("button", { name: "Save block" }))

    const group = useTimeTrackingStore
      .getState()
      .scopes.find((s) => s.id === "company")!
      .pens.find((p) => p.name === "Margo Sinclair band")!
    const saved = reload(block.id)!
    expect(saved.penId).toBe(group.id)
    expect(saved.secondaryPenIds ?? []).toEqual([])
    const ticked = (saved.variantIds ?? []).map((id) => group.variants?.find((v) => v.id === id)?.penId).sort()
    expect(ticked).toEqual([dom, ian].sort())
  })

  it("does not offer Name this group outside Company", () => {
    const entry = paint()
    useTimeTrackingStore.getState().updateEntry(entry.id, { secondaryPenIds: ["act-chores"] })
    render(<EntryDialog entry={reload(entry.id)!} onClose={() => {}} />)
    expect(screen.queryByRole("button", { name: "Name this group…" })).not.toBeInTheDocument()
  })

  it("ticks a detail from another view on an Activity block", () => {
    const entry = paint(540, 600, "act-social")
    render(<EntryDialog entry={entry} onClose={() => {}} />)

    fireEvent.click(screen.getByRole("button", { name: "Add option" }))
    fireEvent.change(screen.getByPlaceholderText("Who with?"), { target: { value: "alo" } })
    fireEvent.click(screen.getByTitle("Add Alone from Company as a detail"))
    fireEvent.click(screen.getByRole("button", { name: "Save block" }))

    const social = useTimeTrackingStore.getState().scopes.find((s) => s.id === "activity")!.pens.find((p) => p.id === "act-social")!
    const detail = social.variants?.find((v) => v.penId === "co-alone")
    expect(detail).toMatchObject({ scopeId: "company", name: "Alone" })
    expect(reload(entry.id)?.variantIds).toEqual([detail!.id])
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

    fireEvent.change(screen.getByLabelText("Add a pen"), { target: { value: "chores" } })
    fireEvent.click(screen.getByRole("button", { name: "Add Chores" }))
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

  it("hides the stretch on activity and shows the guide on a mood block", () => {
    const { unmount } = render(<EntryDialog entry={paint()} onClose={() => {}} />)
    expect(screen.queryByTestId("mood-stretch")).not.toBeInTheDocument()
    expect(screen.queryByText("Using a stretch")).not.toBeInTheDocument()
    unmount()

    render(<EntryDialog entry={paintMood()} onClose={() => {}} />)
    expect(screen.getByTestId("mood-stretch")).toBeInTheDocument()
    expect(screen.getByText("Using a stretch")).toBeInTheDocument()
    expect(screen.getByText(/practice of description, not a treatment/)).toBeInTheDocument()
    expect(screen.getByText(/None of this has to be carried past the stretch/)).toBeInTheDocument()
    const pens = screen.getByRole("group", { name: "Mood pens" })
    expect(pens).toHaveTextContent("Great")
    expect(pens).toHaveTextContent("Good")
    expect(pens).toHaveTextContent("Meh")
    expect(pens).toHaveTextContent("Low")
  })

  it("creates a pen for a new mood name and leaves the sentence out of notes", () => {
    const entry = paintMood()
    render(<EntryDialog entry={entry} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "a tight chest" } })
    expect(screen.getByTestId("mood-sentence").textContent).toMatch(/etc\.$/)
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Thin" } })
    fireEvent.click(screen.getByRole("button", { name: "Save block" }))

    const saved = reload(entry.id)
    const pens = useTimeTrackingStore.getState().scopes.find((s) => s.id === "mood")?.pens ?? []
    const pen = pens.find((item) => item.name === "Thin")
    expect(pen?.color).toBe(moodPenColor("Thin"))
    expect(saved?.penId).toBe(pen?.id)
    expect(saved?.moodReading).toMatchObject({ word: "Thin", sensation: "a tight chest" })
    expect(saved?.notes).toBeUndefined()
    expect(saved?.moodReading && "sentence" in saved.moodReading).toBe(false)
    expect(pens.some((item) => item.id === "mood-great")).toBe(true)
    expect(pens.some((item) => item.id === "mood-good")).toBe(true)
    expect(pens.some((item) => item.id === "mood-meh")).toBe(true)
    expect(pens.some((item) => item.id === "mood-low")).toBe(true)
  })

  it("offers a lighter map and keeps the shorthand unless it is accepted", () => {
    const entry = paintMood()
    render(<EntryDialog entry={entry} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "a tight chest" } })
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "hopeless" } })
    fireEvent.change(screen.getByLabelText("Shorthand"), { target: { value: `This stretch, ${KEY}: I am hopeless` } })
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Shorthand"), { target: { value: "I am hopeless" } })
    expect(screen.getByText(/A lighter map, still true/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Accept" }))
    fireEvent.click(screen.getByRole("button", { name: "Save block" }))

    const saved = reload(entry.id)
    expect(saved?.moodReading?.narrative).toBe("I am hopeless")
    expect(saved?.moodReading?.reframe).toMatch(/a tight chest/)
    expect(saved?.moodReading?.reframe).toMatch(/still true|hopeless/)
    expect(saved?.notes).toBeUndefined()
  })

  it("opens centered, with a sharp phosphor title", () => {
    render(<EntryDialog entry={paint()} onClose={() => {}} />)
    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveClass("trk-entry")
    expect(dialog).not.toHaveClass("trk-entry-drawer")
    expect(dialog).not.toHaveAttribute("data-presentation", "drawer")
    const style = getComputedStyle(dialog)
    expect(style.position).toBe("fixed")
    expect(style.left).toBe("50%")
    expect(style.top).toBe("50%")
    expect(style.right).toBe("auto")
    expect(style.transform).toBe("translate(-50%, -50%)")
    expect(document.querySelector(".trk-entry-overlay")).toBeNull()

    const title = screen.getByRole("heading", { name: /Work · 9:00 AM – 10:00 AM/ })
    const titleStyle = getComputedStyle(title)
    // jsdom reports `text-shadow: none` as a transparent shadow.
    expect(titleStyle.textShadow === "none" || titleStyle.textShadow === "rgba(0, 0, 0, 0)").toBe(true)
    expect(titleStyle.filter).toBe("none")
    expect(titleStyle.letterSpacing).toBe("1px")
    expect(titleStyle.lineHeight).toBe("16px")
    expect(titleStyle.boxShadow).not.toMatch(/14px/)
  })

  it("replaces the open block when another entry is passed", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(KEY, "activity", 540, 600, "act-work")
    store.paintMinutes(KEY, "activity", 600, 660, "act-rest")
    const entries = useTimeTrackingStore.getState().entriesFor(KEY, "activity")
    const work = entries.find((e) => e.startMin === 540)!
    const rest = entries.find((e) => e.startMin === 600)!
    const { rerender } = render(<EntryDialog entry={work} onClose={() => {}} />)
    expect(screen.getByText(/Work · 9:00 AM – 10:00 AM/)).toBeInTheDocument()

    rerender(<EntryDialog entry={rest} onClose={() => {}} />)
    expect(screen.getByText(/Rest · 10:00 AM – 11:00 AM/)).toBeInTheDocument()
    expect(screen.queryByText(/Work · 9:00 AM – 10:00 AM/)).not.toBeInTheDocument()
  })

  it("asks before dismissing a dirty popup from outside or Close", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<EntryDialog entry={paint()} onClose={onClose} />)
    await user.type(screen.getByLabelText("Notes"), "dream")

    const overlay = await entryOverlay()
    fireEvent.pointerDown(overlay)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole("heading", { name: "Unsaved changes" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByLabelText("Notes")).toHaveValue("dream")

    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.getByRole("heading", { name: "Unsaved changes" })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByLabelText("Notes")).toHaveValue("dream")
  })

  it("closes a clean popup from the overlay", async () => {
    const onClose = vi.fn()
    render(<EntryDialog entry={paint()} onClose={onClose} />)
    const overlay = await entryOverlay()
    fireEvent.pointerDown(overlay)
    expect(onClose).toHaveBeenCalled()
    expect(screen.queryByRole("heading", { name: "Unsaved changes" })).not.toBeInTheDocument()
  })

  it("show in timegrid leaves a clean editor and names that block", async () => {
    const entry = paint(15 * 60, 16 * 60)
    const onClose = vi.fn()
    render(<EntryDialog entry={entry} onClose={onClose} />)
    fireEvent.click(screen.getByRole("button", { name: "show in timegrid" }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(peekTimegridReveal()).toMatchObject({
      entryId: entry.id,
      date: KEY,
      scopeId: "activity",
      startMin: 15 * 60,
    })
    expect(useTimeTrackingStore.getState().gridSpan).toBe("day")
    expect(readStoredTab(APP_NAV_KEYS.appTab, APP_TABS, "analytics")).toBe("home")
    expect(readStoredTab(APP_NAV_KEYS.homeTab, ["habits", "plan", "todo", "goals", "tracking"], "habits")).toBe(
      "tracking",
    )
    expect(readStoredTab(APP_NAV_KEYS.homeTrackingTab, ["grid", "activity", "daylog", "log"], "activity")).toBe("grid")
  })

  it("asks before show in timegrid leaves a dirty editor", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<EntryDialog entry={paint()} onClose={onClose} />)
    await user.type(screen.getByLabelText("Notes"), "dream")
    await user.click(screen.getByRole("button", { name: "show in timegrid" }))
    expect(onClose).not.toHaveBeenCalled()
    expect(peekTimegridReveal()).toBeNull()
    expect(screen.getByRole("heading", { name: "Unsaved changes" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByLabelText("Notes")).toHaveValue("dream")
    expect(onClose).not.toHaveBeenCalled()
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

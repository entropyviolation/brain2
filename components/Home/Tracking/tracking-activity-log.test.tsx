import { render, screen, fireEvent, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TrackingActivityLog } from "./tracking-activity-log"

const DAY = new Date(2026, 8, 17)
const KEY = "2026-09-17"

function renderLog() {
  return render(<TrackingActivityLog currentDate={DAY} setCurrentDate={() => {}} />)
}

beforeEach(() => {
  resetAllStores()
})

describe("TrackingActivityLog", () => {
  it("lists every painted block with its clock window and duration", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(KEY, "activity", 540, 600, "act-work")
    store.paintMinutes(KEY, "activity", 660, 690, "act-rest")

    renderLog()

    expect(screen.getByText("9:00 AM – 10:00 AM")).toBeInTheDocument()
    expect(screen.getByText("11:00 AM – 11:30 AM")).toBeInTheDocument()
    // Once on the block, once in the per-pen footer, once in the per-tag footer —
    // the seeded Work and Rest pens each carry a same-named tag.
    expect(screen.getAllByText("1h")).toHaveLength(3)
    expect(screen.getAllByText("30m")).toHaveLength(3)
    expect(screen.getByText(/2 blocks/)).toBeInTheDocument()
  })

  it("lines the untracked gap up as time · label · note · fill · add", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(KEY, "activity", 0, 1380, "act-work")
    store.setSelectedPen("act-rest")
    renderLog()
    const note = screen.getByLabelText(/Note for untracked/)
    const row = note.closest(".trk-log-gap")
    expect(row).toBeTruthy()
    expect(row?.className).toMatch(/trk-log-row/)
    expect(row?.querySelector(".trk-log-when")?.textContent).toMatch(/11:00 PM/)
    expect(row?.querySelector(".trk-gap-label")?.textContent).toMatch(/Untracked/)
    expect(screen.getByRole("button", { name: /Fill with Rest/ }).className).toMatch(/trk-gap-fill/)
    expect(screen.getByRole("button", { name: "Log activity in this gap" }).className).toMatch(/trk-gap-add/)
  })

  it("opens log activity from an untracked gap", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(KEY, "activity", 0, 1380, "act-work")
    renderLog()
    fireEvent.click(screen.getByRole("button", { name: "Log activity in this gap" }))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByLabelText("Start")).toHaveValue("23:00")
    expect(within(dialog).getByLabelText("End")).toHaveValue("00:00")
  })

  it("notes an untracked gap", () => {
    useTimeTrackingStore.getState().paintMinutes(KEY, "activity", 0, 1380, "act-work")
    renderLog()
    fireEvent.change(screen.getByLabelText(/Note for untracked/), { target: { value: "walked to the store" } })
    expect(useTimeTrackingStore.getState().untrackedNotes[`${KEY}|activity|1380|1440`]).toBe("walked to the store")
  })

  it("fills a gap with the selected pen in one click", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(KEY, "activity", 0, 1380, "act-work")
    store.setSelectedPen("act-rest")

    renderLog()
    fireEvent.click(screen.getByRole("button", { name: /Fill with Rest/ }))

    const entries = useTimeTrackingStore.getState().entriesFor(KEY, "activity")
    expect(entries.find((e) => e.penId === "act-rest")).toMatchObject({ startMin: 1380, endMin: 1440 })
  })

  it("names the variants on a block", () => {
    const id = useTimeTrackingStore.getState().addVariant("activity", "act-social", "Elijah")
    useTimeTrackingStore.getState().paintMinutes(KEY, "activity", 540, 600, "act-social", [id])

    renderLog()
    expect(screen.getByText("Elijah")).toBeInTheDocument()
  })

  it("shows what the other scopes said about the same stretch", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(KEY, "activity", 540, 600, "act-work")
    store.paintMinutes(KEY, "location", 500, 700, "loc-home")

    renderLog()
    expect(screen.getByText(/Location: Home/)).toBeInTheDocument()
  })

  it("opens the block editor for a Sleep row", () => {
    useTimeTrackingStore.getState().paintMinutes(KEY, "activity", 0, 420, "act-sleep")
    const sleep = useTimeTrackingStore.getState().entriesFor(KEY, "activity")[0]
    useTimeTrackingStore.setState({
      entries: [{ ...sleep, generatedBy: { kind: "sleep", id: KEY } }],
    })
    renderLog()
    fireEvent.click(screen.getByText("12:00 AM – 7:00 AM"))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByLabelText("Fell asleep")).toBeInTheDocument()
    expect(screen.getByLabelText("Woke up")).toBeInTheDocument()
  })

  it("opens a block for editing and deletes it", () => {
    useTimeTrackingStore.getState().paintMinutes(KEY, "activity", 540, 600, "act-work")
    renderLog()

    fireEvent.click(screen.getByText("9:00 AM – 10:00 AM"))
    const dialog = screen.getByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete block" }))

    expect(useTimeTrackingStore.getState().entriesFor(KEY, "activity")).toHaveLength(0)
  })

  it("agrees with the grid on the day total", () => {
    useTimeTrackingStore.getState().paintMinutes(KEY, "activity", 540, 660, "act-work")
    renderLog()
    expect(screen.getByText(/2h tracked/)).toBeInTheDocument()
  })

  it("renders one Log activity control in the day nav", () => {
    renderLog()
    expect(screen.getAllByRole("button", { name: "Log activity" })).toHaveLength(1)
  })

  it("logs a block that starts 11 PM and ends 1 AM the next day via optional dates", () => {
    renderLog()
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).queryByLabelText("Start date")).not.toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText("Start"), { target: { value: "23:00" } })
    fireEvent.change(within(dialog).getByLabelText("End"), { target: { value: "01:00" } })
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Date" })[1])
    fireEvent.change(within(dialog).getByLabelText("End date"), { target: { value: "2026-09-18" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Log block" }))

    const entries = useTimeTrackingStore.getState().entries.filter((e) => e.scopeId === "activity")
    expect(entries.map((e) => [e.date, e.startMin, e.endMin])).toEqual([
      [KEY, 1380, 1440],
      ["2026-09-18", 0, 60],
    ])
    expect(entries[0].spanId).toBe(entries[1].spanId)
  })

  it("logs a new block from the dialog without filling a listed gap", () => {
    renderLog()
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }))
    const dialog = screen.getByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText("Start"), { target: { value: "14:00" } })
    fireEvent.change(within(dialog).getByLabelText("End"), { target: { value: "15:00" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Log block" }))

    expect(useTimeTrackingStore.getState().entriesFor(KEY, "activity")).toMatchObject([
      { startMin: 840, endMin: 900, penId: "act-work" },
    ])
  })

  it("creates a new pen from the log dialog and paints with it", () => {
    renderLog()
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }))
    const dialog = screen.getByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText("Start"), { target: { value: "16:00" } })
    fireEvent.change(within(dialog).getByLabelText("End"), { target: { value: "16:30" } })
    fireEvent.change(within(dialog).getByLabelText("New pen name"), { target: { value: "Trash" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Add pen" }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Log block" }))

    const pens = useTimeTrackingStore.getState().scopes.find((s) => s.id === "activity")!.pens
    const trash = pens.find((p) => p.name === "Trash")
    expect(trash).toBeTruthy()
    expect(useTimeTrackingStore.getState().entriesFor(KEY, "activity")).toMatchObject([
      { startMin: 960, endMin: 990, penId: trash!.id },
    ])
  })

  it("creates a pen from a search that matched nothing", () => {
    renderLog()
    fireEvent.click(screen.getByRole("button", { name: "Log activity" }))
    const dialog = screen.getByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText("Search pens"), { target: { value: "Balboa Park" } })
    fireEvent.click(within(dialog).getByRole("button", { name: 'Create “Balboa Park”' }))
    fireEvent.change(within(dialog).getByLabelText("Start"), { target: { value: "10:00" } })
    fireEvent.change(within(dialog).getByLabelText("End"), { target: { value: "11:00" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Log block" }))

    const pens = useTimeTrackingStore.getState().scopes.find((s) => s.id === "activity")!.pens
    const park = pens.find((p) => p.name === "Balboa Park")
    expect(park).toBeTruthy()
    expect(useTimeTrackingStore.getState().entriesFor(KEY, "activity")[0].penId).toBe(park!.id)
  })
})

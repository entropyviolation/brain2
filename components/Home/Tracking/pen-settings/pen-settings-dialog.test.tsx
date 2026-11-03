/**
 * components/Home/Tracking/pen-settings/pen-settings-dialog.test.tsx
 */
import { describe, expect, it, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { PenSettingsDialog } from "./pen-settings-dialog"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useHabitsStore } from "@/lib/habits-store"
import { TaskType } from "@/lib/types"

function activityPen(penId: string) {
  return useTimeTrackingStore
    .getState()
    .scopes.find((s) => s.id === "activity")!
    .pens.find((p) => p.id === penId)!
}

beforeEach(() => {
  useTimeTrackingStore.persist?.clearStorage?.()
  useTimeTrackingStore.setState(useTimeTrackingStore.getInitialState())
  useHabitsStore.setState({ tasks: [] })
})

describe("PenSettingsDialog", () => {
  it("assigns a tag to the pen and saves it", () => {
    render(<PenSettingsDialog scopeId="activity" pen={activityPen("act-work")} onClose={() => {}} />)

    fireEvent.click(screen.getByRole("button", { name: "Exercise" }))
    fireEvent.click(screen.getByRole("button", { name: "Save pen" }))

    expect(activityPen("act-work").tags).toEqual(["tag-work", "tag-exercise"])
  })

  it("names each tag toggle for accessibility and keeps a bead", () => {
    render(<PenSettingsDialog scopeId="activity" pen={activityPen("act-work")} onClose={() => {}} />)
    const exercise = screen.getByRole("button", { name: "Exercise" })
    expect(exercise).toHaveAttribute("aria-label", "Exercise")
    expect(exercise.querySelector(".trk-tag-bead")).toBeTruthy()
  })

  it("creates a new tag and attaches it in one step", () => {
    render(<PenSettingsDialog scopeId="activity" pen={activityPen("act-chores")} onClose={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText(/New tag/), { target: { value: "Dishes" } })
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }))
    fireEvent.click(screen.getByRole("button", { name: "Save pen" }))

    const created = useTimeTrackingStore.getState().tags.find((t) => t.name === "Dishes")!
    expect(created).toBeTruthy()
    expect(activityPen("act-chores").tags).toContain(created.id)
  })

  it("names the habits that consume the pen's tags", () => {
    useHabitsStore.setState({
      tasks: [
        {
          id: "h1",
          name: "Clean for 15 minutes",
          type: TaskType.GOAL,
          goal: 15,
          frequency: "daily",
          trackingLink: { tagIds: ["tag-cleaning"] },
        },
      ],
    })
    render(<PenSettingsDialog scopeId="activity" pen={activityPen("act-chores")} onClose={() => {}} />)

    expect(screen.getByText("Clean for 15 minutes")).toBeInTheDocument()
  })

  it("adds a variant so the pen can be broken down", () => {
    render(<PenSettingsDialog scopeId="activity" pen={activityPen("act-social")} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText("Break this pen down by…"), { target: { value: "Who with?" } })
    fireEvent.change(screen.getByPlaceholderText(/New option/), { target: { value: "Elijah" } })
    fireEvent.click(screen.getByRole("button", { name: "Add option" }))
    fireEvent.click(screen.getByRole("button", { name: "Save pen" }))

    const pen = activityPen("act-social")
    expect(pen.variantLabel).toBe("Who with?")
    expect(pen.variants?.map((v) => v.name)).toEqual(["Elijah"])
  })

  it("keeps painted time when a variant is removed", () => {
    const id = useTimeTrackingStore.getState().addVariant("activity", "act-social", "Rebecca")
    useTimeTrackingStore.getState().paintMinutes("2026-09-17", "activity", 540, 600, "act-social", [id])

    render(<PenSettingsDialog scopeId="activity" pen={activityPen("act-social")} onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "Remove Rebecca" }))

    const entries = useTimeTrackingStore.getState().entriesFor("2026-09-17", "activity")
    expect(entries).toHaveLength(1)
    expect(entries[0].variantIds).toBeUndefined()
  })

  it("renames a pen", () => {
    render(<PenSettingsDialog scopeId="activity" pen={activityPen("act-chores")} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Do dishes" } })
    fireEvent.click(screen.getByRole("button", { name: "Save pen" }))

    expect(activityPen("act-chores").name).toBe("Do dishes")
  })

  it("nests a pen under another in the same view", () => {
    render(<PenSettingsDialog scopeId="activity" pen={activityPen("act-chores")} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText("Counts as"))
    fireEvent.click(screen.getByRole("option", { name: "Exercise" }))
    expect(activityPen("act-chores").parentId).toBe("act-exercise")
  })

  it("creates a new parent pen from Counts as", () => {
    render(<PenSettingsDialog scopeId="activity" pen={activityPen("act-chores")} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText("Counts as"))
    fireEvent.click(screen.getByRole("button", { name: /Create new pen/i }))
    fireEvent.change(screen.getByLabelText("New parent pen name"), { target: { value: "Cleaning" } })
    fireEvent.click(screen.getByRole("button", { name: "Create" }))
    const parent = useTimeTrackingStore.getState().scopes[0].pens.find((p) => p.name === "Cleaning")
    expect(parent).toBeTruthy()
    expect(activityPen("act-chores").parentId).toBe(parent!.id)
  })

  it("saves a default action format on the pen", () => {
    render(<PenSettingsDialog scopeId="activity" pen={activityPen("act-exercise")} onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "Show formats" }))
    fireEvent.click(screen.getByRole("button", { name: /Add format/i }))
    fireEvent.change(screen.getByLabelText("Action format 1"), { target: { value: "Went for a walk" } })
    fireEvent.click(screen.getByRole("button", { name: "Save pen" }))
    expect(activityPen("act-exercise").actionFormats?.map((f) => f.template)).toEqual(["Went for a walk"])
  })

  it("lists recent blocks with this pen, newest first, and opens one", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes("2026-06-18", "activity", 9 * 60, 10 * 60, "act-work")
    store.paintMinutes("2026-06-20", "activity", 13 * 60, 14 * 60 + 30, "act-work")
    store.paintMinutes("2026-06-20", "activity", 15 * 60, 16 * 60, "act-chores")
    render(<PenSettingsDialog scopeId="activity" pen={activityPen("act-work")} onClose={() => {}} />)
    const list = screen.getByRole("list", { name: "Recent blocks with this pen" })
    const rows = list.querySelectorAll("button")
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent(/1:00 PM–2:30 PM/)
    expect(rows[1]).toHaveTextContent(/9:00 AM–10:00 AM/)
    expect(list).not.toHaveTextContent(/3:00 PM/)
    fireEvent.click(rows[0])
    expect(document.querySelectorAll("[role=\"dialog\"]").length).toBe(2)
  })

  it("says so when the pen has no blocks yet", () => {
    render(<PenSettingsDialog scopeId="activity" pen={activityPen("act-work")} onClose={() => {}} />)
    expect(screen.getByText("Nothing painted with this pen yet.")).toBeInTheDocument()
  })

  it("adds a Company pen as a detail of an Activity pen from another view", () => {
    render(<PenSettingsDialog scopeId="activity" pen={activityPen("act-social")} onClose={() => {}} />)
    const picker = screen.getByRole("group", { name: "Detail from another view" })
    expect(within(picker).getByRole("button", { name: "Company" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.change(within(picker).getByLabelText("Search Company pens"), { target: { value: "alo" } })
    fireEvent.click(within(picker).getByRole("button", { name: "Alone" }))

    const detail = activityPen("act-social").variants?.find((v) => v.penId === "co-alone")
    expect(detail).toMatchObject({ scopeId: "company", name: "Alone" })
    const row = document.querySelector('.trk-detail-row[data-cross-view="true"]') as HTMLElement
    expect(row).toHaveTextContent("Alone")
    expect(row).toHaveTextContent("Company")
    // Already linked: no longer offered.
    expect(within(picker).queryByRole("button", { name: "Alone" })).not.toBeInTheDocument()

    fireEvent.click(within(row).getByRole("button", { name: "Remove Alone" }))
    expect(activityPen("act-social").variants?.some((v) => v.penId === "co-alone") ?? false).toBe(false)
    const company = useTimeTrackingStore.getState().scopes.find((s) => s.id === "company")!
    expect(company.pens.some((p) => p.id === "co-alone")).toBe(true)
  })
})

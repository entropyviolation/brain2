import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { HeaderTrackingPopup } from "@/components/header-tracking/header-tracking-popup"
import { formatLocalDateKey } from "@/lib/date-utils"
import { getDayNote } from "@/lib/day-notes-persist"
import { minutesToLabel } from "@/lib/time-entries"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { getPlanEntries } from "@/lib/plan-text"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { itemTitle } from "@/lib/item-utils"

vi.mock("@/components/Home/Tracking/time-grid", () => ({
  TimeGrid: () => <div data-testid="time-grid">day grid</div>,
}))

vi.mock("@/components/Home/Plan/agenda-grid", () => ({
  AgendaGrid: () => <div data-testid="plan-agenda">agenda</div>,
}))

vi.mock("@/components/Home/Plan/planned-action-dialog", () => ({
  PlannedActionDialog: () => null,
}))

describe("Header tracking popup", () => {
  beforeEach(() => {
    resetAllStores()
    usePlannedActionStore.setState({ actions: [] })
  })

  it("adds a pen from the searchable field and stamps now", async () => {
    const user = userEvent.setup()
    render(<HeaderTrackingPopup />)
    await user.click(await screen.findByTestId("htk-lane-location"))
    await user.click(screen.getByRole("button", { name: "Choose Location" }))
    expect(screen.getByRole("option", { name: "Home" })).toBeVisible()
    expect(screen.getByRole("option", { name: "Outside" })).toBeVisible()
    const field = screen.getByRole("combobox", { name: "Location" })
    await user.type(field, "Library")
    await user.click(screen.getByRole("option", { name: "Add Library" }))
    await user.click(screen.getByRole("button", { name: "Add for now" }))
    const pen = useTimeTrackingStore.getState().scopes.find((scope) => scope.id === "location")?.pens.find((item) => item.name === "Library")
    expect(pen).toBeTruthy()
    expect(
      useTimeTrackingStore.getState().entries.some((entry) => entry.scopeId === "location" && entry.penId === pen?.id),
    ).toBe(true)
  })

  it("saves a plan and leaves plan-versus-reality off this popup", async () => {
    const user = userEvent.setup()
    render(<HeaderTrackingPopup />)
    await user.click(await screen.findByRole("tab", { name: "Plan" }))
    await screen.findByTestId("plan-agenda")
    await user.type(screen.getByRole("textbox", { name: "Action 1" }), "Dishes")
    await user.clear(screen.getByRole("textbox", { name: "Minutes for action 1" }))
    await user.type(screen.getByRole("textbox", { name: "Minutes for action 1" }), "20")
    await user.type(screen.getByRole("textbox", { name: "Action 2" }), "Floor")
    await user.clear(screen.getByRole("textbox", { name: "Minutes for action 2" }))
    await user.type(screen.getByRole("textbox", { name: "Minutes for action 2" }), "15")
    await user.click(screen.getByRole("button", { name: "Save plan" }))
    expect(await screen.findByText(/Saved 2/)).toBeInTheDocument()
    expect(screen.getByTestId("plan-agenda")).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Against the plan" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Open plan" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Tracking" }))
    expect(screen.queryByRole("region", { name: "Against the plan" })).not.toBeInTheDocument()
    expect(useTaskStore.getState().tasks.some((task) => itemTitle(task) === "Dishes")).toBe(true)
  })

  it("shows current moment on both panes, with when, and only the four lanes", async () => {
    const user = userEvent.setup()
    const now = new Date()
    const today = formatLocalDateKey(now)
    const min = now.getHours() * 60 + now.getMinutes()
    useTimeTrackingStore.getState().paintMinutes(
      today,
      "activity",
      Math.max(0, min - 10),
      Math.min(24 * 60, min + 1),
      "act-work",
      undefined,
      undefined,
      "estimated",
      { clockCertainty: "estimated" },
    )
    render(<HeaderTrackingPopup />)
    const activity = await screen.findByTestId("htk-lane-activity")
    expect(screen.getByRole("region", { name: "Current moment" })).toBeInTheDocument()
    expect(activity).toHaveTextContent("Work")
    expect(activity).toHaveTextContent(minutesToLabel(min))
    expect(activity.querySelector(".trk-est")).toBeTruthy()
    expect(screen.getAllByTestId(/^htk-lane-/)).toHaveLength(4)
    expect(screen.queryByTestId("htk-lane-screentime")).not.toBeInTheDocument()
    expect(screen.queryByTestId("htk-lane-iphone-calls")).not.toBeInTheDocument()
    const trackingMoment = screen.getByRole("region", { name: "Current moment" })
    const trackingMetrics = within(trackingMoment).getByRole("button", { name: /^Metrics$/ })
    expect(trackingMetrics).toHaveClass("htk-metrics")
    expect(
      screen.getByTestId("htk-lane-company").compareDocumentPosition(trackingMetrics) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    await user.click(screen.getByRole("tab", { name: "Plan" }))
    const moment = screen.getByRole("region", { name: "Current moment" })
    expect(moment).toBeInTheDocument()
    expect(within(moment).getByTestId("htk-working-now")).toBeInTheDocument()
    expect(within(moment).getByRole("region", { name: "Events" })).toBeInTheDocument()
    expect(within(moment).getByRole("region", { name: "Thought process" })).toBeInTheDocument()
    expect(screen.getByTestId("htk-lane-company")).toBeInTheDocument()
    expect(screen.getAllByTestId(/^htk-lane-/)).toHaveLength(4)
    expect(screen.queryByTestId("htk-lane-screentime")).not.toBeInTheDocument()
    const tabs = screen.getByRole("tablist", { name: "Now" })
    expect(moment.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const metrics = within(moment).getByRole("button", { name: /^Metrics$/ })
    expect(metrics).toHaveClass("htk-metrics")
    expect(screen.getByTestId("htk-lane-company").compareDocumentPosition(metrics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(metrics)
    expect(await screen.findByRole("heading", { name: "Wellbeing metrics" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Log datapoint" })).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("heading", { name: "Wellbeing metrics" })).not.toBeInTheDocument()
  })

  it("appends an event, a thought process, and a day note on the shared logs", async () => {
    const user = userEvent.setup()
    render(<HeaderTrackingPopup />)
    const events = await screen.findByRole("region", { name: "Events" })
    expect(events).toHaveTextContent("Any repeated phrase can be counted later. Example: left room.")
    await user.type(within(events).getByRole("textbox", { name: "Add to Events" }), "left room")
    await user.click(within(events).getByRole("button", { name: "Add to Events" }))
    expect(within(events).getByText("left room", { selector: ".trk-log-copy" })).toBeInTheDocument()

    const thoughts = screen.getByRole("region", { name: "Thought process" })
    expect(thoughts).toHaveTextContent("A strand from what you are doing, to what it leads to, to how it feels.")
    await user.type(within(thoughts).getByRole("textbox", { name: "Add to Thought process" }), "opening the window")
    await user.click(within(thoughts).getByRole("button", { name: "Add to Thought process" }))
    expect(within(thoughts).getByText("opening the window")).toBeInTheDocument()

    const note = await screen.findByRole("textbox", { name: /Day summary for|Day summary ·/ })
    await user.type(note, "zoo 4-5")
    expect(note).toHaveValue("zoo 4-5")
    expect(getDayNote(formatLocalDateKey(new Date()))).toContain("zoo 4-5")

    const stored = useTimeTrackingStore.getState().entries
    expect(stored.some((entry) => entry.title === "left room")).toBe(true)
    expect(stored.some((entry) => entry.title === "opening the window" && entry.eventKind === "thought-process")).toBe(true)
    const moment = screen.getByRole("region", { name: "Current moment" })
    expect(within(moment).getByRole("region", { name: "Events" })).toBeInTheDocument()
  })

  it("shows the day plan log and keeps an added line", async () => {
    const user = userEvent.setup()
    render(<HeaderTrackingPopup />)
    await user.click(await screen.findByRole("tab", { name: "Plan" }))
    const plan = await screen.findByRole("region", { name: "Day plan" })
    await user.type(within(plan).getByRole("textbox", { name: "New plan entry" }), "orchard walk")
    await user.click(within(plan).getByRole("button", { name: "Submit plan" }))
    expect(within(plan).getByText(/orchard walk/)).toBeInTheDocument()
    const day = formatLocalDateKey(new Date())
    expect(getPlanEntries("day", day).some((entry) => entry.text.includes("orchard walk"))).toBe(true)
  })

  it("offers Update beside Add for now when the value matches, and stamps from the Plan pane", async () => {
    const user = userEvent.setup()
    const now = new Date()
    const today = formatLocalDateKey(now)
    const min = now.getHours() * 60 + now.getMinutes()
    const start = Math.max(0, min - 40)
    const priorEnd = Math.max(start + 1, min - 15)
    useTimeTrackingStore.getState().paintMinutes(today, "activity", start, priorEnd, "act-work")
    render(<HeaderTrackingPopup />)
    await user.click(await screen.findByTestId("htk-lane-activity"))
    expect(screen.getByRole("region", { name: "Update state" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add for now" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Update" }))
    const extended = useTimeTrackingStore
      .getState()
      .entries.filter((entry) => entry.date === today && entry.scopeId === "activity")
    expect(extended).toHaveLength(1)
    expect(extended[0]?.startMin).toBe(start)
    expect(extended[0]?.endMin).toBeGreaterThanOrEqual(min)

    await user.click(screen.getByRole("tab", { name: "Plan" }))
    await user.click(screen.getByRole("button", { name: "Choose Activity" }))
    await user.click(screen.getByRole("option", { name: "Rest" }))
    expect(screen.queryByRole("button", { name: "Update" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Add for now" }))
    expect(
      useTimeTrackingStore.getState().entries.some((entry) => entry.date === today && entry.scopeId === "activity" && entry.penId === "act-rest"),
    ).toBe(true)
  })

  it("lists recent values and keeps a compact Exact control", async () => {
    const user = userEvent.setup()
    const now = new Date()
    const today = formatLocalDateKey(now)
    const min = now.getHours() * 60 + now.getMinutes()
    const early = Math.max(0, min - 50)
    useTimeTrackingStore.getState().paintMinutes(today, "mood", early, early + 10, "mood-meh")
    useTimeTrackingStore.getState().paintMinutes(today, "mood", early + 20, early + 30, "mood-good")
    render(<HeaderTrackingPopup />)
    await user.click(await screen.findByTestId("htk-lane-mood"))
    await user.click(screen.getByRole("button", { name: "Recent sequence" }))
    const recent = screen.getByRole("list", { name: "Recent values" })
    expect(within(recent).getByText("Meh")).toBeInTheDocument()
    expect(within(recent).getByText("Good")).toBeInTheDocument()
    const exact = screen.getByText("Exact").closest("label")
    expect(exact).toHaveClass("htk-exact")
    expect(exact?.querySelector("input[type='checkbox']")).toBeTruthy()
  })
})

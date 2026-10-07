import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { getDayNote } from "@/lib/day-notes-persist"
import { minutesToTimeString } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TrackingLogView } from "./tracking-log-view"
import { resetLogCycleMarks, writeCycleDayMark, type LogTimeEntry } from "./tracking-log-model"

const DAY = new Date(2026, 5, 20, 12, 0, 0)
const KEY = "2026-06-20"

function renderLog() {
  return render(<TrackingLogView currentDate={DAY} setCurrentDate={() => {}} />)
}

describe("TrackingLogView", () => {
  beforeEach(() => {
    resetAllStores()
    resetLogCycleMarks()
  })

  it("renders an empty day with intake lists and events, and hides cycle until the setting is on", () => {
    renderLog()
    expect(screen.getByTestId("tracking-log-view")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Food" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Drink" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Drugs" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Events" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Intake" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Cycle" })).not.toBeInTheDocument()
    expect(screen.queryByTestId("tracking-log-phase")).not.toBeInTheDocument()
  })

  it("reads the phase for the selected day from fixture marks", () => {
    useTimeTrackingStore.setState({ enableCycleTracking: true, cycleDetailsOpen: true })
    writeCycleDayMark("2026-06-18", { bleeding: true })
    writeCycleDayMark(KEY, { ovulation: true })
    renderLog()
    expect(screen.getByTestId("tracking-log-phase")).toHaveTextContent("Phase: ovulatory")
    expect(screen.getByRole("button", { name: "Ovulation" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Bleeding" })).toHaveAttribute("aria-pressed", "false")
  })

  it("shows a clock when certainty is exact and hides the stored minute when unknown", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(KEY, "activity", 8 * 60, 8 * 60, "act-work", undefined, undefined, undefined, {
      kind: "instant",
      title: "coffee",
    })
    store.paintMinutes(KEY, "activity", 0, 0, "act-rest", undefined, undefined, undefined, {
      kind: "instant",
      title: "water",
    })
    const entries = useTimeTrackingStore.getState().entries
    const coffee = entries.find((entry) => entry.title === "coffee")
    const water = entries.find((entry) => entry.title === "water")
    if (coffee) {
      store.updateEntry(coffee.id, { intakeClass: "food" } as Partial<Omit<LogTimeEntry, "id">>)
    }
    if (water) {
      store.updateEntry(water.id, {
        intakeClass: "drink",
        clockCertainty: "unknown",
      } as Partial<Omit<LogTimeEntry, "id">>)
    }

    renderLog()
    expect(screen.getByRole("button", { name: /coffee/ })).toHaveTextContent("8:00 AM")
    const drink = screen.getByRole("region", { name: "Drink" })
    expect(drink).toHaveTextContent("water")
    expect(drink).toHaveTextContent("Unknown")
    expect(drink).not.toHaveTextContent("12:00 AM")
  })

  it("keeps the modes on one row, with the clock always visible", () => {
    renderLog()
    const modes = screen.getByRole("toolbar", { name: "What to log" })
    expect(within(modes).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Event",
      "Switch",
      "Intake",
      "Note",
      "Thought",
    ])
    expect(modes).toHaveClass("trk-logbook-modes")
    expect(screen.queryByRole("button", { name: "Clock" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Food" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Time of day")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Location" })).toBeInTheDocument()
    expect(screen.getByLabelText("Title").tagName).toBe("INPUT")
    expect(screen.queryByRole("toolbar", { name: "Intake" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Intake" }))
    expect(screen.getByRole("toolbar", { name: "Intake" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Food" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("combobox", { name: "Location" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Title").tagName).toBe("INPUT")
    fireEvent.click(screen.getByRole("button", { name: "Switch" }))
    expect(screen.getByLabelText("From")).toBeInTheDocument()
    expect(screen.getByLabelText("To")).toBeInTheDocument()
    expect(screen.getByLabelText("View")).toHaveValue("activity")
    expect(screen.queryByRole("combobox", { name: "Location" })).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Note")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Note" }))
    expect(screen.getByLabelText("Note").tagName).toBe("TEXTAREA")
    fireEvent.click(screen.getByRole("button", { name: "Thought" }))
    expect(screen.getByRole("textbox", { name: "Thought" }).tagName).toBe("TEXTAREA")
    expect(screen.queryByLabelText("Note")).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Location" })).not.toBeInTheDocument()
    expect(screen.queryByRole("toolbar", { name: "Location" })).not.toBeInTheDocument()
    expect(screen.queryByRole("toolbar", { name: "Intake" })).not.toBeInTheDocument()
  })

  it("treats Estimated and Unknown as mutually exclusive checkboxes and keeps the clock when Unknown is on", () => {
    renderLog()
    const estimated = screen.getByRole("checkbox", { name: "Estimated" })
    const unknown = screen.getByRole("checkbox", { name: "Unknown" })
    const clock = screen.getByLabelText("Time of day")
    fireEvent.change(clock, { target: { value: "09:15" } })
    fireEvent.click(estimated)
    expect(estimated).toBeChecked()
    expect(unknown).not.toBeChecked()
    fireEvent.click(unknown)
    expect(unknown).toBeChecked()
    expect(estimated).not.toBeChecked()
    expect(clock).toHaveValue("09:15")
    fireEvent.click(estimated)
    expect(estimated).toBeChecked()
    expect(unknown).not.toBeChecked()
  })

  it("stamps Now into the clock and clears Unknown", () => {
    renderLog()
    fireEvent.change(screen.getByLabelText("Time of day"), { target: { value: "09:15" } })
    fireEvent.click(screen.getByRole("checkbox", { name: "Unknown" }))
    fireEvent.click(screen.getByRole("button", { name: "Now" }))
    expect(screen.getByRole("checkbox", { name: "Unknown" })).not.toBeChecked()
    const now = new Date()
    const minute = now.getHours() * 60 + now.getMinutes()
    const values = new Set([minutesToTimeString(minute), minutesToTimeString((minute + 1439) % 1440)])
    expect(values.has(screen.getByLabelText("Time of day").getAttribute("value") ?? "")).toBe(true)
  })

  it("adds an event phrase as an activity instant", () => {
    renderLog()
    fireEvent.click(screen.getByRole("button", { name: "Event" }))
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "left room" } })
    fireEvent.click(screen.getByRole("checkbox", { name: "Unknown" }))
    expect(screen.getByLabelText("Time of day")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    const events = screen.getByRole("region", { name: "Events" })
    expect(events).toHaveTextContent("left room")
    expect(events).toHaveTextContent("Unknown")
    expect(events).not.toHaveTextContent("12:00 AM")
    const saved = useTimeTrackingStore.getState().entries.find((entry) => entry.title === "left room") as
      | LogTimeEntry
      | undefined
    expect(saved?.kind).toBe("instant")
    expect(saved?.scopeId).toBe("activity")
    expect(saved?.eventKind).toBe("left room")
    expect(saved?.clockCertainty).toBe("unknown")
    expect(saved?.startMin).toBe(0)
  })

  it("stores intake on the Intake pen and shows it under Food", () => {
    renderLog()
    fireEvent.click(screen.getByRole("button", { name: "Intake" }))
    fireEvent.click(screen.getByRole("button", { name: "Food" }))
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "coffee" } })
    fireEvent.click(screen.getByRole("checkbox", { name: "Estimated" }))
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    const food = screen.getByRole("region", { name: "Food" })
    expect(food).toHaveTextContent("coffee")
    expect(food).toHaveTextContent("Estimated")
    expect(food).toHaveTextContent("8:00 AM")
    const saved = useTimeTrackingStore.getState().entries.find((entry) => entry.title === "coffee") as
      | LogTimeEntry
      | undefined
    expect(saved).toMatchObject({
      intakeClass: "food",
      eventKind: "intake.food",
      clockCertainty: "estimated",
      precision: "estimated",
      startMin: 8 * 60,
    })
  })

  it("switches on the chosen view, and a location switch stays off Activity", () => {
    renderLog()
    fireEvent.click(screen.getByRole("button", { name: "Switch" }))
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "cleaning" } })
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    const list = screen.getByRole("region", { name: "Switch" })
    expect(list).toHaveTextContent("cleaning")
    expect(list).toHaveTextContent("Activity")
    expect(list).toHaveTextContent("8:00 AM")
    const started = useTimeTrackingStore.getState().entries.find((entry) => entry.switchTo === "cleaning")
    expect(started).toMatchObject({ scopeId: "activity", title: "started cleaning", kind: "instant" })

    fireEvent.change(screen.getByLabelText("View"), { target: { value: "location" } })
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "home" } })
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "work" } })
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    const place = useTimeTrackingStore.getState().entries.find((entry) => entry.switchTo === "work")
    expect(place).toMatchObject({ scopeId: "location", penId: "loc-work", switchFrom: "home", kind: "instant" })
    expect(place?.scopeId).not.toBe("activity")
    expect(list).toHaveTextContent("home → work")
    expect(list).toHaveTextContent("Location")
  })

  it("files a note on the day's log", () => {
    renderLog()
    fireEvent.click(screen.getByRole("button", { name: "Note" }))
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "left room" } })
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    const events = screen.getByRole("region", { name: "Events" })
    expect(events).toHaveTextContent("left room")
    expect(events).toHaveTextContent("8:00 AM")
    expect(getDayNote(KEY)).toBe("")
    const saved = useTimeTrackingStore.getState().entries.find((entry) => entry.title === "left room")
    const pen = useTimeTrackingStore
      .getState()
      .scopes.find((scope) => scope.id === "activity")
      ?.pens.find((row) => row.id === saved?.penId)
    expect(saved?.kind).toBe("instant")
    expect(pen?.name).toBe("Text log")
  })

  it("keeps a multiline note on the text log and shows the body", () => {
    renderLog()
    fireEvent.click(screen.getByRole("button", { name: "Note" }))
    const note = screen.getByLabelText("Note")
    expect(note.tagName).toBe("TEXTAREA")
    fireEvent.change(note, { target: { value: "left room\nforgot the list" } })
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    const events = screen.getByRole("region", { name: "Events" })
    expect(events).toHaveTextContent("left room")
    expect(events).toHaveTextContent("forgot the list")
    expect(events).not.toHaveTextContent("from text pipeline")
    expect(getDayNote(KEY)).toBe("")
    const saved = useTimeTrackingStore.getState().entries.find((entry) => entry.title === "left room")
    expect(saved?.kind).toBe("instant")
    expect(saved?.notes).toContain("forgot the list")
    expect(saved?.title).not.toContain("\n")
  })

  it("shows a textarea in Thought mode and files the row under Thought", () => {
    renderLog()
    fireEvent.click(screen.getByRole("button", { name: "Thought" }))
    const field = screen.getByRole("textbox", { name: "Thought" })
    expect(field.tagName).toBe("TEXTAREA")
    fireEvent.change(field, { target: { value: "opening the editor to fix the clock\nso the military clock stays" } })
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    const thought = screen.getByRole("region", { name: "Thought" })
    expect(thought).toHaveTextContent("opening the editor to fix the clock")
    expect(thought).toHaveTextContent("so the military clock stays")
    expect(screen.getByRole("region", { name: "Events" })).not.toHaveTextContent("opening the editor to fix the clock")
    const saved = useTimeTrackingStore.getState().entries.find((entry) => entry.title === "opening the editor to fix the clock")
    expect(saved?.eventKind).toBe("thought-process")
    expect(getDayNote(KEY)).toBe("")
  })

  it("filters location pens, creates one, and still pairs the event", () => {
    renderLog()
    const field = screen.getByRole("combobox", { name: "Location" })
    expect(field).toHaveValue("")
    expect(field).toHaveAttribute("placeholder", "Location")
    expect(screen.queryByRole("button", { name: "Add location" })).not.toBeInTheDocument()
    expect(screen.queryByRole("toolbar", { name: "Location" })).not.toBeInTheDocument()

    fireEvent.focus(field)
    fireEvent.keyDown(field, { key: "ArrowDown" })
    fireEvent.keyDown(field, { key: "Enter" })
    expect(field).toHaveValue("Work")
    expect(screen.queryByRole("listbox", { name: "Locations" })).not.toBeInTheDocument()

    fireEvent.change(field, { target: { value: "out" } })
    expect(screen.getByRole("option", { name: "Outside" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Home" })).not.toBeInTheDocument()
    fireEvent.keyDown(field, { key: "Enter" })
    expect(field).toHaveValue("Outside")

    fireEvent.change(field, { target: { value: "zzz" } })
    expect(screen.getByRole("option", { name: /Create .*zzz/ })).toBeInTheDocument()
    fireEvent.keyDown(field, { key: "Escape" })
    expect(screen.queryByRole("listbox", { name: "Locations" })).not.toBeInTheDocument()
    expect(field).toHaveValue("Outside")

    fireEvent.change(field, { target: { value: "kitchen" } })
    fireEvent.keyDown(field, { key: "Enter" })
    expect(field).toHaveValue("kitchen")
    const kitchen = useTimeTrackingStore
      .getState()
      .scopes.find((scope) => scope.id === "location")
      ?.pens.find((pen) => pen.name === "kitchen")
    expect(kitchen?.id).toBeTruthy()

    fireEvent.focus(field)
    fireEvent.click(screen.getByRole("option", { name: "Home" }))
    expect(field).toHaveValue("Home")

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "left room" } })
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    const paired = useTimeTrackingStore
      .getState()
      .entries.find((entry) => entry.scopeId === "location" && entry.kind === "instant")
    expect(paired).toMatchObject({ penId: "loc-home", startMin: 8 * 60 })
    expect(screen.getByRole("region", { name: "Events" })).toHaveTextContent("left room")

    fireEvent.change(field, { target: { value: "" } })
    expect(field).toHaveValue("")
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "came back" } })
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    const places = useTimeTrackingStore
      .getState()
      .entries.filter((entry) => entry.scopeId === "location" && entry.kind === "instant")
    expect(places).toHaveLength(1)
    expect(places[0]?.penId).toBe("loc-home")
  })
})

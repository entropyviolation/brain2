import { fireEvent, render, screen, within } from "@testing-library/react"
import { format } from "date-fns"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey, getWeekDates, getWeekStartDate } from "@/lib/date-utils"
import { getDayNote } from "@/lib/day-notes-persist"
import { minutesToTimeString } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { QuickAddWroteHost } from "@/components/quick-add-wrote"
import { TrackingLogView } from "./tracking-log-view"
import { resetLogCycleMarks, writeCycleDayMark, type LogTimeEntry } from "./tracking-log-model"
import { pickOption } from "@/tests/native-select"

const DAY = new Date(2026, 5, 20, 12, 0, 0)
const KEY = "2026-06-20"

function renderLog(setCurrentDate: (date: Date) => void = () => {}) {
  return render(<TrackingLogView currentDate={DAY} setCurrentDate={setCurrentDate} />)
}

/** Composer keys. Shelf headings share some of these names. */
function logMode(name: string) {
  return within(screen.getByRole("toolbar", { name: "What to log" })).getByRole("button", { name })
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
      "Spent",
      "Note",
      "Thought process",
    ])
    expect(modes).toHaveClass("trk-logbook-modes")
    expect(screen.queryByRole("button", { name: "Clock" })).not.toBeInTheDocument()
    expect(within(screen.getByRole("toolbar", { name: "What to log" })).queryByRole("button", { name: "Food" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Time of day")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Location" })).toBeInTheDocument()
    expect(screen.getByLabelText("Title").tagName).toBe("INPUT")
    expect(screen.queryByRole("toolbar", { name: "Intake" })).not.toBeInTheDocument()
    fireEvent.click(logMode("Intake"))
    expect(screen.getByRole("toolbar", { name: "Intake" })).toBeInTheDocument()
    expect(within(screen.getByRole("toolbar", { name: "Intake" })).getByRole("button", { name: "Food" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("combobox", { name: "Location" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Name").tagName).toBe("INPUT")
    fireEvent.click(logMode("Switch"))
    expect(screen.getByLabelText("From")).toBeInTheDocument()
    expect(screen.getByLabelText("To")).toBeInTheDocument()
    expect(screen.getByLabelText("View")).toHaveTextContent("Activity")
    expect(screen.queryByRole("combobox", { name: "Location" })).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Note")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Note" }))
    expect(screen.getByLabelText("Note").tagName).toBe("TEXTAREA")
    fireEvent.click(logMode("Thought process"))
    expect(screen.getByRole("textbox", { name: "Thought process" }).tagName).toBe("TEXTAREA")
    expect(screen.getByRole("textbox", { name: "Thought process" })).toHaveAttribute(
      "placeholder",
      "A strand from what you are doing, to what it leads to, to how it feels.",
    )
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

  it("stamps Now from inside the clock popup", () => {
    renderLog()
    fireEvent.change(screen.getByLabelText("Time of day"), { target: { value: "09:15" } })
    fireEvent.click(screen.getByRole("checkbox", { name: "Unknown" }))
    expect(screen.queryByRole("button", { name: "Now" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Open Time of day clock" }))
    fireEvent.click(screen.getByRole("button", { name: "Now" }))
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
    fireEvent.click(logMode("Intake"))
    fireEvent.click(within(screen.getByRole("toolbar", { name: "Intake" })).getByRole("button", { name: "Food" }))
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "coffee" } })
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
    fireEvent.click(logMode("Switch"))
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "cleaning" } })
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    const list = screen.getByRole("region", { name: "Switch" })
    expect(list).toHaveTextContent("cleaning")
    expect(list).toHaveTextContent("Activity")
    expect(list).toHaveTextContent("8:00 AM")
    const started = useTimeTrackingStore.getState().entries.find((entry) => entry.switchTo === "cleaning")
    expect(started).toMatchObject({ scopeId: "activity", title: "started cleaning", kind: "instant" })

    pickOption(screen.getByLabelText("View"), "location")
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

  it("shows a textarea in Thought process mode and files the row under Thought process", () => {
    renderLog()
    fireEvent.click(logMode("Thought process"))
    const field = screen.getByRole("textbox", { name: "Thought process" })
    expect(field.tagName).toBe("TEXTAREA")
    fireEvent.change(field, { target: { value: "opening the editor to fix the clock\nso the military clock stays" } })
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    const thought = screen.getByRole("region", { name: "Thought process" })
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

  it("logs money spent with an amount, what, and source, and edits it", () => {
    renderLog()
    expect(screen.getByRole("region", { name: "Spent" })).toHaveTextContent("Nothing spent this day.")
    fireEvent.click(logMode("Spent"))
    expect(screen.getByLabelText("Amount")).toBeInTheDocument()
    expect(screen.getByLabelText("On")).toBeInTheDocument()
    expect(screen.getByLabelText("Source")).toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Location" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Time of day")).toBeInTheDocument()
    const add = screen.getByRole("button", { name: /^Add$/ })
    expect(add).toBeDisabled()

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "abc" } })
    fireEvent.change(screen.getByLabelText("On"), { target: { value: "coffee" } })
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "Cash" } })
    expect(add).toBeDisabled()
    expect(screen.getByText("Amount is dollars and cents, such as 4.50.")).toBeInTheDocument()
    expect(useTimeTrackingStore.getState().entries.filter((entry) => entry.eventKind === "spend")).toHaveLength(0)

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "" } })
    expect(add).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "4.50" } })
    expect(add).toBeEnabled()
    fireEvent.click(add)

    const spent = screen.getByRole("region", { name: "Spent" })
    expect(spent).toHaveTextContent("$4.50")
    expect(spent).toHaveTextContent("coffee")
    expect(spent).toHaveTextContent("Cash")
    expect(spent).toHaveTextContent("$4.50 spent this day")
    expect(spent).toHaveTextContent("8:00 AM")
    const saved = useTimeTrackingStore.getState().entries.find((entry) => entry.eventKind === "spend")
    expect(saved).toMatchObject({ spendAmount: 450, spendOn: "coffee", spendSource: "Cash", title: "coffee" })
    // The purchase is now offered again as a one-tap refill on the composer.
    expect(within(screen.getByRole("group", { name: "Recent purchases" })).getByRole("button", { name: /coffee/ })).toBeInTheDocument()

    fireEvent.click(within(spent).getByRole("button", { name: /coffee/ }))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByLabelText("Amount")).toHaveValue("4.50")
    fireEvent.change(within(dialog).getByLabelText("Amount"), { target: { value: "nope" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Save event" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(within(dialog).getByText("Amount is dollars and cents, such as 4.50.")).toBeInTheDocument()
    expect(useTimeTrackingStore.getState().entries.find((entry) => entry.id === saved?.id)?.spendAmount).toBe(450)

    fireEvent.change(within(dialog).getByLabelText("Amount"), { target: { value: "9" } })
    fireEvent.change(within(dialog).getByLabelText("Spent on"), { target: { value: "tea" } })
    fireEvent.change(within(dialog).getByLabelText("Source"), { target: { value: "Card" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Save event" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(spent).toHaveTextContent("$9.00")
    expect(spent).toHaveTextContent("tea")
    expect(spent).toHaveTextContent("Card")
    expect(useTimeTrackingStore.getState().entries.find((entry) => entry.id === saved?.id)).toMatchObject({
      spendAmount: 900,
      spendOn: "tea",
      spendSource: "Card",
      title: "tea",
    })

    fireEvent.click(screen.getByRole("button", { name: "Event" }))
    expect(screen.getByLabelText("Title")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "left room" } })
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    expect(screen.getByRole("region", { name: "Events" })).toHaveTextContent("left room")
  })

  it("defaults to Day span with shelves and no week board", () => {
    renderLog()
    expect(screen.getByRole("button", { name: "Day" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Week" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.queryByTestId("tracking-log-week")).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Food" })).toBeInTheDocument()
  })

  it("week switch shows seven day columns and week period label", () => {
    renderLog()
    fireEvent.click(screen.getByRole("button", { name: "Week" }))

    expect(screen.getByTestId("tracking-log-week")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Food" })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Add a line" })).toBeInTheDocument()

    const weekDates = getWeekDates(getWeekStartDate(DAY))
    for (const date of weekDates) {
      expect(screen.getByRole("button", { name: `Open ${format(date, "EEEE, MMM d")}` })).toBeInTheDocument()
    }

    const weekStart = getWeekStartDate(DAY)
    expect(
      screen.getByText(`${format(weekStart, "MMM d")} – ${format(weekDates[6]!, "MMM d, yyyy")}`),
    ).toBeInTheDocument()
  })

  it("previous and next week change the visible range", () => {
    const setCurrentDate = vi.fn()
    renderLog(setCurrentDate)
    fireEvent.click(screen.getByRole("button", { name: "Week" }))

    fireEvent.click(screen.getByRole("button", { name: "Previous week" }))
    expect(setCurrentDate).toHaveBeenCalled()
    const prev = setCurrentDate.mock.calls.at(-1)?.[0] as Date
    expect(formatLocalDateKey(prev)).toBe(
      formatLocalDateKey(new Date(DAY.getFullYear(), DAY.getMonth(), DAY.getDate() - 7)),
    )

    fireEvent.click(screen.getByRole("button", { name: "Next week" }))
    const next = setCurrentDate.mock.calls.at(-1)?.[0] as Date
    expect(formatLocalDateKey(next)).toBe(
      formatLocalDateKey(new Date(DAY.getFullYear(), DAY.getMonth(), DAY.getDate() + 7)),
    )
  })

  it("activating a day heading returns to that day's day view", () => {
    const setCurrentDate = vi.fn()
    renderLog(setCurrentDate)
    fireEvent.click(screen.getByRole("button", { name: "Week" }))

    const weekDates = getWeekDates(getWeekStartDate(DAY))
    const tuesday = weekDates[1]!
    fireEvent.click(screen.getByRole("button", { name: `Open ${format(tuesday, "EEEE, MMM d")}` }))

    expect(setCurrentDate).toHaveBeenCalled()
    expect(formatLocalDateKey(setCurrentDate.mock.calls.at(-1)?.[0] as Date)).toBe(formatLocalDateKey(tuesday))
    expect(screen.getByRole("heading", { name: "Food" })).toBeInTheDocument()
    expect(screen.queryByTestId("tracking-log-week")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Day" })).toHaveAttribute("aria-pressed", "true")
  })

  it("hides the Day Week switch when the date is locked", () => {
    render(<TrackingLogView currentDate={DAY} setCurrentDate={() => {}} lockDate />)
    expect(screen.queryByRole("toolbar", { name: "Tracking log span" })).not.toBeInTheDocument()
    expect(screen.queryByTestId("tracking-log-week")).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Food" })).toBeInTheDocument()
  })
})

describe("tracking log quick keys", () => {
  it("fills the name from a recent intake chip and only logs on Add", () => {
    render(
      <>
        <TrackingLogView currentDate={DAY} setCurrentDate={() => {}} />
        <QuickAddWroteHost />
      </>,
    )
    fireEvent.click(logMode("Intake"))
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "coffee" } })
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    const food = () => screen.getByRole("region", { name: "Food" })
    expect(within(food()).getAllByRole("button", { name: /coffee/ })).toHaveLength(1)
    expect(screen.getByRole("status")).toHaveTextContent(/COFFEE · FOOD INTAKE LOGGED/)

    const recent = screen.getByRole("group", { name: "Recent intake" })
    fireEvent.click(within(recent).getByRole("button", { name: /coffee/ }))
    expect(within(food()).getAllByRole("button", { name: /coffee/ })).toHaveLength(1)
    expect(screen.getByLabelText("Name")).toHaveValue("coffee")

    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    expect(within(food()).getAllByRole("button", { name: /coffee/ })).toHaveLength(2)
  })

  it("opens a shelf the way Spent does", () => {
    renderLog()
    fireEvent.click(within(screen.getByRole("region", { name: "Food" })).getByRole("button", { name: "Food" }))
    const food = screen.getByRole("dialog", { name: "Food" })
    expect(food).toHaveTextContent("Nothing eaten this day.")
    fireEvent.keyDown(food, { key: "Escape" })
    fireEvent.click(within(screen.getByRole("region", { name: "Events" })).getByRole("button", { name: "Events" }))
    expect(screen.getByRole("dialog", { name: "Events" })).toHaveTextContent("left room")
  })

  it("refills the spend form from a recent purchase and picks a source key", () => {
    renderLog()
    fireEvent.click(logMode("Spent"))
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "3.25" } })
    fireEvent.change(screen.getByLabelText("On"), { target: { value: "tea" } })
    fireEvent.click(within(screen.getByRole("group", { name: "Sources" })).getByRole("button", { name: "Card" }))
    expect(screen.getByLabelText("Source")).toHaveValue("Card")
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    expect(screen.getByLabelText("Amount")).toHaveValue("")
    fireEvent.click(within(screen.getByRole("group", { name: "Recent purchases" })).getByRole("button", { name: /tea/ }))
    expect(screen.getByLabelText("Amount")).toHaveValue("3.25")
    expect(screen.getByLabelText("On")).toHaveValue("tea")
    expect(screen.getByLabelText("Source")).toHaveValue("Card")
    // The day's readouts sit beside the date.
    expect(screen.getByText("Spent", { selector: ".trk-readout-plate" })).toBeInTheDocument()
  })
})

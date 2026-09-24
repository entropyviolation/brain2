import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useEventStore } from "@/lib/event-store"
import type { CalendarEvent } from "@/lib/types"
import { EventDialog } from "./event-dialog"

const currentDate = new Date("2026-06-20T12:00:00")

const baseNewEvent = {
  title: "",
  startTime: "09:00",
  endTime: "10:00",
  type: "event" as const,
  date: currentDate,
  endDate: undefined as Date | undefined,
  isAllDay: false,
  location: "",
  description: "",
}

function EventHarness({
  editingEvent = null,
  initial = baseNewEvent,
}: {
  editingEvent?: CalendarEvent | null
  initial?: typeof baseNewEvent
}) {
  const [open, setOpen] = useState(true)
  const [event, setEvent] = useState(editingEvent)
  const [newEvent, setNewEvent] = useState(initial)
  if (!open) return <div>event closed</div>
  return (
    <EventDialog
      open={open}
      onOpenChange={setOpen}
      editingEvent={event}
      setEditingEvent={setEvent}
      newEvent={newEvent}
      setNewEvent={setNewEvent}
      events={[]}
      setEvents={vi.fn()}
    />
  )
}

describe("EventDialog", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("renders create event dialog when open", () => {
    render(<EventHarness />)
    expect(screen.getByText("Create New Event")).toBeInTheDocument()
    expect(screen.getByLabelText("Event Title")).toBeInTheDocument()
    expect(screen.getByLabelText("Event color")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Mint" })).toBeInTheDocument()
  })

  it("adds an event to the store when created", async () => {
    const user = userEvent.setup()
    render(<EventHarness initial={{ ...baseNewEvent, title: "Team sync" }} />)

    await user.click(screen.getByRole("button", { name: "Create Event" }))
    expect(useEventStore.getState().events).toHaveLength(1)
    expect(useEventStore.getState().events[0].title).toBe("Team sync")
    expect(useEventStore.getState().events[0].color).toBe("#8cd4a5")
  })

  it("persists a picked event color", async () => {
    const user = userEvent.setup()
    render(<EventHarness initial={{ ...baseNewEvent, title: "Violet hike", color: "#8b7ecc" }} />)

    await user.click(screen.getByRole("button", { name: "Create Event" }))
    expect(useEventStore.getState().events[0].color).toBe("#8b7ecc")
  })

  it("closes immediately when the draft is clean", async () => {
    const user = userEvent.setup()
    render(<EventHarness initial={{ ...baseNewEvent, title: "SHOW – Wilmington, NC" }} />)
    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.getByText("event closed")).toBeInTheDocument()
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument()
  })

  it("Cancel closes a clean draft without creating an event", async () => {
    const user = userEvent.setup()
    render(<EventHarness initial={{ ...baseNewEvent, title: "Team sync" }} />)
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByText("event closed")).toBeInTheDocument()
    expect(useEventStore.getState().events).toHaveLength(0)
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument()
  })

  it("Cancel on a dirty draft uses the unsaved guard and can discard", async () => {
    const user = userEvent.setup()
    render(<EventHarness />)
    await user.type(screen.getByLabelText("Event Title"), "scratch")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Exit without saving" }))
    expect(useEventStore.getState().events).toHaveLength(0)
    expect(screen.getByText("event closed")).toBeInTheDocument()
  })

  it("prompts on dirty close and Save / Stay / Discard all work", async () => {
    const user = userEvent.setup()
    render(<EventHarness />)

    await user.type(screen.getByLabelText("Event Title"), "Wilmington")
    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByLabelText("Event Title")).toHaveValue("Wilmington")

    await user.click(screen.getByRole("button", { name: "Close" }))
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    expect(useEventStore.getState().events[0]?.title).toBe("Wilmington")
    expect(screen.getByText("event closed")).toBeInTheDocument()
  })

  it("discards unsaved edits without persisting", async () => {
    const user = userEvent.setup()
    render(<EventHarness />)
    await user.type(screen.getByLabelText("Event Title"), "scratch")
    await user.click(screen.getByRole("button", { name: "Close" }))
    await user.click(screen.getByRole("button", { name: "Exit without saving" }))
    expect(useEventStore.getState().events).toHaveLength(0)
    expect(screen.getByText("event closed")).toBeInTheDocument()
  })
})

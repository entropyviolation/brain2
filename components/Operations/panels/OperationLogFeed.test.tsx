import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore, type TimeEntry } from "@/lib/time-tracking-store"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "@/lib/operation-types"
import type { Task, TimeLogEntry } from "@/lib/types"
import { OperationLogFeed, logBlockWindow, matchLogTimeBlock, operationPreferPenIds } from "./OperationLogFeed"

function seedOperation(timeLogs?: TimeLogEntry[], createdAt = new Date(2026, 0, 15, 9, 41)): Task {
  const op: Task = {
    id: "op_log",
    description: "Foxtide rebuild",
    type: OPERATION_TYPE_ID,
    stage: "clarified",
    createdAt,
    completed: false,
    lists: [],
    attributes: {},
    links: [],
    timeLogs,
  }
  useTaskStore.getState().addTask(op)
  return op
}

describe("OperationLogFeed", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("shows created from createdAt when nothing has been logged", () => {
    const operation = seedOperation()
    render(<OperationLogFeed operation={operation} />)

    expect(screen.getByText("No time logged yet.")).toBeInTheDocument()
    expect(screen.getByText("0h total")).toBeInTheDocument()
    const row = screen.getByRole("listitem")
    expect(within(row).getByText("created")).toBeInTheDocument()
    expect(within(row).getByText("2026-01-15")).toBeInTheDocument()
    expect(within(row).getByText("09:41")).toBeInTheDocument()
    expect(within(row).getByText("Foxtide rebuild")).toBeInTheDocument()
  })

  it("orders created with time punches, oldest first", () => {
    const operation = seedOperation([
      { id: "late", date: "2026-01-20", durationMinutes: 30, notes: "later work" },
      { id: "early", date: "2026-01-02", durationMinutes: 15, notes: "earlier work" },
      { id: "morning", date: "2026-01-15", startTime: "08:00", durationMinutes: 20, notes: "before stamp" },
      { id: "sameday", date: "2026-01-15", durationMinutes: 45, notes: "that day" },
    ])
    render(<OperationLogFeed operation={operation} />)

    expect(screen.queryByText("No time logged yet.")).not.toBeInTheDocument()
    const labels = screen.getAllByRole("listitem").map((row) => row.textContent ?? "")
    expect(labels.map((text) => text.includes("earlier work"))).toEqual([true, false, false, false, false])
    expect(labels[0]).toContain("2026-01-02")
    expect(labels[1]).toContain("before stamp")
    expect(labels[2]).toContain("created")
    expect(labels[2]).toContain("09:41")
    expect(labels[3]).toContain("that day")
    expect(labels[4]).toContain("later work")
    expect(labels[4]).toContain("2026-01-20")
  })

  it("omits created when createdAt is not a real timestamp", () => {
    const operation = seedOperation(undefined, new Date(Number.NaN))
    render(<OperationLogFeed operation={operation} />)

    expect(screen.getByText("No time logged yet.")).toBeInTheDocument()
    expect(screen.queryByText("created")).not.toBeInTheDocument()
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument()
  })
})

function block(partial: Partial<TimeEntry> & Pick<TimeEntry, "id">): TimeEntry {
  return {
    date: "2026-10-27",
    scopeId: "activity",
    penId: "act-work",
    startMin: 9 * 60,
    endMin: 10 * 60,
    ...partial,
  }
}

describe("matchLogTimeBlock", () => {
  const prefer = ["act-work"]

  it("follows entryIds even when another block shares the punch clock and the note", () => {
    const log: TimeLogEntry = {
      id: "punch",
      date: "2026-10-27",
      startTime: "09:00",
      endTime: "10:00",
      durationMinutes: 60,
      notes: "sdfgdfg",
      entryIds: ["real"],
    }
    const entries = [
      block({ id: "decoy", title: "sdfgdfg", penId: "loc-home", scopeId: "location" }),
      block({ id: "real", startMin: 11 * 60, endMin: 12 * 60, title: "Painted block" }),
    ]
    expect(matchLogTimeBlock(log, entries, prefer)?.id).toBe("real")
  })

  it("matches the same start and end, and prefers the operation pen over a same-titled block", () => {
    const log: TimeLogEntry = {
      id: "punch",
      date: "2026-10-27",
      startTime: "09:00",
      endTime: "10:00",
      durationMinutes: 60,
      notes: "sdfgdfg",
    }
    const entries = [
      block({ id: "aaa", title: "sdfgdfg", penId: "loc-home", scopeId: "location" }),
      block({ id: "zzz", title: "Painted block", penId: "act-work" }),
    ]
    expect(matchLogTimeBlock(log, entries, prefer)?.id).toBe("zzz")
  })

  it("treats an end of 00:00 as the end of the day when the duration reaches it", () => {
    expect(logBlockWindow({ startTime: "23:30", endTime: "00:00", durationMinutes: 30 })).toEqual({
      startMin: 23 * 60 + 30,
      endMin: 1440,
    })
    const log: TimeLogEntry = {
      id: "night",
      date: "2026-10-27",
      startTime: "23:30",
      endTime: "00:00",
      durationMinutes: 30,
    }
    expect(matchLogTimeBlock(log, [block({ id: "night-block", startMin: 23 * 60 + 30, endMin: 1440 })])?.id).toBe(
      "night-block",
    )
  })

  it("does not match a day-only punch or a created line's missing log", () => {
    const dayOnly: TimeLogEntry = { id: "day", date: "2026-10-27", durationMinutes: 3432, notes: "sdfgdfg" }
    const entries = [block({ id: "labeled", title: "sdfgdfg" })]
    expect(logBlockWindow(dayOnly)).toBeNull()
    expect(matchLogTimeBlock(dayOnly, entries, prefer)).toBeUndefined()
  })

  it("reads prefer pens from trackingPenId then penLinks", () => {
    const operation = {
      attributes: { [OPERATION_ATTR.trackingPenId]: "act-work" },
      penLinks: [
        { scopeId: "activity", penId: "act-exercise" },
        { scopeId: "activity", penId: "act-work" },
      ],
    } as Task
    expect(operationPreferPenIds(operation)).toEqual(["act-work", "act-exercise"])
  })
})

describe("OperationLogFeed pens and blocks", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("stores chosen pen colors on the operation", () => {
    const operation = seedOperation()
    render(<OperationLogFeed operation={operation} />)

    const choose = screen.getByRole("button", { name: "Choose pens" })
    expect(choose.className).toContain("ops-keycap")
    expect(choose.className).not.toContain("is-primary")
    const logTime = screen.getByRole("button", { name: "Log time" })
    expect(logTime.className).toContain("ops-keycap")
    expect(logTime.className).toContain("is-primary")

    fireEvent.click(choose)
    const done = screen.getByRole("button", { name: "Done" })
    expect(done.className).toContain("ops-keycap")
    expect(done.className).not.toContain("is-primary")
    fireEvent.click(screen.getByRole("button", { name: "Activity · Work" }))
    fireEvent.click(screen.getByRole("button", { name: "Activity · Exercise" }))

    expect(useTaskStore.getState().tasks.find((task) => task.id === "op_log")?.penLinks).toEqual([
      { scopeId: "activity", penId: "act-work" },
      { scopeId: "activity", penId: "act-exercise" },
    ])
    expect(screen.getByRole("button", { name: "Unlink Activity · Work" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Activity · Work" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Activity · Exercise" })).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(screen.getByRole("button", { name: "Unlink Activity · Work" }))
    expect(useTaskStore.getState().tasks.find((task) => task.id === "op_log")?.penLinks).toEqual([
      { scopeId: "activity", penId: "act-exercise" },
    ])
  })

  it("filters pens by name, keeps selected chips, and toggles from the keyboard", () => {
    const operation = seedOperation()
    render(<OperationLogFeed operation={operation} />)

    fireEvent.click(screen.getByRole("button", { name: "Choose pens" }))
    const filter = screen.getByRole("searchbox", { name: "Filter pens" })
    expect(filter).toHaveFocus()

    fireEvent.change(filter, { target: { value: "rest" } })
    expect(screen.getByRole("button", { name: "Activity · Rest" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Activity · Work" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Activity · Exercise" })).not.toBeInTheDocument()

    fireEvent.keyDown(filter, { key: "Enter" })
    expect(useTaskStore.getState().tasks.find((task) => task.id === "op_log")?.penLinks).toEqual([
      { scopeId: "activity", penId: "act-rest" },
    ])
    expect(screen.getByRole("button", { name: "Unlink Activity · Rest" })).toBeInTheDocument()

    fireEvent.change(filter, { target: { value: "work" } })
    expect(screen.getByRole("button", { name: "Activity · Work" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Location · Work" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Activity · Rest" })).not.toBeInTheDocument()
    fireEvent.keyDown(filter, { key: "ArrowDown" })
    fireEvent.keyDown(filter, { key: "Enter" })
    expect(screen.getByRole("button", { name: "Location · Work" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Activity · Work" })).toHaveAttribute("aria-pressed", "false")
    expect(useTaskStore.getState().tasks.find((task) => task.id === "op_log")?.penLinks).toEqual([
      { scopeId: "activity", penId: "act-rest" },
      { scopeId: "location", penId: "loc-work" },
    ])

    fireEvent.change(filter, { target: { value: "no-such-pen" } })
    expect(screen.getByText("No pens match.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Activity · Rest" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Unlink Activity · Rest" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Unlink Location · Work" })).toBeInTheDocument()

    fireEvent.keyDown(filter, { key: "Escape" })
    expect(screen.queryByRole("group", { name: "Pen colors" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Choose pens" })).toBeInTheDocument()
    expect(useTaskStore.getState().tasks.find((task) => task.id === "op_log")?.penLinks).toEqual([
      { scopeId: "activity", penId: "act-rest" },
      { scopeId: "location", penId: "loc-work" },
    ])
  })

  it("opens the matching time block on double-click and leaves a click and a created row alone", () => {
    const operation = seedOperation(
      [
        {
          id: "punch",
          date: "2026-10-27",
          startTime: "09:00",
          endTime: "10:00",
          durationMinutes: 60,
          notes: "sdfgdfg",
        },
      ],
      new Date(2026, 9, 16, 1, 12),
    )
    useTimeTrackingStore.setState({
      entries: [
        block({ id: "aaa", title: "sdfgdfg", penId: "loc-home", scopeId: "location" }),
        block({ id: "zzz", title: "Painted block", penId: "act-work" }),
      ],
    })
    useTaskStore.getState().updateTask({
      ...useTaskStore.getState().tasks[0],
      attributes: { [OPERATION_ATTR.trackingPenId]: "act-work" },
    })
    const live = useTaskStore.getState().tasks.find((task) => task.id === "op_log")!
    render(<OperationLogFeed operation={live} />)

    const punch = screen.getAllByRole("listitem").find((row) => row.textContent?.includes("sdfgdfg"))!
    expect(within(punch).getByRole("img", { name: "Work" })).toBeInTheDocument()
    const created = screen.getAllByRole("listitem").find((row) => row.textContent?.includes("created"))!

    fireEvent.click(punch)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.doubleClick(created)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.doubleClick(punch)

    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveAttribute("data-ui-name", "Tracking entry")
    expect(dialog).toHaveTextContent("Painted block")
    expect(dialog).toHaveTextContent("9:00 AM")
    expect(dialog).not.toHaveTextContent("11:00 AM")
  })
})

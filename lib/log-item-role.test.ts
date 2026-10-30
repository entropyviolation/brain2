import { describe, expect, it } from "vitest"
import { ACTIVITY_SCOPE_ID, LOCATION_SCOPE_ID, type LogTimeEntry } from "@/components/Home/Tracking/tracking-log-model"
import { countItemId, logItemTypeIdForEntry, timeblockTypeIdForEntry } from "./log-item-role"

function instant(partial: Partial<LogTimeEntry> & Pick<LogTimeEntry, "id">): LogTimeEntry {
  return {
    date: "2026-06-20",
    scopeId: ACTIVITY_SCOPE_ID,
    penId: "pen",
    startMin: 480,
    endMin: 480,
    kind: "instant",
    ...partial,
  }
}

describe("logItemTypeIdForEntry", () => {
  it("maps a phrase event to log", () => {
    const entry = instant({ id: "left", title: "left room", eventKind: "left room" })
    expect(logItemTypeIdForEntry(entry, "Text log")).toBe("log")
    expect(timeblockTypeIdForEntry(entry)).toBeNull()
  })

  it("maps a thought-process instant to thought-process", () => {
    const entry = instant({ id: "tp", title: "why this", eventKind: "thought-process" })
    expect(logItemTypeIdForEntry(entry, "Text log")).toBe("thought-process")
  })

  it("maps each intake class, and a bare intake", () => {
    expect(logItemTypeIdForEntry(instant({ id: "food", intakeClass: "food", eventKind: "intake.food" }))).toBe(
      "log-food",
    )
    expect(logItemTypeIdForEntry(instant({ id: "drink", eventKind: "intake.drink" }))).toBe("log-drink")
    expect(logItemTypeIdForEntry(instant({ id: "drug", intakeClass: "drug" }))).toBe("log-drug")
    expect(logItemTypeIdForEntry(instant({ id: "bare", eventKind: "intake" }), "Intake")).toBe("log-intake")
    expect(logItemTypeIdForEntry(instant({ id: "pen" }), "Intake")).toBe("log-intake")
  })

  it("maps a text log with no eventKind to a note", () => {
    const entry = instant({ id: "note", title: "left room" })
    expect(logItemTypeIdForEntry(entry, "Text log")).toBe("log-note")
  })

  it("maps a switch row to log-switch", () => {
    const task = instant({ id: "switch", title: "started cleaning" })
    expect(logItemTypeIdForEntry(task, "Switch")).toBe("log-switch")
    const place = instant({
      id: "moved",
      scopeId: LOCATION_SCOPE_ID,
      title: "home → work",
      switchFrom: "home",
      switchTo: "work",
    })
    expect(logItemTypeIdForEntry(place, "Work")).toBe("log-switch")
  })

  it("maps a spend instant to log-spend", () => {
    const entry = instant({
      id: "spent",
      title: "coffee",
      eventKind: "spend",
      spendAmount: 450,
      spendOn: "coffee",
      spendSource: "Cash",
    })
    expect(logItemTypeIdForEntry(entry, "Spent")).toBe("log-spend")
  })

  it("returns null for a painted interval and timeblock for that span", () => {
    const block = instant({
      id: "computer",
      title: "Computer Work",
      kind: "interval",
      startMin: 12 * 60,
      endMin: 13 * 60 + 40,
      eventKind: "left room",
      generatedBy: { kind: "text", id: "2026-06-20" },
    })
    expect(logItemTypeIdForEntry(block, "Work")).toBeNull()
    expect(timeblockTypeIdForEntry(block)).toBe("timeblock")
  })

  it("returns null for a location-only instant", () => {
    const place = instant({
      id: "here",
      scopeId: LOCATION_SCOPE_ID,
      title: "home",
    })
    expect(logItemTypeIdForEntry(place, "Home")).toBeNull()
    expect(timeblockTypeIdForEntry(place)).toBeNull()
  })
})

describe("countItemId", () => {
  it("prefixes the count id", () => {
    expect(countItemId("water")).toBe("count-item-water")
  })
})

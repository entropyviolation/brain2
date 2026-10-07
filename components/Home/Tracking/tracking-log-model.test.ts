import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  ACTIVITY_SCOPE_ID,
  LOCATION_SCOPE_ID,
  classifyLogBookRow,
  classifyLogInstant,
  ensureLocationPen,
  eventKindSlug,
  logClockLabel,
  paintLogInstant,
  phaseForDate,
  resetLogCycleMarks,
  submitTrackingLog,
  type LogTimeEntry,
} from "./tracking-log-model"

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

describe("tracking log model", () => {
  beforeEach(() => {
    resetLogCycleMarks()
  })

  it("slugs a phrase by lowercase, trim, collapsed spaces, and stripped punctuation", () => {
    expect(eventKindSlug("  Left   Room! ")).toBe("left room")
    expect(eventKindSlug("coffee,")).toBe("coffee")
  })

  it("labels phase from bleed days and ovulation, and ignores spotting", () => {
    const marks = {
      "2026-06-18": { date: "2026-06-18", bleeding: true },
      "2026-06-20": { date: "2026-06-20", ovulation: true, spotting: true },
      "2026-06-21": { date: "2026-06-21", spotting: true },
    }
    expect(phaseForDate("2026-06-18", marks)).toBe("menstrual")
    expect(phaseForDate("2026-06-19", marks)).toBe("follicular")
    expect(phaseForDate("2026-06-20", marks)).toBe("ovulatory")
    expect(phaseForDate("2026-06-21", marks)).toBe("luteal")
    expect(phaseForDate("2026-01-01", {})).toBe("unknown")
    expect(phaseForDate("2026-06-01", { "2026-06-01": { date: "2026-06-01", spotting: true } })).toBe("unknown")
  })

  it("keeps bare intake under the classed lists and events on a kind or the Text log pen", () => {
    expect(classifyLogInstant(instant({ id: "f", intakeClass: "food" }))?.list).toBe("food")
    expect(classifyLogInstant(instant({ id: "b" }), "Intake")?.list).toBe("intake")
    expect(classifyLogInstant(instant({ id: "e", eventKind: "left room", title: "left room" }), "Intake")?.list).toBe(
      "event",
    )
    expect(classifyLogInstant(instant({ id: "t", title: "left room" }), "Text log")?.kindKey).toBe("left room")
    expect(classifyLogInstant(instant({ id: "w" }), "Work")).toBeNull()
  })

  it("stamps eventKind through the activity store", () => {
    resetAllStores()
    const id = paintLogInstant({
      date: "2026-06-20",
      title: "Left Room!",
      target: "event",
      clock: "unknown",
      minute: 99,
    })
    expect(id).toBeTruthy()
    const saved = useTimeTrackingStore.getState().entries.find((entry) => entry.id === id) as LogTimeEntry | undefined
    expect(saved?.kind).toBe("instant")
    expect(saved?.eventKind).toBe("left room")
    expect(saved?.clockCertainty).toBe("unknown")
    expect(saved?.startMin).toBe(0)
    expect(logClockLabel(saved!)).toEqual({ badge: "Unknown" })
  })

  it("paints classed intake and an estimated clock onto the activity instant", () => {
    resetAllStores()
    const food = paintLogInstant({
      date: "2026-06-20",
      title: "toast",
      target: "food",
      clock: "unknown",
      minute: 99,
    })
    const drink = paintLogInstant({
      date: "2026-06-20",
      title: "water",
      target: "drink",
      clock: "estimated",
      minute: 8 * 60 + 15,
    })
    const drug = paintLogInstant({
      date: "2026-06-20",
      title: "tablet",
      target: "drug",
      clock: "exact",
      minute: 9 * 60,
    })
    const entries = useTimeTrackingStore.getState().entries
    const saved = (id: string | null) => entries.find((entry) => entry.id === id)
    expect(saved(food)).toMatchObject({
      kind: "instant",
      scopeId: ACTIVITY_SCOPE_ID,
      intakeClass: "food",
      eventKind: "intake.food",
      clockCertainty: "unknown",
      startMin: 0,
    })
    expect(saved(drink)).toMatchObject({
      intakeClass: "drink",
      eventKind: "intake.drink",
      clockCertainty: "estimated",
      precision: "estimated",
      startMin: 8 * 60 + 15,
    })
    expect(saved(drug)).toMatchObject({
      intakeClass: "drug",
      eventKind: "intake.drug",
      startMin: 9 * 60,
    })
    expect(saved(drug)?.clockCertainty).toBeUndefined()
    expect(logClockLabel(saved(drink)!)).toEqual({ time: "8:15 AM", badge: "Estimated" })
    expect(logClockLabel(saved(food)!).time).toBeUndefined()
  })

  it("keeps switch pens off the analytics classifier and on the log book", () => {
    const task = instant({ id: "s", title: "started cleaning" })
    const goal = instant({ id: "g", title: "objective read" })
    expect(classifyLogInstant(task, "Switch")).toBeNull()
    expect(classifyLogInstant(goal, "Objective")).toBeNull()
    expect(classifyLogBookRow(task, "Switch")?.list).toBe("task")
    expect(classifyLogBookRow(goal, "Objective")?.list).toBe("goal")
  })

  it("files a switch task, a switch goal, and a note through the existing instant paths", () => {
    resetAllStores()
    const task = submitTrackingLog({
      date: "2026-06-20",
      title: "cleaning",
      mode: "task",
      clock: "estimated",
      minute: 8 * 60 + 15,
    })
    const goal = submitTrackingLog({
      date: "2026-06-20",
      title: "read",
      mode: "goal",
      clock: "exact",
      minute: 9 * 60,
    })
    const note = submitTrackingLog({
      date: "2026-06-20",
      title: "left room",
      mode: "note",
      clock: "unknown",
      minute: 99,
    })
    const entries = useTimeTrackingStore.getState().entries
    const saved = (id: string | null) => entries.find((entry) => entry.id === id)
    const pen = (id: string | undefined) => {
      const entry = saved(id ?? "")
      const scope = useTimeTrackingStore.getState().scopes.find((row) => row.id === entry?.scopeId)
      return scope?.pens.find((row) => row.id === entry?.penId)?.name
    }
    expect(saved(task)).toMatchObject({
      kind: "instant",
      scopeId: ACTIVITY_SCOPE_ID,
      title: "started cleaning",
      clockCertainty: "estimated",
      precision: "estimated",
      startMin: 8 * 60 + 15,
    })
    expect(saved(task)?.eventKind).toBeUndefined()
    expect(saved(task)?.intakeClass).toBeUndefined()
    expect(pen(task ?? undefined)).toBe("Switch")
    expect(saved(goal)).toMatchObject({
      title: "objective read",
      startMin: 9 * 60,
    })
    expect(saved(goal)?.clockCertainty).toBeUndefined()
    expect(pen(goal ?? undefined)).toBe("Objective")
    expect(saved(note)).toMatchObject({
      title: "left room",
      clockCertainty: "unknown",
      startMin: 0,
    })
    expect(pen(note ?? undefined)).toBe("Text log")
    expect(classifyLogInstant(saved(note)!, "Text log")?.list).toBe("event")
    expect(logClockLabel(saved(note)!).time).toBeUndefined()
  })

  it("pairs an event with a Location-scope instant and creates a location pen by name", () => {
    resetAllStores()
    const kitchen = ensureLocationPen("kitchen")
    expect(kitchen).toBeTruthy()
    expect(ensureLocationPen("Kitchen")).toBe(kitchen)
    const scope = useTimeTrackingStore.getState().scopes.find((row) => row.id === LOCATION_SCOPE_ID)
    expect(scope?.pens.find((pen) => pen.id === kitchen)?.name).toBe("kitchen")

    const id = submitTrackingLog({
      date: "2026-06-20",
      title: "left room",
      mode: "event",
      clock: "exact",
      minute: 8 * 60,
      locationPenId: "loc-home",
    })
    const entries = useTimeTrackingStore.getState().entries
    expect(entries.find((entry) => entry.id === id)).toMatchObject({
      eventKind: "left room",
      scopeId: ACTIVITY_SCOPE_ID,
      startMin: 8 * 60,
    })
    expect(entries.find((entry) => entry.scopeId === LOCATION_SCOPE_ID && entry.kind === "instant")).toMatchObject({
      penId: "loc-home",
      startMin: 8 * 60,
      endMin: 8 * 60,
    })
    const paired = entries.find((entry) => entry.scopeId === LOCATION_SCOPE_ID && entry.kind === "instant")
    expect(paired?.eventKind).toBeUndefined()
    expect(paired?.clockCertainty).toBeUndefined()
    expect(entries.filter((entry) => entry.scopeId === LOCATION_SCOPE_ID && entry.kind !== "instant")).toHaveLength(0)
  })
})

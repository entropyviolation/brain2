import { describe, expect, it } from "vitest"
import type { TimeEntry } from "@/lib/time-entries"
import { discreteLogInstants, isDiscreteLogInstant, scopeTicksWithDiscreteLogs } from "./discrete-log-instants"

function row(partial: Partial<TimeEntry> & Pick<TimeEntry, "id">): TimeEntry {
  return {
    date: "2026-06-20",
    scopeId: "activity",
    penId: "pen",
    startMin: 8 * 60,
    endMin: 8 * 60,
    kind: "instant",
    ...partial,
  }
}

const pens = (id: string) =>
  (
    {
      "intake-pen": "Intake",
      "text-pen": "Text log",
      "switch-pen": "Switch",
      "loc-work": "Work",
      "act-work": "Work",
    } as Record<string, string>
  )[id]

describe("discrete log instants", () => {
  it("includes a food intake and a location switch, and keeps the switch on its scope", () => {
    const food = row({
      id: "food",
      penId: "intake-pen",
      title: "toast",
      intakeClass: "food",
      eventKind: "intake.food",
      startMin: 8 * 60,
    })
    const place = row({
      id: "place",
      scopeId: "location",
      penId: "loc-work",
      title: "home → work",
      switchFrom: "home",
      switchTo: "work",
      eventKind: "switch",
      startMin: 9 * 60,
      endMin: 9 * 60,
    })
    const entries = [food, place]
    const logs = discreteLogInstants(entries, pens)
    expect(logs.map((entry) => entry.id)).toEqual(["food", "place"])

    const onActivity = scopeTicksWithDiscreteLogs(entries, "2026-06-20", "activity", pens)
    expect(onActivity.map((entry) => entry.id)).toEqual(["food", "place"])

    const onLocation = scopeTicksWithDiscreteLogs(entries, "2026-06-20", "location", pens)
    expect(onLocation.map((entry) => entry.id)).toContain("place")
    expect(onLocation.map((entry) => entry.id)).toContain("food")
  })

  it("includes an old text instant that has only the legacy stamp", () => {
    const legacy = row({
      id: "old-text",
      penId: "act-work",
      title: "left room",
      startMin: 10 * 60,
      endMin: 10 * 60,
      generatedBy: { kind: "text", id: "2026-06-20" },
    })
    expect(legacy.eventKind).toBeUndefined()
    expect(legacy.intakeClass).toBeUndefined()
    expect(legacy.switchFrom).toBeUndefined()
    expect(legacy.switchTo).toBeUndefined()
    expect(isDiscreteLogInstant(legacy, "Work")).toBe(true)
    expect(discreteLogInstants([legacy], pens).map((entry) => entry.id)).toEqual(["old-text"])
  })

  it("includes an old Intake pen instant and an old Text log instant with no class or kind", () => {
    const intake = row({ id: "old-intake", penId: "intake-pen", title: "toast", startMin: 7 * 60, endMin: 7 * 60 })
    const note = row({ id: "old-note", penId: "text-pen", title: "left room", startMin: 7 * 60 + 5, endMin: 7 * 60 + 5 })
    expect(intake.intakeClass).toBeUndefined()
    expect(intake.eventKind).toBeUndefined()
    expect(note.generatedBy).toBeUndefined()
    const ids = discreteLogInstants([intake, note], pens).map((entry) => entry.id)
    expect(ids).toEqual(["old-intake", "old-note"])
  })

  it("includes a Switch pen tick and a mood switch that only carries switchTo", () => {
    const task = row({ id: "task", penId: "switch-pen", title: "started cleaning", startMin: 11 * 60, endMin: 11 * 60 })
    const mood = row({
      id: "mood",
      scopeId: "mood",
      penId: "mood-good",
      title: "low → good",
      switchTo: "good",
      startMin: 11 * 60 + 4,
      endMin: 11 * 60 + 4,
    })
    expect(task.switchFrom).toBeUndefined()
    expect(task.switchTo).toBeUndefined()
    expect(task.generatedBy).toBeUndefined()
    expect(discreteLogInstants([task, mood], pens).map((entry) => entry.id)).toEqual(["task", "mood"])
  })

  it("leaves a painted interval as a block, even when the text pipeline stamped it", () => {
    const block = row({
      id: "computer",
      penId: "act-work",
      title: "Computer Work",
      kind: undefined,
      startMin: 12 * 60,
      endMin: 13 * 60 + 40,
      generatedBy: { kind: "text", id: "2026-06-20" },
    })
    expect(isDiscreteLogInstant(block, "Work")).toBe(false)
    expect(discreteLogInstants([block], pens)).toEqual([])
    const ticks = scopeTicksWithDiscreteLogs([block], "2026-06-20", "activity", pens)
    expect(ticks).toEqual([])
  })

  it("does not treat a hand-painted scope instant as a log tick", () => {
    const smoked = row({
      id: "smoked",
      penId: "act-work",
      title: "smoked weed",
      startMin: 12 * 60 + 17,
      endMin: 12 * 60 + 17,
    })
    expect(isDiscreteLogInstant(smoked, "Work")).toBe(false)
    const ticks = scopeTicksWithDiscreteLogs([smoked], "2026-06-20", "activity", pens)
    expect(ticks.map((entry) => entry.id)).toEqual(["smoked"])
  })
})

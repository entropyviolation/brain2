/**
 * lib/ingest/text-triggers.test.ts — Whole-message habit + discrete patterns
 */
import { describe, expect, it } from "vitest"
import { TaskType, type WeeklyTask } from "@/lib/types"
import {
  describeHabitTriggerPreview,
  matchDiscreteEventTrigger,
  matchDiscretePattern,
  matchHabitTextTrigger,
  DEFAULT_DISCRETE_EVENT_TRIGGERS,
  fromTextMessageNote,
} from "./text-triggers"

function habit(partial: Partial<WeeklyTask> & { name: string }): WeeklyTask {
  return {
    id: partial.id ?? `h-${partial.name}`,
    name: partial.name,
    type: partial.type ?? TaskType.BOOLEAN,
    goal: partial.goal,
    unit: partial.unit,
    textTriggers: partial.textTriggers,
  }
}

describe("matchHabitTextTrigger", () => {
  const habits = [
    habit({ name: "Hemisync", type: TaskType.BOOLEAN }),
    habit({ name: "Read", type: TaskType.GOAL, goal: 30, unit: "pages" }),
    habit({ name: "Exercise", type: TaskType.GOAL, goal: 30, unit: "min" }),
    habit({ name: "Chess", type: TaskType.GOAL, goal: 1, unit: "score" }),
  ]

  it("marks hemisync done with optional note", () => {
    expect(matchHabitTextTrigger("hemisync", habits)).toMatchObject({
      habitName: "Hemisync",
      note: "",
    })
    expect(matchHabitTextTrigger("hemisync felt clear", habits)?.note).toBe("felt clear")
  })

  it("does not fire hemisync buried in prose", () => {
    expect(matchHabitTextTrigger("remember hemisync tonight", habits)).toBeNull()
    expect(matchHabitTextTrigger("hemisyncish", habits)).toBeNull()
  })

  it("parses read 30 pages and exercise 15 min with trailing detail", () => {
    const read = matchHabitTextTrigger("read 30 pages", habits)
    expect(read).toMatchObject({ value: 30, note: "", habitName: "Read" })
    const ex = matchHabitTextTrigger("exercise 15 min walked to the cliffs", habits)
    expect(ex).toMatchObject({ value: 15, note: "walked to the cliffs", habitName: "Exercise" })
  })

  it("parses chess score 355", () => {
    expect(matchHabitTextTrigger("chess score 355", habits)).toMatchObject({
      value: 355,
      habitName: "Chess",
    })
  })

  it("parses a quantity with a filler word, such as studied for 20 min", () => {
    const study = habit({
      name: "Study",
      type: TaskType.GOAL,
      goal: 60,
      unit: "min",
      textTriggers: [{ id: "studied", keyword: "studied", mode: "quantity", unitWords: ["min"] }],
    })
    expect(matchHabitTextTrigger("studied for 20 min", [study])).toMatchObject({ value: 20, note: "" })
  })
})

describe("describeHabitTriggerPreview", () => {
  const triggers = [{ id: "studied", keyword: "studied", mode: "quantity" as const, unitWords: ["min"] }]

  it("adds 20 min onto the running total and does not describe a replacement", () => {
    const preview = describeHabitTriggerPreview("studied for 20 min", triggers, 40)
    expect(preview.matched).toBe(true)
    expect(preview.added).toBe(20)
    expect(preview.text).toMatch(/Adds 20 min/)
    expect(preview.text).toMatch(/40 min already logged \+ 20 min = 60 min/)
    expect(preview.text.toLowerCase()).toMatch(/does not replace/)
  })

  it("says so when the line would not match", () => {
    const preview = describeHabitTriggerPreview("went for a walk", triggers, 0)
    expect(preview.matched).toBe(false)
    expect(preview.text.toLowerCase()).toMatch(/would not match/)
  })

  it("describes done and score without pretending they add minutes", () => {
    expect(describeHabitTriggerPreview("hemisync", [{ id: "h", keyword: "hemisync", mode: "done" }]).text).toMatch(
      /Marks the habit done/,
    )
    expect(
      describeHabitTriggerPreview("chess score 355", [
        { id: "c", keyword: "chess", mode: "score", connector: "score" },
      ]).text,
    ).toMatch(/Sets the score to 355/)
  })
})

describe("matchDiscreteEventTrigger", () => {
  it("matches presets including slots", () => {
    expect(matchDiscreteEventTrigger("smoked weed", DEFAULT_DISCRETE_EVENT_TRIGGERS)?.title).toBe(
      "smoked weed",
    )
    expect(matchDiscreteEventTrigger("drank water", DEFAULT_DISCRETE_EVENT_TRIGGERS)).toBeTruthy()
    expect(matchDiscreteEventTrigger("ate egg salad", DEFAULT_DISCRETE_EVENT_TRIGGERS)?.slots.item).toBe(
      "egg salad",
    )
    expect(matchDiscreteEventTrigger("took 2 adderall", DEFAULT_DISCRETE_EVENT_TRIGGERS)?.slots.item).toBe(
      "2 adderall",
    )
  })

  it("does not treat bare o as an event", () => {
    expect(matchDiscreteEventTrigger("o", DEFAULT_DISCRETE_EVENT_TRIGGERS)).toBeNull()
  })

  it("requires whole-message match", () => {
    expect(matchDiscretePattern("I smoked weed earlier", "smoked weed")).toBeNull()
    expect(matchDiscretePattern("smoked weed", "smoked weed")).toEqual({})
  })
})

describe("fromTextMessageNote", () => {
  it("stamps the message clock", () => {
    const note = fromTextMessageNote(new Date(2026, 8, 23, 13, 42, 0), "walked")
    expect(note).toContain("walked")
    expect(note).toMatch(/from text message at 1:42pm/)
  })
})

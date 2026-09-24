import { describe, expect, it } from "vitest"
import { TaskType, type Folder, type List, type Task, type WeeklyTask } from "./types"
import { applyAutoFlag, doneNextActionCount, effectiveListLink, effectiveSleepLink, presetSleepLink, sleepEndMeets, sleepHabitDayKey } from "./habit-connections"

const yesNo = (name: string): WeeklyTask => ({
  id: "h",
  name,
  type: TaskType.BOOLEAN,
  frequency: "daily",
})

describe("sleep clock preset", () => {
  it("reads bedtime before 11pm and wake before 9", () => {
    expect(presetSleepLink(yesNo("'bedtime' before 11 (with caveats)"))).toEqual({ end: "bed", beforeMinutes: -60 })
    expect(presetSleepLink(yesNo("wake up before 9"))).toEqual({ end: "wake", beforeMinutes: 9 * 60 })
    expect(effectiveSleepLink({ ...yesNo("wake up before 9"), sleepLink: null })).toBeNull()
  })

  it("meets an earlier clock and skips an all-nighter", () => {
    const bed = { end: "bed" as const, beforeMinutes: -60 }
    expect(sleepEndMeets(bed, { sleptMin: -90 })).toBe(true)
    expect(sleepEndMeets(bed, { sleptMin: -60 })).toBe(true)
    expect(sleepEndMeets(bed, { sleptMin: -30 })).toBe(false)
    expect(sleepEndMeets(bed, { allNighter: true, sleptMin: -90 })).toBe(false)
    expect(sleepHabitDayKey("2026-09-24", "bed")).toBe("2026-09-23")
    expect(sleepHabitDayKey("2026-09-24", "wake")).toBe("2026-09-24")
  })
})

describe("to-do list connection", () => {
  const lists: List[] = [{ id: "todo", name: "To Do", color: "#888", createdAt: new Date("2026-01-01") }]
  const folders: Folder[] = [
    { id: "na", name: "Next Actions", createdAt: new Date("2026-01-01"), listIds: ["todo"] },
  ]
  const done: Task = {
    id: "t1",
    title: "File the form",
    description: "File the form",
    stage: "completed",
    completed: true,
    completedDate: new Date(2026, 8, 23, 15, 0, 0),
    lists: ["todo"],
    createdAt: new Date("2026-09-01"),
  }

  it("presets complete-1-to-do and counts a done next action that day", () => {
    expect(effectiveListLink(yesNo("complete 1 to-do list item"))).toEqual({ listName: "to do", count: 1 })
    expect(effectiveListLink({ ...yesNo("complete 1 to-do list item"), listLink: null })).toBeNull()
    expect(doneNextActionCount([done], lists, folders, "to do", "2026-09-23")).toBe(1)
    expect(doneNextActionCount([done], lists, folders, "to do", "2026-09-22")).toBe(0)
  })

  it("keeps a hand tick when the log does not qualify", () => {
    expect(applyAutoFlag({ completed: true }, "sleepCompleted", false)).toBeNull()
    expect(applyAutoFlag(undefined, "listCompleted", true)).toEqual({ completed: true, listCompleted: true })
    expect(applyAutoFlag({ completed: true, listCompleted: true }, "listCompleted", false)?.completed).toBe(false)
  })
})

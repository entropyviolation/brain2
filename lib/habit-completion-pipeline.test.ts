import { describe, expect, it } from "vitest"
import { COMPLETION_SOURCE_LABELS } from "./habit-completion-trust"
import {
  describeListPipelinePreview,
  effectiveHabitCount,
  listPeriodMeasure,
  flattenPipelines,
  listRoutingFromLink,
  pipelinesFromSources,
  resolveListPipeline,
  storedListSentFields,
} from "./habit-completion-pipeline"
import type { WeeklyTask } from "./types"
import { TaskType } from "./types"

describe("completion pipelines", () => {
  it("names the keywords source BIM Keywords", () => {
    expect(COMPLETION_SOURCE_LABELS.keywords).toBe("BIM Keywords")
  })

  it("resolves the texts habit to its list, sent-this-week, and grace 100", () => {
    const habit: WeeklyTask = {
      id: "task-1790202730072",
      name: "respond to all missing texts",
      type: TaskType.GOAL,
      goal: 100,
      frequency: "weekly",
      completionSources: ["manual", "listSent"],
      listSentLink: { listId: "1791346611510", grace: 100 },
    }
    expect(resolveListPipeline(habit)).toEqual({
      listId: "1791346611510",
      mode: "sent-this-week",
      grace: 100,
    })
    expect(listRoutingFromLink(habit.listSentLink)).toEqual({ measure: "sent", target: "periodSet" })
    expect(storedListSentFields(habit.listSentLink)).toEqual({})
  })

  it("keeps minute tags and the tag count as separate rows", () => {
    const rows = pipelinesFromSources(["tags", "taggedTasks"])
    expect(rows.map((row) => row.kind)).toEqual(["trackingTags", "tags"])
    expect(flattenPipelines(rows)).toEqual(["tags", "taggedTasks"])
  })

  it("previews unsent names and this week's sent count", () => {
    const now = new Date(2026, 9, 7, 12, 0, 0)
    const preview = describeListPipelinePreview(
      [
        { title: "ada", lists: ["1791346611510"] },
        { title: "bea", lists: ["1791346611510"] },
        { title: "cio", lists: ["1791346611510"], sentAtByList: { "1791346611510": now.toISOString() } },
      ],
      "1791346611510",
      "sentThisWeek",
      "weekly",
      now,
    )
    expect(preview.summary).toBe("1 of 3")
    expect(preview.names).toEqual(["ada", "bea"])
  })

  it("reads list length as the target and the counted items as current", () => {
    const now = new Date(2026, 9, 9, 12, 0, 0)
    const items = [
      { title: "Ruggles", lists: ["texts"], sentAtByList: { texts: now.toISOString() } },
      { title: "Rebecca", lists: ["texts"] },
      { title: "Cammy", lists: ["texts"] },
      { title: "An", lists: ["texts"] },
      { title: "Fifth", lists: ["texts"] },
    ]
    const habit: WeeklyTask = {
      id: "texts",
      name: "respond to all missing texts",
      type: TaskType.GOAL,
      goal: 100,
      frequency: "weekly",
      completionSources: ["manual", "listSent"],
      listSentLink: { listId: "texts", grace: 100, measure: "sent", target: "listLength" },
    }
    expect(effectiveHabitCount(habit, undefined, items, now)).toEqual({
      current: 1,
      target: 5,
      derived: true,
    })
    expect(effectiveHabitCount({ ...habit, goal: 100, listSentLink: { listId: "texts", grace: 100 } }, undefined, items, now).derived).toBe(
      false,
    )
  })

  it("freezes a finished week's length and counts only sends inside that week", () => {
    const clock = new Date(2026, 9, 9, 15, 0, 0)
    const finishedWeek = new Date(2026, 8, 30, 12, 0, 0)
    const earlierWeek = new Date(2026, 8, 23, 12, 0, 0)
    const openWeek = new Date(2026, 9, 7, 12, 0, 0)
    const early = new Date(2026, 8, 1, 12, 0, 0).toISOString()
    const items = [
      { title: "a", lists: ["texts"], createdAt: early },
      { title: "b", lists: ["texts"], createdAt: early },
      { title: "c", lists: ["texts"], createdAt: early },
      {
        title: "sent",
        lists: ["texts"],
        createdAt: early,
        sentAtByList: { texts: new Date(2026, 8, 30, 12, 0, 0).toISOString() },
      },
      { title: "joined-that-week", lists: ["texts"], createdAt: new Date(2026, 8, 29, 12, 0, 0).toISOString() },
      { title: "joined-later", lists: ["texts"], createdAt: new Date(2026, 9, 6, 12, 0, 0).toISOString() },
    ]
    const habit = {
      frequency: "weekly" as const,
      listSentLink: { listId: "texts", grace: 100, measure: "sent" as const, target: "listLength" as const },
    }
    expect(listPeriodMeasure(habit, items, finishedWeek, clock)).toEqual({
      listLength: 5,
      sentInSpan: 1,
      leftToSend: 4,
      frozen: true,
    })
    const earlier = listPeriodMeasure(habit, items, earlierWeek, clock)
    expect(earlier?.frozen).toBe(true)
    expect(earlier?.sentInSpan).toBe(0)
    expect(earlier?.listLength).not.toBe(5)
    expect(`${earlier?.sentInSpan}/${earlier?.listLength}`).not.toBe("1/5")
    const open = listPeriodMeasure(habit, items, openWeek, clock)
    expect(open).toMatchObject({ frozen: false, listLength: 6, sentInSpan: 0, leftToSend: 6 })
    expect(
      listPeriodMeasure(
        { ...habit, listSentLink: { ...habit.listSentLink, target: "periodSet" } },
        items,
        finishedWeek,
        clock,
      ),
    ).toMatchObject({ listLength: 5, sentInSpan: 1, leftToSend: 4, frozen: true })
  })
})

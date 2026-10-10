import { describe, expect, it } from "vitest"
import { COMPLETION_SOURCE_LABELS } from "./habit-completion-trust"
import {
  describeListPipelinePreview,
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
})

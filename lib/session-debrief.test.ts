/**
 * lib/session-debrief.test.ts — the sheet after Working on now stops
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { Task, TimeEntry } from "@/lib/types"
import type { PenColorSession } from "@/lib/pen-color-session-store"
import { handoffsFor, latestReviewFor, useSessionDebriefStore } from "@/lib/session-debrief-store"
import { buildPenDraft, saveSessionDebrief } from "@/lib/session-debrief"

const AT = new Date(2026, 9, 15, 9, 14, 0)
const END = new Date(2026, 9, 15, 9, 47, 0)

function task(): Task {
  return {
    id: "cds",
    description: "Finish CDs",
    stage: "scheduled",
    createdAt: AT,
    completed: false,
    lists: [],
    estimatedDuration: 40,
    subtasks: [
      { id: "insert", description: "insert", completed: false, estimatedDuration: 20 },
      { id: "photos", description: "find photos", completed: false, estimatedDuration: 10 },
    ],
    timeLogs: [
      {
        id: "tl1",
        date: "2026-10-15",
        startTime: "09:14",
        endTime: "09:47",
        durationMinutes: 33,
        notes: "added from Working On Now, task: Finish CDs subtasks completed: none objectives completed: none",
        taskId: "cds",
        stepId: "insert",
        entryIds: ["e1"],
      },
    ],
  }
}

function session(): PenColorSession {
  return {
    penId: "act-exercise",
    scopeId: "activity",
    title: "Exercise",
    startedAt: AT.toISOString(),
    trackingEntryIds: ["e1"],
    taskId: "cds",
    stepId: "insert",
    nowObjectives: [
      {
        id: "o1",
        text: "find photos",
        addedAt: new Date(2026, 9, 15, 9, 20).toISOString(),
        completedAt: new Date(2026, 9, 15, 9, 28).toISOString(),
        workedMs: 8 * 60_000,
        stepId: "photos",
      },
    ],
  }
}

beforeEach(() => {
  resetAllStores()
})

describe("sitting review", () => {
  it("shows the clock step, the objective stint, and the estimates", () => {
    const draft = buildPenDraft(session(), END, task(), { name: "Exercise", color: "#22c55e" })
    expect(draft.activeMinutes).toBe(33)
    expect(draft.taskTitle).toBe("Finish CDs")
    expect(draft.path).toContain("insert")
    const insert = draft.steps.find((step) => step.stepId === "insert")
    const photos = draft.steps.find((step) => step.stepId === "photos")
    expect(insert).toMatchObject({ estimated: 20, sittingMinutes: 33, completed: false })
    expect(insert?.when).toBeTruthy()
    expect(photos).toMatchObject({ estimated: 10, sittingMinutes: 8, completed: false })
    expect(draft.objectives[0]).toMatchObject({ text: "find photos", completed: true, minutes: 8 })
  })

  it("saves the session reflection and a note for next time, and does not complete the task", () => {
    const row = task()
    useTaskStore.getState().setTasks([row])
    useTimeTrackingStore.setState({
      entries: [
        {
          id: "e1",
          date: "2026-10-15",
          scopeId: "activity",
          penId: "act-exercise",
          startMin: 9 * 60 + 14,
          endMin: 9 * 60 + 47,
          notes: "kept by hand",
        } as TimeEntry,
      ],
    })
    const draft = buildPenDraft(session(), END, row, { name: "Exercise", color: "#22c55e" })
    saveSessionDebrief(draft, {
      note: "the sleeve was the slow part",
      handoff: "start at the photos",
      handoffTask: true,
      handoffPen: true,
      satisfaction: 4,
      energy: "steady",
      blocker: "the drawer stuck",
      taskEstimate: 40,
      logMinutes: 30,
      steps: [
        { stepId: "insert", completed: false, estimated: 25 },
        { stepId: "photos", completed: true, estimated: 10 },
        // completed: true is ignored. Stop must not finish the step.
      ],
    })

    const saved = useTaskStore.getState().tasks.find((item) => item.id === "cds")
    const photos = saved?.subtasks?.find((step) => step.id === "photos")
    const insert = saved?.subtasks?.find((step) => step.id === "insert")
    expect(saved?.completed).toBe(false)
    expect(photos?.completed).toBe(false)
    expect(insert?.estimatedDuration).toBe(25)
    expect(saved?.timeLogs?.[0]).toMatchObject({
      durationMinutes: 30,
      notes: "the sleeve was the slow part",
      sessionReview: { satisfaction: 4, energy: "steady", blocker: "the drawer stuck", handoff: "start at the photos" },
    })
    expect(useTimeTrackingStore.getState().entries.find((entry) => entry.id === "e1")?.notes).toBe("kept by hand")
    const notes = handoffsFor(useSessionDebriefStore.getState().handoffs, { taskId: "cds", penId: "act-exercise" })
    expect(notes).toHaveLength(1)
    expect(notes[0].text).toBe("start at the photos")
    expect(useSessionDebriefStore.getState().reviews[0]).toMatchObject({ satisfaction: 4, energy: "steady", taskId: "cds" })
    expect(latestReviewFor(useSessionDebriefStore.getState().reviews, { taskId: "cds" })?.note).toBe("the sleeve was the slow part")
  })

  it("replaces the previous note for the same task", () => {
    useSessionDebriefStore.getState().leaveHandoff({ text: "old", taskId: "cds", at: AT.toISOString() })
    useSessionDebriefStore.getState().leaveHandoff({ text: "new", taskId: "cds", at: END.toISOString() })
    const notes = handoffsFor(useSessionDebriefStore.getState().handoffs, { taskId: "cds" })
    expect(notes.map((note) => note.text)).toEqual(["new"])
  })
})

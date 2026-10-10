import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { isEstimated } from "@/lib/estimated-values"
import {
  createHeaderPlan,
  derivedDurationGap,
  insertUnplanned,
  recordPlanFollowed,
  recordPlanSkipped,
  renameHeaderPlanAction,
} from "@/lib/header-tracking-plan"
import { itemTitle } from "@/lib/item-utils"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { computePlanVsReality } from "@/lib/plan-vs-reality"
import { getPlanBodies, getPlanEntries } from "@/lib/plan-text"
import { useTaskStore } from "@/lib/task-store"

const DAY = "2026-10-09"

describe("header tracking plan", () => {
  beforeEach(() => {
    resetAllStores()
    usePlannedActionStore.setState({ actions: [] })
  })

  it("writes tasks, placements, and a day plan the analytics comparison can read", () => {
    const created = createHeaderPlan({
      date: DAY,
      startMin: 18 * 60,
      startEstimated: true,
      actions: [
        { title: "Dishes", minutes: 20 },
        { title: "Floor", minutes: 15 },
      ],
    })
    expect(created.taskIds).toHaveLength(2)
    const tasks = useTaskStore.getState().tasks.filter((task) => created.taskIds.includes(task.id))
    expect(tasks.map((task) => itemTitle(task))).toEqual(["Dishes", "Floor"])
    expect(tasks[0]?.estimatedDuration).toBe(20)
    expect(tasks[0]?.startCertainty).toBe("estimated")
    expect(tasks[0]?.scheduledTime).toBe("18:00")
    expect(usePlannedActionStore.getState().actions).toHaveLength(2)
    const bodies = getPlanBodies("day", DAY)
    expect(bodies).toContain("Dishes")
    expect(getPlanEntries("day", DAY).some((entry) => entry.text.includes("Dishes"))).toBe(true)
    const comparison = computePlanVsReality("day", DAY, useTaskStore.getState().tasks, [], bodies)
    expect(comparison.hasPlan).toBe(true)
    expect(comparison.plannedTaskCount).toBe(2)
    expect(comparison.plannedMinutes).toBe(35)
    expect(comparison.completedTaskCount).toBe(0)
  })

  it("records an observed follow, an estimated follow, a skip, and an unplanned insert", () => {
    const created = createHeaderPlan({
      date: DAY,
      startMin: 19 * 60,
      startEstimated: false,
      actions: [
        { title: "Dishes", minutes: 20 },
        { title: "Floor", minutes: 15 },
      ],
    })
    recordPlanFollowed({
      taskId: created.taskIds[0],
      date: DAY,
      plannedMinutes: 20,
      actualMinutes: 25,
      durationEstimated: false,
    })
    const followed = useTaskStore.getState().tasks.find((task) => task.id === created.taskIds[0])
    expect(followed?.completed).toBe(true)
    expect(followed?.actualDuration).toBe(25)
    expect(followed?.timeLogs?.[0]?.durationMinutes).toBe(25)
    expect(followed?.durationCertainty).toBe("exact")
    expect(isEstimated(followed?.estimates, "actualDuration")).toBe(false)

    recordPlanFollowed({
      taskId: created.taskIds[1],
      date: DAY,
      plannedMinutes: 15,
      actualMinutes: 10,
      durationEstimated: true,
    })
    const estimated = useTaskStore.getState().tasks.find((task) => task.id === created.taskIds[1])
    expect(estimated?.durationCertainty).toBe("estimated")
    expect(isEstimated(estimated?.estimates, "actualDuration")).toBe(true)
    expect(derivedDurationGap(15, estimated?.actualDuration)).toBe(-5)

    recordPlanSkipped(created.taskIds[1], new Date(), "no-time")
    const skipped = useTaskStore.getState().tasks.find((task) => task.id === created.taskIds[1])
    expect(skipped?.status).toBe("missed")
    expect(skipped?.completed).toBe(false)
    expect(skipped?.missReason).toBe("no-time")

    const extraId = insertUnplanned({ title: "Phone call", date: DAY, minutes: 8, estimated: false })
    const extra = useTaskStore.getState().tasks.find((task) => task.id === extraId)
    expect(itemTitle(extra)).toBe("Phone call")
    expect(extra?.scheduledDate).toBeUndefined()
    expect(extra?.completed).toBe(true)
    expect(extra?.timeLogs?.[0]?.durationMinutes).toBe(8)

    const comparison = computePlanVsReality("day", DAY, useTaskStore.getState().tasks, [], getPlanBodies("day", DAY))
    expect(comparison.plannedTaskCount).toBe(2)
    expect(comparison.completedTaskCount).toBe(1)
  })

  it("renames the item through its title", () => {
    const created = createHeaderPlan({
      date: DAY,
      startMin: 12 * 60,
      startEstimated: false,
      actions: [{ title: "Walk", minutes: 30 }],
    })
    const actionId = created.actionIds[0]
    renameHeaderPlanAction(actionId, "Long walk")
    const task = useTaskStore.getState().tasks.find((item) => item.id === created.taskIds[0])
    expect(itemTitle(task)).toBe("Long walk")
    expect(usePlannedActionStore.getState().actions[0]?.title).toBe("Long walk")
  })
})

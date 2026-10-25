/**
 * Item detail and the task card share `estimatedDuration` and `pointsOverride`.
 * The card's parts rollup is a separate reading. Estimate edits land on `estimateLog`.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EnhancedTaskDetail } from "@/components/ItemDetail/ItemDetailPage"
import { TaskCardStats, type TaskCardStatsData } from "@/components/Home/ToDo/TaskCardStats"
import { resetItemDetailSessionForTests } from "@/components/ItemDetail/useItemDetailUnloadGuard"
import { useTaskStore } from "@/lib/task-store"
import { tierSplit } from "@/lib/tree-math"
import { resetLocalStorage } from "@/tests/test-utils"

const TASK_ID = "finish-cds"

function seed() {
  useTaskStore.getState().addTask({
    id: TASK_ID,
    description: "Finish CDs",
    type: "task",
    stage: "list",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    completed: false,
    lists: [],
    estimatedDuration: 300,
    rewardValue: 800,
    pointsOverride: 5000,
    stepPoints: 100,
  })
}

function statsData(extra: Partial<TaskCardStatsData> = {}): TaskCardStatsData {
  return {
    view: [],
    tierOf: new Map(),
    levels: tierSplit([]),
    est: 325,
    ownEst: 300,
    parts: 325,
    spent: 0,
    periodSpent: 0,
    periodLabel: "day",
    pts: { points: 5000, source: "override" },
    earned: 0,
    pointsVisible: true,
    levelName: "none",
    levelPts: 0,
    onPick: () => {},
    spentOnly: "on this task only",
    spentScope: { taskId: TASK_ID, names: new Map() },
    ...extra,
  }
}

describe("item detail and the task card agree", () => {
  beforeEach(() => {
    resetLocalStorage()
    resetItemDetailSessionForTests()
    useTaskStore.getState().clearAllData()
    seed()
  })

  it("writes the same estimate and on-done points, and keeps the history", async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<EnhancedTaskDetail taskId={TASK_ID} onBack={onBack} />)
    await user.click(screen.getByRole("button", { name: /^Edit$/i }))

    const duration = screen.getByLabelText(/Estimated Duration/i)
    const reward = screen.getByLabelText("Reward Value")
    expect(duration).toHaveValue(300)
    expect(reward).toHaveValue(5000)

    await user.clear(duration)
    await user.type(duration, "240")
    await user.click(screen.getByRole("button", { name: /^Save$/i }))

    const afterDuration = useTaskStore.getState().tasks.find((t) => t.id === TASK_ID)!
    expect(afterDuration.estimatedDuration).toBe(240)
    expect(afterDuration.estimateLog?.map((e) => e.minutes)).toEqual([240])
    expect(afterDuration.pointsOverride).toBe(5000)
    expect(afterDuration.rewardValue).toBe(800)

    await user.click(screen.getByRole("button", { name: /^Edit$/i }))
    await user.clear(screen.getByLabelText("Reward Value"))
    await user.type(screen.getByLabelText("Reward Value"), "420")
    await user.click(screen.getByRole("button", { name: /^Save$/i }))

    const afterPoints = useTaskStore.getState().tasks.find((t) => t.id === TASK_ID)!
    expect(afterPoints.pointsOverride).toBe(420)
    expect(afterPoints.rewardValue).toBe(800)
    expect(afterPoints.stepPoints).toBe(100)

    await user.click(screen.getByRole("button", { name: /^Edit$/i }))
    act(() => {
      const latest = useTaskStore.getState().tasks.find((t) => t.id === TASK_ID)!
      useTaskStore.getState().updateTask({ ...latest, estimatedDuration: 180, pointsOverride: 600 })
    })
    await waitFor(() => {
      expect(screen.getByLabelText(/Estimated Duration/i)).toHaveValue(180)
      expect(screen.getByLabelText("Reward Value")).toHaveValue(600)
    })

    const afterCard = useTaskStore.getState().tasks.find((t) => t.id === TASK_ID)!
    expect(afterCard.estimateLog?.map((e) => e.minutes)).toEqual([240, 180])
    act(() => {
      useTaskStore.getState().updateTask({ ...afterCard, estimatedDuration: 180 })
    })
    expect(useTaskStore.getState().tasks.find((t) => t.id === TASK_ID)!.estimateLog).toHaveLength(2)

    render(<TaskCardStats data={statsData({ ownEst: 180 })} />)
    fireEvent.click(screen.getByRole("button", { name: /Estimate/i }))
    const pop = document.getElementById("tcs-pop-estimate")
    expect(pop).toBeTruthy()
    expect(pop).not.toHaveTextContent("No changes logged yet")
    expect(pop).toHaveTextContent("240m")
    expect(pop).toHaveTextContent("180m")
    expect(pop).toHaveTextContent("History of this estimate")
  })
})

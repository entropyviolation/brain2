/**
 * lib/ingest/apply-habit-trigger.test.ts — Quantity keywords add to the logged total
 */
import { beforeEach, describe, expect, it } from "vitest"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { TaskType } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import { tryApplyHabitTrigger } from "./apply-habit-trigger"

describe("tryApplyHabitTrigger quantity", () => {
  const now = new Date(2026, 9, 5, 12, 0, 0)

  beforeEach(() => {
    resetAllStores()
    useHabitsStore.setState({
      tasks: [
        {
          id: "study",
          name: "Study",
          type: TaskType.GOAL,
          goal: 60,
          unit: "min",
          rewardValue: 10,
          frequency: "daily",
          textTriggers: [{ id: "studied", keyword: "studied", mode: "quantity", unitWords: ["min"] }],
        },
      ],
      weeklyData: {
        [formatLocalDateKey(now)]: {
          study: { value: 40, goal: 60, manualValue: 40 },
        },
      },
    })
  })

  it("adds 20 min onto 40 min and does not replace the running total", () => {
    const result = tryApplyHabitTrigger("studied for 20 min", now)
    expect(result?.status).toBe("ok")
    const cell = useHabitsStore.getState().weeklyData[formatLocalDateKey(now)]?.study
    expect(cell?.value).toBe(60)
    expect(cell?.keywordValue).toBe(20)
    expect(cell?.keywordLogged).toBe(true)
  })
})

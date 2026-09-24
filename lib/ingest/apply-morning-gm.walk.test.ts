/**
 * lib/ingest/apply-morning-gm.walk.test.ts — Habit priorities + six-slot + day plan
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useHabitsStore, getDefaultHabits } from "@/lib/habits-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { useTaskStore } from "@/lib/task-store"
import { getPlanEntries } from "@/lib/plan-text"
import { createScheduledTodoTask } from "@/components/Home/ToDo/todo-utils"
import { ingestIncoming } from "./executor"
import type { IncomingMessage } from "./types"

const NOW = new Date(2026, 8, 23, 9, 0, 0)

function sim(text: string): IncomingMessage {
  return {
    text,
    source: { channel: "simulate", chatId: "test", isGroup: false },
    receivedAt: NOW.toISOString(),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  resetAllStores()
  useHabitsStore.setState({ tasks: getDefaultHabits(), weeklyData: {} })
})

describe("morning gm habit / walk / plan", () => {
  it("stores habit priorities, applies six-slot dash grammar, and stamps day plan from text", () => {
    const trash = createScheduledTodoTask({
      description: "take out trash",
      period: "day",
      date: NOW,
    })
    trash.id = "todo-trash"
    trash.estimatedDuration = 10
    trash.rewardValue = 30
    useTaskStore.getState().addTask(trash)

    let step = ingestIncoming(sim("gm"), NOW)
    // Advance until habit priorities (after to-do add + 3–5 priorities).
    for (let i = 0; i < 24 && step.status === "needs_clarify" && !/daily habits/i.test(step.reply ?? ""); i++) {
      step = ingestIncoming(sim("skip"), NOW)
    }
    expect(step.status).toBe("needs_clarify")
    expect(step.reply).toMatch(/daily habits/i)

    const habits = useHabitsStore.getState().tasks.filter((h) => (h.frequency || "daily") === "daily")
    expect(habits.length).toBeGreaterThanOrEqual(2)
    step = ingestIncoming(sim("1 2"), NOW)
    expect(step.status).toBe("needs_clarify")
    expect(step.reply).toMatch(/Go through to do list/i)
    expect(step.reply).toMatch(/take out trash/i)
    expect(step.reply).toMatch(/A\+ - 40 - 10 0/)

    step = ingestIncoming(sim("A+ - 40 - 10 0"), NOW)
    expect(step.status).toBe("needs_clarify")
    expect(step.reply).toMatch(/Plaintext day plan/i)

    const updated = useTaskStore.getState().tasks.find((t) => t.id === "todo-trash")!
    expect(updated.estimatedDuration).toBe(10)
    expect(updated.rewardValue).toBe(40)
    expect(updated.urgency).toBe(5)
    expect(updated.dayRatings?.[formatLocalDateKey(NOW)]?.importance).toBeUndefined()
    expect(updated.dayRatings?.[formatLocalDateKey(NOW)]?.excitement).toBe(0)
    expect(updated.resistanceReadings).toHaveLength(1)
    expect(updated.resistanceReadings![0].value).toBe(10)

    step = ingestIncoming(sim("write then walk"), NOW)
    expect(step.status).toBe("needs_clarify")
    expect(step.reply).toMatch(/Which apply today/i)

    const dayKey = formatLocalDateKey(NOW)
    const plans = getPlanEntries("day", dayKey)
    expect(plans.some((p) => p.text === "write then walk" && p.stampSuffix === "from text")).toBe(true)

    // circumstances, best-day, gratitude
    for (let i = 0; i < 5 && step.status === "needs_clarify"; i++) {
      step = ingestIncoming(sim("skip"), NOW)
    }
    expect(step.status).toBe("ok")
    const morning = useReviewsStore.getState().getMorningReview(dayKey)
    expect(morning?.priorityHabitIds).toEqual([habits[0]!.id, habits[1]!.id])
    expect(morning?.dayPlanLogged).toBe(true)
    expect(morning?.source).toBe("telegram")
  })
})

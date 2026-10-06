/**
 * lib/ingest/apply-morning-gm.walk.test.ts — Habit priorities + six-slot + day plan
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useHabitsStore, getDefaultHabits } from "@/lib/habits-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { useTaskStore } from "@/lib/task-store"
import { taskIsRequired } from "@/lib/todo-commitment"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
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

    step = ingestIncoming(sim("- 90 200 11 1 0"), NOW)
    expect(step.status).toBe("needs_clarify")
    expect(step.reply).toMatch(/Importance/)
    expect(step.reply).toMatch(/Same item/)
    expect(step.reply).toMatch(/take out trash/i)
    const stolen = ingestIncoming(sim("log: shower"), NOW)
    expect(stolen.status).toBe("needs_clarify")
    expect(stolen.reply).toMatch(/take out trash/i)
    expect(stolen.reply).not.toMatch(/^Logged:/)
    expect(useTimeTrackingStore.getState().entries.some((e) => /shower/i.test(e.title || ""))).toBe(false)

    step = ingestIncoming(sim("- 90 200 6.5 3.5 9"), NOW)
    expect(step.status).toBe("needs_clarify")
    expect(step.reply).toMatch(/Plaintext day plan/i)

    const updated = useTaskStore.getState().tasks.find((t) => t.id === "todo-trash")!
    expect(updated.estimatedDuration).toBe(90)
    expect(updated.rewardValue).toBe(200)
    expect(updated.dayRatings?.[formatLocalDateKey(NOW)]?.importance).toBe(6.5)
    expect(updated.dayRatings?.[formatLocalDateKey(NOW)]?.excitement).toBe(9)
    expect(updated.resistanceReadings).toHaveLength(1)
    expect(updated.resistanceReadings![0].value).toBe(3.5)

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

  it("SKIP ALL leaves the item walk and continues at the day plan", () => {
    const trash = createScheduledTodoTask({ description: "trash", period: "day", date: NOW })
    trash.id = "todo-trash-2"
    useTaskStore.getState().addTask(trash)
    let step = ingestIncoming(sim("gm"), NOW)
    for (let i = 0; i < 24 && step.status === "needs_clarify" && !/Go through to do list/i.test(step.reply ?? ""); i++) {
      step = ingestIncoming(sim("skip"), NOW)
    }
    expect(step.reply).toMatch(/Go through to do list/i)
    step = ingestIncoming(sim("SKIP ALL"), NOW)
    expect(step.status).toBe("needs_clarify")
    expect(step.reply).toMatch(/Plaintext day plan/i)
    expect(useTaskStore.getState().tasks.find((t) => t.id === "todo-trash-2")?.rewardValue).not.toBe(200)
  })

  it("marks required items from a comma-only line and keeps other lines whole", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"]
    ids.forEach((id, i) => {
      const task = createScheduledTodoTask({ description: `item ${i + 1}`, period: "day", date: NOW })
      task.id = `todo-${id}`
      useTaskStore.getState().addTask(task)
    })
    let step = ingestIncoming(sim("gm"), NOW)
    for (let i = 0; i < 24 && step.status === "needs_clarify" && !/comma-separated/i.test(step.reply ?? ""); i++) {
      step = ingestIncoming(sim("skip"), NOW)
    }
    expect(step.reply).toMatch(/comma-separated/i)
    step = ingestIncoming(sim("1, 8\nbuy milk, eggs"), NOW)
    expect(step.reply).toMatch(/highest priorities/i)
    const dayKey = formatLocalDateKey(NOW)
    const tasks = useTaskStore.getState().tasks
    expect(tasks.find((t) => t.id === "todo-a") && taskIsRequired(tasks.find((t) => t.id === "todo-a")!, "day", dayKey)).toBe(true)
    expect(tasks.find((t) => t.id === "todo-h") && taskIsRequired(tasks.find((t) => t.id === "todo-h")!, "day", dayKey)).toBe(true)
    expect(tasks.find((t) => t.id === "todo-b") && taskIsRequired(tasks.find((t) => t.id === "todo-b")!, "day", dayKey)).toBe(false)
    expect(tasks.some((t) => t.description === "buy milk, eggs")).toBe(true)
    expect(tasks.some((t) => t.description === "buy milk")).toBe(false)
  })
})

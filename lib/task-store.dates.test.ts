import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  description: "Task",
  stage: "list",
  createdAt: new Date("2026-06-01T08:30:00.000Z"),
  completed: false,
  lists: [],
  ...overrides,
})

describe("task-store date rehydration", () => {
  beforeEach(() => resetAllStores())

  it("rehydrates persisted date fields as Date instances (not ISO strings)", async () => {
    // Seed a task with real Date instances; persist writes it to localStorage.
    useTaskStore.getState().setTasks([
      task({
        id: "a",
        createdAt: new Date("2026-06-01T08:30:00.000Z"),
        scheduledDate: new Date("2026-06-15T00:00:00.000Z"),
        deadline: new Date("2026-06-20T00:00:00.000Z"),
      }),
    ])

    // Simulate a reload: re-read from localStorage through the persist reviver.
    await useTaskStore.persist.rehydrate()

    const restored = useTaskStore.getState().tasks.find((t) => t.id === "a")
    expect(restored).toBeDefined()
    expect(restored!.createdAt).toBeInstanceOf(Date)
    expect(restored!.scheduledDate).toBeInstanceOf(Date)
    expect(restored!.deadline).toBeInstanceOf(Date)
    // Values must survive the round-trip unchanged.
    expect(restored!.createdAt.toISOString()).toBe("2026-06-01T08:30:00.000Z")
    expect((restored!.scheduledDate as Date).toISOString()).toBe("2026-06-15T00:00:00.000Z")
  })

  it("leaves non-date string fields (e.g. scheduledTime) as strings", async () => {
    useTaskStore.getState().setTasks([
      task({ id: "b", scheduledTime: "14:30", scheduledWeek: "2026-W25" }),
    ])

    await useTaskStore.persist.rehydrate()

    const restored = useTaskStore.getState().tasks.find((t) => t.id === "b")
    expect(restored!.scheduledTime).toBe("14:30")
    expect(restored!.scheduledWeek).toBe("2026-W25")
  })
})

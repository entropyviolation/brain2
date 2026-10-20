import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { fillDemoAround } from "@/lib/demo-day-fill"
import { writeDataProfile } from "@/lib/storage-keys"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useTaskStore } from "@/lib/task-store"

describe("fillDemoAround", () => {
  beforeEach(() => {
    resetAllStores()
    localStorage.clear()
  })

  it("does nothing on Live", () => {
    writeDataProfile("live")
    expect(fillDemoAround(new Date(2026, 9, 20)).days).toBe(0)
  })

  it("fills every log kind on Demo and is idempotent", () => {
    writeDataProfile("demo")
    const first = fillDemoAround(new Date(2026, 9, 20), 3)
    expect(first.days).toBe(7)
    const kinds = new Set(useTimeTrackingStore.getState().entries.map((e) => e.eventKind?.split(".")[0]).filter(Boolean))
    for (const k of ["spend", "intake", "thought-process"]) expect(kinds.has(k)).toBe(true)
    const tasks = useTaskStore.getState().tasks.length
    expect(fillDemoAround(new Date(2026, 9, 20), 3).days).toBe(0)
    expect(useTaskStore.getState().tasks.length).toBe(tasks)
  })
})

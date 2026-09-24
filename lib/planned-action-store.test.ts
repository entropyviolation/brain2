import { beforeEach, describe, expect, it } from "vitest"
import { persistKey } from "./storage-keys"
import { placementFromDragRange, placementFromDrop } from "./planned-actions"
import { usePlannedActionStore } from "./planned-action-store"

describe("planned-action-store", () => {
  beforeEach(() => {
    localStorage.clear()
    usePlannedActionStore.setState({ actions: [] })
  })

  it("upserts a habit drop and keeps notes + time after remount", async () => {
    const created = usePlannedActionStore.getState().upsertSourcePlacement(
      placementFromDrop({
        date: "2026-09-21",
        hour: 9,
        minute: 0,
        durationMinutes: 40,
        source: "habit",
        sourceId: "habit-walk",
        title: "Walk",
        notes: "around the block",
      }),
    )
    expect(created.notes).toBe("around the block")
    expect(created.startTime).toBe("09:00")

    await Promise.resolve()
    const raw = localStorage.getItem(persistKey("planned-actions")) ?? localStorage.getItem("cogs-planned-actions")
    expect(raw).toBeTruthy()

    usePlannedActionStore.setState({ actions: [] })
    // Persist would rewrite the empty in-memory state; put the vault back first.
    if (raw) {
      localStorage.setItem(persistKey("planned-actions"), raw)
      localStorage.setItem("cogs-planned-actions", raw)
    }
    expect(usePlannedActionStore.getState().actions).toHaveLength(0)
    await usePlannedActionStore.persist.rehydrate()

    const restored = usePlannedActionStore.getState().actions[0]
    expect(restored).toMatchObject({
      id: created.id,
      source: "habit",
      sourceId: "habit-walk",
      title: "Walk",
      notes: "around the block",
      startTime: "09:00",
      endTime: "09:40",
      date: "2026-09-21",
    })
  })

  it("drag-create persist remount stays a free action, not an event", async () => {
    const created = usePlannedActionStore.getState().addAction
      ? usePlannedActionStore.getState().upsertSourcePlacement(
          placementFromDragRange({
            date: "2026-09-21",
            startMinutes: 14 * 60,
            endMinutes: 15 * 60,
            title: "Deep work",
            notes: "no meetings",
          }),
        )
      : null
    expect(created?.source).toBe("free")

    await Promise.resolve()
    const raw = localStorage.getItem(persistKey("planned-actions")) ?? localStorage.getItem("cogs-planned-actions")
    usePlannedActionStore.setState({ actions: [] })
    if (raw) {
      localStorage.setItem(persistKey("planned-actions"), raw)
      localStorage.setItem("cogs-planned-actions", raw)
    }
    await usePlannedActionStore.persist.rehydrate()
    const restored = usePlannedActionStore.getState().actions[0]
    expect(restored.source).toBe("free")
    expect(restored.startTime).toBe("14:00")
    expect(restored.endTime).toBe("15:00")
    expect(restored.notes).toBe("no meetings")
    expect(restored).not.toHaveProperty("type")
  })

  it("moves an existing todo placement instead of duplicating", () => {
    const first = usePlannedActionStore.getState().upsertSourcePlacement(
      placementFromDrop({
        date: "2026-09-21",
        hour: 9,
        minute: 0,
        source: "todo",
        sourceId: "task-1",
        title: "Call",
      }),
    )
    const second = usePlannedActionStore.getState().upsertSourcePlacement(
      placementFromDrop({
        date: "2026-09-21",
        hour: 11,
        minute: 0,
        source: "todo",
        sourceId: "task-1",
        title: "Call",
      }),
    )
    expect(second.id).toBe(first.id)
    expect(usePlannedActionStore.getState().actions).toHaveLength(1)
    expect(second.startTime).toBe("11:00")
  })
})

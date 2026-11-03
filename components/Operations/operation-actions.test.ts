import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import {
  getOperationCategories,
  getOperationPreset,
  OPERATION_ATTR,
  OPERATION_TYPE_ID,
  resolveOperationPanels,
  sortOperationPanelIds,
} from "@/lib/operation-types"
import type { Task } from "@/lib/types"
import { applyOperationPreset, createOperation } from "./operation-actions"

const createdAt = new Date("2026-06-01T12:00:00")

function operation(partial: Partial<Task> = {}): Task {
  const description = partial.description ?? "Foxtide"
  return {
    id: partial.id ?? "op-1",
    title: partial.title ?? description,
    description,
    type: OPERATION_TYPE_ID,
    stage: partial.stage ?? "clarified",
    createdAt: partial.createdAt ?? createdAt,
    completed: partial.completed ?? false,
    lists: partial.lists ?? [],
    tags: partial.tags ?? [],
    links: partial.links ?? [],
    subtasks: partial.subtasks ?? [],
    rewardValue: partial.rewardValue ?? 0,
    attributes: {
      [OPERATION_ATTR.stage]: "active",
      [OPERATION_ATTR.categories]: ["foxtide job"],
    },
    ...partial,
  }
}

describe("operation presets", () => {
  beforeEach(() => resetAllStores())

  it("adds a preset's categories and leaves categories the preset does not mention", () => {
    const seed = operation()
    useTaskStore.setState({ tasks: [seed], lists: [], folders: [] })

    applyOperationPreset(seed.id, "job")
    const paid = useTaskStore.getState().tasks.find((row) => row.id === seed.id)!
    expect(getOperationCategories(paid)).toEqual(["foxtide job", "paid"])
    expect(resolveOperationPanels(paid)).toEqual(sortOperationPanelIds(getOperationPreset("job")!.panels))
    expect(paid.attributes?.[OPERATION_ATTR.stage]).toBe("active")

    applyOperationPreset(seed.id, "blank")
    const blank = useTaskStore.getState().tasks.find((row) => row.id === seed.id)!
    expect(getOperationCategories(blank)).toEqual(["foxtide job", "paid"])
    expect(resolveOperationPanels(blank)).toEqual(["home"])

    applyOperationPreset(seed.id, "nope")
    expect(useTaskStore.getState().tasks.find((row) => row.id === seed.id)).toBe(blank)
  })

  it("uses the preset's categories unless the caller passes its own", () => {
    const named = createOperation("Kiln job", { presetId: "trip", categories: ["paid"] })
    expect(named.description).toBe("Kiln job")
    expect(named.type).toBe(OPERATION_TYPE_ID)
    expect(getOperationCategories(named)).toEqual(["paid"])
    expect(resolveOperationPanels(named)).toEqual(sortOperationPanelIds(getOperationPreset("trip")!.panels))

    const suggested = createOperation("Iceland", { presetId: "trip" })
    expect(getOperationCategories(suggested)).toEqual(["trip"])

    const cleared = createOperation("Bare", { presetId: "trip", categories: [] })
    expect(getOperationCategories(cleared)).toEqual([])

    const untitled = createOperation("  ", { presetId: "blank" })
    expect(untitled.description).toBe("New operation")
    expect(resolveOperationPanels(untitled)).toEqual(["home"])
  })
})

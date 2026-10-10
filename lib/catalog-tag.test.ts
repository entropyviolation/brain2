/**
 * lib/catalog-tag.test.ts — One catalog, two ways of pointing at it
 */
import { beforeEach, describe, expect, it } from "vitest"
import { undoLastAction } from "@/lib/action-history"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TaskType, type Task, type WeeklyTask } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import {
  commitCatalogTagEdit,
  retargetTagIds,
  retargetTagNameList,
  retargetTaggedTaskTag,
} from "./catalog-tag"

const habit = (patch: Partial<WeeklyTask> = {}): WeeklyTask => ({
  id: "study",
  name: "Study",
  type: TaskType.GOAL,
  goal: 3,
  rewardValue: 10,
  frequency: "daily",
  taggedTaskTag: "work",
  trackingLink: { tagIds: ["tag-work", "tag-exercise"], unit: "minutes", mode: "add", enabled: true },
  completionSources: ["manual", "taggedTasks", "tags"],
  ...patch,
})

const item = (patch: Partial<Task> = {}): Task => ({
  id: "note",
  description: "shipped the page",
  lists: [],
  stage: "list",
  completed: true,
  createdAt: new Date("2026-10-10T12:00:00"),
  urgency: 1,
  importance: 1,
  tags: ["work"],
  attributes: { trackingTagIds: ["tag-work"] },
  ...patch,
})

describe("catalog tag names and ids", () => {
  it("keeps a count name and moves ids only when asked", () => {
    expect(retargetTaggedTaskTag("Work", "work", "labor")).toBe("labor")
    expect(retargetTaggedTaskTag("picnic", "work", "labor")).toBe("picnic")
    expect(retargetTaggedTaskTag("work", "work", "work")).toBe("work")
    expect(retargetTagNameList(["work", "rest"], "work", "labor")).toEqual(["labor", "rest"])
    expect(retargetTagNameList(["labor", "work"], "work", "labor")).toEqual(["labor"])
    expect(retargetTagIds(["tag-work", "tag-exercise"], "tag-work", "tag-focus")).toEqual(["tag-focus", "tag-exercise"])
    expect(retargetTagIds(["tag-exercise"], "tag-work", "tag-focus")).toEqual(["tag-exercise"])
  })
})

describe("commitCatalogTagEdit", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("renames and recolors the same id, and follows the count name", () => {
    useHabitsStore.getState().setTasks([habit(), habit({ id: "picnic", name: "Picnic", taggedTaskTag: "picnic", trackingLink: undefined })])
    useTaskStore.getState().setTasks([item()])
    const work = useTimeTrackingStore.getState().tags.find((tag) => tag.id === "tag-work")!
    const edited = commitCatalogTagEdit(work, { name: "Labor", color: "#112233" })

    expect(edited?.replacedId).toBeUndefined()
    expect(edited?.tag.id).toBe("tag-work")
    expect(useTimeTrackingStore.getState().tags.find((tag) => tag.id === "tag-work")).toMatchObject({
      name: "Labor",
      color: "#112233",
    })
    const tasks = useHabitsStore.getState().tasks
    expect(tasks.find((row) => row.id === "study")?.taggedTaskTag).toBe("labor")
    expect(tasks.find((row) => row.id === "study")?.trackingLink?.tagIds).toEqual(["tag-work", "tag-exercise"])
    expect(tasks.find((row) => row.id === "picnic")?.taggedTaskTag).toBe("picnic")
    expect(useTaskStore.getState().tasks.find((row) => row.id === "note")?.tags).toEqual(["labor"])
    const pen = useTimeTrackingStore.getState().scopes.flatMap((scope) => scope.pens).find((row) => row.id === "act-work")
    expect(pen?.tags).toContain("tag-work")
  })

  it("folds a name collision onto the tag that already has the color and the name", () => {
    const focusId = useTimeTrackingStore.getState().addTag("Focus", "#abcabc")
    useHabitsStore.getState().setTasks([habit()])
    useTaskStore.getState().setTasks([item()])
    useTimeTrackingStore.setState({
      entries: [
        {
          id: "block-1",
          date: "2026-10-10",
          scopeId: "activity",
          penId: "act-work",
          startMin: 60,
          endMin: 120,
          tagIds: ["tag-work"],
        },
      ],
    })
    const work = useTimeTrackingStore.getState().tags.find((tag) => tag.id === "tag-work")!
    const edited = commitCatalogTagEdit(work, { name: "Focus", color: "#000000" })

    expect(edited?.replacedId).toBe("tag-work")
    expect(edited?.tag).toMatchObject({ id: focusId, color: "#abcabc" })
    expect(useTimeTrackingStore.getState().tags.some((tag) => tag.id === "tag-work")).toBe(false)
    const study = useHabitsStore.getState().tasks.find((row) => row.id === "study")
    expect(study?.taggedTaskTag).toBe("focus")
    expect(study?.trackingLink?.tagIds).toEqual([focusId, "tag-exercise"])
    expect(useTaskStore.getState().tasks[0]?.tags).toEqual(["focus"])
    expect(useTaskStore.getState().tasks[0]?.attributes?.trackingTagIds).toEqual([focusId])
    const pen = useTimeTrackingStore.getState().scopes.flatMap((scope) => scope.pens).find((row) => row.id === "act-work")
    expect(pen?.tags).toContain(focusId)
    expect(pen?.tags).not.toContain("tag-work")
    expect(useTimeTrackingStore.getState().entries[0]?.tagIds).toEqual([focusId])
  })

  it("undo restores the catalog name, the count name, and the item tag", () => {
    useHabitsStore.getState().setTasks([habit({ taggedTaskTag: "sleep", trackingLink: { tagIds: ["tag-sleep"], enabled: true } })])
    useTaskStore.getState().setTasks([item({ tags: ["sleep"], attributes: { trackingTagIds: ["tag-sleep"] } })])
    const sleep = useTimeTrackingStore.getState().tags.find((tag) => tag.id === "tag-sleep")!
    commitCatalogTagEdit(sleep, { name: "Night", color: sleep.color })
    expect(useHabitsStore.getState().tasks[0]?.taggedTaskTag).toBe("night")

    expect(undoLastAction()).toBe(true)
    expect(useTimeTrackingStore.getState().tags.find((tag) => tag.id === "tag-sleep")?.name).toBe("Sleep")
    expect(useHabitsStore.getState().tasks[0]?.taggedTaskTag).toBe("sleep")
    expect(useTaskStore.getState().tasks[0]?.tags).toEqual(["sleep"])
  })
})

describe("removeTag scrub and create dedupe", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("strips the id from pens, entries, habit minute-links, and operations; keeps count names", () => {
    useHabitsStore.getState().setTasks([habit()])
    useTaskStore.getState().setTasks([item()])
    useTimeTrackingStore.setState({
      entries: [
        {
          id: "block-1",
          date: "2026-10-10",
          scopeId: "activity",
          penId: "act-work",
          startMin: 60,
          endMin: 120,
          tagIds: ["tag-work", "tag-exercise"],
        },
      ],
    })
    const pen = useTimeTrackingStore.getState().scopes.flatMap((scope) => scope.pens).find((row) => row.id === "act-work")
    expect(pen?.tags).toContain("tag-work")

    useTimeTrackingStore.getState().removeTag("tag-work")

    expect(useTimeTrackingStore.getState().tags.some((tag) => tag.id === "tag-work")).toBe(false)
    const afterPen = useTimeTrackingStore.getState().scopes.flatMap((scope) => scope.pens).find((row) => row.id === "act-work")
    expect(afterPen?.tags).not.toContain("tag-work")
    expect(useTimeTrackingStore.getState().entries[0]?.tagIds).toEqual(["tag-exercise"])
    const study = useHabitsStore.getState().tasks.find((row) => row.id === "study")
    expect(study?.trackingLink?.tagIds).toEqual(["tag-exercise"])
    expect(study?.taggedTaskTag).toBe("work")
    expect(useTaskStore.getState().tasks[0]?.attributes?.trackingTagIds).toEqual([])
    expect(useTaskStore.getState().tasks[0]?.tags).toEqual(["work"])
  })

  it("treats collapsed spaces as the same tag on create", () => {
    const first = useTimeTrackingStore.getState().addTag("Deep work")
    const second = useTimeTrackingStore.getState().addTag("deep  work")
    expect(second).toBe(first)
    expect(useTimeTrackingStore.getState().tags.filter((tag) => tag.id === first)).toHaveLength(1)
  })
})

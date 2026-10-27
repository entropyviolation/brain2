import { beforeEach, describe, expect, it } from "vitest"
import type { NowObjective } from "./now-objective"
import type { Task } from "./types"
import { useItemTypeStore } from "./item-type-store"
import { useTaskStore } from "./task-store"
import {
  OBJECTIVES_ITEM_TYPE_ID,
  createTaskForObjective,
  fileObjectivesOnTask,
  homeForObjective,
  mergeResumed,
  resumeParked,
  sameUnfinishedHome,
  taskAttachChoices,
  toParked,
  type ParkedObjective,
} from "./unfinished-objectives"

const AT = new Date(2026, 9, 10, 8, 0, 0)

const row: NowObjective = {
  id: "n1",
  text: "finish the nest",
  addedAt: "2026-10-03T15:00:00.000Z",
  workedMs: 0,
  stintStartedAt: AT.toISOString(),
}

describe("unfinished objectives", () => {
  it("parks without the open stint and resumes with the original created time", () => {
    const home = homeForObjective(row, { taskId: "task-1", stepId: "step-1" })
    expect(home).toEqual({ kind: "step", taskId: "task-1", stepId: "step-1" })
    const parked = toParked(row, home!)
    expect(parked?.workedMs).toBe(0)
    expect(parked?.addedAt).toBe(row.addedAt)

    const later = new Date(AT.getTime() + 7 * 24 * 60 * 60_000)
    const resumed = resumeParked(parked!, later)
    expect(resumed.addedAt).toBe(row.addedAt)
    expect(resumed.lane).toBe("next")
    expect(resumed.stintStartedAt).toBeUndefined()
    expect(resumed.workedMs).toBe(0)
    expect(resumed.completedAt).toBeUndefined()
  })

  it("does not resume an id already on the list", () => {
    const parked: ParkedObjective = {
      id: "n1",
      text: "finish the nest",
      addedAt: row.addedAt,
      workedMs: 3_600_000,
      home: { kind: "pen", scopeId: "activity", penId: "act-work" },
    }
    expect(mergeResumed([row], [parked], AT)).toEqual([row])
    const resumed = mergeResumed(undefined, [parked], AT)
    expect(resumed).toHaveLength(1)
    expect(resumed?.[0]).toMatchObject({ lane: "next", workedMs: 3_600_000 })
    expect(resumed?.[0].stintStartedAt).toBeUndefined()
  })

  it("treats an attached task as its own home", () => {
    const attached = homeForObjective({ ...row, taskId: "other" }, { taskId: "clock", stepId: "step" })
    const clock = homeForObjective(row, { taskId: "clock", stepId: "step" })
    expect(sameUnfinishedHome(attached!, clock!)).toBe(false)
    expect(attached).toEqual({ kind: "task", taskId: "other" })
  })
})

function task(id: string, title: string, type: Task["type"] = "task"): Task {
  return {
    id,
    title,
    description: title,
    type,
    stage: "clarified",
    createdAt: new Date(0),
    completed: false,
    lists: [],
  }
}

const woodDef = { id: "wood", name: "Wood", type: "text" as const, createdAt: "2026-01-01T00:00:00.000Z" }

/** A task the way the vault actually stores one, so filing has something to keep. */
function parentTask(patch: Partial<Task> = {}): Task {
  return {
    id: "nest",
    title: "Build the nest",
    description: "Build the nest",
    type: "task",
    stage: "clarified",
    createdAt: new Date(0),
    completed: false,
    lists: ["woodshop"],
    attributes: { wood: "maple" },
    rewardValue: 4,
    estimatedDuration: 90,
    cognitiveLoad: 2,
    urgency: 3,
    importance: 4,
    context: "@shop",
    entropy: 0.4,
    allowPartialCompletion: true,
    minimumChunkSize: 15,
    tags: ["build"],
    links: [{ id: "link-1", relation: "needs", targetId: "lumber" }],
    subtasks: [{ id: "s1", description: "Cut", completed: false }],
    itemAttributeDefinitions: [woodDef],
    ...patch,
  }
}

function expectParentKept(nest: Task | undefined) {
  expect(nest).toMatchObject({
    lists: ["woodshop"],
    rewardValue: 4,
    estimatedDuration: 90,
    cognitiveLoad: 2,
    urgency: 3,
    importance: 4,
    context: "@shop",
    entropy: 0.4,
    allowPartialCompletion: true,
    minimumChunkSize: 15,
    tags: ["build"],
    links: [{ id: "link-1", relation: "needs", targetId: "lumber" }],
    subtasks: [{ id: "s1", description: "Cut", completed: false }],
  })
  expect(nest?.attributes?.wood).toBe("maple")
  expect(nest?.itemAttributeDefinitions?.find((def) => def.id === "wood")).toEqual(woodDef)
}

describe("attach objectives to a task", () => {
  beforeEach(() => {
    useItemTypeStore.getState().resetTypes()
    useTaskStore.setState({ tasks: [], lists: [] })
  })

  it("searches every task and skips steps and other item types", () => {
    const choices = taskAttachChoices([
      task("b", "Bake"),
      { ...task("done", "Finished tray"), completed: true },
      task("loose", "Loose ends"),
      { ...task("linked", "Linked"), penLinks: [{ scopeId: "activity", penId: "act-exercise" }] },
      task("book", "Novel", "book"),
      task("step-item", "Cut the tray", "step"),
      { ...task("a", "Arrange"), subtasks: [{ id: "s1", description: "Cut", completed: false }] },
    ])
    expect(choices.map((choice) => choice.label)).toEqual([
      "Arrange",
      "Bake",
      "Finished tray",
      "Linked",
      "Loose ends",
    ])
    expect(choices.map((choice) => choice.taskId)).toEqual(["a", "b", "done", "linked", "loose"])
    expect(choices.every((choice) => !choice.stepId)).toBe(true)
  })

  it("files every attached objective on an Objectives list attribute", () => {
    useTaskStore.setState({ tasks: [parentTask()], lists: [] })
    fileObjectivesOnTask("nest", [
      { id: "o1", text: "cut the tray" },
      { id: "blank", text: "  " },
      { id: "o2", text: "sand the edge" },
    ])
    fileObjectivesOnTask("nest", [
      { id: "o1", text: "cut the tray deeper" },
      { id: "o2", text: "sand the edge" },
    ])

    const named = useItemTypeStore.getState().types.filter((item) => item.name === "Objectives")
    expect(named).toHaveLength(1)
    expect(named[0]?.id).toBe(OBJECTIVES_ITEM_TYPE_ID)
    const nest = useTaskStore.getState().tasks.find((item) => item.id === "nest")
    expectParentKept(nest)
    const def = nest?.itemAttributeDefinitions?.find((item) => item.name === "Objectives")
    expect(def).toMatchObject({ id: "objectives", type: "list", refListId: "objectives-for-nest" })
    expect(nest?.itemAttributeDefinitions?.map((item) => item.id)).toEqual(["wood", "objectives"])
    const listId = nest?.attributes?.[def!.id]
    expect(listId).toBe("objectives-for-nest")
    const list = useTaskStore.getState().lists.find((item) => item.id === listId)
    expect(list?.itemTypeId).toBe(OBJECTIVES_ITEM_TYPE_ID)
    const items = useTaskStore.getState().tasks.filter((item) => item.id.startsWith("objective-item-"))
    expect(items).toHaveLength(2)
    expect(items.find((item) => item.id === "objective-item-o1")).toMatchObject({
      title: "cut the tray deeper",
      description: "cut the tray deeper",
      type: OBJECTIVES_ITEM_TYPE_ID,
      rewardValue: 1,
    })
    expect(items.every((item) => item.rewardValue === 1)).toBe(true)
    expect(items.every((item) => item.type === OBJECTIVES_ITEM_TYPE_ID)).toBe(true)
    expect(items.every((item) => item.lists?.includes(String(listId)))).toBe(true)
    expect(items.map((item) => item.title).sort()).toEqual(["cut the tray deeper", "sand the edge"])
  })

  it("reuses an item type already named Objectives", () => {
    useItemTypeStore.getState().addType({
      id: "workshop-objectives",
      name: "Objectives",
      pluralName: "Objectives",
      itemLabel: "objective",
      attributes: [],
      capabilities: {},
    })
    useTaskStore.setState({ tasks: [parentTask()], lists: [] })
    fileObjectivesOnTask("nest", [{ id: "o1", text: "cut the tray" }])

    const named = useItemTypeStore.getState().types.filter((item) => item.name.trim().toLowerCase() === "objectives")
    expect(named.map((item) => item.id)).toEqual(["workshop-objectives"])
    const filed = useTaskStore.getState().tasks.find((item) => item.id === "objective-item-o1")
    expect(filed?.type).toBe("workshop-objectives")
    expect(filed?.rewardValue).toBe(1)
  })

  it("reuses a list the task already points at with an Objectives attribute", () => {
    useTaskStore.setState({
      tasks: [
        parentTask({
          attributes: { wood: "maple", "shop-goals": "shop-goals" },
          itemAttributeDefinitions: [
            woodDef,
            { id: "shop-goals", name: "Objectives", type: "list", refListId: "shop-goals" },
          ],
        }),
      ],
      lists: [
        {
          id: "shop-goals",
          name: "Shop goals",
          color: "#3d6b58",
          createdAt: new Date(0),
          itemTypeId: "task",
        },
      ],
    })
    fileObjectivesOnTask("nest", [{ id: "o1", text: "cut the tray" }])

    expect(useTaskStore.getState().lists.map((list) => list.id)).toEqual(["shop-goals"])
    const nest = useTaskStore.getState().tasks.find((item) => item.id === "nest")
    expect(nest?.attributes?.["shop-goals"]).toBe("shop-goals")
    const filed = useTaskStore.getState().tasks.find((item) => item.id === "objective-item-o1")
    expect(filed?.lists).toEqual(["shop-goals"])
    expect(useTaskStore.getState().lists[0]?.itemTypeId).toBe("task")
  })

  it("does nothing for blank text, an empty list, or a missing task id", () => {
    useTaskStore.setState({ tasks: [parentTask()], lists: [] })
    const typeCount = useItemTypeStore.getState().types.length
    fileObjectivesOnTask("nest", [{ id: "o1", text: "   " }])
    fileObjectivesOnTask("nest", [])
    fileObjectivesOnTask("", [{ id: "o1", text: "cut the tray" }])

    expect(useItemTypeStore.getState().types).toHaveLength(typeCount)
    expect(useItemTypeStore.getState().types.some((item) => item.name === "Objectives")).toBe(false)
    expect(useTaskStore.getState().lists).toEqual([])
    expect(useTaskStore.getState().tasks).toHaveLength(1)
    expect(useTaskStore.getState().tasks[0]?.itemAttributeDefinitions).toEqual([woodDef])
  })

  it("names the list attribute task-objectives when objectives is already taken", () => {
    const grain = { id: "objectives", name: "Grain", type: "text" as const }
    useTaskStore.setState({
      tasks: [parentTask({ itemAttributeDefinitions: [woodDef, grain] })],
      lists: [],
    })
    fileObjectivesOnTask("nest", [{ id: "o1", text: "cut the tray" }])

    const nest = useTaskStore.getState().tasks.find((item) => item.id === "nest")
    expect(nest?.itemAttributeDefinitions?.find((def) => def.id === "objectives")).toEqual(grain)
    expect(nest?.itemAttributeDefinitions?.find((def) => def.name === "Objectives")).toMatchObject({
      id: "task-objectives",
      type: "list",
      refListId: "objectives-for-nest",
    })
    expect(nest?.attributes?.["task-objectives"]).toBe("objectives-for-nest")
    expect(nest?.attributes?.wood).toBe("maple")
  })

  it("sets itemTypeId on an existing objectives list that has none", () => {
    useTaskStore.setState({
      tasks: [parentTask()],
      lists: [
        {
          id: "objectives-for-nest",
          name: "Build the nest Objectives",
          color: "#3d6b58",
          createdAt: new Date(0),
        },
      ],
    })
    fileObjectivesOnTask("nest", [{ id: "o1", text: "cut the tray" }])

    const lists = useTaskStore.getState().lists
    expect(lists).toHaveLength(1)
    expect(lists[0]?.itemTypeId).toBe(OBJECTIVES_ITEM_TYPE_ID)
    expect(lists[0]?.itemTypeIds).toEqual([OBJECTIVES_ITEM_TYPE_ID])
  })

  it("creates a task with reward and empty relations, without scheduling defaults", () => {
    const id = createTaskForObjective("  sand the edge  ", { scopeId: "activity", penId: "act-work" })
    expect(id).toBeTruthy()
    const made = useTaskStore.getState().tasks.find((item) => item.id === id)
    expect(made).toMatchObject({
      id,
      title: "sand the edge",
      description: "sand the edge",
      type: "task",
      stage: "clarified",
      completed: false,
      lists: [],
      tags: [],
      links: [],
      subtasks: [],
      rewardValue: 1,
      penLinks: [{ scopeId: "activity", penId: "act-work" }],
    })
    expect(made?.createdAt).toBeInstanceOf(Date)
    for (const key of [
      "estimatedDuration",
      "urgency",
      "importance",
      "cognitiveLoad",
      "context",
      "entropy",
      "allowPartialCompletion",
      "minimumChunkSize",
    ] as const) {
      expect(made).not.toHaveProperty(key)
    }
  })
})

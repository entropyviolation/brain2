import { describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import { workingNowBannerFor } from "@/lib/working-now-banner"

function task(partial: Pick<Task, "id"> & Partial<Task>): Task {
  return {
    description: partial.id,
    stage: "list",
    createdAt: new Date("2026-10-24"),
    completed: false,
    lists: [],
    ...partial,
  }
}

const desk = task({
  id: "desk",
  description: "Desk",
  subtasks: [
    {
      id: "build",
      description: "Build the box",
      completed: false,
      subtasks: [
        { id: "paint", description: "Paint the lid", completed: false },
        { id: "sand", description: "Sand the lid", completed: false },
      ],
    },
    { id: "legs", description: "Turn the legs", completed: false },
  ],
})

const buildItem = task({
  id: "build-item",
  description: "Build the box",
  parentTaskId: "desk",
  stepOf: { taskId: "desk", stepId: "build" },
})

const paintItem = task({
  id: "paint-item",
  description: "Paint the lid",
  parentTaskId: "desk",
  stepOf: { taskId: "desk", stepId: "paint" },
})

const sandItem = task({
  id: "sand-item",
  description: "Sand the lid",
  parentTaskId: "desk",
  stepOf: { taskId: "desk", stepId: "sand" },
})

const room = task({ id: "room", description: "Room", parentTaskId: undefined })
const house = task({ id: "house", description: "House" })
const unrelated = task({ id: "other", description: "Other" })

const tasks = [
  { ...desk, parentTaskId: "room" },
  buildItem,
  paintItem,
  sandItem,
  { ...room, parentTaskId: "house" },
  house,
  unrelated,
]

describe("workingNowBannerFor", () => {
  it("shows on the clock task and stays off a child, a sibling, and an unrelated item", () => {
    const session = { taskId: "desk" }
    expect(workingNowBannerFor("desk", tasks, session)).toEqual({ live: true, liveTitle: "Desk" })
    expect(workingNowBannerFor("room", tasks, session)).toEqual({ live: false, liveTitle: "Desk" })
    expect(workingNowBannerFor("house", tasks, session)).toEqual({ live: false, liveTitle: "Desk" })
    expect(workingNowBannerFor("paint-item", tasks, session)).toBeNull()
    expect(workingNowBannerFor("other", tasks, session)).toBeNull()
    expect(workingNowBannerFor("desk", tasks, null)).toBeNull()
  })

  it("shows on a live step item and its ancestors, and stays off a sibling step", () => {
    const session = { taskId: "desk", stepId: "paint" }
    expect(workingNowBannerFor("paint-item", tasks, session)).toEqual({ live: true, liveTitle: "Paint the lid" })
    expect(workingNowBannerFor("build-item", tasks, session)).toEqual({ live: false, liveTitle: "Paint the lid" })
    expect(workingNowBannerFor("desk", tasks, session)).toEqual({ live: false, liveTitle: "Paint the lid" })
    expect(workingNowBannerFor("room", tasks, session)).toEqual({ live: false, liveTitle: "Paint the lid" })
    expect(workingNowBannerFor("sand-item", tasks, session)).toBeNull()
    expect(workingNowBannerFor("other", tasks, session)).toBeNull()
  })

  it("treats the task as live when the step has no item of its own", () => {
    const bare = tasks.filter((row) => row.id !== "paint-item")
    const session = { taskId: "desk", stepId: "paint" }
    expect(workingNowBannerFor("desk", bare, session)).toEqual({ live: true, liveTitle: "Desk" })
    expect(workingNowBannerFor("build-item", bare, session)).toBeNull()
    expect(workingNowBannerFor("room", bare, session)).toEqual({ live: false, liveTitle: "Desk" })
  })
})

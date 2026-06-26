import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { LocalDataSource } from "@/lib/data/sources/local-data-source"
import { DataSourceError } from "@/lib/data/data-source"
import type { Task } from "@/lib/types"

const ds = new LocalDataSource()

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  description: "Task",
  stage: "list",
  createdAt: new Date(),
  completed: false,
  lists: [],
  ...overrides,
})

describe("LocalDataSource", () => {
  beforeEach(() => resetAllStores())

  it("round-trips tasks through the async interface", async () => {
    await ds.addTask(task({ id: "a" }))
    await ds.addTask(task({ id: "b" }))
    expect((await ds.getTasks()).map((t) => t.id).sort()).toEqual(["a", "b"])
    expect((await ds.getTaskById("a"))?.id).toBe("a")
    expect(await ds.getTaskById("missing")).toBeUndefined()
  })

  it("updates and removes tasks", async () => {
    await ds.addTask(task({ id: "a", description: "old" }))
    await ds.updateTask(task({ id: "a", description: "new" }))
    expect((await ds.getTaskById("a"))?.description).toBe("new")
    await ds.removeTask("a")
    expect(await ds.getTaskById("a")).toBeUndefined()
  })

  it("filters tasks via findTasks", async () => {
    await ds.addTask(task({ id: "a", completed: true }))
    await ds.addTask(task({ id: "b", completed: false }))
    expect((await ds.findTasks((t) => !t.completed)).map((t) => t.id)).toEqual(["b"])
  })

  it("queries by tag case/whitespace-insensitively", async () => {
    await ds.addTask(task({ id: "a", tags: ["Urgent", "home"] }))
    await ds.addTask(task({ id: "b", tags: ["urgent"] }))
    expect((await ds.tasksByTag(" URGENT ")).map((t) => t.id).sort()).toEqual(["a", "b"])
  })

  it("adds and removes typed links (dedup + self-link guard)", async () => {
    await ds.addTask(task({ id: "a" }))
    await ds.addTask(task({ id: "b" }))
    await ds.addLink("a", "blocks", "b")
    await ds.addLink("a", "blocks", "b") // duplicate
    let source = await ds.getTaskById("a")
    expect(source?.links).toHaveLength(1)

    await ds.addLink("a", "blocks", "a") // self-link rejected
    source = await ds.getTaskById("a")
    expect(source?.links).toHaveLength(1)

    const linkId = source!.links![0].id
    await ds.removeLink("a", linkId)
    expect((await ds.getTaskById("a"))?.links).toHaveLength(0)
  })

  it("surfaces invalid writes as a typed error", async () => {
    await expect(ds.addTask(task({ id: "" }))).rejects.toThrow()
  })

  it("round-trips reviews and plan text", async () => {
    await ds.saveReview({
      id: "day:2026-01-01",
      period: "day",
      periodKey: "2026-01-01",
      completedAt: new Date(),
      summary: "ok",
      gratitude: [],
      nextPlans: "",
      reflections: {},
      resolvedTaskIds: [],
      pushedTaskIds: [],
    })
    expect((await ds.getReview("day", "2026-01-01"))?.summary).toBe("ok")

    await ds.savePlanText({ period: "day", periodKey: "2026-01-01", text: "plan!" })
    expect(await ds.getPlanText("day", "2026-01-01")).toBe("plan!")
  })

  it("appends points ledger entries", async () => {
    await ds.addPoints({ date: "2026-01-01", taskId: "a", points: 10, taskDescription: "Task" })
    const points = await ds.getPoints()
    expect(points).toHaveLength(1)
    expect(points[0].points).toBe(10)
  })

  it("runs a transaction inline with a non-atomic handle", async () => {
    const result = await ds.transaction(async (tx) => {
      expect(tx.atomic).toBe(false)
      await ds.addTask(task({ id: "x" }))
      return "done"
    })
    expect(result).toBe("done")
    expect(await ds.getTaskById("x")).toBeDefined()
  })

  it("exports DataSourceError for transport-level failures", () => {
    expect(new DataSourceError("x").name).toBe("DataSourceError")
  })
})

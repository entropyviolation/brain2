/**
 * Integration: tags + typed links across repository → store selectors → search.
 *
 * Exercises the data-access layer (`taskRepository`), the live Zustand store
 * selectors (`getByTag`/`getLinkedItems`/`getBacklinks`), and the pure search
 * layer (`searchItems`) together — a write through the repository must be
 * observable through every read surface that sits on top of the store.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { taskRepository } from "@/lib/data/task-repository"
import { useTaskStore } from "@/lib/task-store"
import { searchItems } from "@/lib/search"
import type { Task } from "@/lib/types"

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  description: "Task",
  stage: "list",
  createdAt: new Date("2026-06-01T00:00:00"),
  completed: false,
  lists: [],
  ...overrides,
})

describe("integration: tags + links + search", () => {
  beforeEach(() => resetAllStores())

  it("tags written via the repository are queryable through the store and search", () => {
    taskRepository.add(task({ id: "a", description: "Write proposal", tags: ["Urgent", "work"] }))
    taskRepository.add(task({ id: "b", description: "Review proposal", tags: ["urgent"] }))
    taskRepository.add(task({ id: "c", description: "Buy milk", tags: ["home"] }))

    const store = useTaskStore.getState()

    // byTag is case/whitespace-insensitive and goes through the store selector.
    expect(store.getByTag(" URGENT ").map((t) => t.id).sort()).toEqual(["a", "b"])
    expect(taskRepository.byTag("home").map((t) => t.id)).toEqual(["c"])

    // The same data is discoverable through the pure search layer.
    const byTag = searchItems("urgent", taskRepository.getAll())
    expect(byTag.map((r) => r.item.id).sort()).toEqual(["a", "b"])
    expect(byTag.every((r) => r.matchedOn.includes("tag"))).toBe(true)

    // Title/description matches outrank tag-only matches.
    const byText = searchItems("proposal", taskRepository.getAll())
    expect(byText.map((r) => r.item.id).sort()).toEqual(["a", "b"])
    expect(byText[0].matchedOn).toContain("title")
  })

  it("typed links round-trip through repository writes and store selectors", () => {
    taskRepository.add(task({ id: "a", description: "Ship feature" }))
    taskRepository.add(task({ id: "b", description: "Write docs" }))
    taskRepository.add(task({ id: "c", description: "Plan launch" }))

    taskRepository.addLink("a", "blocks", "b")
    taskRepository.addLink("a", "supports", "c")

    const store = useTaskStore.getState()

    // Forward links resolve through getLinkedItems (optionally filtered).
    expect(store.getLinkedItems("a").map((t) => t.id).sort()).toEqual(["b", "c"])
    expect(store.getLinkedItems("a", "blocks").map((t) => t.id)).toEqual(["b"])

    // Backlinks are computed by scanning who points at the target.
    expect(store.getBacklinks("b").map((t) => t.id)).toEqual(["a"])
    expect(store.getBacklinks("c", "supports").map((t) => t.id)).toEqual(["a"])
    expect(store.getBacklinks("c", "blocks")).toHaveLength(0)
  })

  it("removing a link removes it from backlinks", () => {
    taskRepository.add(task({ id: "a" }))
    taskRepository.add(task({ id: "b" }))
    taskRepository.addLink("a", "blocks", "b")

    const store = () => useTaskStore.getState()
    expect(store().getBacklinks("b").map((t) => t.id)).toEqual(["a"])

    const linkId = taskRepository.getById("a")!.links![0].id
    taskRepository.removeLink("a", linkId)

    expect(taskRepository.getById("a")?.links ?? []).toHaveLength(0)
    expect(store().getLinkedItems("a")).toHaveLength(0)
    expect(store().getBacklinks("b")).toHaveLength(0)
  })

  it("deduplicates links and rejects self-links across the stack", () => {
    taskRepository.add(task({ id: "a" }))
    taskRepository.add(task({ id: "b" }))

    taskRepository.addLink("a", "blocks", "b")
    taskRepository.addLink("a", "blocks", "b") // duplicate pair
    taskRepository.addLink("a", "related", "a") // self-link

    expect(taskRepository.getById("a")?.links).toHaveLength(1)
    expect(useTaskStore.getState().getLinkedItems("a").map((t) => t.id)).toEqual(["b"])
  })
})

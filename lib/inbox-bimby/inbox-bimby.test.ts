import { describe, expect, it } from "vitest"
import type { List, Task } from "@/lib/types"
import { applyFile, applyMerge, mergePlan } from "./apply"
import { buildPool, exactMatches, shortlist } from "./context"
import { cleanHelp, helpTask } from "./suggest"

const at = new Date("2026-11-01T12:00:00Z")
const task = (id: string, extra: Partial<Task>): Task =>
  ({ id, description: "", stage: "list", createdAt: at, completed: false, lists: [], ...extra }) as Task

const lists: List[] = [
  { id: "recipes", name: "Recipes", color: "", createdAt: at },
  { id: "house", name: "House projects", color: "", createdAt: at },
]
const tasks: Task[] = [
  task("t1", { title: "Retile the kitchen backsplash", lists: ["house"] }),
  task("t2", { title: "Miso salmon", lists: ["recipes"] }),
  task("a", { title: "Buy backsplash tile", stage: "inbox" }),
  task("b", { title: "buy backsplash tile!", stage: "inbox" }),
]

describe("Inbox Helper BIMBY", () => {
  it("finds an exact title repeat without a model", () => {
    const m = exactMatches(tasks[2]!, tasks)
    expect(m.map((x) => x.id)).toEqual(["b"])
    expect(m[0]!.where).toBe("inbox")
  })

  it("refs inbox ideas S, filed items I, lists L", () => {
    const top = shortlist(buildPool(tasks[2]!, tasks, lists, "buy backsplash tile"))
    expect(top.find((c) => c.id === "b")?.ref).toBe("S1")
    expect(top.find((c) => c.id === "t1")?.ref).toBe("I1")
    expect(top.find((c) => c.id === "house")?.ref).toMatch(/^L/)
  })

  it("keeps only shortlist refs and drops lists already on the idea", () => {
    const idea = task("n", { title: "tile", stage: "inbox", lists: ["house"] })
    const cands = shortlist(buildPool(idea, tasks, lists, "tile"))
    const house = cands.find((c) => c.id === "house")!.ref
    const out = cleanHelp(
      { files: [{ ref: house, why: "x", sure: 1 }, { ref: "L99", why: "y", sure: 1 }], matches: [{ ref: "I1", relation: "duplicate", why: "I1 is it", sure: 0.8 }], questions: ["What room?"] },
      cands,
      idea,
    )
    expect(out.files).toEqual([])
    expect(out.matches[0]).toMatchObject({ id: "t1", relation: "duplicate" })
    expect(out.matches[0]!.why).toContain("Retile")
    expect(out.questions).toEqual(["What room?"])
  })

  it("answers by rules when no model is there, with the exact repeat first", async () => {
    const r = await helpTask({ task: tasks[2]!, tasks, lists, call: null, ladder: [] })
    expect(r.by).toBe("rules")
    expect(r.matches[0]?.id).toBe("b")
  })

  it("files to a list and leaves the Inbox", () => {
    const next = applyFile(tasks, "a", "house")
    const a = next.find((t) => t.id === "a")!
    expect(a.lists).toEqual(["house"])
    expect(a.stage).not.toBe("inbox")
  })

  it("merges the idea into the item it matches", () => {
    const plan = mergePlan(tasks, lists, "a", "t1")!
    expect(plan.survivorId).toBe("t1")
    expect(plan.discardedIds).toEqual(["a"])
    const next = applyMerge(tasks, plan)
    expect(next.some((t) => t.id === "a")).toBe(false)
    expect(next.some((t) => t.id === "t1")).toBe(true)
  })
})

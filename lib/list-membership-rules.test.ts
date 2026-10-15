import { beforeEach, describe, expect, it } from "vitest"
import type { List, Task } from "@/lib/types"
import {
  applyMembershipRulesToTask,
  applyMembershipRulesToTasks,
  previewMembershipRules,
  ruleMatches,
} from "@/lib/list-membership-rules"
import { useTaskStore } from "@/lib/task-store"
import { resetAllStores } from "@/tests/test-utils"

const NOW = new Date("2026-10-12T15:00:00")
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000)

const list = (partial: Partial<List> & Pick<List, "id">): List => ({
  name: partial.id,
  color: "#000",
  createdAt: new Date("2026-01-01"),
  ...partial,
})
const task = (partial: Partial<Task> & Pick<Task, "id">): Task => ({
  description: partial.id,
  stage: "list",
  createdAt: new Date("2026-01-01"),
  completed: false,
  lists: [],
  ...partial,
})

const books = list({
  id: "books",
  membershipRules: [{ id: "r1", match: "all", conditions: [{ kind: "type", typeIds: ["book"] }] }],
})
const dueSoon = list({
  id: "due-soon",
  membershipRulesSync: true,
  membershipRules: [
    { id: "r2", match: "all", conditions: [{ kind: "dateWithin", field: "deadline", direction: "next", days: 7 }] },
  ],
})

describe("ruleMatches", () => {
  it("never matches an empty or disabled rule", () => {
    const t = task({ id: "a", type: "book" })
    expect(ruleMatches(t, { id: "x", match: "all", conditions: [] }, NOW, "l")).toBe(false)
    expect(ruleMatches(t, { id: "x", enabled: false, match: "all", conditions: [{ kind: "type", typeIds: ["book"] }] }, NOW, "l")).toBe(false)
  })

  it("reads due within N days from today, overdue only when asked", () => {
    const rule = dueSoon.membershipRules![0]
    expect(ruleMatches(task({ id: "a", deadline: days(3) }), rule, NOW, "due-soon")).toBe(true)
    expect(ruleMatches(task({ id: "b", deadline: days(9) }), rule, NOW, "due-soon")).toBe(false)
    expect(ruleMatches(task({ id: "c", deadline: days(-2) }), rule, NOW, "due-soon")).toBe(false)
    const withOverdue = { ...rule, conditions: [{ kind: "dateWithin" as const, field: "deadline" as const, direction: "next" as const, days: 7, includeOverdue: true }] }
    expect(ruleMatches(task({ id: "c", deadline: days(-2) }), withOverdue, NOW, "due-soon")).toBe(true)
  })

  it("checks other-list membership, attributes, tags, and done", () => {
    const t = task({ id: "a", lists: ["wanted"], tags: ["Gift"], attributes: { pages: 320, genre: "Sci-fi" }, completed: true })
    const check = (c: Parameters<typeof ruleMatches>[1]["conditions"][number]) =>
      ruleMatches(t, { id: "x", match: "all", conditions: [c] }, NOW, "self")
    expect(check({ kind: "onLists", listIds: ["wanted"], mode: "any" })).toBe(true)
    expect(check({ kind: "onLists", listIds: ["wanted"], mode: "none" })).toBe(false)
    expect(check({ kind: "attribute", attributeId: "pages", op: "gt", value: 300 })).toBe(true)
    expect(check({ kind: "attribute", attributeId: "genre", op: "is", value: "sci-fi" })).toBe(true)
    expect(check({ kind: "attribute", attributeId: "isbn", op: "isEmpty" })).toBe(true)
    expect(check({ kind: "tag", tags: ["gift"], mode: "any" })).toBe(true)
    expect(check({ kind: "done", done: false })).toBe(false)
  })
})

describe("applyMembershipRulesToTask", () => {
  it("adds matching items and remembers that a rule added them", () => {
    const next = applyMembershipRulesToTask(task({ id: "a", type: "book", lists: ["wanted"] }), [books], NOW)
    expect(next.lists).toEqual(["wanted", "books"])
    expect(next.listRuleAddedIds).toEqual(["books"])
  })

  it("leaves items alone when nothing matches, returning the same object", () => {
    const t = task({ id: "a", type: "film" })
    expect(applyMembershipRulesToTask(t, [books], NOW)).toBe(t)
  })

  it("never re-adds a list the person removed the item from", () => {
    const t = task({ id: "a", type: "book", listMembershipExclusions: ["books"] })
    expect(applyMembershipRulesToTask(t, [books], NOW).lists).toEqual([])
  })

  it("with sync, removes only items a rule added", () => {
    const ruled = task({ id: "a", deadline: days(20), lists: ["due-soon"], listRuleAddedIds: ["due-soon"] })
    const manual = task({ id: "b", deadline: days(20), lists: ["due-soon"] })
    const out = applyMembershipRulesToTasks([ruled, manual], [dueSoon], NOW)
    expect(out[0].lists).toEqual([])
    expect(out[0].listRuleAddedIds).toBeUndefined()
    expect(out[1]).toBe(manual)
  })

  it("without sync, items stay after they stop matching", () => {
    const sticky = { ...dueSoon, membershipRulesSync: false }
    const t = task({ id: "a", deadline: days(20), lists: ["due-soon"], listRuleAddedIds: ["due-soon"] })
    expect(applyMembershipRulesToTask(t, [sticky], NOW).lists).toEqual(["due-soon"])
  })

  it("previews what draft rules would pick up", () => {
    const tasks = [task({ id: "a", type: "book" }), task({ id: "b", type: "book", lists: ["books"] }), task({ id: "c", type: "film" })]
    const p = previewMembershipRules(books, tasks, NOW)
    expect(p.matching.map((t) => t.id)).toEqual(["a", "b"])
    expect(p.alreadyOn).toBe(1)
    expect(p.willJoin).toBe(1)
  })
})

describe("task store", () => {
  beforeEach(() => resetAllStores())

  it("fills a list when its rules are saved, and new items join on create", () => {
    const store = useTaskStore.getState()
    store.setLists([list({ id: "books" })])
    store.setTasks([task({ id: "dune", type: "book" }), task({ id: "heat", type: "film" })])
    store.updateList(books)
    const byId = () => Object.fromEntries(useTaskStore.getState().tasks.map((t) => [t.id, t.lists]))
    expect(byId().dune).toEqual(["books"])
    expect(byId().heat).toEqual([])
    store.addTask(task({ id: "piranesi", type: "book" }))
    expect(byId().piranesi).toEqual(["books"])
  })

  it("respects a manual removal of a rule-added item", () => {
    const store = useTaskStore.getState()
    store.setLists([books])
    store.setTasks([task({ id: "dune", type: "book" })])
    store.applyListMembershipRules(NOW)
    const dune = useTaskStore.getState().tasks[0]
    expect(dune.lists).toEqual(["books"])
    store.updateTask({ ...dune, lists: [] })
    store.applyListMembershipRules(NOW)
    expect(useTaskStore.getState().tasks[0].lists).toEqual([])
    expect(useTaskStore.getState().tasks[0].listMembershipExclusions).toContain("books")
  })
})

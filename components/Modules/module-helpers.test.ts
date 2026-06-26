import { describe, it, expect } from "vitest"
import {
  ruleMatches,
  tasksInList,
  randN,
  MODULE_VIEW_KINDS,
  MODULE_VIEW_KIND_META,
} from "./module-helpers"
import type { AttrRule, ModuleViewKind } from "@/lib/modules-store"
import type { Task } from "@/lib/types"

const rule = (overrides: Partial<AttrRule>): AttrRule => ({
  id: "r",
  attrId: "a",
  op: ">",
  value: "",
  label: "Flag",
  color: "#fff",
  ...overrides,
})

const task = (overrides: Partial<Task>): Task => ({
  id: "t",
  description: "Task",
  stage: "list",
  createdAt: new Date(),
  completed: false,
  lists: [],
  ...overrides,
})

describe("ruleMatches", () => {
  it("handles presence operators", () => {
    expect(ruleMatches(rule({ op: "is set" }), "x")).toBe(true)
    expect(ruleMatches(rule({ op: "is set" }), "")).toBe(false)
    expect(ruleMatches(rule({ op: "is empty" }), null)).toBe(true)
    expect(ruleMatches(rule({ op: "is empty" }), [])).toBe(true)
  })

  it("handles string operators", () => {
    expect(ruleMatches(rule({ op: "contains", value: "AB" }), "xabz")).toBe(true)
    expect(ruleMatches(rule({ op: "=", value: "5" }), "5")).toBe(true)
    expect(ruleMatches(rule({ op: "=", value: "5" }), 5)).toBe(true)
  })

  it("handles numeric operators including goal values", () => {
    expect(ruleMatches(rule({ op: ">", value: "3" }), 5)).toBe(true)
    expect(ruleMatches(rule({ op: "<=", value: "3" }), 3)).toBe(true)
    expect(ruleMatches(rule({ op: ">", value: "3" }), { current: 5, target: 10 })).toBe(true)
    expect(ruleMatches(rule({ op: ">", value: "x" }), 5)).toBe(false)
  })
})

describe("tasksInList", () => {
  it("returns all tasks when no category given", () => {
    const tasks = [task({ id: "a" }), task({ id: "b" })]
    expect(tasksInList(tasks)).toHaveLength(2)
  })

  it("filters by category membership", () => {
    const tasks = [task({ id: "a", lists: ["x"] }), task({ id: "b", lists: ["y"] })]
    expect(tasksInList(tasks, "x").map((t) => t.id)).toEqual(["a"])
  })
})

describe("MODULE_VIEW_KINDS", () => {
  it("registers the specialized Workstream E view kinds", () => {
    const kinds = MODULE_VIEW_KINDS.map((m) => m.kind)
    for (const k of ["matcher", "quiz", "dashboard", "timeline"] as ModuleViewKind[]) {
      expect(kinds).toContain(k)
    }
  })

  it("keeps the existing kinds registered (additive, no removals)", () => {
    const kinds = MODULE_VIEW_KINDS.map((m) => m.kind)
    for (const k of [
      "spreadsheet",
      "checklist",
      "agenda",
      "summary",
      "randomizer",
      "timer",
      "stat",
      "gallery",
      "notes",
      "decision-matrix",
      "kanban",
    ] as ModuleViewKind[]) {
      expect(kinds).toContain(k)
    }
  })

  it("every kind has a label, icon, and lookup entry", () => {
    for (const m of MODULE_VIEW_KINDS) {
      expect(m.label.length).toBeGreaterThan(0)
      expect(m.icon).toBeTruthy()
      expect(MODULE_VIEW_KIND_META[m.kind]).toBe(m)
    }
  })

  it("dashboard and timer/stat/notes do not require a source list", () => {
    expect(MODULE_VIEW_KIND_META.dashboard.needsList).toBe(false)
    expect(MODULE_VIEW_KIND_META.timeline.needsList).toBe(true)
    expect(MODULE_VIEW_KIND_META.matcher.needsList).toBe(true)
  })
})

describe("randN", () => {
  it("returns at most n elements, all from the source", () => {
    const source = [1, 2, 3, 4, 5]
    const picked = randN(source, 3)
    expect(picked).toHaveLength(3)
    picked.forEach((p) => expect(source).toContain(p))
  })

  it("handles edge cases", () => {
    expect(randN([], 3)).toEqual([])
    expect(randN([1, 2], 5)).toHaveLength(2)
    expect(randN([1, 2], 0)).toEqual([])
  })
})

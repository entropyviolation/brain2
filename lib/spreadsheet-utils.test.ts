import { describe, it, expect } from "vitest"
import {
  aggregateColumn,
  aggregateIncluded,
  aggregateWhere,
  formatNumber,
  groupKeyFor,
  isCurrencyAttribute,
  isIncluded,
  isNumericAttribute,
  rollup,
  sumBy,
  sumIncluded,
  toNumber,
} from "./spreadsheet-utils"
import type { AttributeDefinition, Task } from "@/lib/types"

const def = (overrides: Partial<AttributeDefinition>): AttributeDefinition => ({
  id: "a",
  name: "A",
  type: "number",
  ...overrides,
})

const task = (attributes: Record<string, unknown>): Task => ({
  id: `t-${Math.random()}`,
  description: "Task",
  stage: "list",
  createdAt: new Date(),
  completed: false,
  lists: [],
  attributes: attributes as Task["attributes"],
})

describe("toNumber", () => {
  it("parses numbers, numeric strings, currency strings, and goals", () => {
    expect(toNumber(5)).toBe(5)
    expect(toNumber("12")).toBe(12)
    expect(toNumber("$1,200.50")).toBe(1200.5)
    expect(toNumber({ current: 3, target: 10 })).toBe(3)
    expect(toNumber("")).toBeNull()
    expect(toNumber("abc")).toBeNull()
  })
})

describe("attribute classification", () => {
  it("detects numeric and currency attributes", () => {
    expect(isNumericAttribute(def({ type: "number" }))).toBe(true)
    expect(isNumericAttribute(def({ type: "goal" }))).toBe(true)
    expect(isNumericAttribute(def({ type: "string" }))).toBe(false)
    expect(isCurrencyAttribute(def({ type: "number", unit: "$" }))).toBe(true)
    expect(isCurrencyAttribute(def({ type: "number", unit: "min" }))).toBe(false)
  })
})

describe("aggregateColumn / sumBy", () => {
  it("sums numeric cells and ignores empties", () => {
    const d = def({ id: "cost", type: "number" })
    const tasks = [task({ cost: 10 }), task({ cost: 5 }), task({ cost: "" }), task({})]
    const agg = aggregateColumn(tasks, d)
    expect(agg.sum).toBe(15)
    expect(agg.numeric).toBe(2)
    expect(agg.avg).toBe(7.5)
    expect(agg.min).toBe(5)
    expect(agg.max).toBe(10)
    expect(sumBy(tasks, d)).toBe(15)
  })
})

describe("formatNumber", () => {
  it("formats currency and units", () => {
    expect(formatNumber(1200.5, def({ type: "number", unit: "$" }))).toBe("$1,200.50")
    expect(formatNumber(30, def({ type: "number", unit: "min" }))).toBe("30 min")
    expect(formatNumber(42)).toBe("42")
  })
})

describe("groupKeyFor", () => {
  it("produces stable keys", () => {
    expect(groupKeyFor(true)).toBe("Yes")
    expect(groupKeyFor(false)).toBe("No")
    expect(groupKeyFor("")).toBe("—")
    expect(groupKeyFor(["a", "b"])).toBe("a, b")
    expect(groupKeyFor("Food")).toBe("Food")
  })
})

describe("rollup", () => {
  it("groups by an attribute and sums a value", () => {
    const group = def({ id: "booked", type: "boolean" })
    const value = def({ id: "cost", type: "number", unit: "$" })
    const tasks = [
      task({ booked: true, cost: 100 }),
      task({ booked: true, cost: 50 }),
      task({ booked: false, cost: 200 }),
    ]
    const rows = rollup(tasks, group, value)
    expect(rows).toHaveLength(2)
    // Sorted by descending sum: unbooked (200) before booked (150).
    expect(rows[0]).toMatchObject({ key: "No", count: 1, sum: 200 })
    expect(rows[1]).toMatchObject({ key: "Yes", count: 2, sum: 150 })
  })

  it("counts when no value attribute is given", () => {
    const group = def({ id: "room", type: "selection" })
    const tasks = [task({ room: "Kitchen" }), task({ room: "Kitchen" }), task({ room: "Bedroom" })]
    const rows = rollup(tasks, group)
    expect(rows[0]).toMatchObject({ key: "Kitchen", count: 2 })
  })
})

describe("isIncluded", () => {
  it("treats truthy flags as included and blanks as excluded", () => {
    expect(isIncluded(task({ inc: true }), "inc")).toBe(true)
    expect(isIncluded(task({ inc: false }), "inc")).toBe(false)
    expect(isIncluded(task({ inc: "yes" }), "inc")).toBe(true)
    expect(isIncluded(task({ inc: "1" }), "inc")).toBe(true)
    expect(isIncluded(task({ inc: 0 }), "inc")).toBe(false)
    expect(isIncluded(task({ inc: 3 }), "inc")).toBe(true)
    expect(isIncluded(task({}), "inc")).toBe(false)
  })

  it("includes every row when no include column is given", () => {
    expect(isIncluded(task({}), undefined)).toBe(true)
  })
})

describe("conditional rollups", () => {
  const cost = def({ id: "cost", type: "number", unit: "$" })
  const tasks = [
    task({ cost: 100, include: true }),
    task({ cost: 50, include: false }),
    task({ cost: 20, include: true }),
    task({ cost: 5 }),
  ]

  it("sums only rows flagged for inclusion", () => {
    expect(sumIncluded(tasks, cost, "include")).toBe(120)
    const agg = aggregateIncluded(tasks, cost, "include")
    expect(agg.sum).toBe(120)
    expect(agg.numeric).toBe(2)
    expect(agg.max).toBe(100)
    expect(agg.min).toBe(20)
  })

  it("falls back to summing everything without an include column", () => {
    expect(sumIncluded(tasks, cost)).toBe(175)
  })

  it("aggregateWhere honors an arbitrary predicate", () => {
    const agg = aggregateWhere(tasks, cost, (t) => (t.attributes?.cost as number) >= 50)
    expect(agg.sum).toBe(150)
    expect(agg.numeric).toBe(2)
  })
})

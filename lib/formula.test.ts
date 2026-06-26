import { describe, it, expect } from "vitest"
import {
  evaluateFormula,
  extractReferences,
  isValidFormula,
  isFormulaDef,
  coerceToNumber,
  computeFormulaValue,
  formatFormulaValue,
} from "./formula"
import type { AttributeDefinition, AttributeValue } from "@/lib/types"

const def = (overrides: Partial<AttributeDefinition>): AttributeDefinition => ({
  id: "out",
  name: "Out",
  type: "formula",
  ...overrides,
})

/** Resolver from a plain numeric map (missing keys → blank/null). */
const fromMap = (map: Record<string, number | null>) => (id: string) => (id in map ? map[id] : null)

describe("evaluateFormula — literals & arithmetic", () => {
  it("evaluates basic arithmetic with precedence", () => {
    expect(evaluateFormula("1 + 2 * 3", fromMap({}))).toEqual({ value: 7 })
    expect(evaluateFormula("(1 + 2) * 3", fromMap({}))).toEqual({ value: 9 })
    expect(evaluateFormula("10 / 4", fromMap({}))).toEqual({ value: 2.5 })
    expect(evaluateFormula("2 - 5", fromMap({}))).toEqual({ value: -3 })
  })

  it("supports a leading '=' and whitespace", () => {
    expect(evaluateFormula("= 3 + 4", fromMap({}))).toEqual({ value: 7 })
    expect(evaluateFormula("   =  6 ", fromMap({}))).toEqual({ value: 6 })
  })

  it("handles unary minus, nested parens and decimals", () => {
    expect(evaluateFormula("-3 + 5", fromMap({}))).toEqual({ value: 2 })
    expect(evaluateFormula("-(2 + 3) * 2", fromMap({}))).toEqual({ value: -10 })
    expect(evaluateFormula(".5 + 0.25", fromMap({}))).toEqual({ value: 0.75 })
    expect(evaluateFormula("--4", fromMap({}))).toEqual({ value: 4 })
  })

  it("returns blank for empty expressions", () => {
    expect(evaluateFormula("", fromMap({}))).toEqual({ value: null })
    expect(evaluateFormula("=", fromMap({}))).toEqual({ value: null })
    expect(evaluateFormula("   ", fromMap({}))).toEqual({ value: null })
  })
})

describe("evaluateFormula — references", () => {
  it("resolves bare and bracketed cell refs", () => {
    expect(evaluateFormula("price * qty", fromMap({ price: 10, qty: 3 }))).toEqual({ value: 30 })
    expect(evaluateFormula("[unit.price] * [qty]", fromMap({ "unit.price": 4, qty: 2 }))).toEqual({ value: 8 })
  })

  it("treats blank refs as 0 in arithmetic", () => {
    expect(evaluateFormula("price + tax", fromMap({ price: 10 }))).toEqual({ value: 10 })
    expect(evaluateFormula("missing * 5", fromMap({}))).toEqual({ value: 0 })
  })
})

describe("evaluateFormula — functions", () => {
  it("computes SUM/AVG/MIN/MAX (case-insensitive)", () => {
    const m = fromMap({ a: 2, b: 4, c: 6 })
    expect(evaluateFormula("SUM(a, b, c)", m)).toEqual({ value: 12 })
    expect(evaluateFormula("avg(a, b, c)", m)).toEqual({ value: 4 })
    expect(evaluateFormula("Min(a, b, c)", m)).toEqual({ value: 2 })
    expect(evaluateFormula("MAX(a, b, c)", m)).toEqual({ value: 6 })
  })

  it("ignores blank args in aggregates", () => {
    const m = fromMap({ a: 10, c: 20 })
    expect(evaluateFormula("SUM(a, b, c)", m)).toEqual({ value: 30 })
    expect(evaluateFormula("AVG(a, b, c)", m)).toEqual({ value: 15 })
  })

  it("accepts nested expressions as function args", () => {
    const m = fromMap({ a: 2, b: 3 })
    expect(evaluateFormula("SUM(a * 2, b + 1, MAX(a, b))", m)).toEqual({ value: 11 })
  })

  it("returns blank when an aggregate has no numeric args", () => {
    expect(evaluateFormula("AVG(x, y)", fromMap({}))).toEqual({ value: null })
    expect(evaluateFormula("MIN(x)", fromMap({}))).toEqual({ value: null })
  })
})

describe("evaluateFormula — errors", () => {
  it("reports division by zero", () => {
    expect(evaluateFormula("5 / 0", fromMap({}))).toEqual({ value: null, error: "#DIV/0" })
    expect(evaluateFormula("a / b", fromMap({ a: 4, b: 0 }))).toEqual({ value: null, error: "#DIV/0" })
  })

  it("reports syntax errors without throwing", () => {
    expect(evaluateFormula("1 +", fromMap({})).error).toBe("#SYNTAX")
    expect(evaluateFormula("(1 + 2", fromMap({})).error).toBe("#SYNTAX")
    expect(evaluateFormula("1 2", fromMap({})).error).toBe("#SYNTAX")
    expect(evaluateFormula("[unclosed", fromMap({})).error).toBe("#SYNTAX")
    expect(evaluateFormula("3 % 2", fromMap({})).error).toBe("#SYNTAX")
  })

  it("rejects unknown functions", () => {
    expect(evaluateFormula("POW(2, 3)", fromMap({})).error).toBe("#ERROR")
  })

  it("never executes arbitrary code (no eval)", () => {
    // These would be valid JS but are not valid formula syntax.
    expect(evaluateFormula("process.exit(1)", fromMap({})).error).toBeDefined()
    expect(evaluateFormula("1; 2", fromMap({})).error).toBe("#SYNTAX")
  })
})

describe("extractReferences", () => {
  it("collects distinct refs and excludes functions/numbers", () => {
    expect(extractReferences("price * qty + SUM(a, b)").sort()).toEqual(["a", "b", "price", "qty"])
    expect(extractReferences("[x.y] + [x.y]")).toEqual(["x.y"])
  })

  it("returns [] for invalid expressions", () => {
    expect(extractReferences("1 +")).toEqual([])
  })
})

describe("isValidFormula", () => {
  it("validates syntax", () => {
    expect(isValidFormula("a + b * 2")).toBe(true)
    expect(isValidFormula("")).toBe(true)
    expect(isValidFormula("a +")).toBe(false)
    expect(isValidFormula("FOO(1)")).toBe(false)
  })
})

describe("coerceToNumber", () => {
  it("coerces primitives, currency strings, goals and booleans", () => {
    expect(coerceToNumber(5)).toBe(5)
    expect(coerceToNumber("12")).toBe(12)
    expect(coerceToNumber("$1,200.50")).toBe(1200.5)
    expect(coerceToNumber("40%")).toBe(40)
    expect(coerceToNumber(true)).toBe(1)
    expect(coerceToNumber(false)).toBe(0)
    expect(coerceToNumber({ current: 3, target: 10 } as AttributeValue)).toBe(3)
    expect(coerceToNumber("")).toBeNull()
    expect(coerceToNumber("abc")).toBeNull()
    expect(coerceToNumber(undefined)).toBeNull()
  })
})

describe("isFormulaDef", () => {
  it("detects formula definitions", () => {
    expect(isFormulaDef({ type: "formula" })).toBe(true)
    expect(isFormulaDef({ type: "number" })).toBe(false)
    expect(isFormulaDef(null)).toBe(false)
    expect(isFormulaDef(undefined)).toBe(false)
  })
})

describe("computeFormulaValue — over an item's attributes", () => {
  const price = def({ id: "price", name: "Price", type: "number" })
  const qty = def({ id: "qty", name: "Qty", type: "number" })

  it("computes against sibling numeric attributes", () => {
    const total = def({ id: "total", formula: "=price * qty", formatAs: "currency" })
    const lookup = { price, qty, total }
    const values: Record<string, AttributeValue> = { price: 9.99, qty: 3 }
    expect(computeFormulaValue(total, values, lookup).value).toBeCloseTo(29.97)
  })

  it("returns plain numeric coercion for non-formula defs", () => {
    expect(computeFormulaValue(price, { price: "42" }, { price })).toEqual({ value: 42 })
  })

  it("resolves formula → formula chains", () => {
    const a = def({ id: "a", type: "number" })
    const b = def({ id: "b", formula: "=a * 2" })
    const c = def({ id: "c", formula: "=b + 1" })
    const lookup = { a, b, c }
    expect(computeFormulaValue(c, { a: 5 }, lookup).value).toBe(11)
  })

  it("accepts a Map lookup", () => {
    const sum = def({ id: "sum", formula: "=SUM(price, qty)" })
    const lookup = new Map([
      ["price", price],
      ["qty", qty],
      ["sum", sum],
    ])
    expect(computeFormulaValue(sum, { price: 10, qty: 5 }, lookup).value).toBe(15)
  })

  it("detects a direct self-reference cycle", () => {
    const self = def({ id: "self", formula: "=self + 1" })
    expect(computeFormulaValue(self, {}, { self }).error).toBe("#CYCLE")
  })

  it("detects an indirect cycle (A → B → A)", () => {
    const a = def({ id: "a", formula: "=b + 1" })
    const b = def({ id: "b", formula: "=a + 1" })
    const lookup = { a, b }
    expect(computeFormulaValue(a, {}, lookup).error).toBe("#CYCLE")
    expect(computeFormulaValue(b, {}, lookup).error).toBe("#CYCLE")
  })

  it("propagates errors from referenced formulas", () => {
    const bad = def({ id: "bad", formula: "=1/0" })
    const dependent = def({ id: "dependent", formula: "=bad + 1" })
    expect(computeFormulaValue(dependent, {}, { bad, dependent }).error).toBe("#DIV/0")
  })

  it("does not flag a diamond (shared, non-cyclic) dependency", () => {
    const base = def({ id: "base", type: "number" })
    const left = def({ id: "left", formula: "=base * 2" })
    const right = def({ id: "right", formula: "=base + 1" })
    const top = def({ id: "top", formula: "=left + right" })
    const lookup = { base, left, right, top }
    expect(computeFormulaValue(top, { base: 10 }, lookup).value).toBe(31)
  })
})

describe("evaluateFormula — comparisons & IF", () => {
  it("evaluates comparison operators to 1/0", () => {
    expect(evaluateFormula("3 > 2", fromMap({}))).toEqual({ value: 1 })
    expect(evaluateFormula("3 < 2", fromMap({}))).toEqual({ value: 0 })
    expect(evaluateFormula("2 >= 2", fromMap({}))).toEqual({ value: 1 })
    expect(evaluateFormula("2 <= 1", fromMap({}))).toEqual({ value: 0 })
    expect(evaluateFormula("5 = 5", fromMap({}))).toEqual({ value: 1 })
    expect(evaluateFormula("5 == 4", fromMap({}))).toEqual({ value: 0 })
    expect(evaluateFormula("5 <> 4", fromMap({}))).toEqual({ value: 1 })
    expect(evaluateFormula("5 != 5", fromMap({}))).toEqual({ value: 0 })
  })

  it("supports a leading '=' before a comparison expression", () => {
    expect(evaluateFormula("= qty > 3", fromMap({ qty: 5 }))).toEqual({ value: 1 })
  })

  it("branches with IF(cond, a, b)", () => {
    const m = fromMap({ score: 80 })
    expect(evaluateFormula("IF(score >= 60, 1, 0)", m)).toEqual({ value: 1 })
    expect(evaluateFormula("IF(score >= 90, 100, 50)", m)).toEqual({ value: 50 })
    // Two-arg IF: blank when the condition is false.
    expect(evaluateFormula("IF(0, 5)", fromMap({}))).toEqual({ value: null })
    expect(evaluateFormula("IF(1, 5)", fromMap({}))).toEqual({ value: 5 })
  })

  it("rejects IF with the wrong arity", () => {
    expect(evaluateFormula("IF(1)", fromMap({})).error).toBe("#ERROR")
    expect(evaluateFormula("IF(1,2,3,4)", fromMap({})).error).toBe("#ERROR")
  })
})

describe("evaluateFormula — cross-item resolvers", () => {
  it("LOOKUP returns a value from another list via the injected resolver", () => {
    const ctx = {
      resolveAttr: fromMap({ order_id: 7 }),
      resolveLookup: (listId: string, matchAttr: string, returnAttr: string, key: number | string | null) => {
        expect(listId).toBe("invoices")
        expect(matchAttr).toBe("id")
        expect(returnAttr).toBe("amount")
        expect(key).toBe(7)
        return 42
      },
    }
    expect(evaluateFormula('LOOKUP("invoices", "id", "amount", order_id)', ctx)).toEqual({ value: 42 })
  })

  it("LOOKUP accepts bare-name id arguments too", () => {
    const ctx = {
      resolveAttr: fromMap({}),
      resolveLookup: () => 9,
    }
    expect(evaluateFormula("LOOKUP(invoices, id, amount, 3)", ctx)).toEqual({ value: 9 })
  })

  it("COUNTIF counts matching rows via the injected resolver", () => {
    const ctx = {
      resolveAttr: fromMap({}),
      resolveCountIf: (listId: string, matchAttr: string, key: number | string | null) => {
        expect(listId).toBe("tasks")
        expect(matchAttr).toBe("status")
        expect(key).toBe("done")
        return 3
      },
    }
    expect(evaluateFormula('COUNTIF("tasks", "status", "done")', ctx)).toEqual({ value: 3 })
  })

  it("ROLLUP aggregates an attribute across a category (fn defaults to sum)", () => {
    const ctx = {
      resolveAttr: fromMap({}),
      resolveRollup: (categoryId: string, attrId: string, fn: string) => {
        expect(categoryId).toBe("expenses")
        expect(attrId).toBe("cost")
        return fn === "avg" ? 10 : 100
      },
    }
    expect(evaluateFormula('ROLLUP("expenses", "cost")', ctx)).toEqual({ value: 100 })
    expect(evaluateFormula('ROLLUP("expenses", "cost", "avg")', ctx)).toEqual({ value: 10 })
  })

  it("combines cross-item functions with arithmetic and IF", () => {
    const ctx = {
      resolveAttr: fromMap({ rate: 2 }),
      resolveRollup: () => 50,
    }
    expect(evaluateFormula('ROLLUP("e", "c") * rate', ctx)).toEqual({ value: 100 })
    expect(evaluateFormula('IF(ROLLUP("e", "c") > 10, 1, 0)', ctx)).toEqual({ value: 1 })
  })

  it("errors when a cross-item function is used without its resolver", () => {
    expect(evaluateFormula('LOOKUP("a", "b", "c", 1)', fromMap({})).error).toBe("#ERROR")
    expect(evaluateFormula('COUNTIF("a", "b", 1)', fromMap({})).error).toBe("#ERROR")
    expect(evaluateFormula('ROLLUP("a", "b")', fromMap({})).error).toBe("#ERROR")
  })

  it("reports an unknown ROLLUP function", () => {
    const ctx = { resolveAttr: fromMap({}), resolveRollup: () => 1 }
    expect(evaluateFormula('ROLLUP("a", "b", "median")', ctx).error).toBe("#ERROR")
  })

  it("rejects an unterminated string literal", () => {
    expect(evaluateFormula('LOOKUP("a, "b", "c", 1)', fromMap({})).error).toBeDefined()
  })

  it("computeFormulaValue threads cross-item resolvers when provided", () => {
    const total = def({ id: "total", formula: '=ROLLUP("expenses", "cost")', formatAs: "currency" })
    const lookup = { total }
    const res = computeFormulaValue(total, {}, lookup, { resolveRollup: () => 250 })
    expect(res.value).toBe(250)
  })
})

describe("formatFormulaValue", () => {
  it("formats numbers, currency and percent", () => {
    expect(formatFormulaValue({ value: 1234.5 }, { formatAs: "number" })).toBe((1234.5).toLocaleString())
    expect(formatFormulaValue({ value: 1200.5 }, { formatAs: "currency" })).toBe("$1,200.50")
    expect(formatFormulaValue({ value: 1200.5 }, { formatAs: "currency", unit: "€" })).toBe("€1,200.50")
    expect(formatFormulaValue({ value: 0.5 }, { formatAs: "percent" })).toBe("50%")
    expect(formatFormulaValue({ value: 42 }, { unit: "kg" })).toBe("42 kg")
  })

  it("renders blank and error states", () => {
    expect(formatFormulaValue({ value: null })).toBe("")
    expect(formatFormulaValue({ value: null, error: "#CYCLE" })).toBe("#CYCLE")
    expect(formatFormulaValue({ value: null, error: "#DIV/0" })).toBe("#DIV/0")
  })
})

/**
 * lib/formula.ts — Safe spreadsheet-style expression evaluator (Feature 5)
 *
 * Evaluates computed/"formula" attribute expressions (spec §5 unified Item
 * model). Two layers live here:
 *   1. An **item-scoped** evaluator: cell references are **attribute ids** of the
 *      same item. (computeFormulaValue + cycle detection.)
 *   2. A **cross-item** layer (Module platform): formulas can reach into other
 *      lists/items via an *injectable resolver* — `LOOKUP`, `COUNTIF`, `ROLLUP`.
 *      The resolver is supplied by the caller (the store is never imported here)
 *      so the evaluator stays pure and testable.
 *
 * Supported syntax:
 *   - literals: `12`, `3.5`, `.5`, `"text"`/`'text'`
 *   - operators: `+ - * /`, comparisons `= == <> != < <= > >=`, parentheses,
 *     unary minus
 *   - functions: `SUM/AVG/MIN/MAX(...)`, `IF(cond, a, b)`,
 *     `LOOKUP(listId, matchAttr, returnAttr, key)`, `COUNTIF(listId, attr, key)`,
 *     `ROLLUP(categoryId, attrId, fn)`
 *   - refs: bare ids (`price`, `qty_2`) or bracketed ids (`[my-attr.id]`)
 *
 * Hard requirements:
 *   - **No `eval` / `Function`** — a hand-written tokenizer + recursive-descent
 *     parser + tree-walking interpreter. Nothing is ever executed as JS.
 *   - **Cyclic references are detected gracefully** (returns `#CYCLE`, never loops).
 *
 * Errors surface as a `FormulaResult.error` code rather than throwing to callers.
 * Blank/missing refs are treated as empty: ignored by aggregate functions and
 * coerced to 0 inside arithmetic (standard spreadsheet behavior).
 */
import type { AttributeDefinition, AttributeValue } from "@/lib/types"

export type FormulaErrorCode = "#SYNTAX" | "#CYCLE" | "#DIV/0" | "#ERROR"

export interface FormulaResult {
  /** Computed number, or `null` when the expression is blank/empty. */
  value: number | null
  /** Set when evaluation failed; `value` is `null` in that case. */
  error?: FormulaErrorCode
}

/** Lookup of attribute definitions by id (Map or plain record both accepted). */
export type DefLookup = Map<string, AttributeDefinition> | Record<string, AttributeDefinition>

/** Aggregation function names supported by `ROLLUP` (and internally). */
export type RollupFn = "sum" | "avg" | "min" | "max" | "count"

/** Resolves a same-item attribute id to a number (or `null` when blank). */
export type Resolver = (id: string) => number | null

/**
 * The injectable evaluation context. A bare `Resolver` function is also accepted
 * by `evaluateFormula` for backward compatibility (treated as `resolveAttr`).
 *
 * Cross-item resolvers are optional: a formula that uses `LOOKUP`/`COUNTIF`/
 * `ROLLUP` without the matching resolver evaluates to `#ERROR` (rather than
 * silently returning a wrong number).
 */
export interface FormulaContext {
  /** Resolve a same-item attribute id to a number (or `null`). */
  resolveAttr: Resolver
  /** Cross-item: return one attribute value from a matched row in another list. */
  resolveLookup?: (
    listId: string,
    matchAttr: string,
    returnAttr: string,
    key: number | string | null,
  ) => number | null
  /** Cross-item: count rows in a list whose `matchAttr` equals `key`. */
  resolveCountIf?: (listId: string, matchAttr: string, key: number | string | null) => number | null
  /** Cross-item: aggregate an attribute across every item in a category. */
  resolveRollup?: (categoryId: string, attrId: string, fn: RollupFn) => number | null
}

const FUNCTIONS = new Set(["SUM", "AVG", "MIN", "MAX", "IF", "LOOKUP", "COUNTIF", "ROLLUP"])

/** Cross-item functions: their leading id args are literals, not numeric refs. */
const CROSS_ITEM_FUNCTIONS = new Set(["LOOKUP", "COUNTIF", "ROLLUP"])

/** Internal control-flow error carrying a stable formula error code. */
class FormulaError extends Error {
  constructor(public code: FormulaErrorCode) {
    super(code)
    this.name = "FormulaError"
  }
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

interface Token {
  type: "num" | "name" | "op" | "str"
  value: string
}

const IDENT_START = /[A-Za-z_]/
const IDENT_CHAR = /[A-Za-z0-9_]/

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const c = input[i]
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++
      continue
    }
    // number (incl. leading dot like ".5")
    if ((c >= "0" && c <= "9") || (c === "." && /[0-9]/.test(input[i + 1] || ""))) {
      let j = i + 1
      let seenDot = c === "."
      while (j < input.length) {
        const cj = input[j]
        if (cj >= "0" && cj <= "9") {
          j++
        } else if (cj === "." && !seenDot) {
          seenDot = true
          j++
        } else {
          break
        }
      }
      tokens.push({ type: "num", value: input.slice(i, j) })
      i = j
      continue
    }
    // string literal: "..." or '...'
    if (c === '"' || c === "'") {
      const end = input.indexOf(c, i + 1)
      if (end === -1) throw new FormulaError("#SYNTAX")
      tokens.push({ type: "str", value: input.slice(i + 1, end) })
      i = end + 1
      continue
    }
    // bare identifier
    if (IDENT_START.test(c)) {
      let j = i + 1
      while (j < input.length && IDENT_CHAR.test(input[j])) j++
      tokens.push({ type: "name", value: input.slice(i, j) })
      i = j
      continue
    }
    // bracketed reference [arbitrary.id-with chars]
    if (c === "[") {
      const end = input.indexOf("]", i + 1)
      if (end === -1) throw new FormulaError("#SYNTAX")
      const id = input.slice(i + 1, end).trim()
      if (!id) throw new FormulaError("#SYNTAX")
      tokens.push({ type: "name", value: id })
      i = end + 1
      continue
    }
    // two-char comparison operators
    const two = input.slice(i, i + 2)
    if (two === ">=" || two === "<=" || two === "==" || two === "!=" || two === "<>") {
      tokens.push({ type: "op", value: two })
      i += 2
      continue
    }
    if ("+-*/(),".includes(c)) {
      tokens.push({ type: "op", value: c })
      i++
      continue
    }
    if (c === "<" || c === ">" || c === "=") {
      tokens.push({ type: "op", value: c })
      i++
      continue
    }
    throw new FormulaError("#SYNTAX")
  }
  return tokens
}

// ---------------------------------------------------------------------------
// Parser (recursive descent) → AST
// ---------------------------------------------------------------------------

type CompareOp = "=" | "==" | "!=" | "<>" | "<" | "<=" | ">" | ">="
type ArithOp = "+" | "-" | "*" | "/"

type Node =
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "ref"; id: string }
  | { kind: "unary"; op: "-"; arg: Node }
  | { kind: "bin"; op: ArithOp; left: Node; right: Node }
  | { kind: "compare"; op: CompareOp; left: Node; right: Node }
  | { kind: "call"; fn: string; args: Node[] }

const COMPARE_OPS = new Set(["=", "==", "!=", "<>", "<", "<=", ">", ">="])

class Parser {
  private pos = 0
  constructor(private readonly tokens: Token[]) {}

  parse(): Node {
    const node = this.parseExpr()
    if (this.pos !== this.tokens.length) throw new FormulaError("#SYNTAX")
    return node
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++]
  }

  private expectOp(op: string): void {
    const t = this.next()
    if (!t || t.type !== "op" || t.value !== op) throw new FormulaError("#SYNTAX")
  }

  private isOp(value: string): boolean {
    const t = this.peek()
    return !!t && t.type === "op" && t.value === value
  }

  private isCompareOp(): boolean {
    const t = this.peek()
    return !!t && t.type === "op" && COMPARE_OPS.has(t.value)
  }

  /** expr := comparison */
  private parseExpr(): Node {
    return this.parseComparison()
  }

  /** comparison := addsub (compareOp addsub)* */
  private parseComparison(): Node {
    let left = this.parseAddSub()
    while (this.isCompareOp()) {
      const op = this.next()!.value as CompareOp
      const right = this.parseAddSub()
      left = { kind: "compare", op, left, right }
    }
    return left
  }

  /** addsub := term (('+' | '-') term)* */
  private parseAddSub(): Node {
    let left = this.parseTerm()
    while (this.isOp("+") || this.isOp("-")) {
      const op = this.next()!.value as ArithOp
      const right = this.parseTerm()
      left = { kind: "bin", op, left, right }
    }
    return left
  }

  /** term := factor (('*' | '/') factor)* */
  private parseTerm(): Node {
    let left = this.parseFactor()
    while (this.isOp("*") || this.isOp("/")) {
      const op = this.next()!.value as ArithOp
      const right = this.parseFactor()
      left = { kind: "bin", op, left, right }
    }
    return left
  }

  /** factor := ('-' | '+') factor | primary */
  private parseFactor(): Node {
    if (this.isOp("-")) {
      this.next()
      return { kind: "unary", op: "-", arg: this.parseFactor() }
    }
    if (this.isOp("+")) {
      this.next()
      return this.parseFactor()
    }
    return this.parsePrimary()
  }

  /** primary := number | string | funcCall | ref | '(' expr ')' */
  private parsePrimary(): Node {
    const t = this.next()
    if (!t) throw new FormulaError("#SYNTAX")

    if (t.type === "num") {
      const value = Number(t.value)
      if (!Number.isFinite(value)) throw new FormulaError("#SYNTAX")
      return { kind: "num", value }
    }

    if (t.type === "str") {
      return { kind: "str", value: t.value }
    }

    if (t.type === "op" && t.value === "(") {
      const inner = this.parseExpr()
      this.expectOp(")")
      return inner
    }

    if (t.type === "name") {
      // Function call when immediately followed by "(".
      if (this.isOp("(")) {
        const fn = t.value.toUpperCase()
        if (!FUNCTIONS.has(fn)) throw new FormulaError("#ERROR")
        this.next() // consume "("
        const args: Node[] = []
        if (!this.isOp(")")) {
          args.push(this.parseExpr())
          while (this.isOp(",")) {
            this.next()
            args.push(this.parseExpr())
          }
        }
        this.expectOp(")")
        return { kind: "call", fn, args }
      }
      return { kind: "ref", id: t.value }
    }

    throw new FormulaError("#SYNTAX")
  }
}

// ---------------------------------------------------------------------------
// Interpreter
// ---------------------------------------------------------------------------

interface EvalCtx {
  resolve: Resolver
  lookup?: FormulaContext["resolveLookup"]
  countif?: FormulaContext["resolveCountIf"]
  rollup?: FormulaContext["resolveRollup"]
}

/** Extract a literal string from an id-position argument (`"x"`, `'x'`, or `x`). */
function stringArg(node: Node | undefined): string {
  if (!node) throw new FormulaError("#ERROR")
  if (node.kind === "str") return node.value
  if (node.kind === "ref") return node.id
  if (node.kind === "num") return String(node.value)
  throw new FormulaError("#ERROR")
}

/** Evaluate a key argument that may be either a string literal or a number. */
function scalarArg(node: Node | undefined, ctx: EvalCtx): number | string | null {
  if (!node) return null
  if (node.kind === "str") return node.value
  return evalNode(node, ctx)
}

function toRollupFn(name: string): RollupFn {
  const n = name.toLowerCase()
  if (n === "sum" || n === "avg" || n === "min" || n === "max" || n === "count") return n
  throw new FormulaError("#ERROR")
}

function evalNode(node: Node, ctx: EvalCtx): number | null {
  switch (node.kind) {
    case "num":
      return node.value
    case "str":
      // A bare string in numeric position behaves like a blank cell.
      return null
    case "ref":
      return ctx.resolve(node.id)
    case "unary": {
      const v = evalNode(node.arg, ctx)
      return v === null ? null : -v
    }
    case "bin": {
      // Blank operands behave like 0 in arithmetic (spreadsheet convention).
      const l = evalNode(node.left, ctx) ?? 0
      const r = evalNode(node.right, ctx) ?? 0
      switch (node.op) {
        case "+":
          return l + r
        case "-":
          return l - r
        case "*":
          return l * r
        case "/":
          if (r === 0) throw new FormulaError("#DIV/0")
          return l / r
      }
      return null
    }
    case "compare": {
      const l = evalNode(node.left, ctx) ?? 0
      const r = evalNode(node.right, ctx) ?? 0
      let res: boolean
      switch (node.op) {
        case "=":
        case "==":
          res = l === r
          break
        case "!=":
        case "<>":
          res = l !== r
          break
        case "<":
          res = l < r
          break
        case "<=":
          res = l <= r
          break
        case ">":
          res = l > r
          break
        case ">=":
          res = l >= r
          break
        default:
          res = false
      }
      return res ? 1 : 0
    }
    case "call":
      return evalCall(node, ctx)
  }
}

function evalCall(node: Extract<Node, { kind: "call" }>, ctx: EvalCtx): number | null {
  const { fn, args } = node
  switch (fn) {
    case "SUM":
    case "AVG":
    case "MIN":
    case "MAX": {
      // Blanks are ignored by aggregate functions.
      const vals = args.map((a) => evalNode(a, ctx)).filter((v): v is number => v !== null)
      switch (fn) {
        case "SUM":
          return vals.reduce((a, b) => a + b, 0)
        case "AVG":
          return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
        case "MIN":
          return vals.length ? Math.min(...vals) : null
        case "MAX":
          return vals.length ? Math.max(...vals) : null
      }
      return null
    }
    case "IF": {
      if (args.length < 2 || args.length > 3) throw new FormulaError("#ERROR")
      const cond = evalNode(args[0], ctx)
      const truthy = cond !== null && cond !== 0
      if (truthy) return evalNode(args[1], ctx)
      return args[2] ? evalNode(args[2], ctx) : null
    }
    case "LOOKUP": {
      if (!ctx.lookup) throw new FormulaError("#ERROR")
      if (args.length !== 4) throw new FormulaError("#ERROR")
      const listId = stringArg(args[0])
      const matchAttr = stringArg(args[1])
      const returnAttr = stringArg(args[2])
      const key = scalarArg(args[3], ctx)
      return ctx.lookup(listId, matchAttr, returnAttr, key)
    }
    case "COUNTIF": {
      if (!ctx.countif) throw new FormulaError("#ERROR")
      if (args.length !== 3) throw new FormulaError("#ERROR")
      const listId = stringArg(args[0])
      const matchAttr = stringArg(args[1])
      const key = scalarArg(args[2], ctx)
      return ctx.countif(listId, matchAttr, key)
    }
    case "ROLLUP": {
      if (!ctx.rollup) throw new FormulaError("#ERROR")
      if (args.length < 2 || args.length > 3) throw new FormulaError("#ERROR")
      const categoryId = stringArg(args[0])
      const attrId = stringArg(args[1])
      const rollupFn = args[2] ? toRollupFn(stringArg(args[2])) : "sum"
      return ctx.rollup(categoryId, attrId, rollupFn)
    }
    default:
      throw new FormulaError("#ERROR")
  }
}

/** Drop a single leading "=" (sheet-style) before parsing. */
function stripLeadingEquals(expr: string): string {
  const trimmed = expr.trimStart()
  return trimmed.startsWith("=") ? trimmed.slice(1) : trimmed
}

function normalizeContext(arg: Resolver | FormulaContext): FormulaContext {
  return typeof arg === "function" ? { resolveAttr: arg } : arg
}

/**
 * Evaluate an expression against a numeric resolver (or a full `FormulaContext`
 * for cross-item formulas). The resolver maps a referenced attribute id to a
 * number (or `null` when blank/non-numeric). Never throws — failures come back
 * as `{ value: null, error }`.
 */
export function evaluateFormula(expression: string, resolver: Resolver | FormulaContext): FormulaResult {
  const context = normalizeContext(resolver)
  const expr = stripLeadingEquals(expression ?? "")
  if (expr.trim() === "") return { value: null }
  try {
    const tokens = tokenize(expr)
    if (tokens.length === 0) return { value: null }
    const ast = new Parser(tokens).parse()
    const safeResolve: Resolver = (id) => {
      const v = context.resolveAttr(id)
      return v === null || v === undefined || !Number.isFinite(v) ? null : v
    }
    const evalCtx: EvalCtx = {
      resolve: safeResolve,
      lookup: context.resolveLookup,
      countif: context.resolveCountIf,
      rollup: context.resolveRollup,
    }
    const value = evalNode(ast, evalCtx)
    if (value === null) return { value: null }
    if (!Number.isFinite(value)) return { value: null, error: "#ERROR" }
    return { value }
  } catch (e) {
    if (e instanceof FormulaError) return { value: null, error: e.code }
    return { value: null, error: "#ERROR" }
  }
}

/** Distinct attribute ids referenced by an expression (for dependency tracking). */
export function extractReferences(expression: string): string[] {
  try {
    const tokens = tokenize(stripLeadingEquals(expression ?? ""))
    const ast = new Parser(tokens).parse()
    const refs = new Set<string>()
    const walk = (n: Node): void => {
      switch (n.kind) {
        case "ref":
          refs.add(n.id)
          break
        case "unary":
          walk(n.arg)
          break
        case "bin":
        case "compare":
          walk(n.left)
          walk(n.right)
          break
        case "call":
          // Cross-item functions take literal list/attr ids in their leading
          // positions; those are NOT same-item attribute refs, so only the
          // numeric key/value argument participates in dependency tracking.
          if (n.fn === "LOOKUP") {
            if (n.args[3]) walk(n.args[3])
          } else if (n.fn === "COUNTIF") {
            if (n.args[2]) walk(n.args[2])
          } else if (n.fn === "ROLLUP") {
            // no same-item refs
          } else {
            n.args.forEach(walk)
          }
          break
      }
    }
    walk(ast)
    return [...refs]
  } catch {
    return []
  }
}

/** True when an expression parses without syntax errors. */
export function isValidFormula(expression: string): boolean {
  const expr = stripLeadingEquals(expression ?? "")
  if (expr.trim() === "") return true
  try {
    new Parser(tokenize(expr)).parse()
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Attribute-aware layer (cycle detection across formula → formula refs)
// ---------------------------------------------------------------------------

/** Is this definition a computed/formula attribute? */
export function isFormulaDef(def?: { type?: string } | null): boolean {
  return def?.type === "formula"
}

function getDef(lookup: DefLookup, id: string): AttributeDefinition | undefined {
  return lookup instanceof Map ? lookup.get(id) : lookup[id]
}

/** Coerce any stored attribute value to a finite number, or `null`. */
export function coerceToNumber(value: AttributeValue): number | null {
  if (value === undefined || value === null || value === "") return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "boolean") return value ? 1 : 0
  if (typeof value === "object" && !Array.isArray(value)) {
    const g = value as { current?: number }
    return typeof g.current === "number" && Number.isFinite(g.current) ? g.current : null
  }
  const n = Number(String(value).replace(/[$,€£¥₹\s%]/g, ""))
  return Number.isFinite(n) ? n : null
}

function makeResolver(
  lookup: DefLookup,
  values: Record<string, AttributeValue>,
  visiting: Set<string>,
): Resolver {
  return (id: string): number | null => {
    const def = getDef(lookup, id)
    if (def && def.type === "formula") {
      if (visiting.has(id)) throw new FormulaError("#CYCLE")
      const nextVisiting = new Set(visiting)
      nextVisiting.add(id)
      const res = evaluateFormula(def.formula ?? "", makeResolver(lookup, values, nextVisiting))
      if (res.error) throw new FormulaError(res.error)
      return res.value
    }
    return coerceToNumber(values[id])
  }
}

/**
 * Compute one attribute's value for a single item. For non-formula attributes
 * this is just numeric coercion of the stored value; for formula attributes the
 * expression is evaluated, recursively resolving referenced formula attributes
 * with cycle detection (`#CYCLE`).
 *
 * `crossItem` optionally supplies the cross-item resolvers (`resolveLookup`,
 * `resolveCountIf`, `resolveRollup`) so item-scoped formulas can also reach into
 * other lists. They are passed by the caller (the store), never imported here.
 */
export function computeFormulaValue(
  def: AttributeDefinition,
  values: Record<string, AttributeValue>,
  defsById: DefLookup,
  crossItem?: Pick<FormulaContext, "resolveLookup" | "resolveCountIf" | "resolveRollup">,
): FormulaResult {
  if (!isFormulaDef(def)) {
    return { value: coerceToNumber(values[def.id]) }
  }
  try {
    const resolveAttr = makeResolver(defsById, values, new Set([def.id]))
    const context: FormulaContext = { resolveAttr, ...crossItem }
    return evaluateFormula(def.formula ?? "", context)
  } catch (e) {
    if (e instanceof FormulaError) return { value: null, error: e.code }
    return { value: null, error: "#ERROR" }
  }
}

/** Format a computed result for display, honoring `formatAs`/`unit`. */
export function formatFormulaValue(
  result: FormulaResult,
  def?: { formatAs?: "number" | "currency" | "percent"; unit?: string },
): string {
  if (result.error) return result.error
  if (result.value === null) return ""
  const v = result.value
  switch (def?.formatAs) {
    case "currency": {
      const body = (Math.round(v * 100) / 100).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      const symbol = (def.unit || "").trim() || "$"
      return `${symbol}${body}`
    }
    case "percent": {
      // Treat the computed value as a fraction (0.5 → "50%").
      const pct = Math.round(v * 1000) / 10
      return `${pct}%`
    }
    default: {
      const body = (Math.round(v * 100) / 100).toLocaleString()
      const unit = (def?.unit || "").trim()
      return unit ? `${body} ${unit}` : body
    }
  }
}

/**
 * lib/habit-helper/tests.ts — Recorded cases for the Habit Helper, run by the lab and by vitest
 *
 * A case is a message, the moment it was said, and the proposals (or asks) it must become, against a
 * fixed set of habits (`FIXTURE`). `matching` is a recorded MATCH answer: **replay** runs every code stage
 * on it with no model (free, exact). **Rules** runs the rules reader instead, which is what the chat does
 * with Ollama off. **Live** (lab only) asks the model again. Cases the person saves in the lab are kept in
 * `habithelper-tests-v1`.
 */

import { computeAll } from "./compute"
import { suggestShorthands } from "./shorthand"
import { tagText } from "./tags"
import { matchByRules } from "./match"
import type { HabitBrief, HelperContext, Matching, Proposal } from "./types"

/** One proposal or ask as a comparable line. */
export interface ExpectRow {
  kind: "set" | "missed" | "reason" | "shorthand" | "ask"
  habit: string
  day?: string
  /** `on`, `10 pages`, a shorthand, or for an ask the habit ids joined by `|`. */
  to: string
  reason?: string
}

export interface HabitHelperTest {
  id: string
  name: string
  text: string
  /** ISO. */
  now: string
  matching?: Matching
  /** A shorthand request: no matching, the names are code. */
  shorthand?: boolean
  expect: ExpectRow[]
}

// Sunday 1 Nov 2026 at 9:40, so "yesterday" is 31 Oct.
export const TEST_NOW = new Date(2026, 10, 1, 9, 40).toISOString()

const h = (o: Partial<HabitBrief> & Pick<HabitBrief, "id" | "name">): HabitBrief => ({ kind: "yesno", words: [], days: {}, ...o })

export const FIXTURE: HabitBrief[] = [
  h({ id: "water", name: "Drink water" }),
  h({ id: "read", name: "Read 5 pages", kind: "goal", goal: 5, unit: "page" }),
  h({ id: "stretch", name: "Stretch" }),
  h({ id: "exercise", name: "Exercise 30 minutes", kind: "goal", goal: 30, unit: "min", words: ["Walking", "Running"] }),
  h({ id: "outside", name: "Go outside" }),
  h({ id: "clean", name: "Clean for 15 minutes", kind: "goal", goal: 15, unit: "min" }),
  h({ id: "news", name: "Read the news" }),
]

export const fixtureCtx = (now: string, habits = FIXTURE): HelperContext => ({ now: new Date(now), habits })

export const rowOf = (p: Proposal): ExpectRow => ({ kind: p.kind, habit: p.habitId, ...(p.day ? { day: p.day } : {}), to: p.kind === "missed" ? "missed" : p.kind === "reason" ? "reason" : p.to, ...(p.write?.missReason !== undefined ? { reason: p.write.missReason } : {}) })

export const rowText = (r: ExpectRow) => `${r.kind} ${r.habit}${r.day ? ` ${r.day}` : ""} → ${r.to}${r.reason !== undefined ? ` “${r.reason}”` : ""}`

export interface TestResult {
  pass: boolean
  got: ExpectRow[]
  diff: string[]
}

export function compare(got: ExpectRow[], want: ExpectRow[]): TestResult {
  const g = got.map(rowText)
  const w = want.map(rowText)
  const diff = [...w.filter((x) => !g.includes(x)).map((x) => `- ${x}`), ...g.filter((x) => !w.includes(x)).map((x) => `+ ${x}`)]
  return { pass: !diff.length, got, diff }
}

/** Rows from a matching (recorded, live, or rules) run through the code stages. */
export function rowsFrom(t: HabitHelperTest, matching: Matching | "rules", habits = FIXTURE): ExpectRow[] {
  const ctx = fixtureCtx(t.now, habits)
  if (t.shorthand) return suggestShorthands(ctx.habits).map(rowOf)
  const tagged = tagText(t.text, ctx.now)
  const out = computeAll(matching === "rules" ? matchByRules(tagged, ctx) : matching, tagged, ctx)
  return [...out.proposals.map(rowOf), ...out.asks.map((a) => ({ kind: "ask" as const, habit: "", to: a.options.map((o) => o.id).join("|") }))]
}

export const replay = (t: HabitHelperTest) => compare(rowsFrom(t, t.matching ?? { items: [] }), t.expect)
export const byRules = (t: HabitHelperTest) => compare(rowsFrom(t, "rules"), t.expect)

const item = (clause: string, habit: string, o: Partial<Matching["items"][number]> = {}): Matching["items"][number] => ({ clause, habit, maybe: "", kind: "done", amount: "", day: "", reason: "", ...o })

export const OUTSIDE_TEXT = "I didn't go outside today because I woke up too late and it was dark"

export const SHIPPED_TESTS: HabitHelperTest[] = [
  {
    id: "daily-list",
    name: "A list of done habits; read takes the number",
    text: "daily habits completed - drank water, read 10 pages, stretched",
    now: TEST_NOW,
    matching: { items: [item("C2", "water"), item("C3", "read", { amount: "N1" }), item("C4", "stretch")] },
    expect: [
      { kind: "set", habit: "water", day: "2026-11-01", to: "on" },
      { kind: "set", habit: "read", day: "2026-11-01", to: "10 pages" },
      { kind: "set", habit: "stretch", day: "2026-11-01", to: "on" },
    ],
  },
  {
    id: "walk-chocolate",
    name: "A walk counts as exercise; the chocolate bar is ignored",
    text: "walked for 30 minutes then ate a chocolate bar…",
    now: TEST_NOW,
    matching: { items: [item("C1", "exercise", { amount: "N1" })] },
    expect: [{ kind: "set", habit: "exercise", day: "2026-11-01", to: "30 min" }],
  },
  {
    id: "outside-missed",
    name: "A miss keeps the reason word for word",
    text: OUTSIDE_TEXT,
    now: TEST_NOW,
    matching: { items: [item("C1", "outside", { kind: "missed", day: "D1", reason: "B1" })] },
    expect: [{ kind: "missed", habit: "outside", day: "2026-11-01", to: "missed", reason: "I woke up too late and it was dark" }],
  },
  {
    id: "no-habit",
    name: "No habit named: nothing proposed",
    text: "had a long call with my sister and made pasta",
    now: TEST_NOW,
    matching: { items: [] },
    expect: [],
  },
  {
    id: "yesterday-read",
    name: "A day that is not today",
    text: "yesterday I read 20 pages",
    now: TEST_NOW,
    matching: { items: [item("C1", "read", { amount: "N1", day: "D1" })] },
    expect: [{ kind: "set", habit: "read", day: "2026-10-31", to: "20 pages" }],
  },
  {
    id: "ambiguous-read",
    name: "Read could be pages or the news: ask",
    text: "I read for a while this morning",
    now: TEST_NOW,
    matching: { items: [item("C1", "read", { maybe: "news" })] },
    expect: [{ kind: "ask", habit: "", to: "read|news" }],
  },
  {
    id: "shorthand-all",
    name: "Shorthand names, unique",
    text: "Give relevant shorthand names to all of my daily habits that don't already have them",
    now: TEST_NOW,
    shorthand: true,
    expect: [
      { kind: "shorthand", habit: "water", to: "water" },
      { kind: "shorthand", habit: "read", to: "read" },
      { kind: "shorthand", habit: "stretch", to: "stretch" },
      { kind: "shorthand", habit: "exercise", to: "exercise" },
      { kind: "shorthand", habit: "outside", to: "outside" },
      { kind: "shorthand", habit: "clean", to: "clean" },
      { kind: "shorthand", habit: "news", to: "read news" },
    ],
  },
]

const KEY = "habithelper-tests-v1"

export function loadTests(): HabitHelperTest[] {
  try {
    const mine = JSON.parse(localStorage.getItem(KEY) ?? "[]") as HabitHelperTest[]
    return [...SHIPPED_TESTS, ...mine]
  } catch {
    return SHIPPED_TESTS
  }
}

export function saveMine(tests: HabitHelperTest[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(tests.filter((t) => !SHIPPED_TESTS.some((s) => s.id === t.id))))
  } catch {}
}

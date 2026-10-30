/**
 * lib/bim-flow/tests.ts — Named test runs for the flows, and a history of their output
 *
 * A test is a flow, an input, and a few checks. Checks only say pass or fail
 * for things code can see (a block named cooking, an answer containing a word,
 * the model admitting it does not know). A test with no checks is marked
 * `review`: read the answer and judge it. Every run is kept, so a changed
 * instruction or model can be compared against what the same test said before.
 */

import { augment, DEFAULT_INPUT, group, parsePasted, questionMessage, type Augment, type FeedLine, type Grouping, type InputSpec } from "./inputs"
import { REAL_TESTS } from "./tests-real"
import type { ModelCall } from "./ollama"
import type { Ranker } from "./retrieve"
import { runFlow } from "./run-flow"
import type { FlowId } from "./flows"
import type { Flow, FlowRun, ModelPlan, TraceStep } from "./types"
import type { VaultSnapshot } from "./vault-search"

export interface TestChecks {
  answerContains?: string[]
  answerNotContains?: string[]
  confidenceIs?: ("high" | "medium" | "low" | "none")[]
  blocksContain?: string[]
  proposalsContain?: string[]
  /** No suggestion's summary may contain any of these. */
  proposalsNotContain?: string[]
  /** Longest a suggestion's summary may be (a whole pasted day written as one task is too long). */
  proposalsMaxChars?: number
  /** Regular expressions (case-insensitive) the answer must match. For numbers and dates that move with the data. */
  answerMatches?: string[]
  /** Most lines the answer may have. */
  answerMaxLines?: number
  /** No two blocks may share minutes. */
  blocksNoOverlap?: boolean
  /** A node must have left by this port (for example the command gate by `yes`), whatever the model then wrote. */
  stepPorts?: { nodeId: string; port: string }[]
}

export interface BimTest {
  id: string
  name: string
  flowId: FlowId
  input: { kind: "paste"; text: string } | { kind: "question"; text: string } | { kind: "latest-day" }
  grouping?: Grouping
  augment?: Augment[]
  /** Which start node the input comes in through (see `entries.ts`). */
  entry?: string
  checks?: TestChecks
  /** What a good run does, in words, for a person reading the result. */
  expect?: string
}

/** One node step, kept whole enough to read later. Big outputs are cut to text. */
export interface StepRec {
  nodeId: string
  label: string
  kind: string
  port: string
  ms: number
  error?: string
  output: unknown
  prompt?: string
}

/** What one input did: every step in order. */
export interface InputRun {
  input: string
  steps: StepRec[]
}

/** A color per test, cool tones only, so a running test is told apart at a glance. */
const TEST_COLORS = ["#4fb3ff", "#3fd0a8", "#b48cff", "#ff7a9c", "#ff9a4d", "#5de0e6", "#8fd14f", "#e07cf0", "#6f9bff", "#ff6f61", "#46c2cb", "#c4a2ff"]
export const testColor = (id: string): string => TEST_COLORS[Math.max(0, TESTS.findIndex((t) => t.id === id)) % TEST_COLORS.length]!

export const CAP = 6000
export const keep = (v: unknown): unknown => {
  try {
    const j = JSON.stringify(v)
    return j && j.length > CAP ? j.slice(0, CAP) + " …(cut)" : v
  } catch {
    return String(v)
  }
}

export function stepRec(flow: Flow, s: TraceStep): StepRec {
  const node = flow.nodes.find((n) => n.id === s.nodeId)
  return { nodeId: s.nodeId, label: node?.label ?? s.nodeId, kind: node?.kind ?? "?", port: s.port, ms: s.ms, error: s.error, output: keep(s.output), prompt: s.prompt && s.prompt.length > CAP ? s.prompt.slice(0, CAP) + " …(cut)" : s.prompt }
}

export interface TestResult {
  id: string
  testId: string
  name: string
  at: string
  model: string
  flowId: FlowId
  inputLabel: string
  ms: number
  /** Which setup produced it ("baseline", "split 3b gates / 32b prose"…), so runs can be compared. */
  label?: string
  /** Models given to gates and to prose steps, when they differ from `model`. */
  models?: ModelPlan
  status: "pass" | "fail" | "review" | "error"
  checks: { label: string; ok: boolean }[]
  notes: string[]
  output: {
    answers: { text: string; confidence: string; evidence: string[]; used: number[]; facts: string[]; draft?: string }[]
    blocks: string[]
    proposals: string[]
    trace: string[]
    /** Full steps per input (first few inputs only). */
    runs?: InputRun[]
    error?: string
  }
}

const CONFIT = "13:30 making garlic confit now\n14:00 garlic done\n14:05 starting walk\n14:40 back, called elijah\n14:42 need more macbook bricks"
const SHIRT = "when i hang out with elijah, what shirt do i wear most?"

const RAW_TESTS: BimTest[] = [
  { id: "log-confit", name: "Log: garlic confit afternoon", flowId: "log", input: { kind: "paste", text: CONFIT }, checks: { blocksContain: ["cooking"], proposalsContain: ["Elijah"] } },
  { id: "log-routed-confit", name: "Log (routed): garlic confit afternoon", flowId: "log-routed", entry: "bim-text", input: { kind: "paste", text: CONFIT }, checks: { blocksContain: ["cooking"], proposalsContain: ["Elijah"] } },
  { id: "log-routed-latest", name: "Log (routed): latest BIM day", flowId: "log-routed", entry: "bim-text", input: { kind: "latest-day" } },
  { id: "log-routed-phone", name: "Log (routed): phone capture that is a question", flowId: "log-phone", entry: "phone-capture", input: { kind: "question", text: "when was the last time i showered?" } },
  { id: "reason-triage", name: "Ritual: reason typed beside a task", flowId: "reason", entry: "miss-reason", input: { kind: "question", text: "Process inbox information — no time, too much going on" } },
  { id: "night-worry", name: "Ritual: night worry", flowId: "ritual-night", entry: "ritual-night", input: { kind: "question", text: "Didn't finish the foxtide stuff again. I keep saying tomorrow." } },
  { id: "morning-plan", name: "Ritual: morning plan", flowId: "ritual-morning", entry: "ritual-morning", input: { kind: "question", text: "Today: finish bim flow, go outside, eat real food" } },
  { id: "build-habit-home", name: "Build request: habit 'home 5+ hours' (auto from location or manual)", flowId: "log-phone", entry: "phone-capture", input: { kind: "question", text: "Make a new daily habit 'be home for more than 5 hours' and have it autodetect from location or be manually input" } },
  { id: "build-item", name: "Build request: new item on an existing list", flowId: "log-phone", entry: "phone-capture", input: { kind: "question", text: "Add 'replace bike tube' to my errands" } },
  { id: "build-list", name: "Build request: new list in a new folder", flowId: "log-phone", entry: "phone-capture", input: { kind: "question", text: "Make a list called 'gift ideas' in a new folder 'people stuff', and put 'candle for mom' in it" } },
  { id: "build-list-described", name: "Build request: list from a description only", flowId: "log-phone", entry: "phone-capture", input: { kind: "question", text: "I keep forgetting movies people recommend, I need somewhere to keep those" } },
  { id: "ask-shower", name: "Ask: last time I showered", flowId: "ask", input: { kind: "question", text: "when was the last time i showered?" } },
  { id: "ask-shirt", name: "Ask: shirt with Elijah", flowId: "ask", input: { kind: "question", text: SHIRT } },
  { id: "ask-shirt-search", name: "Ask: shirt with Elijah · + search", flowId: "ask", input: { kind: "question", text: SHIRT }, augment: ["search"] },
  { id: "ask-shirt-related", name: "Ask: shirt with Elijah · + related terms", flowId: "ask", input: { kind: "question", text: SHIRT }, augment: ["related"] },
  { id: "ask-shirt-semantic", name: "Ask: shirt with Elijah · + semantic", flowId: "ask", input: { kind: "question", text: SHIRT }, augment: ["semantic"] },
  { id: "ask-hours", name: "Ask: computer work hours this week", flowId: "ask", input: { kind: "question", text: "how many hours did i spend on computer work this week?" } },
  { id: "ask-unknown", name: "Ask: something never written (should say it does not know)", flowId: "ask", input: { kind: "question", text: "what color were my socks on my trip to mars?" }, checks: { confidenceIs: ["none", "low"] } },
  { id: "calc-hours", name: "Ask (counted): computer work hours this week", flowId: "ask-calc", input: { kind: "question", text: "how many hours did i spend on computer work this week?" } },
  { id: "calc-streak", name: "Ask (counted): days in a row outside", flowId: "ask-calc", input: { kind: "question", text: "how many days in a row did i go outside?" } },
  { id: "calc-since", name: "Ask (counted): how long since I showered", flowId: "ask-calc", input: { kind: "question", text: "how long since i showered?" } },
  { id: "calc-compare", name: "Ask (counted): walking vs last week", flowId: "ask-calc", input: { kind: "question", text: "am i walking more this week than last week?" } },
  { id: "calc-unknown", name: "Ask (counted): never written (stops at the guard)", flowId: "ask-calc", input: { kind: "question", text: "what color were my socks on my trip to mars?" }, checks: { confidenceIs: ["none", "low"] } },
  { id: "grammar-mixed", name: "Log (grammar first): verbs, a link, and plain lines", flowId: "log-grammar", entry: "bim-text", input: { kind: "paste", text: "13:30 making garlic confit now\n13:31 https://example.com/garlic-confit\n13:32 dh: stretch\n13:33 groc\n14:00 garlic done" }, checks: { proposalsContain: ["Inbox"] } },
  { id: "topic-brain2", name: "Summarize: brain2 this week", flowId: "topic", input: { kind: "question", text: "summarize what i did on brain2 this week" } },
  { id: "topic-elijah", name: "Summarize: Elijah", flowId: "topic", input: { kind: "question", text: "summarize what i have said about elijah" } },
  { id: "day-latest", name: "Recap: latest BIM day", flowId: "day", input: { kind: "latest-day" }, grouping: "day" },
  { id: "log-latest-grouped", name: "Log: latest BIM day, grouped by time", flowId: "log", input: { kind: "latest-day" }, grouping: "grouped" },
]

const DATE_SHAPE = "\\d{4}-\\d{2}-\\d{2}|\\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \\d|\\d+ days? ago|yesterday|today"
const HOURS_SHAPE = "\\d+(\\.\\d+)?\\s*(hours?|hrs?|h\\b)"
const SHIRT_REFUSES: TestChecks = { answerNotContains: ["milf shirt"], confidenceIs: ["none", "low"] }

/**
 * Checks added to the first 22 tests (the ones in docs/BIM_FLOW_TEST_FINDINGS.md) so the sheet scores
 * a run without reading it. Each comes from a failure seen in that pass. A few fail on purpose until
 * the fix they measure is built (morning-plan, the build requests' own lane).
 */
const CHECKS: Record<string, TestChecks> = {
  "log-confit": { blocksContain: ["cooking", "walk"], proposalsContain: ["Elijah"], blocksNoOverlap: true },
  "log-routed-confit": { blocksContain: ["cooking", "walk"], proposalsContain: ["Elijah"], blocksNoOverlap: true },
  "log-routed-latest": { blocksNoOverlap: true, proposalsMaxChars: 160 },
  "log-latest-grouped": { blocksNoOverlap: true, proposalsMaxChars: 160 },
  "log-routed-phone": { answerMatches: [DATE_SHAPE], answerNotContains: ["before today"] },
  "reason-triage": { answerNotContains: ["real reason"] },
  "night-worry": { answerNotContains: ["perfect"] },
  "morning-plan": { answerNotContains: ["too few rows"] },
  "build-habit-home": { stepPorts: [{ nodeId: "g-cmd", port: "yes" }], proposalsNotContain: ["be home for more than 5 hours"] },
  "build-item": { stepPorts: [{ nodeId: "g-cmd", port: "yes" }], proposalsNotContain: ["Add 'replace bike tube' to my errands"] },
  "build-list": { stepPorts: [{ nodeId: "g-cmd", port: "yes" }], answerNotContains: ["do not record you making"] },
  "build-list-described": { stepPorts: [{ nodeId: "g-cmd", port: "yes" }], proposalsNotContain: ["somewhere to keep"] },
  "ask-shower": { answerMatches: [DATE_SHAPE], answerNotContains: ["before today"] },
  "ask-shirt": SHIRT_REFUSES,
  "ask-shirt-search": SHIRT_REFUSES,
  "ask-shirt-related": SHIRT_REFUSES,
  "ask-shirt-semantic": SHIRT_REFUSES,
  "ask-hours": { answerMatches: [HOURS_SHAPE] },
  "topic-brain2": { answerMatches: ["\\d"], answerMaxLines: 7 },
  "topic-elijah": { answerMatches: ["\\d"], answerMaxLines: 7 },
  "day-latest": { answerNotContains: ["urinary"] },
  "calc-hours": { answerMatches: [HOURS_SHAPE] },
  "calc-streak": { answerMatches: ["\\d+"] },
  "calc-since": { answerMatches: ["\\d+ (days?|hours?|minutes?)|today|yesterday"] },
  "calc-compare": { answerMatches: ["\\b(more|less|fewer|same|up|down)\\b"] },
}

const BASE_TESTS: BimTest[] = RAW_TESTS.map((t) => (CHECKS[t.id] ? { ...t, checks: { ...CHECKS[t.id], ...t.checks } } : t))

export const TESTS: BimTest[] = [...BASE_TESTS, ...REAL_TESTS]

/** The 22 tests of the first pass, in findings-doc order. "Run the 22" reruns exactly these after a change. */
export const CORE_TEST_IDS = [
  "log-confit", "log-routed-confit", "log-routed-latest", "log-routed-phone", "reason-triage", "night-worry", "morning-plan",
  "build-habit-home", "build-item", "build-list", "build-list-described",
  "ask-shower", "ask-shirt", "ask-shirt-search", "ask-shirt-related", "ask-shirt-semantic", "ask-hours", "ask-unknown",
  "topic-brain2", "topic-elijah", "day-latest", "log-latest-grouped",
]

export interface TestDeps {
  call: ModelCall
  snap: VaultSnapshot
  model: string
  rank?: Ranker
  /** Setup name stored on the result. */
  label?: string
  /** Models for gate-like and for prose steps. */
  models?: ModelPlan
  getFlow: (id: FlowId) => Flow
  /** The most recent BIM day, oldest message first. */
  latestDay: () => { day: string; rows: FeedLine[] } | null
  signal?: AbortSignal
  onProgress?: (text: string) => void
  /** A node is about to run (live view). `index` is which input. */
  onStart?: (index: number, nodeId: string) => void
  /** A node finished. */
  onStep?: (index: number, step: StepRec) => void
}

const label = (t: BimTest) =>
  `${t.input.kind === "latest-day" ? "latest day" : t.input.kind === "paste" ? "pasted lines" : "question"} · ${t.grouping ?? "each"}${t.augment?.length ? ` + ${t.augment.join(" + ")}` : ""}`

export function judgeChecks(t: BimTest, run: FlowRun): { label: string; ok: boolean }[] {
  const c = t.checks ?? {}
  const answers = run.messages.flatMap((m) => m.answers)
  const text = answers.map((a) => a.text.toLowerCase()).join(" ")
  const blocks = run.blocks.map((b) => b.activity.toLowerCase())
  const props = run.messages.flatMap((m) => m.proposals.map((p) => p.summary.toLowerCase()))
  const out: { label: string; ok: boolean }[] = []
  for (const w of c.answerContains ?? []) out.push({ label: `answer says "${w}"`, ok: text.includes(w.toLowerCase()) })
  for (const w of c.answerNotContains ?? []) out.push({ label: `answer avoids "${w}"`, ok: !text.includes(w.toLowerCase()) })
  if (c.confidenceIs) out.push({ label: `confidence is ${c.confidenceIs.join(" or ")}`, ok: answers.length > 0 && answers.every((a) => c.confidenceIs!.includes(a.confidence)) })
  for (const w of c.blocksContain ?? []) out.push({ label: `a block named "${w}"`, ok: blocks.some((b) => b.includes(w.toLowerCase())) })
  for (const w of c.proposalsContain ?? []) out.push({ label: `a suggestion naming "${w}"`, ok: props.some((p) => p.includes(w.toLowerCase())) })
  for (const w of c.proposalsNotContain ?? []) out.push({ label: `no suggestion naming "${w}"`, ok: !props.some((p) => p.includes(w.toLowerCase())) })
  if (c.proposalsMaxChars) out.push({ label: `every suggestion under ${c.proposalsMaxChars} characters`, ok: props.every((p) => p.length <= c.proposalsMaxChars!) })
  for (const re of c.answerMatches ?? []) out.push({ label: `answer matches /${re}/`, ok: answers.length > 0 && new RegExp(re, "i").test(answers.map((a) => a.text).join(" ")) })
  if (c.answerMaxLines) out.push({ label: `answer is at most ${c.answerMaxLines} lines`, ok: answers.every((a) => a.text.split("\n").filter((l) => l.trim()).length <= c.answerMaxLines!) })
  if (c.blocksNoOverlap) {
    const spans = run.blocks.map((b) => [Date.parse(b.start), Date.parse(b.end)] as const).sort((a, b) => a[0] - b[0])
    out.push({ label: "no two blocks share minutes", ok: spans.every((sp, i) => i === 0 || sp[0] >= spans[i - 1]![1]) })
  }
  for (const sp of c.stepPorts ?? []) {
    const steps = run.messages.flatMap((m) => m.steps).filter((st) => st.nodeId === sp.nodeId)
    out.push({ label: `${sp.nodeId} went ${sp.port}`, ok: steps.length > 0 && steps.every((st) => st.port === sp.port) })
  }
  return out
}

export async function runTest(t: BimTest, deps: TestDeps): Promise<TestResult> {
  const t0 = Date.now()
  const spec: InputSpec = { ...DEFAULT_INPUT, grouping: t.grouping ?? "each", augment: t.augment ?? [] }
  const base = { id: `${t.id}-${t0}`, testId: t.id, name: t.name, at: new Date(t0).toISOString(), model: deps.model, flowId: t.flowId, inputLabel: label(t), label: deps.label, models: deps.models }
  try {
    const latest = deps.latestDay()
    let messages =
      t.input.kind === "question"
        ? [questionMessage(t.input.text)]
        : t.input.kind === "paste"
          ? group(parsePasted(t.input.text, "2026-10-30"), spec)
          : group(latest?.rows ?? [], spec)
    if (messages.length === 0) throw new Error("No messages to run (no BIM day is loaded).")
    if (t.input.kind === "paste" && spec.grouping === "each") messages = parsePasted(t.input.text, "2026-10-30")
    const aug = await augment(messages, spec, { snap: deps.snap, call: deps.call, signal: deps.signal })
    deps.onProgress?.(`${t.name}`)
    const run = await runFlow(deps.getFlow(t.flowId), t.entry ? aug.messages.map((m) => ({ ...m, entry: t.entry })) : aug.messages, deps.call, deps.snap, { model: deps.model, models: deps.models, rank: deps.rank, getFlow: (id) => deps.getFlow(id as FlowId), onStart: deps.onStart, onStep: (i, st) => deps.onStep?.(i, stepRec(deps.getFlow(t.flowId), st)) })
    const checks = judgeChecks(t, run)
    const nodeName = (id: string) => deps.getFlow(t.flowId).nodes.find((n) => n.id === id)?.label ?? id
    return {
      ...base,
      ms: Date.now() - t0,
      status: checks.length === 0 ? "review" : checks.every((c) => c.ok) ? "pass" : "fail",
      checks,
      notes: aug.notes,
      output: {
        answers: run.messages.flatMap((m) =>
          m.answers.map((a) => ({
            text: a.text,
            confidence: a.confidence,
            evidence: a.evidence.map((r, i) => `${a.used.includes(i + 1) ? "★ " : ""}${r.when} · ${r.source}: ${r.text}`),
            used: a.used,
            facts: a.facts,
            draft: a.draft,
          })),
        ),
        blocks: run.blocks.map((b) => `${localClock(b.start)}–${localClock(b.end)} ${b.activity}${b.estimated ? " (est.)" : ""}`),
        proposals: run.messages.flatMap((m) => m.proposals.map((p) => p.summary)),
        runs: run.messages.slice(0, 6).map((m) => ({ input: m.message.text.slice(0, 300), steps: m.steps.map((st) => stepRec(deps.getFlow(t.flowId), st)) })),
        trace: run.messages[0]?.steps.map((s) => `${nodeName(s.nodeId)} ${s.error ? "ERR " + s.error : s.port !== "out" ? s.port : ""} ${s.ms}ms`.trim()) ?? [],
      },
    }
  } catch (err) {
    return {
      ...base,
      ms: Date.now() - t0,
      status: "error",
      checks: [],
      notes: [],
      output: { answers: [], blocks: [], proposals: [], trace: [], error: err instanceof Error ? err.message : String(err) },
    }
  }
}

/** `HH:MM` on this device's clock; the ISO string is UTC. */
const localClock = (iso: string): string => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

const RESULTS_KEY = "bimflow-tests-v1"
const BASELINE = "baseline · before fallback lane, command examples, merged Ask gates"

/** Results saved before runs were labelled get a label. Nothing is removed. */
export function labelled(rows: TestResult[]): TestResult[] {
  return rows.map((r) => (r.label ? r : { ...r, label: `${BASELINE} · ${r.model}` }))
}

export function loadResults(): TestResult[] {
  try {
    const raw = localStorage.getItem(RESULTS_KEY)
    return raw ? labelled(JSON.parse(raw) as TestResult[]) : []
  } catch {
    return []
  }
}

/**
 * Keeps every result. If the device refuses the full size, the heavy part (the per-step replay, which
 * is also on disk in `data/bim-flow-runs/`) is dropped from the oldest results first, one at a time,
 * and each of those keeps its status, checks, answer, and timing.
 */
export function saveResults(rows: TestResult[]): TestResult[] {
  const kept = rows.map((r) => ({ ...r }))
  for (let slim = kept.length; slim >= 0; slim--) {
    try {
      localStorage.setItem(RESULTS_KEY, JSON.stringify(kept))
      return kept
    } catch {}
    const r = kept[slim - 1]
    if (r?.output.runs) kept[slim - 1] = { ...r, output: { ...r.output, runs: undefined } }
  }
  return kept
}

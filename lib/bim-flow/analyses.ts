/**
 * lib/bim-flow/analyses.ts — A catalog of things BIM looks for in the Data screens
 *
 * An analysis is a dataset (miss reasons, ritual answers, pushed tasks…), a
 * slice of it, and a lens: what to look for. Each one becomes a node graph
 * (`buildAnalysisFlow`): read the table, read its newest rows again, then three
 * insight nodes in order (patterns and thought patterns, questions, ideas).
 * Code counts, drops any insight that cites no real line, and drops repeats of
 * what is already in the log. The built-ins here are a start; every one can be
 * edited, copied, or hidden, and new ones added from the Analyses sheet.
 * Nothing here writes the app: results land in the insight log.
 */

import type { ModelCall } from "./ollama"
import { runFlow } from "./run-flow"
import type { Flow, FlowEdge, FlowMessage, FlowNode, FlowPort, Insight, InsightKind } from "./types"
import type { Dataset, VaultSnapshot } from "./vault-search"

export interface AnalysisDef {
  id: string
  name: string
  group: string
  datasetId: string
  /** What to look for, in plain words. It is the instruction the insight nodes read. */
  lens: string
  /** Keep only rows whose source contains one of these. */
  sources?: string[]
  /** Only this many days back. */
  days?: number
  /** Only rows containing these words. */
  focus?: string
  kinds: InsightKind[]
  maxInsights: number
  /** Fewer rows than this and it says so. */
  minRows: number
  enabled: boolean
  builtin?: boolean
  /** Added after the built-in insight rules, for this analysis only. */
  extra?: string
}

const ALL: InsightKind[] = ["pattern", "thought_pattern", "question", "idea"]

function def(id: string, group: string, name: string, datasetId: string, lens: string, rest: Partial<AnalysisDef> = {}): AnalysisDef {
  return { id, group, name, datasetId, lens, kinds: ALL, maxInsights: 3, minRows: 6, enabled: true, builtin: true, ...rest }
}

const TOKENS: [string, string, string][] = [
  ["no-energy", "No energy", "When does low energy show up, and what came before it (a late night, a long block, a hard task)? Do the same tasks get this reason every time?"],
  ["procrastination", "Procrastination", "What do the tasks given this reason have in common (size, who they involve, unclear first step, fear of the result)? Does the wording say avoidance or something else?"],
  ["no-time", "No time", "Is 'no time' true of the days it is given? Compare to how many rows the same days show for other things. Which tasks are always out of time and could be smaller?"],
  ["missing-input", "Missing input", "What input is missing, and is it the same one each time (a person, a file, a decision)? Which could be asked for once?"],
  ["blocked-by-other", "Blocked by other", "Who or what blocks, and does it repeat? Which blocks could be unblocked by one message?"],
  ["other", "Other", "Read the words typed beside 'other'. Which reasons are really one of the presets in disguise, and which are new kinds of reason?"],
]

const RITUAL_SLICES: [string, string, string, string][] = [
  ["gratitude", "Gratitude", "Gratitude", "What does the person keep being grateful for, and what never appears? Notice people, places, and things that repeat, and ones that stopped."],
  ["look-back", "Look back", "Look back", "How does the person judge their own day or week afterward? Quote the repeated judgments and what they measure against."],
  ["plan-reflection", "Plan reflection", "Plan reflection", "How does the plan compare to what happened, in their own words? Where does the gap repeat?"],
  ["next-plans", "Next plans", "Next plans", "Which plans are written again and again? Compare what is planned to what later rows say happened."],
  ["time-reflection", "Time reflection", "Time reflection", "What does the person say about how they spent time? Which activities do they call wasted, and which do they call worth it?"],
  ["tomorrow-matters", "Tomorrow matters", "Tomorrow matters", "What is named as the one thing that matters tomorrow, and how often is it the same thing?"],
  ["wake-reminder", "Wake reminder", "Wake reminder", "What does the person tell their future self on waking? Which reminders repeat because they did not work?"],
  ["morning", "Morning answers", "morning", "In the morning ritual, what intentions, best-day reasons, and affirmations repeat? Which seem to carry over to the night answers?"],
  ["reflection", "Reflection questions", "reflection", "Across the shared reflection questions, which answers repeat in new words? Which questions get thin answers?"],
  ["summary", "Summaries", "Summary", "What does each period's summary dwell on? What is left out that other rows show happened?"],
]

export const BUILTIN_ANALYSES: AnalysisDef[] = [
  // Why things do not get done
  def("why-recurring", "Why things don't get done", "Reasons that repeat", "miss-reasons", "Which reasons repeat, and does the person's own wording behind a preset reason say the same thing as the preset?"),
  def("why-token-vs-words", "Why things don't get done", "Preset vs typed words", "miss-reasons", "Find rows where the preset reason and the typed words disagree (say 'no time' but the words describe avoidance or tiredness). What does that suggest the real reason is?", { kinds: ["pattern", "thought_pattern", "question"] }),
  def("why-push", "Why things don't get done", "Pushes: reasons given", "miss-reasons", "Why does the person push tasks to later? Which tasks are pushed for the same reason again and again?", { sources: ["Push"] }),
  def("why-habit", "Why things don't get done", "Habit misses", "miss-reasons", "Why are habits missed? Which habits share a reason, and which are missed in a way that says the habit is set wrong (too big, wrong time)?", { sources: ["Habit"] }),
  def("why-ritual", "Why things don't get done", "Blocked in rituals", "miss-reasons", "What does the person say blocked them when they review a day or week? Which blockers repeat across rituals?", { sources: ["Ritual"] }),
  def("why-missed", "Why things don't get done", "Missed for good", "miss-reasons", "For tasks marked missed (no longer possible), what was the reason, and what was the last warning sign before it?", { sources: ["Missed task"] }),
  def("why-missed-op", "Why things don't get done", "Missed operations", "miss-reasons", "Why do multi-step operations stall? Which step or reason repeats?", { sources: ["Missed op"] }),
  def("why-30", "Why things don't get done", "Reasons, last 30 days", "miss-reasons", "What changed in the last month: new reasons, reasons that stopped, reasons that grew?", { days: 30, minRows: 4 }),
  def("why-weekday", "Why things don't get done", "Reasons by weekday", "miss-reasons", "Do certain weekdays carry more misses, and does the reason change by weekday? Use the weekday counts in the facts.", { kinds: ["pattern", "question", "idea"] }),
  def("why-subjects", "Why things don't get done", "Subjects that keep appearing", "miss-reasons", "Which items show up under more than one reason? What makes them stall in different ways?", { kinds: ["pattern", "question", "idea"] }),
  def("why-no-reason", "Why things don't get done", "Misses with no reason given", "miss-reasons", "Which misses were left with no words? What do the unexplained ones have in common, and what is the best question to ask about each?", { kinds: ["pattern", "question"], focus: "no words" }),
  def("pushed-many", "Why things don't get done", "Tasks pushed again and again", "pushed-tasks", "Which tasks keep being placed again without being done? What do they share (size, kind, who they involve, an unclear first step)?", { minRows: 5 }),
  def("pushed-reasons-change", "Why things don't get done", "Do the reasons change?", "pushed-tasks", "For tasks with several reasons, do the reasons change from push to push? A changing reason can mean none of them is the real one.", { kinds: ["pattern", "thought_pattern", "question"], focus: "reasons given" }),
  def("pushed-silent", "Why things don't get done", "Pushed with no reason", "pushed-tasks", "Which tasks were pushed repeatedly with no reason at all? Ask about the most-pushed ones.", { kinds: ["question", "idea"], focus: "no reason given" }),
  ...TOKENS.map(([token, label, lens]) =>
    def(`why-token-${token}`, "Why things don't get done", `Reason: ${label}`, "miss-reasons", lens, { sources: [token], minRows: 4 }),
  ),

  // Rituals
  ...RITUAL_SLICES.map(([id, name, source, lens]) =>
    def(`ritual-${id}`, "Rituals", `Ritual: ${name}`, "ritual-answers", lens, { sources: [source], minRows: 5 }),
  ),
  def("ritual-worries", "Rituals", "Worries across rituals", "ritual-answers", "Which worries, fears, or 'should' statements appear in several rituals, and in what words? Quote the repeats.", { kinds: ["pattern", "thought_pattern", "question"] }),
  def("ritual-self-talk", "Rituals", "Self-talk wording", "ritual-answers", "What is the shape of the person's self-talk: all-or-nothing words, waiting for the right moment, comparing to a plan, praise, blame? Quote exact words; do not diagnose.", { kinds: ["thought_pattern", "question"] }),
  def("ritual-day", "Rituals", "Day rituals only", "ritual-answers", "What is on the person's mind at the close of a day? Which themes recur across days?", { sources: ["day ritual"] }),
  def("ritual-week", "Rituals", "Week rituals only", "ritual-answers", "What do weekly reviews say that daily ones do not?", { sources: ["week ritual"], minRows: 4 }),
  def("ritual-month", "Rituals", "Month rituals only", "ritual-answers", "What do monthly reviews say about direction over time?", { sources: ["month ritual"], minRows: 3 }),
  def("ritual-30", "Rituals", "Rituals, last 30 days", "ritual-answers", "What is different in the last month of ritual answers: new themes, themes that vanished?", { days: 30, minRows: 6 }),
  def("ritual-vs-reasons", "Rituals", "What rituals say vs what stalls", "ritual-answers", "Which intentions and plans in the rituals are about the same things that appear stalled elsewhere? Ask about the gap.", { kinds: ["question", "idea"], extra: "Name the intention and quote it." }),

  // Thinking and mood
  def("thoughts-themes", "Thinking", "Thought-process themes", "thoughts", "What themes repeat across the person's logged thinking? Which ones are about the same unsolved problem?", { minRows: 6 }),
  def("thoughts-style", "Thinking", "How the thinking moves", "thoughts", "How does the person reason: list-making, worry loops, planning in a burst, circling one question? Quote the words that show it.", { kinds: ["thought_pattern", "question"] }),
  def("thoughts-30", "Thinking", "Thoughts, last 30 days", "thoughts", "What is new in the thinking this month?", { days: 30, minRows: 4 }),
  def("mood-words", "Thinking", "Mood words", "moods", "Which mood words and written notes repeat? What do the notes say were around them?", { minRows: 8 }),
  def("mood-weekday", "Thinking", "Mood by weekday", "moods", "Do moods cluster on certain weekdays? Use the weekday counts.", { kinds: ["pattern", "question", "idea"], minRows: 12 }),
  def("mood-low", "Thinking", "Low moods", "moods", "What is written around low or sick moods, and what repeats before them?", { focus: "low sick anx tired stress", minRows: 4 }),
  def("mood-good", "Thinking", "Good moods", "moods", "What is written around great or good moods? What repeats and could be done on purpose?", { focus: "great good happy excited engaged", minRows: 4 }),

  // Drive: resistance and excitement about tasks
  def("drive-resist-why", "Drive", "Why a task is resisted", "drive", "For tasks with resistance, what reasons are given, and do they repeat across tasks (unclear first step, fear of the result, size, a person involved)? Quote the reason and name the task.", { sources: ["resistance"], minRows: 4 }),
  def("drive-excite-why", "Drive", "Why a task is exciting", "drive", "For tasks with excitement, what reasons are given? What do the exciting tasks share (novelty, a person, a visible result) that a resisted task could borrow?", { sources: ["excitement"], minRows: 4 }),
  def("drive-flips", "Drive", "Tasks that flip", "drive", "Which tasks show both excitement and resistance at different times? What changed between the two readings, according to the words?", { kinds: ["pattern", "thought_pattern", "question"], minRows: 4 }),
  def("drive-no-reason", "Drive", "Feelings with no reason", "drive", "Which strong feelings about a task have no reason given? Ask about the strongest ones.", { kinds: ["question", "idea"], focus: "no reason given", minRows: 3 }),
  def("drive-vs-pushed", "Drive", "Drive vs what gets pushed", "drive", "Compare the tasks the person resists with the tasks they push or miss elsewhere. Is the resistance the real reason, and does the stated reason match?", { kinds: ["question", "idea"], minRows: 4 }),
  def("drive-scores", "Drive", "Where the scores stand", "drive", "Read the 'score now' rows. Which next actions have high excitement and low resistance (start there), and which have high resistance that a smaller first step could lower?", { sources: ["score now"], kinds: ["pattern", "idea"], minRows: 3 }),

  // Loop
  def("loop-answers", "Loop", "What your answers changed", "insight-log", "Look at the questions BIM asked and the answers given. Which answers change what the person should do or track?", { kinds: ["idea", "question"], minRows: 3 }),
  def("loop-kept", "Loop", "Kept insights that return", "insight-log", "Which kept patterns say nearly the same thing? Merge them into one stronger statement and say what to watch.", { kinds: ["pattern", "idea"], minRows: 4 }),
]

export function newAnalysis(partial: Partial<AnalysisDef> = {}): AnalysisDef {
  return {
    id: `x-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    name: "New analysis",
    group: "Mine",
    datasetId: "miss-reasons",
    lens: "",
    kinds: ALL,
    maxInsights: 3,
    minRows: 6,
    enabled: true,
    ...partial,
  }
}

// ---- the node graph for one analysis ----

const COL = 230
const ROW = 118
function n(id: string, kind: FlowNode["kind"], label: string, col: number, row: number, config: FlowNode["config"] = {}): FlowNode {
  return { id, kind, label, x: 30 + col * COL, y: 30 + row * ROW, config }
}
function e(from: string, to: string, port: FlowPort = "out"): FlowEdge {
  return { id: `${from}>${to}:${port}`, from, to, port }
}

export function buildAnalysisFlow(a: AnalysisDef): Flow {
  const has = (k: InsightKind) => a.kinds.includes(k)
  const common = { minRows: a.minRows, lens: a.lens, extra: a.extra }
  const nodes: FlowNode[] = [
    n("msg", "message", a.name.slice(0, 22), 0, 1),
    n("r-all", "retrieve", "Newest rows + counts", 1, 1, { retrieve: { kind: "dataset", datasetId: a.datasetId, sources: a.sources, days: a.days, focus: a.focus, limit: 40 } }),
    n("r-recent", "retrieve", "Last 3 weeks", 2, 1, { retrieve: { kind: "dataset", datasetId: a.datasetId, sources: a.sources, days: 21, focus: a.focus, limit: 14 } }),
  ]
  const edges: FlowEdge[] = [e("msg", "r-all"), e("r-all", "r-recent")]
  let prev = "r-recent"
  let col = 3
  const step = (id: string, label: string, kinds: InsightKind[], max: number, extra?: string) => {
    nodes.push(n(id, "answer", label, col++, 1, { ...common, mode: "insight", fromNodeIds: ["r-all", "r-recent"], insightKinds: kinds, maxInsights: max, extra: [a.extra, extra].filter(Boolean).join(" ") || undefined }))
    edges.push(e(prev, id))
    prev = id
  }
  const reading = a.kinds.filter((k) => k === "pattern" || k === "thought_pattern")
  if (reading.length) step("a-pattern", "Patterns", reading, Math.min(a.maxInsights, 3), "Return patterns first. A thought pattern must quote the person's words.")
  if (has("question")) step("a-ask", "Questions to ask", ["question"], Math.min(a.maxInsights, 2), "Ask about the specific rows you cite. Prefer rows with no words, rows that contradict another row, and the most repeated subject.")
  if (has("idea")) step("a-idea", "Ideas to try", ["idea"], 1, "Build on what was already found; do not repeat it. One small change.")
  return { version: 1, nodes, edges }
}

// ---- storage: edits to built-ins, new analyses, hidden ones ----

const DEFS_KEY = "bimflow-analyses-v1"
interface Saved {
  defs: Record<string, AnalysisDef>
  hidden: string[]
}

function readSaved(): Saved {
  try {
    const raw = localStorage.getItem(DEFS_KEY)
    if (raw) return JSON.parse(raw) as Saved
  } catch {}
  return { defs: {}, hidden: [] }
}

export function loadAnalyses(): AnalysisDef[] {
  const saved = readSaved()
  const hidden = new Set(saved.hidden)
  const out = BUILTIN_ANALYSES.filter((b) => !hidden.has(b.id)).map((b) => saved.defs[b.id] ?? b)
  const custom = Object.values(saved.defs).filter((d) => !d.builtin)
  return [...out, ...custom]
}

export function saveAnalyses(all: AnalysisDef[]): void {
  const defs: Record<string, AnalysisDef> = {}
  const builtins = new Map(BUILTIN_ANALYSES.map((b) => [b.id, b]))
  for (const a of all) if (!builtins.has(a.id) || JSON.stringify(builtins.get(a.id)) !== JSON.stringify(a)) defs[a.id] = a
  const have = new Set(all.map((a) => a.id))
  try {
    localStorage.setItem(DEFS_KEY, JSON.stringify({ defs, hidden: BUILTIN_ANALYSES.filter((b) => !have.has(b.id)).map((b) => b.id) } satisfies Saved))
  } catch {}
}

// ---- the insight log and the run log ----

export type InsightStatus = "new" | "kept" | "dismissed"

export interface LogInsight {
  id: string
  runId: string
  at: string
  analysisId: string
  analysisName: string
  group: string
  kind: InsightKind
  text: string
  strength: Insight["strength"]
  /** The cited evidence lines, as the model saw them. */
  evidence: string[]
  model: string
  status: InsightStatus
  /** For a question: what the person answered. */
  answer?: string
  answeredAt?: string
}

export interface RunRecord {
  id: string
  at: string
  analysisId: string
  analysisName: string
  model: string
  ms: number
  rows: number
  kept: number
  dropped: number
  note?: string
  error?: string
}

const LOG_KEY = "bimflow-insights-v1"
const RUNS_KEY = "bimflow-analysis-runs-v1"

function readList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}
function writeList<T>(key: string, rows: T[], keep: number): T[] {
  const kept = rows.slice(0, keep)
  try {
    localStorage.setItem(key, JSON.stringify(kept))
  } catch {}
  return kept
}

export const loadInsightLog = () => readList<LogInsight>(LOG_KEY)
export const saveInsightLog = (rows: LogInsight[]) => writeList(LOG_KEY, rows, 1500)
export const loadRunLog = () => readList<RunRecord>(RUNS_KEY)
export const saveRunLog = (rows: RunRecord[]) => writeList(RUNS_KEY, rows, 400)

/** Kept patterns and answered questions, read back by the "Loop" analyses. */
export function logDataset(log: LogInsight[]): Dataset {
  return {
    id: "insight-log",
    label: "BIM's insight log",
    blurb: "Insights the person kept and questions they answered.",
    rows: log
      .filter((i) => i.status === "kept" || i.answer)
      .map((i) => ({
        date: i.at.slice(0, 10),
        source: i.answer ? "answered question" : `kept ${i.kind}`,
        text: i.answer ? `${i.text} — answer: ${i.answer}` : i.text,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  }
}

export const DATASET_LABELS: Record<string, string> = {
  "miss-reasons": "Why things did not get done",
  "ritual-answers": "Ritual answers",
  "pushed-tasks": "Tasks that keep getting pushed",
  thoughts: "Thought process notes",
  moods: "Moods tracked",
  "insight-log": "BIM's insight log",
  drive: "Resistance and excitement about tasks",
}

// ---- running one ----

export interface AnalysisDeps {
  call: ModelCall
  snap: VaultSnapshot
  model: string
  getFlow: (a: AnalysisDef) => Flow
  known: string[]
  runId: string
}

export async function runAnalysis(a: AnalysisDef, deps: AnalysisDeps): Promise<{ insights: LogInsight[]; record: RunRecord }> {
  const t0 = Date.now()
  const at = new Date(t0).toISOString()
  const base = { id: `${deps.runId}:${a.id}`, at, analysisId: a.id, analysisName: a.name, model: deps.model }
  try {
    const message: FlowMessage = { id: base.id, text: a.lens || a.name, at, prior: [] }
    const run = await runFlow(deps.getFlow(a), [message], deps.call, deps.snap, { model: deps.model, known: deps.known })
    const answers = run.messages.flatMap((m) => m.answers)
    const insights: LogInsight[] = answers.flatMap((ans) =>
      (ans.insights ?? []).map((i, j) => ({
        id: `${base.id}:${ans.nodeId}:${j}`,
        runId: base.id,
        at,
        analysisId: a.id,
        analysisName: a.name,
        group: a.group,
        kind: i.kind,
        text: i.text,
        strength: i.strength,
        evidence: i.cites.map((c) => ans.evidence[c - 1]).filter(Boolean).map((r) => `${r!.when} · ${r!.source}: ${r!.text}`),
        model: deps.model,
        status: "new" as const,
      })),
    )
    const thin = answers.find((x) => /^Too few rows/.test(x.text))
    return {
      insights,
      record: {
        ...base,
        ms: Date.now() - t0,
        rows: answers[0]?.evidence.length ? run.messages[0]?.steps.find((s) => (s.output as { total?: number } | null)?.total != null)?.output
          ? Number((run.messages[0]!.steps.find((s) => (s.output as { total?: number }).total != null)!.output as { total: number }).total)
          : 0
          : 0,
        kept: insights.length,
        dropped: answers.reduce((n, x) => n + (x.dropped ?? 0), 0),
        note: thin?.text,
      },
    }
  } catch (err) {
    return { insights: [], record: { ...base, ms: Date.now() - t0, rows: 0, kept: 0, dropped: 0, error: err instanceof Error ? err.message : String(err) } }
  }
}

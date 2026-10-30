/**
 * lib/bim-flow/suggestions.ts — The flow's guesses about the last week, minus what Brain2 already holds
 *
 * Reads the week's BIM messages and the person's sent text bursts through the routed Log flow, and
 * Mac Screen Time and file saves through the person's declared rules (code, no model). What comes
 * out is three kinds of suggestion: time blocks, items for a list, habit completions. Each is
 * checked against the vault and dropped when it is already saved: a block over time that has an
 * Activity entry, an item whose title is already an item, a habit already done that day.
 * Nothing here writes the vault. A message's result is kept per device, so a second pass only
 * asks the model about messages it has not seen.
 */

import { dayOf, runsOf, DECLARED_FOLDERS, type FileEvent } from "./file-activity"
import { assembleBlocks, fitToUnknown } from "./blocks"
import { localDateKey, type Span } from "./day-context"
import { withPrior } from "./inputs"
import type { ModelCall } from "./ollama"
import { runMessage } from "./run-flow"
import { byDay, DECLARED_APPS, runs } from "./screen-presence"
import { textsToFeed, type TextRow } from "./texts"
import type { ActivitySignal, Flow, FlowMessage, ModelPlan, Proposal, TimeBlock } from "./types"
import type { HistoryEntry, VaultSnapshot } from "./vault-search"

export type SuggestionKind = "timeblock" | "item" | "habit"
export type SuggestionSource = "bim" | "text" | "screen" | "files"

/** One section of the LLM tab each. Adding a kind is a row here, a `collect` branch, and a render line. */
export const SUGGESTION_KINDS: { kind: SuggestionKind; label: string; empty: string }[] = [
  { kind: "timeblock", label: "LLM SUGGESTED TIMEBLOCKS", empty: "NO UNSAVED TIME BLOCKS THIS WEEK." },
  { kind: "item", label: "LLM SUGGESTED ITEMS", empty: "NO UNSAVED ITEMS THIS WEEK." },
  { kind: "habit", label: "LLM SUGGESTED HABIT COMPLETIONS", empty: "NO UNSAVED HABIT COMPLETIONS THIS WEEK." },
]

export interface Suggestion {
  id: string
  kind: SuggestionKind
  title: string
  /** One line: the span, the list, or the habit's day. */
  detail: string
  /** ISO. Sorts newest first. For a block, its start. */
  at: string
  end?: string
  estimated?: boolean
  source: SuggestionSource
  /** Why the flow thinks so, in a few words. */
  why: string
  /** The lines it rests on, oldest first. */
  evidence: string[]
  /** item: the list the flow picked, when it picked one. */
  list?: string
  /** habit: the habit to mark. */
  habitId?: string
}

export const WEEK_DAYS = 7
const MIN = 60_000
const MIN_BLOCK_MIN = 10

/** A message's flow result, slim enough to keep. */
export interface StoredResult {
  signals: ActivitySignal[]
  proposals: Proposal[]
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim()

function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

const stamp = (iso: string) => {
  const d = new Date(iso)
  return `${localDateKey(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** The cut-off for "last week": the start of the day six days ago. */
export function weekStart(now: Date): Date {
  const d = new Date(now)
  d.setDate(d.getDate() - (WEEK_DAYS - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

const dayStartMs = (date: string) => {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y!, m! - 1, d!).getTime()
}

/** Saved Activity time as epoch spans: every Activity entry with a length, guessed or confirmed. */
export function savedActivitySpans(entries: HistoryEntry[]): Span[] {
  return entries
    .filter((e) => e.scope === "activity" && !e.instant && e.endMin > e.startMin)
    .map((e) => ({ start: dayStartMs(e.date) + e.startMin * MIN, end: dayStartMs(e.date) + e.endMin * MIN }))
}

/** Messages the flow reads: the week's BIM lines and the person's sent text bursts, each with the few before it. */
export function weekMessages(feed: { id: string; at: string; text: string }[], texts: TextRow[], now: Date): { messages: FlowMessage[]; source: Map<string, SuggestionSource> } {
  const since = weekStart(now).getTime()
  const source = new Map<string, SuggestionSource>()
  const lines = feed
    .filter((r) => Date.parse(r.at) >= since && Date.parse(r.at) <= now.getTime() && readable(r.text))
    .sort((a, b) => a.at.localeCompare(b.at))
  const mine = textsToFeed(
    texts.filter((t) => t.dir === "out" && Date.parse(t.at) >= since),
    "bursts",
  )
  for (const l of lines) source.set(l.id, "bim")
  for (const l of mine) source.set(l.id, "text")
  const messages = [...withPrior(lines), ...withPrior(mine.sort((a, b) => a.at.localeCompare(b.at)))]
  return { messages, source }
}

/** A bare link, a scan placeholder, or a single digit says nothing to read. */
export function readable(text: string): boolean {
  const t = text.trim()
  return !!t && !/^https?:\/\//i.test(t) && !/^\(\d+ scans?\)$/.test(t) && !/^\d{1,2}$/.test(t)
}

/** Blocks the declared app and folder rules give, in time the person has not covered. Code only. */
export function ruleBlocks(snap: VaultSnapshot, files: FileEvent[], now: Date): TimeBlock[] {
  const entries = snap.history?.entries ?? []
  const out: TimeBlock[] = []
  for (let i = 0; i < WEEK_DAYS; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const date = localDateKey(d)
    const base = dayStartMs(date)
    const at = (m: number) => new Date(base + m * MIN).toISOString()
    for (const rule of DECLARED_APPS) {
      const pings = byDay(entries, (e) => e.scope === "screentime" && e.pen.toLowerCase() === rule.app.toLowerCase()).get(date) ?? []
      for (const [a, b] of runs(pings)) {
        out.push({ activity: rule.activity, start: at(a), end: at(b), estimated: true, why: `${rule.app} was open (your rule: ${rule.app} means ${rule.activity})`, evidence: [`Screen Time: ${rule.app} ${a}–${b} min of ${date}`] })
      }
    }
    const day = files.filter((x) => dayOf(x.at) === date)
    for (const rule of DECLARED_FOLDERS) {
      for (const [a, b, n] of runsOf(day.filter((x) => x.p.toLowerCase().replace(/:/g, "/").includes(rule.needle)), 20)) {
        if (n < 3 || b - a < 15) continue
        out.push({ activity: rule.activity, start: at(a), end: at(b), estimated: true, why: `${n} files saved in ${rule.label} (your rule)`, evidence: [`Files: ${n} saved or changed in ${rule.label}, ${date}`] })
      }
    }
  }
  return out
}

export interface CollectInput {
  snap: VaultSnapshot
  messages: FlowMessage[]
  source: Map<string, SuggestionSource>
  results: Map<string, StoredResult>
  files: FileEvent[]
  now: Date
  /** True when the habit already has a mark for that day (any kind of habit). */
  habitDone: (habitId: string, date: string) => boolean
}

/** Turn the per-message results into suggestions, dropping everything the vault already holds. */
export function collectSuggestions(input: CollectInput): Suggestion[] {
  const { snap, messages, source, results, files, now, habitDone } = input
  const byId = new Map(messages.map((m) => [m.id, m]))
  const lineOf = (id: string) => {
    const m = byId.get(id)
    return m ? `${stamp(m.at)} ${m.text.split("\n")[0]!.slice(0, 120)}` : id
  }
  const sourceOf = (id: string): SuggestionSource => source.get(id) ?? "bim"
  const out: Suggestion[] = []
  const since = weekStart(now).getTime()

  // Time blocks: messages first, then the rules, trimmed around everything already saved and around each other.
  const signals = messages.flatMap((m) => results.get(m.id)?.signals ?? [])
  const saved = savedActivitySpans(snap.history?.entries ?? [])
  const fromMessages = fitToUnknown(assembleBlocks(signals), saved)
  const taken = [...saved, ...fromMessages.map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }))]
  const fromRules = fitToUnknown(ruleBlocks(snap, files, now), taken)
  const messageBlocks = fromMessages.map((b) => ({ b, src: sourceOf(b.evidence[0] ?? "") }))
  for (const { b, src } of [...messageBlocks, ...fromRules.map((b) => ({ b, src: (b.why.includes("files") ? "files" : "screen") as SuggestionSource }))]) {
    const start = Date.parse(b.start)
    const end = Date.parse(b.end)
    if (start < since || end > now.getTime() + MIN || (end - start) / MIN < MIN_BLOCK_MIN) continue
    out.push({
      id: `tb-${hash(`${b.activity}|${b.start}|${b.end}`)}`,
      kind: "timeblock",
      title: b.activity,
      detail: `${stamp(b.start)}–${stamp(b.end).slice(11)} · ${Math.round((end - start) / MIN)} min`,
      at: b.start,
      end: b.end,
      estimated: b.estimated,
      source: src,
      why: b.why,
      evidence: src === "bim" || src === "text" ? b.evidence.map(lineOf) : b.evidence,
    })
  }

  // Items and habit completions come from proposals. A text burst never adds an item: its words are not a note to self.
  const have = new Set(snap.items.map((i) => norm(i.title)))
  const habitByTitle = new Map(snap.habits.map((h) => [norm(h.title), h]))
  for (const m of messages) {
    const r = results.get(m.id)
    if (!r) continue
    const src = sourceOf(m.id)
    for (const p of r.proposals) {
      const picks = (p.data as { picks?: string[] }).picks ?? []
      if (p.action === "add-to-list" && src === "bim") {
        const title = m.text.trim()
        const key = norm(title)
        if (!key || have.has(key)) continue
        have.add(key)
        out.push({ id: `it-${hash(key)}`, kind: "item", list: picks[0], title, detail: `on ${picks.join(", ") || "Inbox"} · ${stamp(m.at)}`, at: m.at, source: src, why: `kept on ${picks.join(", ") || "Inbox"}`, evidence: [lineOf(m.id)] })
      }
      if (p.action === "habit-done") {
        const date = localDateKey(new Date(m.at))
        for (const name of picks) {
          const habit = habitByTitle.get(norm(name))
          if (!habit || habitDone(habit.id, date)) continue
          const id = `hb-${hash(`${habit.id}|${date}`)}`
          if (out.some((s) => s.id === id)) continue
          out.push({ id, kind: "habit", habitId: habit.id, title: habit.title, detail: `done ${date}`, at: m.at, source: src, why: "message shows it was done", evidence: [lineOf(m.id)] })
        }
      }
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

const CACHE_KEY = "bimsuggest-results-v1"

export function loadResults(): Map<string, StoredResult> {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, StoredResult>))
  } catch {
    return new Map()
  }
}

/** Keeps only the results for messages still in the week; the rest are old news. */
export function saveResults(results: Map<string, StoredResult>, liveKeys: Set<string>): void {
  const keep = Object.fromEntries([...results].filter(([key]) => liveKeys.has(key)))
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(keep))
  } catch {}
}

/** A stored result is trusted only for the same text: an edited message is asked again. */
export const resultKey = (m: FlowMessage) => `${m.id}:${hash(m.text)}`

export interface RunInput extends Omit<CollectInput, "results" | "messages" | "source"> {
  feed: { id: string; at: string; text: string }[]
  texts: TextRow[]
  flow: Flow
  call: ModelCall
  models?: ModelPlan
  signal?: AbortSignal
  getFlow?: (id: string) => Flow | undefined
  onProgress?: (done: number, total: number, cached: number) => void
  /** Called after each message with everything found so far, so the screen fills while the model works. */
  onSuggestions?: (all: Suggestion[]) => void
}

/** Run the routed flow over every message not seen before (newest first), and return the week's suggestions. */
export async function suggestWeek(input: RunInput): Promise<Suggestion[]> {
  const { messages, source } = weekMessages(input.feed, input.texts, input.now)
  const stored = loadResults()
  const results = new Map<string, StoredResult>()
  const todo: FlowMessage[] = []
  let cached = 0
  for (const m of messages) {
    const hit = stored.get(resultKey(m))
    if (hit) {
      results.set(m.id, hit)
      cached++
    } else todo.push(m)
  }
  const collect = () => collectSuggestions({ ...input, messages, source, results })
  input.onSuggestions?.(collect())
  const order = [...todo].sort((a, b) => b.at.localeCompare(a.at))
  for (const [i, m] of order.entries()) {
    if (input.signal?.aborted) break
    input.onProgress?.(i, order.length, cached)
    try {
      const run = await runMessage(input.flow, m, input.call, input.snap, undefined, undefined, [], input.getFlow, 0, undefined, input.models)
      const result: StoredResult = { signals: run.signals, proposals: run.proposals }
      results.set(m.id, result)
      stored.set(resultKey(m), result)
    } catch {
      continue
    }
    input.onSuggestions?.(collect())
    if (i % 5 === 4) saveResults(stored, new Set(messages.map(resultKey)))
  }
  saveResults(stored, new Set(messages.map(resultKey)))
  input.onProgress?.(order.length, order.length, cached)
  return collect()
}

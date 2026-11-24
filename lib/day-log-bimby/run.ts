/**
 * lib/day-log-bimby/run.ts — Build a Day Log, amend it, and keep logs current
 *
 * `buildDayLog(date)`: read the sources, gather the ledger, ask the model for
 * the narrative (when LLM mode is on), render, and file the doc. One build at a
 * time. A build with no model reuses the day's last narrative from this device's
 * cache, so an amendment made with the model off does not wipe the prose.
 *
 * `amendDayLog(date, text)`: keep the words, then rebuild.
 *
 * `startDayLogBimby()`: the automatic pipeline (desktop only; the phone is not a
 * writer). After the vault loads and every hour: today is refreshed (code only,
 * cached prose kept), yesterday is finished with the model once the day is over,
 * and up to two of the last seven days with data and no log are built.
 */
"use client"

import type { ModelCall } from "@/lib/bim-flow/ollama"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useBimLlmMode } from "@/lib/ingest/bim-switchboard"
import { isPhoneWebStorage } from "@/lib/phone-device"
import { useTaskStore } from "@/lib/task-store"
import { afterPersistHydrated } from "@/lib/use-persist-hydrated"
import { makeAmendment, readDayLogAsk } from "./amend"
import { composeNarrative } from "./compose"
import { dayLogDocId, fileDayLog, handEdited } from "./file"
import { gatherDay, MINUTES_PER_DAY } from "./gather"
import { DAY_LOG_FOLDER, dayLogTitle, renderDayLog } from "./render"
import { readDaySources } from "./sources"
import { autoPlan } from "./schedule"
import { amendmentsFor, dayLogRecord, useDayLogStore } from "./store"
import type { Amendment, DayNarrative, DaySources } from "./types"

/** Raised on `window` after a Day Log doc is written, so an open editor reloads it. */
export const DAY_LOG_WRITTEN_EVENT = "brain2:day-log-written"

export interface BuildOpts {
  /** Ask the model. Default: BIM's LLM mode. */
  llm?: boolean
  /** A model to use instead of the chat crew (tests). Null means none. */
  call?: ModelCall | null
  /** An automatic run: a hand-edited doc is left alone. */
  auto?: boolean
  now?: Date
  /** Sources to use instead of the stores (tests). */
  sources?: DaySources
  onProgress?: (note: string) => void
}

export type BuildResult =
  | { status: "built"; date: string; docId: string; rows: number; narrated: boolean; version: number; keptCopyId?: string; model?: string }
  | { status: "skipped"; date: string; reason: string }

// ---------------------------------------------------------------- narrative cache (this device only)

const CACHE_KEY = "brain2-day-log-narratives"
const CACHE_DAYS = 21

function readCache(): Record<string, DayNarrative> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, DayNarrative>
  } catch {
    return {}
  }
}

function cacheNarrative(date: string, n: DayNarrative): void {
  try {
    const all = { ...readCache(), [date]: n }
    const keep = Object.keys(all).sort().slice(-CACHE_DAYS)
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(keep.map((k) => [k, all[k]]))))
  } catch {
    /* a full origin must not fail a build */
  }
}

// ---------------------------------------------------------------- the model

async function modelFor(opts: BuildOpts): Promise<{ call: ModelCall; model?: string } | null> {
  if (opts.call !== undefined) return opts.call ? { call: opts.call } : null
  const llm = opts.llm ?? useBimLlmMode.getState().on
  if (!llm) return null
  try {
    const [{ chatCrew }, { ollamaCall }] = await Promise.all([import("@/lib/bim-flow/chat-models"), import("@/lib/bim-flow/ollama")])
    const crew = await chatCrew()
    return crew ? { call: ollamaCall(crew.main), model: crew.main } : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- build

let chain: Promise<unknown> = Promise.resolve()

/** Build (or rebuild) one day's log. Builds run one at a time, in the order asked. */
export function buildDayLog(date: string, opts: BuildOpts = {}): Promise<BuildResult> {
  const run = chain.then(() => buildNow(date, opts))
  chain = run.catch(() => undefined)
  return run
}

async function buildNow(date: string, opts: BuildOpts): Promise<BuildResult> {
  const now = opts.now ?? new Date()
  const today = formatLocalDateKey(now)
  if (date > today) return { status: "skipped", date, reason: "that day has not happened yet" }
  const record = dayLogRecord(date)
  const edited = await handEdited(date, record?.bodyHash)
  if (edited && opts.auto) return { status: "skipped", date, reason: "the doc was edited by hand; rebuild it yourself to fold in new rows (your edited copy is kept)" }

  const sources = opts.sources ?? readDaySources(date)
  const evidence = gatherDay(sources)
  const untilMin = date === today ? now.getHours() * 60 + now.getMinutes() : MINUTES_PER_DAY
  const amendments = sources.amendments

  const version = (record?.version ?? 0) + 1
  const cached = readCache()[date] ?? null
  const STALE = "narrative from an earlier build; newer rows and amendments are in the lists but not yet in the prose"

  const write = async (narrative: DayNarrative | null, note: string | undefined, keepHandEdits: boolean) => {
    const html = renderDayLog({ date, evidence, narrative, amendments, builtAt: now, version, untilMin, ...(note ? { note } : {}) })
    const filed = await fileDayLog(date, html, { keepHandEdits })
    useDayLogStore.getState().putLog({ id: date, docId: filed.docId, builtAt: now.toISOString(), version, bodyHash: filed.bodyHash, rows: evidence.length, narrated: !!narrative, ...(narrative?.model ? { model: narrative.model } : {}) })
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(DAY_LOG_WRITTEN_EVENT, { detail: { docId: filed.docId, date } }))
    return filed
  }

  const model = evidence.length ? await modelFor(opts) : null
  // The complete code-built log goes in first, so a reload or a dead model mid-way still leaves every row filed.
  const first = await write(cached, model ? "the narrative is being written" : cached ? STALE : undefined, edited)
  let narrative = cached
  let fresh = false
  if (model) {
    opts.onProgress?.("writing the narrative…")
    const told = await composeNarrative(date, evidence, model.call, { onWindow: (d, n) => opts.onProgress?.(`narrative: ${d} of ${n} parts written…`) })
    if (told) {
      narrative = { ...told, ...(model.model ? { model: model.model } : {}) }
      fresh = true
      cacheNarrative(date, narrative)
    }
    // Leave alone a doc edited by hand while the model was writing.
    if (!(await handEdited(date, first.bodyHash))) await write(narrative, fresh ? undefined : narrative ? STALE : "the model gave no narrative", false)
  }
  return { status: "built", date, docId: first.docId, rows: evidence.length, narrated: !!narrative, version, ...(first.keptCopyId ? { keptCopyId: first.keptCopyId } : {}), ...(narrative?.model ? { model: narrative.model } : {}) }
}

/** Keep an amendment in the person's words, then rebuild the day. */
export async function amendDayLog(date: string, text: string, via: Amendment["via"], opts: BuildOpts = {}): Promise<{ amendment: Amendment; result: BuildResult }> {
  const amendment = makeAmendment(date, text, via, opts.now)
  useDayLogStore.getState().addAmendment(amendment)
  const result = await buildDayLog(date, opts.sources ? { ...opts, sources: { ...opts.sources, amendments: [...opts.sources.amendments, amendment] } } : opts)
  return { amendment, result }
}

// ---------------------------------------------------------------- BIM chat lane

function resultLine(r: BuildResult): string {
  if (r.status === "skipped") return `Day Log for ${r.date} not built: ${r.reason}.`
  return `${dayLogTitle(r.date)} is in Docs → ${DAY_LOG_FOLDER.replace("/", " → ")} (version ${r.version}, ${r.rows} rows${r.narrated ? "" : ", no narrative: turn LLM on for the prose"}).${r.keptCopyId ? " Your hand edits were kept as a copy beside it." : ""}`
}

/** "day log", "make yesterday's masterlog", "day log monday: I was at the gym 9–10". Null when the line is not for this BIMBY. */
export async function tryDayLog(text: string, now: Date, opts: { llm: boolean }): Promise<{ text: string; route: string } | null> {
  const ask = readDayLogAsk(text, now)
  if (!ask) return null
  const by = opts.llm ? "model" : "code"
  if (ask.kind === "amend") {
    const { amendment, result } = await amendDayLog(ask.date, ask.text, "bim", { llm: opts.llm, now })
    return { text: `Kept your ${amendment.kind} for ${ask.date}, word for word. ${resultLine(result)}`, route: `DAY LOG · amended · ${by}` }
  }
  const result = await buildDayLog(ask.date, { llm: opts.llm, now })
  return { text: resultLine(result), route: `DAY LOG · ${result.status} · ${by}` }
}

// ---------------------------------------------------------------- automatic

const FIRST_RUN_DELAY_MS = 3 * 60_000
const EVERY_MS = 60 * 60_000
let running = false

export async function runDayLogTick(now = new Date()): Promise<BuildResult[]> {
  if (running) return []
  running = true
  try {
    const llm = useBimLlmMode.getState().on
    const plan = autoPlan(now, useDayLogStore.getState().logs, (d) => gatherDay(readDaySources(d)).length >= 5, llm)
    const done: BuildResult[] = []
    for (const p of plan) done.push(await buildDayLog(p.date, { llm: p.llm, auto: true, now }))
    return done
  } finally {
    running = false
  }
}

export const DAY_LOG_AUTO_KEY = "brain2-day-log-auto"

export function dayLogAutoOn(): boolean {
  try {
    return localStorage.getItem(DAY_LOG_AUTO_KEY) !== "off"
  } catch {
    return true
  }
}

export function setDayLogAuto(on: boolean): void {
  try {
    localStorage.setItem(DAY_LOG_AUTO_KEY, on ? "on" : "off")
  } catch {
    /* ignore */
  }
}

/** Start after the task vault loads (and the shared vault has had time to arrive), then hourly. Returns a stop. */
export function startDayLogBimby(): () => void {
  if (typeof window === "undefined" || isPhoneWebStorage()) return () => {}
  let timer: ReturnType<typeof setInterval> | undefined
  let first: ReturnType<typeof setTimeout> | undefined
  const tick = () => {
    if (dayLogAutoOn()) void runDayLogTick()
  }
  const stopHydrate = afterPersistHydrated(useTaskStore.persist, () => {
    first = setTimeout(tick, FIRST_RUN_DELAY_MS)
    timer = setInterval(tick, EVERY_MS)
  })
  return () => {
    stopHydrate()
    if (first) clearTimeout(first)
    if (timer) clearInterval(timer)
  }
}

export { amendmentsFor, dayLogDocId }

/**
 * lib/week-log-bimby/run.ts — Build a Week Log, amend it, and keep weeks current
 *
 * `buildWeekLog(start)`: for each of the seven days, read the day's rows
 * (`readDaySources` → `gatherDay`) and its Day Log prose (this device's cache),
 * fold it (`summarizeDay`), render, file, then ask the model for the week's
 * brief when LLM mode is on. The code-built log is filed first, so a reload
 * mid-way still leaves every number filed. A build without the model keeps the
 * week's last prose (kept in the record) and says it is from an earlier build.
 *
 * `amendWeekLog(start, text)`: keep the words, then rebuild.
 *
 * `startWeekLogBimby()`: the automatic pipeline (desktop only). Five minutes
 * after the vault loads (after the Day Log BIMBY's first run), then hourly.
 */
"use client"

import { formatLocalDateKey } from "@/lib/date-utils"
import { makeAmendment } from "@/lib/day-log-bimby/amend"
import { gatherDay, MINUTES_PER_DAY } from "@/lib/day-log-bimby/gather"
import { cachedDayNarrative, DAY_LOG_WRITTEN_EVENT, dayLogAutoOn, inOneWindow, logModelFor, type BuildOpts } from "@/lib/day-log-bimby/run"
import { readDaySources } from "@/lib/day-log-bimby/sources"
import type { DayNarrative, DaySources } from "@/lib/day-log-bimby/types"
import { useBimLlmMode } from "@/lib/ingest/bim-switchboard"
import { isPhoneWebStorage } from "@/lib/phone-device"
import { useTaskStore } from "@/lib/task-store"
import { afterPersistHydrated } from "@/lib/use-persist-hydrated"
import { composeWeek } from "./compose"
import { fileWeekLog, weekHandEdited } from "./file"
import { renderWeekLog, THIN_DAY } from "./render"
import { autoWeekPlan } from "./schedule"
import { useWeekLogStore, weekAmendmentsFor, weekLogRecord } from "./store"
import { emptyDay, summarizeDay } from "./summarize"
import type { DaySummary, WeekAmendment, WeekNarrative } from "./types"
import { readWeekLogAsk, WEEK_LOG_FOLDER, weekDays, weekLogTitle, weekStartKey } from "./week"

export interface WeekBuildOpts extends Pick<BuildOpts, "llm" | "call" | "auto" | "now" | "onProgress"> {
  /** Each day's sources instead of the stores (tests). */
  days?: Record<string, DaySources>
  /** Each day's prose instead of this device's cache (tests). */
  narratives?: Record<string, DayNarrative>
}

export type WeekBuildResult =
  | { status: "built"; start: string; docId: string; rows: number; days: number; narrated: boolean; version: number; keptCopyId?: string; model?: string }
  | { status: "skipped"; start: string; reason: string }

/** The seven days, folded. Days after today are marked not yet. */
export function foldWeek(start: string, now: Date, opts: Pick<WeekBuildOpts, "days" | "narratives"> = {}): DaySummary[] {
  const today = formatLocalDateKey(now)
  return weekDays(start).map((d) => {
    if (d > today) return emptyDay(d, true)
    const evidence = gatherDay(opts.days?.[d] ?? readDaySources(d))
    const narrative = opts.narratives ? (opts.narratives[d] ?? null) : cachedDayNarrative(d)
    return summarizeDay(d, evidence, narrative, d === today ? now.getHours() * 60 + now.getMinutes() : MINUTES_PER_DAY)
  })
}

let chain: Promise<unknown> = Promise.resolve()

/** Build (or rebuild) one week's log. Builds run one at a time. */
export function buildWeekLog(start: string, opts: WeekBuildOpts = {}): Promise<WeekBuildResult> {
  const run = chain.then(() => buildNow(weekStartKey(start), opts))
  chain = run.catch(() => undefined)
  return run
}

async function buildNow(start: string, opts: WeekBuildOpts): Promise<WeekBuildResult> {
  const now = opts.now ?? new Date()
  if (start > formatLocalDateKey(now)) return { status: "skipped", start, reason: "that week has not started yet" }
  const record = weekLogRecord(start)
  const edited = await weekHandEdited(start, record?.bodyHash)
  if (edited && opts.auto) return { status: "skipped", start, reason: "the doc was edited by hand; rebuild it yourself (your edited copy is kept)" }

  opts.onProgress?.("reading the seven days…")
  const days = foldWeek(start, now, opts)
  const amendments = weekAmendmentsFor(start)
  const rows = days.reduce((s, d) => s + d.rows, 0)
  const version = (record?.version ?? 0) + 1
  const kept = record?.narrative ?? null
  const STALE = "narrative from an earlier build; newer days and amendments are in the lists but not yet in the prose"

  const write = async (narrative: WeekNarrative | null, note: string | undefined, keepHandEdits: boolean) => {
    const html = renderWeekLog({ start, days, narrative, amendments, builtAt: now, version, ...(note ? { note } : {}) })
    const filed = await fileWeekLog(start, html, { keepHandEdits })
    useWeekLogStore.getState().putLog({
      id: start,
      docId: filed.docId,
      builtAt: now.toISOString(),
      version,
      bodyHash: filed.bodyHash,
      rows,
      narrated: !!narrative,
      ...(narrative?.model ? { model: narrative.model } : {}),
      ...(narrative ? { narrative } : {}),
    })
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(DAY_LOG_WRITTEN_EVENT, { detail: { docId: filed.docId, week: start } }))
    return filed
  }

  const model = rows ? await logModelFor(opts) : null
  const first = await write(kept, model ? "the narrative is being written" : kept ? STALE : undefined, edited)
  let narrative = kept
  if (model) {
    opts.onProgress?.("writing the week…")
    const told = await composeWeek(start, days, amendments, model.call)
    if (told) narrative = { ...told, ...(model.model ? { model: model.model } : {}) }
    if (!(await weekHandEdited(start, first.bodyHash))) await write(narrative, told ? undefined : narrative ? STALE : "the model gave no narrative", false)
  }
  return {
    status: "built",
    start,
    docId: first.docId,
    rows,
    days: days.filter((d) => d.rows).length,
    narrated: !!narrative,
    version,
    ...(first.keptCopyId ? { keptCopyId: first.keptCopyId } : {}),
    ...(narrative?.model ? { model: narrative.model } : {}),
  }
}

/** Keep an amendment in the person's words, then rebuild the week. */
export async function amendWeekLog(start: string, text: string, via: WeekAmendment["via"], opts: WeekBuildOpts = {}): Promise<{ amendment: WeekAmendment; result: WeekBuildResult }> {
  const amendment = makeAmendment(weekStartKey(start), text, via, opts.now)
  useWeekLogStore.getState().addAmendment(amendment)
  return { amendment, result: await buildWeekLog(start, opts) }
}

// ---------------------------------------------------------------- BIM chat

export function weekResultLine(r: WeekBuildResult): string {
  if (r.status === "skipped") return `Week Log for the week of ${r.start} not built: ${r.reason}.`
  return `${weekLogTitle(r.start)} is in Docs → ${WEEK_LOG_FOLDER.replace("/", " → ")} (version ${r.version}, ${r.days} of 7 days, ${r.rows} rows${r.narrated ? "" : ", no narrative: turn LLM on for the prose"}).${r.keptCopyId ? " Your hand edits were kept as a copy beside it." : ""}`
}

/** "week log", "last week's week log", "week log: Tuesday I was sick all day". Null when the line is not for this BIMBY. */
export async function tryWeekLog(text: string, now: Date, opts: { llm: boolean }): Promise<{ text: string; route: string } | null> {
  const ask = readWeekLogAsk(text, now)
  if (!ask) return null
  const by = opts.llm ? "model" : "code"
  if (ask.kind === "amend") {
    const { amendment, result } = await amendWeekLog(ask.start, ask.text, "bim", { llm: opts.llm, now })
    return { text: `Kept your ${amendment.kind} for the week of ${ask.start}, word for word. ${weekResultLine(result)}`, route: `WEEK LOG · amended · ${by}` }
  }
  const result = await buildWeekLog(ask.start, { llm: opts.llm, now })
  return { text: weekResultLine(result), route: `WEEK LOG · ${result.status} · ${by}` }
}

// ---------------------------------------------------------------- automatic

const FIRST_RUN_DELAY_MS = 5 * 60_000
const EVERY_MS = 60 * 60_000
let running = false

/** A week has data when any of its days has a Day Log's worth of rows. */
function weekHasData(start: string, now: Date): boolean {
  const today = formatLocalDateKey(now)
  return weekDays(start).some((d) => d <= today && gatherDay(readDaySources(d)).length >= THIN_DAY)
}

export async function runWeekLogTick(now = new Date()): Promise<WeekBuildResult[]> {
  if (running) return []
  running = true
  try {
    return (
      (await inOneWindow("brain2-week-log-tick", async () => {
        const llm = useBimLlmMode.getState().on
        const plan = autoWeekPlan(now, useWeekLogStore.getState().logs, (s) => weekHasData(s, now), llm)
        const done: WeekBuildResult[] = []
        for (const p of plan) done.push(await buildWeekLog(p.start, { llm: p.llm, auto: true, now }))
        return done
      })) ?? []
    )
  } finally {
    running = false
  }
}

/** Start after the task vault loads, then hourly. Off with the Day Log switch (`brain2-day-log-auto`). Returns a stop. */
export function startWeekLogBimby(): () => void {
  if (typeof window === "undefined" || isPhoneWebStorage()) return () => {}
  let timer: ReturnType<typeof setInterval> | undefined
  let first: ReturnType<typeof setTimeout> | undefined
  const tick = () => {
    if (dayLogAutoOn()) void runWeekLogTick()
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
